// ─── Auction Routes ───────────────────────────────────────────
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

const Auction = require('../models/Auction');
const Bid = require('../models/Bid');
const User = require('../models/User');

// ─── GET /api/auctions — List all active auctions ────────────
router.get('/', async (req, res) => {
  try {
    const auctions = await Auction.find().sort({ createdAt: -1 });
    res.json({ auctions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/auctions/:auctionId — Get auction details ──────
router.get('/:auctionId', async (req, res) => {
  try {
    const auction = await Auction.findOne({ auctionId: req.params.auctionId });
    if (!auction) return res.status(404).json({ error: 'Auction not found' });

    const bids = await Bid.find({ auctionId: req.params.auctionId })
      .sort({ lamportTimestamp: -1, serverId: 1 })
      .limit(50);

    res.json({ auction, bids });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/auctions — Create a new auction ───────────────
router.post('/', async (req, res) => {
  try {
    const { itemName, description, startingPrice, endTime, userId, userName, imagePath } = req.body;

    if (!itemName || !startingPrice || !endTime || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Ensure user exists
    await User.findOneAndUpdate(
      { userId },
      { userId, name: userName || 'Anonymous' },
      { upsert: true }
    );

    const auction = new Auction({
      auctionId: uuidv4(),
      itemName,
      description: description || '',
      startingPrice: parseFloat(startingPrice),
      currentHighestBid: parseFloat(startingPrice),
      status: 'ONGOING',
      endTime: new Date(endTime),
      createdBy: userId,
      imagePath: imagePath || null,
    });

    await auction.save();

    console.log(`[Auction] Created: ${auction.auctionId} — "${itemName}"`);

    // Broadcast new auction to all clients
    req.io.emit('auction-created', { auction });

    res.status(201).json({ auction });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/auctions/:auctionId/join — Join an auction ────
router.post('/:auctionId/join', async (req, res) => {
  try {
    const { userId, userName } = req.body;
    const { auctionId } = req.params;

    if (!userId) return res.status(400).json({ error: 'userId required' });

    const auction = await Auction.findOne({ auctionId });
    if (!auction) return res.status(404).json({ error: 'Auction not found' });
    if (auction.status === 'ENDED') {
      return res.status(400).json({ error: 'Auction has ended' });
    }

    // Ensure user exists
    await User.findOneAndUpdate(
      { userId },
      { userId, name: userName || 'Anonymous' },
      { upsert: true }
    );

    console.log(`[Auction] User ${userId} joined auction ${auctionId}`);

    const bids = await Bid.find({ auctionId })
      .sort({ lamportTimestamp: -1, serverId: 1 })
      .limit(20);

    res.json({ auction, bids, message: 'Joined successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/auctions/:auctionId/end — End an auction ──────
router.post('/:auctionId/end', async (req, res) => {
  try {
    const { auctionId } = req.params;

    const auction = await Auction.findOne({ auctionId });
    if (!auction) return res.status(404).json({ error: 'Auction not found' });
    if (auction.status === 'ENDED') {
      return res.status(400).json({ error: 'Auction already ended' });
    }

    // Find the winning bid using Lamport timestamp + serverId tie-breaking
    const winningBid = await Bid.findOne({ auctionId })
      .sort({ amount: -1, lamportTimestamp: 1, serverId: 1 })
      .limit(1);

    auction.status = 'ENDED';
    if (winningBid) {
      auction.highestBidder = winningBid.userId;
      auction.highestBidderName = winningBid.userName;
      auction.currentHighestBid = winningBid.amount;
      await Bid.updateOne({ bidId: winningBid.bidId }, { isWinner: true });
    }

    await auction.save();

    console.log(`[Auction] Ended: ${auctionId}. Winner: ${auction.highestBidder}`);

    // Broadcast auction end with winner
    req.io.emit('auction-ended', {
      auctionId,
      winner: auction.highestBidder,
      winnerName: auction.highestBidderName,
      winningBid: auction.currentHighestBid,
    });

    res.json({ auction, message: 'Auction ended' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
