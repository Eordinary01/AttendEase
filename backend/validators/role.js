const { body, param, query } = require('express-validator');

/**
 * Role validation schemas
 */

const createRole = [
  body('name')
    .notEmpty()
    .withMessage('Role name is required')
    .isString()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Role name must be between 2 and 50 characters'),
  body('description')
    .optional()
    .isString()
    .trim()
    .withMessage('Description must be a string'),
  body('permissions')
    .notEmpty()
    .withMessage('Permissions are required')
    .isArray({ min: 1 })
    .withMessage('Permissions must be a non-empty array'),
  body('permissions.*')
    .isString()
    .trim()
    .withMessage('Each permission must be a string'),
];

const updateRole = [
  param('id')
    .notEmpty()
    .withMessage('Role ID is required')
    .isMongoId()
    .withMessage('Invalid role ID format'),
  body('name')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Role name must be between 2 and 50 characters'),
  body('description')
    .optional()
    .isString()
    .trim()
    .withMessage('Description must be a string'),
  body('permissions')
    .optional()
    .isArray()
    .withMessage('Permissions must be an array'),
  body('permissions.*')
    .optional()
    .isString()
    .trim()
    .withMessage('Each permission must be a string'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

const assignRole = [
  body('teacherId')
    .notEmpty()
    .withMessage('Teacher ID is required')
    .isMongoId()
    .withMessage('Invalid teacher ID format'),
  body('roleId')
    .notEmpty()
    .withMessage('Role ID is required')
    .isMongoId()
    .withMessage('Invalid role ID format'),
  body('courseId')
    .optional({ nullable: true, checkFalsy: true })
    .isMongoId()
    .withMessage('Invalid course ID format'),
  body('branch')
    .optional({ nullable: true })
    .isString()
    .trim(),
  body('semester')
    .optional({ nullable: true, checkFalsy: true })
    .custom((val) => {
      if (val === null || val === undefined || val === '') return true;
      const num = Number(val);
      return !isNaN(num) && num >= 1 && num <= 16;
    })
    .withMessage('Semester must be a valid number between 1 and 16'),
  body('section')
    .optional({ nullable: true })
    .isString()
    .trim(),
  body('isPrimary')
    .optional({ nullable: true })
    .isBoolean()
    .withMessage('isPrimary must be a boolean'),
];

const unassignRole = [
  param('teacherId')
    .notEmpty()
    .withMessage('Teacher ID is required')
    .isMongoId()
    .withMessage('Invalid teacher ID format'),
  param('roleId')
    .notEmpty()
    .withMessage('Role ID or Assignment ID is required')
    .isMongoId()
    .withMessage('Invalid role ID format'),
];

const getRoles = [
  query('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

module.exports = {
  createRole,
  updateRole,
  assignRole,
  unassignRole,
  getRoles,
};