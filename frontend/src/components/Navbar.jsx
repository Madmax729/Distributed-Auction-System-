import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { serverAPI } from '../services/api';
import { getSocket } from '../services/socket';
import styles from './Navbar.module.css';

export default function Navbar({ user, onChangeUser, theme, toggleTheme }) {
  const location     = useLocation();
  const [serverInfo, setServerInfo] = useState(null);
  const [menuOpen, setMenuOpen]     = useState(false);
  const [scrolled, setScrolled]     = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const fetchServerInfo = async () => {
      try {
        const res = await serverAPI.getInfo();
        setServerInfo(res.data);
      } catch {}
    };
    fetchServerInfo();
    const interval = setInterval(fetchServerInfo, 6000);

    const socket = getSocket();
    socket.on('leader-changed', () => fetchServerInfo());

    return () => {
      clearInterval(interval);
      socket.off('leader-changed');
    };
  }, []);

  // Close mobile menu on route change
  useEffect(() => setMenuOpen(false), [location.pathname]);

  const isActive = (path) => location.pathname === path;

  return (
    <nav className={`${styles.navbar} ${scrolled ? styles.scrolled : ''}`}>
      <div className={styles.container}>

        {/* Logo */}
        <Link to="/" className={styles.logo}>
          <div className={styles.logoMark}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <polygon points="12,2 22,8.5 22,15.5 12,22 2,15.5 2,8.5" fill="currentColor" opacity="0.9"/>
            </svg>
          </div>
          <span className={styles.logoText}>
            Auction<span className={styles.logoAccent}>X</span>
          </span>
          <span className={styles.logoBadge}>DIST</span>
        </Link>

        {/* Nav Links */}
        <div className={`${styles.links} ${menuOpen ? styles.linksOpen : ''}`}>
          <Link to="/"       className={`${styles.link} ${isActive('/')       ? styles.linkActive : ''}`}>Auctions</Link>
          <Link to="/create" className={`${styles.link} ${isActive('/create') ? styles.linkActive : ''}`}>Create</Link>
          <Link to="/loadtest" className={`${styles.link} ${isActive('/loadtest') ? styles.linkActive : ''}`}>Load Test</Link>
          <Link to="/admin"  className={`${styles.link} ${isActive('/admin')  ? styles.linkActive : ''}`}>Admin</Link>
        </div>

        <div className={styles.actions}>
          {/* Server Status */}
          {serverInfo && (
            <div className={styles.serverStatus} title={`Server ${serverInfo.serverId} — ${serverInfo.isLeader ? 'Leader' : 'Follower'}`}>
              <span className={`${styles.statusDot} ${serverInfo.isLeader ? styles.dotLeader : styles.dotFollower}`} />
              <span className={styles.serverLabel}>S{serverInfo.serverId}</span>
              <span className={serverInfo.isLeader ? styles.roleLeader : styles.roleFollower}>
                {serverInfo.isLeader ? 'Leader' : 'Follower'}
              </span>
            </div>
          )}

          {/* Theme Toggle */}
          <button
            id="theme-toggle-btn"
            className={styles.iconBtn}
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              /* Sun icon */
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1"  x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22"   x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1"  y1="12" x2="3"  y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              /* Moon icon */
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>

          {/* User Chip */}
          {user && (
            <button className={styles.userChip} onClick={onChangeUser} title="Change username">
              <div className={styles.userAvatar}>
                {user.userName.charAt(0).toUpperCase()}
              </div>
              <span className={styles.userName}>{user.userName}</span>
            </button>
          )}

          {/* Mobile toggle */}
          <button
            className={styles.menuToggle}
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Toggle menu"
          >
            {menuOpen
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6"  x2="6"  y2="18"/><line x1="6"  y1="6"  x2="18" y2="18"/></svg>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6"  x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            }
          </button>
        </div>

      </div>
    </nav>
  );
}
