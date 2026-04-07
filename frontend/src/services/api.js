// ─── API Service ─────────────────────────────────────────────
import axios from 'axios';

// Track server reachability for the banner
let serverReachable = true;
const reachabilityListeners = new Set();

export const onServerReachabilityChange = (listener) => {
  reachabilityListeners.add(listener);
  listener(serverReachable);
  return () => reachabilityListeners.delete(listener);
};

export const getServerReachable = () => serverReachable;

function setReachable(value) {
  if (serverReachable !== value) {
    serverReachable = value;
    reachabilityListeners.forEach(fn => fn(value));
  }
}

const api = axios.create({
  baseURL: '/api',
  timeout: 12000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach userId to all requests
api.interceptors.request.use((config) => {
  const userId = localStorage.getItem('userId');
  if (userId) config.headers['x-user-id'] = userId;
  return config;
});

// Response interceptor — track server reachability + friendly errors
api.interceptors.response.use(
  (response) => {
    setReachable(true);
    return response;
  },
  (error) => {
    // Network error or no response means server is down
    if (!error.response) {
      setReachable(false);
      error.userMessage = 'Server is unreachable. Please check if the backend is running.';
    } else if (error.response.status >= 500) {
      error.userMessage = error.response.data?.error || 'Internal server error';
    } else {
      // 4xx errors — server is reachable
      setReachable(true);
    }
    return Promise.reject(error);
  }
);

// ─── Auction APIs ─────────────────────────────────────────────
export const auctionAPI = {
  getAll:   (params = {}) => api.get('/auctions', { params }),
  getById:  (id) => api.get(`/auctions/${id}`),
  create:   (data) => api.post('/auctions', data),
  join:     (id, data) => api.post(`/auctions/${id}/join`, data),
  end:      (id) => api.post(`/auctions/${id}/end`),
  getStats: (id) => api.get(`/auctions/${id}/stats`),
};

// ─── Bid APIs ─────────────────────────────────────────────────
export const bidAPI = {
  place:       (data) => api.post('/bids', data),
  getByAuction:(auctionId) => api.get(`/bids/${auctionId}`),
};

// ─── Upload API ───────────────────────────────────────────────
export const uploadAPI = {
  uploadImage: (file) => {
    const formData = new FormData();
    formData.append('image', file);
    return api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// ─── Load Test API ────────────────────────────────────────────
export const loadTestAPI = {
  start:  (data) => api.post('/start-load-test', data),
  stop:   () => api.post('/stop-load-test'),
  status: () => api.get('/load-test-status'),
};

// ─── Server Info API ──────────────────────────────────────────
export const serverAPI = {
  getInfo: () => api.get('/server-info'),
  health:  () => axios.get('/health', { timeout: 3000 }),
};

export default api;
