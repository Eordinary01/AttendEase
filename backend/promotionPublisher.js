/**
 * Re-export from events/publishers.js for backward compatibility.
 */
const { publishPromotionCompleted } = require('./events/publishers');

module.exports = { publishPromotionCompleted };
