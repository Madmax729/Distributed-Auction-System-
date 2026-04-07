// ─── Server Status Banner ─────────────────────────────────────
// Shows a prominent banner when the backend is unreachable.
// Subscribes to both Socket.io state and API reachability.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react';
import { onConnectionStateChange } from '../services/socket';
import { onServerReachabilityChange, serverAPI } from '../services/api';
import toast from 'react-hot-toast';

export default function ServerStatusBanner() {
  const [socketState, setSocketState] = useState('connected');
  const [apiReachable, setApiReachable] = useState(true);
  const [retryIn, setRetryIn] = useState(0);
  const wasDown = useRef(false);
  const retryTimer = useRef(null);
  const pollTimer = useRef(null);

  useEffect(() => {
    const unsubSocket = onConnectionStateChange(setSocketState);
    const unsubApi = onServerReachabilityChange(setApiReachable);
    return () => { unsubSocket(); unsubApi(); };
  }, []);

  const isDown = socketState !== 'connected' || !apiReachable;

  // Poll health when down
  useEffect(() => {
    if (isDown) {
      wasDown.current = true;
      let countdown = 5;
      setRetryIn(countdown);

      retryTimer.current = setInterval(() => {
        countdown--;
        setRetryIn(countdown);
        if (countdown <= 0) {
          countdown = 5;
          setRetryIn(countdown);
          // Ping health
          serverAPI.health().catch(() => {});
        }
      }, 1000);

      return () => clearInterval(retryTimer.current);
    } else {
      clearInterval(retryTimer.current);
      setRetryIn(0);
      if (wasDown.current) {
        wasDown.current = false;
        toast.success('Server reconnected!', { duration: 3000, icon: '✅' });
      }
    }
  }, [isDown]);

  if (!isDown) return null;

  const isReconnecting = socketState === 'reconnecting';

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10000,
      background: isReconnecting
        ? 'linear-gradient(90deg, #b45309, #d97706)'
        : 'linear-gradient(90deg, #dc2626, #ef4444)',
      color: '#fff',
      padding: '10px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      fontSize: 13,
      fontWeight: 600,
      fontFamily: "'Inter', sans-serif",
      animation: 'slideDown 0.3s ease',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
    }}>
      {/* Pulsing dot */}
      <div style={{
        width: 8, height: 8,
        borderRadius: '50%',
        background: '#fff',
        animation: 'pulse 1.5s ease-in-out infinite',
        flexShrink: 0,
      }} />

      <span>
        {isReconnecting
          ? '⚠ Reconnecting to server…'
          : '⚠ Server Unreachable — Backend may be down'}
      </span>

      {retryIn > 0 && (
        <span style={{
          fontSize: 11,
          opacity: 0.8,
          background: 'rgba(255,255,255,0.15)',
          padding: '2px 8px',
          borderRadius: 4,
        }}>
          Retry in {retryIn}s
        </span>
      )}

      <style>{`
        @keyframes slideDown {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
