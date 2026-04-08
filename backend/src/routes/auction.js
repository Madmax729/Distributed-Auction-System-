// ─── Auction Routes ───────────────────────────────────────────
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

const Auction = require('../models/Auction');
const Bid = require('../models/Bid');
const User = require('../models/User');
const { getCache, setCache, invalidateCache } = require('../config/redisClient');

// ─── Helper: auto-end expired auctions ───────────────────────
const autoEndExpired = async (io) => {
  const now = new Date();
  const expired = await Auction.find({ status: 'ONGOING', endTime: { $lte: now } });

  for (const auction of expired) {
    const winningBid = await Bid.findOne({ auctionId: auction.auctionId })
      .sort({ amount: -1, lamportTimestamp: 1, serverId: 1 });

    auction.status = 'ENDED';
    if (winningBid) {
      auction.highestBidder     = winningBid.userId;
      auction.highestBidderName = winningBid.userName;
      auction.currentHighestBid = winningBid.amount;
      await Bid.updateOne({ bidId: winningBid.bidId }, { isWinner: true });
    }
    await auction.save();

    // Invalidate caches
    await invalidateCache(`auction:${auction.auctionId}`);
    await invalidateCache('auctions:list:*');

    if (io) {
      io.emit('auction-ended', {
        auctionId:   auction.auctionId,
        winner:      auction.highestBidder,
        winnerName:  auction.highestBidderName,
        winningBid:  auction.currentHighestBid,
      });
    }
    console.log(`[Auction] Auto-ended expired auction: ${auction.auctionId}`);
  }
};

