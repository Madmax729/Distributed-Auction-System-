import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { auctionAPI } from '../services/api';
import { getSocket } from '../services/socket';
import AuctionCard from '../components/AuctionCard';
import toast from 'react-hot-toast';

const CATEGORIES = ['ALL', 'Electronics', 'Art', 'Collectibles', 'Vehicles', 'Fashion', 'Sports', 'Books', 'Other'];

function useWatchlist() {
  const [watchlist, setWatchlist] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('watchlist') || '[]')); }
    catch { return new Set(); }
  });
  const toggle = (id) => {
    setWatchlist(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      localStorage.setItem('watchlist', JSON.stringify([...next]));
      return next;
    });
  };
  return { watchlist, toggle };
}

export default function HomePage({ user }) {
  const [auctions,   setAuctions]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [filter,     setFilter]     = useState('ALL');
  const [category,   setCategory]   = useState('ALL');
  const [search,     setSearch]     = useState('');
  const [searchInput,setSearchInput]= useState('');
  const [showWatch,  setShowWatch]  = useState(false);
  const { watchlist, toggle: toggleWatch } = useWatchlist();

  const fetchAuctions = useCallback(async (opts = {}) => {
    try {
      setLoading(true);
      const params = {};
      if (opts.search)   params.search   = opts.search;
      if (opts.category && opts.category !== 'ALL') params.category = opts.category;
      const res = await auctionAPI.getAll(params);
      setAuctions(res.data.auctions || []);
    } catch {
      toast.error('Could not connect to server. Is Docker running?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuctions({ search, category });

    const socket = getSocket();
    socket.on('auction-created', (data) => {
      setAuctions(prev => [data.auction, ...prev]);
      toast.success(`New auction: ${data.auction.itemName}`);
    });
    socket.on('auction-ended', (data) => {
      setAuctions(prev =>
        prev.map(a => a.auctionId === data.auctionId
          ? { ...a, status: 'ENDED', highestBidder: data.winner, highestBidderName: data.winnerName }
          : a)
      );
    });
    socket.on('new-bid', (data) => {
      setAuctions(prev =>
        prev.map(a => a.auctionId === data.auctionId
          ? { ...a, currentHighestBid: data.currentHighestBid, highestBidderName: data.highestBidderName, bidCount: data.bidCount ?? a.bidCount }
          : a)
      );
    });
    return () => {
      socket.off('auction-created');
      socket.off('auction-ended');
      socket.off('new-bid');
    };
  }, [search, category]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSearch(searchInput.trim());
  };

  const handleEnd = async (auctionId) => {
    try {
      await auctionAPI.end(auctionId);
      toast.success('Auction ended');
      fetchAuctions({ search, category });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to end auction');
    }
  };

  // Client-side filtering
  let displayed = auctions;
  if (filter === 'ONGOING') displayed = displayed.filter(a => a.status === 'ONGOING' && new Date(a.endTime) > new Date());
  if (filter === 'ENDED')   displayed = displayed.filter(a => a.status === 'ENDED');
  if (showWatch)            displayed = displayed.filter(a => watchlist.has(a.auctionId));

  const ongoingCount = auctions.filter(a => a.status === 'ONGOING' && new Date(a.endTime) > new Date()).length;
  const endedCount   = auctions.filter(a => a.status === 'ENDED').length;
  const watchCount   = auctions.filter(a => watchlist.has(a.auctionId)).length;

  return (
    <div className="container" style={{ paddingTop: 48, paddingBottom: 96 }}>

      {/* ── Hero ──────────────────────────────────────────────── */}
      <div style={{ marginBottom: 44, animation: 'fadeIn 0.5s ease' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          background: 'var(--accent-dim)',
          border: '1px solid var(--accent-border)',
          borderRadius: 999, padding: '4px 12px',
          fontSize: 11, fontWeight: 700,
          color: 'var(--accent-light)', letterSpacing: '0.07em',
          marginBottom: 20,
        }}>
          <span className="live-dot" />
          DISTRIBUTED SYSTEM — LIVE
        </div>

        <h1 style={{
          fontSize: 'clamp(28px, 5vw, 52px)',
          fontFamily: 'Space Grotesk, sans-serif',
          fontWeight: 700, letterSpacing: '-1.5px',
          lineHeight: 1.1, marginBottom: 14, maxWidth: 560,
        }}>
          Real-time auctions,{' '}
          <span className="text-gradient">distributed</span>.
        </h1>

        <p style={{ fontSize: 14, color: 'var(--text-2)', maxWidth: 460, lineHeight: 1.8, marginBottom: 24 }}>
          Bully Algorithm · Lamport timestamps · 4 fault-tolerant nodes.
        </p>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link to="/create" className="btn btn-primary btn-lg" id="create-auction-hero-btn">
            + Create Auction
          </Link>
          <Link to="/admin" className="btn btn-ghost btn-lg">
            System Status
          </Link>
        </div>
      </div>

      {/* ── Stats ─────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 32 }}>
        {[
          { label: 'Live',         value: ongoingCount, color: 'var(--green)',        dot: true },
          { label: 'Completed',    value: endedCount,   color: 'var(--text-2)',       dot: false },
          { label: 'Watchlisted',  value: watchCount,   color: 'var(--amber)',        dot: false },
          { label: 'Server Nodes', value: 4,            color: 'var(--accent-light)', dot: false },
        ].map(s => (
          <div key={s.label} className="glass-card" style={{ padding: '16px 18px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 22, fontWeight: 700,
              fontFamily: 'Space Grotesk, sans-serif',
              color: s.color, marginBottom: 3,
            }}>
              {s.dot && <span className="live-dot" style={{ width: 6, height: 6 }} />}
              {s.value}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Search Bar ─────────────────────────────────────────── */}
      <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-3)', pointerEvents:'none' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            id="auction-search-input"
            className="input-field"
            style={{ paddingLeft: 36 }}
            placeholder="Search auctions…"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-primary">Search</button>
        {search && (
          <button type="button" className="btn btn-ghost" onClick={() => { setSearch(''); setSearchInput(''); }}>
            Clear
          </button>
        )}
      </form>

      {/* ── Category Chips ─────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 22, overflowX: 'auto', paddingBottom: 4 }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            className={`btn btn-sm ${category === cat ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setCategory(cat)}
          >
            {cat === 'ALL' ? 'All Categories' : cat}
          </button>
        ))}
      </div>

      {/* ── Filter Bar ─────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20, gap: 12, flexWrap: 'wrap',
      }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, fontFamily: 'Space Grotesk', color: 'var(--text-1)' }}>
          {showWatch ? 'Watchlist' : filter === 'ALL' ? 'All Auctions' : filter === 'ONGOING' ? 'Live Auctions' : 'Ended'}
          <span style={{ marginLeft: 7, fontSize: 12, fontWeight: 400, color: 'var(--text-3)', fontFamily: 'Inter' }}>
            ({displayed.length})
          </span>
          {search && (
            <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--accent-light)', fontFamily: 'Inter', fontWeight: 500 }}>
              for "{search}"
            </span>
          )}
        </h2>

        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {[
            { key: 'ALL',     label: 'All' },
            { key: 'ONGOING', label: 'Live' },
            { key: 'ENDED',   label: 'Ended' },
          ].map(f => (
            <button
              key={f.key}
              id={`filter-${f.key.toLowerCase()}-btn`}
              className={`btn btn-sm ${filter === f.key && !showWatch ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => { setFilter(f.key); setShowWatch(false); }}
            >
              {f.key === 'ONGOING' && <span className="live-dot" style={{ width: 5, height: 5 }} />}
              {f.label}
            </button>
          ))}
          <button
            className={`btn btn-sm ${showWatch ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setShowWatch(w => !w)}
            title="Show watchlist"
            style={{ gap: 5 }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill={showWatch ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
            </svg>
            Watchlist {watchCount > 0 && `(${watchCount})`}
          </button>
        </div>
      </div>

      {/* ── Auction Grid ───────────────────────────────────────── */}
      {loading ? (
        <div className="auction-grid">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-card skeleton" style={{ height: 300 }} />
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="empty-state" style={{ animation: 'fadeIn 0.4s ease' }}>
          <div className="empty-state-icon">
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.35">
              <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.3 2.3C4.1 16.1 4.6 17 5.5 17H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
            </svg>
          </div>
          <h3 style={{ fontSize: 16, fontFamily: 'Space Grotesk', color: 'var(--text-2)' }}>
            {showWatch ? 'No watchlisted auctions' : search ? 'No results found' : 'No auctions yet'}
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
            {showWatch ? 'Heart an auction to save it here.' : search ? `Nothing matched "${search}".` : 'Be the first to create one.'}
          </p>
          {!showWatch && !search && (
            <Link to="/create" className="btn btn-primary" style={{ marginTop: 8 }}>
              Create Auction
            </Link>
          )}
        </div>
      ) : (
        <div className="auction-grid">
          {displayed.map((auction, i) => (
            <div key={auction.auctionId} style={{ animation: `fadeInUp ${0.08 + i * 0.04}s ease` }}>
              <AuctionCard
                auction={auction}
                onEnd={handleEnd}
                isOwner={user?.userId === auction.createdBy}
                isWatched={watchlist.has(auction.auctionId)}
                onToggleWatch={() => toggleWatch(auction.auctionId)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
