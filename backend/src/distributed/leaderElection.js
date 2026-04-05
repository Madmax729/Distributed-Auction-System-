// ============================================================
// BULLY ALGORITHM — LEADER ELECTION
// ============================================================
// How it works across our 4 Docker containers (S1–S4):
//
//   STARTUP (no pre-assigned leader — Docker mode):
//     Every server waits a staggered delay then runs startElection().
//     S1 contacts S2, S3, S4 → they all respond → S1 stands down.
//     S4 (highest ID) contacts nobody higher → declares itself LEADER.
//     S4 broadcasts COORDINATOR to S1, S2, S3. Done.
//
//   FAILURE RECOVERY:
//     Heartbeat detects leader gone → startElection().
//     Next-highest live server wins → broadcasts COORDINATOR.
//
//   Phase 1 — ELECTION:
//     Server sends ELECTION to all peers with HIGHER SERVER_ID.
//     If no response → declare self as leader.
//     If someone responds → stand down, wait for COORDINATOR.
//
//   Phase 2 — COORDINATOR:
//     Winner broadcasts COORDINATOR to all peers.
// ============================================================

const axios = require('axios');

const SERVER_ID = parseInt(process.env.SERVER_ID || '1');
const IS_LEADER  = process.env.IS_LEADER === 'true';

// How long to wait for a COORDINATOR after a higher peer responded OK.
// Safety net in case that peer crashes right after replying.
const COORDINATOR_WAIT_MS = 5000;

// ─── Peer Discovery ───────────────────────────────────────────
// Reads PEER_SERVERS env var: "http://server2:3002,http://server3:3003,..."
const getPeerServers = () => {
  const peers = process.env.PEER_SERVERS || '';
  return peers.split(',').filter(Boolean).map(url => ({
    url: url.trim(),
    id: extractServerId(url.trim()),
  }));
};

const extractServerId = (url) => {
  const match = url.match(/server(\d+)/);
  return match ? parseInt(match[1]) : 0;
};

// ─── Shared leader state (read by /health, /api/server-info) ──
let leaderState = {
  isLeader: IS_LEADER,
  currentLeader: IS_LEADER ? SERVER_ID : null,
  electionInProgress: false,
};

// Timer: if we don't receive COORDINATOR in time, re-run election
let coordinatorWaitTimer = null;

const clearCoordinatorWait = () => {
  if (coordinatorWaitTimer) {
    clearTimeout(coordinatorWaitTimer);
    coordinatorWaitTimer = null;
  }
};

/**
 * Returns current leader state
 */
const getLeaderState = () => leaderState;

/**
 * Record a new leader. Called on COORDINATOR receipt or self-win.
 */
const setLeader = (leaderId) => {
  clearCoordinatorWait();
  leaderState.currentLeader = leaderId;
  leaderState.isLeader = (leaderId === SERVER_ID);
  leaderState.electionInProgress = false;

  const role = leaderState.isLeader
    ? '🏆 THIS SERVER IS NOW LEADER'
    : `follower → leader is S${leaderId}`;
  console.log(`[Bully][S${SERVER_ID}] ${role}`);

  // Push real-time update to all connected browser clients
  if (global.io) {
    global.io.emit('leader-changed', {
      newLeader: leaderId,
      isCurrentServerLeader: leaderState.isLeader,
    });
  }
};

/**
 * Phase 1 — Start a Bully election.
 *
 * Called by:
 *  - initLeaderElection() at startup when no leader is pre-assigned
 *  - heartbeat.js when the current leader stops responding
 */
