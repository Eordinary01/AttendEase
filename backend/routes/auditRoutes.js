const express = require('express');
const router = express.Router();
const { getAuditLogs } = require('../controllers/auditController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { tenantResolver } = require('../middleware/tenantResolver');

router.use(authenticateToken);
router.use(tenantResolver);
router.use(authorizeRoles('admin', 'super_admin'));

/**
 * GET /api/admin/audit-logs
 * Fetch compliance audit logs
 */
router.get('/', getAuditLogs);

module.exports = router;
