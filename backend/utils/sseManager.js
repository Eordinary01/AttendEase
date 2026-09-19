const crypto = require('crypto');
const logger = require('./logger');

/**
 * Hardened SSE Manager for multi-tenant, authenticated Server-Sent Events.
 *
 * Core capabilities:
 * - O(1) Tenant-indexed subscriber lookup (tenantClients Map)
 * - Single-connection-per-user deduplication (userClients Map)
 * - Per-client bounded queue (backpressure management with overflow dropping)
 * - Microbatch write coalescing via setImmediate for burst / mass events
 * - Role-based event pattern matching
 * - Automatic 20s heartbeat keepalive (comment-only, ignores proxy timeouts)
 * - 50-minute connection lifespan with graceful reconnect triggering
 * - Clean teardown & graceful server shutdown integration
 */

const MAX_CLIENTS_PER_TENANT = parseInt(process.env.SSE_MAX_CLIENTS_PER_TENANT, 10) || 5000;
const MAX_QUEUE_SIZE = 50;
const CONNECTION_MAX_AGE_MS = 50 * 60 * 1000; // 50 mins
const HEARTBEAT_INTERVAL_MS = 20 * 1000; // 20s

// In-memory indexes
const clients = new Map(); // sessionId -> SseClient
const tenantClients = new Map(); // tenantId -> Set<sessionId>
const userClients = new Map(); // userId -> sessionId

// Role event permission patterns
const ROLE_EVENT_PATTERNS = {
  student: ['attendance.*', 'exam.*', 'announcement.*', 'broadcast.*', 'alert.*', 'leave.*', 'ticket.*', 'risk.*'],
  parent: ['attendance.*', 'exam.*', 'announcement.*', 'broadcast.*', 'alert.*', 'leave.*', 'ticket.*', 'risk.*'],
  teacher: ['attendance.*', 'exam.*', 'announcement.*', 'broadcast.*', 'alert.*', 'leave.*', 'ticket.*', 'absence.*', 'risk.*'],
  admin: ['*'],
  super_admin: ['*'],
};

/**
 * Check if a role is permitted to receive a specific event name.
 * @param {string} role
 * @param {string} eventName
 * @returns {boolean}
 */
function isEventAllowedForRole(role, eventName) {
  if (!role) return false;
  const patterns = ROLE_EVENT_PATTERNS[role] || [];
  for (const pattern of patterns) {
    if (pattern === '*') return true;
    if (pattern.endsWith('.*')) {
      const prefix = pattern.slice(0, -2);
      if (eventName === prefix || eventName.startsWith(`${prefix}.`)) {
        return true;
      }
    } else if (pattern === eventName) {
      return true;
    }
  }
  return false;
}

class SseClient {
  constructor({ req, res, sessionId, tenantId, userId, role, section, courseId, branch, subjectId, eventNames }) {
    this.req = req;
    this.res = res;
    this.sessionId = sessionId;
    this.tenantId = String(tenantId);
    this.userId = String(userId);
    this.role = role || 'unknown';
    this.section = section ? String(section).trim().toUpperCase() : '';
    this.courseId = courseId ? String(courseId) : '';
    this.branch = branch ? String(branch).trim().toUpperCase() : '';
    this.subjectId = subjectId ? String(subjectId) : '';
    // If eventNames is provided and not empty, client only wants these specific events
    this.eventNames = eventNames && eventNames.length > 0 ? new Set(eventNames) : null;
    this.connectedAt = Date.now();
    this.lastActivityAt = Date.now();
    this.isClosed = false;

    // Backpressure queue
    this.queue = [];
    this.isDraining = false;
    this.droppedCount = 0;
    this.isScheduled = false;

    // Heartbeat timer
    this.heartbeatTimer = null;
  }

  isExpired() {
    return Date.now() - this.connectedAt > CONNECTION_MAX_AGE_MS;
  }

  isStale(staleThresholdMs = 60000) {
    return Date.now() - this.lastActivityAt > staleThresholdMs;
  }

  /**
   * Enqueue an event for writing to the client stream.
   * Handles role filtering, explicit subscription filtering, and backpressure dropping.
   *
   * @param {string} eventName
   * @param {unknown} data
   * @param {string} [dedupeId]
   * @returns {boolean} Whether the event was accepted into the queue
   */
  enqueue(eventName, data, dedupeId) {
    if (this.isClosed) return false;

    // 1. Role permission check
    if (!isEventAllowedForRole(this.role, eventName)) {
      return false;
    }

    // 2. Client explicit subscription filter (if specified)
    if (this.eventNames && !this.eventNames.has(eventName)) {
      return false;
    }

    // 3. Backpressure check: if queue is full, drop the oldest event
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      this.queue.shift();
      this.droppedCount += 1;
      logger.warn('SSE client queue overflow, dropped oldest event', {
        sessionId: this.sessionId,
        userId: this.userId,
        droppedTotal: this.droppedCount,
      });

      // Insert dropped notification if not already in queue
      if (!this.queue.some(item => item.eventName === 'events.dropped')) {
        this.queue.push({
          eventName: 'events.dropped',
          payload: JSON.stringify({ droppedCount: this.droppedCount }),
          dedupeId: `dropped:${Date.now()}`,
        });
      }
    }

