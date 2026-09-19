const crypto = require('crypto');

const isProd = process.env.NODE_ENV === 'production';
const sameSiteSetting = isProd ? (process.env.COOKIE_SAME_SITE || 'none') : 'lax';
const isSecure = isProd && sameSiteSetting === 'none' ? true : isProd;

const cookieConfig = {
  access: {
    maxAge: 15 * 60 * 1000, // 15 minutes
    httpOnly: true,
    secure: isSecure,
    sameSite: sameSiteSetting,
    path: '/',
  },
  refresh: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    httpOnly: true,
    secure: isSecure,
    sameSite: sameSiteSetting,
    path: '/', // Set to '/' so /api/auth/refresh and any proxied routes match reliably
  },
  xsrf: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    httpOnly: false, // Must be readable by frontend JS via document.cookie
    secure: isSecure,
    sameSite: sameSiteSetting,
    path: '/',
  },
};

/**
 * Set access + refresh + xsrf cookies on response.
 * @param {import('express').Response} res
 * @param {string} accessJwt
 * @param {string} refreshTokenRaw
 * @param {string} [xsrfToken]
 */
function setAuthCookies(res, accessJwt, refreshTokenRaw, xsrfToken) {
  if (accessJwt) {
    res.cookie('accessToken', accessJwt, cookieConfig.access);
  }
  if (refreshTokenRaw) {
    res.cookie('refreshToken', refreshTokenRaw, cookieConfig.refresh);
  }
  if (xsrfToken) {
    res.cookie('XSRF-TOKEN', xsrfToken, cookieConfig.xsrf);
  }
}

/**
 * Clear all auth cookies on response (logout).
 * @param {import('express').Response} res
 */
function clearAuthCookies(res) {
  res.clearCookie('accessToken', { ...cookieConfig.access, maxAge: 0 });
  res.clearCookie('refreshToken', { ...cookieConfig.refresh, maxAge: 0 });
  res.clearCookie('XSRF-TOKEN', { ...cookieConfig.xsrf, maxAge: 0 });
}

/**
 * Read refresh token from request cookies or body fallback (for mobile/backward compatibility).
 * @param {import('express').Request} req
 * @returns {string | undefined}
 */
function getRefreshTokenFromCookie(req) {
  return req.cookies?.refreshToken || req.body?.refreshToken;
}

/**
 * Generate a random XSRF token (128-bit hex string).
 * @returns {string}
 */
function generateXsrfToken() {
  return crypto.randomBytes(16).toString('hex');
}

module.exports = {
  cookieConfig,
  setAuthCookies,
  clearAuthCookies,
  getRefreshTokenFromCookie,
  generateXsrfToken,
};
