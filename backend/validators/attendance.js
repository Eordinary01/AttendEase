const { body, param, query } = require('express-validator');

/**
 * Attendance validation schemas
 */

const markAttendance = [
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
  body('date')
    .optional()
    .isISO8601()
    .withMessage('Date must be a valid ISO 8601 date')
    .toDate(),
  body('attendanceData')
    .isArray({ min: 1 })
    .withMessage('Attendance data must be a non-empty array'),
  body('attendanceData.*.studentId')
    .notEmpty()
    .withMessage('Student ID is required for each record')
    .isMongoId()
    .withMessage('Invalid student ID format'),
  body('attendanceData.*.status')
    .notEmpty()
    .withMessage('Status is required for each record')
    .isIn(['present', 'absent', 'late', 'leave'])
    .withMessage('Status must be one of: present, absent, late, leave'),
  body('attendanceData.*.remarks')
    .optional()
    .isString()
    .trim()
    .withMessage('Remarks must be a string'),
];

const updateAttendanceRecord = [
  param('attendanceId')
    .notEmpty()
    .withMessage('Attendance ID is required')
    .isMongoId()
    .withMessage('Invalid attendance ID format'),
  body('status')
    .optional()
    .isIn(['present', 'absent', 'late', 'leave'])
    .withMessage('Status must be one of: present, absent, late, leave'),
  body('remarks')
    .optional()
    .isString()
    .trim()
    .withMessage('Remarks must be a string'),
];

const getAttendanceSummary = [
  query('subjectId')
    .optional()
    .isMongoId()
    .withMessage('Invalid subject ID format'),
  query('section')
    .optional()
    .isString()
    .trim()
    .withMessage('Section must be a string'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date')
    .toDate(),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
    .toDate(),
];

const getAttendanceByDate = [
  query('date')
    .notEmpty()
    .withMessage('Date is required')
    .isISO8601()
    .withMessage('Date must be a valid ISO 8601 date')
    .toDate(),
  query('subjectId')
    .optional()
    .isMongoId()
    .withMessage('Invalid subject ID format'),
  query('section')
    .optional()
    .isString()
    .trim()
    .withMessage('Section must be a string'),
];

module.exports = {
  markAttendance,
  updateAttendanceRecord,
  getAttendanceSummary,
  getAttendanceByDate,
};