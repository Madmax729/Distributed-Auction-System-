// ─── Internal Server Communication Routes ────────────────────
// These endpoints are used for server-to-server communication:
//   /heartbeat       — Health check between peers
//   /replicate-bid   — Leader sends replicated bid to followers
//   /leader-election — Bully algorithm messages
// ─────────────────────────────────────────────────────────────

const express = require("express");
const router = express.Router();

const {
  handleElectionMessage,
  getLeaderState,
} = require("../distributed/leaderElection");
const { applyReplicatedBid } = require("../distributed/replication");
const { updateClock, getLamportClock } = require("../distributed/lamportClock");

const SERVER_ID = process.env.SERVER_ID || "1";

// ─── GET /api/internal/heartbeat ─────────────────────────────
router.get("/heartbeat", (req, res) => {
  const state = getLeaderState();
  res.json({
    serverId: SERVER_ID,
    isLeader: state.isLeader,
    currentLeader: state.currentLeader,
    lamportClock: getLamportClock(),
    status: "alive",
    timestamp: Date.now(),
  });
});

// ─── POST /api/internal/replicate-bid ────────────────────────
// Receives replicated bid from leader and applies it locally
router.post("/replicate-bid", async (req, res) => {
  try {
    const { bid, auction, sourceLeader, lamportTimestamp } = req.body;

    if (!bid || !auction) {
      return res.status(400).json({ error: "bid and auction data required" });
    }

    console.log(
      `[Internal][Server ${SERVER_ID}] Received replication from Leader ${sourceLeader}: ` +
        `bid ${bid.bidId} ($${bid.amount}) (Lamport: ${lamportTimestamp})`,
    );

    // Apply the replicated bid (updates Lamport clock internally)
    const success = await applyReplicatedBid(bid, auction, lamportTimestamp);

    if (success) {
      // Broadcast to clients connected to this follower
      if (global.io) {
        global.io.to(`auction:${bid.auctionId}`).emit("new-bid", {
          auctionId: bid.auctionId,
          bid,
          currentHighestBid: auction.currentHighestBid,
          highestBidder: auction.highestBidder,
          highestBidderName: auction.highestBidderName,
          lamportTimestamp,
          serverId: SERVER_ID,
          replicated: true,
        });
      }

      res.json({ status: "applied", serverId: SERVER_ID });
    } else {
      res.status(500).json({ status: "failed", serverId: SERVER_ID });
    }
  } catch (err) {
    console.error(
      `[Internal][Server ${SERVER_ID}] Replication error:`,
      err.message,
    );
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/internal/leader-election ──────────────────────
// Handles Bully Algorithm messages: ELECTION and COORDINATOR
router.post("/leader-election", async (req, res) => {
  try {
    const { type, fromServerId, newLeader, timestamp } = req.body;

    if (!type) {
      return res.status(400).json({ error: "message type required" });
    }

    console.log(
      `[Internal][Server ${SERVER_ID}] Received election message: ` +
        `type=${type}, from=${fromServerId}, newLeader=${newLeader}`,
    );

    // Update Lamport clock with received timestamp
    if (timestamp) {
      updateClock(timestamp);
    }

    const result = await handleElectionMessage(type, fromServerId, newLeader);
    res.json({ ...result, serverId: SERVER_ID });
  } catch (err) {
    console.error(
      `[Internal][Server ${SERVER_ID}] Election error:`,
      err.message,
    );
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
