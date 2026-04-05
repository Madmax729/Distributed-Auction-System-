import { useEffect, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';

export default function BidFeed({ bids, currentUserId }) {
  const feedRef = useRef(null);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [bids]);

  if (!bids || bids.length === 0) {
    return (
      <div style={{
        padding: '36px 20px', textAlign: 'center',
        color: 'var(--text-3)',
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.35, marginBottom: 10 }}>
          <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
          <path d="M8 15s1.5-2 4-2 4 2 4 2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
        </svg>
        <p style={{ fontSize: 13 }}>No bids yet — be the first!</p>
      </div>
    );
  }

  return (
    <div
      ref={feedRef}
      style={{
        maxHeight: 360, overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: 6,
        padding: '2px',
      }}
    >
      {bids.map((bid, index) => {
        const isOwnBid = bid.userId === currentUserId;
        const isTopBid = index === 0;
        const timeAgo  = formatDistanceToNow(new Date(bid.createdAt || Date.now()), { addSuffix: true });

        return (
          <div
            key={bid.bidId || index}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 8,
              background: isTopBid
                ? 'var(--amber-dim)'
                : isOwnBid
                  ? 'var(--accent-dim)'
                  : 'var(--bg-raised)',
              border: `1px solid ${
                isTopBid
                  ? 'rgba(245,158,11,0.20)'
                  : isOwnBid
                    ? 'var(--accent-border)'
                    : 'var(--border)'
              }`,
              animation: index === 0 ? 'bidFlash 0.5s ease' : 'slideIn 0.25s ease',
              transition: 'all 0.2s ease',
            }}
          >
            {/* Avatar */}
            <div style={{
              width: 32, height: 32,
              borderRadius: 8,
              background: isTopBid
                ? 'var(--amber)'
                : isOwnBid
                  ? 'var(--accent)'
                  : 'var(--bg-overlay)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: '#fff',
              flexShrink: 0,
            }}>
              {bid.userName?.charAt(0).toUpperCase() || '?'}
            </div>

            {/* Bid Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                <span style={{
                  fontSize: 13, fontWeight: 600,
                  color: isTopBid ? 'var(--amber)' : isOwnBid ? 'var(--accent-light)' : 'var(--text-1)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {bid.userName || 'Anonymous'}
                </span>
                {isTopBid && (
                  <span style={{
                    fontSize: 9, background: 'var(--amber-dim)',
                    color: 'var(--amber)', border: '1px solid rgba(245,158,11,0.25)',
                    borderRadius: 3, padding: '1px 5px', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                  }}>
                    Top
                  </span>
                )}
                {isOwnBid && !isTopBid && (
                  <span style={{
                    fontSize: 9, background: 'var(--accent-dim)',
                    color: 'var(--accent-light)', border: '1px solid var(--accent-border)',
                    borderRadius: 3, padding: '1px 5px',
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                  }}>
                    You
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{timeAgo}</span>
                <span style={{ fontSize: 10, color: 'var(--text-3)' }}>
                  · S{bid.serverId} · T={bid.lamportTimestamp}
                </span>
              </div>
            </div>

            {/* Amount */}
            <div style={{
              fontSize: 16, fontWeight: 700,
              fontFamily: 'Space Grotesk, sans-serif',
              color: isTopBid ? 'var(--amber)' : isOwnBid ? 'var(--accent-light)' : 'var(--text-1)',
              flexShrink: 0,
            }}>
              ${bid.amount?.toLocaleString()}
            </div>
          </div>
        );
      })}
    </div>
  );
}
