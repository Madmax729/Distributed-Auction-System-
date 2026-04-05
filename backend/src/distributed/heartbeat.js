// ============================================================
// HEARTBEAT MONITOR
// ============================================================
// Each server periodically pings all peers to detect failures.
// If the LEADER fails to respond to heartbeats, an election
// is triggered using the Bully Algorithm.
//
// Heartbeat interval: 3 seconds
// Failure threshold: 2 consecutive missed heartbeats
// ============================================================

const axios = require('axios');
const { getLeaderState, startElection, getPeerServers } = require('./leaderElection');

const HEARTBEAT_INTERVAL = 5000;   // 5 seconds
const FAILURE_THRESHOLD = 3;       // missed beats before declaring failure

// Track failure counts per peer
const failureCounts = {};

/**
 * Ping a single peer server and record result
 */
const pingPeer = async (peer, io) => {
  try {
    const response = await axios.get(`${peer.url}/health`, { timeout: 2000 });
    // Reset failure count on successful ping
    failureCounts[peer.id] = 0;
    return response.data;
  } catch (err) {
    failureCounts[peer.id] = (failureCounts[peer.id] || 0) + 1;
    console.warn(
      `[Heartbeat] Server ${peer.id} unreachable ` +
      `(failure count: ${failureCounts[peer.id]}): ${err.message}`
    );

    // Check if leader has failed
    const state = getLeaderState();
    if (
      peer.id === state.currentLeader &&
      failureCounts[peer.id] >= FAILURE_THRESHOLD
    ) {
      console.error(
        `[Heartbeat] Leader Server ${peer.id} has FAILED! ` +
        `Initiating Bully election...`
      );

      // Notify clients that leader may be down
      if (io) {
        io.emit('server-event', {
          type: 'LEADER_FAILURE',
          failedServer: peer.id,
          message: `Leader Server ${peer.id} is unreachable. Starting election...`,
        });
      }

      // Trigger election
      await startElection();
    }

    return null;
  }
};

/**
 * Broadcast heartbeat to all peers and collect status
 */
const runHeartbeatRound = async (io) => {
  const peers = getPeerServers();
  if (peers.length === 0) return;

  const statusMap = {};
  await Promise.allSettled(
    peers.map(async (peer) => {
      const result = await pingPeer(peer, io);
      statusMap[peer.id] = result
        ? { online: true, isLeader: result.isLeader, lamportClock: result.lamportClock }
        : { online: false };
    })
  );

  // Broadcast server status to all connected clients
  if (io) {
    io.emit('server-status', {
      serverId: process.env.SERVER_ID,
      peers: statusMap,
      timestamp: Date.now(),
    });
  }
};

/**
 * Initialize heartbeat module — starts periodic ping loop
 */
const initHeartbeat = (io) => {
  console.log(`[Heartbeat] Starting heartbeat monitor (interval: ${HEARTBEAT_INTERVAL}ms)`);

  setInterval(async () => {
    try {
      await runHeartbeatRound(io);
    } catch (err) {
      console.error('[Heartbeat] Error during heartbeat round:', err.message);
    }
  }, HEARTBEAT_INTERVAL);
};

module.exports = { initHeartbeat, pingPeer };
