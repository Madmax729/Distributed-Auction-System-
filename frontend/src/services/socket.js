// ─── Socket.io Client Service ─────────────────────────────────
import { io } from 'socket.io-client';

let socket = null;

export const getSocket = () => {
  if (!socket) {
    socket = io('/', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    socket.on('connect', () => {
      console.log(`[Socket.io] Connected: ${socket.id}`);
    });

    socket.on('disconnect', (reason) => {
      console.warn(`[Socket.io] Disconnected: ${reason}`);
    });

    socket.on('connect_error', (err) => {
      console.error(`[Socket.io] Connection error: ${err.message}`);
    });
  }

  return socket;
};

export const joinAuctionRoom = (auctionId) => {
  const s = getSocket();
  s.emit('join-auction', auctionId);
};

export const leaveAuctionRoom = (auctionId) => {
  const s = getSocket();
  s.emit('leave-auction', auctionId);
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
