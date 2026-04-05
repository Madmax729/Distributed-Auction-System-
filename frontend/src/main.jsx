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
            background: '#1c2233',
            color: '#e8edf8',
            border: '1px solid rgba(99,102,241,0.25)',
            backdropFilter: 'blur(16px)',
            fontFamily: "'Inter', sans-serif",
            fontSize: '13px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            borderRadius: '10px',
          },
          success: {
            iconTheme: { primary: '#34d399', secondary: '#052e16' },
          },
          error: {
            iconTheme: { primary: '#f87171', secondary: '#1c0a0a' },
          },
          duration: 3500,
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
);
