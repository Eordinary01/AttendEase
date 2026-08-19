const { body, param, query } = require('express-validator');

/**
 * Timetable validation schemas
 */

// No Class / free-period entries only carry section + day + times. The other
// context fields (course/branch/semester/room/teacher/subject) are skipped so
// free slots can be created without a subject, teacher or room.
const isNoClassBody = (req) => {
  const body = req.body || {};
  return Boolean(body.isNoClass) || String(body.subjectName || "").toLowerCase() === "no class";
};

// Condition that gates a validator chain onto REGULAR (non-No Class) entries only.
const isRegularEntry = (value, { req }) => !isNoClassBody(req);

// For bulk rows the entry is nested in req.body.entries[index]; resolve it from
// the express-validator path (e.g. "entries.0.courseCode").
const isRegularBulkEntry = (value, { req, path }) => {
  const m = /^entries\.(\d+)\./.exec(path || "");
  if (!m) return true;
  const row = (req.body?.entries || [])[Number(m[1])] || {};
  return !(Boolean(row.isNoClass) || String(row.subjectName || "").toLowerCase() === "no class");
};

const createEntry = [
  body('section')
    .notEmpty()
    .withMessage('Section is required')
    .isString()
    .trim()
    .withMessage('Section must be a string'),
  body('courseCode')
    .if(isRegularEntry)
    .notEmpty()
    .withMessage('Course code is required')
    .isString()
    .trim()
    .withMessage('Course code must be a string'),
  body('courseId')
    .if(isRegularEntry)
    .optional({ values: 'falsy' })
    .isMongoId()
    .withMessage('Invalid course ID format'),
  body('branch')
    .if(isRegularEntry)
    .notEmpty()
    .withMessage('Branch is required')
    .isString()
    .trim()
    .withMessage('Branch must be a string'),
  body('semester')
    .if(isRegularEntry)
    .notEmpty()
    .withMessage('Semester is required')
    .isInt({ min: 1, max: 10 })
    .withMessage('Semester must be a valid integer'),
  body('day')
    .notEmpty()
    .withMessage('Day is required')
    .isIn(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])
    .withMessage('Day must be a valid weekday'),
  body('startTime')
    .notEmpty()
    .withMessage('Start time is required')
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Start time must be in HH:MM format'),
  body('endTime')
    .notEmpty()
    .withMessage('End time is required')
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('End time must be in HH:MM format'),
  body('room')
    .if(isRegularEntry)
    .notEmpty()
    .withMessage('Room is required')
    .isString()
    .trim()
    .withMessage('Room must be a string'),
  body('teacherId')
    .if(isRegularEntry)
    .notEmpty()
    .withMessage('Teacher ID is required')
    .isMongoId()
    .withMessage('Invalid teacher ID format'),
  body('subjectId')
    .if(isRegularEntry)
    .notEmpty()
    .withMessage('Subject ID is required')
    .isMongoId()
    .withMessage('Invalid subject ID format'),
  body('isNoClass')
    .optional()
    .isBoolean()
    .withMessage('isNoClass must be a boolean'),
];

const updateEntry = [
  param('id')
    .notEmpty()
    .withMessage('Timetable entry ID is required')
    .isMongoId()
    .withMessage('Invalid timetable entry ID format'),
  body('section')
    .optional()
    .isString()
    .trim()
    .withMessage('Section must be a string'),
  body('courseCode')
    .if(isRegularEntry)
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .withMessage('Course code must be a string'),
  body('courseId')
    .if(isRegularEntry)
    .optional({ values: 'falsy' })
    .isMongoId()
    .withMessage('Invalid course ID format'),
  body('branch')
    .if(isRegularEntry)
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .withMessage('Branch must be a string'),
  body('semester')
    .if(isRegularEntry)
    .optional({ values: 'falsy' })
    .isInt({ min: 1, max: 10 })
    .withMessage('Semester must be a valid integer'),
  body('day')
    .optional()
    .isIn(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])
    .withMessage('Day must be a valid weekday'),
  body('startTime')
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Start time must be in HH:MM format'),
  body('endTime')
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('End time must be in HH:MM format'),
  body('room')
    .if(isRegularEntry)
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .withMessage('Room must be a string'),
  body('teacherId')
    .if(isRegularEntry)
    .optional({ values: 'falsy' })
    .isMongoId()
    .withMessage('Invalid teacher ID format'),
  body('subjectId')
    .if(isRegularEntry)
    .optional({ values: 'falsy' })
    .isMongoId()
    .withMessage('Invalid subject ID format'),
  body('isNoClass')
    .optional()
    .isBoolean()
    .withMessage('isNoClass must be a boolean'),
];

