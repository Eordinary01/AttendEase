const { body, param, query } = require('express-validator');

/**
 * User validation schemas
 */

const updateProfile = [
  body('name')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail(),
  body('phone')
    .optional()
    .matches(/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/)
    .withMessage('Must be a valid phone number'),
  body('address')
    .optional()
    .isString()
    .trim()
    .withMessage('Address must be a string'),
];

const createStudent = [
  body('name')
    .notEmpty()
    .withMessage('Student name is required')
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail(),
  body('rollNo')
    .notEmpty()
    .withMessage('Roll number is required')
    .isString()
    .trim()
    .withMessage('Roll number must be a string'),
  body('section')
    .notEmpty()
    .withMessage('Section is required')
    .isString()
    .trim()
    .withMessage('Section must be a string'),
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
    .withMessage('Semester must be a valid integer'),
  body('password')
    .optional()
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
];

const updateStudent = [
  param('id')
    .notEmpty()
    .withMessage('Student ID is required')
    .isMongoId()
    .withMessage('Invalid student ID format'),
  body('name')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail(),
  body('rollNo')
    .optional()
    .isString()
    .trim()
    .withMessage('Roll number must be a string'),
  body('section')
    .optional()
    .isString()
    .trim()
    .withMessage('Section must be a string'),
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
    .withMessage('Semester must be a valid integer'),
  body('password')
    .optional()
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
];

const createTeacher = [
  body('name')
    .notEmpty()
    .withMessage('Teacher name is required')
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail(),
  body('employeeId')
    .notEmpty()
    .withMessage('Employee ID is required')
    .isString()
    .trim()
    .withMessage('Employee ID must be a string'),
  body('phone')
    .optional()
    .matches(/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/)
    .withMessage('Must be a valid phone number'),
  body('department')
    .optional()
    .isString()
    .trim()
    .withMessage('Department must be a string'),
  body('qualification')
    .optional()
    .isString()
    .trim()
    .withMessage('Qualification must be a string'),
  body('password')
    .optional()
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
];

const updateTeacher = [
  param('id')
    .notEmpty()
    .withMessage('Teacher ID is required')
    .isMongoId()
    .withMessage('Invalid teacher ID format'),
  body('name')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail(),
  body('employeeId')
    .optional()
    .isString()
    .trim()
    .withMessage('Employee ID must be a string'),
  body('phone')
    .optional()
    .matches(/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/)
    .withMessage('Must be a valid phone number'),
  body('department')
    .optional()
    .isString()
    .trim()
    .withMessage('Department must be a string'),
  body('qualification')
    .optional()
    .isString()
    .trim()
    .withMessage('Qualification must be a string'),
];

const createAdmin = [
  body('name')
    .notEmpty()
    .withMessage('Admin name is required')
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
];

const bulkUploadUsers = [
  body('users')
    .isArray({ min: 1 })
    .withMessage('Users must be a non-empty array'),
  body('users.*.name')
    .notEmpty()
    .withMessage('Name is required for each user')
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('users.*.email')
    .notEmpty()
    .withMessage('Email is required for each user')
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail(),
  body('users.*.role')
    .notEmpty()
    .withMessage('Role is required for each user')
    .isIn(['student', 'teacher', 'admin'])
    .withMessage('Role must be one of: student, teacher, admin'),
  body('users.*.password')
    .optional()
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
];

const searchUsers = [
  query('q')
    .optional()
    .isString()
    .trim()
    .withMessage('Search query must be a string'),
  query('role')
    .optional()
    .isIn(['student', 'teacher', 'admin'])
    .withMessage('Role must be one of: student, teacher, admin'),
  query('section')
    .optional()
    .isString()
    .trim()
    .withMessage('Section must be a string'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
];

module.exports = {
  updateProfile,
  createStudent,
  updateStudent,
  createTeacher,
  updateTeacher,
  createAdmin,
  bulkUploadUsers,
  searchUsers,
};