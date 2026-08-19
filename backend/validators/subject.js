const { body, param, query } = require('express-validator');

/**
 * Subject validation schemas
 */

const createSubject = [
  body('name')
    .notEmpty()
    .withMessage('Subject name is required')
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Subject name must be between 2 and 100 characters'),
  body('code')
    .notEmpty()
    .withMessage('Subject code is required')
    .isString()
    .trim()
    .isLength({ min: 2, max: 20 })
    .matches(/^[A-Z0-9]+$/)
    .withMessage('Subject code must be uppercase alphanumeric'),
  body('courseId')
    .notEmpty()
    .withMessage('Course ID is required')
    .isMongoId()
    .withMessage('Invalid course ID format'),
  body('branch')
    .notEmpty()
    .withMessage('Branch is required')
    .isString()
    .trim()
    .withMessage('Branch must be a string'),
  body('semester')
    .notEmpty()
    .withMessage('Semester is required')
    .isInt({ min: 1, max: 10 })
    .withMessage('Semester must be a valid integer between 1 and 10'),
  body('credits')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Credits must be a positive integer'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

const updateSubject = [
  param('subjectId')
    .notEmpty()
    .withMessage('Subject ID is required')
    .isMongoId()
    .withMessage('Invalid subject ID format'),
  body('name')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Subject name must be between 2 and 100 characters'),
  body('code')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 20 })
    .matches(/^[A-Z0-9]+$/)
    .withMessage('Subject code must be uppercase alphanumeric'),
  body('courseId')
    .optional()
    .isMongoId()
    .withMessage('Invalid course ID format'),
  body('branch')
    .optional()
    .isString()
    .trim()
    .withMessage('Branch must be a string'),
  body('semester')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Semester must be a valid integer between 1 and 10'),
  body('credits')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Credits must be a positive integer'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

const getSubjects = [
  query('courseId')
    .optional()
    .isMongoId()
    .withMessage('Invalid course ID format'),
  query('branch')
    .optional()
    .isString()
    .trim()
    .withMessage('Branch must be a string'),
  query('semester')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Semester must be a valid integer'),
  query('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

module.exports = {
  createSubject,
  updateSubject,
  getSubjects,
};