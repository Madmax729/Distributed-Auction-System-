// ============================================================
// REPLICATION MODULE
// ============================================================
// After the Leader processes a bid, it replicates the state
// change to all Follower servers via POST /api/internal/replicate-bid
//
// This implements LEADER-FOLLOWER replication:
//   - Leader = single point of write authority
//   - Followers = read replicas, kept in sync
//   - If a follower is unavailable, replication is best-effort
//     (followers will resync when they come back online)
// ============================================================

const axios = require('axios');
const { getPeerServers } = require('./leaderElection');
const { getClockForSend } = require('./lamportClock');

/**
 * Replicate a bid to all follower servers.
 * Called by the leader after successfully processing a bid.
 *
 * @param {Object} bidData - The full bid document
 * @param {Object} auctionData - Updated auction state
 * @param {number} handledBy - The server ID that originally received the HTTP request
 */
const replicateBid = async (bidData, auctionData, handledBy) => {
  const peers = getPeerServers();
  const timestamp = getClockForSend();

  console.log(
    `[Replication] Leader replicating bid ${bidData.bidId} ` +
    `to ${peers.length} followers (Lamport: ${timestamp})`
  );

  const replicationPayload = {
    bid: bidData,
    auction: auctionData,
    handledBy,
    sourceLeader: parseInt(process.env.SERVER_ID || '1'),
    lamportTimestamp: timestamp,
  };

  const results = await Promise.allSettled(
    peers.map(peer =>
      axios.post(`${peer.url}/api/internal/replicate-bid`, replicationPayload, {
        timeout: 3000,
      }).then(res => {
        console.log(`[Replication] ✓ Server ${peer.id} acknowledged replication`);
        return res.data;
      }).catch(err => {
        console.warn(
          `[Replication] ✗ Server ${peer.id} failed to replicate: ${err.message}`
        );
        throw err;
      })
    )
  );

  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  console.log(`[Replication] Result: ${succeeded} succeeded, ${failed} failed`);
  return { succeeded, failed };
};

/**
 * Apply a replicated bid received from the leader.
 * Followers call this to update their local state.
 *
 * @param {Object} bidData - Replicated bid
 * @param {Object} auctionData - Updated auction state from leader
 * @param {number} lamportTimestamp - Leader's Lamport timestamp
 */
const applyReplicatedBid = async (bidData, auctionData, lamportTimestamp) => {
  const { updateClock } = require('./lamportClock');
  const Bid = require('../models/Bid');
  const Auction = require('../models/Auction');

  // Update Lamport clock: max(local, received) + 1
  const newClock = updateClock(lamportTimestamp);
  console.log(
    `[Replication] Applying replicated bid ${bidData.bidId}. ` +
    `Updated Lamport clock to ${newClock}`
  );

  try {
    // Upsert bid (idempotent — safe to apply multiple times)
    await Bid.findOneAndUpdate(
      { bidId: bidData.bidId },
      bidData,
      { upsert: true, new: true }
    );

    // Update auction state with idempotency check
    // Only apply if this bid has a higher or equal Lamport timestamp
    await Auction.findOneAndUpdate(
      {
        auctionId: auctionData.auctionId,
        $or: [
          { lastLamportTimestamp: { $lt: lamportTimestamp } },
          { lastLamportTimestamp: { $exists: false } },
        ],
      },
      {
        currentHighestBid: auctionData.currentHighestBid,
        highestBidder: auctionData.highestBidder,
        highestBidderName: auctionData.highestBidderName,
        status: auctionData.status,
        lastLamportTimestamp: lamportTimestamp,
      }
    );

    console.log(`[Replication] ✓ Bid ${bidData.bidId} applied successfully`);
    return true;
  } catch (err) {
    console.error(`[Replication] ✗ Failed to apply bid ${bidData.bidId}:`, err.message);
    return false;
  }
};

module.exports = { replicateBid, applyReplicatedBid };
