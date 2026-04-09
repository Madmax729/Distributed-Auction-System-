import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Terminal, AlertTriangle, ShieldCheck, Play, Square, Server, Network } from 'lucide-react';
import { loadTestAPI, serverAPI } from '../services/api';
import { getSocket } from '../services/socket';
import toast from 'react-hot-toast';
import styles from './LoadTestPage.module.css';

export default function LoadTestPage() {
  const [active, setActive] = useState(false);
  const [config, setConfig] = useState({ vus: '20', duration: '30s', auctionId: '' });
  
  // React State for display
  const [logs, setLogs] = useState([]);
  const [metrics, setMetrics] = useState({ totalBids: 0, leaderId: null, serverStats: { 1: 0, 2: 0, 3: 0, 4: 0 } });
  
  const endRef = useRef(null);
  
  // High-frequency buffers
  const metricsRef = useRef({ totalBids: 0, leaderId: null, serverStats: { 1: 0, 2: 0, 3: 0, 4: 0 } });
  const logsRef = useRef([]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    // 10 FPS Render Loop: prevents high-frequency socket events from locking up React
    const interval = setInterval(() => {
      setMetrics({ ...metricsRef.current, serverStats: { ...metricsRef.current.serverStats } });
      if (logsRef.current.length > 0) {
        setLogs([...logsRef.current]);
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const socket = getSocket();
    
    const fetchLeader = async () => {
      try {
        const res = await serverAPI.getInfo();
        metricsRef.current.leaderId = res.data.currentLeader;
      } catch (err) {}
    };
    fetchLeader();

    socket.on('load-test-output', (data) => {
      logsRef.current.push({ text: data.text, type: data.type });
      if (logsRef.current.length > 150) logsRef.current = logsRef.current.slice(-150);
    });

    socket.on('load-test-complete', (data) => {
      setActive(false);
      logsRef.current.push({ text: `\n=== TEST COMPLETE (Exit Code: ${data.code}) ===\n`, type: 'info' });
      toast.success('Load Test Completed!');
    });

    socket.on('new-bid', (data) => {
      if (data.bid) {
        const sId = data.handledBy || data.bid.serverId || data.serverId;
        metricsRef.current.totalBids++;
        metricsRef.current.serverStats[sId] = (metricsRef.current.serverStats[sId] || 0) + 1;
      }
    });

    socket.on('leader-changed', (data) => {
      metricsRef.current.leaderId = data.newLeader;
    });

    return () => {
      socket.off('load-test-output');
      socket.off('load-test-complete');
      socket.off('new-bid');
      socket.off('leader-changed');
    };
  }, []);

  const handleStart = async () => {
    try {
      logsRef.current = [{ text: 'Initializing k6 Virtual Users...', type: 'info' }];
      metricsRef.current = { totalBids: 0, leaderId: metricsRef.current.leaderId, serverStats: { 1: 0, 2: 0, 3: 0, 4: 0 } };
      
      await loadTestAPI.start({
        vus: parseInt(config.vus),
        duration: config.duration,
        auctionId: config.auctionId || undefined
      });
      setActive(true);
      toast.success('Load test initiated!');
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    }
  };

  const handleStop = async () => {
    try {
      await loadTestAPI.stop();
      setActive(false);
      toast.success('Test stopped manually');
    } catch (err) {}
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity color="#a855f7" /> Distributed Load Simulation
          </h1>
          <p>Unleash concurrent virtual users (VUs) to test system resilience and leader-follower data consistency.</p>
        </div>
      </div>

      <div className={styles.grid}>
        
        {/* Controls Panel */}
        <div className={styles.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
             <Network size={20} color="#a855f7" />
             <h2 style={{ margin: 0 }}>Test Configuration</h2>
          </div>
          <div className={styles.inputGroup}>
            <label>Virtual Users (VUs)</label>
            <input 
              type="number" 
              value={config.vus} 
              onChange={e => setConfig({...config, vus: e.target.value})}
              disabled={active}
              min="1" max="200"
            />
          </div>
          <div className={styles.inputGroup}>
            <label>Duration (e.g. 30s, 1m)</label>
            <input 
              type="text" 
              value={config.duration} 
              onChange={e => setConfig({...config, duration: e.target.value})}
              disabled={active}
            />
          </div>
          <div className={styles.inputGroup}>
            <label>Target Auction ID (Optional)</label>
            <input 
              type="text" 
              placeholder="Leave blank to auto-create new test auction" 
              value={config.auctionId} 
              onChange={e => setConfig({...config, auctionId: e.target.value})}
              disabled={active}
            />
            <small style={{ color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>Provide an ID to hit an existing auction, or leave blank to instantly spawn a new one.</small>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
            {!active ? (
              <button className={styles.btnPrimary} onClick={handleStart}>
                <Play size={18} /> Start Test
              </button>
            ) : (
              <button className={styles.btnDanger} onClick={handleStop}>
                <Square size={18} /> Stop Test
              </button>
            )}
          </div>
        </div>

        {/* Real-Time Metrics & Nodes */}
        <div className={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0 }}>Real-Time Distribution</h2>
            <div className={styles.badge}>Live Bids Processed: {metrics.totalBids}</div>
          </div>
          
          <div className={styles.nodeGrid}>
            {[1, 2, 3, 4].map(id => {
              const isLeader = metrics.leaderId === id;
              const count = metrics.serverStats[id] || 0;
              const percentage = metrics.totalBids === 0 ? 0 : Math.round((count / metrics.totalBids) * 100);

              return (
                <div key={id} className={`${styles.nodeBox} ${isLeader ? styles.nodeLeader : styles.nodeFollower}`}>
                  <div className={styles.nodeHeader}>
                    <Server size={18} />
                    <span>Server {id}</span>
                    {isLeader && <ShieldCheck size={14} color="#22c55e" style={{ marginLeft: 'auto' }}/>}
                  </div>
                  <div className={styles.nodeBody}>
                    <div className={styles.nodeRole}>{isLeader ? 'Leader (Write Auth)' : 'Follower (Read Only)'}</div>
                    <div className={styles.nodeCount}>
                      {count} Bids
                    </div>
                    <div className={styles.progressBar}>
                      <div className={styles.progressFill} style={{ width: `${percentage}%` }}></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className={styles.insightBox}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', marginBottom: '4px' }}>
               <AlertTriangle size={16} /> Architectural Insight: The Write Bottleneck
            </div>
            <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.4' }}>
              Under load, you will notice <strong>all 4 servers handle an exactly equal 25% share of incoming HTTP Network Connections (Load Balanced by NGINX Round Robin)</strong>! 
              However, 100% of the successful writes are safely intercepted by followers and <strong>forwarded</strong> directly to the Leader behind the scenes! This guarantees 
              atomic sequential bidding using Lamport Clocks and prevents race conditions!
            </p>
          </div>
        </div>

        {/* K6 Terminal */}
        <div className={`${styles.card} ${styles.terminalCard}`}>
          <div className={styles.terminalHeader}>
            <Terminal size={14} /> k6 Load Test Execution Logs
          </div>
          <div className={styles.terminalBody}>
            {logs.length === 0 && <div className={styles.logEmpty}>Awaiting test initiation...</div>}
            {logs.map((log, i) => (
              <div 
                key={i} 
                className={log.type === 'stderr' ? styles.logError : (log.type === 'info' ? styles.logInfo : styles.logOut)}
              >
                {log.text}
              </div>
            ))}
            <div ref={endRef} />
          </div>
        </div>

      </div>
    </div>
  );
}
