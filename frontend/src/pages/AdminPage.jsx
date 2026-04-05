import { useState, useEffect } from 'react';
import { serverAPI, loadTestAPI } from '../services/api';
import { getSocket } from '../services/socket';
import toast from 'react-hot-toast';
import axios from 'axios';

const SERVER_PORTS = [3001, 3002, 3003, 3004];
const SERVER_IDS = [1, 2, 3, 4];

export default function AdminPage() {
  const [serverStatuses, setServerStatuses] = useState({});
  const [loadTestConfig, setLoadTestConfig] = useState({ vus: 10, duration: '30s', auctionId: '' });
  const [loadTestRunning, setLoadTestRunning] = useState(false);
  const [loadTestOutput, setLoadTestOutput] = useState([]);
  const [systemInfo, setSystemInfo] = useState(null);
  const [leaderLog, setLeaderLog] = useState([]);

  useEffect(() => {
    fetchServerStatuses();
    const interval = setInterval(fetchServerStatuses, 5000);

    // Listen for distributed system events
    const socket = getSocket();

    socket.on('leader-changed', (data) => {
      const entry = {
        time: new Date().toLocaleTimeString(),
        message: `👑 Leader changed to Server ${data.newLeader}`,
        type: 'leader',
      };
      setLeaderLog(prev => [entry, ...prev].slice(0, 50));
      toast(`👑 New Leader: Server ${data.newLeader}`, { duration: 5000 });
    });

    socket.on('server-event', (data) => {
      const entry = {
        time: new Date().toLocaleTimeString(),
        message: data.message,
        type: data.type?.toLowerCase() || 'info',
      };
      setLeaderLog(prev => [entry, ...prev].slice(0, 50));
    });

    socket.on('server-status', (data) => {
      setServerStatuses(prev => ({
        ...prev,
        ...Object.fromEntries(
          Object.entries(data.peers).map(([id, status]) => [
            id,
            { ...status, serverId: id },
          ])
        ),
      }));
    });

    socket.on('load-test-output', (data) => {
      setLoadTestOutput(prev => [...prev.slice(-100), {
        text: data.text.trim(),
        type: data.type,
        time: new Date().toLocaleTimeString(),
      }]);
    });

    socket.on('load-test-complete', (data) => {
      setLoadTestRunning(false);
      toast.success(`✅ Load test complete (exit code: ${data.code})`);
    });

    return () => {
      clearInterval(interval);
      socket.off('leader-changed');
      socket.off('server-event');
      socket.off('server-status');
      socket.off('load-test-output');
      socket.off('load-test-complete');
    };
  }, []);

  const fetchServerStatuses = async () => {
    const statuses = {};

    await Promise.allSettled(
      SERVER_IDS.map(async (id) => {
        try {
          // Direct health check to each server
          const port = 3000 + id;
          const res = await axios.get(`/health`, {
            timeout: 2000,
            headers: { 'x-target-server': id },
          });
          statuses[id] = { online: true, ...res.data };
        } catch {
          statuses[id] = { online: false, serverId: id };
        }
      })
    );

    // Also get info from the current server
    try {
      const res = await serverAPI.getInfo();
      setSystemInfo(res.data);
      const serverId = parseInt(res.data.serverId);
      statuses[serverId] = { online: true, ...res.data };
    } catch {}

    setServerStatuses(statuses);
  };

  const startLoadTest = async () => {
    if (!loadTestConfig.auctionId.trim()) {
      toast.error('Please enter an Auction ID first');
      return;
    }

    try {
      setLoadTestRunning(true);
      setLoadTestOutput([]);
      await loadTestAPI.start(loadTestConfig);
      toast.success(`🚀 Load test started: ${loadTestConfig.vus} VUs × ${loadTestConfig.duration}`);
    } catch (err) {
      setLoadTestRunning(false);
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to start load test';
      toast.error(msg);
    }
  };

  const stopLoadTest = async () => {
    try {
      await loadTestAPI.stop();
      setLoadTestRunning(false);
      toast('⏹ Load test stopped', { icon: '🛑' });
    } catch (err) {
      toast.error('Failed to stop load test');
    }
  };

  const ServerCard = ({ serverId }) => {
    const status = serverStatuses[serverId] || { online: false, serverId };
    const isLeader = status.isLeader || (systemInfo?.currentLeader == serverId);
    const isOnline = status.online !== false;

    return (
      <div style={{
        padding: '20px 22px',
        borderRadius: 14,
        background: isOnline
          ? isLeader
            ? 'rgba(255, 215, 0, 0.06)'
            : 'rgba(79, 172, 254, 0.06)'
          : 'rgba(255, 101, 132, 0.06)',
        border: `1px solid ${
          !isOnline ? 'rgba(255, 101, 132, 0.25)'
          : isLeader ? 'rgba(255, 215, 0, 0.3)'
          : 'rgba(79, 172, 254, 0.2)'
        }`,
        transition: 'all 0.3s ease',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Animated glow for leader */}
        {isLeader && isOnline && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(circle at 50% 0%, rgba(255,215,0,0.08), transparent 70%)',
            pointerEvents: 'none',
          }} />
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: isOnline
                ? isLeader ? 'linear-gradient(135deg, #ffd700, #f97316)' : 'linear-gradient(135deg, #4facfe, #6c63ff)'
                : 'rgba(255, 101, 132, 0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 800, color: 'white',
              boxShadow: isLeader ? '0 0 15px rgba(255,215,0,0.4)' : 'none',
            }}>
              {isLeader ? '👑' : `S${serverId}`}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Server {serverId}</div>
              <div style={{ fontSize: 11, color: 'rgba(240,240,255,0.4)' }}>Port 300{serverId}</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: isOnline ? (isLeader ? '#ffd700' : '#00e5a0') : '#ff6584',
              boxShadow: isOnline ? `0 0 8px ${isLeader ? '#ffd700' : '#00e5a0'}` : 'none',
              animation: isOnline ? 'pulse 2s ease-in-out infinite' : 'none',
            }} />
            <span style={{
              fontSize: 11, fontWeight: 600,
              color: isOnline ? (isLeader ? '#ffd700' : '#00e5a0') : '#ff6584',
            }}>
              {isOnline ? (isLeader ? 'LEADER' : 'FOLLOWER') : 'OFFLINE'}
            </span>
          </div>
        </div>

        {isOnline && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <InfoRow label="Uptime" value={status.uptime ? `${Math.floor(status.uptime)}s` : 'N/A'} />
            <InfoRow label="Lamport Clock" value={status.lamportClock ?? 'N/A'} />
            <InfoRow label="Current Leader" value={status.currentLeader ? `S${status.currentLeader}` : '?'} />
          </div>
        )}

        {!isOnline && (
          <div style={{ fontSize: 13, color: 'rgba(255, 101, 132, 0.7)', textAlign: 'center', padding: '8px 0' }}>
            🔴 Server unreachable
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ marginBottom: 40, animation: 'fadeIn 0.5s ease' }}>
        <h1 style={{
          fontSize: 36, fontFamily: 'Space Grotesk, sans-serif',
          fontWeight: 800, marginBottom: 8,
        }}>
          ⚙️ System <span style={{
            background: 'linear-gradient(135deg, #6c63ff, #4facfe)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>Admin</span>
        </h1>
        <p style={{ color: 'rgba(240,240,255,0.4)', fontSize: 14 }}>
          Monitor server health, trigger load tests, and observe distributed system behavior
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
        {/* Left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Server Status Grid */}
          <div className="glass-card" style={{ padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700 }}>
                🖥️ Server Nodes
              </h2>
              <button className="btn btn-ghost btn-sm" onClick={fetchServerStatuses}>
                🔄 Refresh
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {SERVER_IDS.map(id => (
                <ServerCard key={id} serverId={id} />
              ))}
            </div>

            {/* Architecture Info */}
            <div style={{
              marginTop: 20, padding: '14px 16px',
              background: 'rgba(108, 99, 255, 0.06)',
              border: '1px solid rgba(108, 99, 255, 0.15)',
              borderRadius: 10, fontSize: 12,
              color: 'rgba(240,240,255,0.5)', lineHeight: 1.7,
            }}>
              <strong style={{ color: 'rgba(240,240,255,0.8)' }}>🧠 Distributed System:</strong>
              Leader handles all writes → replicates to followers via /replicate-bid →
              Socket.io broadcasts to all clients → Bully election on leader failure.
              Stop a Docker container to simulate failure!
            </div>
          </div>

          {/* Event Log */}
          <div className="glass-card" style={{ padding: 28 }}>
            <h2 style={{ fontSize: 18, fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, marginBottom: 20 }}>
              📋 System Event Log
            </h2>

            <div style={{
              maxHeight: 280, overflowY: 'auto',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              {leaderLog.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(240,240,255,0.3)', fontSize: 13 }}>
                  No events yet. System events will appear here in real time.
                </div>
              ) : (
                leaderLog.map((entry, i) => (
                  <div key={i} style={{
                    padding: '8px 12px', borderRadius: 8,
                    background: entry.type === 'leader' ? 'rgba(255,215,0,0.06)'
                      : entry.type === 'leader_failure' ? 'rgba(255,101,132,0.06)'
                      : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${
                      entry.type === 'leader' ? 'rgba(255,215,0,0.2)'
                      : entry.type === 'leader_failure' ? 'rgba(255,101,132,0.2)'
                      : 'rgba(255,255,255,0.05)'
                    }`,
                    fontSize: 12, color: 'rgba(240,240,255,0.7)',
                    animation: 'slideIn 0.3s ease',
                  }}>
                    <span style={{ color: 'rgba(240,240,255,0.3)', marginRight: 8 }}>{entry.time}</span>
                    {entry.message}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right — Load Test Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="glass-card" style={{ padding: 28 }}>
            <h2 style={{ fontSize: 18, fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, marginBottom: 6 }}>
              🚀 k6 Load Test
            </h2>
            <p style={{ fontSize: 13, color: 'rgba(240,240,255,0.4)', marginBottom: 24, lineHeight: 1.6 }}>
              Simulate concurrent users bidding to stress test the distributed system.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Auction ID */}
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
              </div>

              {/* VUs */}
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
                />
                <div style={{ display: 'flex', gap: 6 }}>
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

              {/* Duration */}
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
                />
                <div style={{ display: 'flex', gap: 6 }}>
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

              {/* Control Buttons */}
              {!loadTestRunning ? (
                <button
                  id="start-load-test-btn"
                  className="btn btn-success"
                  onClick={startLoadTest}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  🚀 Start Load Test
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '12px 16px', borderRadius: 10,
                    background: 'rgba(0, 229, 160, 0.08)',
                    border: '1px solid rgba(0, 229, 160, 0.2)',
                  }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: '#00e5a0',
                      animation: 'pulse 1s ease-in-out infinite',
                    }} />
                    <span style={{ fontSize: 13, color: '#00e5a0', fontWeight: 600 }}>
                      Load test running... {loadTestConfig.vus} VUs
                    </span>
                  </div>
                  <button
                    id="stop-load-test-btn"
                    className="btn btn-danger"
                    onClick={stopLoadTest}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    ⏹ Stop Test
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* k6 Output Terminal */}
          {loadTestOutput.length > 0 && (
            <div className="glass-card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: '#00e5a0' }}>
                📊 k6 Output
              </h3>
              <div style={{
                maxHeight: 220, overflowY: 'auto',
                fontFamily: 'monospace', fontSize: 11,
                color: 'rgba(240,240,255,0.6)',
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 8, padding: 12,
                display: 'flex', flexDirection: 'column', gap: 3,
              }}>
                {loadTestOutput.map((line, i) => (
                  <div key={i} style={{
                    color: line.type === 'stderr' ? '#ff9580' : 'rgba(240,240,255,0.7)',
                  }}>
                    <span style={{ color: 'rgba(240,240,255,0.3)', marginRight: 6 }}>{line.time}</span>
                    {line.text}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* NGINX Info */}
          <div style={{
            padding: '16px 20px',
            background: 'rgba(108, 99, 255, 0.06)',
            border: '1px solid rgba(108, 99, 255, 0.15)',
            borderRadius: 14,
            fontSize: 12, color: 'rgba(240,240,255,0.5)', lineHeight: 1.7,
          }}>
            <strong style={{ color: 'rgba(240,240,255,0.8)', display: 'block', marginBottom: 6 }}>
              ⚖️ Load Balancer (NGINX)
            </strong>
            Strategy: Least Connections<br />
            Upstream: S1:3001 → S2:3002 → S3:3003 → S4:3004<br />
            WebSocket: Upgrade headers enabled<br />
            <a href="/nginx-health" target="_blank" style={{ color: '#6c63ff' }}>
              Check NGINX health →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 11, color: 'rgba(240,240,255,0.4)' }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(240,240,255,0.8)', fontFamily: 'monospace' }}>
        {value}
      </span>
    </div>
  );
}
