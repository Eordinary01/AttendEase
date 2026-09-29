
const eventBus = require('./eventBus');
const logger = require('../utils/logger');

// Helper to safely extract string ID from ObjectId, populated object, or string
function resolveEntityId(val) {
  if (!val) return null;
  if (typeof val === 'object' && val._id) return val._id.toString();
  if (typeof val === 'object' && val.id) return val.id.toString();
  return String(val);
}

// ==================== ALERT FAMILY ====================

/**
 * Emitted when a new alert or announcement is created.
 *
 * @param {string|null} tenantId
 * @param {object} alert - Mongoose Alert document or plain object
 * @param {string|null} [excludeUserId] - ID of user creating the alert (excluded from live push)
 */
function publishAlertCreated(tenantId, alert, excludeUserId = null) {
  try {
    const alertId = alert._id ? alert._id.toString() : String(alert.id || Date.now());
    const creatorId = resolveEntityId(alert.createdBy);
    const resolvedExcludeUserId = resolveEntityId(excludeUserId);

    const targetRoles = Array.isArray(alert.targetRoles) ? alert.targetRoles : [];
    const targetSections = Array.isArray(alert.targetSections) ? alert.targetSections.map(s => String(s).trim().toUpperCase()) : [];
    const targetCourseIds = Array.isArray(alert.targetCourseIds) ? alert.targetCourseIds.map(String) : [];
    const targetBranches = Array.isArray(alert.targetBranches) ? alert.targetBranches.map(b => String(b).trim().toUpperCase()) : [];
    const targetSubjectIds = Array.isArray(alert.targetSubjectIds) ? alert.targetSubjectIds.map(String) : [];
    const targetUsers = Array.isArray(alert.targetUsers) ? alert.targetUsers.map(String) : [];

    return eventBus.publish('alert.created', {
      tenantId: alert.isPlatformAlert ? null : (tenantId ? String(tenantId) : null),
      excludeUserId: resolvedExcludeUserId,
      targetFilter: {
        targetRoles,
        targetSections,
        targetCourseIds,
        targetBranches,
        targetSubjectIds,
        targetUsers,
      },
      payload: {
        id: alertId,
        _id: alertId,
        title: alert.title,
        message: alert.message,
        type: alert.type || 'announcement',
        priority: alert.priority || 'normal',
        targetRoles,
        targetSections,
        targetCourseIds,
        targetBranches,
        targetSubjectIds,
        targetUsers,
        createdBy: creatorId,
        tenantId: alert.isPlatformAlert ? null : (tenantId ? String(tenantId) : null),
        metadata: alert.metadata || {},
        createdAt: alert.createdAt || new Date().toISOString(),
        expiryDate: alert.expiryDate || null,
        isPlatformAlert: Boolean(alert.isPlatformAlert),
      },
      dedupeId: `alert.created:${alertId}:${Date.now()}`,
    });
  } catch (err) {
    logger.warn('publishAlertCreated failed (suppressed)', { error: err.message });
    return '';
  }
}

/**
 * Emitted when an existing alert is modified.
 *
 * @param {string|null} tenantId
 * @param {object} alert
 * @param {string|null} [excludeUserId] - ID of user updating the alert
 */
function publishAlertUpdated(tenantId, alert, excludeUserId = null) {
  try {
    const alertId = alert._id ? alert._id.toString() : String(alert.id || Date.now());
    const creatorId = resolveEntityId(alert.createdBy);
    const resolvedExcludeUserId = resolveEntityId(excludeUserId);

    const targetRoles = Array.isArray(alert.targetRoles) ? alert.targetRoles : [];
    const targetSections = Array.isArray(alert.targetSections) ? alert.targetSections.map(s => String(s).trim().toUpperCase()) : [];
    const targetCourseIds = Array.isArray(alert.targetCourseIds) ? alert.targetCourseIds.map(String) : [];
    const targetBranches = Array.isArray(alert.targetBranches) ? alert.targetBranches.map(b => String(b).trim().toUpperCase()) : [];
    const targetSubjectIds = Array.isArray(alert.targetSubjectIds) ? alert.targetSubjectIds.map(String) : [];
    const targetUsers = Array.isArray(alert.targetUsers) ? alert.targetUsers.map(String) : [];

    return eventBus.publish('alert.updated', {
      tenantId: alert.isPlatformAlert ? null : (tenantId ? String(tenantId) : null),
      excludeUserId: resolvedExcludeUserId,
      targetFilter: {
        targetRoles,
        targetSections,
        targetCourseIds,
        targetBranches,
        targetSubjectIds,
        targetUsers,
      },
      payload: {
        id: alertId,
        _id: alertId,
        title: alert.title,
        message: alert.message,
        type: alert.type || 'announcement',
        priority: alert.priority || 'normal',
        targetRoles,
        targetSections,
        targetCourseIds,
        targetBranches,
        targetSubjectIds,
        targetUsers,
        createdBy: creatorId,
        updatedBy: alert.updatedBy ? resolveEntityId(alert.updatedBy) : creatorId,
        isActive: alert.isActive,
        updatedAt: new Date().toISOString(),
      },
      dedupeId: `alert.updated:${alertId}:${Date.now()}`,
    });
  } catch (err) {
    logger.warn('publishAlertUpdated failed (suppressed)', { error: err.message });
    return '';
  }
}

