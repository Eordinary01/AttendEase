const { body, param, query } = require('express-validator');

/**
 * Academic validation schemas
 */

const createCourse = [
  body('name')
    .notEmpty()
    .withMessage('Course name is required')
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Course name must be between 2 and 100 characters'),
  body('code')
    .notEmpty()
    .withMessage('Course code is required')
    .isString()
    .trim()
    .isLength({ min: 2, max: 20 })
    .matches(/^[A-Z0-9]+$/)
    .withMessage('Course code must be uppercase alphanumeric'),
  body('durationYears')
    .notEmpty()
    .withMessage('Duration in years is required')
    .isInt({ min: 1, max: 10 })
    .withMessage('Duration must be between 1 and 10 years'),
  body('semestersPerYear')
    .notEmpty()
    .withMessage('Semesters per year is required')
    .isInt({ min: 1, max: 4 })
    .withMessage('Semesters per year must be between 1 and 4'),
  body('branches')
    .optional()
    .isArray()
    .withMessage('Branches must be an array'),
  body('branches.*.name')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Branch name must be between 2 and 50 characters'),
  body('branches.*.code')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 10 })
    .matches(/^[A-Z0-9]+$/)
    .withMessage('Branch code must be uppercase alphanumeric'),
];

const updateCourse = [
  param('id')
    .notEmpty()
    .withMessage('Course ID is required')
    .isMongoId()
    .withMessage('Invalid course ID format'),
  body('name')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Course name must be between 2 and 100 characters'),
  body('code')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 20 })
    .matches(/^[A-Z0-9]+$/)
    .withMessage('Course code must be uppercase alphanumeric'),
  body('durationYears')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Duration must be between 1 and 10 years'),
  body('semestersPerYear')
    .optional()
    .isInt({ min: 1, max: 4 })
    .withMessage('Semesters per year must be between 1 and 4'),
  body('branches')
    .optional()
    .isArray()
    .withMessage('Branches must be an array'),
  body('branches.*.name')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Branch name must be between 2 and 50 characters'),
  body('branches.*.code')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 10 })
    .matches(/^[A-Z0-9]+$/)
    .withMessage('Branch code must be uppercase alphanumeric'),
];

const bulkCreateCourses = [
  body('courses')
    .isArray({ min: 1 })
    .withMessage('Courses must be a non-empty array'),
  body('courses.*.name')
    .notEmpty()
    .withMessage('Course name is required for each course')
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Course name must be between 2 and 100 characters'),
  body('courses.*.code')
    .notEmpty()
    .withMessage('Course code is required for each course')
    .isString()
    .trim()
    .isLength({ min: 2, max: 20 })
    .matches(/^[A-Z0-9]+$/)
    .withMessage('Course code must be uppercase alphanumeric'),
  body('courses.*.durationYears')
    .notEmpty()
    .withMessage('Duration in years is required for each course')
    .isInt({ min: 1, max: 10 })
    .withMessage('Duration must be between 1 and 10 years'),
  body('courses.*.semestersPerYear')
    .notEmpty()
    .withMessage('Semesters per year is required for each course')
    .isInt({ min: 1, max: 4 })
    .withMessage('Semesters per year must be between 1 and 4'),
  body('courses.*.branches')
    .optional()
    .isArray()
    .withMessage('Branches must be an array'),
];

const updateStructure = [
  body('semesterStructure')
    .notEmpty()
    .withMessage('Semester structure is required')
    .isObject()
    .withMessage('Semester structure must be an object'),
  body('semesterStructure.*')
    .optional()
    .isArray()
    .withMessage('Each semester must be an array of subjects'),
];

const getCourses = [
  query('active')
    .optional()
    .isBoolean()
    .withMessage('Active must be a boolean'),
  query('branch')
    .optional()
    .isString()
    .trim()
    .withMessage('Branch must be a string'),
];

module.exports = {
  createCourse,
  updateCourse,
  bulkCreateCourses,
  updateStructure,
  getCourses,
};