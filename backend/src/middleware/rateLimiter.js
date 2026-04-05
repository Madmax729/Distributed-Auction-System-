// ─── Rate Limiting Middleware ─────────────────────────────────
// Max 5 bid requests per user per second.
// Uses userId from request body as the key (not just IP).
// ─────────────────────────────────────────────────────────────

const rateLimit = require('express-rate-limit');

const bidRateLimiter = rateLimit({
  windowMs: 1000,         // 1 second window
  max: 5,                 // max 5 requests per window
  keyGenerator: (req) => {
    // Use userId if available, fall back to IP
    return req.body?.userId || req.headers['x-user-id'] || req.ip;
  },
  handler: (req, res) => {
    console.warn(
      `[RateLimit] User ${req.body?.userId || req.ip} exceeded bid rate limit`
    );
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Maximum 5 bids per second allowed. Please slow down.',
      retryAfter: 1,
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { bidRateLimiter };
