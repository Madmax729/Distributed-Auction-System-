// ─── Auction Model ────────────────────────────────────────────
const mongoose = require('mongoose');

const auctionSchema = new mongoose.Schema({
  auctionId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  itemName: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    default: '',
  },
  startingPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  currentHighestBid: {
    type: Number,
    default: 0,
  },
  highestBidder: {
    type: String,         // userId
    default: null,
  },
  highestBidderName: {
    type: String,
    default: null,
  },
  status: {
    type: String,
    enum: ['ONGOING', 'ENDED'],
    default: 'ONGOING',
  },
  endTime: {
    type: Date,
    required: true,
  },
  createdBy: {
    type: String,         // userId
    required: true,
  },
  imagePath: {
    type: String,
    default: null,
  },
  // Lamport timestamp of last bid applied to this auction
  lastLamportTimestamp: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Auction', auctionSchema);
