import { useState } from 'react';

export default function UserSetupModal({ onComplete }) {
  const [name,  setName]  = useState('');
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
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'var(--modal-overlay)',
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
      animation: 'fadeIn 0.2s ease',
    }}>
      <div className="glass-card animate-scaleIn" style={{
        maxWidth: 380, width: '100%',
        padding: '40px 32px',
        textAlign: 'center',
        borderColor: 'var(--accent-border)',
        boxShadow: 'var(--shadow-lg)',
      }}>
        {/* Logo mark */}
        <div style={{
          width: 48, height: 48,
          background: 'var(--accent)',
          borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px',
          boxShadow: '0 4px 20px rgba(99,102,241,0.35)',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <polygon points="12,2 22,8.5 22,15.5 12,22 2,15.5 2,8.5"/>
          </svg>
        </div>

        <h1 style={{
          fontSize: 20, fontFamily: 'Space Grotesk, sans-serif',
          fontWeight: 700, marginBottom: 8, letterSpacing: '-0.3px',
          color: 'var(--text-1)',
        }}>
          Welcome to <span className="text-gradient">AuctionX</span>
        </h1>
        <p style={{ color: 'var(--text-3)', fontSize: 13, lineHeight: 1.65, marginBottom: 28 }}>
          A distributed real-time auction platform.<br />
          Pick a display name to get started.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-group" style={{ textAlign: 'left' }}>
            <label className="form-label" htmlFor="user-name-input">Display Name</label>
            <input
              id="user-name-input"
              className="input-field"
              type="text"
              placeholder="e.g. Alice, Bob…"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
              autoFocus
              maxLength={30}
            />
            {error && (
              <span style={{ fontSize: 12, color: 'var(--red)', textAlign: 'left' }}>{error}</span>
            )}
          </div>

          <button
            id="join-auction-btn"
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
          >
            Enter
          </button>
        </form>

        <div style={{
          marginTop: 22,
          display: 'flex', gap: 14, justifyContent: 'center',
          fontSize: 11, color: 'var(--text-3)',
        }}>
          <span>Real-time bidding</span>
          <span>·</span>
          <span>Fault tolerant</span>
          <span>·</span>
          <span>Fair ordering</span>
        </div>
      </div>
    </div>
  );
}
