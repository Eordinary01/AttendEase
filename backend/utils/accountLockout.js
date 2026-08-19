/**
 * Account lockout utility
 * Tracks failed login attempts and temporarily locks accounts
 * Uses in-memory Map (resets on server restart — acceptable for single-server)
 */

const logger = require('./logger');

const MAX_ATTEMPTS = parseInt(process.env.LOCKOUT_MAX_ATTEMPTS, 10) || 5;
const LOCKOUT_DURATION_MS = parseInt(process.env.LOCKOUT_DURATION_MIN, 10) * 60 * 1000 || 15 * 60 * 1000;

// key: "email:tenantId", value: { attempts, lockedUntil }
const attempts = new Map();

function getKey(email, tenantId) {
  return `${(email || '').toLowerCase()}:${tenantId || 'global'}`;
}

function isLockedOut(email, tenantId) {
  const key = getKey(email, tenantId);
  const record = attempts.get(key);
  if (!record) return false;

  if (record.lockedUntil && Date.now() < record.lockedUntil) {
    const remainingMs = record.lockedUntil - Date.now();
    const remainingMin = Math.ceil(remainingMs / 60000);
    return { locked: true, remainingMinutes: remainingMin };
  }

  if (record.lockedUntil && Date.now() >= record.lockedUntil) {
    attempts.delete(key);
    return false;
  }

  return false;
}

function recordFailedAttempt(email, tenantId) {
  const key = getKey(email, tenantId);
  const record = attempts.get(key) || { attempts: 0, lockedUntil: null };

  record.attempts += 1;

  if (record.attempts >= MAX_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
    logger.warn('Account locked out', { email, tenantId, attempts: record.attempts, lockoutMinutes: LOCKOUT_DURATION_MS / 60000 });
  }

  attempts.set(key, record);
  return record;
}

function clearAttempts(email, tenantId) {
  const key = getKey(email, tenantId);
  attempts.delete(key);
}

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of attempts.entries()) {
    if (record.lockedUntil && now >= record.lockedUntil) {
      attempts.delete(key);
    }
  }
}, 5 * 60 * 1000);

module.exports = { isLockedOut, recordFailedAttempt, clearAttempts, MAX_ATTEMPTS, LOCKOUT_DURATION_MS };
