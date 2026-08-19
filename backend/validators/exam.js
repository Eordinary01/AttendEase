const { body, param, query } = require('express-validator');

/**
 * Exam validation schemas
 */

const createExam = [
  body('title')
    .notEmpty()
    .withMessage('Exam title is required')
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Exam title must be at most 100 characters'),
  body('subjectId')
    .notEmpty()
    .withMessage('Subject ID is required')
    .isMongoId()
    .withMessage('Invalid subject ID format'),
  body('subjectName')
    .notEmpty()
    .withMessage('Subject name is required')
    .isString()
    .trim()
    .withMessage('Subject name must be a string'),
  body('section')
    .notEmpty()
    .withMessage('Section is required')
    .isString()
    .trim()
    .withMessage('Section must be a string'),
  body('type')
    .optional()
    .isString()
    .trim()
    .withMessage('Exam type must be a string'),
  body('examTypeCode')
    .optional()
    .isString()
    .trim()
    .withMessage('Exam type code must be a string'),
  body('examPeriodId')
    .optional()
    .isString()
    .trim()
    .withMessage('Exam period ID must be a string'),
  body('courseId')
    .optional()
    .isString()
    .trim()
    .withMessage('Course ID must be a string'),
  body('branch')
    .optional()
    .isString()
    .trim()
    .withMessage('Branch must be a string'),
  body('semester')
    .optional({ checkFalsy: true })
    .customSanitizer(v => parseInt(v))
    .isInt({ min: 1, max: 12 })
    .withMessage('Semester must be between 1 and 12'),
  body('shift')
    .optional({ checkFalsy: true })
    .isIn(['I', 'II', 'III', 'IV'])
    .withMessage('Shift must be one of: I, II, III, IV'),
  body('duration')
    .optional({ checkFalsy: true })
    .customSanitizer(v => parseInt(v))
    .isInt({ min: 1 })
    .withMessage('Duration must be a positive integer (minutes)'),
  body('date')
    .notEmpty()
    .withMessage('Exam date is required')
    .customSanitizer((v) => {
      if (!v) return v;
      const d = new Date(v);
      return !isNaN(d.getTime()) ? d.toISOString() : v;
    })
    .isISO8601()
    .withMessage('Exam date must be a valid ISO 8601 date')
    .toDate(),
  body('startTime')
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Start time must be in HH:MM format'),
  body('endTime')
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('End time must be in HH:MM format'),
  body('maxMarks')
    .optional({ checkFalsy: true })
    .customSanitizer(v => parseInt(v))
    .isInt({ min: 1, max: 1000 })
    .withMessage('Maximum marks must be a positive integer'),
  body('room')
    .optional()
    .isString()
    .trim()
    .withMessage('Room must be a string'),
  body('description')
    .optional()
    .isString()
    .trim()
    .withMessage('Description must be a string'),
  body('isBacklog')
    .optional()
    .isBoolean()
    .withMessage('isBacklog must be a boolean'),
  body('invigilators')
    .optional()
    .isArray({ max: 2 })
    .withMessage('At most 2 invigilators allowed'),
  body('invigilators.*')
    .isMongoId()
    .withMessage('Invalid invigilator ID format'),
];

const updateExam = [
  param('id')
    .notEmpty()
    .withMessage('Exam ID is required')
    .isMongoId()
    .withMessage('Invalid exam ID format'),
  body('title')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Exam title must be at most 100 characters'),
  body('subjectId')
    .optional()
    .isMongoId()
    .withMessage('Invalid subject ID format'),
  body('section')
    .optional()
    .isString()
    .trim()
    .withMessage('Section must be a string'),
  body('type')
    .optional()
    .isString()
    .trim()
    .withMessage('Exam type must be a string'),
  body('examTypeCode')
    .optional()
    .isString()
    .trim()
    .withMessage('Exam type code must be a string'),
  body('shift')
    .optional()
    .isIn(['I', 'II', 'III', 'IV'])
    .withMessage('Shift must be one of: I, II, III, IV'),
  body('duration')
    .optional({ checkFalsy: true })
    .customSanitizer(v => parseInt(v))
    .isInt({ min: 1 })
    .withMessage('Duration must be a positive integer (minutes)'),
  body('courseId')
    .optional()
    .isString()
    .trim()
    .withMessage('Course ID must be a string'),
  body('branch')
    .optional()
    .isString()
    .trim()
    .withMessage('Branch must be a string'),
  body('semester')
    .optional({ checkFalsy: true })
    .customSanitizer(v => parseInt(v))
    .isInt({ min: 1, max: 12 })
    .withMessage('Semester must be between 1 and 12'),
  body('date')
    .optional()
    .isISO8601()
    .withMessage('Exam date must be a valid ISO 8601 date')
    .toDate(),
  body('startTime')
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Start time must be in HH:MM format'),
  body('endTime')
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('End time must be in HH:MM format'),
  body('maxMarks')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Maximum marks must be a positive integer'),
  body('room')
    .optional()
    .isString()
    .trim()
    .withMessage('Room must be a string'),
  body('description')
    .optional()
    .isString()
    .trim()
    .withMessage('Description must be a string'),
  body('invigilators')
    .optional()
    .isArray({ max: 2 })
    .withMessage('At most 2 invigilators allowed'),
  body('invigilators.*')
    .isMongoId()
    .withMessage('Invalid invigilator ID format'),
  body('isBacklog')
    .optional()
    .isBoolean()
    .withMessage('isBacklog must be a boolean'),
];

