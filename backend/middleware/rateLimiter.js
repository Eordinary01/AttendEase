const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

let RedisStore = null;
try {
  RedisStore = require('rate-limit-redis');
} catch (e) {
  // rate-limit-redis not installed; will use memory store
}

const Redis = require('ioredis');

let redisClient = null;
if (process.env.REDIS_URL) {
  const isTls = process.env.REDIS_URL.startsWith('rediss://') || process.env.REDIS_URL.includes('upstash.io');
  try {
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      enableOfflineQueue: false,
      autoResubscribe: false,
      lazyConnect: true,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 200, 1000);
      },
      ...(isTls ? { tls: { rejectUnauthorized: false } } : {})
    });
    redisClient.on('error', (err) => {
      if (redisClient) {
        logger.warn('Redis rate-limiter connection error', { error: err.message });
        try { redisClient.disconnect(); } catch (e) {}
        redisClient = null;
      }
    });
    redisClient.connect().catch((err) => {
      logger.warn('Redis rate-limiter connection failed', { error: err.message });
      try { redisClient.disconnect(); } catch (e) {}
      redisClient = null;
    });
  } catch (e) {
    redisClient = null;
  }
}

const planLimits = {
  free: { windowMs: 60 * 1000, max: 100 },
  basic: { windowMs: 60 * 1000, max: 500 },
  professional: { windowMs: 60 * 1000, max: 2000 },
  enterprise: { windowMs: 60 * 1000, max: 10000 }
};

function getStore() {
  if (redisClient && RedisStore) {
    return new RedisStore({
      sendCommand: (...args) => redisClient.call(...args),
      prefix: 'rl:'
    });
  }
  if (process.env.NODE_ENV === 'production') {
    logger.warn('SECURITY WARNING: Production mode running without Redis rate limiter store (REDIS_URL unconfigured/disconnected). Falling back to memory store.');
  }
  return undefined;
}

const limitersMap = new Map();

const createRateLimiter = (tenantId, planCode) => {
  const limit = planLimits[planCode] || planLimits.free;

  return rateLimit({
    windowMs: limit.windowMs,
    max: limit.max,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        message: 'Rate limit exceeded. Please upgrade your plan for higher limits.',
        upgradeUrl: '/pricing'
      });
    },
    skip: (req) => req.path === '/health' || req.path === '/',
    store: getStore()
  });
};

const apiRateLimiter = (req, res, next) => {
  if (!req.tenant) return next();
  if (req.path === '/health' || req.path === '/') return next();

  // Item #11: Require Redis in production for distributed rate limiting
  if (process.env.NODE_ENV === 'production' && (!redisClient || !RedisStore)) {
    return res.status(503).json({
      success: false,
      message: 'Rate limiting service unavailable. Distributed rate limiter requires Redis in production.',
      code: 'RATE_LIMITER_UNAVAILABLE'
    });
  }

  const planCode = req.tenant.subscription?.plan || 'free';
  const tenantId = req.tenantId?.toString() || 'default';
  const key = `${tenantId}:${planCode}`;

  let limiter = limitersMap.get(key);
  if (!limiter) {
    limiter = createRateLimiter(tenantId, planCode);
    limitersMap.set(key, limiter);
  }
  return limiter(req, res, next);
};


module.exports = { apiRateLimiter };