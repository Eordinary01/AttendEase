const { body, param, query } = require('express-validator');

const createFee = [
  body('fees')
    .isArray({ min: 1 })
    .withMessage('Fees must be a non-empty array'),
  body('fees.*.studentId')
    .notEmpty()
    .withMessage('Student ID is required')
    .isMongoId()
    .withMessage('Invalid student ID format'),
  body('fees.*.feeType')
    .optional()
    .isIn(['tuition', 'transport', 'hostel', 'other'])
    .withMessage('Fee type must be one of: tuition, transport, hostel, other'),
  body('fees.*.amount')
    .notEmpty()
    .withMessage('Amount is required')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number'),
  body('fees.*.dueDate')
    .notEmpty()
    .withMessage('Due date is required')
    .isISO8601()
    .withMessage('Due date must be a valid ISO 8601 date')
    .toDate(),
  body('fees.*.courseId')
    .optional()
    .isMongoId()
    .withMessage('Invalid course ID format'),
  body('fees.*.section')
    .optional()
    .isString()
    .trim()
    .withMessage('Section must be a string'),
  body('fees.*.semester')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Semester must be a positive integer'),
  body('fees.*.academicYear')
    .optional()
    .isString()
    .trim()
    .withMessage('Academic year must be a string'),
  body('fees.*.description')
    .optional()
    .isString()
    .trim()
    .withMessage('Description must be a string'),
];

const updateFee = [
  param('id')
    .notEmpty()
    .withMessage('Fee ID is required')
    .isMongoId()
    .withMessage('Invalid fee ID format'),
  body('feeType')
    .optional()
    .isIn(['tuition', 'exam', 'library', 'transport', 'hostel', 'lab', 'sports', 'other'])
    .withMessage('Fee type must be one of: tuition, exam, library, transport, hostel, lab, sports, other'),
  body('amount')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number'),
  body('dueDate')
    .optional()
    .isISO8601()
    .withMessage('Due date must be a valid ISO 8601 date')
    .toDate(),
  body('section')
    .optional()
    .isString()
    .trim()
    .withMessage('Section must be a string'),
  body('academicYear')
    .optional()
    .isString()
    .trim()
    .withMessage('Academic year must be a string'),
  body('description')
    .optional()
    .isString()
    .trim()
    .withMessage('Description must be a string'),
];

const waiveFee = [
  param('id')
    .notEmpty()
    .withMessage('Fee ID is required')
    .isMongoId()
    .withMessage('Invalid fee ID format'),
  body('waivedAmount')
    .notEmpty()
    .withMessage('Waived amount is required')
    .isFloat({ min: 0.01 })
    .withMessage('Waived amount must be a positive number'),
  body('reason')
    .notEmpty()
    .withMessage('Reason for waiver is required')
    .isString()
    .trim()
    .withMessage('Reason must be a string'),
];

const collectPayment = [
  param('id')
    .notEmpty()
    .withMessage('Fee ID is required')
    .isMongoId()
    .withMessage('Invalid fee ID format'),
  body('amount')
    .notEmpty()
    .withMessage('Amount paid is required')
    .isFloat({ min: 0.01 })
    .withMessage('Amount paid must be a positive number'),
  body('mode')
    .notEmpty()
    .withMessage('Payment mode is required')
    .isIn(['cash', 'card', 'upi', 'bank_transfer', 'cheque', 'online'])
    .withMessage('Payment mode must be one of: cash, card, upi, bank_transfer, cheque, online'),
  body('transactionId')
    .optional()
    .isString()
    .trim()
    .withMessage('Transaction ID must be a string'),
  body('notes')
    .optional()
    .isString()
    .trim()
    .withMessage('Notes must be a string'),
];

const getFees = [
  query('studentId')
    .optional()
    .isMongoId()
    .withMessage('Invalid student ID format'),
  query('section')
    .optional()
    .isString()
    .trim()
    .withMessage('Section must be a string'),
  query('feeType')
    .optional()
    .isIn(['tuition', 'exam', 'library', 'transport', 'hostel', 'lab', 'sports', 'other'])
    .withMessage('Fee type must be one of: tuition, exam, library, transport, hostel, lab, sports, other'),
  query('status')
    .optional()
    .isIn(['pending', 'partial', 'paid', 'waived', 'overdue'])
    .withMessage('Status must be one of: pending, partial, paid, waived, overdue'),
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

module.exports = {
  createFee,
  updateFee,
  waiveFee,
  collectPayment,
  getFees,
};