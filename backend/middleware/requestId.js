const crypto = require('crypto');

/**
 * REQUEST ID MIDDLEWARE
 * Generates a unique requestId (or preserves incoming X-Request-ID header)
 * and attaches it to req.requestId, req.id, and res header X-Request-ID.
 */
const requestIdMiddleware = (req, res, next) => {
  const incomingId = req.headers['x-request-id'];
  const requestId = incomingId || crypto.randomUUID();

  req.requestId = requestId;
  req.id = requestId;
  res.setHeader('X-Request-ID', requestId);

  next();
};

module.exports = requestIdMiddleware;