const bulkCreateExams = [
  body('exams')
    .isArray({ min: 1 })
    .withMessage('Exams must be a non-empty array'),
  body('exams.*.title')
    .notEmpty()
    .withMessage('Exam title is required for each exam')
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Exam title must be at most 100 characters'),
  body('exams.*.subjectId')
    .notEmpty()
    .withMessage('Subject ID is required for each exam')
    .isMongoId()
    .withMessage('Invalid subject ID format'),
  body('exams.*.subjectName')
    .notEmpty()
    .withMessage('Subject name is required for each exam')
    .isString()
    .trim()
    .withMessage('Subject name must be a string'),
  body('exams.*.section')
    .notEmpty()
    .withMessage('Section is required for each exam')
    .isString()
    .trim()
    .withMessage('Section must be a string'),
  body('exams.*.type')
    .optional()
    .isString()
    .trim()
    .withMessage('Exam type must be a string'),
  body('exams.*.shift')
    .optional({ checkFalsy: true })
    .isIn(['I', 'II', 'III', 'IV'])
    .withMessage('Shift must be one of: I, II, III, IV'),
  body('exams.*.duration')
    .optional({ checkFalsy: true })
    .customSanitizer(v => parseInt(v))
    .isInt({ min: 1 })
    .withMessage('Duration must be a positive integer (minutes)'),
  body('exams.*.date')
    .notEmpty()
    .withMessage('Exam date is required for each exam')
    .customSanitizer((v) => {
      if (!v) return v;
      // Handle Excel serial date numbers (e.g. 46266.229)
      const asNum = Number(v);
      if (!Number.isNaN(asNum) && asNum > 1000 && asNum < 2958465) {
        const ms = Math.round((asNum - 25569) * 86400000);
        const d = new Date(ms);
        if (!isNaN(d.getTime())) return d.toISOString();
      }
      const d = new Date(v);
      return !isNaN(d.getTime()) ? d.toISOString() : v;
    })
    .isISO8601()
    .withMessage('Exam date must be a valid ISO 8601 date')
    .toDate(),
  body('exams.*.startTime')
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Start time must be in HH:MM format'),
  body('exams.*.endTime')
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('End time must be in HH:MM format'),
  body('exams.*.maxMarks')
    .optional({ checkFalsy: true })
    .customSanitizer(v => parseInt(v))
    .isInt({ min: 1, max: 1000 })
    .withMessage('Maximum marks must be a positive integer'),
  body('exams.*.room')
    .optional()
    .isString()
    .trim()
    .withMessage('Room must be a string'),
  body('exams.*.invigilators')
    .optional()
    .isArray({ max: 2 })
    .withMessage('At most 2 invigilators allowed per exam'),
  body('exams.*.invigilators.*')
    .isMongoId()
    .withMessage('Invalid invigilator ID format'),
  body('exams.*.isBacklog')
    .optional()
    .isBoolean()
    .withMessage('isBacklog must be a boolean'),
];

const submitGrades = [
  param('examId')
    .notEmpty()
    .withMessage('Exam ID is required')
    .isMongoId()
    .withMessage('Invalid exam ID format'),
  body('results')
    .isArray({ min: 1 })
    .withMessage('Results must be a non-empty array'),
  body('results.*.studentId')
    .optional({ checkFalsy: true })
    .isMongoId()
    .withMessage('Invalid student ID format'),
  body('results.*.rollNo')
    .optional({ checkFalsy: true })
    .isString()
    .trim()
    .withMessage('Roll no must be a string'),
  body('results.*.marksObtained')
    .notEmpty()
    .withMessage('Marks obtained is required for each result')
    .isInt({ min: 0 })
    .withMessage('Marks obtained must be a non-negative integer'),
  body('results.*.maxMarks')
    .optional({ checkFalsy: true })
    .isInt({ min: 1 })
    .withMessage('Max marks must be a positive integer'),
  body('results.*.subjectCode')
    .optional({ checkFalsy: true })
    .isString()
    .trim()
    .withMessage('Subject code must be a string'),
  body('results.*.semester')
    .optional({ checkFalsy: true })
    .isInt({ min: 1 })
    .withMessage('Semester must be a positive integer'),
  body('results.*.remarks')
    .optional()
    .isString()
    .trim()
    .withMessage('Remarks must be a string'),
];

