import { useEffect, useState } from 'react';

export default function WinnerModal({ winner, onClose }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => { setTimeout(() => setVisible(true), 40); }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 280);
  };

  const price = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 0,
  }).format(winner.winningBid || 0);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 900,
        background: 'var(--modal-overlay)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.28s ease',
      }}
      onClick={handleClose}
    >
      <div
        className="glass-card"
        style={{
          maxWidth: 400, width: '100%',
          padding: '40px 32px',
          textAlign: 'center',
          borderColor: 'rgba(245,158,11,0.25)',
          boxShadow: 'var(--shadow-lg)',
          transform: visible ? 'scale(1) translateY(0)' : 'scale(0.92) translateY(16px)',
          transition: 'transform 0.32s cubic-bezier(0.34, 1.4, 0.64, 1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Trophy icon */}
        <div style={{
          fontSize: 48, marginBottom: 16,
          animation: 'float 3s ease-in-out infinite',
          display: 'inline-block',
        }}>
          🏆
        </div>

        <h2 style={{
          fontSize: 20, fontFamily: 'Space Grotesk, sans-serif',
          fontWeight: 700, marginBottom: 6, letterSpacing: '-0.3px',
          color: 'var(--text-1)',
        }}>
          Auction Ended
        </h2>
        <p style={{ color: 'var(--text-3)', fontSize: 13, marginBottom: 26 }}>
          The highest bidder wins.
        </p>

        {/* Winner info */}
        <div style={{
          background: 'var(--amber-dim)',
          border: '1px solid rgba(245,158,11,0.22)',
          borderRadius: 10,
          padding: '18px 22px',
          marginBottom: 22,
        }}>
          <div style={{
            fontSize: 10, color: 'var(--text-3)', marginBottom: 8,
            letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700,
          }}>
            Winner
          </div>
          <div style={{
            fontSize: 20, fontWeight: 700,
            fontFamily: 'Space Grotesk, sans-serif',
            color: 'var(--amber)', marginBottom: 6,
          }}>
            {winner.winnerName || 'Anonymous'}
          </div>
          <div style={{
            fontSize: 28, fontWeight: 800,
            color: 'var(--text-1)',
            fontFamily: 'Space Grotesk, sans-serif',
          }}>
            {price}
          </div>
        </div>

        <button
          id="winner-modal-close-btn"
          className="btn btn-gold btn-lg"
          onClick={handleClose}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
