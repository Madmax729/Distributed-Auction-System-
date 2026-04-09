import { useState, useEffect, useCallback } from 'react';
import { serverAPI, loadTestAPI, auctionAPI } from '../services/api';
import { getSocket } from '../services/socket';
import toast from 'react-hot-toast';
import axios from 'axios';

const SERVER_IDS = [1, 2, 3, 4];

// ─── Helpers for sessionStorage persistence ──────────────────
function loadSession(key, fallback) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function saveSession(key, value) {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export default function AdminPage() {
  const [serverStatuses,  setServerStatuses]  = useState({});
  const [loadTestConfig,  setLoadTestConfig]  = useState(() =>
    loadSession('admin:loadTestConfig', { vus: 10, duration: '30s', auctionId: '' })
  );
  const [loadTestRunning, setLoadTestRunning] = useState(false);
  const [loadTestOutput,  setLoadTestOutput]  = useState(() =>
    loadSession('admin:loadTestOutput', [])
  );
  const [systemInfo,      setSystemInfo]      = useState(null);
  const [leaderLog,       setLeaderLog]       = useState(() =>
    loadSession('admin:leaderLog', [])
  );

  // Auction lookup state
  const [lookupId,       setLookupId]       = useState(() =>
    loadSession('admin:lookupId', '')
  );
  const [lookupAuction,  setLookupAuction]  = useState(() =>
    loadSession('admin:lookupAuction', null)
  );
  const [lookupBids,     setLookupBids]     = useState(() =>
    loadSession('admin:lookupBids', [])
  );
  const [lookupLoading,  setLookupLoading]  = useState(false);
  const [lookupError,    setLookupError]    = useState('');

  // Ngrok URL
  const [ngrokUrl, setNgrokUrl] = useState('');

  // Persist state changes
  useEffect(() => { saveSession('admin:loadTestConfig', loadTestConfig); }, [loadTestConfig]);
  useEffect(() => { saveSession('admin:loadTestOutput', loadTestOutput); }, [loadTestOutput]);
  useEffect(() => { saveSession('admin:leaderLog', leaderLog); }, [leaderLog]);
  useEffect(() => { saveSession('admin:lookupId', lookupId); }, [lookupId]);
  useEffect(() => { saveSession('admin:lookupAuction', lookupAuction); }, [lookupAuction]);
  useEffect(() => { saveSession('admin:lookupBids', lookupBids); }, [lookupBids]);

  useEffect(() => {
    fetchServerStatuses();
    fetchNgrokUrl();
    const interval = setInterval(fetchServerStatuses, 5000);
    const socket = getSocket();

    socket.on('leader-changed', (data) => {
      setLeaderLog(prev => [{
        time: new Date().toLocaleTimeString(),
        message: `Leader changed to Server ${data.newLeader}`,
        type: 'leader',
      }, ...prev].slice(0, 50));
      toast(`New Leader: Server ${data.newLeader}`, { duration: 5000 });
    });

    socket.on('server-event', (data) => {
      setLeaderLog(prev => [{
        time: new Date().toLocaleTimeString(),
        message: data.message,
        type: data.type?.toLowerCase() || 'info',
      }, ...prev].slice(0, 50));
    });

    socket.on('server-status', (data) => {
      setServerStatuses(prev => ({
        ...prev,
        ...Object.fromEntries(
          Object.entries(data.peers).map(([id, status]) => [id, { ...status, serverId: id }])
        ),
      }));
    });

    socket.on('load-test-output', (data) => {
      setLoadTestOutput(prev => [...prev.slice(-100), {
        text: data.text.trim(), type: data.type,
        time: new Date().toLocaleTimeString(),
      }]);
    });

    socket.on('load-test-complete', (data) => {
      setLoadTestRunning(false);
      toast.success(`Load test complete (exit code: ${data.code})`);
    });

    // Live bid updates for the looked-up auction
    socket.on('new-bid', (data) => {
      setLookupAuction(prev => {
        if (!prev || prev.auctionId !== data.auctionId) return prev;
        return {
          ...prev,
          currentHighestBid: data.currentHighestBid,
          highestBidder: data.highestBidder,
          highestBidderName: data.highestBidderName,
          bidCount: data.bidCount ?? (prev.bidCount || 0) + 1,
        };
      });
      setLookupBids(prev => {
        if (!prev.length && !data.bid) return prev;
        // Only add if it's for our looked-up auction
        if (lookupAuction && lookupAuction.auctionId === data.auctionId) {
          return [data.bid, ...prev.filter(b => b.bidId !== data.bid.bidId)].slice(0, 20);
        }
        return prev;
      });
    });

    socket.on('auction-ended', (data) => {
      setLookupAuction(prev => {
        if (!prev || prev.auctionId !== data.auctionId) return prev;
        return { ...prev, status: 'ENDED', highestBidder: data.winner, highestBidderName: data.winnerName };
      });
    });

    return () => {
      clearInterval(interval);
      socket.off('leader-changed');
      socket.off('server-event');
      socket.off('server-status');
      socket.off('load-test-output');
      socket.off('load-test-complete');
      socket.off('new-bid');
      socket.off('auction-ended');
    };
  }, []);

  const fetchNgrokUrl = async () => {
    try {
      const res = await axios.get('http://localhost:4040/api/tunnels', { timeout: 3000 });
      const tunnel = res.data?.tunnels?.find(t => t.proto === 'https') || res.data?.tunnels?.[0];
      if (tunnel?.public_url) {
        setNgrokUrl(tunnel.public_url);
      }
    } catch {
      // ngrok may not be running
    }
  };

  const fetchServerStatuses = async () => {
    try {
      const res = await serverAPI.getInfo();
      setSystemInfo(res.data);
      // Let the socket.io 'server-status' event populate the rest of the nodes naturally
    } catch {}
  };

  const startLoadTest = async () => {
    if (!loadTestConfig.auctionId.trim()) { toast.error('Please enter an Auction ID'); return; }
    try {
      setLoadTestRunning(true);
      setLoadTestOutput([]);
      await loadTestAPI.start(loadTestConfig);
      toast.success(`Load test started: ${loadTestConfig.vus} VUs × ${loadTestConfig.duration}`);
    } catch (err) {
      setLoadTestRunning(false);
      toast.error(err.response?.data?.message || err.response?.data?.error || 'Failed to start load test');
    }
  };

  const stopLoadTest = async () => {
    try {
      await loadTestAPI.stop();
      setLoadTestRunning(false);
      toast('Load test stopped', { icon: '⏹' });
    } catch { toast.error('Failed to stop load test'); }
  };

  // ─── Auction Lookup ────────────────────────────────────────
  const handleLookup = async (e) => {
    e?.preventDefault();
    const id = lookupId.trim();
    if (!id) { toast.error('Enter an auction ID'); return; }
    try {
      setLookupLoading(true);
      setLookupError('');
      const res = await auctionAPI.getById(id);
      setLookupAuction(res.data.auction);
      setLookupBids(res.data.bids || []);
      toast.success('Auction found');
    } catch (err) {
      setLookupError(err.response?.data?.error || 'Auction not found');
      setLookupAuction(null);
      setLookupBids([]);
      toast.error('Auction not found');
    } finally {
      setLookupLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  return (
    <div className="container" style={{ paddingTop: 44, paddingBottom: 96 }}>

      {/* Header */}
      <div style={{ marginBottom: 36, animation: 'fadeIn 0.4s ease' }}>
        <h1 style={{
          fontSize: 24, fontFamily: 'Space Grotesk, sans-serif',
          fontWeight: 700, marginBottom: 6, color: 'var(--text-1)',
          letterSpacing: '-0.5px',
        }}>
          System <span className="text-gradient">Admin</span>
        </h1>
        <p style={{ color: 'var(--text-3)', fontSize: 13 }}>
          Monitor server health, trigger load tests, and observe distributed system behavior.
        </p>

        {/* Ngrok URL */}
        {ngrokUrl && (
          <div style={{
            marginTop: 14, padding: '10px 14px',
            background: 'var(--green-dim)',
            border: '1px solid var(--green-border)',
            borderRadius: 8, fontSize: 12,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ color: 'var(--green)', fontWeight: 700 }}>🌐 Ngrok URL:</span>
            <code style={{
              color: 'var(--text-1)', background: 'var(--bg-inset)',
              padding: '2px 8px', borderRadius: 4, fontSize: 12,
              flex: 1, overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{ngrokUrl}</code>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => copyToClipboard(ngrokUrl)}
              style={{ flexShrink: 0, fontSize: 11 }}
            >Copy</button>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>

        {/* ── Left ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Server Grid */}
          <div className="glass-card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h2 style={{ fontSize: 15, fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, color: 'var(--text-1)' }}>
                Server Nodes
              </h2>
              <button className="btn btn-ghost btn-sm" onClick={fetchServerStatuses}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
                </svg>
                Refresh
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {SERVER_IDS.map(id => (
                <ServerCard
                  key={id}
                  serverId={id}
                  status={serverStatuses[id]}
                  systemInfo={systemInfo}
                />
              ))}
            </div>

            <div style={{
              marginTop: 18, padding: '12px 14px',
              background: 'var(--accent-dim)',
              border: '1px solid var(--accent-border)',
              borderRadius: 8, fontSize: 12,
              color: 'var(--text-2)', lineHeight: 1.7,
            }}>
              <strong style={{ color: 'var(--accent-light)' }}>Distributed System:</strong>{' '}
              Leader handles all writes → replicates to followers → Socket.io broadcasts to clients → Bully election on failure.
              Stop a Docker container to simulate failure.
            </div>
          </div>

          {/* ── Auction Lookup ────────────────────────────────── */}
          <div className="glass-card" style={{ padding: 24 }}>
            <h2 style={{ fontSize: 15, fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, marginBottom: 4, color: 'var(--text-1)' }}>
              Auction Lookup
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16, lineHeight: 1.6 }}>
              Enter an auction ID to view its live details and bid activity.
            </p>

            <form onSubmit={handleLookup} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                id="auction-lookup-input"
                className="input-field"
                type="text"
                placeholder="Paste auction ID here"
                value={lookupId}
                onChange={(e) => setLookupId(e.target.value)}
                style={{ flex: 1 }}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={lookupLoading}
                style={{ flexShrink: 0 }}
              >
                {lookupLoading ? 'Loading…' : 'Lookup'}
              </button>
            </form>

            {lookupError && (
              <div style={{
                padding: '10px 14px', borderRadius: 8,
                background: 'var(--red-dim)', border: '1px solid rgba(248,113,113,0.22)',
                fontSize: 12, color: 'var(--red)', marginBottom: 12,
              }}>
                {lookupError}
              </div>
            )}

            {lookupAuction && (
              <div style={{ animation: 'fadeIn 0.3s ease' }}>
                {/* Auction details card */}
                <div style={{
                  padding: 18, borderRadius: 10,
                  background: 'var(--bg-raised)',
                  border: '1px solid var(--border)',
                  marginBottom: 14,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', fontFamily: 'Space Grotesk', marginBottom: 4 }}>
                        {lookupAuction.itemName}
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span className={`badge ${lookupAuction.status === 'ONGOING' ? 'badge-ongoing' : 'badge-ended'}`}
                          style={{ fontSize: 10, padding: '2px 8px' }}>
                          {lookupAuction.status === 'ONGOING' ? '● LIVE' : 'ENDED'}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{lookupAuction.category}</span>
                      </div>
                    </div>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => copyToClipboard(lookupAuction.auctionId)}
                      style={{ fontSize: 10 }}
                      title="Copy auction ID"
                    >ID 📋</button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div style={{ padding: '10px 12px', background: 'var(--amber-dim)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8 }}>
                      <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 3 }}>Current Bid</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--amber)', fontFamily: 'Space Grotesk' }}>
                        ${lookupAuction.currentHighestBid?.toLocaleString()}
                      </div>
                    </div>
                    <div style={{ padding: '10px 12px', background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', borderRadius: 8 }}>
                      <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 3 }}>Highest Bidder</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-light)', fontFamily: 'Space Grotesk' }}>
                        {lookupAuction.highestBidderName || '—'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 11, color: 'var(--text-3)' }}>
                    <span>Bids: <strong style={{ color: 'var(--text-2)' }}>{lookupAuction.bidCount || 0}</strong></span>
                    <span>Starting: <strong style={{ color: 'var(--text-2)' }}>${lookupAuction.startingPrice}</strong></span>
                    <span>By: <strong style={{ color: 'var(--text-2)' }}>{lookupAuction.createdByName}</strong></span>
                  </div>
                </div>

                {/* Recent bids */}
                {lookupBids.length > 0 && (
                  <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>
                      Recent Bids ({lookupBids.length})
                    </div>
                    {lookupBids.slice(0, 10).map((bid, i) => (
                      <div key={bid.bidId || i} style={{
                        padding: '6px 10px', borderRadius: 6,
                        background: i === 0 ? 'var(--amber-dim)' : 'var(--bg-raised)',
                        border: `1px solid ${i === 0 ? 'rgba(245,158,11,0.18)' : 'var(--border)'}`,
                        fontSize: 12, color: 'var(--text-2)',
                        display: 'flex', justifyContent: 'space-between',
                      }}>
                        <span>
                          <strong style={{ color: i === 0 ? 'var(--amber)' : 'var(--text-1)' }}>
                            ${bid.amount?.toLocaleString()}
                          </strong>
                          {' by '}
                          <span style={{ color: 'var(--accent-light)' }}>{bid.userName}</span>
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--text-3)' }}>
                          L:{bid.lamportTimestamp} S{bid.serverId}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Event Log */}
          <div className="glass-card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 15, fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, color: 'var(--text-1)' }}>
                System Event Log
              </h2>
              {leaderLog.length > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={() => setLeaderLog([])} style={{ fontSize: 10 }}>
                  Clear
                </button>
              )}
            </div>

            <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {leaderLog.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-3)', fontSize: 13 }}>
                  No events yet. Events will appear here in real time.
                </div>
              ) : (
                leaderLog.map((entry, i) => (
                  <div key={i} style={{
                    padding: '7px 11px', borderRadius: 6,
                    background: entry.type === 'leader' ? 'var(--amber-dim)' : 'var(--bg-raised)',
                    border: `1px solid ${entry.type === 'leader' ? 'rgba(245,158,11,0.18)' : 'var(--border)'}`,
                    fontSize: 12, color: 'var(--text-2)',
                    animation: 'slideIn 0.25s ease',
                  }}>
                    <span style={{ color: 'var(--text-3)', marginRight: 8, fontSize: 11 }}>{entry.time}</span>
                    {entry.message}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ── Right — Load Test ─────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="glass-card" style={{ padding: 22 }}>
            <h2 style={{ fontSize: 15, fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, marginBottom: 4, color: 'var(--text-1)' }}>
              k6 Load Test
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 20, lineHeight: 1.6 }}>
              Simulate concurrent bidders to stress test the system.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Target Auction ID</label>
                <input
                  id="load-test-auction-id"
                  className="input-field"
                  type="text"
                  placeholder="Paste auction ID here"
                  value={loadTestConfig.auctionId}
                  onChange={(e) => setLoadTestConfig(prev => ({ ...prev, auctionId: e.target.value }))}
                  disabled={loadTestRunning}
                />
                <span style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4, display: 'block' }}>
                  Leave empty to auto-create a test auction
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Virtual Users (VUs)</label>
                <input
                  id="load-test-vus"
                  className="input-field"
                  type="number"
                  min="1" max="500"
                  value={loadTestConfig.vus}
                  onChange={(e) => setLoadTestConfig(prev => ({ ...prev, vus: parseInt(e.target.value) || 10 }))}
                  disabled={loadTestRunning}
                  style={{ marginBottom: 7 }}
                />
                <div style={{ display: 'flex', gap: 5 }}>
                  {[10, 25, 50, 100].map(v => (
                    <button
                      key={v}
                      type="button"
                      className={`btn btn-sm ${loadTestConfig.vus === v ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setLoadTestConfig(prev => ({ ...prev, vus: v }))}
                      disabled={loadTestRunning}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Duration</label>
                <input
                  id="load-test-duration"
                  className="input-field"
                  type="text"
                  placeholder="e.g. 30s, 2m"
                  value={loadTestConfig.duration}
                  onChange={(e) => setLoadTestConfig(prev => ({ ...prev, duration: e.target.value }))}
                  disabled={loadTestRunning}
                  style={{ marginBottom: 7 }}
                />
                <div style={{ display: 'flex', gap: 5 }}>
                  {['15s', '30s', '1m', '5m'].map(d => (
                    <button
                      key={d}
                      type="button"
                      className={`btn btn-sm ${loadTestConfig.duration === d ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setLoadTestConfig(prev => ({ ...prev, duration: d }))}
                      disabled={loadTestRunning}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {!loadTestRunning ? (
                <button
                  id="start-load-test-btn"
                  className="btn btn-success"
                  onClick={startLoadTest}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Start Load Test
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 14px', borderRadius: 8,
                    background: 'var(--green-dim)',
                    border: '1px solid var(--green-border)',
                  }}>
                    <span className="live-dot" />
                    <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>
                      Running… {loadTestConfig.vus} VUs
                    </span>
                  </div>
                  <button
                    id="stop-load-test-btn"
                    className="btn btn-danger"
                    onClick={stopLoadTest}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    Stop Test
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* k6 Output */}
          {loadTestOutput.length > 0 && (
            <div className="glass-card" style={{ padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>
                  k6 Output
                </h3>
                <button className="btn btn-ghost btn-sm" onClick={() => setLoadTestOutput([])} style={{ fontSize: 10 }}>
                  Clear
                </button>
              </div>
              <div style={{
                maxHeight: 200, overflowY: 'auto',
                fontFamily: 'monospace', fontSize: 11,
                color: 'var(--text-2)',
                background: 'var(--bg-inset)',
                border: '1px solid var(--border)',
                borderRadius: 6, padding: 10,
                display: 'flex', flexDirection: 'column', gap: 2,
              }}>
                {loadTestOutput.map((line, i) => (
                  <div key={i} style={{ color: line.type === 'stderr' ? 'var(--red)' : 'var(--text-2)' }}>
                    <span style={{ color: 'var(--text-3)', marginRight: 6 }}>{line.time}</span>
                    {line.text}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* NGINX Info */}
          <div style={{
            padding: '14px 16px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            fontSize: 12, color: 'var(--text-3)', lineHeight: 1.8,
          }}>
            <strong style={{ color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>
              Load Balancer (NGINX)
            </strong>
            Strategy: Least Connections<br />
            Upstream: S1:3001 → S2:3002 → S3:3003 → S4:3004<br />
            WebSocket: Upgrade headers enabled
          </div>
        </div>
      </div>
    </div>
  );
}

function ServerCard({ serverId, status = { online: false }, systemInfo }) {
  const isLeader = status.isLeader || (systemInfo?.currentLeader == serverId);
  const isOnline = status.online !== false;

  return (
    <div style={{
      padding: '16px 18px',
      borderRadius: 10,
      background: 'var(--bg-raised)',
      border: `1px solid ${
        !isOnline ? 'rgba(248,113,113,0.22)'
        : isLeader ? 'rgba(245,158,11,0.25)'
        : 'var(--border)'
      }`,
      transition: 'all 0.25s ease',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Leader glow */}
      {isLeader && isOnline && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 50% 0%, rgba(245,158,11,0.07), transparent 70%)',
          pointerEvents: 'none',
        }} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: isOnline
              ? isLeader ? 'var(--amber-dim)' : 'var(--accent-dim)'
              : 'var(--red-dim)',
            border: `1px solid ${
              isOnline
                ? isLeader ? 'rgba(245,158,11,0.25)' : 'var(--accent-border)'
                : 'rgba(248,113,113,0.22)'
            }`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 800,
            color: isOnline ? (isLeader ? 'var(--amber)' : 'var(--accent-light)') : 'var(--red)',
          }}>
            S{serverId}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>Server {serverId}</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Port 300{serverId}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: isOnline ? (isLeader ? 'var(--amber)' : 'var(--green)') : 'var(--red)',
            animation: isOnline ? 'pulse 2s ease-in-out infinite' : 'none',
          }} />
          <span style={{
            fontSize: 10, fontWeight: 700,
            color: isOnline ? (isLeader ? 'var(--amber)' : 'var(--green)') : 'var(--red)',
            textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            {isOnline ? (isLeader ? 'Leader' : 'Follower') : 'Offline'}
          </span>
        </div>
      </div>

      {isOnline && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <InfoRow label="Uptime" value={status.uptime ? `${Math.floor(status.uptime)}s` : '—'} />
          <InfoRow label="Lamport" value={status.lamportClock ?? '—'} />
          <InfoRow label="Leader" value={status.currentLeader ? `S${status.currentLeader}` : '?'} />
          <InfoRow label="Redis" value={status.redisReady ? '✅' : '❌'} />
        </div>
      )}

      {!isOnline && (
        <div style={{ fontSize: 12, color: 'var(--red)', textAlign: 'center', paddingTop: 4 }}>
          Unreachable
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', fontFamily: 'monospace' }}>
        {value}
      </span>
    </div>
  );
}
