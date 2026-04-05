import { useEffect, useState } from 'react';
import { auctionAPI } from '../services/api';

export default function AuctionStats({ auctionId, startingPrice }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!auctionId) return;
    const fetch = async () => {
      try {
        const res = await auctionAPI.getStats(auctionId);
        setStats(res.data);
      } catch {}
    };
    fetch();
    const interval = setInterval(fetch, 10000);
    return () => clearInterval(interval);
  }, [auctionId]);

  if (!stats) return null;

  const items = [
    {
      label: 'Total Bids',
      value: stats.bidCount,
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
        </svg>
      ),
    },
    {
      label: 'Unique Bidders',
      value: stats.uniqueBidders,
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
        </svg>
      ),
    },
    {
      label: 'Price Increase',
      value: `+${stats.priceIncrease}%`,
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
          <polyline points="17 6 23 6 23 12"/>
        </svg>
      ),
      color: 'var(--green)',
    },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
      {items.map(item => (
        <div
          key={item.label}
          style={{
            background: 'var(--bg-raised)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ color: item.color || 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {item.icon}
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {item.label}
            </span>
          </div>
          <div style={{
            fontSize: 22, fontWeight: 700,
            fontFamily: 'Space Grotesk, sans-serif',
            color: item.color || 'var(--text-1)',
          }}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}
