import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Navbar from './components/Navbar';
import ServerStatusBanner from './components/ServerStatusBanner';
import HomePage from './pages/HomePage';
import AuctionPage from './pages/AuctionPage';
import CreateAuctionPage from './pages/CreateAuctionPage';
import AdminPage from './pages/AdminPage';
import UserSetupModal from './components/UserSetupModal';
import { getSocket } from './services/socket';

function App() {
  const [user, setUser]           = useState(null);
  const [showSetup, setShowSetup] = useState(false);
  const [theme, setTheme]         = useState(() => {
    return localStorage.getItem('theme') || 'dark';
  });

  // Apply theme to <html> element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const savedUserId   = localStorage.getItem('userId');
    const savedUserName = localStorage.getItem('userName');

    if (savedUserId && savedUserName) {
      setUser({ userId: savedUserId, userName: savedUserName });
    } else {
      setShowSetup(true);
    }

    getSocket();
  }, []);

  const handleUserSetup = (userName) => {
    const userId = uuidv4();
    localStorage.setItem('userId', userId);
    localStorage.setItem('userName', userName);
    setUser({ userId, userName });
    setShowSetup(false);
  };

  const toggleTheme = () =>
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));

  return (
    <div style={{ minHeight: '100vh' }}>
      <ServerStatusBanner />
      <Navbar user={user} onChangeUser={() => setShowSetup(true)} theme={theme} toggleTheme={toggleTheme} />

      <main style={{ paddingTop: '60px' }}>
        <Routes>
          <Route path="/"                    element={<HomePage user={user} />} />
          <Route path="/auction/:auctionId"  element={<AuctionPage user={user} />} />
          <Route path="/create"              element={<CreateAuctionPage user={user} />} />
          <Route path="/admin"               element={<AdminPage />} />
          <Route path="*"                    element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {showSetup && <UserSetupModal onComplete={handleUserSetup} />}
    </div>
  );
}

export default App;
