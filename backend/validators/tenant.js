const { body, param, query } = require('express-validator');

/**
 * Tenant validation schemas
 */

const updateTenantSettings = [
  body('name')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Tenant name must be between 2 and 100 characters'),
  body('subdomain')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 50 })
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Subdomain must be lowercase alphanumeric with hyphens'),
  body('settings.semesterStructure')
    .optional()
    .isObject()
    .withMessage('Semester structure must be an object'),
  body('settings.enable2FA')
    .optional()
    .isBoolean()
    .withMessage('enable2FA must be a boolean'),
  body('settings.sessionTimeout')
    .optional()
    .isInt({ min: 5, max: 480 })
    .withMessage('Session timeout must be between 5 and 480 minutes'),
  body('branding.primaryColor')
    .optional()
    .matches(/^#[0-9A-Fa-f]{6}$/)
    .withMessage('Primary color must be a valid hex color'),
  body('branding.secondaryColor')
    .optional()
    .matches(/^#[0-9A-Fa-f]{6}$/)
    .withMessage('Secondary color must be a valid hex color'),
  body('branding.accentColor')
    .optional()
    .matches(/^#[0-9A-Fa-f]{6}$/)
    .withMessage('Accent color must be a valid hex color'),
];

const completeSetupStep = [
  body('step')
    .notEmpty()
    .withMessage('Step is required')
    .isString()
    .trim()
    .withMessage('Step must be a string'),
  body('data')
    .optional()
    .isObject()
    .withMessage('Data must be an object'),
];

const getSetupStatus = [
  query('tenantId')
    .optional()
    .isMongoId()
    .withMessage('Invalid tenant ID format'),
];

module.exports = {
  updateTenantSettings,
  completeSetupStep,
  getSetupStatus,
};