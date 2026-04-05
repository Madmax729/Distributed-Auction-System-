import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { serverAPI } from '../services/api';
import { getSocket } from '../services/socket';
import styles from './Navbar.module.css';

export default function Navbar({ user, onChangeUser }) {
  const location = useLocation();
  const [serverInfo, setServerInfo] = useState(null);
  const [leaderInfo, setLeaderInfo] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const fetchServerInfo = async () => {
      try {
        const res = await serverAPI.getInfo();
        setServerInfo(res.data);
      } catch {}
    };

    fetchServerInfo();
    const interval = setInterval(fetchServerInfo, 5000);

    // Listen for leader change events
    const socket = getSocket();
    socket.on('leader-changed', (data) => {
      setLeaderInfo(data);
    });

    return () => {
      clearInterval(interval);
      socket.off('leader-changed');
    };
  }, []);

  const isActive = (path) => location.pathname === path;

  return (
    <nav className={styles.navbar}>
      <div className={styles.container}>
        {/* Logo */}
        <Link to="/" className={styles.logo}>
          <div className={styles.logoIcon}>⚡</div>
          <span className={styles.logoText}>
            Auction<span className={styles.logoAccent}>X</span>
          </span>
          <span className={styles.logoBadge}>DISTRIBUTED</span>
        </Link>

        {/* Navigation Links */}
        <div className={`${styles.links} ${menuOpen ? styles.linksOpen : ''}`}>
          <Link to="/" className={`${styles.link} ${isActive('/') ? styles.linkActive : ''}`}>
            🏠 Auctions
          </Link>
          <Link to="/create" className={`${styles.link} ${isActive('/create') ? styles.linkActive : ''}`}>
            ➕ Create
          </Link>
          <Link to="/admin" className={`${styles.link} ${isActive('/admin') ? styles.linkActive : ''}`}>
            ⚙️ Admin
          </Link>
        </div>

        {/* Server Status Badge */}
        {serverInfo && (
          <div className={styles.serverStatus}>
            <div className={`${styles.statusDot} ${serverInfo.isLeader ? styles.statusLeader : styles.statusFollower}`}>
              <div className={styles.statusRing} />
            </div>
            <div className={styles.statusInfo}>
              <span className={styles.serverLabel}>
                S{serverInfo.serverId}
              </span>
              <span className={serverInfo.isLeader ? styles.leaderTag : styles.followerTag}>
                {serverInfo.isLeader ? '👑 Leader' : 'Follower'}
              </span>
            </div>
          </div>
        )}

        {/* User Chip */}
        {user && (
          <button className={styles.userChip} onClick={onChangeUser} title="Change user">
            <div className={styles.userAvatar}>
              {user.userName.charAt(0).toUpperCase()}
            </div>
            <span className={styles.userName}>{user.userName}</span>
          </button>
        )}

        {/* Mobile Menu Toggle */}
        <button className={styles.menuToggle} onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>
    </nav>
  );
}