    let payloadString;
    try {
      payloadString = typeof data === 'string' ? data : JSON.stringify(data);
    } catch (err) {
      logger.error('Failed to serialize SSE payload', { eventName, error: err.message });
      return false;
    }

    this.queue.push({
      eventName,
      payload: payloadString,
      dedupeId: dedupeId || `${eventName}:${Date.now()}:${crypto.randomBytes(4).toString('hex')}`,
    });

    // Fast-path: If queue is shallow (<=1) and socket is idle, write immediately
    // without waiting for setImmediate event loop cycle.
    if (this.queue.length <= 1 && !this.isDraining && !this.isScheduled && !this.isClosed) {
      this.drain();
    } else {
      this.scheduleDrain();
    }
    return true;
  }

  scheduleDrain() {
    if (this.isScheduled || this.isDraining || this.isClosed) return;
    this.isScheduled = true;
    setImmediate(() => {
      this.isScheduled = false;
      this.drain();
    });
  }

  drain() {
    if (this.isClosed || this.isDraining || this.queue.length === 0) return;
    this.isDraining = true;

    try {
      while (this.queue.length > 0) {
        if (this.res.writableEnded || this.res.destroyed) {
          this.close('socket_destroyed');
          return;
        }

        const item = this.queue[0];
        const formatted = `id: ${item.dedupeId}\nevent: ${item.eventName}\ndata: ${item.payload}\n\n`;

        this.lastActivityAt = Date.now();
        const canContinue = this.res.write(formatted);
        this.queue.shift();

        if (!canContinue) {
          // Socket buffer full; wait for drain before continuing
          this.res.once('drain', () => {
            this.isDraining = false;
            this.drain();
          });
          return;
        }
      }
    } catch (err) {
      logger.warn('Error writing SSE stream, closing client', {
        sessionId: this.sessionId,
        error: err.message,
      });
      this.close('write_error');
    } finally {
      this.isDraining = false;
    }
  }

  heartbeat() {
    if (this.isClosed) return false;
    try {
      if (this.res.writableEnded || this.res.destroyed) {
        this.close('socket_destroyed');
        return false;
      }
      this.res.write(':heartbeat\n\n');
      this.lastActivityAt = Date.now();
      return true;
    } catch {
      this.close('heartbeat_failure');
      return false;
    }
  }

  close(reason = 'normal') {
    if (this.isClosed) return;
    this.isClosed = true;

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    try {
      if (!this.res.writableEnded && !this.res.destroyed) {
        this.res.write(`event: close\ndata: ${JSON.stringify({ reason })}\n\n`);
        this.res.end();
      }
    } catch {
      // Socket may already be dead
    }

    removeClient(this.sessionId);
  }
}

function generateSessionId() {
  try {
    return crypto.randomBytes(24).toString('hex');
  } catch {
    return String(Date.now()) + Math.random().toString(36).slice(2);
  }
}

function addClient(client) {
  if (clients.has(client.sessionId)) {
    return false;
  }

  const tKey = client.tenantId;
  const tenantSet = tenantClients.get(tKey) || new Set();

  if (tenantSet.size >= MAX_CLIENTS_PER_TENANT) {
    logger.warn('SSE connection rejected: tenant limit reached', {
      tenantId: tKey,
      limit: MAX_CLIENTS_PER_TENANT,
    });
    return false;
  }

  // Single-connection-per-user dedup: If user already has an active SSE connection, close it
  const existingSessionId = userClients.get(client.userId);
  if (existingSessionId && existingSessionId !== client.sessionId) {
    const existingClient = clients.get(existingSessionId);
    if (existingClient) {
      logger.info('Superseding previous SSE connection for user', {
        userId: client.userId,
        oldSessionId: existingSessionId,
        newSessionId: client.sessionId,
      });
      existingClient.close('superseded');
    }
  }

  clients.set(client.sessionId, client);
  tenantSet.add(client.sessionId);
  tenantClients.set(tKey, tenantSet);
  userClients.set(client.userId, client.sessionId);

  return true;
}

