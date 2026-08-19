const { body, param, query } = require('express-validator');

/**
 * Support validation schemas
 */

const createSupportTicket = [
  body('subject')
    .notEmpty()
    .withMessage('Subject is required')
    .isString()
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Subject must be between 5 and 200 characters'),
  body('description')
    .notEmpty()
    .withMessage('Description is required')
    .isString()
    .trim()
    .isLength({ min: 10, max: 5000 })
    .withMessage('Description must be between 10 and 5000 characters'),
  body('category')
    .notEmpty()
    .withMessage('Category is required')
    .isIn(['billing', 'technical', 'account', 'feature_request', 'other'])
    .withMessage('Category must be one of: billing, technical, account, feature_request, other'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Priority must be one of: low, medium, high, urgent'),
];

const updateSupportTicket = [
  param('id')
    .notEmpty()
    .withMessage('Ticket ID is required')
    .isMongoId()
    .withMessage('Invalid ticket ID format'),
  body('status')
    .optional()
    .isIn(['open', 'in_progress', 'resolved', 'closed'])
    .withMessage('Status must be one of: open, in_progress, resolved, closed'),
  body('response')
    .optional()
    .isString()
    .trim()
    .withMessage('Response must be a string'),
  body('assignedTo')
    .optional()
    .isMongoId()
    .withMessage('Invalid assignedTo ID format'),
];

const getSupportTickets = [
  query('status')
    .optional()
    .isIn(['open', 'in_progress', 'resolved', 'closed'])
    .withMessage('Status must be one of: open, in_progress, resolved, closed'),
  query('category')
    .optional()
    .isIn(['billing', 'technical', 'account', 'feature_request', 'other'])
    .withMessage('Category must be one of: billing, technical, account, feature_request, other'),
  query('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Priority must be one of: low, medium, high, urgent'),
];

module.exports = {
  createSupportTicket,
  updateSupportTicket,
  getSupportTickets,
};