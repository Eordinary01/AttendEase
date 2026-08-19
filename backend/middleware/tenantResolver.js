const Tenant = require('../models/Tenant');
const cache = require('./cache');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const tenantResolver = async (req, res, next) => {
  const skipPaths = [
    '/api/auth/login', '/api/auth/super-admin/login',
    '/api/tenant/register', '/api/landing',
    '/api/billing/plans',
    '/api/super-admin', '/api/admin/super', '/api/admin/plans',
  ];
  if (skipPaths.some(path => req.originalUrl?.startsWith(path) || req.path?.startsWith(path))) {
    return next();
  }

  try {
    let tenant = null;
    const host = req.headers.host;
    const tenantId = req.headers['x-tenant-id'];
    let cacheKey = null;

    const mongoose = require('mongoose');

    // Extract payload from JWT if provided
    let jwtPayload = null;
    let hasJwt = false;
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
      hasJwt = true;
      try {
        jwtPayload = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
      } catch (e) {
        jwtPayload = null;
      }
    }

    // Super admin platform requests without a specific tenant context
    if (jwtPayload?.role === 'super_admin' && !tenantId && !jwtPayload?.tenantId) {
      req.tenant = null;
      req.tenantId = null;
      return next();
    }

    // ------------------------------------------------------------------
    // TENANT ISOLATION RESOLUTION MATRIX (SECURITY GUARANTEED)
    // ------------------------------------------------------------------

    // Case A: Authenticated User (Non-SuperAdmin) -> Strict Tenant Isolation
    if (hasJwt && jwtPayload && jwtPayload.role !== 'super_admin') {
      const jwtTenantId = jwtPayload.tenantId;
      if (!jwtTenantId || !mongoose.Types.ObjectId.isValid(jwtTenantId)) {
        return res.status(401).json({
          success: false,
          message: 'Invalid tenant session in security token. Please log in again.',
          code: 'INVALID_TENANT_SESSION',
        });
      }

      cacheKey = `tenant:${jwtTenantId}`;
      tenant = await cache.get(cacheKey);
      if (!tenant) {
        tenant = await Tenant.findById(jwtTenantId).lean();
        if (tenant) await cache.set(cacheKey, tenant, 30);
      }

      // SECURITY GUARANTEE: An authenticated user MUST strictly resolve to THEIR tenant.
      // If their tenant was deleted or re-seeded in DB, fail with 401 to clear stale token.
      if (!tenant) {
        return res.status(401).json({
          success: false,
          message: 'Your institution account is no longer active or has been removed. Please log in again.',
          code: 'INVALID_TENANT_SESSION',
        });
      }
    }

    // Case B: Super Admin with tenantId in header or JWT
    else if (jwtPayload?.role === 'super_admin') {
      const targetId = tenantId || jwtPayload.tenantId;
      if (targetId && mongoose.Types.ObjectId.isValid(targetId)) {
        cacheKey = `tenant:${targetId}`;
        tenant = await cache.get(cacheKey);
        if (!tenant) {
          tenant = await Tenant.findById(targetId).lean();
          if (tenant) await cache.set(cacheKey, tenant, 30);
        }
      }
    }

    // Case C: Unauthenticated Requests (Header, Subdomain, or Localhost Dev Fallback)
    else {
      // C1: Check x-tenant-id header
      if (tenantId && mongoose.Types.ObjectId.isValid(tenantId)) {
        cacheKey = `tenant:${tenantId}`;
        tenant = await cache.get(cacheKey);
        if (!tenant) {
          tenant = await Tenant.findById(tenantId).lean();
          if (tenant) await cache.set(cacheKey, tenant, 30);
        }
      }

      // C2: Check Subdomain
      if (!tenant) {
        const subdomainMatch = host?.match(/^([^.]+)\./);
        if (subdomainMatch) {
          const subdomain = subdomainMatch[1];
          if (!['www', 'app', 'api'].includes(subdomain)) {
            cacheKey = `tenant:subdomain:${subdomain}`;
            tenant = await cache.get(cacheKey);
            if (!tenant) {
              tenant = await Tenant.findOne({ subdomain }).lean();
              if (tenant) await cache.set(cacheKey, tenant, 30);
            }
          }
        }
      }

      // C3: Development / Localhost Fallback for Unauthenticated Requests
      const isDevOrTest = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test' || !process.env.NODE_ENV;
      if (!tenant && isDevOrTest && (host?.includes('localhost') || host?.includes('127.0.0.1'))) {
        tenant = await Tenant.findOne({ subdomain: 'default' }).lean();
        if (!tenant) {
          tenant = await Tenant.findOne().sort({ createdAt: -1 }).lean();
        }
        if (tenant) cacheKey = `tenant:${tenant._id}`;
      }
    }

    const isDevOrTest = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
    if (!tenant) {
      return res.status(404).json({ 
        success: false,
        message: `Tenant not found. Please check your domain configuration. Host: ${host}`,
        ...(isDevOrTest && {
          availableTenants: await Tenant.find({}, { subdomain: 1, name: 1 })
        })
      });
    }

    if (tenant.subscription.status !== 'active' && tenant.subscription.status !== 'trial') {
      const isExpired = tenant.subscription.status === 'expired';
      return res.status(403).json({
        success: false,
        message: isExpired ? 'Your trial has expired. Please upgrade to continue.' : `Your account is ${tenant.subscription.status}. Please contact support.`,
        status: tenant.subscription.status,
        subscriptionStatus: tenant.subscription.status,
        upgradeRequired: isExpired
      });
    }

    if (tenant.subscription.plan === 'free' && tenant.subscription.trialEndsAt && new Date(tenant.subscription.trialEndsAt) < new Date()) {
      await Tenant.findByIdAndUpdate(tenant._id, { 'subscription.status': 'expired' });
      if (cacheKey) await cache.del(cacheKey);
      return res.status(403).json({
        success: false,
        message: 'Your trial has expired. Please upgrade to continue.',
        upgradeRequired: true,
        subscriptionStatus: 'expired'
      });
    }

    const { getEffectiveLimits } = require('../utils/planDefaults');
    tenant.limits = getEffectiveLimits(tenant.subscription?.plan, tenant.limits);
    req.tenant = tenant;
    req.tenantId = tenant._id;

    // Enforce tenant isolation: prevent non-super-admins from spoofing tenantId in body or query
    if (jwtPayload && jwtPayload.role !== 'super_admin') {
      if (req.body && req.body.tenantId && String(req.body.tenantId) !== String(tenant._id)) {
        req.body.tenantId = tenant._id;
      }
      if (req.query && req.query.tenantId && String(req.query.tenantId) !== String(tenant._id)) {
        req.query.tenantId = String(tenant._id);
      }
    }

    next();
  } catch (error) {
    logger.error('Tenant resolution error', { error: error.message, stack: error.stack });
    res.status(500).json({ 
      success: false,
      message: 'Tenant resolution failed',
      error: error.message 
    });
  }
};

// For public routes (landing page, pricing, etc.)
const optionalTenant = async (req, res, next) => {
  try {
    const host = req.headers.host;
    const subdomainMatch = host.match(/^([^.]+)\./);
    
    if (subdomainMatch) {
      const subdomain = subdomainMatch[1];
      if (!['www', 'app', 'api'].includes(subdomain)) {
        const tenant = await Tenant.findOne({ subdomain: subdomain, isActive: true });
        if (tenant) {
          req.tenant = tenant;
          logger.debug('Optional tenant resolved', { subdomain });
        }
      }
    }
    next();
  } catch (error) {
    logger.error('Optional tenant error', { error: error.message, stack: error.stack });
    next();
  }
};

module.exports = { tenantResolver, optionalTenant };