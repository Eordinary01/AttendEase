const express = require("express");
const authRoute = express.Router();
const rateLimit = require('express-rate-limit');
const { authenticateToken } = require('../middleware/auth');
const validate = require('../middleware/validate');
const logger = require('../utils/logger');
const {
  login,
  superAdminLogin,
  parentLogin,
  mobileLogin: mobileLoginValidator,
  registerStudent,
  registerTeacherFirstLogin,
  changePassword,
  setup2FA,
  verify2FA,
  disable2FA,
} = require("../validators/auth");
const {
  registerStudent: registerStudentCtrl,
  registerTeacherFirstLogin: registerTeacherFirstLoginCtrl,
  login: loginCtrl,
  superAdminLogin: superAdminLoginCtrl,
  parentLogin: parentLoginCtrl,
  mobileLogin: mobileLoginCtrl,
  verifyToken,
  changePassword: changePasswordCtrl,
  logout,
  refresh,
  forgotPassword,
  resetPassword,
  setup2FA: setup2FACtrl,
  verify2FA: verify2FACtrl,
  disable2FA: disable2FACtrl,
  get2FAStatus,
  getSessions,
  logoutAllSessions,
  sendEmailVerification,
  verifyEmail,
} = require("../controllers/authController");

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

const mobileLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many mobile login attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, message: 'Too many requests. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

// ==================== PUBLIC ROUTES (No authentication required) ====================

authRoute.post('/login', loginLimiter, login, loginCtrl);
authRoute.post('/parent-login', loginLimiter, parentLogin, parentLoginCtrl);
authRoute.post('/super-admin/login', loginLimiter, superAdminLogin, superAdminLoginCtrl);
authRoute.post('/mobile-login', mobileLoginLimiter, mobileLoginValidator, mobileLoginCtrl);

authRoute.post('/register/student', authLimiter, registerStudent, registerStudentCtrl);
authRoute.post('/register/teacher/first-login', authLimiter, registerTeacherFirstLogin, registerTeacherFirstLoginCtrl);
authRoute.post('/refresh', authLimiter, refresh);
authRoute.post('/forgot-password', authLimiter, forgotPassword);
authRoute.post('/reset-password', authLimiter, resetPassword);

// ✅ FIXED: Tenant info should be PUBLIC (no authentication)
/**
 * GET /api/auth/tenant-info
 * Get tenant info by subdomain (public - used on login page)
 * Query: ?subdomain=xxx
 */
authRoute.get('/tenant-info', async (req, res) => {
  try {
    const Tenant = require('../models/Tenant');
    const { subdomain } = req.query;
    
    // If subdomain is provided, find by subdomain
    if (subdomain) {
      const tenant = await Tenant.findOne({ 
        $or: [
          { subdomain: subdomain.toLowerCase() },
          { domain: subdomain.toLowerCase() }
        ],
        isActive: true 
      }).select('name subdomain domain branding subscription.plan');
      
      if (tenant) {
        return res.json({
          success: true,
          tenant: {
            id: tenant._id,
            name: tenant.branding?.institutionName || tenant.name,
            subdomain: tenant.subdomain,
            branding: tenant.branding,
            plan: tenant.subscription?.plan
          }
        });
      }
    }
    
    // If no subdomain, try to detect from host
    const host = req.headers.host;
    const subdomainMatch = host?.match(/^([^.]+)\./);
    if (subdomainMatch && subdomainMatch[1] !== 'www' && subdomainMatch[1] !== 'app') {
      const detectedSubdomain = subdomainMatch[1];
      const tenant = await Tenant.findOne({ 
        subdomain: detectedSubdomain,
        isActive: true 
      }).select('name subdomain domain branding subscription.plan');
      
      if (tenant) {
        return res.json({
          success: true,
          tenant: {
            id: tenant._id,
            name: tenant.branding?.institutionName || tenant.name,
            subdomain: tenant.subdomain,
            branding: tenant.branding,
            plan: tenant.subscription?.plan
          }
        });
      }
    }
    
    res.json({ success: true, tenant: null });
  } catch (error) {
    logger.error('Error fetching tenant info:', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==================== PROTECTED ROUTES (Require authentication) ====================

/**
 * GET /api/auth/verify
 * Verify token and get user details
 * Header: Authorization: Bearer <token>
 */
authRoute.get('/verify', authenticateToken, verifyToken);

/**
 * POST /api/auth/change-password
 * Change password for logged-in user
 * Header: Authorization: Bearer <token>
 * Body: { oldPassword, newPassword, confirmPassword }
 */
authRoute.post('/change-password', authenticateToken, changePassword, changePasswordCtrl);

/**
 * POST /api/auth/logout
 * Logout user (client-side token removal)
 * Header: Authorization: Bearer <token>
 */
authRoute.post('/logout', authenticateToken, logout);

// ==================== 2FA ROUTES ====================
authRoute.post('/2fa/setup', authenticateToken, setup2FA, setup2FACtrl);
authRoute.post('/2fa/verify', authenticateToken, verify2FA, verify2FACtrl);
authRoute.get('/2fa/status', authenticateToken, get2FAStatus);

// ==================== SESSION ROUTES ====================
authRoute.get('/sessions', authenticateToken, getSessions);
authRoute.post('/sessions/logout-all', authenticateToken, logoutAllSessions);

// ==================== EMAIL VERIFICATION ROUTES ====================
authRoute.post('/send-verification-email', authenticateToken, authLimiter, sendEmailVerification);
authRoute.post('/verify-email', authenticateToken, authLimiter, verifyEmail);

module.exports = authRoute;