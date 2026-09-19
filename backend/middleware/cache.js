const { getSharedRedisClient } = require('../utils/redisClient');
const logger = require('../utils/logger');

const CACHE_TTL = parseInt(process.env.CACHE_TTL, 10) || 60;

let client = getSharedRedisClient();
let useRedis = false;
const memoryCache = new Map();
const memoryTTL = new Map();

const MEMORY_CACHE_MAX_SIZE = 10000;

if (client) {
  if (client.status === 'ready') {
    useRedis = true;
  }
  client.on('ready', () => {
    useRedis = true;
  });
  client.on('error', (err) => {
    if (useRedis) {
      logger.warn('Redis connection error in cache, falling back to in-memory', { error: err.message });
      useRedis = false;
    }
  });
  client.on('close', () => {
    useRedis = false;
  });
} else {
  logger.info('No REDIS_URL set, using in-memory cache');
}

// Periodic cleanup of expired in-memory cache items
setInterval(() => {
  const now = Date.now();
  for (const [key, expiry] of memoryTTL.entries()) {
    if (expiry <= now) {
      memoryCache.delete(key);
      memoryTTL.delete(key);
    }
  }
}, 30000);


let hits = 0;
let misses = 0;

async function get(key) {
  let val = null;
  if (useRedis && client) {
    try {
      const raw = await client.get(key);
      val = raw ? JSON.parse(raw) : null;
    } catch (err) {
      logger.warn('Redis GET failed, falling back to memory', { key, error: err.message });
      val = null;
    }
  }

  // Check in-memory cache if Redis missed or unavailable
  if (val === null) {
    if (memoryTTL.has(key)) {
      if (memoryTTL.get(key) <= Date.now()) {
        memoryCache.delete(key);
        memoryTTL.delete(key);
        val = null;
      } else {
        val = memoryCache.get(key) || null;
      }
    } else {
      val = memoryCache.get(key) || null;
    }
  }

  if (val !== null) {
    hits++;
  } else {
    misses++;
  }
  return val;
}

function getStats() {
  const total = hits + misses;
  const hitRate = total > 0 ? ((hits / total) * 100).toFixed(2) : "0.00";
  return {
    hits,
    misses,
    totalRequests: total,
    hitRatePercentage: parseFloat(hitRate),
    backend: useRedis ? "redis" : "memory",
  };
}

async function set(key, value, ttl = CACHE_TTL) {
  if (useRedis && client) {
    try {
      const data = JSON.stringify(value);
      await client.setex(key, ttl, data);
      return;
    } catch (err) {
      logger.warn('Redis SET failed, falling back to memory', { key, error: err.message });
    }
  }

  // LRU / FIFO eviction when reaching MAX_SIZE
  if (memoryCache.size >= MEMORY_CACHE_MAX_SIZE) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey) {
      memoryCache.delete(oldestKey);
      memoryTTL.delete(oldestKey);
    }
  }

  memoryCache.set(key, value);
  memoryTTL.set(key, Date.now() + ttl * 1000);
}

async function del(key) {
  if (useRedis && client) {
    try {
      await client.del(key);
    } catch (err) {
      logger.warn('Redis DEL failed', { key, error: err.message });
    }
  }
  memoryCache.delete(key);
  memoryTTL.delete(key);
}

async function delPattern(pattern) {
  if (useRedis && client) {
    try {
      const stream = client.scanStream({ match: pattern, count: 100 });
      for await (const keys of stream) {
        if (keys.length) await client.del(keys);
      }
    } catch (err) {
      logger.warn('Redis DELPATTERN failed', { pattern, error: err.message });
    }
  }
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
  for (const key of memoryCache.keys()) {
    if (regex.test(key)) {
      memoryCache.delete(key);
      memoryTTL.delete(key);
    }
  }
}

function cacheMiddleware(prefix, ttl = CACHE_TTL) {
  return async (req, res, next) => {
    if (req.method !== 'GET') return next();

    const key = `${prefix}:${req.tenantId || 'public'}:${req.originalUrl}`;
    const cached = await get(key);
    if (cached) {
      return res.status(200).json(cached);
    }

    const originalJson = res.json.bind(res);
    res.json = function (body) {
      if (res.statusCode === 200) {
        set(key, body, ttl).catch(() => {});
      }
      return originalJson(body);
    };
    next();
  };
}

async function close() {
  if (client && useRedis) {
    try {
      await client.quit();
    } catch (e) {
      try { client.disconnect(); } catch (err) {}
    }
  }
}

module.exports = { get, set, del, delPattern, cacheMiddleware, getStats, close, client };

