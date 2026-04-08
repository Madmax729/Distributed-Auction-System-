import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auctionAPI, bidAPI } from '../services/api';
import { getSocket, joinAuctionRoom, leaveAuctionRoom } from '../services/socket';
import BidFeed from '../components/BidFeed';
import WinnerModal from '../components/WinnerModal';
import AuctionStats from '../components/AuctionStats';
import toast from 'react-hot-toast';
import { formatDistanceToNow, format } from 'date-fns';

export default function AuctionPage({ user }) {
  const { auctionId } = useParams();
  const navigate = useNavigate();

  const [auction,     setAuction]     = useState(null);
  const [bids,        setBids]        = useState([]);
  const [bidAmount,   setBidAmount]   = useState('');
  const [loading,     setLoading]     = useState(true);
  const [bidLoading,  setBidLoading]  = useState(false);
  const [winner,      setWinner]      = useState(null);
  const [timeLeft,    setTimeLeft]    = useState('');
  const [serverInfo,  setServerInfo]  = useState(null);

  const countdownRef = useRef(null);

  const updateCountdown = useCallback((endTime) => {
    const diff = new Date(endTime) - new Date();
    if (diff <= 0) {
      setTimeLeft('Expired');
      clearInterval(countdownRef.current);
      return;
    }
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    setTimeLeft(`${h > 0 ? `${h}h ` : ''}${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`);
  }, []);

  useEffect(() => { fetchAuction(); }, [auctionId]);

  useEffect(() => {
    if (!auction) return;

    joinAuctionRoom(auctionId);
    const socket = getSocket();

    socket.on('new-bid', (data) => {
      if (data.auctionId !== auctionId) return;
      setBids(prev => [data.bid, ...prev.filter(b => b.bidId !== data.bid.bidId)]);
      setAuction(prev => prev ? {
        ...prev,
        currentHighestBid: data.currentHighestBid,
        highestBidder: data.highestBidder,
        highestBidderName: data.highestBidderName,
      } : prev);
      if (data.highestBidder !== user?.userId) {
        toast(`${data.highestBidderName} bid $${data.currentHighestBid?.toLocaleString()}`, { icon: '🔥' });
      }
      setBidAmount((data.currentHighestBid + 1).toString());
    });

    socket.on('auction-ended', (data) => {
      if (data.auctionId !== auctionId) return;
      setAuction(prev => prev ? { ...prev, status: 'ENDED' } : prev);
      setWinner({ winnerName: data.winnerName, winner: data.winner, winningBid: data.winningBid });
    });

    socket.on('leader-changed', (data) => {
      toast(`New leader: Server ${data.newLeader}`, { icon: '👑', duration: 4000 });
      setServerInfo(prev => prev ? { ...prev, currentLeader: data.newLeader } : prev);
    });

    if (auction.status === 'ONGOING') {
      updateCountdown(auction.endTime);
      countdownRef.current = setInterval(() => updateCountdown(auction.endTime), 1000);
    }

    return () => {
      leaveAuctionRoom(auctionId);
      socket.off('new-bid');
      socket.off('auction-ended');
      socket.off('leader-changed');
      clearInterval(countdownRef.current);
    };
  }, [auction?.auctionId, user?.userId]);

  const fetchAuction = async () => {
    try {
      setLoading(true);
      const res = await auctionAPI.getById(auctionId);
      setAuction(res.data.auction);
      setBids(res.data.bids || []);
      const suggested = (res.data.auction.currentHighestBid || res.data.auction.startingPrice) + 1;
      setBidAmount(suggested.toString());
    } catch {
      toast.error('Auction not found');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handlePlaceBid = async (e) => {
    e.preventDefault();
    if (!user) { toast.error('Please set up your username first'); return; }
    const amount = parseFloat(bidAmount);
    if (!amount || isNaN(amount)) { toast.error('Please enter a valid bid amount'); return; }
    if (amount <= (auction?.currentHighestBid || 0)) {
      toast.error(`Bid must be higher than $${auction?.currentHighestBid?.toLocaleString()}`);
      return;
    }
    try {
      setBidLoading(true);
      await bidAPI.place({ auctionId, userId: user.userId, userName: user.userName, amount });
      toast.success(`Bid of $${amount.toLocaleString()} placed!`);
      setBidAmount((amount + 1).toString());
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to place bid';
      if (err.response?.status === 429) toast.error('Rate limited — max 5 bids/second');
      else toast.error(msg);
    } finally {
      setBidLoading(false);
    }
  };

  if (loading) return (
    <div className="container" style={{ paddingTop: 60, display: 'flex', justifyContent: 'center' }}>
      <div style={{
        width: 36, height: 36,
        border: '2.5px solid var(--border)',
        borderTopColor: 'var(--accent)',
        borderRadius: '50%',
        animation: 'spin 0.75s linear infinite',
        margin: '80px auto',
      }} />
    </div>
  );

  if (!auction) return null;

  const isOngoing = auction.status === 'ONGOING' && new Date(auction.endTime) > new Date();
  const priceFormatted = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 0,
  }).format(auction.currentHighestBid || auction.startingPrice);

  return (
    <div className="container" style={{ paddingTop: '40px', paddingBottom: '72px' }}>

      <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')} style={{ marginBottom: 24 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Back
      </button>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 360px',
        gap: '24px', alignItems: 'start',
      }}>

        {/* ── Left Column ──────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Auction Header */}
          <div className="glass-card" style={{ padding: 28, animation: 'fadeIn 0.4s ease' }}>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <span className={`badge ${isOngoing ? 'badge-ongoing' : 'badge-ended'}`}>
                {isOngoing ? <><span className="live-dot" style={{ width: 5, height: 5 }} /> LIVE</> : 'ENDED'}
              </span>
            </div>

            <h1 style={{
              fontSize: 'clamp(22px, 3.5vw, 36px)',
              fontFamily: 'Space Grotesk, sans-serif',
              fontWeight: 700, marginBottom: 10,
              letterSpacing: '-0.8px', color: 'var(--text-1)',
            }}>
              {auction.itemName}
            </h1>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>Auction ID: </span>
              <code style={{ fontSize: '13px', color: 'var(--text-2)', background: 'var(--bg-raised)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                {auction.auctionId}
              </code>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(auction.auctionId);
                  toast.success('Auction ID copied to clipboard', { icon: '📋' });
                }}
                className="btn btn-ghost btn-sm"
                style={{ padding: '2px 6px', height: 'auto', minHeight: 'auto', fontSize: '12px' }}
                title="Copy Auction ID"
              >
                Copy
              </button>
            </div>

            {auction.description && (
              <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 20, lineHeight: 1.7 }}>
                {auction.description}
              </p>
            )}

            {/* Image */}
            {auction.imagePath && (
              <div style={{
                height: 240, borderRadius: 10,
                background: `url(${auction.imagePath}) center/cover`,
                marginBottom: 22,
                border: '1px solid var(--border)',
              }} />
            )}

            {/* Price & Time */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{
                background: 'var(--amber-dim)',
                border: '1px solid rgba(245,158,11,0.20)',
                borderRadius: 10, padding: '18px 20px',
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, letterSpacing:'0.05em', textTransform:'uppercase', marginBottom: 6 }}>
                  Current Bid
                </div>
                <div style={{
                  fontSize: 28, fontWeight: 800,
                  fontFamily: 'Space Grotesk, sans-serif',
                  color: 'var(--amber)',
                }}>
                  {priceFormatted}
                </div>
                {auction.highestBidderName && (
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                    by {auction.highestBidderName}
                  </div>
                )}
              </div>

              <div style={{
                background: isOngoing ? 'var(--green-dim)' : 'var(--red-dim)',
                border: `1px solid ${isOngoing ? 'var(--green-border)' : 'rgba(248,113,113,0.20)'}`,
                borderRadius: 10, padding: '18px 20px',
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, letterSpacing:'0.05em', textTransform:'uppercase', marginBottom: 6 }}>
                  {isOngoing ? 'Time Left' : 'Ended'}
                </div>
                <div style={{
                  fontSize: isOngoing ? 22 : 16,
                  fontWeight: 700,
                  fontFamily: 'Space Grotesk, sans-serif',
                  color: isOngoing ? 'var(--green)' : 'var(--red)',
                }}>
                  {isOngoing ? timeLeft : format(new Date(auction.endTime), 'MMM dd, HH:mm')}
                </div>
                {!isOngoing && auction.highestBidderName && (
                  <div style={{ fontSize: 12, color: 'var(--amber)', marginTop: 4 }}>
                    Won by {auction.highestBidderName}
                  </div>
                )}
              </div>
            </div>

            {/* Tech Tags */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 16 }}>
              {['Bully Election', 'Lamport Clock', 'Leader-Follower', 'Rate Limited'].map(tag => (
                <span key={tag} style={{
                  fontSize: 11, padding: '3px 9px',
                  background: 'var(--accent-dim)',
                  border: '1px solid var(--accent-border)',
                  borderRadius: 4, color: 'var(--accent-light)',
                  fontWeight: 600,
                }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Bid Feed */}
          <div className="glass-card" style={{ padding: 22 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 18,
            }}>
              <h2 style={{ fontSize: 15, fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, color: 'var(--text-1)' }}>
                Live Bid Feed
              </h2>
              <span style={{
                fontSize: 12, color: 'var(--text-3)',
                background: 'var(--bg-raised)',
                border: '1px solid var(--border)',
                borderRadius: 6, padding: '3px 9px',
              }}>
                {bids.length} bids
              </span>
            </div>
            <BidFeed bids={bids} currentUserId={user?.userId} />
          </div>
        </div>

        {/* ── Right Column — Bid Panel ──────────────────────── */}
        <div style={{ position: 'sticky', top: 80 }}>
          <div className="glass-card" style={{ padding: 24, animation: 'fadeIn 0.5s ease' }}>
            <h2 style={{
              fontSize: 17, fontFamily: 'Space Grotesk, sans-serif',
              fontWeight: 700, marginBottom: 22, color: 'var(--text-1)',
            }}>
              Place Your Bid
            </h2>

            {isOngoing ? (
              <form onSubmit={handlePlaceBid} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Bid Amount (USD)</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{
                      position: 'absolute', left: 13, top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-3)', fontSize: 15, fontWeight: 600, pointerEvents: 'none',
                    }}>$</span>
                    <input
                      id="bid-amount-input"
                      type="number"
                      className="input-field"
                      style={{ paddingLeft: 28 }}
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value)}
                      min={auction.currentHighestBid + 1}
                      step="1"
                      placeholder={(auction.currentHighestBid + 1).toString()}
                      disabled={bidLoading}
                    />
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    Minimum: ${(auction.currentHighestBid + 1).toLocaleString()}
                  </span>
                </div>

                {/* Quick bid chips */}
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  {[10, 50, 100, 500].map(inc => (
                    <button
                      key={inc}
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setBidAmount((auction.currentHighestBid + inc).toString())}
                    >
                      +${inc}
                    </button>
                  ))}
                </div>

                <button
                  id="place-bid-btn"
                  type="submit"
                  className="btn btn-gold btn-lg"
                  disabled={bidLoading || !user}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  {bidLoading ? 'Placing…' : 'Place Bid'}
                </button>

                {!user && (
                  <p style={{ fontSize: 12, textAlign: 'center', color: 'var(--text-3)' }}>
                    Set your username to bid
                  </p>
                )}

                <div style={{
                  padding: 12, borderRadius: 8,
                  background: 'var(--accent-dim)',
                  border: '1px solid var(--accent-border)',
                  fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6,
                }}>
                  <strong style={{ color: 'var(--accent-light)' }}>How it works:</strong><br />
                  Bids are processed by the <strong>Leader</strong> with a Lamport timestamp, then replicated to all followers instantly.
                </div>
              </form>
            ) : (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.6 }}>🏁</div>
                <p style={{ color: 'var(--text-2)', marginBottom: 16, fontSize: 14 }}>
                  This auction has ended
                </p>
                {auction.highestBidderName && (
                  <div style={{
                    background: 'var(--amber-dim)',
                    border: '1px solid rgba(245,158,11,0.22)',
                    borderRadius: 10, padding: 18,
                  }}>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 6 }}>
                      Winner
                    </div>
                    <div style={{
                      fontSize: 20, fontWeight: 700,
                      fontFamily: 'Space Grotesk, sans-serif',
                      color: 'var(--amber)', marginBottom: 4,
                    }}>
                      {auction.highestBidderName}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)' }}>
                      ${auction.currentHighestBid?.toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Auction meta */}
          <div style={{
            marginTop: 10, padding: '14px 16px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            fontSize: 12, color: 'var(--text-3)', lineHeight: 1.8,
          }}>
            <div><strong style={{ color: 'var(--text-2)' }}>Starting:</strong> ${auction.startingPrice?.toLocaleString()}</div>
            <div><strong style={{ color: 'var(--text-2)' }}>Ends:</strong> {format(new Date(auction.endTime), 'MMM dd,yyyy HH:mm')}</div>
            <div><strong style={{ color: 'var(--text-2)' }}>Bids:</strong> {bids.length} total</div>
            <div><strong style={{ color: 'var(--text-2)' }}>Rate limit:</strong> 5 bids/second</div>
          </div>
        </div>

      </div>

      {winner && (
        <WinnerModal winner={winner} auctionId={auctionId} onClose={() => setWinner(null)} />
      )}

      <style>{`
        @media (max-width: 768px) {
          .auction-two-col { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