function removeClient(sessionId) {
  const client = clients.get(sessionId);
  if (!client) return;

  clients.delete(sessionId);

  // Remove from tenant index
  const tenantSet = tenantClients.get(client.tenantId);
  if (tenantSet) {
    tenantSet.delete(sessionId);
    if (tenantSet.size === 0) {
      tenantClients.delete(client.tenantId);
    }
  }

  // Remove from user index
  if (userClients.get(client.userId) === sessionId) {
    userClients.delete(client.userId);
  }
}

/**
 * Subscribe an authenticated Express request to SSE.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {string[]} [eventNames]
 * @returns {{ sessionId: string, close: (reason?: string) => void } | null}
 */
function subscribe(req, res, eventNames = []) {
  const user = req.user || {};
  const tenantId = user.tenantId ? String(user.tenantId) : 'global';
  const userId = user._id ? String(user._id) : (user.userId ? String(user.userId) : 'anonymous');
  const role = user.role || 'unknown';
  const section = user.section ? String(user.section).trim().toUpperCase() : '';
  const courseId = user.courseId ? String(user.courseId) : '';
  const branch = user.branch ? String(user.branch).trim().toUpperCase() : '';
  const subjectId = user.subjectId ? String(user.subjectId) : '';

  const sessionId = generateSessionId();
  const client = new SseClient({
    req,
    res,
    sessionId,
    tenantId,
    userId,
    role,
    section,
    courseId,
    branch,
    eventNames,
  });

  const accepted = addClient(client);
  if (!accepted) {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      message: 'Too many concurrent real-time connections for tenant',
    }));
    return null;
  }

  // Set SSE response headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  // Initial connection handshake
  res.write(`: connected\nid: init:${sessionId}\nevent: system.ready\ndata: ${JSON.stringify({ sessionId, connectedAt: new Date().toISOString() })}\n\n`);

  // Start keepalive heartbeat
  client.heartbeatTimer = setInterval(() => {
    if (client.isExpired()) {
      client.close('max_age_reached');
    } else {
      client.heartbeat();
    }
  }, HEARTBEAT_INTERVAL_MS);

  const cleanup = () => {
    client.close('connection_closed');
  };

  req.on('close', cleanup);
  res.on('close', cleanup);
  res.on('error', (err) => {
    logger.warn('SSE socket error', { sessionId, error: err.message });
    cleanup();
  });

  return {
    sessionId,
    close: (reason) => client.close(reason),
  };
}

/**
 * Checks if an SSE client matches target filtering criteria.
 * @param {SseClient} client
 * @param {object|null} targetFilter
 * @returns {boolean}
 */
function isMatchTargetFilter(client, targetFilter) {
  if (!targetFilter) return true;

  // 1. Target Users: if specified and not empty, client must be in targetUsers
  if (Array.isArray(targetFilter.targetUsers) && targetFilter.targetUsers.length > 0) {
    const isTargetUser = targetFilter.targetUsers.some((u) => String(u) === String(client.userId));
    if (!isTargetUser) return false;
  }

  // 2. Target Roles: if specified and not empty, client's role must be in targetRoles
  if (Array.isArray(targetFilter.targetRoles) && targetFilter.targetRoles.length > 0) {
    if (!targetFilter.targetRoles.includes(client.role)) {
      return false;
    }
  }

  // 3. Academic targeting for students (sections, course, branch, subject)
  if (client.role === 'student') {
    // Check targetSections
    if (Array.isArray(targetFilter.targetSections) && targetFilter.targetSections.length > 0) {
      if (!client.section) return false;
      const matchSection = targetFilter.targetSections.some(
        (s) => String(s).trim().toUpperCase() === client.section
      );
      if (!matchSection) return false;
    }

    // Check targetCourseIds
    if (Array.isArray(targetFilter.targetCourseIds) && targetFilter.targetCourseIds.length > 0) {
      if (!client.courseId) return false;
      const matchCourse = targetFilter.targetCourseIds.some(
        (c) => String(c) === client.courseId
      );
      if (!matchCourse) return false;
    }

    // Check targetBranches
    if (Array.isArray(targetFilter.targetBranches) && targetFilter.targetBranches.length > 0) {
      if (!client.branch) return false;
      const branchCodeMap = {
        CSE: ['CSE', 'CS', 'COMPUTER SCIENCE', 'COMPUTER SCIENCE & ENGINEERING'],
        'COMPUTER SCIENCE': ['CSE', 'CS', 'COMPUTER SCIENCE', 'COMPUTER SCIENCE & ENGINEERING'],
        CHEM: ['CHEM', 'CHEMISTRY'],
        CHEMISTRY: ['CHEM', 'CHEMISTRY'],
        ME: ['ME', 'MECHANICAL', 'MECHANICAL ENGINEERING'],
        ECE: ['ECE', 'ELECTRONICS'],
        CIVIL: ['CIVIL', 'CIVIL ENGINEERING'],
      };
      const validBranches = branchCodeMap[client.branch] || [client.branch];
      const matchBranch = targetFilter.targetBranches.some((b) =>
        validBranches.includes(String(b).trim().toUpperCase())
      );
      if (!matchBranch) return false;
    }

    // Check targetSubjectIds
    if (Array.isArray(targetFilter.targetSubjectIds) && targetFilter.targetSubjectIds.length > 0) {
      if (!client.subjectId) return false;
      const matchSubject = targetFilter.targetSubjectIds.some(
        (s) => String(s) === client.subjectId
      );
      if (!matchSubject) return false;
    }
  }

  return true;
}