const bulkCreate = [
  body('entries')
    .isArray({ min: 1 })
    .withMessage('Entries must be a non-empty array'),
  body('entries.*.section')
    .notEmpty()
    .withMessage('Section is required for each entry')
    .isString()
    .trim()
    .withMessage('Section must be a string'),
  body('entries.*.courseCode')
    .if(isRegularBulkEntry)
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .withMessage('Course code must be a string'),
  body('entries.*.courseId')
    .if(isRegularBulkEntry)
    .optional({ values: 'falsy' })
    .isMongoId()
    .withMessage('Invalid course ID format'),
  body('entries.*.branch')
    .if(isRegularBulkEntry)
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .withMessage('Branch must be a string'),
  body('entries.*.semester')
    .if(isRegularBulkEntry)
    .optional({ values: 'falsy' }),
  body('entries.*.day')
    .notEmpty()
    .withMessage('Day is required for each entry')
    .isIn(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])
    .withMessage('Day must be a valid weekday'),
  body('entries.*.startTime')
    .notEmpty()
    .withMessage('Start time is required for each entry')
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Start time must be in HH:MM format'),
  body('entries.*.endTime')
    .notEmpty()
    .withMessage('End time is required for each entry')
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('End time must be in HH:MM format'),
  body('entries.*.room')
    .if(isRegularBulkEntry)
    .optional({ values: 'falsy' })
    .customSanitizer(v => String(v))
    .isString()
    .trim()
    .withMessage('Room must be a string'),
  body('entries.*.teacherId')
    .if(isRegularBulkEntry)
    .optional({ values: 'falsy' })
    .customSanitizer(v => String(v))
    .isString()
    .trim()
    .withMessage('Teacher ID must be a string'),
  body('entries.*.subjectId')
    .if(isRegularBulkEntry)
    .optional({ values: 'falsy' })
    .customSanitizer(v => String(v))
    .isString()
    .trim()
    .withMessage('Subject ID must be a string'),
  body('entries.*.isNoClass')
    .optional()
    .isBoolean()
    .withMessage('isNoClass must be a boolean'),
];

const getBySection = [
  param('section')
    .notEmpty()
    .withMessage('Section is required')
    .isString()
    .trim()
    .withMessage('Section must be a string'),
  query('semester')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Semester must be a valid integer'),
  query('branch')
    .optional()
    .isString()
    .trim()
    .withMessage('Branch must be a string'),
  query('courseCode')
    .optional()
    .isString()
    .trim()
    .withMessage('Course code must be a string'),
];

const getAll = [
  query('section')
    .optional()
    .isString()
    .trim()
    .withMessage('Section must be a string'),
  query('semester')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Semester must be a valid integer'),
  query('branch')
    .optional()
    .isString()
    .trim()
    .withMessage('Branch must be a string'),
  query('courseCode')
    .optional()
    .isString()
    .trim()
    .withMessage('Course code must be a string'),
  query('teacherId')
    .optional()
    .isMongoId()
    .withMessage('Invalid teacher ID format'),
];

module.exports = {
  createEntry,
  updateEntry,
  bulkCreate,
  getBySection,
  getAll,
};