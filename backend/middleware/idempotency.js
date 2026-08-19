const cache = require('./cache');
const logger = require('../utils/logger');

const idempotency = (ttlSeconds = 86400) => {
  return async (req, res, next) => {
    const idempotencyKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];

    if (!idempotencyKey) {
      return next();
    }

    const tenantId = req.user?.tenantId || req.user?._id || 'global';
    const cacheKey = `idempotency:${tenantId}:${req.path}:${idempotencyKey}`;

    try {
      const cached = await cache.get(cacheKey);
      if (cached) {
        logger.info('Returning cached idempotent response', { key: idempotencyKey, path: req.path });
        return res.status(cached.status || 200).json(cached.body);
      }

      // Intercept res.json to cache response before sending
      const originalJson = res.json.bind(res);
      res.json = (body) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          cache.set(cacheKey, { status: res.statusCode, body }, ttlSeconds).catch(() => {});
        }
        return originalJson(body);
      };

      next();
    } catch (err) {
      logger.error('Idempotency middleware error', { error: err.message });
      next();
    }
  };
};

module.exports = idempotency;