/**
 * Publish an event locally to connected SSE clients.
 * Uses O(1) tenant set index. If tenantId is null or 'global', broadcasts to all tenants.
 * Supports sender exclusion and target-aware filtering.
 *
 * @param {string|null} tenantId
 * @param {string} eventName
 * @param {unknown} payload
 * @param {string} [dedupeId]
 * @param {object} [targetFilter]
 * @param {string} [excludeUserId]
 * @returns {number} sentCount
 */
function publishLocal(tenantId, eventName, payload = {}, dedupeId, targetFilter = null, excludeUserId = null) {
  let sentCount = 0;

  const handleClient = (client) => {
    // 1. Sender / Actor exclusion: sender should not receive live notification for their own action
    if (excludeUserId && String(client.userId) === String(excludeUserId)) {
      return false;
    }

    // 2. Target-aware filtering
    if (targetFilter && !isMatchTargetFilter(client, targetFilter)) {
      return false;
    }

    return client.enqueue(eventName, payload, dedupeId);
  };

  if (tenantId && tenantId !== 'global') {
    const tKey = String(tenantId);
    const sessionIds = tenantClients.get(tKey);
    if (sessionIds && sessionIds.size > 0) {
      for (const sessionId of sessionIds) {
        const client = clients.get(sessionId);
        if (!client) continue;
        if (handleClient(client)) {
          sentCount += 1;
        }
      }
    }
  } else {
    // Broadcast across all tenants (e.g. platform alert or global announcement)
    for (const [_, client] of clients) {
      if (handleClient(client)) {
        sentCount += 1;
      }
    }
  }

  return sentCount;
}

/**
 * Public publish function (backward-compatible signature).
 *
 * @param {string} tenantId
 * @param {string} eventName
 * @param {unknown} payload
 * @param {string} [dedupeId]
 * @param {object} [targetFilter]
 * @param {string} [excludeUserId]
 * @returns {number}
 */
function publish(tenantId, eventName, payload = {}, dedupeId, targetFilter = null, excludeUserId = null) {
  return publishLocal(tenantId, eventName, payload, dedupeId, targetFilter, excludeUserId);
}

/**
 * Reap stale, dead, or expired clients.
 * Called periodically from index.js background interval.
 */
function reapStaleClients() {
  const now = Date.now();
  let reaped = 0;

  for (const [sessionId, client] of clients) {
    if (client.isExpired() || client.isStale(60000) || client.res.destroyed || client.res.writableEnded) {
      client.close('stale_reaped');
      reaped += 1;
    }
  }

  if (reaped > 0) {
    logger.debug('SSE stale clients reaped', { count: reaped, remaining: clients.size });
  }
}

/**
 * Gracefully close all client streams.
 * Called on SIGTERM / SIGINT shutdown.
 *
 * @param {string} [reason='server_shutdown']
 */
function closeAll(reason = 'server_shutdown') {
  logger.info('Closing all SSE connections...', { count: clients.size });
  for (const [_, client] of clients) {
    try {
      client.close(reason);
    } catch {
      // ignore
    }
  }
  clients.clear();
  tenantClients.clear();
  userClients.clear();
}

/**
 * Connection statistics for monitoring and health endpoints.
 */
function getStats() {
  const tenantCounts = {};
  for (const [tId, set] of tenantClients) {
    tenantCounts[tId] = set.size;
  }
  return {
    totalClients: clients.size,
    totalTenants: tenantClients.size,
    tenantCounts,
  };
}

module.exports = {
  subscribe,
  publish,
  publishLocal,
  reapStaleClients,
  closeAll,
  getStats,
  isEventAllowedForRole,
  isMatchTargetFilter,
  SseClient,
  ROLE_EVENT_PATTERNS,
};
