const logger = require('../utils/logger');
let Bull;
try {
  Bull = require('bull');
} catch (e) {
  Bull = null;
}

let attendanceStatsQueue = null;
let absenceEscalationQueue = null;
const REDIS_URL = process.env.REDIS_URL;
const { createBullRedisClient } = require('../utils/redisClient');

/**
 * Executes Tier 1 (in-app alert), Tier 2 (parent email), and Tier 3 (HOD/Admin alert)
 */
async function processAbsenceEscalation({ studentId, tenantId, streakLength, lastAbsenceDate, subjectId, section }) {
  const User = require('../models/User');
  const Alert = require('../models/Alert');
  const { sendMail } = require('../utils/emailService');

  try {
    const student = await User.findById(studentId).lean();
    if (!student) {
      logger.warn('Student not found for absence escalation', { studentId });
      return;
    }

    const absenceDate = lastAbsenceDate ? new Date(lastAbsenceDate) : new Date();

    // Deduplication check: prevent duplicate escalations for the same streak window
    const existingAlert = await Alert.findOne({
      tenantId,
      type: 'absence_escalation',
      'metadata.studentId': studentId,
      'metadata.lastAbsenceDate': absenceDate,
    });

    if (existingAlert) {
      logger.info('Absence escalation already exists for streak window', { studentId, date: absenceDate });
      return;
    }

    const studentName = student.name || 'Student';
    const studentRollNo = student.rollNo ? ` (${student.rollNo})` : '';
    const resolvedSection = section || student.section || '';

    const { formatDateDMY } = require('../controllers/leaveController');
    const { publishAlertCreated, publishAtRiskAlert } = require('../events/publishers');
    const formattedAbsenceDate = formatDateDMY(absenceDate);

    // ── Tier 1: In-App Alert for Student & Teacher ───────────────────────────
    const tier1Alert = await Alert.create({
      title: 'Attendance Warning: 3 Consecutive Absences',
      message: `${studentName}${studentRollNo} has missed ${streakLength || 3} consecutive scheduled classes as of ${formattedAbsenceDate}. Immediate counseling and attendance recovery required.`,
      type: 'absence_escalation',
      priority: 'high',
      isActive: true,
      tenantId,
      targetRoles: ['student', 'teacher'],
      targetUsers: [student._id],
      targetSections: resolvedSection ? [resolvedSection.toUpperCase()] : [],
      metadata: {
        studentId,
        studentName,
        rollNo: student.rollNo,
        section: resolvedSection,
        streakLength: streakLength || 3,
        lastAbsenceDate: absenceDate,
        tier: 1,
        severity: 'warning',
      },
    });
    publishAlertCreated(tenantId, tier1Alert);

    // ── Tier 2: Parent Email Notification ────────────────────────────────────
    if (student.parentEmail) {
      const emailSubject = `Attendance Warning: Consecutive Absences for ${studentName}`;
      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
          <h2 style="color: #dc2626; margin-top: 0; font-size: 20px;">⚠️ Attendance Warning Notification</h2>
          <p style="color: #334155; font-size: 15px; line-height: 1.5;">Dear Parent / Guardian of <strong>${studentName}</strong> (Roll No: ${student.rollNo || 'N/A'}),</p>
          <p style="color: #334155; font-size: 14px; line-height: 1.6;">
            Our academic records show that your ward has missed <strong>${streakLength || 3} consecutive scheduled classes</strong> up to <strong>${formattedAbsenceDate}</strong>.
          </p>
          <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 14px; margin: 16px 0; border-radius: 4px; color: #991b1b; font-size: 13px;">
            <strong>Notice:</strong> As per institutional regulations, maintaining a minimum of 75% attendance is required to be eligible for end-semester examinations.
          </div>
          <p style="color: #64748b; font-size: 13px; line-height: 1.5;">
            If this absence is due to an approved illness or personal emergency, please submit relevant medical documentation to the academic office immediately.
          </p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="font-size: 11px; color: #94a3b8; margin-bottom: 0;">Sent automatically by AttendEase Academic Early Warning System.</p>
        </div>
      `;

      try {
        await sendMail({
          to: student.parentEmail,
          subject: emailSubject,
          html,
        });
        logger.info(`Parent escalation email sent for student ${studentId} to ${student.parentEmail}`);
      } catch (mailErr) {
        logger.warn(`Failed to send parent escalation email for student ${studentId}`, { error: mailErr.message });
      }
    }

    // ── Tier 3: High-Priority Flag for HOD / Dean / Admins ───────────────────
    const tier3Alert = await Alert.create({
      title: 'Dean/HOD Action: Critical Consecutive Absence Streak',
      message: `Student ${studentName}${studentRollNo} (Section: ${resolvedSection || 'N/A'}) has accrued ${streakLength || 3} consecutive absences. Flagged for administrative intervention.`,
      type: 'absence_escalation',
      priority: 'urgent',
      isActive: true,
      tenantId,
      targetRoles: ['admin'],
      targetSections: resolvedSection ? [resolvedSection.toUpperCase()] : [],
      metadata: {
        studentId,
        studentName,
        rollNo: student.rollNo,
        section: resolvedSection,
        streakLength: streakLength || 3,
        lastAbsenceDate: absenceDate,
        tier: 3,
        severity: 'critical',
      },
    });
    publishAlertCreated(tenantId, tier3Alert);

    publishAtRiskAlert(tenantId, {
      studentId,
      streakLength,
      lastAbsenceDate: absenceDate,
      section: resolvedSection,
    });

    logger.info('Completed multi-tier absence escalation', { studentId, streakLength });
  } catch (err) {
    logger.error('Error processing absence escalation', { studentId, error: err.message });
  }
}

if (REDIS_URL && Bull) {
  try {
    attendanceStatsQueue = new Bull('attendance:recalc-stats', {
      createClient: createBullRedisClient,
    });
    
    attendanceStatsQueue.process(async (job) => {
      const { studentId, subjectId, tenantId } = job.data;
      const { updateStudentAttendanceStats } = require('../controllers/attendanceController');
      if (typeof updateStudentAttendanceStats === 'function') {
        await updateStudentAttendanceStats(studentId, subjectId, tenantId);
      }
    });

    attendanceStatsQueue.on('failed', (job, err) => {
      logger.error('Attendance stats recalculation job failed', { jobId: job.id, error: err.message });
    });

    absenceEscalationQueue = new Bull('attendance:absence-escalation', {
      createClient: createBullRedisClient,
    });

    absenceEscalationQueue.process(async (job) => {
      await processAbsenceEscalation(job.data);
    });

    absenceEscalationQueue.on('failed', (job, err) => {
      logger.error('Absence escalation job failed', { jobId: job.id, error: err.message });
    });

    logger.info('Bull queues for stats recalculation and absence escalation initialized with Redis');
  } catch (err) {
    logger.warn('Failed to initialize Redis Bull queues, using inline async fallback', { error: err.message });
    attendanceStatsQueue = null;
    absenceEscalationQueue = null;
  }
} else {
  logger.info('Redis URL or Bull package not available — using inline async fallback for attendance queues');
}

/**
 * Dispatch job to recalculate student attendance stats asynchronously.
 */
const addStatRecalcJob = async (studentId, subjectId, tenantId) => {
  if (attendanceStatsQueue && attendanceStatsQueue.client && attendanceStatsQueue.client.status === 'ready') {
    try {
      const addPromise = attendanceStatsQueue.add(
        { studentId, subjectId, tenantId },
        { attempts: 3, backoff: { type: 'exponential', delay: 1000 } }
      );
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Queue add timeout')), 1500)
      );
      await Promise.race([addPromise, timeoutPromise]);
      return;
    } catch (err) {
      logger.warn('Redis queue add failed/timed out, executing stats update inline', { error: err.message });
    }
  }

  // Non-blocking asynchronous fallback using setImmediate
  setImmediate(async () => {
    try {
      const { updateStudentAttendanceStats } = require('../controllers/attendanceController');
      if (typeof updateStudentAttendanceStats === 'function') {
        await updateStudentAttendanceStats(studentId, subjectId, tenantId);
      }
    } catch (err) {
      logger.error('Async inline attendance stats update error', { error: err.message, studentId });
    }
  });
};

/**
 * Dispatch job for 3-consecutive-absence multi-tier escalation.
 */
const addAbsenceEscalationJob = async ({ studentId, tenantId, streakLength, lastAbsenceDate, subjectId, section }) => {
  const payload = { studentId, tenantId, streakLength, lastAbsenceDate, subjectId, section };

  if (absenceEscalationQueue && absenceEscalationQueue.client && absenceEscalationQueue.client.status === 'ready') {
    try {
      const addPromise = absenceEscalationQueue.add(payload, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Queue add timeout')), 1500)
      );
      await Promise.race([addPromise, timeoutPromise]);
      return;
    } catch (err) {
      logger.warn('Redis queue add failed/timed out, executing absence escalation inline', { error: err.message });
    }
  }

  // Non-blocking asynchronous fallback using setImmediate
  setImmediate(async () => {
    try {
      await processAbsenceEscalation(payload);
    } catch (err) {
      logger.error('Async inline absence escalation error', { error: err.message, studentId });
    }
  });
};

module.exports = {
  attendanceStatsQueue,
  absenceEscalationQueue,
  addStatRecalcJob,
  addAbsenceEscalationJob,
  processAbsenceEscalation,
};
