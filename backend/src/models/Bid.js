// ─── Bid Model ────────────────────────────────────────────────
const mongoose = require('mongoose');

const bidSchema = new mongoose.Schema({
  bidId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  auctionId: {
    type: String,
    required: true,
    index: true,
  },
  userId: {
    type: String,
    required: true,
  },
  userName: {
    type: String,
    default: 'Anonymous',
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  // Lamport logical timestamp — used for ordering and tie-breaking
  lamportTimestamp: {
    type: Number,
    required: true,
  },
  // Which server processed this bid (used for tie-breaking)
  serverId: {
    type: String,
    required: true,
  },
  // Whether this bid won the auction
  isWinner: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// Compound index for efficient auction bid querying
bidSchema.index({ auctionId: 1, lamportTimestamp: 1, serverId: 1 });

module.exports = mongoose.model('Bid', bidSchema);
