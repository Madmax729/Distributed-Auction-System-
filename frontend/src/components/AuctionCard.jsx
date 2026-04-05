import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';

export default function AuctionCard({ auction, onEnd, isOwner }) {
  const [hovered, setHovered] = useState(false);

  const isOngoing = auction.status === 'ONGOING';
  const endTime = new Date(auction.endTime);
  const isExpired = endTime < new Date();
  const timeLeft = isOngoing && !isExpired
    ? formatDistanceToNow(endTime, { addSuffix: false })
    : null;

  const priceFormatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(auction.currentHighestBid || auction.startingPrice);

  return (
    <div
      className="glass-card"
      style={{
        overflow: 'hidden',
        cursor: 'pointer',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        animation: 'fadeIn 0.5s ease',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Image */}
      <div style={{
        height: '200px',
        background: auction.imagePath
          ? `url(${auction.imagePath}) center/cover`
          : 'linear-gradient(135deg, rgba(108,99,255,0.3), rgba(79,172,254,0.2))',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Status Badge */}
        <div style={{ position: 'absolute', top: 12, left: 12 }}>
          <span className={`badge ${isOngoing && !isExpired ? 'badge-ongoing' : 'badge-ended'}`}>
            {isOngoing && !isExpired
              ? <><span className="live-dot" style={{ width: 6, height: 6 }} />LIVE</>
              : 'ENDED'}
          </span>
        </div>

        {/* Price overlay */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(transparent, rgba(5,5,16,0.9))',
          padding: '40px 16px 16px',
        }}>
          <div style={{
            fontSize: '28px', fontWeight: 800,
            fontFamily: 'Space Grotesk, sans-serif',
            background: 'linear-gradient(135deg, #ffd700, #f97316)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            {priceFormatted}
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(240,240,255,0.5)', marginTop: 2 }}>
            Current Highest Bid
          </div>
        </div>

        {/* Shine effect on hover */}
        {hovered && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.08) 50%, transparent 60%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1s ease',
          }} />
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '20px' }}>
        <h3 style={{
          fontSize: '18px', fontWeight: 700,
          fontFamily: 'Space Grotesk, sans-serif',
          marginBottom: '8px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {auction.itemName}
        </h3>

        {auction.description && (
          <p style={{
            fontSize: '13px', color: 'rgba(240,240,255,0.5)',
            marginBottom: '16px', lineHeight: 1.5,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}>
            {auction.description}
          </p>
        )}

        {/* Stats row */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '16px',
        }}>
          {timeLeft && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '13px', color: 'rgba(240,240,255,0.5)' }}>⏱</span>
              <span style={{ fontSize: '13px', color: '#00e5a0', fontWeight: 600 }}>
                {timeLeft} left
              </span>
            </div>
          )}

          {auction.highestBidderName && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '11px', color: 'rgba(240,240,255,0.4)' }}>
                🏆 {auction.highestBidderName}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <Link
            to={`/auction/${auction.auctionId}`}
            className="btn btn-primary"
            style={{ flex: 1, justifyContent: 'center', textDecoration: 'none' }}
          >
            {isOngoing && !isExpired ? '🔥 Join & Bid' : '👁 View Results'}
          </Link>

          {isOwner && isOngoing && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={(e) => { e.stopPropagation(); onEnd(auction.auctionId); }}
              style={{ flexShrink: 0 }}
            >
              ⏹ End
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
