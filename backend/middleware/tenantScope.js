const logger = require('../utils/logger');

/**
 * TENANT SCOPE MIDDLEWARE
 * Automatically injects tenantId into req.query for all non-super-admin
 * requests. This ensures every downstream query is tenant-scoped by
 * default, preventing cross-tenant data leaks.
 *
 * Super admins and routes that explicitly set skipTenantScope = true
 * are excluded.
 */
const tenantScope = (req, res, next) => {
  try {
    if (!req.user) {
      return next();
    }

    // Super admins operate across tenants — no scoping
    if (req.user.role === 'super_admin') {
      return next();
    }

    // Allow individual routes to opt out
    if (req.skipTenantScope) {
      return next();
    }

    const tenantId = req.user.tenantId || req.tenantId;
    if (!tenantId) {
      logger.warn('tenantScope: No tenantId found for non-super-admin user', {
        userId: req.user._id || req.user.id,
        role: req.user.role,
      });
      return res.status(403).json({
        success: false,
        message: 'Tenant context is required for this request',
      });
    }

    // Inject tenantId into query params so Mongoose queries can filter
    req.query.tenantId = tenantId.toString();

    // Also make it available on req for controllers that read req.body
    req.scopedTenantId = tenantId;

    next();
  } catch (error) {
    logger.error('tenantScope error', { message: error.message });
    next(error);
  }
};

module.exports = { tenantScope };
