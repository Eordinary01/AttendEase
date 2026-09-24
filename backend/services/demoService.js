/**
 * Demo Sandbox Slot Management Service
 *
 * Implements atomic, concurrency-safe per-role slot locking using Redis (SET NX EX)
 * with automatic, seamless fallback to an in-memory TTL Map when Redis is unavailable.
 */

const { getSharedRedisClient } = require('../utils/redisClient');
const logger = require('../utils/logger');

const VALID_ROLES = ['student', 'teacher', 'admin', 'parent'];
const DEFAULT_DURATION_SECONDS = parseInt(process.env.DEMO_SESSION_DURATION_SECONDS, 10) || 900; // 15 minutes

// In-Memory Fallback Store (for local dev or when Redis is offline)
const inMemorySlots = new Map();

/**
 * Clean up expired in-memory slot if needed
 */
function cleanInMemorySlot(role) {
  const slot = inMemorySlots.get(role);
  if (slot && Date.now() >= slot.expiresAt) {
    if (slot.timer) clearTimeout(slot.timer);
    inMemorySlots.delete(role);
    return null;
  }
  return slot;
}

/**
 * Returns active Redis client if ready
 */
function getActiveRedis() {
  const redis = getSharedRedisClient();
  if (redis && (redis.status === 'ready' || redis.status === 'connect')) {
    return redis;
  }
  return null;
}

/**
 * Claim a demo role slot atomically
 * @param {string} role - 'student' | 'teacher' | 'admin' | 'parent'
 * @param {string} sessionId - Unique identifier for the visitor's session
 * @param {string} [ip] - Visitor IP
 * @param {number} [durationSeconds] - Session duration in seconds
 * @returns {Promise<{ success: boolean, slot?: object, error?: string, remainingSeconds?: number }>}
 */
async function claimSlot(role, sessionId, ip = '', durationSeconds = DEFAULT_DURATION_SECONDS) {
  if (!VALID_ROLES.includes(role)) {
    return { success: false, error: `Invalid demo role: ${role}` };
  }

  const now = Date.now();
  const expiresAt = now + durationSeconds * 1000;
  const slotData = {
    role,
    sessionId,
    ip,
    claimedAt: now,
    expiresAt,
    durationSeconds,
  };

  const redis = getActiveRedis();
  const slotKey = `demo:slot:${role}`;

  if (redis) {
    try {
      const serialized = JSON.stringify(slotData);
      // Atomic SET NX EX
      const result = await redis.set(slotKey, serialized, 'EX', durationSeconds, 'NX');

      if (result === 'OK') {
        logger.info(`[DemoService] Claimed Redis slot for role "${role}" (session: ${sessionId})`);
        return { success: true, slot: slotData };
      }

      // Key already exists — fetch current slot info
      const current = await redis.get(slotKey);
      if (current) {
        const parsed = JSON.parse(current);
        // If current slot belongs to the exact same session (e.g. reload or retry), allow re-entry
        if (parsed.sessionId === sessionId) {
          const ttl = await redis.ttl(slotKey);
          return {
            success: true,
            slot: { ...parsed, expiresAt: now + (ttl > 0 ? ttl * 1000 : durationSeconds * 1000) },
          };
        }

        const remainingSeconds = Math.max(0, Math.round((parsed.expiresAt - now) / 1000));
        return {
          success: false,
          error: 'SLOT_OCCUPIED',
          message: `The ${role} demo is currently being used by another visitor.`,
          remainingSeconds,
        };
      }
    } catch (err) {
      logger.warn(`[DemoService] Redis claim error, falling back to memory: ${err.message}`);
    }
  }

  // --- In-Memory Fallback ---
  const existing = cleanInMemorySlot(role);
  if (existing) {
    // If same session, allow re-entry
    if (existing.sessionId === sessionId) {
      return { success: true, slot: existing };
    }
    const remainingSeconds = Math.max(0, Math.round((existing.expiresAt - now) / 1000));
    return {
      success: false,
      error: 'SLOT_OCCUPIED',
      message: `The ${role} demo is currently being used by another visitor.`,
      remainingSeconds,
    };
  }

  const timer = setTimeout(() => {
    inMemorySlots.delete(role);
    logger.info(`[DemoService] In-memory slot expired for role "${role}"`);
  }, durationSeconds * 1000);

  const memorySlot = { ...slotData, timer };
  inMemorySlots.set(role, memorySlot);
  logger.info(`[DemoService] Claimed in-memory slot for role "${role}" (session: ${sessionId})`);
  return { success: true, slot: slotData };
}

