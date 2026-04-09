// ─── Bid Routes ───────────────────────────────────────────────
// Only the LEADER accepts write operations (bids).
// Followers forward bid requests to the leader.
// ─────────────────────────────────────────────────────────────

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const router = express.Router();

const Bid = require('../models/Bid');
const Auction = require('../models/Auction');
const User = require('../models/User');
const { bidRateLimiter } = require('../middleware/rateLimiter');
const { getLeaderState, getPeerServers } = require('../distributed/leaderElection');
const { getClockForSend, updateClock } = require('../distributed/lamportClock');
const { replicateBid } = require('../distributed/replication');
const { setCache, invalidateCache } = require('../config/redisClient');

const SERVER_ID = process.env.SERVER_ID || '1';

// ─── POST /api/bids — Place a bid ────────────────────────────
router.post('/', bidRateLimiter, async (req, res) => {
  try {
    const { auctionId, userId, userName, amount } = req.body;

    if (!auctionId || !userId || !amount) {
      return res.status(400).json({ error: 'auctionId, userId, and amount are required' });
    }

    const state = getLeaderState();

    // ─── Mutual Exclusion: Only leader handles writes ─────────
    // If not leader, forward request to the current leader
    if (!state.isLeader) {
      console.log(
        `[Bid][Server ${SERVER_ID}] Not leader. ` +
        `Forwarding bid to Leader Server ${state.currentLeader}`
      );

      const peers = getPeerServers();
      const leaderPeer = peers.find(p => p.id === state.currentLeader);

      if (!leaderPeer) {
        return res.status(503).json({
          error: 'Leader unavailable',
          message: 'Current leader is not reachable. An election may be in progress.',
        });
      }

      try {
        const leaderResponse = await axios.post(`${leaderPeer.url}/api/bids`, req.body, {
          timeout: 5000,
          headers: { 'x-forwarded-from': `server${SERVER_ID}` },
        });
        return res.json(leaderResponse.data);
      } catch (err) {
        return res.status(503).json({
          error: 'Leader forwarding failed',
          message: err.message,
        });
      }
    }

    const bidAmount = parseFloat(amount);
    const lamportTimestamp = getClockForSend();

    // ─── Leader processes the bid Atomically ───────────────────
    const updatedAuction = await Auction.findOneAndUpdate(
      {
        auctionId,
        status: 'ONGOING',
        currentHighestBid: { $lt: bidAmount }
      },
      {
        $set: {
          currentHighestBid: bidAmount,
          highestBidder: userId,
          highestBidderName: userName || 'Anonymous',
          lastLamportTimestamp: lamportTimestamp
        },
        $inc: { bidCount: 1 }
      },
      { new: true }
    );

    let auction = updatedAuction;

    // If update failed, check the exact reason (ended, too low, etc.)
    if (!auction) {
      const currentAuction = await Auction.findOne({ auctionId });
      if (!currentAuction) return res.status(404).json({ error: 'Auction not found' });
      if (currentAuction.status === 'ENDED') {
        return res.status(400).json({ error: 'Auction has ended' });
      }

      if (new Date() > currentAuction.endTime) {
        currentAuction.status = 'ENDED';
        await currentAuction.save();
        await invalidateCache(`auction:${auctionId}`);
        await invalidateCache('auctions:list:*');
        req.io.emit('auction-ended', {
          auctionId,
          winner: currentAuction.highestBidder,
          winnerName: currentAuction.highestBidderName,
          winningBid: currentAuction.currentHighestBid,
        });
        return res.status(400).json({ error: 'Auction time has expired' });
      }

      if (bidAmount <= currentAuction.currentHighestBid) {
        return res.status(400).json({
          error: 'Bid too low',
          message: `Bid must be higher than current highest bid of $${currentAuction.currentHighestBid}`,
          currentHighestBid: currentAuction.currentHighestBid,
        });
      }
    }

    // Ensure user exists
    await User.findOneAndUpdate(
      { userId },
      { userId, name: userName || 'Anonymous' },
      { upsert: true }
    );

    // Create bid record
    const bid = new Bid({
      bidId: uuidv4(),
      auctionId,
      userId,
      userName: userName || 'Anonymous',
      amount: bidAmount,
      lamportTimestamp,
      serverId: SERVER_ID,
    });

    await bid.save();

    console.log(
      `[Bid][Leader Server ${SERVER_ID}] Accepted: $${bidAmount} by ${userId} ` +
      `on auction ${auctionId} (Lamport: ${lamportTimestamp})`
    );

    // Update Redis cache immediately for fastest reads
    await setCache(`auction:${auctionId}`, {
      auction: auction.toObject(),
      bids: await Bid.find({ auctionId }).sort({ lamportTimestamp: -1, serverId: 1 }).limit(50),
    }, 2);
    // Invalidate list cache so homepage picks up new bid data
    await invalidateCache('auctions:list:*');
    await invalidateCache(`auction:stats:${auctionId}`);

    const forwardedFrom = req.headers['x-forwarded-from'];
    const handledBy = forwardedFrom ? parseInt(forwardedFrom.replace('server', '')) : parseInt(SERVER_ID);

    // Broadcast real-time bid update to all clients
    req.io.emit('new-bid', {
      auctionId,
      bid: bid.toObject(),
      currentHighestBid: bidAmount,
      highestBidder: userId,
      highestBidderName: userName,
      lamportTimestamp,
      serverId: SERVER_ID,
      handledBy,
      bidCount: auction.bidCount,
    });

    // Replicate to followers asynchronously (don't block response)
    replicateBid(bid.toObject(), auction.toObject(), handledBy).catch(err =>
      console.error('[Bid] Replication error:', err.message)
    );

    res.status(201).json({
      bid: bid.toObject(),
      auction: auction.toObject(),
      message: 'Bid placed successfully',
      processedBy: `Server ${SERVER_ID}`,
      lamportTimestamp,
    });

  } catch (err) {
    console.error('[Bid] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/bids/:auctionId — Get bids for an auction ──────
router.get('/:auctionId', async (req, res) => {
  try {
    const bids = await Bid.find({ auctionId: req.params.auctionId })
      .sort({ lamportTimestamp: -1, serverId: 1 })
      .limit(100);
    res.json({ bids });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
