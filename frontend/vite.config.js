import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// When running `npm run dev`, proxy API calls to the backend directly.
// Change BACKEND_URL to http://localhost:80 if running via Docker+NGINX.
const BACKEND_URL = process.env.VITE_BACKEND_URL || 'http://localhost:3001';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: BACKEND_URL,
        changeOrigin: true,
        ws: false,
      },
      '/socket.io': {
        target: BACKEND_URL,
        changeOrigin: true,
        ws: true,
      },
      '/uploads': {
        target: BACKEND_URL,
        changeOrigin: true,
      },
      '/health': {
        target: BACKEND_URL,
        changeOrigin: true,
      },
    },
  },
});