const startElection = async () => {
  if (leaderState.electionInProgress) {
    console.log(`[Bully][S${SERVER_ID}] Election already running — skip`);
    return;
  }

  leaderState.electionInProgress = true;
  console.log(`[Bully][S${SERVER_ID}] ── ELECTION started ────────────────`);

  const peers = getPeerServers();
  const higherPeers = peers.filter(p => p.id > SERVER_ID);

  // No higher peers → this server wins immediately
  if (higherPeers.length === 0) {
    console.log(`[Bully][S${SERVER_ID}] Highest living ID → declaring self LEADER`);
    await declareLeader(peers);
    return;
  }

  // Send ELECTION messages to all higher-ID peers
  console.log(
    `[Bully][S${SERVER_ID}] Sending ELECTION → ` +
    higherPeers.map(p => 'S' + p.id).join(', ')
  );

  const responses = await Promise.allSettled(
    higherPeers.map(peer =>
      axios.post(
        `${peer.url}/api/internal/leader-election`,
        { type: 'ELECTION', fromServerId: SERVER_ID, timestamp: Date.now() },
        { timeout: 2000 }
      )
    )
  );

  const anyResponded = responses.some(r => r.status === 'fulfilled');

  if (!anyResponded) {
    // All higher-ID peers are down → this server wins
    console.log(`[Bully][S${SERVER_ID}] No higher peer replied → declaring self LEADER`);
    await declareLeader(peers);
  } else {
    // A higher-ID peer is alive — it will run its own election & send COORDINATOR
    console.log(
      `[Bully][S${SERVER_ID}] Higher peer responded — ` +
      `waiting ${COORDINATOR_WAIT_MS}ms for COORDINATOR`
    );
    leaderState.electionInProgress = false;

    // Safety net: re-elect if COORDINATOR never arrives
    coordinatorWaitTimer = setTimeout(async () => {
      if (!leaderState.currentLeader) {
        console.warn(`[Bully][S${SERVER_ID}] COORDINATOR timeout — restarting election`);
        await startElection();
      }
    }, COORDINATOR_WAIT_MS);
  }
};

/**
 * Phase 2 — Broadcast COORDINATOR to all peers.
 * This server has won the election.
 */
const declareLeader = async (peers) => {
  setLeader(SERVER_ID);

  const allPeers = peers || getPeerServers();
  console.log(`[Bully][S${SERVER_ID}] Broadcasting COORDINATOR to all peers`);

  await Promise.allSettled(
    allPeers.map(peer =>
      axios.post(
        `${peer.url}/api/internal/leader-election`,
        { type: 'COORDINATOR', newLeader: SERVER_ID, timestamp: Date.now() },
        { timeout: 2000 }
      ).catch(err =>
        console.warn(`[Bully][S${SERVER_ID}] Could not notify S${peer.id}: ${err.message}`)
      )
    )
  );
};

/**
 * Handle an incoming election message from a peer.
 * Called by POST /api/internal/leader-election
 */
const handleElectionMessage = async (type, fromServerId, newLeader) => {
  if (type === 'ELECTION') {
    console.log(`[Bully][S${SERVER_ID}] ← ELECTION from S${fromServerId}`);
    // Reply immediately so the sender stands down;
    // then assert our own higher ID by starting our election
    setTimeout(() => startElection(), 100);
    return { status: 'OK', serverId: SERVER_ID };
  }

  if (type === 'COORDINATOR') {
    console.log(`[Bully][S${SERVER_ID}] ← COORDINATOR — new leader is S${newLeader}`);
    setLeader(newLeader);
    return { status: 'ACK' };
  }

  return { status: 'UNKNOWN' };
};

/**
 * Initialize leader election on server startup.
 *
 *  IS_LEADER=true  → Pre-assigned leader (local dev / testing).
 *                    Announces itself immediately.
 *
 *  IS_LEADER=false → Docker mode (all 4 servers equal at start).
 *                    Each server waits a staggered delay then calls startElection().
 *                    Stagger formula: 2000ms + (SERVER_ID × 500ms)
 *                      S1 → 2500ms   S2 → 3000ms
 *                      S3 → 3500ms   S4 → 4000ms
 *                    By the time S4's timer fires, S1–S3 have already sent
 *                    ELECTION to S4, S4 replied OK, and S4 is already running
 *                    its election → S4 wins, sends COORDINATOR to all.
 */
const initLeaderElection = async () => {
  console.log(`[Bully][S${SERVER_ID}] Init — IS_LEADER=${IS_LEADER}`);

  if (IS_LEADER) {
    const peers = getPeerServers();
    setTimeout(async () => await declareLeader(peers), 1000);
    return;
  }

  // Docker mode — staggered startup election
  const delay = 2000 + SERVER_ID * 500;
  console.log(`[Bully][S${SERVER_ID}] No pre-assigned leader. Running election in ${delay}ms`);

  setTimeout(async () => {
    if (!leaderState.currentLeader) {
      await startElection();
    } else {
      console.log(
        `[Bully][S${SERVER_ID}] Leader S${leaderState.currentLeader} ` +
        `already elected — skipping startup election`
      );
    }
  }, delay);
};

module.exports = {
  getLeaderState,
  setLeader,
  startElection,
  declareLeader,
  handleElectionMessage,
  initLeaderElection,
  getPeerServers,
};
