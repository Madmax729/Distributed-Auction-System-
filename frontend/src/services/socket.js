// ─── Socket.io Client Service ─────────────────────────────────
import { io } from "socket.io-client";

let socket = null;

// ─── Dynamic Socket URL (detects Ngrok HTTPS, localhost HTTPS/HTTP, etc) ───
const getSocketURL = () => {
  // Socket.io will auto-detect protocol and create WebSocket URL
  // Just pass the host - Socket.io handles wss:// for HTTPS, ws:// for HTTP
  return window.location.host; // e.g., "localhost", "abc123.ngrok.io", "192.168.1.100"
};

// Track active auction rooms for reconnect
let activeAuctionRooms = [];

export const getSocket = () => {
  if (!socket) {
    const socketURL = getSocketURL();
    console.log(`[Socket.io] Connecting to: ${socketURL}`);

    socket = io(socketURL, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
      reconnectionDelayMax: 5000,
      // Critical for Ngrok + NGINX: ensure headers are sent
      extraHeaders: {
        "ngrok-skip-browser-warning": "true",
      },
    });

    socket.on("connect", () => {
      console.log(`[Socket.io] Connected: ${socket.id}`);
      // 🔥 Rejoin all active auction rooms after reconnect
      console.log(
        `[Socket.io] Rejoining ${activeAuctionRooms.length} active rooms after reconnect`,
      );
      activeAuctionRooms.forEach((roomName) => {
        console.log(`[Socket.io] Rejoin room: ${roomName}`);
        socket.emit("join-auction", roomName);
      });
    });

    socket.on("disconnect", (reason) => {
      console.warn(`[Socket.io] Disconnected: ${reason}`);
    });

    socket.on("connect_error", (err) => {
      console.error(`[Socket.io] Connection error: ${err.message}`);
    });
  }

  return socket;
};

export const joinAuctionRoom = (auctionId) => {
  const s = getSocket();
  const roomName = `auction:${auctionId}`;
  console.log(`[Socket.io] Joining room: ${roomName}`);
  console.log(
    `[Socket.io] Active rooms before join: ${activeAuctionRooms.length}`,
  );

  // Track room for reconnect
  if (!activeAuctionRooms.includes(roomName)) {
    activeAuctionRooms.push(roomName);
    console.log(
      `[Socket.io] Added to active rooms. Total: ${activeAuctionRooms.length}`,
    );
  }

  s.emit("join-auction", roomName);
};

export const leaveAuctionRoom = (auctionId) => {
  const s = getSocket();
  const roomName = `auction:${auctionId}`;
  console.log(`[Socket.io] Leaving room: ${roomName}`);

  // Remove from active rooms tracking
  activeAuctionRooms = activeAuctionRooms.filter((r) => r !== roomName);
  console.log(
    `[Socket.io] Removed from active rooms. Total: ${activeAuctionRooms.length}`,
  );

  s.emit("leave-auction", roomName);
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
