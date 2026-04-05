// ============================================================
// LAMPORT LOGICAL CLOCK
// ============================================================
// Implements Lamport timestamps for distributed event ordering.
//
// Rules:
//   1. Before any event: clock++
//   2. Before sending a message: clock++, attach clock to message
//   3. On receiving a message: clock = max(local, received) + 1
//
// Used for:
//   - Ordering bids across servers
//   - Tie-breaking: if two bids have same amount, the one with
//     the lower (timestamp, serverId) tuple wins
// ============================================================

let clock = 0;

/**
 * Increment clock for a local event
 */
const tickClock = () => {
  clock += 1;
  return clock;
};

/**
 * Update clock on receiving a message with an external timestamp.
 * Implements: clock = max(local, received) + 1
 */
const updateClock = (receivedTimestamp) => {
  clock = Math.max(clock, receivedTimestamp) + 1;
  return clock;
};

/**
 * Get the current Lamport clock value without incrementing
 */
const getLamportClock = () => clock;

/**
 * Get clock for outgoing message (increments first)
 */
const getClockForSend = () => {
  clock += 1;
  return clock;
};

module.exports = { tickClock, updateClock, getLamportClock, getClockForSend };