const publishExamResults = [
  param('examId')
    .notEmpty()
    .withMessage('Exam ID is required')
    .isMongoId()
    .withMessage('Invalid exam ID format'),
];

const unpublishExamResults = [
  param('examId')
    .notEmpty()
    .withMessage('Exam ID is required')
    .isMongoId()
    .withMessage('Invalid exam ID format'),
];

const updateResult = [
  param('examId')
    .notEmpty()
    .withMessage('Exam ID is required')
    .isMongoId()
    .withMessage('Invalid exam ID format'),
  param('studentId')
    .notEmpty()
    .withMessage('Student ID is required')
    .isMongoId()
    .withMessage('Invalid student ID format'),
  body('marksObtained')
    .optional()
    .customSanitizer(v => parseFloat(v))
    .isFloat({ min: 0 })
    .withMessage('Marks obtained must be a non-negative number'),
  body('maxMarks')
    .optional()
    .customSanitizer(v => parseInt(v))
    .isInt({ min: 1 })
    .withMessage('Max marks must be a positive integer'),
  body('remarks')
    .optional()
    .isString()
    .trim()
    .withMessage('Remarks must be a string'),
];

const getExams = [
  query('subjectId')
    .optional()
    .isMongoId()
    .withMessage('Invalid subject ID format'),
  query('section')
    .optional()
    .isString()
    .trim()
    .withMessage('Section must be a string'),
  query('examType')
    .optional()
    .isString()
    .trim()
    .withMessage('Exam type must be a string'),
  query('examTypeCode')
    .optional()
    .isString()
    .trim()
    .withMessage('Exam type code must be a string'),
  query('examPeriodId')
    .optional()
    .isMongoId()
    .withMessage('Invalid exam period ID format'),
  query('shift')
    .optional()
    .isIn(['I', 'II', 'III', 'IV'])
    .withMessage('Shift must be one of: I, II, III, IV'),
  query('courseId')
    .optional()
    .isMongoId()
    .withMessage('Invalid course ID format'),
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

const updateExamStructure = [
  body('examTypes')
    .optional()
    .isArray({ min: 1 })
    .withMessage('At least one exam type is required'),
  body('examTypes.*.name')
    .notEmpty()
    .withMessage('Exam type name is required')
    .isString()
    .trim(),
  body('examTypes.*.code')
    .notEmpty()
    .withMessage('Exam type code is required')
    .isString()
    .trim(),
  body('examTypes.*.defaultDuration')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Default duration must be a positive integer (minutes)'),
  body('examTypes.*.defaultMaxMarks')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Default max marks must be a positive integer'),
  body('shifts')
    .optional()
    .isArray({ min: 1 })
    .withMessage('At least one shift is required'),
  body('shifts.*.name')
    .notEmpty()
    .withMessage('Shift name is required')
    .isString()
    .trim(),
  body('shifts.*.startTime')
    .notEmpty()
    .withMessage('Shift start time is required')
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Start time must be in HH:MM format'),
  body('shifts.*.endTime')
    .notEmpty()
    .withMessage('Shift end time is required')
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('End time must be in HH:MM format'),
  body().custom((_, { req }) => {
    const { examTypes, shifts } = req.body || {};
    if (examTypes === undefined && shifts === undefined) {
      throw new Error('Provide examTypes and/or shifts to update');
    }
    return true;
  }),
];

const updateExamPeriods = [
  body('examPeriods')
    .isArray({ min: 1 })
    .withMessage('At least one exam period is required'),
  body('examPeriods.*.name')
    .notEmpty()
    .withMessage('Exam period name is required')
    .isString()
    .trim(),
  body('examPeriods.*.examTypeCode')
    .optional()
    .isString()
    .trim()
    .withMessage('Exam type code must be a string'),
  body('examPeriods.*.startDate')
    .notEmpty()
    .withMessage('Start date is required')
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date')
    .toDate(),
  body('examPeriods.*.endDate')
    .notEmpty()
    .withMessage('End date is required')
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
    .toDate(),
];

module.exports = {
  createExam,
  updateExam,
  bulkCreateExams,
  submitGrades,
  publishExamResults,
  unpublishExamResults,
  updateResult,
  getExams,
  updateExamStructure,
  updateExamPeriods,
};