/**
 * Emitted when an alert expires or is deleted.
 *
 * @param {string|null} tenantId
 * @param {string} alertId
 * @param {string|null} [actorUserId] - ID of the user deleting/expiring the alert (excluded from live push)
 */
function publishAlertExpired(tenantId, alertId, actorUserId = null) {
  try {
    const id = String(alertId);
    return eventBus.publish('alert.expired', {
      tenantId: tenantId ? String(tenantId) : null,
      excludeUserId: resolveEntityId(actorUserId),
      payload: { id, expiredAt: new Date().toISOString() },
      dedupeId: `alert.expired:${id}:${Date.now()}`,
    });
  } catch (err) {
    logger.warn('publishAlertExpired failed (suppressed)', { error: err.message });
    return '';
  }
}

// ==================== ATTENDANCE FAMILY ====================

/**
 * Emitted when attendance is marked (single or batch summary).
 *
 * @param {string} tenantId
 * @param {object} data
 */
function publishAttendanceMarked(tenantId, data) {
  try {
    const key = data.sessionId || data.subjectId || Date.now();
    return eventBus.publish('attendance.marked', {
      tenantId: tenantId ? String(tenantId) : null,
      userId: data.studentId || null,
      payload: data,
      dedupeId: `attendance.marked:${key}:${Date.now()}`,
    });
  } catch (err) {
    logger.warn('publishAttendanceMarked failed (suppressed)', { error: err.message });
    return '';
  }
}

/**
 * Emitted when attendance is corrected by a teacher/admin.
 *
 * @param {string} tenantId
 * @param {object} data
 */
function publishAttendanceCorrected(tenantId, data) {
  try {
    const recordId = data.attendanceId || data.id || Date.now();
    return eventBus.publish('attendance.corrected', {
      tenantId: tenantId ? String(tenantId) : null,
      userId: data.studentId || null,
      payload: data,
      dedupeId: `attendance.corrected:${recordId}:${Date.now()}`,
    });
  } catch (err) {
    logger.warn('publishAttendanceCorrected failed (suppressed)', { error: err.message });
    return '';
  }
}

// ==================== LEAVE FAMILY ====================

/**
 * Emitted when a leave application is submitted.
 *
 * @param {string} tenantId
 * @param {object} leave
 */
function publishLeaveSubmitted(tenantId, leave) {
  try {
    const leaveId = leave._id ? leave._id.toString() : String(leave.id || Date.now());
    return eventBus.publish('leave.submitted', {
      tenantId: tenantId ? String(tenantId) : null,
      userId: leave.studentId ? leave.studentId.toString() : null,
      payload: leave,
      dedupeId: `leave.submitted:${leaveId}:${Date.now()}`,
    });
  } catch (err) {
    logger.warn('publishLeaveSubmitted failed (suppressed)', { error: err.message });
    return '';
  }
}

/**
 * Emitted when a leave application is approved or rejected.
 *
 * @param {string} tenantId
 * @param {string} status - 'approved' | 'rejected' | 'reverted'
 * @param {object} leave
 */
function publishLeaveStatusChanged(tenantId, status, leave) {
  try {
    const eventName = `leave.${status}`;
    const leaveId = leave._id ? leave._id.toString() : String(leave.id || Date.now());
    return eventBus.publish(eventName, {
      tenantId: tenantId ? String(tenantId) : null,
      userId: leave.studentId ? leave.studentId.toString() : null,
      payload: leave,
      dedupeId: `${eventName}:${leaveId}:${Date.now()}`,
    });
  } catch (err) {
    logger.warn('publishLeaveStatusChanged failed (suppressed)', { error: err.message });
    return '';
  }
}

