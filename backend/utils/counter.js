/**
 * Atomic counter utility
 * Uses MongoDB findOneAndUpdate with $inc to generate unique sequential numbers
 * Prevents race conditions from concurrent requests
 */

const Counter = require('../models/Counter');

/**
 * Get the next sequential number for a given counter name and tenant
 * @param {string} tenantId
 * @param {string} prefix - e.g. 'RCP', 'INV'
 * @param {number} padLength - zero-pad length (default 5)
 * @returns {Promise<string>} e.g. 'RCP-2026-00001'
 */
async function getNextSequence(tenantId, prefix, padLength = 5) {
  const year = new Date().getFullYear();
  const counterId = `${tenantId}:${prefix}:${year}`;

  const counter = await Counter.findOneAndUpdate(
    { _id: counterId },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  return `${prefix}-${year}-${String(counter.seq).padStart(padLength, '0')}`;
}

module.exports = { getNextSequence };
