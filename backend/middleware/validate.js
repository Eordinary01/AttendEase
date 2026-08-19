const { validationResult } = require('express-validator');

/**
 * VALIDATE MIDDLEWARE
 * Generic middleware that checks the result of express-validator chains
 * and returns a consistent 400 error if validation fails.
 *
 * Usage:
 *   const { body } = require('express-validator');
 *   router.post('/',
 *     body('name').notEmpty().withMessage('Name is required'),
 *     body('email').isEmail().withMessage('Valid email is required'),
 *     validate,
 *     controller.create
 *   );
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((err) => ({
      field: err.path,
      message: err.msg,
      value: err.value !== undefined ? err.value : null,
    }));

    const messages = formattedErrors.map(e => e.message || (e.field ? `${e.field} is required` : "Invalid field"));
    const customMessage = messages.length === 1 
      ? messages[0] 
      : `Please fill in the required field(s): ${messages.join("; ")}`;

    return res.status(400).json({
      success: false,
      message: customMessage,
      errors: formattedErrors,
    });
  }

  next();
};

module.exports = validate;
