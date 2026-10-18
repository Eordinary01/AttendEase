const Tenant = require('../models/Tenant');
const cache = require('./cache');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

const PLATFORM_DOMAINS = [
  'vercel.app',
  'onrender.com',
  'railway.app',
  'herokuapp.com',
  'netlify.app',
  'pages.dev',
  'render.com',
];

/**
 * Extract tenant subdomain from host string, correctly ignoring cloud platform hostnames
 * where the 3-level domain is the deployment identifier, not a tenant (e.g. attend-ease-kappa.vercel.app).
 * @param {string} host
 * @returns {string|null}
 */
function extractTenantSubdomain(host) {
  if (!host || typeof host !== 'string') return null;
  const cleanHost = host.split(':')[0].toLowerCase();

  const isPlatformHost = PLATFORM_DOMAINS.some((suffix) => cleanHost.endsWith(`.${suffix}`));
  const parts = cleanHost.split('.');

  if (isPlatformHost) {
    // Platform deployments (e.g. attend-ease-kappa.vercel.app has 3 parts)
    // Only 4+ level subdomains represent institutional portals on platform domains (e.g. oxford.attend-ease.vercel.app)
    if (parts.length >= 4) {
      const sub = parts[0];
      if (!['www', 'app', 'api'].includes(sub)) return sub;
    }
    return null;
  }

  // Standard custom domains (e.g. oxford.attendease.com has 3 parts)
  if (parts.length >= 3) {
    const sub = parts[0];
    if (!['www', 'app', 'api'].includes(sub)) return sub;
  }

  return null;
}

const tenantResolver = async (req, res, next) => {
  const skipPaths = [
    '/api/auth/login',
    '/api/auth/super-admin/login',
    '/api/auth/tenant-info',
    '/api/auth/verify',
    '/api/tenant/register',
    '/api/landing',
    '/api/billing/plans',
    '/api/super-admin',
    '/api/admin/super',
    '/api/admin/plans',
    '/api/demo',
  ];
  if (skipPaths.some((path) => req.originalUrl?.startsWith(path) || req.path?.startsWith(path))) {
    return next();
  }

  try {
    let tenant = null;
    const host = req.headers.host;
    const tenantId = req.headers['x-tenant-id'];
    let cacheKey = null;

    // Extract payload from JWT if provided (via Authorization header OR httpOnly cookie)
    let jwtPayload = null;
    let hasJwt = false;
    let token = null;

    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    } else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    } else if (req.cookies?.token) {
      token = req.cookies.token;
    }

    if (token) {
      try {
        jwtPayload = jwt.verify(token, process.env.JWT_SECRET);
        hasJwt = true;
      } catch (e) {
        jwtPayload = null;
        hasJwt = false;
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

    // Special Case: Demo Sandbox User -> strictly resolve to demo tenant
    if (hasJwt && jwtPayload && jwtPayload.demo) {
      cacheKey = 'tenant:demo';
      tenant = await cache.get(cacheKey);
      if (!tenant) {
        const targetId = jwtPayload.tenantId;
        tenant = await Tenant.findOne({
          $or: [
            ...(targetId && mongoose.Types.ObjectId.isValid(targetId) ? [{ _id: targetId }] : []),
            { subdomain: 'demo' },
            { isDemo: true },
          ],
          isActive: true,
        }).lean();
        if (tenant) await cache.set(cacheKey, tenant, 600);
      }
    }

    // Case A: Authenticated User (Non-SuperAdmin, Non-Demo) -> Strict Tenant Isolation
    else if (hasJwt && jwtPayload && jwtPayload.role !== 'super_admin') {
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
        if (tenant) await cache.set(cacheKey, tenant, 600);
      }

      // SECURITY GUARANTEE: An authenticated user MUST strictly resolve to THEIR tenant.
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
          if (tenant) await cache.set(cacheKey, tenant, 600);
        }
      }
    }

    // Case C: Unauthenticated Requests (Header, Query, Subdomain, or Localhost Dev Fallback)
    else {
      // C1: Check x-tenant-id header
      if (tenantId && mongoose.Types.ObjectId.isValid(tenantId)) {
        cacheKey = `tenant:${tenantId}`;
        tenant = await cache.get(cacheKey);
        if (!tenant) {
          tenant = await Tenant.findById(tenantId).lean();
          if (tenant) await cache.set(cacheKey, tenant, 600);
        }
      }

      // C2: Check x-tenant-subdomain header or subdomain query parameter
      const requestedSubdomain = req.headers['x-tenant-subdomain'] || req.query.subdomain || req.query.tenantSubdomain;
      if (!tenant && requestedSubdomain && typeof requestedSubdomain === 'string') {
        const cleanSub = requestedSubdomain.trim().toLowerCase();
        if (!['www', 'app', 'api'].includes(cleanSub)) {
          cacheKey = `tenant:subdomain:${cleanSub}`;
          tenant = await cache.get(cacheKey);
          if (!tenant) {
            tenant = await Tenant.findOne({ subdomain: cleanSub, isActive: true }).lean();
            if (tenant) await cache.set(cacheKey, tenant, 600);
          }
        }
      }

      // C3: Check Host Subdomain (only if host represents a valid institutional tenant subdomain)
      if (!tenant) {
        const extractedSub = extractTenantSubdomain(host);
        if (extractedSub) {
          cacheKey = `tenant:subdomain:${extractedSub}`;
          tenant = await cache.get(cacheKey);
          if (!tenant) {
            tenant = await Tenant.findOne({ subdomain: extractedSub, isActive: true }).lean();
            if (tenant) await cache.set(cacheKey, tenant, 600);
          }
        }
      }

      // C4: Development / Localhost Fallback for Unauthenticated Requests
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

    if (tenant.subscription?.status !== 'active' && tenant.subscription?.status !== 'trial') {
      const isExpired = tenant.subscription?.status === 'expired';
      return res.status(403).json({
        success: false,
        message: isExpired ? 'Your trial has expired. Please upgrade to continue.' : `Your account is ${tenant.subscription?.status}. Please contact support.`,
        status: tenant.subscription?.status,
        subscriptionStatus: tenant.subscription?.status,
        upgradeRequired: isExpired
      });
    }

    if (tenant.subscription?.plan === 'free' && tenant.subscription?.trialEndsAt && new Date(tenant.subscription.trialEndsAt) < new Date()) {
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
    const requestedSubdomain =
      extractTenantSubdomain(host) ||
      req.headers['x-tenant-subdomain'] ||
      req.query.subdomain ||
      req.query.tenantSubdomain;
    
    if (requestedSubdomain && typeof requestedSubdomain === 'string') {
      const cleanSub = requestedSubdomain.trim().toLowerCase();
      if (!['www', 'app', 'api'].includes(cleanSub)) {
        const tenant = await Tenant.findOne({ subdomain: cleanSub, isActive: true });
        if (tenant) {
          req.tenant = tenant;
          req.tenantId = tenant._id;
          logger.debug('Optional tenant resolved', { subdomain: cleanSub });
        }
      }
    }
    next();
  } catch (error) {
    logger.error('Optional tenant error', { error: error.message, stack: error.stack });
    next();
  }
};

module.exports = { tenantResolver, optionalTenant, extractTenantSubdomain };