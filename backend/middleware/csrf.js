/**
 * CSRF protection via double-submit cookie.
 *
 * Safe methods (GET, HEAD, OPTIONS) are exempt.
 * Public auth and landing endpoints that establish sessions are exempt.
 * If authentication is cookie-based, mutating requests must provide a matching X-XSRF-TOKEN header.
 */
function csrfProtection(req, res, next) {
  const method = req.method.toLowerCase();
  if (['get', 'head', 'options'].includes(method)) {
    return next();
  }

  // Exempt public auth endpoints, session bootstrap flows, and public tenant registration
  const exemptPrefixes = [
    '/api/auth/login',
    '/api/auth/super-admin/login',
    '/api/auth/student/register',
    '/api/auth/teacher/first-login',
    '/api/auth/parent/login',
    '/api/auth/parent-login',
    '/api/auth/mobile/login',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/auth/verify-email',
    '/api/auth/send-verification-email',
    '/api/auth/refresh',
    '/api/auth/logout',
    '/api/auth/2fa/setup',
    '/api/auth/2fa/verify',
    '/api/tenant/register',
    '/api/landing',
    '/api/demo',
    '/demo',
  ];

  const rawPath = req.originalUrl || req.path || '';
  const path = rawPath.replace(/^\/api\/api/, '/api');
  if (exemptPrefixes.some((prefix) => path.startsWith(prefix) || rawPath.startsWith(prefix))) {
    return next();
  }

  // If request has no cookies at all, and is using pure Authorization header (e.g. mobile app), allow
  const hasAuthCookie = Boolean(req.cookies?.accessToken || req.cookies?.refreshToken);
  const authHeader = req.headers.authorization;
  if (!hasAuthCookie && authHeader && authHeader.startsWith('Bearer ')) {
    return next();
  }

  const cookieToken = req.cookies?.['XSRF-TOKEN'];
  const headerToken = req.headers['x-xsrf-token'] || req.headers['X-XSRF-TOKEN'];

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or missing CSRF token',
      code: 'CSRF_INVALID',
    });
  }

  next();
}

module.exports = csrfProtection;
