// ─── Redis Client ─────────────────────────────────────────────
// Optional caching layer. Falls back gracefully if Redis is down.
// ─────────────────────────────────────────────────────────────

const Redis = require('ioredis');

let redis = null;
let isReady = false;

/**
 * Connect to Redis. Non-blocking — if Redis is unavailable,
 * the app continues without caching.
 */
function connectRedis() {
  const url = process.env.REDIS_URL || 'redis://localhost:6379';

  redis = new Redis(url, {
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      if (times > 5) return null; // stop retrying after 5 attempts
      return Math.min(times * 500, 3000);
    },
    lazyConnect: false,
    connectTimeout: 5000,
  });

  redis.on('connect', () => {
    console.log('[Redis] Connected ✅');
    isReady = true;
  });

  redis.on('ready', () => {
    isReady = true;
  });

  redis.on('error', (err) => {
    if (isReady) {
      console.warn('[Redis] Connection error:', err.message);
    }
    isReady = false;
  });

  redis.on('close', () => {
    isReady = false;
  });

  return redis;
}

/**
 * Get cached value by key. Returns parsed JSON or null.
 */
async function getCache(key) {
  if (!isReady || !redis) return null;
  try {
    const val = await redis.get(key);
    return val ? JSON.parse(val) : null;
  } catch (err) {
    console.warn('[Redis] getCache error:', err.message);
    return null;
  }
}

/**
 * Set a cached value with optional TTL (seconds).
 */
async function setCache(key, value, ttlSeconds = 5) {
  if (!isReady || !redis) return;
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    console.warn('[Redis] setCache error:', err.message);
  }
}

/**
 * Invalidate (delete) a cached key or pattern.
 */
async function invalidateCache(pattern) {
  if (!isReady || !redis) return;
  try {
    if (pattern.includes('*')) {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) await redis.del(...keys);
    } else {
      await redis.del(pattern);
    }
  } catch (err) {
    console.warn('[Redis] invalidateCache error:', err.message);
  }
}

/**
 * Check if Redis is available.
 */
function isRedisReady() {
  return isReady;
}

module.exports = {
  connectRedis,
  getCache,
  setCache,
  invalidateCache,
  isRedisReady,
};
