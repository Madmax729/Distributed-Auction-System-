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
  category: {
    type: String,
    enum: ['Electronics', 'Art', 'Collectibles', 'Vehicles', 'Fashion', 'Sports', 'Books', 'Other'],
    default: 'Other',
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
    type: String,
    default: null,
  },
  highestBidderName: {
    type: String,
    default: null,
  },
  bidCount: {
    type: Number,
    default: 0,
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
    type: String,
    required: true,
  },
  createdByName: {
    type: String,
    default: 'Anonymous',
  },
  imagePath: {
    type: String,
    default: null,
  },
  lastLamportTimestamp: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

// Index for searching by status
auctionSchema.index({ status: 1, createdAt: -1 });
auctionSchema.index({ category: 1, status: 1 });

module.exports = mongoose.model('Auction', auctionSchema);
