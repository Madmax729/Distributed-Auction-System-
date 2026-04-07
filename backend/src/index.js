// ============================================================
// DISTRIBUTED ONLINE AUCTION SYSTEM - Main Server Entry Point
// ============================================================
// This server participates in a distributed cluster with:
//   - Leader-Follower replication
//   - Bully Algorithm leader election
//   - Lamport logical clocks for bid ordering
//   - Socket.io real-time broadcasting
// ============================================================

require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const { createClient } = require("redis");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");

const connectDB = require("./config/database");
const { initHeartbeat } = require("./distributed/heartbeat");
const {
  initLeaderElection,
  getLeaderState,
} = require("./distributed/leaderElection");
const { getLamportClock } = require("./distributed/lamportClock");

// Routes
const auctionRoutes = require("./routes/auction");
const bidRoutes = require("./routes/bid");
const internalRoutes = require("./routes/internal");
const uploadRoutes = require("./routes/upload");
const loadTestRoutes = require("./routes/loadtest");

const app = express();
const server = http.createServer(app);

// ─── Redis Setup (for Socket.io adapter) ──────────────────────
// 🔥 CRITICAL: Redis allows Socket.io to share rooms/messages across all server instances
const REDIS_URL = process.env.REDIS_URL || "redis://redis:6379";
const pubClient = createClient({ url: REDIS_URL });
const subClient = pubClient.duplicate();

let redisConnected = false;

Promise.all([pubClient.connect(), subClient.connect()])
  .then(() => {
    redisConnected = true;
    console.log("[Redis] ✅ Connected to Redis at", REDIS_URL);
  })
  .catch((err) => {
    console.error("[Redis] ❌ Connection failed:", err.message);
    console.warn(
      "[Redis] WARNING: Falling back to in-memory Socket.io (single-server only)",
    );
  });

// ─── Socket.io Configuration (Ngrok + NGINX Compatible) ────────
// 🔥 With Redis adapter: all servers share rooms + events
const io = new Server(server, {
  cors: {
    origin: "*", // Accept all origins (safe with NGINX proxy validation)
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"], // WebSocket first, fallback to polling
  path: "/socket.io",
  allowUpgrades: true,

  // ─── Ngrok-specific tuning ───────────────────────────────────
  // Ngrok may have stricter timeout policies
  pingInterval: 30000, // Send ping every 30s (heartbeat to keep connection alive)
  pingTimeout: 60000, // Wait 60s for pong before considering connection dead

  // ─── Connection pool settings ────────────────────────────────
  maxHttpBufferSize: 1e6, // 1MB max message size
  serveClientVersion: true,

  // ─── Trust proxy headers from NGINX ──────────────────────────
  trustProxy: true, // Trust X-Forwarded-For, X-Real-IP from NGINX
});

// 🔥 CRITICAL: Attach Redis adapter to Socket.io
// This ensures all server instances share rooms and broadcast messages
if (redisConnected) {
  console.log(
    "[Socket.io] 🔌 Attaching Redis adapter for cross-server synchronization",
  );
  io.adapter(createAdapter(pubClient, subClient));
} else {
  console.warn(
    "[Socket.io] ⚠️  Running without Redis adapter (single-server mode only)",
  );
}

// ─── Make io accessible globally and via req (MUST be first!) ──
global.io = io;
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ─── Trust proxy from NGINX ───────────────────────────────────
app.set("trust proxy", 1); // Trust NGINX (1 proxy hop)

// ─── Middleware ───────────────────────────────────────────────
app.use(
  cors({
    origin: "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "x-user-id"],
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(morgan("combined"));

// Serve uploaded images as static files
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// ─── Routes ──────────────────────────────────────────────────
app.use("/api/auctions", auctionRoutes);
app.use("/api/bids", bidRoutes);
app.use("/api/internal", internalRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api", loadTestRoutes);

// Health check endpoint (used by load balancer + peer heartbeats)
app.get("/health", (req, res) => {
  const state = getLeaderState();
  res.json({
    status: "ok",
    serverId: process.env.SERVER_ID,
    isLeader: state.isLeader,
    currentLeader: state.currentLeader,
    lamportClock: getLamportClock(),
    timestamp: Date.now(),
  });
});

// Server info endpoint
app.get("/api/server-info", (req, res) => {
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
io.on("connection", (socket) => {
  const socketServer = process.env.SERVER_ID || "1";
  console.log(
    `[Socket.io][Server ${socketServer}] 🔌 Client connected: ${socket.id}`,
  );
  console.log(
    `  Total connected clients: ${Object.keys(io.sockets.sockets).length}`,
  );
  if (redisConnected) {
    console.log(`  ✅ Redis adapter active - events broadcast to all servers`);
  }

  socket.on("join-auction", (roomName) => {
    // roomName format: auction:${auctionId}
    socket.join(roomName);
    console.log(
      `[Socket.io][Server ${socketServer}] ✅ Client ${socket.id} joined room: ${roomName}`,
    );
    const roomSize = io.sockets.adapter.rooms.get(roomName)?.size || 0;
    console.log(
      `  Sockets in room ${roomName}: ${roomSize} (Redis adapter: ${redisConnected ? "enabled" : "disabled"})`,
    );
  });

  socket.on("leave-auction", (roomName) => {
    // roomName format: auction:${auctionId}
    socket.leave(roomName);
    console.log(
      `[Socket.io][Server ${socketServer}] ❌ Client ${socket.id} left room: ${roomName}`,
    );
    console.log(
      `  Sockets in room ${roomName}: ${io.sockets.adapter.rooms.get(roomName)?.size || 0}`,
    );
  });

  socket.on("disconnect", () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

// ─── Startup ─────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
const SERVER_ID = process.env.SERVER_ID || "1";

async function start() {
  try {
    // Connect to MongoDB — throws on failure so we don't start without a DB
    await connectDB();
    console.log(`[Server ${SERVER_ID}] Connected to MongoDB ✅`);

    // Start HTTP server on all interfaces (0.0.0.0 for Docker + LAN)
    server.listen(PORT, "0.0.0.0", () => {
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
    console.error(
      `\n[Server ${SERVER_ID}] ❌ STARTUP FAILED:\n  ${err.message}`,
    );
    if (
      err.message?.includes("timed out") ||
      err.name === "MongoServerSelectionError"
    ) {
      console.error(
        "\n[DB] ⚠️  This is likely a MongoDB Atlas IP whitelist issue.\n" +
          "  1. Go to https://cloud.mongodb.com → Security → Network Access\n" +
          "  2. Add your public IP or 0.0.0.0/0 (allow from anywhere)\n" +
          "  3. Wait ~30s then restart: docker compose down && docker compose up --build\n",
      );
    }
    process.exit(1);
  }
}

start();

module.exports = { app, io };
