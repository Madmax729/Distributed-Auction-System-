// ============================================================
// DISTRIBUTED ONLINE AUCTION SYSTEM - Main Server Entry Point
// ============================================================
// This server participates in a distributed cluster with:
//   - Leader-Follower replication
//   - Bully Algorithm leader election
//   - Lamport logical clocks for bid ordering
//   - Socket.io real-time broadcasting
// ============================================================

require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const connectDB = require('./config/database');
const { initHeartbeat } = require('./distributed/heartbeat');
const { initLeaderElection, getLeaderState } = require('./distributed/leaderElection');
const { getLamportClock } = require('./distributed/lamportClock');

// Routes
const auctionRoutes = require('./routes/auction');
const bidRoutes = require('./routes/bid');
const internalRoutes = require('./routes/internal');
const uploadRoutes = require('./routes/upload');
const loadTestRoutes = require('./routes/loadtest');

const app = express();
const server = http.createServer(app);

// Socket.io with CORS for cross-origin WebSocket support
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
  path: '/socket.io',
  // Allow sticky sessions to work through NGINX
  allowUpgrades: true,
});

// ─── Make io accessible globally and via req (MUST be first!) ──
global.io = io;
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ─── Middleware ───────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined'));

// Serve uploaded images as static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ─── Routes ──────────────────────────────────────────────────
app.use('/api/auctions', auctionRoutes);
app.use('/api/bids', bidRoutes);
app.use('/api/internal', internalRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api', loadTestRoutes);

// Health check endpoint (used by load balancer + peer heartbeats)
app.get('/health', (req, res) => {
  const state = getLeaderState();
  res.json({
    status: 'ok',
    serverId: process.env.SERVER_ID,
    isLeader: state.isLeader,
    currentLeader: state.currentLeader,
    lamportClock: getLamportClock(),
    timestamp: Date.now(),
  });
});

// Server info endpoint
app.get('/api/server-info', (req, res) => {
  const state = getLeaderState();
  res.json({
    serverId: process.env.SERVER_ID,
    isLeader: state.isLeader,
    currentLeader: state.currentLeader,
    port: process.env.PORT,
    uptime: process.uptime(),
    lamportClock: getLamportClock(),
  });
});

// ─── Socket.io Connection Handling ───────────────────────────
io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  socket.on('join-auction', (auctionId) => {
    socket.join(`auction:${auctionId}`);
    console.log(`[Socket.io] Client ${socket.id} joined auction room: ${auctionId}`);
  });

  socket.on('leave-auction', (auctionId) => {
    socket.leave(`auction:${auctionId}`);
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

// ─── Startup ─────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
const SERVER_ID = process.env.SERVER_ID || '1';

async function start() {
  try {
    // Connect to MongoDB — throws on failure so we don't start without a DB
    await connectDB();
    console.log(`[Server ${SERVER_ID}] Connected to MongoDB ✅`);

    // Start HTTP server on all interfaces (0.0.0.0 for Docker + LAN)
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`[Server ${SERVER_ID}] Listening on 0.0.0.0:${PORT}`);
    });

    // Initialize distributed system components after a short delay
    // (allow all containers to start up)
    setTimeout(() => {
      initLeaderElection();
      initHeartbeat(io);
      console.log(`[Server ${SERVER_ID}] Distributed modules initialized`);
    }, 3000);

  } catch (err) {
    console.error(`\n[Server ${SERVER_ID}] ❌ STARTUP FAILED:\n  ${err.message}`);
    if (err.message?.includes('timed out') || err.name === 'MongoServerSelectionError') {
      console.error(
        '\n[DB] ⚠️  This is likely a MongoDB Atlas IP whitelist issue.\n' +
        '  1. Go to https://cloud.mongodb.com → Security → Network Access\n' +
        '  2. Add your public IP or 0.0.0.0/0 (allow from anywhere)\n' +
        '  3. Wait ~30s then restart: docker compose down && docker compose up --build\n'
      );
    }
    process.exit(1);
  }
}

start();

module.exports = { app, io };