/**
 * Release a demo slot only if owned by the requesting session
 * @param {string} role
 * @param {string} sessionId
 * @returns {Promise<{ success: boolean, message?: string }>}
 */
async function releaseSlot(role, sessionId) {
  if (!VALID_ROLES.includes(role)) {
    return { success: false, message: 'Invalid role' };
  }

  const redis = getActiveRedis();
  const slotKey = `demo:slot:${role}`;

  if (redis) {
    try {
      // Lua script for atomic check-and-delete
      const luaScript = `
        local current = redis.call('get', KEYS[1])
        if not current then return 1 end
        local decoded = cjson.decode(current)
        if decoded.sessionId == ARGV[1] then
          return redis.call('del', KEYS[1])
        else
          return 0
        end
      `;
      const res = await redis.eval(luaScript, 1, slotKey, sessionId);
      if (res === 1) {
        logger.info(`[DemoService] Released Redis slot for role "${role}" (session: ${sessionId})`);
        return { success: true, message: 'Slot released successfully' };
      } else {
        logger.warn(`[DemoService] Ownership mismatch on Redis release for "${role}"`);
        return { success: false, message: 'Slot is not owned by this session' };
      }
    } catch (err) {
      logger.warn(`[DemoService] Redis release error, checking memory: ${err.message}`);
    }
  }

  // --- In-Memory Fallback ---
  const existing = inMemorySlots.get(role);
  if (!existing) {
    return { success: true, message: 'Slot was already free' };
  }
  if (existing.sessionId === sessionId) {
    if (existing.timer) clearTimeout(existing.timer);
    inMemorySlots.delete(role);
    logger.info(`[DemoService] Released in-memory slot for role "${role}" (session: ${sessionId})`);
    return { success: true, message: 'Slot released successfully' };
  }

  return { success: false, message: 'Slot is not owned by this session' };
}

/**
 * Inspect status of a single demo slot
 * @param {string} role
 * @returns {Promise<{ role: string, isAvailable: boolean, remainingSeconds?: number }>}
 */
async function getSlotInfo(role) {
  if (!VALID_ROLES.includes(role)) {
    return { role, isAvailable: false, error: 'Invalid role' };
  }

  const now = Date.now();
  const redis = getActiveRedis();
  const slotKey = `demo:slot:${role}`;

  if (redis) {
    try {
      const current = await redis.get(slotKey);
      if (!current) {
        return { role, isAvailable: true };
      }
      const parsed = JSON.parse(current);
      const ttl = await redis.ttl(slotKey);
      const remainingSeconds = ttl > 0 ? ttl : Math.max(0, Math.round((parsed.expiresAt - now) / 1000));
      return {
        role,
        isAvailable: remainingSeconds <= 0,
        remainingSeconds,
      };
    } catch (err) {
      logger.warn(`[DemoService] Redis getSlotInfo error: ${err.message}`);
    }
  }

  // In-Memory fallback
  const existing = cleanInMemorySlot(role);
  if (!existing) {
    return { role, isAvailable: true };
  }
  const remainingSeconds = Math.max(0, Math.round((existing.expiresAt - now) / 1000));
  return {
    role,
    isAvailable: remainingSeconds <= 0,
    remainingSeconds,
  };
}

/**
 * Get status of all 4 demo slots simultaneously
 * @returns {Promise<Record<string, { isAvailable: boolean, remainingSeconds?: number }>>}
 */
async function getAllSlotsStatus() {
  const statuses = {};
  for (const role of VALID_ROLES) {
    statuses[role] = await getSlotInfo(role);
  }
  return statuses;
}

module.exports = {
  VALID_ROLES,
  DEFAULT_DURATION_SECONDS,
  claimSlot,
  releaseSlot,
  getSlotInfo,
  getAllSlotsStatus,
};