// ─── GET /api/auctions — List auctions (with search/filter) ──
router.get('/', async (req, res) => {
  try {
    // Auto-end any expired auctions on fetch
    await autoEndExpired(req.io);

    const { status, category, search, limit = 50 } = req.query;

    // Try Redis cache first (only for non-search queries)
    if (!search) {
      const cacheKey = `auctions:list:${status || 'ALL'}:${category || 'ALL'}:${limit}`;
      const cached = await getCache(cacheKey);
      if (cached) {
        return res.json(cached);
      }
    }

    const query = {};
    if (status && status !== 'ALL') query.status = status;
    if (category && category !== 'ALL') query.category = category;
    if (search) {
      query.$or = [
        { auctionId: search },
        { itemName:    { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const auctions = await Auction.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    const result = { auctions };

    // Cache for 2 seconds (non-search only)
    if (!search) {
      const cacheKey = `auctions:list:${status || 'ALL'}:${category || 'ALL'}:${limit}`;
      await setCache(cacheKey, result, 2);
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/auctions/:auctionId — Get auction details ──────
router.get('/:auctionId', async (req, res) => {
  try {
    const { auctionId } = req.params;

    // Try Redis cache
    const cacheKey = `auction:${auctionId}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      // Still check if expired
      if (cached.auction?.status === 'ONGOING' && new Date() >= new Date(cached.auction.endTime)) {
        await invalidateCache(cacheKey);
      } else {
        return res.json(cached);
      }
    }

    const auction = await Auction.findOne({ auctionId });
    if (!auction) return res.status(404).json({ error: 'Auction not found' });

    // Auto-end if expired
    if (auction.status === 'ONGOING' && new Date() >= auction.endTime) {
      await autoEndExpired(req.io);
      const updated = await Auction.findOne({ auctionId });
      const bids = await Bid.find({ auctionId })
        .sort({ lamportTimestamp: -1, serverId: 1 }).limit(50);
      const result = { auction: updated, bids };
      await setCache(cacheKey, result, 3);
      return res.json(result);
    }

    const bids = await Bid.find({ auctionId })
      .sort({ lamportTimestamp: -1, serverId: 1 })
      .limit(50);

    const result = { auction, bids };
    await setCache(cacheKey, result, 1); // 1s TTL for active auctions
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/auctions — Create a new auction ───────────────
router.post('/', async (req, res) => {
  try {
    const {
      itemName, description, startingPrice, endTime,
      userId, userName, imagePath, category, auctionId,
    } = req.body;

    if (!itemName || startingPrice === undefined || !endTime || !userId) {
      return res.status(400).json({ error: 'Missing required fields: itemName, startingPrice, endTime, userId' });
    }

    const price = parseFloat(startingPrice);
    if (isNaN(price) || price <= 0) {
      return res.status(400).json({ error: 'startingPrice must be a positive number' });
    }

    const endDate = new Date(endTime);
    if (isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'endTime is not a valid date' });
    }
    if (endDate <= new Date()) {
      return res.status(400).json({ error: 'endTime must be in the future' });
    }

    // Ensure user exists
    await User.findOneAndUpdate(
      { userId },
      { userId, name: userName || 'Anonymous' },
      { upsert: true }
    );

    const auction = new Auction({
      auctionId:        auctionId || uuidv4(),
      itemName:         itemName.trim(),
      description:      description?.trim() || '',
      category:         category || 'Other',
      startingPrice:    price,
      currentHighestBid: price,
      status:           'ONGOING',
      endTime:          endDate,
      createdBy:        userId,
      createdByName:    userName || 'Anonymous',
      imagePath:        imagePath || null,
    });

    await auction.save();
    console.log(`[Auction] Created: ${auction.auctionId} — "${itemName}" by ${userId}`);

    // Invalidate list cache
    await invalidateCache('auctions:list:*');

    req.io.emit('auction-created', { auction });
    res.status(201).json({ auction });
  } catch (err) {
    console.error('[Auction] Create error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/auctions/:auctionId/join ──────────────────────
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

    await User.findOneAndUpdate(
      { userId },
      { userId, name: userName || 'Anonymous' },
      { upsert: true }
    );

    const bids = await Bid.find({ auctionId })
      .sort({ lamportTimestamp: -1, serverId: 1 })
      .limit(20);

    res.json({ auction, bids, message: 'Joined successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/auctions/:auctionId/end ───────────────────────
router.post('/:auctionId/end', async (req, res) => {
  try {
    const { auctionId } = req.params;

    const auction = await Auction.findOne({ auctionId });
    if (!auction) return res.status(404).json({ error: 'Auction not found' });
    if (auction.status === 'ENDED') {
      return res.status(400).json({ error: 'Auction already ended' });
    }

    const winningBid = await Bid.findOne({ auctionId })
      .sort({ amount: -1, lamportTimestamp: 1, serverId: 1 });

    auction.status = 'ENDED';
    if (winningBid) {
      auction.highestBidder     = winningBid.userId;
      auction.highestBidderName = winningBid.userName;
      auction.currentHighestBid = winningBid.amount;
      await Bid.updateOne({ bidId: winningBid.bidId }, { isWinner: true });
    }

    await auction.save();
    console.log(`[Auction] Ended: ${auctionId}. Winner: ${auction.highestBidder || 'none'}`);

    // Invalidate caches
    await invalidateCache(`auction:${auctionId}`);
    await invalidateCache('auctions:list:*');

    req.io.emit('auction-ended', {
      auctionId,
      winner:    auction.highestBidder,
      winnerName: auction.highestBidderName,
      winningBid: auction.currentHighestBid,
    });

    res.json({ auction, message: 'Auction ended' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/auctions/:auctionId/stats ──────────────────────
router.get('/:auctionId/stats', async (req, res) => {
  try {
    const { auctionId } = req.params;

    // Try cache
    const cacheKey = `auction:stats:${auctionId}`;
    const cached = await getCache(cacheKey);
    if (cached) return res.json(cached);

    const auction = await Auction.findOne({ auctionId });
    if (!auction) return res.status(404).json({ error: 'Auction not found' });

    const [bidCount, uniqueBidders, highestBid] = await Promise.all([
      Bid.countDocuments({ auctionId }),
      Bid.distinct('userId', { auctionId }),
      Bid.findOne({ auctionId }).sort({ amount: -1 }),
    ]);

    const result = {
      bidCount,
      uniqueBidders: uniqueBidders.length,
      highestBid: highestBid?.amount || auction.startingPrice,
      priceIncrease: highestBid
        ? (((highestBid.amount - auction.startingPrice) / auction.startingPrice) * 100).toFixed(1)
        : '0.0',
    };

    await setCache(cacheKey, result, 3);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
