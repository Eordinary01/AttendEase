const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const cache = require('./cache');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * AUTHENTICATE TOKEN
 * Verifies JWT token and attaches full user object to request
 * Now includes tenant information
 */
const authenticateToken = async (req, res, next) => {
  try {
    // Get the token from the Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      logger.warn('No token provided');
      return res.status(401).json({ 
        success: false,
        message: 'Authorization token missing' 
      });
    }

    // Verify the token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Extract user ID from token
    let userId;
    if (decoded.userId) {
      userId = decoded.userId;
    } else if (decoded.id) {
      userId = decoded.id;
    } else if (decoded._id) {
      userId = decoded._id;
    } else {
      return res.status(403).json({ 
        success: false,
        message: 'Token missing user identifier' 
      });
    }

    // Extract tenantId from token (if present)
    const tokenTenantId = decoded.tenantId;

    // Find the user associated with the token (cached with 30s TTL)
    const userCacheKey = `user:${userId}`;
    let user = await cache.get(userCacheKey);
    if (!user) {
      user = await User.findById(userId).select('-password').lean();
      if (user) await cache.set(userCacheKey, user, 30);
    }

    if (!user) {
      logger.warn('User not found', { userId });
      return res.status(403).json({ 
        success: false,
        message: 'Invalid token - user not found' 
      });
    }

    // Check if account is active
    if (!user.isActive) {
      logger.warn('Deactivated user attempted access', { userId });
      return res.status(403).json({
        success: false,
        message: 'This account has been deactivated. Contact your administrator.'
      });
    }

    // Verify tenant match (if token has tenantId)
    if (tokenTenantId && user.tenantId && tokenTenantId.toString() !== user.tenantId.toString()) {
      logger.warn('Tenant mismatch', { tokenTenantId, userTenantId: user.tenantId });
      return res.status(403).json({ 
        success: false,
        message: 'Tenant mismatch - invalid access' 
      });
    }

    // Verify token version (invalidates sessions on logout-all)
    if (decoded.tokenVersion !== undefined && user.tokenVersion > decoded.tokenVersion) {
      logger.warn('Token version mismatch - session invalidated', { userId: user._id });
      return res.status(403).json({
        success: false,
        message: 'Session has been invalidated. Please log in again.'
      });
    }

    // Get tenant info if available (cached)
    let tenantInfo = null;
    if (user.tenantId) {
      const cacheKey = `tenant:${user.tenantId}`;
      let tenant = await cache.get(cacheKey);
      if (!tenant) {
        tenant = await Tenant.findById(user.tenantId).select('name subdomain branding subscription.plan subscription.status subscription.trialEndsAt').lean();
        if (tenant) await cache.set(cacheKey, tenant, 30);
      }
      if (tenant) {
        tenantInfo = {
          id: tenant._id,
          name: tenant.name,
          subdomain: tenant.subdomain,
          branding: tenant.branding,
          plan: tenant.subscription.plan,
          subscriptionStatus: tenant.subscription.status
        };

        const bypassPaths = [
          '/api/billing/plans',
          '/api/billing/continue-free',
          '/api/billing/webhook',
          '/api/super-admin',
          '/api/admin/super',
          '/api/support',
          '/api/tenant/info',
          '/api/auth/tenant-info'
        ];

        const isBypassed = (req.originalUrl && bypassPaths.some(p => req.originalUrl.startsWith(p))) || user.role === 'superadmin';

        if (!isBypassed) {
          if (tenant.subscription.status !== 'active' && tenant.subscription.status !== 'trial') {
            const isExpired = tenant.subscription.status === 'expired';
            return res.status(403).json({
              success: false,
              message: isExpired ? 'Your trial has expired. Please upgrade to continue.' : `Your institution's subscription is ${tenant.subscription.status}. Please contact administrator.`,
              subscriptionStatus: tenant.subscription.status,
              upgradeRequired: isExpired
            });
          }

          if (tenant.subscription.plan === 'free' && tenant.subscription.trialEndsAt && new Date(tenant.subscription.trialEndsAt) < new Date()) {
            await Tenant.findByIdAndUpdate(user.tenantId, {
              'subscription.status': 'expired'
            });
            await cache.del(cacheKey);

            return res.status(403).json({
              success: false,
              message: 'Your trial has expired. Please upgrade to continue.',
              upgradeRequired: true,
              subscriptionStatus: 'expired'
            });
          }
        }
      }
    }

    // Add user and tenant info to request object
    req.user = {
      _id: user._id,
      id: user._id,
      userId: user._id,
      name: user.name,
      email: user.email,
      role: decoded.accessMode === 'parent' ? 'parent' : user.role,
      studentRole: user.role,
      section: user.section,
      rollNo: user.rollNo,
      tenantId: user.tenantId,
      isActive: user.isActive,
      isFirstLogin: user.isFirstLogin,
      assignedSubjects: user.assignedSubjects,
      loginCount: user.loginCount,
      accessMode: decoded.accessMode || undefined,
      customRoles: user.customRoles,
      // Academic context used by student/parent auto-scoping in controllers
      // (timetable, attendance). Without these, controllers fall back to the
      // Enrollment record, which can be stale (e.g. an old semester), hiding
      // valid timetable entries from the student.
      courseId: user.courseId,
      courseName: user.courseName,
      branch: user.branch,
      semester: user.semester,
    };
    
    // Attach tenant info separately for convenience
    req.tenant = tenantInfo;
    req.tenantId = user.tenantId;

    // Auto-scope tenant: inject tenantId into req.query for non-super-admins
    // so downstream Mongoose queries can filter by tenant by default.
    if (req.user.role !== 'super_admin' && user.tenantId) {
      req.query.tenantId = user.tenantId.toString();
      req.scopedTenantId = user.tenantId;
    }
    
    logger.debug('User authenticated', { id: user._id, role: user.role, tenantId: user.tenantId });

    next();
  } catch (error) {
    logger.error('Error authenticating token', { message: error.message });
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid token format',
        code: 'TOKEN_INVALID'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false,
        message: 'Token expired',
        expiredAt: error.expiredAt,
        code: 'TOKEN_EXPIRED'
      });
    }
    
    return res.status(401).json({ 
      success: false,
      message: 'Invalid or expired token',
      code: 'TOKEN_INVALID',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * ADMIN AUTHORIZATION (Tenant Admin)
 * Checks if authenticated user is a tenant admin
 * MUST be used AFTER authenticateToken middleware
 */
const adminAuth = (req, res, next) => {
  try {
    // Check if user is attached from authenticateToken
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        message: 'Authentication required' 
      });
    }

    logger.debug('Admin role check', { role: req.user.role });

    // Check if user role is admin or super_admin
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ 
        success: false,
        message: 'Admin access required. Only tenant admins can access this resource.',
        userRole: req.user.role 
      });
    }

    next();
  } catch (error) {
    logger.error('Error in adminAuth', { error: error.message });
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

/**
 * SUPER ADMIN AUTHORIZATION
 * Checks if authenticated user is a super admin (platform admin)
 * MUST be used AFTER authenticateToken middleware
 */
const superAdminAuth = (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        message: 'Authentication required' 
      });
    }

    logger.debug('Super admin role check', { role: req.user.role });

    // Check if user role is super_admin
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ 
        success: false,
        message: 'Super admin access required',
        userRole: req.user.role 
      });
    }

    next();
  } catch (error) {
    logger.error('Error in superAdminAuth', { error: error.message });
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

const teacherAuth = (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        message: 'Authentication required' 
      });
    }

    if (req.user.role !== 'teacher') {
      return res.status(403).json({ 
        success: false,
        message: 'Teacher access required' 
      });
    }

    next();
  } catch (error) {
    logger.error('Error in teacherAuth', { error: error.message });
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

const parentAuth = (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (req.user.accessMode !== 'parent' && req.user.role !== 'parent') {
      return res.status(403).json({
        success: false,
        message: 'Parent access required'
      });
    }

    next();
  } catch (error) {
    logger.error('Error in parentAuth', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

const studentAuth = (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        message: 'Authentication required' 
      });
    }

    if (req.user.role !== 'student' && req.user.studentRole !== 'student') {
      return res.status(403).json({ 
        success: false,
        message: 'Student access required' 
      });
    }

    next();
  } catch (error) {
    logger.error('Error in studentAuth', { error: error.message });
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

/**
 * ROLE AUTHORIZATION (Flexible Multi-Role Guard)
 * Usage: authorizeRoles('admin', 'teacher') OR authorizeRoles(['admin', 'teacher'])
 * Note: 'super_admin' automatically passes all authorizeRoles checks for support/admin scenarios.
 */
const authorizeRoles = (...roles) => {
  const allowedRoles = Array.isArray(roles[0]) ? roles[0] : roles;
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ 
          success: false,
          message: 'Authentication required' 
        });
      }

      const effectiveRole = req.user.role;
      const underlyingRole = req.user.studentRole || req.user.role;

      if (
        req.user.role !== 'super_admin' &&
        !allowedRoles.includes(effectiveRole) &&
        !allowedRoles.includes(underlyingRole)
      ) {
        return res.status(403).json({ 
          success: false,
          message: `Access denied. Required roles: ${allowedRoles.join(', ')}`,
          userRole: req.user.role
        });
      }

      next();
    } catch (error) {
      logger.error('Error in role authorization', { error: error.message });
      res.status(500).json({ 
        success: false,
        message: 'Server error' 
      });
    }
  };
};

