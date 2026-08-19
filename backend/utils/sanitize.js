const mongoose = require("mongoose");

/**
 * Escapes special regex characters in a string to prevent ReDoS and injection
 * @param {string} str
 * @returns {string}
 */
function escapeRegExp(str) {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Ensures a given value is converted to a Mongoose ObjectId if valid
 * @param {any} id
 * @returns {mongoose.Types.ObjectId|any}
 */
function toObjectId(id) {
  if (!id) return id;
  if (id instanceof mongoose.Types.ObjectId) return id;
  if (typeof id === 'string' && mongoose.Types.ObjectId.isValid(id)) {
    return new mongoose.Types.ObjectId(id);
  }
  return id;
}

module.exports = { escapeRegExp, toObjectId };

