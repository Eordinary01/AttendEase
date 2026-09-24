/**
 * Demo Controller
 * Handles claiming, status inquiry, and clean release of role-specific demo sandbox sessions.
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const demoService = require('../services/demoService');
const { setAuthCookies, clearAuthCookies, generateXsrfToken } = require('../utils/cookieConfig');
const logger = require('../utils/logger');
const { seedDemoTenant } = require('../services/demoSeeder');

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Claim a demo role sandbox slot
 * POST /api/demo/claim
 */
async function claimDemo(req, res) {
  try {
    const { role } = req.body;
    let { sessionId } = req.body;

    if (!role || !demoService.VALID_ROLES.includes(role.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `Invalid role requested. Valid demo roles are: ${demoService.VALID_ROLES.join(', ')}`,
      });
    }

    const normalizedRole = role.toLowerCase();

    // Use or generate a persistent visitor session ID
    if (!sessionId) {
      sessionId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
    }

    // 1. Concurrency check & slot lock
    const claimResult = await demoService.claimSlot(normalizedRole, sessionId, req.ip);
    if (!claimResult.success) {
      return res.status(409).json({
        success: false,
        code: 'SLOT_OCCUPIED',
        message: claimResult.message || `The ${normalizedRole} demo is currently in use.`,
        remainingSeconds: claimResult.remainingSeconds,
      });
    }

    // 2. Fetch or seed the demo tenant
    let demoTenant = await Tenant.findOne({
      $or: [{ subdomain: 'demo' }, { isDemo: true }],
      isActive: true,
    });

    if (!demoTenant) {
      logger.info('[DemoController] Demo tenant missing on claim. Triggering automatic seed...');
      await seedDemoTenant();
      demoTenant = await Tenant.findOne({ subdomain: 'demo' });
    }

    if (!demoTenant) {
      // Rollback slot
      await demoService.releaseSlot(normalizedRole, sessionId);
      return res.status(500).json({
        success: false,
        message: 'Demo environment is currently unavailable. Please try again later.',
      });
    }

    // 3. Find demo user identity for the claimed role
    let demoUser = null;
    if (normalizedRole === 'admin') {
      demoUser = await User.findOne({ tenantId: demoTenant._id, role: 'admin' });
    } else if (normalizedRole === 'teacher') {
      demoUser = await User.findOne({ tenantId: demoTenant._id, role: 'teacher' });
    } else if (normalizedRole === 'student' || normalizedRole === 'parent') {
      demoUser = await User.findOne({ tenantId: demoTenant._id, role: 'student' });
    }

    if (!demoUser) {
      logger.warn(`[DemoController] Demo user for "${normalizedRole}" not found. Re-seeding...`);
      await seedDemoTenant();
      demoUser = await User.findOne({
        tenantId: demoTenant._id,
        role: normalizedRole === 'parent' ? 'student' : normalizedRole,
      });
    }

    if (!demoUser) {
      await demoService.releaseSlot(normalizedRole, sessionId);
      return res.status(500).json({
        success: false,
        message: `Demo user for role ${normalizedRole} could not be loaded.`,
      });
    }

    // 4. Generate short-lived demo JWT matching slot TTL
    const durationSeconds = claimResult.slot?.durationSeconds || demoService.DEFAULT_DURATION_SECONDS;
    const jwtPayload = {
      userId: demoUser._id,
      role: normalizedRole === 'parent' ? 'parent' : demoUser.role,
      tenantId: demoTenant._id,
      tokenVersion: demoUser.tokenVersion || 0,
      demo: true,
      sessionId,
      ...(normalizedRole === 'parent' ? { accessMode: 'parent' } : {}),
    };

    const token = jwt.sign(jwtPayload, JWT_SECRET, {
      expiresIn: `${durationSeconds}s`,
    });

    // 5. Generate secure cookies
    const xsrfToken = generateXsrfToken();
    const rawRefreshToken = crypto.randomBytes(32).toString('hex');
    setAuthCookies(res, token, rawRefreshToken, xsrfToken);

    // 6. Deliver clean response — ZERO PASSWORDS, TOKENS, OR SECRETS EXPOSED (Phase 10)
    return res.status(200).json({
      success: true,
      message: `${normalizedRole.toUpperCase()} demo session claimed successfully.`,
      sessionId,
      role: normalizedRole,
      expiresAt: claimResult.slot?.expiresAt,
      durationSeconds,
      isDemo: true,
      user: {
        name: normalizedRole === 'parent' ? (demoUser.parentName || 'Demo Parent') : demoUser.name,
        role: normalizedRole,
        tenantSubdomain: demoTenant.subdomain,
        tenantName: demoTenant.name,
        ...(normalizedRole === 'student' ? { rollNo: demoUser.rollNo, section: demoUser.section } : {}),
        ...(normalizedRole === 'parent' ? {
          studentName: demoUser.name,
          studentRollNo: demoUser.rollNo,
          parentName: demoUser.parentName,
        } : {}),
      },
    });
  } catch (error) {
    logger.error('[DemoController] Claim demo failed', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to initialize demo session.',
    });
  }
}

/**
 * Release a demo role slot
 * POST /api/demo/release
 */
async function releaseDemo(req, res) {
  try {
    const role = req.body.role || req.user?.role;
    const sessionId = req.body.sessionId || req.user?.sessionId;

    if (role && sessionId) {
      await demoService.releaseSlot(role.toLowerCase(), sessionId);
    }

    clearAuthCookies(res);

    return res.status(200).json({
      success: true,
      message: 'Demo session released successfully.',
    });
  } catch (error) {
    logger.error('[DemoController] Release demo failed', { error: error.message });
    clearAuthCookies(res);
    return res.status(200).json({
      success: true,
      message: 'Demo session terminated.',
    });
  }
}

/**
 * Get slot availability across all demo roles
 * GET /api/demo/status
 */
async function getDemoStatus(req, res) {
  try {
    const slots = await demoService.getAllSlotsStatus();
    return res.status(200).json({
      success: true,
      slots,
    });
  } catch (error) {
    logger.error('[DemoController] Get status failed', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Unable to check demo slot availability.',
    });
  }
}

module.exports = {
  claimDemo,
  releaseDemo,
  getDemoStatus,
};
