// ─── Auction Routes ───────────────────────────────────────────
const express = require("express");
const { v4: uuidv4 } = require("uuid");
const router = express.Router();

const Auction = require("../models/Auction");
const Bid = require("../models/Bid");
const User = require("../models/User");

// ─── Helper: auto-end expired auctions ───────────────────────
const autoEndExpired = async (io) => {
  const now = new Date();
  const expired = await Auction.find({
    status: "ONGOING",
    endTime: { $lte: now },
  });

  for (const auction of expired) {
    const winningBid = await Bid.findOne({ auctionId: auction.auctionId }).sort(
      { amount: -1, lamportTimestamp: 1, serverId: 1 },
    );

    auction.status = "ENDED";
    if (winningBid) {
      auction.highestBidder = winningBid.userId;
      auction.highestBidderName = winningBid.userName;
      auction.currentHighestBid = winningBid.amount;
      await Bid.updateOne({ bidId: winningBid.bidId }, { isWinner: true });
    }
    await auction.save();

    if (io) {
      // 🔥 Emit ONLY to auction room, not globally
      io.to(`auction:${auction.auctionId}`).emit("auction-ended", {
        auctionId: auction.auctionId,
        winner: auction.highestBidder,
        winnerName: auction.highestBidderName,
        winningBid: auction.currentHighestBid,
      });
    }
    console.log(`[Auction] Auto-ended expired auction: ${auction.auctionId}`);
  }
};

// ─── GET /api/auctions — List auctions (with search/filter) ──
router.get("/", async (req, res) => {
  try {
    // Auto-end any expired auctions on fetch
    await autoEndExpired(req.io);

    const { status, category, search, limit = 50 } = req.query;
    const query = {};

    if (status && status !== "ALL") query.status = status;
    if (category && category !== "ALL") query.category = category;
    if (search) {
      query.$or = [
        { itemName: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const auctions = await Auction.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({ auctions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/auctions/:auctionId — Get auction details ──────
router.get("/:auctionId", async (req, res) => {
  try {
    const auction = await Auction.findOne({ auctionId: req.params.auctionId });
    if (!auction) return res.status(404).json({ error: "Auction not found" });

    // Auto-end if expired
    if (auction.status === "ONGOING" && new Date() >= auction.endTime) {
      await autoEndExpired(req.io);
      const updated = await Auction.findOne({
        auctionId: req.params.auctionId,
      });
      const bids = await Bid.find({ auctionId: req.params.auctionId })
        .sort({ lamportTimestamp: -1, serverId: 1 })
        .limit(50);
      return res.json({ auction: updated, bids });
    }

    const bids = await Bid.find({ auctionId: req.params.auctionId })
      .sort({ lamportTimestamp: -1, serverId: 1 })
      .limit(50);

    res.json({ auction, bids });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/auctions — Create a new auction ───────────────
router.post("/", async (req, res) => {
  try {
    const {
      itemName,
      description,
      startingPrice,
      endTime,
      userId,
      userName,
      imagePath,
      category,
    } = req.body;

    if (!itemName || startingPrice === undefined || !endTime || !userId) {
      return res
        .status(400)
        .json({
          error:
            "Missing required fields: itemName, startingPrice, endTime, userId",
        });
    }

    const price = parseFloat(startingPrice);
    if (isNaN(price) || price <= 0) {
      return res
        .status(400)
        .json({ error: "startingPrice must be a positive number" });
    }

    const endDate = new Date(endTime);
    if (isNaN(endDate.getTime())) {
      return res.status(400).json({ error: "endTime is not a valid date" });
    }
    if (endDate <= new Date()) {
      return res.status(400).json({ error: "endTime must be in the future" });
    }

    // Ensure user exists
    await User.findOneAndUpdate(
      { userId },
      { userId, name: userName || "Anonymous" },
      { upsert: true },
    );

    const auction = new Auction({
      auctionId: uuidv4(),
      itemName: itemName.trim(),
      description: description?.trim() || "",
      category: category || "Other",
      startingPrice: price,
      currentHighestBid: price,
      status: "ONGOING",
      endTime: endDate,
      createdBy: userId,
      createdByName: userName || "Anonymous",
      imagePath: imagePath || null,
    });

    await auction.save();
    console.log(
      `[Auction] Created: ${auction.auctionId} — "${itemName}" by ${userId}`,
    );

    req.io.emit("auction-created", { auction });
    res.status(201).json({ auction });
  } catch (err) {
    console.error("[Auction] Create error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/auctions/:auctionId/join ──────────────────────
router.post("/:auctionId/join", async (req, res) => {
  try {
    const { userId, userName } = req.body;
    const { auctionId } = req.params;

    if (!userId) return res.status(400).json({ error: "userId required" });

    const auction = await Auction.findOne({ auctionId });
    if (!auction) return res.status(404).json({ error: "Auction not found" });
    if (auction.status === "ENDED") {
      return res.status(400).json({ error: "Auction has ended" });
    }

    await User.findOneAndUpdate(
      { userId },
      { userId, name: userName || "Anonymous" },
      { upsert: true },
    );

    const bids = await Bid.find({ auctionId })
      .sort({ lamportTimestamp: -1, serverId: 1 })
      .limit(20);

    res.json({ auction, bids, message: "Joined successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/auctions/:auctionId/end ───────────────────────
router.post("/:auctionId/end", async (req, res) => {
  try {
    const { auctionId } = req.params;

    const auction = await Auction.findOne({ auctionId });
    if (!auction) return res.status(404).json({ error: "Auction not found" });
    if (auction.status === "ENDED") {
      return res.status(400).json({ error: "Auction already ended" });
    }

    const winningBid = await Bid.findOne({ auctionId }).sort({
      amount: -1,
      lamportTimestamp: 1,
      serverId: 1,
    });

    auction.status = "ENDED";
    if (winningBid) {
      auction.highestBidder = winningBid.userId;
      auction.highestBidderName = winningBid.userName;
      auction.currentHighestBid = winningBid.amount;
      await Bid.updateOne({ bidId: winningBid.bidId }, { isWinner: true });
    }

    await auction.save();
    console.log(
      `[Auction] Ended: ${auctionId}. Winner: ${auction.highestBidder || "none"}`,
    );

    // 🔥 Emit ONLY to auction room when ended manually
    if (req.io) {
      req.io.to(`auction:${auctionId}`).emit("auction-ended", {
        auctionId,
        winner: auction.highestBidder,
        winnerName: auction.highestBidderName,
        winningBid: auction.currentHighestBid,
      });
    }

    res.json({ auction, message: "Auction ended" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/auctions/:auctionId/stats ──────────────────────
router.get("/:auctionId/stats", async (req, res) => {
  try {
    const { auctionId } = req.params;
    const auction = await Auction.findOne({ auctionId });
    if (!auction) return res.status(404).json({ error: "Auction not found" });

    const [bidCount, uniqueBidders, highestBid] = await Promise.all([
      Bid.countDocuments({ auctionId }),
      Bid.distinct("userId", { auctionId }),
      Bid.findOne({ auctionId }).sort({ amount: -1 }),
    ]);

    res.json({
      bidCount,
      uniqueBidders: uniqueBidders.length,
      highestBid: highestBid?.amount || auction.startingPrice,
      priceIncrease: highestBid
        ? (
            ((highestBid.amount - auction.startingPrice) /
              auction.startingPrice) *
            100
          ).toFixed(1)
        : "0.0",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
