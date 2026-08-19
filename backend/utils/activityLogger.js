const APILog = require('../models/APILog');

/**
 * Log a meaningful business event to the activity log.
 * Use for events that happen outside the request logger scope
 * (e.g. public logins, tenant registration) or to add richer context.
 */
async function logActivity({
  tenantId,
  userId,
  description,
  endpoint = '',
  method = 'ACTION',
  statusCode = 200,
  ipAddress,
  userAgent,
  responseTime,
}) {
  try {
    await APILog.create({
      tenantId: tenantId || null,
      userId: userId || null,
      description,
      endpoint,
      method: 'ACTION',
      statusCode,
      ipAddress,
      userAgent,
      responseTime: responseTime || 0,
    });
  } catch (error) {
    // Logging must never break the main flow
  }
}

module.exports = { logActivity };
