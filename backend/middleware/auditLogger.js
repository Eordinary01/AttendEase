const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');

/**
 * Asynchronously log an audit event without blocking the primary request response flow.
 */
const logAudit = async (req, { action, resourceType, resourceId, before, after }) => {
  try {
    const actorUserId = req?.user?.userId || req?.user?._id || null;
    const actorRole = req?.user?.role || 'system';
    const tenantId = req?.tenantId || req?.user?.tenantId || null;
    const ip = req?.ip || req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || '';
    const userAgent = req?.headers?.['user-agent'] || '';
    const requestId = req?.headers?.['x-request-id'] || req?.id || '';

    await AuditLog.create({
      actorUserId,
      actorRole,
      tenantId,
      action,
      resourceType,
      resourceId: resourceId ? String(resourceId) : undefined,
      before: before ? JSON.parse(JSON.stringify(before)) : undefined,
      after: after ? JSON.parse(JSON.stringify(after)) : undefined,
      ip,
      userAgent,
      requestId,
    });
  } catch (error) {
    // Audit logging should never crash the main application request flow
    logger.error('Audit log write failed', { error: error.message });
  }
};

module.exports = { logAudit };
