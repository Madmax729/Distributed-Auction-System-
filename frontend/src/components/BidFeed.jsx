import { useEffect, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';

export default function BidFeed({ bids, currentUserId }) {
  const feedRef = useRef(null);

  // Auto-scroll to top when new bids arrive
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [bids]);

  if (!bids || bids.length === 0) {
    return (
      <div style={{
        padding: '40px 20px',
        textAlign: 'center',
        color: 'rgba(240,240,255,0.3)',
      }}>
        <div style={{ fontSize: '40px', marginBottom: 12 }}>🔇</div>
        <p style={{ fontSize: '14px' }}>No bids yet. Be the first!</p>
      </div>
    );
  }

  return (
    <div
      ref={feedRef}
      style={{
        maxHeight: '380px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '4px',
      }}
    >
      {bids.map((bid, index) => {
        const isOwnBid = bid.userId === currentUserId;
        const isTopBid = index === 0;
        const timeAgo = formatDistanceToNow(new Date(bid.createdAt || Date.now()), { addSuffix: true });

        return (
          <div
            key={bid.bidId || index}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 14px',
              borderRadius: '10px',
              background: isTopBid
                ? 'rgba(255, 215, 0, 0.08)'
                : isOwnBid
                  ? 'rgba(108, 99, 255, 0.08)'
                  : 'rgba(255, 255, 255, 0.03)',
              border: `1px solid ${
                isTopBid
                  ? 'rgba(255, 215, 0, 0.2)'
                  : isOwnBid
                    ? 'rgba(108, 99, 255, 0.2)'
                    : 'rgba(255, 255, 255, 0.05)'
              }`,
              animation: isTopBid ? 'bid-flash 0.5s ease' : 'slideIn 0.3s ease',
              animationName: index === 0 ? 'bid-flash' : 'slideIn',
              transition: 'all 0.3s ease',
            }}
          >
            {/* Avatar */}
            <div style={{
              width: '36px', height: '36px',
              borderRadius: '10px',
              background: isTopBid
                ? 'linear-gradient(135deg, #ffd700, #f97316)'
                : isOwnBid
                  ? 'linear-gradient(135deg, #6c63ff, #4facfe)'
                  : 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '14px', fontWeight: 700, color: 'white',
              flexShrink: 0,
            }}>
              {bid.userName?.charAt(0).toUpperCase() || '?'}
            </div>

            {/* Bid Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{
                  fontSize: '13px', fontWeight: 600,
                  color: isTopBid ? '#ffd700' : isOwnBid ? '#a89dff' : 'rgba(240,240,255,0.8)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {bid.userName || 'Anonymous'}
                </span>
                {isTopBid && (
                  <span style={{
                    fontSize: '10px', background: 'rgba(255,215,0,0.15)',
                    color: '#ffd700', border: '1px solid rgba(255,215,0,0.3)',
                    borderRadius: '4px', padding: '1px 5px', fontWeight: 700,
                  }}>
                    👑 HIGHEST
                  </span>
                )}
                {isOwnBid && !isTopBid && (
                  <span style={{
                    fontSize: '10px', background: 'rgba(108,99,255,0.15)',
                    color: '#a89dff', border: '1px solid rgba(108,99,255,0.3)',
                    borderRadius: '4px', padding: '1px 5px',
                  }}>
                    YOU
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: 'rgba(240,240,255,0.35)' }}>
                  ⏰ {timeAgo}
                </span>
                <span style={{ fontSize: '11px', color: 'rgba(240,240,255,0.2)' }}>
                  • S{bid.serverId} • T={bid.lamportTimestamp}
                </span>
              </div>
            </div>

            {/* Amount */}
            <div style={{
              fontSize: '18px', fontWeight: 800,
              fontFamily: 'Space Grotesk, sans-serif',
              color: isTopBid ? '#ffd700' : isOwnBid ? '#a89dff' : 'rgba(240,240,255,0.7)',
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
