// routes/tenantRoutes.js
const express = require('express');
const router = express.Router();
const { authenticateToken, adminAuth } = require('../middleware/auth');
const { tenantResolver } = require('../middleware/tenantResolver');
const { cacheMiddleware } = require('../middleware/cache');
const upload = require('../middleware/multer');
const validate = require('../middleware/validate');
const {
  updateTenantSettings,
  completeSetupStep,
  getSetupStatus,
} = require('../validators/tenant');
const {
  getTenantInfo,
  updateTenantSettings: updateTenantSettingsCtrl,
  getTenantUsage,
  uploadBrandingImage,
  getSetupStatus: getSetupStatusCtrl,
  completeSetupStep: completeSetupStepCtrl,
  getDashboardStats
} = require('../controllers/tenantController');

router.use(authenticateToken);

// Tenant information routes
router.get('/info', cacheMiddleware('tenant', 300), getTenantInfo);
router.put('/settings', adminAuth, updateTenantSettings, updateTenantSettingsCtrl);
router.get('/usage', cacheMiddleware('tenant_usage', 120), getTenantUsage);
router.get('/dashboard-stats', adminAuth, getDashboardStats);

// Branding image upload
router.post('/branding/upload', adminAuth, upload.single("image"), uploadBrandingImage);

// Onboarding/Setup routes
router.get('/setup-status', adminAuth, getSetupStatus, getSetupStatusCtrl);
router.post('/setup/complete', adminAuth, completeSetupStep, completeSetupStepCtrl);

module.exports = router;