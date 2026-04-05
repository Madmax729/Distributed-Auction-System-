import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auctionAPI, bidAPI } from '../services/api';
import { getSocket, joinAuctionRoom, leaveAuctionRoom } from '../services/socket';
import BidFeed from '../components/BidFeed';
import WinnerModal from '../components/WinnerModal';
import toast from 'react-hot-toast';
import { formatDistanceToNow, format } from 'date-fns';

export default function AuctionPage({ user }) {
  const { auctionId } = useParams();
  const navigate = useNavigate();

  const [auction, setAuction] = useState(null);
  const [bids, setBids] = useState([]);
  const [bidAmount, setBidAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [bidLoading, setBidLoading] = useState(false);
  const [winner, setWinner] = useState(null);
  const [timeLeft, setTimeLeft] = useState('');
  const [serverInfo, setServerInfo] = useState(null);

  const countdownRef = useRef(null);

  const updateCountdown = useCallback((endTime) => {
    const end = new Date(endTime);
    const now = new Date();
    const diff = end - now;

    if (diff <= 0) {
      setTimeLeft('Expired');
      clearInterval(countdownRef.current);
      return;
    }

    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    setTimeLeft(
      `${hours > 0 ? `${hours}h ` : ''}${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`
    );
  }, []);

  useEffect(() => {
    fetchAuction();
  }, [auctionId]);

  useEffect(() => {
    if (!auction) return;

    // Join Socket.io room for this auction
    joinAuctionRoom(auctionId);
    const socket = getSocket();

    // Listen for new bids
    socket.on('new-bid', (data) => {
      if (data.auctionId !== auctionId) return;

      setBids(prev => {
        const newBids = [data.bid, ...prev.filter(b => b.bidId !== data.bid.bidId)];
        return newBids;
      });

      setAuction(prev => prev ? {
        ...prev,
        currentHighestBid: data.currentHighestBid,
        highestBidder: data.highestBidder,
        highestBidderName: data.highestBidderName,
      } : prev);

      // Flash notification for others' bids
      if (data.highestBidder !== user?.userId) {
        toast(`🔥 ${data.highestBidderName} bid $${data.currentHighestBid?.toLocaleString()}`, {
          icon: '💰',
        });
      }

      // Update bid input suggestion
      setBidAmount((data.currentHighestBid + 1).toString());
    });

    // Listen for auction end
    socket.on('auction-ended', (data) => {
      if (data.auctionId !== auctionId) return;
      setAuction(prev => prev ? { ...prev, status: 'ENDED' } : prev);
      setWinner({
        winnerName: data.winnerName,
        winner: data.winner,
        winningBid: data.winningBid,
      });
    });

    // Listen for server events (leader election etc.)
    socket.on('server-event', (data) => {
      if (data.type === 'LEADER_FAILURE') {
        toast(`⚠️ ${data.message}`, { duration: 5000, icon: '🔄' });
      }
    });

    socket.on('leader-changed', (data) => {
      toast(`👑 New leader: Server ${data.newLeader}`, {
        icon: '🗳️',
        duration: 4000,
        style: { background: 'rgba(15,15,40,0.95)', border: '1px solid rgba(255,215,0,0.3)' },
      });
      setServerInfo(prev => prev ? { ...prev, currentLeader: data.newLeader } : prev);
    });

    // Countdown timer
    if (auction.status === 'ONGOING') {
      updateCountdown(auction.endTime);
      countdownRef.current = setInterval(() => updateCountdown(auction.endTime), 1000);
    }

    return () => {
      leaveAuctionRoom(auctionId);
      socket.off('new-bid');
      socket.off('auction-ended');
      socket.off('server-event');
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

      // Pre-fill bid amount
      const suggestedBid = (res.data.auction.currentHighestBid || res.data.auction.startingPrice) + 1;
      setBidAmount(suggestedBid.toString());
    } catch (err) {
      toast.error('Auction not found');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handlePlaceBid = async (e) => {
    e.preventDefault();

    if (!user) {
      toast.error('Please set up your username first');
      return;
    }

    const amount = parseFloat(bidAmount);
    if (!amount || isNaN(amount)) {
      toast.error('Please enter a valid bid amount');
      return;
    }

    if (amount <= (auction?.currentHighestBid || 0)) {
      toast.error(`Bid must be higher than $${auction?.currentHighestBid?.toLocaleString()}`);
      return;
    }

    try {
      setBidLoading(true);
      const res = await bidAPI.place({
        auctionId,
        userId: user.userId,
        userName: user.userName,
        amount,
      });

      toast.success(`🎉 Bid of $${amount.toLocaleString()} placed!`);
      setBidAmount((amount + 1).toString());
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to place bid';
      if (err.response?.status === 429) {
        toast.error('⚡ Rate limited! Max 5 bids/second');
      } else {
        toast.error(msg);
      }
    } finally {
      setBidLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: 60, textAlign: 'center' }}>
        <div style={{
          width: 48, height: 48,
          border: '3px solid rgba(108,99,255,0.2)',
          borderTopColor: '#6c63ff',
          borderRadius: '50%',
          animation: 'rotate 0.8s linear infinite',
          margin: '80px auto',
        }} />
      </div>
    );
  }

  if (!auction) return null;

  const isOngoing = auction.status === 'ONGOING' && new Date(auction.endTime) > new Date();
  const priceFormatted = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 0,
  }).format(auction.currentHighestBid || auction.startingPrice);

  return (
    <div className="container" style={{ paddingTop: '40px', paddingBottom: '60px' }}>
      {/* Back */}
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => navigate('/')}
        style={{ marginBottom: 24 }}
      >
        ← Back
      </button>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 380px',
        gap: '28px',
        alignItems: 'start',
      }}>
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Auction Header */}
          <div className="glass-card" style={{ padding: 32, overflow: 'hidden', position: 'relative' }}>
            {/* Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <span className={`badge ${isOngoing ? 'badge-ongoing' : 'badge-ended'}`}>
                {isOngoing ? <><span className="live-dot" style={{ width: 6, height: 6 }} /> LIVE</> : 'ENDED'}
              </span>
              {auction.imagePath && (
                <span style={{ fontSize: 12, color: 'rgba(240,240,255,0.4)' }}>
                  📸 Image attached
                </span>
              )}
            </div>

            <h1 style={{
              fontSize: 'clamp(24px, 4vw, 40px)',
              fontFamily: 'Space Grotesk, sans-serif',
              fontWeight: 800, marginBottom: 12,
              letterSpacing: '-1px',
            }}>
              {auction.itemName}
            </h1>

            {auction.description && (
              <p style={{
                fontSize: 15, color: 'rgba(240,240,255,0.55)',
                marginBottom: 24, lineHeight: 1.7,
              }}>
                {auction.description}
              </p>
            )}

            {/* Image */}
            {auction.imagePath && (
              <div style={{
                height: 260,
                borderRadius: 12,
                background: `url(${auction.imagePath}) center/cover`,
                marginBottom: 24,
                border: '1px solid rgba(255,255,255,0.08)',
              }} />
            )}

            {/* Price & Time */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: 16, marginBottom: 8,
            }}>
              <div style={{
                background: 'rgba(255, 215, 0, 0.08)',
                border: '1px solid rgba(255, 215, 0, 0.2)',
                borderRadius: 14, padding: '20px 24px',
              }}>
                <div style={{ fontSize: 12, color: 'rgba(240,240,255,0.4)', marginBottom: 4 }}>
                  💰 Current Highest Bid
                </div>
                <div style={{
                  fontSize: 36, fontWeight: 900,
                  fontFamily: 'Space Grotesk, sans-serif',
                  background: 'linear-gradient(135deg, #ffd700, #f97316)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>
                  {priceFormatted}
                </div>
                {auction.highestBidderName && (
                  <div style={{ fontSize: 12, color: 'rgba(240,240,255,0.5)', marginTop: 4 }}>
                    by {auction.highestBidderName}
                  </div>
                )}
              </div>

              <div style={{
                background: isOngoing ? 'rgba(0, 229, 160, 0.08)' : 'rgba(255, 101, 132, 0.08)',
                border: `1px solid ${isOngoing ? 'rgba(0, 229, 160, 0.2)' : 'rgba(255, 101, 132, 0.2)'}`,
                borderRadius: 14, padding: '20px 24px',
              }}>
                <div style={{ fontSize: 12, color: 'rgba(240,240,255,0.4)', marginBottom: 4 }}>
                  ⏱ {isOngoing ? 'Time Remaining' : 'Auction Ended'}
                </div>
                <div style={{
                  fontSize: isOngoing ? 28 : 18,
                  fontWeight: 800,
                  fontFamily: 'Space Grotesk, sans-serif',
                  color: isOngoing ? '#00e5a0' : '#ff6584',
                }}>
                  {isOngoing ? timeLeft : format(new Date(auction.endTime), 'MMM dd, HH:mm')}
                </div>
                {!isOngoing && auction.highestBidderName && (
                  <div style={{ fontSize: 12, color: '#ffd700', marginTop: 4 }}>
                    🏆 Winner: {auction.highestBidderName}
                  </div>
                )}
              </div>
            </div>

            {/* Distributed System Info */}
            <div style={{
              display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16,
            }}>
              {[
                { label: 'Bully Election', icon: '🗳️' },
                { label: 'Lamport Clock', icon: '⏰' },
                { label: 'Leader-Follower', icon: '👑' },
                { label: 'Rate Limited', icon: '⚡' },
              ].map(tag => (
                <span key={tag.label} style={{
                  fontSize: 11, padding: '4px 10px',
                  background: 'rgba(108,99,255,0.08)',
                  border: '1px solid rgba(108,99,255,0.15)',
                  borderRadius: 6, color: 'rgba(240,240,255,0.5)',
                  fontWeight: 600,
                }}>
                  {tag.icon} {tag.label}
                </span>
              ))}
            </div>
          </div>

          {/* Bid Feed */}
          <div className="glass-card" style={{ padding: 24 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 20,
            }}>
              <h2 style={{ fontSize: 18, fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700 }}>
                🔥 Live Bid Feed
              </h2>
              <span style={{
                fontSize: 12, color: 'rgba(240,240,255,0.4)',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8, padding: '4px 10px',
              }}>
                {bids.length} bids
              </span>
            </div>
            <BidFeed bids={bids} currentUserId={user?.userId} />
          </div>
        </div>

        {/* Right Column — Bid Panel */}
        <div style={{ position: 'sticky', top: 92 }}>
          <div className="glass-card" style={{ padding: 28 }}>
            <h2 style={{
              fontSize: 20, fontFamily: 'Space Grotesk, sans-serif',
              fontWeight: 700, marginBottom: 24,
            }}>
              💸 Place Your Bid
            </h2>

            {isOngoing ? (
              <form onSubmit={handlePlaceBid} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Bid Amount (USD)</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{
                      position: 'absolute', left: 16, top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'rgba(240,240,255,0.4)', fontSize: 16, fontWeight: 600,
                    }}>$</span>
                    <input
                      id="bid-amount-input"
                      type="number"
                      className="input-field"
                      style={{ paddingLeft: 32 }}
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value)}
                      min={auction.currentHighestBid + 1}
                      step="1"
                      placeholder={(auction.currentHighestBid + 1).toString()}
                      disabled={bidLoading}
                    />
                  </div>
                  <span style={{ fontSize: 12, color: 'rgba(240,240,255,0.4)' }}>
                    Minimum: ${(auction.currentHighestBid + 1).toLocaleString()}
                  </span>
                </div>

                {/* Quick bid buttons */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
                  {bidLoading ? '⏳ Placing...' : '🔨 Place Bid'}
                </button>

                {!user && (
                  <p style={{ fontSize: 12, textAlign: 'center', color: 'rgba(240,240,255,0.4)' }}>
                    Please set your username to bid
                  </p>
                )}

                <div style={{
                  padding: 14, borderRadius: 10,
                  background: 'rgba(108, 99, 255, 0.06)',
                  border: '1px solid rgba(108, 99, 255, 0.15)',
                  fontSize: 12, color: 'rgba(240,240,255,0.5)',
                  lineHeight: 1.6,
                }}>
                  <strong style={{ color: 'rgba(240,240,255,0.8)' }}>⚡ How it works:</strong>
                  <br />
                  Your bid is processed by the <strong>Leader Server</strong> with a Lamport timestamp, then replicated to all followers instantly.
                </div>
              </form>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🏁</div>
                <p style={{ color: 'rgba(240,240,255,0.5)', marginBottom: 16, fontSize: 14 }}>
                  This auction has ended
                </p>
                {auction.highestBidderName && (
                  <div style={{
                    background: 'rgba(255,215,0,0.08)',
                    border: '1px solid rgba(255,215,0,0.25)',
                    borderRadius: 12, padding: 20,
                  }}>
                    <div style={{ fontSize: 12, color: 'rgba(240,240,255,0.4)', marginBottom: 6 }}>
                      🏆 Winner
                    </div>
                    <div style={{
                      fontSize: 22, fontWeight: 800,
                      fontFamily: 'Space Grotesk, sans-serif',
                      color: '#ffd700', marginBottom: 4,
                    }}>
                      {auction.highestBidderName}
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: '#f97316' }}>
                      ${auction.currentHighestBid?.toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Starting price info */}
          <div style={{
            marginTop: 12, padding: '14px 18px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 12,
            fontSize: 12, color: 'rgba(240,240,255,0.4)',
            lineHeight: 1.7,
          }}>
            <div>📋 <strong>Starting:</strong> ${auction.startingPrice?.toLocaleString()}</div>
            <div>📅 <strong>Ends:</strong> {format(new Date(auction.endTime), 'MMM dd, yyyy HH:mm')}</div>
            <div>🔨 <strong>Bids:</strong> {bids.length} total</div>
            <div>⏰ <strong>Rate limit:</strong> 5 bids/second per user</div>
          </div>
        </div>
      </div>

      {/* Winner Modal */}
      {winner && (
        <WinnerModal
          winner={winner}
          auctionId={auctionId}
          onClose={() => setWinner(null)}
        />
      )}
    </div>
  );
}
