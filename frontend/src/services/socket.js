// ─── Socket.io Client Service ─────────────────────────────────
import { io } from 'socket.io-client';

let socket = null;

// Connection state tracking
let connectionState = 'disconnected'; // 'connected' | 'disconnected' | 'reconnecting'
const stateListeners = new Set();

function notifyStateChange(newState) {
  connectionState = newState;
  stateListeners.forEach(fn => fn(newState));
}

export const onConnectionStateChange = (listener) => {
  stateListeners.add(listener);
  // Immediately notify with current state
  listener(connectionState);
  return () => stateListeners.delete(listener);
};

export const getConnectionState = () => connectionState;

export const getSocket = () => {
  if (!socket) {
    socket = io('/', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      timeout: 10000,
    });

    socket.on('connect', () => {
      console.log(`[Socket.io] Connected: ${socket.id}`);
      notifyStateChange('connected');
    });

    socket.on('disconnect', (reason) => {
      console.warn(`[Socket.io] Disconnected: ${reason}`);
      notifyStateChange('disconnected');
    });

    socket.on('reconnecting', () => {
      notifyStateChange('reconnecting');
    });

    socket.on('reconnect_attempt', () => {
      notifyStateChange('reconnecting');
    });

    socket.on('reconnect', () => {
      console.log('[Socket.io] Reconnected');
      notifyStateChange('connected');
    });

    socket.on('reconnect_failed', () => {
      notifyStateChange('disconnected');
    });

    socket.on('connect_error', (err) => {
      console.error(`[Socket.io] Connection error: ${err.message}`);
      notifyStateChange('reconnecting');
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
    notifyStateChange('disconnected');
  }
};
