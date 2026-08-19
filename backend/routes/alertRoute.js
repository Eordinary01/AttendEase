// routes/alertRoutes.js
const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { featureGuard } = require("../middleware/featureGuard");
const validate = require("../middleware/validate");
const { body, param, query } = require("express-validator");
const {
  createAlert,
  getAlerts,
  updateAlert,
  deleteAlert,
  getAlertStats,
  markAlertAsRead
} = require('../controllers/alertController');

const createAlertValidator = [
  body('title')
    .notEmpty()
    .withMessage('Title is required')
    .isString()
    .trim()
    .withMessage('Title must be a string'),
  body('message')
    .notEmpty()
    .withMessage('Message is required')
    .isString()
    .trim()
    .withMessage('Message must be a string'),
  body('type')
    .optional()
    .isIn(['short_term', 'announcement'])
    .withMessage('Type must be short_term or announcement'),
  body('priority')
    .optional()
    .isIn(['low', 'normal', 'high', 'urgent'])
    .withMessage('Priority must be low, normal, high, or urgent'),
  body('targetRoles')
    .optional()
    .isArray()
    .withMessage('Target roles must be an array'),
  body('targetRoles.*')
    .optional()
    .isIn(['admin', 'teacher', 'student', 'parent'])
    .withMessage('Invalid target role'),
  body('targetSections')
    .optional()
    .isArray()
    .withMessage('Target sections must be an array'),
  body('targetSections.*')
    .optional()
    .isString()
    .trim()
    .withMessage('Section must be a string'),
  body('targetCourseIds')
    .optional()
    .isArray()
    .withMessage('Target course IDs must be an array'),
  body('targetCourseIds.*')
    .optional()
    .isMongoId()
    .withMessage('Invalid course ID format'),
  body('expiryDate')
    .optional()
    .isISO8601()
    .withMessage('Expiry date must be a valid date'),
];

const updateAlertValidator = [
  param('alertId')
    .notEmpty()
    .withMessage('Alert ID is required')
    .isMongoId()
    .withMessage('Invalid alert ID format'),
  body('title')
    .optional()
    .isString()
    .trim()
    .withMessage('Title must be a string'),
  body('message')
    .optional()
    .isString()
    .trim()
    .withMessage('Message must be a string'),
  body('type')
    .optional()
    .isIn(['short_term', 'announcement'])
    .withMessage('Type must be short_term or announcement'),
  body('priority')
    .optional()
    .isIn(['low', 'normal', 'high', 'urgent'])
    .withMessage('Priority must be low, normal, high, or urgent'),
  body('expiryDate')
    .optional()
    .isISO8601()
    .withMessage('Expiry date must be a valid date'),
];

const getAlertsValidator = [
  query('type')
    .optional()
    .isIn(['short_term', 'announcement'])
    .withMessage('Type must be short_term or announcement'),
  query('priority')
    .optional()
    .isIn(['low', 'normal', 'high', 'urgent'])
    .withMessage('Priority must be low, normal, high, or urgent'),
  query('includeExpired')
    .optional()
    .isBoolean()
    .withMessage('includeExpired must be a boolean'),
];

// All routes require authentication
router.use(authenticateToken);
router.use(featureGuard("alerts"));

// ==================== PUBLIC (All authenticated users) ====================

// Get alerts (students, teachers, admins see their relevant alerts)
router.get('/', getAlertsValidator, getAlerts);

// Get alert statistics (admins see their tenant stats)
router.get('/stats', getAlertStats);

// Mark alert as read
router.post('/:alertId/read', markAlertAsRead);

// ==================== AUTHORIZED CREATION & MANAGEMENT ROUTES ====================

// Create alert (Admin, Super Admin, or Teacher)
router.post('/', authorizeRoles(['admin', 'super_admin', 'teacher']), createAlertValidator, createAlert);

// Update alert (Admin, Super Admin, or Teacher)
router.put('/:alertId', authorizeRoles(['admin', 'super_admin', 'teacher']), updateAlertValidator, updateAlert);

// Delete alert (Admin, Super Admin, or Teacher)
router.delete('/:alertId', authorizeRoles(['admin', 'super_admin', 'teacher']), deleteAlert);

module.exports = router;