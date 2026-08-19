const speakeasy = require('speakeasy');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Middleware enforcing 2FA token verification for sensitive admin / super_admin routes.
 */
const require2FA = async (req, res, next) => {
  try {
    const userId = req.user?.userId || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const user = await User.findById(userId).select('twoFactorEnabled twoFactorSecret role');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // If 2FA is enabled for this user, verify the TOTP token from header or body
    if (user.twoFactorEnabled) {
      const twoFactorToken = req.headers['x-2fa-token'] || req.body?.twoFactorCode;
      if (!twoFactorToken) {
        return res.status(401).json({
          success: false,
          twoFactorRequired: true,
          message: '2FA verification code required in x-2fa-token header or twoFactorCode field',
        });
      }

      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: String(twoFactorToken).trim(),
        window: 2,
      });

      if (!verified) {
        return res.status(401).json({
          success: false,
          twoFactorRequired: true,
          message: 'Invalid 2FA verification code',
        });
      }
    }

    next();
  } catch (error) {
    logger.error('require2FA middleware error', { error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error during 2FA check' });
  }
};

module.exports = { require2FA };
