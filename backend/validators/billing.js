const { body, param, query } = require('express-validator');

/**
 * Billing validation schemas
 */

const createSubscriptionOrder = [
  body('planCode')
    .notEmpty()
    .withMessage('Plan code is required')
    .isIn(['free', 'basic', 'professional', 'enterprise'])
    .withMessage('Plan code must be one of: free, basic, professional, enterprise'),
  body('billingCycle')
    .notEmpty()
    .withMessage('Billing cycle is required')
    .isIn(['monthly', 'yearly'])
    .withMessage('Billing cycle must be monthly or yearly'),
];

const verifyPayment = [
  body('razorpay_order_id')
    .notEmpty()
    .withMessage('Razorpay order ID is required')
    .isString()
    .withMessage('Razorpay order ID must be a string'),
  body('razorpay_payment_id')
    .notEmpty()
    .withMessage('Razorpay payment ID is required')
    .isString()
    .withMessage('Razorpay payment ID must be a string'),
  body('razorpay_signature')
    .notEmpty()
    .withMessage('Razorpay signature is required')
    .isString()
    .withMessage('Razorpay signature must be a string'),
];

const updateSubscription = [
  body('planCode')
    .notEmpty()
    .withMessage('Plan code is required')
    .isIn(['free', 'basic', 'professional', 'enterprise'])
    .withMessage('Plan code must be one of: free, basic, professional, enterprise'),
  body('billingCycle')
    .optional()
    .isIn(['monthly', 'yearly'])
    .withMessage('Billing cycle must be monthly or yearly'),
];

const continueFree = [
  body('tenantId')
    .notEmpty()
    .withMessage('Tenant ID is required')
    .isMongoId()
    .withMessage('Invalid tenant ID format'),
];

module.exports = {
  createSubscriptionOrder,
  verifyPayment,
  updateSubscription,
  continueFree,
};