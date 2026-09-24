/**
 * Demo Guard Middleware
 *
 * Enforces sandbox write policy and prevents production side effects
 * for requests originating from a demo session or against the demo tenant.
 */

const logger = require('../utils/logger');

// Paths strictly forbidden in demo mode
const BLOCKED_PREFIXES = [
  '/api/billing',
  '/api/tenant/plan',
  '/api/tenant/subscription',
  '/api/tenant/delete',
  '/api/auth/change-password',
  '/api/auth/2fa',
  '/api/super-admin',
];

function demoGuard(req, res, next) {
  const isDemoSession = Boolean(req.user?.demo || req.tenant?.isDemo);

  if (!isDemoSession) {
    return next();
  }

  const method = req.method.toUpperCase();

  // Read-only operations are always safe
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return next();
  }

  const path = req.originalUrl || req.path || '';

  // 1. Strictly block financial, administrative, and security mutations
  if (BLOCKED_PREFIXES.some(prefix => path.startsWith(prefix))) {
    logger.warn(`[DemoGuard] Blocked forbidden action in demo mode: ${method} ${path}`);
    return res.status(403).json({
      success: false,
      code: 'DEMO_ACTION_BLOCKED',
      message: 'This administrative or billing action is disabled in the Demo Sandbox.',
      isDemoBlocked: true,
    });
  }

  // 2. Allow auth logout and demo release
  if (path.startsWith('/api/auth/logout') || path.startsWith('/api/demo/release')) {
    return next();
  }

  // 3. For any other write mutation reaching the backend on demo tenant:
  // Intercept and return simulated success so database records remain completely untouched.
  logger.info(`[DemoGuard] Simulated mutating action in demo mode: ${method} ${path}`);
  return res.status(200).json({
    success: true,
    message: 'Action simulated successfully in Demo Sandbox (database unchanged).',
    isDemoSimulated: true,
    data: req.body,
    simulatedAt: new Date().toISOString(),
  });
}

module.exports = demoGuard;
