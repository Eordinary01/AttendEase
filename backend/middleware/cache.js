const redis = require('ioredis');
const logger = require('../utils/logger');

const REDIS_URL = process.env.REDIS_URL;
const CACHE_TTL = parseInt(process.env.CACHE_TTL, 10) || 60;
const REDIS_TLS_CA = process.env.REDIS_TLS_CA; // Optional: path to CA cert for self-signed Redis

let client = null;
let useRedis = false;
const memoryCache = new Map();
const memoryTTL = new Map();

const MEMORY_CACHE_MAX_SIZE = 10000;

if (REDIS_URL) {
  const isTls = REDIS_URL.startsWith('rediss://') || REDIS_URL.includes('upstash.io');
  const tlsConfig = isTls ? {
    rejectUnauthorized: !REDIS_TLS_CA,
    ...(REDIS_TLS_CA ? { ca: require('fs').readFileSync(REDIS_TLS_CA) } : {})
  } : undefined;

  client = new redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    autoResubscribe: false,
    retryStrategy(times) {
      if (times > 3) return null;
      return Math.min(times * 200, 1000);
    },
    lazyConnect: true,
    ...(tlsConfig ? { tls: tlsConfig } : {})
  });

  client.on('error', (err) => {
    if (useRedis) {
      logger.warn('Redis connection error, falling back to in-memory', { error: err.message });
      useRedis = false;
    }
  });

  client.connect().then(() => {
    useRedis = true;
    logger.info('Redis connected');
  }).catch((err) => {
    logger.warn('Redis connection failed, using in-memory cache', { error: err.message });
    useRedis = false;
    try { client.disconnect(); } catch (e) {}
  });
} else {
  logger.info('No REDIS_URL set, using in-memory cache');
  setInterval(() => {
    const now = Date.now();
    for (const [key, expiry] of memoryTTL.entries()) {
      if (expiry <= now) {
        memoryCache.delete(key);
        memoryTTL.delete(key);
      }
    }
  }, 30000);
}

let hits = 0;
let misses = 0;

async function get(key) {
  let val = null;
  if (useRedis && client) {
    const raw = await client.get(key);
    val = raw ? JSON.parse(raw) : null;
  } else if (memoryTTL.has(key) && memoryTTL.get(key) <= Date.now()) {
    memoryCache.delete(key);
    memoryTTL.delete(key);
    val = null;
  } else {
    val = memoryCache.get(key) || null;
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
    const data = JSON.stringify(value);
    await client.setex(key, ttl, data);
    return;
  }
  if (memoryCache.size >= MEMORY_CACHE_MAX_SIZE) {
    return;
  }
  memoryCache.set(key, value);
  memoryTTL.set(key, Date.now() + ttl * 1000);
}

async function del(key) {
  if (useRedis && client) {
    await client.del(key);
    return;
  }
  memoryCache.delete(key);
  memoryTTL.delete(key);
}

async function delPattern(pattern) {
  if (useRedis && client) {
    const stream = client.scanStream({ match: pattern, count: 100 });
    for await (const keys of stream) {
      if (keys.length) await client.del(keys);
    }
    return;
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

