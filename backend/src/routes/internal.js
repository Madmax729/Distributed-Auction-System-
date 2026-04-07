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
  getPeerServers,
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
      // Broadcast to clients connected to this follower (and via Redis to ALL servers)
      const roomName = `auction:${bid.auctionId}`;
      console.log(
        `[Replication][Server ${SERVER_ID}] ✅ Applied replicated bid. Broadcasting to room ${roomName}`,
      );
      console.log(
        `  Event sent to: ${global.io?.sockets.adapter.rooms.get(roomName)?.size || 0} local sockets (Redis bridges to other servers)`,
      );
      if (global.io) {
        global.io.to(roomName).emit("new-bid", {
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

// ─── GET /api/internal/all-servers-status ────────────────────
// Fetch status of all peer servers (for Admin page)
// Returns current server status + all peers' health
router.get("/all-servers-status", async (req, res) => {
  try {
    const state = getLeaderState();
    const peers = getPeerServers();
    const statusMap = {};

    // Add current server status
    statusMap[SERVER_ID] = {
      serverId: SERVER_ID,
      isLeader: state.isLeader,
      currentLeader: state.currentLeader,
      lamportClock: getLamportClock(),
      port: process.env.PORT,
      online: true,
    };

    // Fetch status from all peer servers in parallel
    await Promise.allSettled(
      peers.map(async (peer) => {
        try {
          const res = await require("axios").get(
            `${peer.url}/api/server-info`,
            {
              timeout: 2000,
            },
          );
          statusMap[peer.id] = {
            ...res.data,
            online: true,
          };
        } catch (err) {
          statusMap[peer.id] = {
            serverId: peer.id,
            online: false,
            error: err.message,
          };
        }
      }),
    );

    res.json({
      servers: statusMap,
      queryTime: Date.now(),
    });
  } catch (err) {
    console.error(
      `[Internal][Server ${SERVER_ID}] All servers status error:`,
      err.message,
    );
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
