/**
 * Promotion service — extracted from academicController.js.
 *
 * Phase 1: service layer for promotion logic.
 * Phase 2: background batch processing (used by the Bull queue worker + admin batch endpoint).
 *
 * Public exports:
 *  - buildPromotionContext(tenantId)  -> { structure, eligible[], skipped[], graduating, missingAdmissionYearCount }
 *  - scanForDuePromotions(tenantId)   -> { eligibleCount, graduatingCount, skippedCount, due: boolean, summary }
 *  - runPromotionBatch(tenantId, studentIds, options) -> { promoted, graduated, eligible, skipped, details, finishedAt }
 *  - runPromotionJob(job) -> Bull queue handler
 */

const User = require('../models/User');
const Enrollment = require('../models/Enrollment');
const Course = require('../models/Course');
const Tenant = require('../models/Tenant');
const SemesterPromotion = require('../models/SemesterPromotion');
const logger = require('../utils/logger');

const DEFAULT_ACADEMIC_START_MONTH = 5;
const DEFAULT_SEMESTERS_PER_YEAR = 2;

/**
 * Expected semester for a student based on admission year + current date.
 */
function computeExpectedSemester(admissionYear, academicStartMonth, semestersPerYear, nowDate = new Date()) {
  if (!admissionYear || isNaN(Number(admissionYear))) return null;
  const year = Number(admissionYear);
  const monthsPerSem = 12 / (semestersPerYear === 1 ? 1 : 2);
  const startMonth = typeof academicStartMonth === 'number' ? academicStartMonth : DEFAULT_ACADEMIC_START_MONTH;
  const now = nowDate;
  const elapsed = now.getFullYear() * 12 + now.getMonth() - (year * 12 + startMonth);
  if (elapsed < 0) return 1;
  return 1 + Math.floor(elapsed / monthsPerSem);
}

/**
 * Resolve the total semesters for a student from their course/branch (with fallback).
 */
function resolveTotalSemesters(student, courseMap) {
  if (student.totalSemesters != null && student.totalSemesters > 0) return student.totalSemesters;
  const course = courseMap.get(String(student.courseId));
  if (!course) return null;
  const branch = student.branch
    ? course.branches?.find(b => String(b.name).toLowerCase() === String(student.branch).toLowerCase())
    : null;
  return branch?.totalSemesters || (course.durationYears || 3) * (course.semestersPerYear || 2);
}

/**
 * Build the promotion context for a tenant (read-only, used by preview + batch).
 */
async function buildPromotionContext(tenantId) {
  const tenant = await Tenant.findById(tenantId).lean();
  const structure = tenant?.settings?.semesterStructure || { semestersPerYear: 2, autoPromote: true, academicStartMonth: 5 };

  const [students, courses] = await Promise.all([
    User.find({
      tenantId,
      role: 'student',
      isActive: true,
      academicStatus: { $ne: 'graduated' },
    }).select('name rollNo section email courseId courseName branch semester admissionYear totalSemesters academicStatus holdPromotion lastPromotedAt').lean(),
    Course.find({ tenantId, isActive: true }).select('name code durationYears branches semestersPerYear').lean(),
  ]);

  const courseMap = new Map(courses.map(c => [String(c._id), c]));

  const eligible = [];
  const skipped = [];
  let graduating = 0;
  let missingAdmissionYearCount = 0;
  const missingCourseStudents = [];

  for (const student of students) {
    if (!student.courseId) {
      missingCourseStudents.push({
        _id: student._id,
        name: student.name,
        rollNo: student.rollNo,
        email: student.email,
        semester: student.semester,
        admissionYear: student.admissionYear,
        branch: student.branch,
      });
      logger.warn('Promotion service: student has missing courseId', {
        tenantId,
        studentId: student._id,
        name: student.name,
        rollNo: student.rollNo,
      });
    }

    const course = student.courseId ? courseMap.get(String(student.courseId)) : null;
    const resolvedCourseName = course?.name || student.courseName || '';
    const studentDecorated = { ...student, courseName: resolvedCourseName };

    const expected = computeExpectedSemester(student.admissionYear, structure.academicStartMonth, structure.semestersPerYear);
    const current = student.semester || 1;

    if (student.holdPromotion) {
      skipped.push({ ...studentDecorated, expectedSemester: expected, reason: 'Promotion on hold' });
      continue;
    }
    if (expected === null) {
      missingAdmissionYearCount++;
      skipped.push({ ...studentDecorated, expectedSemester: null, reason: 'Missing admission year' });
      continue;
    }
    if (expected <= current) {
      skipped.push({ ...studentDecorated, expectedSemester: expected, reason: 'Not yet due' });
      continue;
    }

    const totalSemesters = resolveTotalSemesters(student, courseMap);
    if (totalSemesters == null) {
      skipped.push({
        ...studentDecorated,
        expectedSemester: expected,
        reason: !student.courseId ? 'Missing course assignment' : 'Course not found',
      });
      continue;
    }
    if (current >= totalSemesters) {
      graduating++;
      eligible.push({ ...studentDecorated, expectedSemester: expected, nextSemester: current, willGraduate: true, totalSemesters });
      continue;
    }

    eligible.push({
      ...studentDecorated,
      expectedSemester: expected,
      nextSemester: Math.min(current + 1, totalSemesters || current + 1),
      willGraduate: false,
      totalSemesters,
    });
  }

  return {
    structure,
    eligible,
    skipped,
    graduating,
    missingAdmissionYearCount,
    missingCourseCount: missingCourseStudents.length,
    missingCourseStudents,
  };
}

/**
 * Lightweight check: are any students due for promotion right now?
 */
