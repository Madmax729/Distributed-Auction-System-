import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { auctionAPI } from '../services/api';
import { getSocket } from '../services/socket';
import AuctionCard from '../components/AuctionCard';
import toast from 'react-hot-toast';

export default function HomePage({ user }) {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL'); // ALL | ONGOING | ENDED

  useEffect(() => {
    fetchAuctions();

    const socket = getSocket();

    // Listen for new auctions
    socket.on('auction-created', (data) => {
      setAuctions(prev => [data.auction, ...prev]);
      toast.success(`🔥 New auction: ${data.auction.itemName}`);
    });

    // Listen for auction endings
    socket.on('auction-ended', (data) => {
      setAuctions(prev =>
        prev.map(a =>
          a.auctionId === data.auctionId
            ? { ...a, status: 'ENDED', highestBidder: data.winner, highestBidderName: data.winnerName }
            : a
        )
      );
    });

    // Listen for new bids (update highest bid on cards)
    socket.on('new-bid', (data) => {
      setAuctions(prev =>
        prev.map(a =>
          a.auctionId === data.auctionId
            ? { ...a, currentHighestBid: data.currentHighestBid, highestBidderName: data.highestBidderName }
            : a
        )
      );
    });

    return () => {
      socket.off('auction-created');
      socket.off('auction-ended');
      socket.off('new-bid');
    };
  }, []);

  const fetchAuctions = async () => {
    try {
      setLoading(true);
      const res = await auctionAPI.getAll();
      setAuctions(res.data.auctions || []);
    } catch (err) {
      toast.error('Failed to load auctions');
    } finally {
      setLoading(false);
    }
  };

  const handleEnd = async (auctionId) => {
    try {
      await auctionAPI.end(auctionId);
      toast.success('Auction ended successfully');
      fetchAuctions();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to end auction');
    }
  };

  const filteredAuctions = auctions.filter(a => {
    if (filter === 'ALL') return true;
    return a.status === filter;
  });

  const ongoingCount = auctions.filter(a => a.status === 'ONGOING').length;
  const endedCount = auctions.filter(a => a.status === 'ENDED').length;

  return (
    <div className="container" style={{ paddingTop: '40px', paddingBottom: '60px' }}>
      {/* Hero Section */}
      <div style={{
        textAlign: 'center',
        marginBottom: '60px',
        animation: 'fadeIn 0.8s ease',
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(108, 99, 255, 0.1)',
          border: '1px solid rgba(108, 99, 255, 0.25)',
          borderRadius: '9999px',
          padding: '6px 16px',
          fontSize: '12px',
          fontWeight: 600,
          color: '#a89dff',
          marginBottom: '24px',
          letterSpacing: '0.05em',
        }}>
          <span className="live-dot" style={{ width: 6, height: 6 }} />
          DISTRIBUTED SYSTEM LIVE
        </div>

        <h1 style={{
          fontSize: 'clamp(40px, 7vw, 72px)',
          fontFamily: 'Space Grotesk, sans-serif',
          fontWeight: 900,
          letterSpacing: '-2px',
          lineHeight: 1.05,
          marginBottom: '20px',
        }}>
          Bid. Win.{' '}
          <span style={{
            background: 'linear-gradient(135deg, #6c63ff, #4facfe)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            Dominate.
          </span>
        </h1>

        <p style={{
          fontSize: '18px',
          color: 'rgba(240, 240, 255, 0.5)',
          maxWidth: '580px',
          margin: '0 auto 36px',
          lineHeight: 1.7,
        }}>
          Real-time distributed auctions powered by the Bully Algorithm, Lamport timestamps,
          and 4 fault-tolerant server nodes.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            to="/create"
            className="btn btn-primary btn-lg"
            id="create-auction-hero-btn"
          >
            ✨ Create Auction
          </Link>
          <Link
            to="/admin"
            className="btn btn-ghost btn-lg"
          >
            ⚙️ System Status
          </Link>
        </div>
      </div>

      {/* Stats Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 16,
        marginBottom: 40,
      }}>
        {[
          { label: 'Active Auctions', value: ongoingCount, icon: '🔴', color: '#00e5a0' },
          { label: 'Completed', value: endedCount, icon: '✅', color: '#4facfe' },
          { label: 'Server Nodes', value: 4, icon: '⚡', color: '#a89dff' },
        ].map((stat) => (
          <div key={stat.label} className="glass-card" style={{ padding: '20px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', marginBottom: 4 }}>{stat.icon}</div>
            <div style={{
              fontSize: '32px', fontWeight: 800,
              fontFamily: 'Space Grotesk, sans-serif',
              color: stat.color,
            }}>
              {stat.value}
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(240,240,255,0.4)', marginTop: 2 }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '28px',
        gap: 16,
        flexWrap: 'wrap',
      }}>
        <h2 style={{ fontSize: '22px', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700 }}>
          {filter === 'ALL' ? 'All Auctions' : filter === 'ONGOING' ? 'Live Auctions' : 'Ended Auctions'}
        </h2>

        <div style={{ display: 'flex', gap: 8 }}>
          {['ALL', 'ONGOING', 'ENDED'].map((f) => (
            <button
              key={f}
              id={`filter-${f.toLowerCase()}-btn`}
              className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setFilter(f)}
            >
              {f === 'ALL' ? '🌐 All' : f === 'ONGOING' ? '🔴 Live' : '✅ Ended'}
            </button>
          ))}
        </div>
      </div>

      {/* Auction Grid */}
      {loading ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 24,
        }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card" style={{
              height: 380,
              background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 75%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s infinite',
            }} />
          ))}
        </div>
      ) : filteredAuctions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔨</div>
          <h3 style={{ fontSize: '20px', fontFamily: 'Space Grotesk, sans-serif' }}>
            No auctions yet
          </h3>
          <p style={{ fontSize: '14px' }}>
            Be the first to create an auction!
          </p>
          <Link to="/create" className="btn btn-primary" style={{ marginTop: 8 }}>
            ✨ Create First Auction
          </Link>
        </div>
      ) : (
        <div className="auction-grid">
          {filteredAuctions.map((auction) => (
            <AuctionCard
              key={auction.auctionId}
              auction={auction}
              onEnd={handleEnd}
              isOwner={user?.userId === auction.createdBy}
            />
          ))}
        </div>
      )}
    </div>
  );
}
