const Redis = require('ioredis');
const logger = require('./logger');

const REDIS_URL = process.env.REDIS_URL;
const REDIS_TLS_CA = process.env.REDIS_TLS_CA;

let sharedClient = null;
let isConnecting = false;

function getRedisOptions() {
  if (!REDIS_URL) return null;

  const isTls = REDIS_URL.startsWith('rediss://') || REDIS_URL.includes('upstash.io');
  let tlsConfig = undefined;
  if (isTls) {
    tlsConfig = {
      rejectUnauthorized: !REDIS_TLS_CA ? false : true,
      ...(REDIS_TLS_CA ? { ca: require('fs').readFileSync(REDIS_TLS_CA) } : {})
    };
  }

  return {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    autoResubscribe: false,
    lazyConnect: true,
    retryStrategy(times) {
      if (times > 3) return null;
      return Math.min(times * 200, 1000);
    },
    ...(tlsConfig ? { tls: tlsConfig } : {})
  };
}

function getSharedRedisClient() {
  if (!REDIS_URL) {
    return null;
  }

  if (sharedClient) {
    return sharedClient;
  }

  try {
    const options = getRedisOptions();
    sharedClient = new Redis(REDIS_URL, options);

    sharedClient.on('error', (err) => {
      logger.warn('Shared Redis connection error', { error: err.message });
    });

    sharedClient.on('connect', () => {
      logger.info('Shared Redis connected');
    });

    if (!isConnecting) {
      isConnecting = true;
      sharedClient.connect().catch((err) => {
        logger.warn('Shared Redis connection failed', { error: err.message });
      }).finally(() => {
        isConnecting = false;
      });
    }

    return sharedClient;
  } catch (error) {
    logger.warn('Failed to initialize shared Redis client', { error: error.message });
    return null;
  }
}

function createDedicatedRedisClient(overrides = {}) {
  if (!REDIS_URL) return null;
  const baseOptions = getRedisOptions();
  const client = new Redis(REDIS_URL, {
    ...baseOptions,
    ...overrides
  });
  client.on('error', (err) => {
    logger.warn('Dedicated Redis client connection error', { error: err.message });
  });
  return client;
}

function createBullRedisClient(type) {
  // Bull requires dedicated connection instances for subscriber and bclient (blocking commands)
  // but can reuse the shared client for regular queue commands
  if (type === 'client') {
    const shared = getSharedRedisClient();
    if (shared) return shared;
  }
  return createDedicatedRedisClient({
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  });
}

module.exports = {
  getSharedRedisClient,
  getRedisOptions,
  createDedicatedRedisClient,
  createBullRedisClient
};

