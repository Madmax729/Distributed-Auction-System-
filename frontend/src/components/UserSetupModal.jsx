import { useState } from 'react';

export default function UserSetupModal({ onComplete }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed.length < 2) {
      setError('Name must be at least 2 characters');
      return;
    }
    onComplete(trimmed);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(5, 5, 16, 0.95)',
      backdropFilter: 'blur(20px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }}>
      <div className="glass-card" style={{
        maxWidth: '420px', width: '100%',
        padding: '48px 40px',
        textAlign: 'center',
        animation: 'fadeIn 0.5s ease',
        border: '1px solid rgba(108, 99, 255, 0.3)',
      }}>
        {/* Logo */}
        <div style={{
          width: '80px', height: '80px',
          background: 'linear-gradient(135deg, #6c63ff, #4facfe)',
          borderRadius: '24px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '40px',
          margin: '0 auto 24px',
          boxShadow: '0 0 40px rgba(108, 99, 255, 0.5)',
          animation: 'float 4s ease-in-out infinite',
        }}>⚡</div>

        <h1 style={{ fontSize: '28px', marginBottom: '8px', fontFamily: 'Space Grotesk, sans-serif' }}>
          Welcome to <span style={{ background: 'linear-gradient(135deg, #6c63ff, #4facfe)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>AuctionX</span>
        </h1>
        <p style={{ color: 'rgba(240, 240, 255, 0.55)', marginBottom: '36px', fontSize: '14px', lineHeight: 1.6 }}>
          A distributed real-time auction platform with leader election and Lamport timestamps
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group" style={{ textAlign: 'left' }}>
            <label className="form-label">Your Display Name</label>
            <input
              id="user-name-input"
              className="input-field"
              type="text"
              placeholder="e.g. Alice, Bob, Charlie..."
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
              autoFocus
              maxLength={30}
            />
            {error && (
              <span style={{ fontSize: '12px', color: '#ff6584' }}>{error}</span>
            )}
          </div>

          <button
            id="join-auction-btn"
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            🚀 Enter the Auction Hall
          </button>
        </form>

        <div style={{
          marginTop: '28px',
          display: 'flex', gap: '24px', justifyContent: 'center',
          fontSize: '12px', color: 'rgba(240, 240, 255, 0.35)',
        }}>
          <span>⚡ Real-time bidding</span>
          <span>🏆 Fair winner selection</span>
          <span>🔒 Fault tolerant</span>
        </div>
      </div>
    </div>
  );
}
