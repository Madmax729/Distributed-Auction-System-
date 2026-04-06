// ─── Socket.io Client Service ─────────────────────────────────
import { io } from "socket.io-client";

let socket = null;

// ─── Dynamic Socket URL (detects Ngrok HTTPS, localhost HTTPS/HTTP, etc) ───
const getSocketURL = () => {
  // Detect if we're using HTTPS (common with Ngrok)
  const protocol = window.location.protocol === "https:" ? "https" : "http";
  const { host } = window.location;

  // Return full URL (e.g., https://abc123.ngrok.io, http://localhost:80)
  return `${protocol}//${host}`;
};

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
      // Critical for Ngrok + NGINX: ensure headers are sent
      extraHeaders: {
        "ngrok-skip-browser-warning": "true",
      },
    });

    socket.on("connect", () => {
      console.log(`[Socket.io] Connected: ${socket.id}`);
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
  s.emit("join-auction", roomName);
};

export const leaveAuctionRoom = (auctionId) => {
  const s = getSocket();
  const roomName = `auction:${auctionId}`;
  console.log(`[Socket.io] Leaving room: ${roomName}`);
  s.emit("leave-auction", roomName);
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
