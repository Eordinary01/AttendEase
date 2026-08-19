const { body, param, query } = require('express-validator');

/**
 * Admin validation schemas
 */

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
];

const assignSubjectToTeacher = [
  body('teacherId')
    .notEmpty()
    .withMessage('Teacher ID is required')
    .isMongoId()
    .withMessage('Invalid teacher ID format'),
  body('subjectId')
    .notEmpty()
    .withMessage('Subject ID is required')
    .isMongoId()
    .withMessage('Invalid subject ID format'),
  body('section')
    .notEmpty()
    .withMessage('Section is required')
    .isString()
    .trim()
    .withMessage('Section must be a string'),
];

const uploadEnrollments = [
  body('students')
    .isArray({ min: 1 })
    .withMessage('Students must be a non-empty array'),
  body('students.*.rollNo')
    .notEmpty()
    .withMessage('Roll number is required for each student')
    .isString()
    .trim()
    .withMessage('Roll number must be a string'),
  body('students.*.name')
    .notEmpty()
    .withMessage('Name is required for each student')
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('students.*.email')
    .notEmpty()
    .withMessage('Email is required for each student')
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail(),
  body('students.*.section')
    .notEmpty()
    .withMessage('Section is required for each student')
    .isString()
    .trim()
    .withMessage('Section must be a string'),
  body('students.*.courseId')
    .notEmpty()
    .withMessage('Course ID is required for each student')
    .isMongoId()
    .withMessage('Invalid course ID format'),
  body('students.*.branch')
    .notEmpty()
    .withMessage('Branch is required for each student')
    .isString()
    .trim()
    .withMessage('Branch must be a string'),
  body('students.*.semester')
    .notEmpty()
    .withMessage('Semester is required for each student')
    .isInt({ min: 1, max: 10 })
    .withMessage('Semester must be a valid integer'),
];

module.exports = {
  createTeacher,
  createSubject,
  assignSubjectToTeacher,
  uploadEnrollments,
};