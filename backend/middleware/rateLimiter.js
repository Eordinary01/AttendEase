const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');
const { getSharedRedisClient } = require('../utils/redisClient');

let RedisStore = null;
try {
  RedisStore = require('rate-limit-redis');
} catch (e) {
  // rate-limit-redis not installed; will use memory store
}

const redisClient = getSharedRedisClient();


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

const MAX_LIMITERS = 1000;
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

  // Production fallback: Graceful fallback to memory store if Redis is unavailable, avoiding service outage
  if (process.env.NODE_ENV === 'production' && (!redisClient || !RedisStore)) {
    // Log once per process/limiter creation (handled in getStore) — continue with in-memory rate limiting
  }

  const planCode = req.tenant.subscription?.plan || 'free';
  const tenantId = req.tenantId?.toString() || 'default';
  const key = `${tenantId}:${planCode}`;

  let limiter = limitersMap.get(key);
  if (!limiter) {
    if (limitersMap.size >= MAX_LIMITERS) {
      const oldestKey = limitersMap.keys().next().value;
      if (oldestKey) limitersMap.delete(oldestKey);
    }
    limiter = createRateLimiter(tenantId, planCode);
    limitersMap.set(key, limiter);
  }
  return limiter(req, res, next);
};


module.exports = { apiRateLimiter };