const getTenantFromRequest = async (req) => {
  try {
    const host = req.headers.host;
    const tenantId = req.headers['x-tenant-id'];
    
    if (tenantId && mongoose.Types.ObjectId.isValid(tenantId)) {
      const tenant = await Tenant.findById(tenantId);
      if (tenant) return tenant;
    }
    
    const subdomainMatch = host?.match(/^([^.]+)\./);
    if (subdomainMatch && !['www', 'app', 'api'].includes(subdomainMatch[1])) {
      const subdomain = subdomainMatch[1];
      const tenant = await Tenant.findOne({ 
        $or: [
          { subdomain: subdomain },
          { domain: host }
        ]
      });
      if (tenant) return tenant;
    }

    const isDevOrTest = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test' || !process.env.NODE_ENV;
    if (isDevOrTest && (host?.includes('localhost') || host?.includes('127.0.0.1'))) {
      const devTenant = await Tenant.findOne({ subdomain: 'default' }) || await Tenant.findOne().sort({ createdAt: -1 });
      if (devTenant) return devTenant;
    }
    
    return null;
  } catch (error) {
    logger.error('Error getting tenant', { error: error.message });
    return null;
  }
};

const resolveTenant = async (req, res, next) => {
  try {
    const tenant = await getTenantFromRequest(req);
    if (tenant) {
      req.tenant = tenant;
      req.tenantId = tenant._id;
    }
    next();
  } catch (error) {
    logger.error('Error resolving tenant', { error: error.message });
    next();
  }
};

const requireTenant = async (req, res, next) => {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found. Please check your domain configuration.'
      });
    }
    req.tenant = tenant;
    req.tenantId = tenant._id;
    next();
  } catch (error) {
    logger.error('Error in requireTenant', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Export all middleware functions
module.exports = {
  authenticateToken,
  adminAuth,
  superAdminAuth,
  teacherAuth,
  studentAuth,
  parentAuth,
  authorizeRoles,
  resolveTenant,
  requireTenant,
  getTenantFromRequest
};