async function scanForDuePromotions(tenantId) {
  const { eligible, graduating, skipped } = await buildPromotionContext(tenantId);
  return {
    due: eligible.length > 0,
    eligibleCount: eligible.length,
    graduatingCount: graduating,
    skippedCount: skipped.length,
    mustHavePromotion: eligible.length > 0 || graduating > 0,
    summary: eligible.slice(0, 5).map(s => ({
      name: s.name,
      rollNo: s.rollNo,
      currentSemester: s.semester,
      toSemester: s.nextSemester,
      willGraduate: Boolean(s.willGraduate),
    })),
  };
}

/**
 * Promote a single student (atomic per-student write).
 */
async function promoteOneStudent(tenantId, student) {
  const now = new Date();
  const updates = {
    semester: student.nextSemester,
    lastPromotedAt: now,
  };
  if (student.willGraduate) {
    updates.academicStatus = 'graduated';
    updates.graduatedAt = now;
  }

  const userResult = await User.updateOne({ _id: student._id, tenantId }, { $set: updates });
  if (userResult.matchedCount === 0) {
    throw new Error(`Student ${student._id} not found or already updated`);
  }

  try {
    await Enrollment.updateOne(
      { userId: student._id, tenantId },
      { $set: { semester: student.nextSemester, ...(student.willGraduate ? { enrollmentStatus: 'graduated' } : {}) } },
    );
  } catch (enrollErr) {
    logger.warn('Enrollment sync failed during promotion (suppressed)', {
      studentId: student._id,
      error: enrollErr.message,
    });
  }

  return {
    id: student._id,
    name: student.name,
    rollNo: student.rollNo,
    section: student.section,
    from: student.semester,
    to: student.nextSemester,
    graduated: Boolean(student.willGraduate),
  };
}

const BATCH_CHUNK_SIZE = 50;

/**
 * Run a promotion batch.
 */
async function runPromotionBatch(tenantId, studentIds, { progressCb, isBackground, runBy, runByName, type = 'manual', jobId = null } = {}) {
  const context = await buildPromotionContext(tenantId);

  // If studentIds provided, filter to only those in the eligible set.
  const targets = Array.isArray(studentIds) && studentIds.length > 0
    ? context.eligible.filter(s => studentIds.includes(String(s._id)))
    : context.eligible;

  if (targets.length === 0) {
    return {
      promoted: 0,
      graduated: 0,
      eligible: context.eligible.length,
      skipped: context.skipped.length,
      graduating: context.graduating,
      failed: 0,
      details: [],
      finishedAt: new Date().toISOString(),
    };
  }

  const details = [];
  let promoted = 0;
  let graduated = 0;
  let failed = 0;

  for (let i = 0; i < targets.length; i += BATCH_CHUNK_SIZE) {
    const chunk = targets.slice(i, i + BATCH_CHUNK_SIZE);
    for (const student of chunk) {
      try {
        const detail = await promoteOneStudent(tenantId, student);
        details.push(detail);
        if (student.willGraduate) graduated++; else promoted++;
      } catch (err) {
        failed++;
        logger.error('Promotion job: student update failed', {
          studentId: student._id,
          name: student.name,
          error: err.message,
        });
      }
    }
    if (progressCb) {
      const processed = Math.min(i + BATCH_CHUNK_SIZE, targets.length);
      progressCb({ processed, total: targets.length, promoted, graduated, failed });
    }
  }

  const status = failed > 0 ? (promoted > 0 || graduated > 0 ? 'partial' : 'failed') : 'completed';

  try {
    await SemesterPromotion.create({
      tenantId,
      jobId: jobId || null,
      type: type || (isBackground ? 'background_batch' : 'manual'),
      promotedCount: promoted,
      graduatedCount: graduated,
      eligibleCount: context.eligible.length,
      skippedCount: context.skipped.length,
      failedCount: failed,
      details: details.slice(0, 500),
      runBy: runBy || null,
      runByName: runByName || (type === 'auto_scanner' ? 'Auto Promotion Scanner' : (isBackground ? 'Background Batch' : 'Manual')),
      status,
      executedAt: new Date(),
    });
  } catch (auditErr) {
    logger.error('Failed to create SemesterPromotion audit record', { tenantId, error: auditErr.message });
  }

  return {
    promoted,
    graduated,
    eligible: context.eligible.length,
    skipped: context.skipped.length,
    graduating: context.graduating,
    failed,
    details,
    finishedAt: new Date().toISOString(),
  };
}

/**
 * Background job handler — entry point for Bull worker.
 */
async function runPromotionJob(job) {
  const { tenantId, studentIds, runBy, runByName, type } = job.data || {};
  logger.info('Promotion job started', { jobId: job.id, tenantId, studentIdsCount: studentIds?.length });

  let lastProgress = 0;
  const result = await runPromotionBatch(tenantId, studentIds, {
    isBackground: true,
    jobId: job.id,
    runBy,
    runByName,
    type: type || 'background_batch',
    progressCb: ({ processed, total, promoted, graduated, failed }) => {
      const pct = total > 0 ? Math.round((processed / total) * 100) : 0;
      if (pct - lastProgress >= 1 || processed === total) {
        lastProgress = pct;
        job.progress(pct);
      }
    },
  });

  logger.info('Promotion job completed', {
    jobId: job.id,
    tenantId,
    promoted: result.promoted,
    graduated: result.graduated,
    failed: result.failed,
  });
  return result;
}

module.exports = {
  buildPromotionContext,
  scanForDuePromotions,
  runPromotionBatch,
  runPromotionJob,
  computeExpectedSemester,
  resolveTotalSemesters,
};