// ==================== TICKET FAMILY ====================

/**
 * Emitted when a support ticket is created or updated.
 *
 * @param {string} tenantId
 * @param {string} eventName - 'ticket.created' | 'ticket.status_changed'
 * @param {object} ticket
 */
function publishTicketEvent(tenantId, eventName, ticket) {
  try {
    const ticketId = ticket._id ? ticket._id.toString() : String(ticket.id || Date.now());
    return eventBus.publish(eventName, {
      tenantId: tenantId ? String(tenantId) : null,
      userId: ticket.userId ? ticket.userId.toString() : null,
      payload: ticket,
      dedupeId: `${eventName}:${ticketId}:${Date.now()}`,
    });
  } catch (err) {
    logger.warn('publishTicketEvent failed (suppressed)', { error: err.message });
    return '';
  }
}

// ==================== EXAM FAMILY ====================

/**
 * Emitted when an exam is created or seating is ready.
 *
 * @param {string} tenantId
 * @param {string} eventName - 'exam.created' | 'exam.seating_ready' | 'exam.updated'
 * @param {object} exam
 */
function publishExamEvent(tenantId, eventName, exam) {
  try {
    const examId = exam._id ? exam._id.toString() : String(exam.id || Date.now());
    return eventBus.publish(eventName, {
      tenantId: tenantId ? String(tenantId) : null,
      payload: exam,
      dedupeId: `${eventName}:${examId}:${Date.now()}`,
    });
  } catch (err) {
    logger.warn('publishExamEvent failed (suppressed)', { error: err.message });
    return '';
  }
}

// ==================== BROADCAST FAMILY ====================

/**
 * Emitted for urgent campus broadcasts or announcements.
 *
 * @param {string} tenantId
 * @param {object} broadcast
 */
function publishAnnouncementIssued(tenantId, broadcast) {
  try {
    const id = broadcast.id || broadcast._id || Date.now();
    return eventBus.publish('broadcast.announcement', {
      tenantId: tenantId ? String(tenantId) : null,
      payload: broadcast,
      dedupeId: `broadcast.announcement:${id}:${Date.now()}`,
    });
  } catch (err) {
    logger.warn('publishAnnouncementIssued failed (suppressed)', { error: err.message });
    return '';
  }
}

// ==================== ANALYTICS & ESCALATIONS ====================

/**
 * Emitted for at-risk attendance escalations.
 *
 * @param {string} tenantId
 * @param {object} riskData
 */
function publishAtRiskAlert(tenantId, riskData) {
  try {
    const studentId = riskData.studentId || 'unknown';
    return eventBus.publish('risk.critical', {
      tenantId: tenantId ? String(tenantId) : null,
      userId: studentId,
      payload: riskData,
      dedupeId: `risk.critical:${studentId}:${Date.now()}`,
    });
  } catch (err) {
    logger.warn('publishAtRiskAlert failed (suppressed)', { error: err.message });
    return '';
  }
}

/**
 * Emitted when a promotion batch job completes.
 *
 * @param {string} tenantId
 * @param {object} result - { jobId, promoted, graduated, eligible, skipped, details[], finishedAt }
 */
function publishPromotionCompleted(tenantId, result) {
  try {
    const { jobId, promoted, graduated, eligible, skipped, details, finishedAt } = result;
    return eventBus.publish('promotion.completed', {
      tenantId: tenantId ? String(tenantId) : null,
      payload: {
        jobId: jobId ?? null,
        promoted: promoted ?? 0,
        graduated: graduated ?? 0,
        eligible: eligible ?? 0,
        skipped: skipped ?? 0,
        details: details || [],
        finishedAt: finishedAt || new Date().toISOString(),
        message: `Semester promotion complete — ${promoted} promoted, ${graduated} graduated${eligible ? `, ${eligible} eligible` : ''}`,
      },
      dedupeId: `promotion.completed:${tenantId}:${jobId ?? 'sync'}:${Date.now()}`,
    });
  } catch (err) {
    logger.warn('publishPromotionCompleted failed (suppressed)', { error: err.message });
    return '';
  }
}

module.exports = {
  publishAlertCreated,
  publishAlertUpdated,
  publishAlertExpired,
  publishAttendanceMarked,
  publishAttendanceCorrected,
  publishLeaveSubmitted,
  publishLeaveStatusChanged,
  publishTicketEvent,
  publishExamEvent,
  publishAnnouncementIssued,
  publishAtRiskAlert,
  publishPromotionCompleted,
};
