const APILog = require('../models/APILog');
const logger = require('../utils/logger');

const sampleRate = Math.min(1, Math.max(0, parseFloat(process.env.API_LOG_SAMPLE_RATE) || (process.env.NODE_ENV === 'production' ? 0.5 : 1)));
let counter = 0;

// Endpoints the monitoring dashboard polls — skip logging them to avoid
// the dashboard's own polling polluting the live activity feed.
const SKIP_PATHS = ['/super/logs', '/super/activity'];

const describeRequest = (method, url) => {
  let path = (url || '').split('?')[0].replace(/^\/api\//, '');
  path = path
    .replace(/\/[0-9a-f]{24}/gi, '/:id')
    .replace(/\/[0-9]+(\/|$)/g, '/:id$1');
  const verb = { GET: 'Viewed', POST: 'Created', PUT: 'Updated', PATCH: 'Updated', DELETE: 'Deleted' }[method] || method;
  return `${verb} ${path.replace(/\//g, ' · ')}`;
};

const apiLogger = async (req, res, next) => {
  const startTime = Date.now();
  const originalEnd = res.end;

  res.end = function (chunk, encoding) {
    const responseTime = Date.now() - startTime;
    originalEnd.call(this, chunk, encoding);

    const url = req.originalUrl || req.url;
    if (req.path === '/health' || req.path === '/') return;
    if (SKIP_PATHS.some((p) => url.includes(p))) return;
    if (sampleRate < 1) {
      counter = (counter + 1) % 1000;
      if (counter >= sampleRate * 1000) return;
    }

    APILog.create({
      tenantId: req.tenantId,
      userId: req.user?._id,
      endpoint: req.originalUrl || req.url,
      method: req.method,
      description: res.locals.logDescription || describeRequest(req.method, req.originalUrl),
      statusCode: res.statusCode,
      responseTime: responseTime,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.requestId || req.headers['x-request-id']
    }).catch(() => {});
  };

  next();
};

module.exports = { apiLogger };
