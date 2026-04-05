import { useEffect, useState } from 'react';

export default function WinnerModal({ winner, auctionId, onClose }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setVisible(true), 50);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(5, 5, 16, 0.92)',
        backdropFilter: 'blur(16px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s ease',
      }}
      onClick={handleClose}
    >
      <div
        className="glass-card"
        style={{
          maxWidth: '480px', width: '100%',
          padding: '56px 40px',
          textAlign: 'center',
          border: '1px solid rgba(255, 215, 0, 0.4)',
          boxShadow: '0 0 60px rgba(255, 215, 0, 0.2)',
          transform: visible ? 'scale(1) translateY(0)' : 'scale(0.9) translateY(20px)',
          transition: 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Trophy */}
        <div style={{
          fontSize: '80px',
          marginBottom: '16px',
          animation: 'float 2s ease-in-out infinite',
          display: 'inline-block',
          filter: 'drop-shadow(0 0 30px rgba(255,215,0,0.6))',
        }}>
          🏆
        </div>

        <h2 style={{
          fontSize: '32px',
          fontFamily: 'Space Grotesk, sans-serif',
          marginBottom: '8px',
          background: 'linear-gradient(135deg, #ffd700, #f97316)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          Auction Ended!
        </h2>

        <p style={{ color: 'rgba(240,240,255,0.5)', marginBottom: '32px', fontSize: '14px' }}>
          The highest bidder wins
        </p>

        <div style={{
          background: 'rgba(255, 215, 0, 0.08)',
          border: '1px solid rgba(255, 215, 0, 0.25)',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '24px',
        }}>
          <div style={{ fontSize: '14px', color: 'rgba(240,240,255,0.5)', marginBottom: 8 }}>
            🎉 Winner
          </div>
          <div style={{
            fontSize: '26px', fontWeight: 800,
            fontFamily: 'Space Grotesk, sans-serif',
            color: '#ffd700', marginBottom: 8,
          }}>
            {winner.winnerName || 'Anonymous'}
          </div>
          <div style={{
            fontSize: '36px', fontWeight: 900,
            background: 'linear-gradient(135deg, #ffd700, #f97316)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            ${winner.winningBid?.toLocaleString()}
          </div>
        </div>

        <button
          id="winner-modal-close-btn"
          className="btn btn-gold btn-lg"
          onClick={handleClose}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          🎊 Close
        </button>
      </div>
    </div>
  );
}
