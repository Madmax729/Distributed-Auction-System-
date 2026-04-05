import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'rgba(15, 15, 40, 0.95)',
            color: '#f0f0ff',
            border: '1px solid rgba(108, 99, 255, 0.3)',
            backdropFilter: 'blur(20px)',
            fontFamily: "'Inter', sans-serif",
            fontSize: '14px',
          },
          success: {
            iconTheme: { primary: '#00e5a0', secondary: '#001a12' },
          },
          error: {
            iconTheme: { primary: '#ff6584', secondary: '#1a0010' },
          },
          duration: 3000,
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
);
