const LeaveRequest = require('../models/LeaveRequest');
const Attendance = require('../models/Attendance');
const Timetable = require('../models/Timetable');
const Subject = require('../models/Subject');
const User = require('../models/User');
const Exam = require('../models/Exam');
const MentorAssignment = require('../models/MentorAssignment');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { uploadToCloudinary, getLeaveFolder } = require('../utils/cloudinary');
const { addStatRecalcJob } = require('../queues/attendanceQueue');
const { delPattern } = require('../middleware/cache');
const { escapeRegExp } = require('../utils/sanitize');
const { getTeacherAssignedSections } = require('../utils/sectionHelper');
const { toISODateString, formatDateDMY } = require('../utils/dateFormatter');
const {
  publishLeaveSubmitted,
  publishLeaveStatusChanged,
} = require('../events/publishers');

const BRANCH_ALIASES = {
  CS: ['CS', 'COMPUTER SCIENCE'],
  'COMPUTER SCIENCE': ['CSE', 'CS', 'COMPUTER SCIENCE', 'COMPUTER SCIENCE & ENGINEERING', 'COMPUTER SCIENCE AND ENGINEERING'],
  'COMPUTER SCIENCE & ENGINEERING': ['CSE', 'COMPUTER SCIENCE & ENGINEERING', 'COMPUTER SCIENCE AND ENGINEERING'],
  'COMPUTER SCIENCE AND ENGINEERING': ['CSE', 'COMPUTER SCIENCE & ENGINEERING', 'COMPUTER SCIENCE AND ENGINEERING'],
  IT: ['IT', 'INFORMATION TECHNOLOGY'],
  'INFORMATION TECHNOLOGY': ['IT', 'INFORMATION TECHNOLOGY'],
  ECE: ['ECE', 'ELECTRONICS', 'ELECTRONICS & COMMUNICATION', 'ELECTRONICS AND COMMUNICATION', 'ELECTRONICS & COMMUNICATION ENGINEERING'],
  ELECTRONICS: ['ECE', 'ELECTRONICS', 'ELECTRONICS & COMMUNICATION', 'ELECTRONICS AND COMMUNICATION'],
  EE: ['EE', 'ELECTRICAL', 'ELECTRICAL ENGINEERING'],
  ELECTRICAL: ['EE', 'ELECTRICAL', 'ELECTRICAL ENGINEERING'],
  ME: ['ME', 'MECHANICAL', 'MECHANICAL ENGINEERING'],
  MECHANICAL: ['ME', 'MECHANICAL', 'MECHANICAL ENGINEERING'],
  CIVIL: ['CIVIL', 'CIVIL ENGINEERING'],
  CHEM: ['CHEM', 'CHEMISTRY', 'CHEMICAL', 'CHEMICAL ENGINEERING'],
  CHEMISTRY: ['CHEM', 'CHEMISTRY', 'CHEMICAL', 'CHEMICAL ENGINEERING'],
  ARCH: ['ARCH', 'ARCHITECTURE'],
  ARCHITECTURE: ['ARCH', 'ARCHITECTURE'],
  AI: ['AI', 'ARTIFICIAL INTELLIGENCE', 'AIML'],
  DS: ['DS', 'DATA SCIENCE'],
  FIN: ['FIN', 'FINANCE'],
  MKT: ['MKT', 'MARKETING'],
  TE: ['TE', 'THERMAL', 'THERMAL ENGINEERING'],
  VLSI: ['VLSI', 'VERY LARGE SCALE INTEGRATION'],
};


/**
 * Helper to resolve the primary academic mentor for a student cohort
 */
const resolvePrimaryMentor = async (tenantId, section, courseId, branch, semester) => {
  const query = {
    tenantId,
    section: section ? section.trim().toUpperCase() : undefined,
    isActive: true,
  };
  if (courseId) query.courseId = courseId;
  if (branch) query.branch = branch;
  if (semester) query.semester = Number(semester);

  // Try exact match with isPrimary: true
  let mentor = await MentorAssignment.findOne({ ...query, isPrimary: true })
    .populate('teacherId', 'name email department designation')
    .lean();

  if (!mentor) {
    // Try any active mentor assignment for this cohort
    mentor = await MentorAssignment.findOne(query)
      .populate('teacherId', 'name email department designation')
      .lean();
  }

  if (!mentor && section) {
    // Fallback to section-only mentor if course/branch/semester not specified
    mentor = await MentorAssignment.findOne({
      tenantId,
      section: section.trim().toUpperCase(),
      isActive: true,
    })
      .populate('teacherId', 'name email department designation')
      .lean();
  }

  // Option B: Also check teacher customRoles directly if MentorAssignment had no record
  if (!mentor && section) {
    const teacherUser = await User.findOne({
      tenantId,
      role: 'teacher',
      'customRoles.section': section.trim().toUpperCase(),
    }).select('name email department designation customRoles').lean();

    if (teacherUser) {
      const matchedRole = (teacherUser.customRoles || []).find(
        cr => (cr.section || '').toUpperCase() === section.trim().toUpperCase()
      );

      try {
        // Persist real MentorAssignment record on-the-fly so it has real identity,
        // satisfies foreign-key lookups, and provides consistent mentor semantics.
        mentor = await MentorAssignment.findOneAndUpdate(
          {
            tenantId,
            section: section.trim().toUpperCase(),
            teacherId: teacherUser._id,
          },
          {
            $setOnInsert: {
              tenantId,
              section: section.trim().toUpperCase(),
              teacherId: teacherUser._id,
              teacherName: teacherUser.name || 'Assigned Faculty',
              teacherEmail: teacherUser.email || '',
              courseId: matchedRole?.courseId || courseId || null,
              branch: matchedRole?.branch || branch || '',
              semester: matchedRole?.semester ? String(matchedRole.semester) : (semester ? String(semester) : ''),
              isPrimary: matchedRole?.isPrimary !== false,
              isActive: true,
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        )
          .populate('teacherId', 'name email department designation')
          .lean();
      } catch (upsertErr) {
        logger.warn('Failed to upsert MentorAssignment on-the-fly, falling back to direct teacher object', {
          error: upsertErr.message,
        });
        mentor = {
          teacherId: teacherUser,
          section: section.trim().toUpperCase(),
          courseId: matchedRole?.courseId || courseId,
          branch: matchedRole?.branch || branch,
          semester: matchedRole?.semester || semester,
          isPrimary: matchedRole?.isPrimary !== false,
          isSyntheticMentor: true,
        };
      }
    }
  }

  return mentor;
};

/**
 * Helper to check for exam schedule conflicts during the requested leave window
 */
const checkExamPeriodConflict = async (tenantId, cohort, start, end, subjectIds = []) => {
  const query = {
    tenantId,
    status: { $in: ['scheduled', 'in_progress'] },
    date: { $gte: start, $lte: end },
  };

  const orConditions = [];
  if (cohort.section) {
    orConditions.push({ section: cohort.section.trim().toUpperCase() });
  }
  if (cohort.courseId) {
    orConditions.push({ courseId: cohort.courseId });
  }
  if (subjectIds && subjectIds.length > 0) {
    orConditions.push({
      subjectId: { $in: subjectIds.map((s) => new mongoose.Types.ObjectId(s)) },
    });
  }

  if (orConditions.length > 0) {
    query.$or = orConditions;
  }

  const conflictingExam = await Exam.findOne(query).lean();
  return conflictingExam;
};

/**
 * Helper to fetch all scheduled Timetable slots for a section across a date range.
 */
const getScheduledSlotsForRange = async (
  tenantId,
  section,
  fromDate,
  toDate,
  subjectId = null,
  options = {}
) => {
  const start = new Date(fromDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(toDate);
  end.setHours(23, 59, 59, 999);

  // 1. Fetch active timetable slots for this section in tenant
  const query = {
    tenantId,
    section: section.trim().toUpperCase(),
    isActive: true,
    isNoClass: { $ne: true },
  };

  if (subjectId) {
    query.subjectId = new mongoose.Types.ObjectId(subjectId);
  }

  // Scope to student cohort if options provided
  const rawTargetCourseId = options.courseId?._id || options.courseId;
  const targetCourseId =
    rawTargetCourseId &&
    typeof rawTargetCourseId !== 'object' &&
    rawTargetCourseId !== '[object Object]' &&
    mongoose.Types.ObjectId.isValid(String(rawTargetCourseId))
      ? new mongoose.Types.ObjectId(String(rawTargetCourseId))
      : (rawTargetCourseId instanceof mongoose.Types.ObjectId ? rawTargetCourseId : null);

  if (targetCourseId) {
    query.$and = query.$and || [];
    query.$and.push({
      $or: [
        { courseId: targetCourseId },
        { courseId: null },
        { courseId: { $exists: false } },
      ],
    });
  }

  if (options.branch) {
    const bUpper = String(options.branch).trim().toUpperCase();
    const validBranches = BRANCH_ALIASES[bUpper] || [bUpper];
    const bRegexes = validBranches.map((b) => new RegExp(`^${escapeRegExp(b)}$`, 'i'));
    query.branch = { $in: bRegexes };
  }

  if (options.semester !== undefined && options.semester !== null && options.semester !== '') {
    const semStr = String(options.semester).trim();
    const semNum = parseInt(semStr, 10);
    const semConditions = [{ semester: semStr }];
    if (!isNaN(semNum)) {
      semConditions.push({ semester: semNum }, { semester: String(semNum) });
    }
    query.$and = query.$and || [];
    query.$and.push({ $or: semConditions });
  }

  const timetableEntries = await Timetable.find(query).lean();

  // Group timetable entries by weekday name
  const slotsByDay = {};
  WEEKDAYS.forEach((w) => {
    slotsByDay[w] = [];
  });
  timetableEntries.forEach((entry) => {
    if (slotsByDay[entry.day]) {
      slotsByDay[entry.day].push(entry);
    }
  });

  // 2. Iterate each calendar day from start to end
  const daySchedule = [];
  const curr = new Date(start);

  while (curr <= end) {
    const dayName = WEEKDAYS[curr.getDay()];
    const dateStr = toISODateString(curr);
    const slots = (slotsByDay[dayName] || []).map((s) => ({
      timetableId: s._id,
      day: s.day,
      startTime: s.startTime,
      endTime: s.endTime,
      room: s.room || '',
      subjectId: s.subjectId,
      subjectName: s.subjectName || '',
      subjectCode: s.subjectCode || '',
      teacherId: s.teacherId,
      teacherName: s.teacherName || '',
      section: s.section,
    }));

    daySchedule.push({
      date: dateStr,
      dateObj: new Date(curr),
      day: dayName,
      slotsCount: slots.length,
      slots,
    });

    curr.setDate(curr.getDate() + 1);
  }

  return daySchedule;
};

/**
 * Helper to reconcile attendance records for an approved leave request
 */
const reconcileAttendanceForLeave = async (leave, approverId) => {
  const tenantId = leave.tenantId;
  const studentId = leave.studentId;
  const section = leave.section;

  // Resolve scheduled slots for leave dates
  const schedule = await getScheduledSlotsForRange(
    tenantId,
    section,
    leave.fromDate,
    leave.toDate,
    leave.flowType === 'single-subject' ? leave.subjectId : null,
    {
      courseId: leave.courseId,
      branch: leave.branch,
      semester: leave.semester,
    }
  );

  let updatedCount = 0;
  let createdCount = 0;
  let skippedCount = 0;

  const affectedSubjectIds = new Set();
  const allowedMultiSubjectIds =
    leave.flowType === 'multi-subject' && Array.isArray(leave.subjectIds) && leave.subjectIds.length > 0
      ? new Set(leave.subjectIds.map((s) => s.toString()))
      : null;

  for (const dayItem of schedule) {
    const slotDate = dayItem.dateObj;
    const slotDateStr = dayItem.date;

    // Filter slots if a specific sessionSlot was selected (e.g. half-day)
    let applicableSlots = dayItem.slots;
    if (leave.sessionSlot && leave.sessionSlot.timetableId) {
      applicableSlots = applicableSlots.filter(
        (s) => s.timetableId.toString() === leave.sessionSlot.timetableId.toString()
      );
    }

    // Filter slots if multi-subject leave selected specific subjects
    if (allowedMultiSubjectIds) {
      applicableSlots = applicableSlots.filter(
        (s) => s.subjectId && allowedMultiSubjectIds.has(s.subjectId.toString())
      );
    }

    for (const slot of applicableSlots) {
      if (!slot.subjectId) continue;
      const subIdStr = slot.subjectId.toString();
      affectedSubjectIds.add(subIdStr);

      const classSessionId = `${subIdStr}_${section}_${slotDateStr}_${slot.timetableId}`;

      // Search for existing attendance record
      const startOfDay = new Date(slotDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(slotDate);
      endOfDay.setHours(23, 59, 59, 999);

      const existingRecord = await Attendance.findOne({
        tenantId,
        studentId,
        subjectId: slot.subjectId,
        date: { $gte: startOfDay, $lte: endOfDay },
        $or: [{ timetableId: slot.timetableId }, { classSessionId }],
      });

      if (existingRecord) {
        if (existingRecord.status === 'absent') {
          existingRecord.status = 'leave';
          existingRecord.remarks = `Leave Approved: ${leave.leaveType.toUpperCase()} (${leave.reason})`;
          await existingRecord.save();
          updatedCount++;
        } else {
          // Already present or leave
          skippedCount++;
        }
      } else {
        // Create synthetic attendance record marked as 'leave' using atomic upsert
        try {
          const res = await Attendance.findOneAndUpdate(
            { tenantId, classSessionId, studentId },
            {
              $setOnInsert: {
                tenantId,
                studentId,
                subjectId: slot.subjectId,
                subject: {
                  subjectCode: slot.subjectCode || 'N/A',
                  subjectName: slot.subjectName || 'Scheduled Class',
                },
                teacherId: slot.teacherId || approverId,
                section: section.toUpperCase(),
                date: slotDate,
                status: 'leave',
                remarks: `Synthetic Leave Record: ${leave.leaveType.toUpperCase()} (${leave.reason})`,
                classSessionId,
                timetableId: slot.timetableId,
                day: slot.day,
                startTime: slot.startTime,
                endTime: slot.endTime,
                room: slot.room || '',
                semester: leave.semester || '',
                createdBy: approverId,
              },
            },
            { upsert: true, new: false, rawResult: true }
          );

          const updatedExisting = res?.lastErrorObject?.updatedExisting ?? (res?.value !== null);
          if (updatedExisting) {
            skippedCount++;
          } else {
            createdCount++;
          }
        } catch (insertErr) {
          // If duplicate key error due to race condition, treat as skipped
          if (insertErr.code === 11000) {
            skippedCount++;
          } else {
            logger.warn('Failed to insert synthetic leave attendance record', {
              error: insertErr.message,
              studentId,
              classSessionId,
            });
          }
        }
      }
    }
  }

  // Update LeaveRequest reconciliation metadata
  leave.reconciliationStatus = 'completed';
  leave.status = 'attendance-updated';
  leave.reconciliationMeta = {
    updatedCount,
    createdCount,
    skippedCount,
    reconciledAt: new Date(),
    notes: `Reconciled ${updatedCount} absent records and created ${createdCount} synthetic records.`,
  };
  await leave.save();

  // Enqueue async stat recalculation jobs for each affected subject
  for (const subId of affectedSubjectIds) {
    try {
      await addStatRecalcJob({
        studentId: studentId.toString(),
        subjectId: subId,
        tenantId: tenantId.toString(),
      });
    } catch (queueErr) {
      logger.warn('Failed to enqueue stat recalc job after leave reconciliation', {
        error: queueErr.message,
      });
    }
  }

  // Invalidate Redis/memory caches
  try {
    await delPattern('attendance:*');
    await delPattern('leave:*');
    await delPattern('risk:*');
  } catch (cacheErr) {
    logger.warn('Failed to invalidate cache after leave reconciliation', {
      error: cacheErr.message,
    });
  }

  return { updatedCount, createdCount, skippedCount };
};

/**
 * Helper to revert attendance records when an approved leave is cancelled
 */
const executeAttendanceRevert = async (leave, cancelledById, reason = 'Leave request cancelled') => {
  const tenantId = leave.tenantId;
  const studentId = leave.studentId;
  const start = new Date(leave.fromDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(leave.toDate);
  end.setHours(23, 59, 59, 999);

  let revertedCount = 0;
  let deletedSyntheticCount = 0;
  const affectedSubjectIds = new Set();

  // Find all attendance records in this date range for student
  const attendanceRecords = await Attendance.find({
    tenantId,
    studentId,
    date: { $gte: start, $lte: end },
    status: 'leave',
  });

  for (const record of attendanceRecords) {
    if (record.subjectId) affectedSubjectIds.add(record.subjectId.toString());

    // If synthetic record (created by leave reconciliation)
    if (record.remarks && /Synthetic Leave Record/i.test(record.remarks)) {
      await Attendance.deleteOne({ _id: record._id });
      deletedSyntheticCount++;
    } else if (record.remarks && /Leave Approved:/i.test(record.remarks)) {
      // Original absent record that had been converted to leave
      record.status = 'absent';
      record.remarks = `Attendance Reverted: Leave Cancelled (${reason})`;
      await record.save();
      revertedCount++;
    }
  }

  // Recalculate stats for affected subjects
  for (const subId of affectedSubjectIds) {
    try {
      await addStatRecalcJob({
        studentId: studentId.toString(),
        subjectId: subId,
        tenantId: tenantId.toString(),
      });
    } catch (queueErr) {
      logger.warn('Failed to enqueue stat recalc job after leave revert', {
        error: queueErr.message,
      });
    }
  }

  // Invalidate caches
  try {
    await delPattern('attendance:*');
    await delPattern('leave:*');
    await delPattern('risk:*');
  } catch (cacheErr) {}

  return {
    revertedCount,
    deletedSyntheticCount,
    affectedSubjects: Array.from(affectedSubjectIds),
  };
};

// ============================================================================
// CONTROLLER HANDLERS
// ============================================================================

/**
 * PREVIEW TIMETABLE SLOTS FOR CHOSEN DATES & SUBJECT
 * GET /api/leaves/slots-preview
 */
const getScheduledSlotsPreview = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { section, fromDate, toDate, subjectId } = req.query;

    if (!section || !fromDate || !toDate) {
      return res.status(400).json({
        success: false,
        message: 'section, fromDate, and toDate are required query parameters',
      });
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Expected ISO 8601 strings.',
      });
    }

    if (start > end) {
      return res.status(400).json({
        success: false,
        message: 'fromDate cannot be after toDate',
      });
    }

    const rawCourseId = req.query.courseId;
    const validQueryCourseId =
      rawCourseId &&
      typeof rawCourseId === 'string' &&
      rawCourseId !== '[object Object]' &&
      mongoose.Types.ObjectId.isValid(rawCourseId)
        ? rawCourseId
        : null;

    const studentUserCourseId = req.user?.courseId?._id || req.user?.courseId;
    const resolvedCourseId =
      validQueryCourseId || (req.user?.role === 'student' ? studentUserCourseId : null);
    const resolvedBranch = req.query.branch || (req.user?.role === 'student' ? req.user.branch : null);
    const resolvedSemester = req.query.semester !== undefined && req.query.semester !== null && req.query.semester !== ''
      ? req.query.semester
      : (req.user?.role === 'student' ? req.user.semester : null);

    const schedule = await getScheduledSlotsForRange(
      tenantId,
      section,
      fromDate,
      toDate,
      subjectId || null,
      {
        courseId: resolvedCourseId,
        branch: resolvedBranch,
        semester: resolvedSemester,
      }
    );

    const zeroSlotDays = schedule.filter((d) => d.slotsCount === 0).map((d) => d.date);
    const totalSlots = schedule.reduce((sum, d) => sum + d.slotsCount, 0);

    return res.status(200).json({
      success: true,
      data: {
        totalDays: schedule.length,
        totalSlots,
        zeroSlotDays,
        schedule,
      },
    });
  } catch (error) {
    logger.error('Error fetching slots preview for leave', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to preview timetable slots',
      error: error.message,
    });
  }
};

/**
 * CREATE A NEW LEAVE REQUEST
 * POST /api/leaves
 */
const createLeaveRequest = async (req, res) => {
  try {
    const studentId = req.user._id;
    const tenantId = req.user.tenantId;
    const {
      leaveType,
      fromDate,
      toDate,
      timetableId,
      reason,
      reasonDescription,
      adminOverride,
    } = req.body;

    // 1. Fetch Student profile
    const student = await User.findOne({
      _id: studentId,
      tenantId,
      role: 'student',
      isActive: true,
    }).lean();

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Active student record not found',
      });
    }

    const studentSection = (student.section || req.body.section || '').trim().toUpperCase();
    if (!studentSection) {
      return res.status(400).json({
        success: false,
        message: 'Student account is not assigned to any academic section',
      });
    }

    // 2. Validate dates
    const start = new Date(fromDate);
    const end = new Date(toDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid fromDate or toDate format',
      });
    }

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    if (start > end) {
      return res.status(400).json({
        success: false,
        message: 'fromDate cannot be after toDate',
      });
    }

    // Maximum 30 days leave per request safeguard
    const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    if (diffDays > 30) {
      return res.status(400).json({
        success: false,
        message: 'Leave requests cannot exceed 30 consecutive days in a single application',
      });
    }

    // Backdated Limit: 30-day maximum backdated check unless adminOverride is supplied
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const maxBackdatedCutoff = new Date(now);
    maxBackdatedCutoff.setDate(maxBackdatedCutoff.getDate() - 30);

    const isAdminUser = ['admin', 'super_admin'].includes(req.user.role);
    const hasAdminOverride = adminOverride === true || adminOverride === 'true';

    if (start < maxBackdatedCutoff && !hasAdminOverride && !isAdminUser) {
      return res.status(400).json({
        success: false,
        message: 'Leave requests cannot be backdated more than 30 days without administrator override.',
        code: 'BACKDATED_LIMIT_EXCEEDED',
      });
    }

    // 3. Normalize subject selection & determine flowType
    let rawSubjectIds = req.body.subjectIds;
    if (typeof rawSubjectIds === 'string') {
      try {
        const parsed = JSON.parse(rawSubjectIds);
        rawSubjectIds = Array.isArray(parsed) ? parsed : [parsed];
      } catch (e) {
        rawSubjectIds = [rawSubjectIds];
      }
    }
    let subjectIds = Array.isArray(rawSubjectIds)
      ? rawSubjectIds.filter(Boolean).map((s) => String(s).trim())
      : [];

    if (subjectIds.length === 0 && req.body.subjectId) {
      subjectIds = [String(req.body.subjectId).trim()];
    }

    let flowType = 'all-classes';
    let singleSubjectDoc = null;

    if (subjectIds.length === 1) {
      flowType = 'single-subject';
      singleSubjectDoc = await Subject.findOne({
        _id: subjectIds[0],
        tenantId,
        isActive: true,
      }).lean();

      if (!singleSubjectDoc) {
        return res.status(404).json({
          success: false,
          message: 'Selected subject does not exist or is inactive',
        });
      }
    } else if (subjectIds.length > 1) {
      flowType = 'multi-subject';
    }

    // 4. Exam Schedule Gating Check
    const conflictingExam = await checkExamPeriodConflict(
      tenantId,
      {
        section: studentSection,
        courseId: student.courseId,
        branch: student.branch,
        semester: student.semester,
      },
      start,
      end,
      subjectIds
    );

    let examPeriodConflict = false;
    if (conflictingExam) {
      const isOD = leaveType === 'od' || leaveType === 'on-duty';
      if (isOD) {
        return res.status(400).json({
          success: false,
          message: `On-Duty (OD) leaves are strictly not permitted during scheduled exam periods (Conflicting exam: "${conflictingExam.title || 'Scheduled Exam'}" on ${formatDateDMY(conflictingExam.date)}). Please contact your HOD.`,
          code: 'EXAM_OD_FORBIDDEN',
          conflictingExamTitle: conflictingExam.title,
          conflictingExamDate: conflictingExam.date,
        });
      }
      examPeriodConflict = true;
    }

    // 5. Timetable schedule edge-case checks
    const schedule = await getScheduledSlotsForRange(
      tenantId,
      studentSection,
      start,
      end,
      flowType === 'single-subject' ? subjectIds[0] : null,
      {
        courseId: student.courseId || req.user?.courseId,
        branch: student.branch || req.user?.branch,
        semester: student.semester || req.user?.semester,
      }
    );

    if (flowType === 'single-subject') {
      const datesWithNoClasses = schedule.filter((d) => d.slotsCount === 0);
      if (datesWithNoClasses.length === schedule.length) {
        return res.status(409).json({
          success: false,
          message: `No classes are scheduled for ${singleSubjectDoc.subjectName} during the selected date range. Cannot submit leave without scheduled classes.`,
        });
      }
    } else {
      const totalSectionSlots = schedule.reduce((sum, d) => sum + d.slotsCount, 0);
      if (totalSectionSlots === 0) {
        return res.status(409).json({
          success: false,
          message: `No classes are scheduled for Section ${studentSection} during the selected dates. Leave is only applicable for scheduled academic days.`,
        });
      }
    }

    // Specific session/slot selection (half-day)
    let sessionSlot = null;
    if (timetableId) {
      const slotEntry = await Timetable.findOne({
        _id: timetableId,
        tenantId,
        section: studentSection,
        isActive: true,
      }).lean();

      if (!slotEntry) {
        return res.status(404).json({
          success: false,
          message: 'Specified timetable slot not found or not active for your section',
        });
      }

      sessionSlot = {
        timetableId: slotEntry._id,
        day: slotEntry.day,
        startTime: slotEntry.startTime,
        endTime: slotEntry.endTime,
        room: slotEntry.room || '',
      };
    } else if (diffDays === 1) {
      const singleDaySlots = schedule[0]?.slots || [];
      if (singleDaySlots.length > 1 && req.body.requireSlotChoice === 'true') {
        return res.status(409).json({
          success: false,
          message: 'Multiple classes exist on this day. Please select a specific slot or choose full-day leave.',
          availableSlots: singleDaySlots,
        });
      }
    }

    // Overlapping active leave request check
    const overlappingLeave = await LeaveRequest.findOne({
      tenantId,
      studentId,
      status: { $in: ['pending', 'approved', 'attendance-updated'] },
      $or: [{ fromDate: { $lte: end }, toDate: { $gte: start } }],
    }).lean();

    if (overlappingLeave) {
      return res.status(409).json({
        success: false,
        message: `You already have an active leave request (${overlappingLeave.leaveType}, status: ${overlappingLeave.status}) covering this period.`,
      });
    }

    // 6. Dual Routing Flow: Determine assigned mentor or teacher
    let assignedTeacherId = null;
    let mentorId = null;

    if (flowType === 'single-subject') {
      // Route Flow A: Direct to Subject Teacher
      const slotWithTeacher = await Timetable.findOne({
        tenantId,
        subjectId: subjectIds[0],
        section: studentSection,
        teacherId: { $exists: true, $ne: null },
      }).lean();

      if (slotWithTeacher && slotWithTeacher.teacherId) {
        assignedTeacherId = slotWithTeacher.teacherId;
      } else if (singleSubjectDoc && singleSubjectDoc.teacherId) {
        assignedTeacherId = singleSubjectDoc.teacherId;
      }
    } else {
      // Route Flow B: All-Classes or Multi-Subject -> Primary Mentor
      const mentor = await resolvePrimaryMentor(
        tenantId,
        studentSection,
        student.courseId,
        student.branch,
        student.semester
      );

      if (!mentor || !mentor.teacherId) {
        return res.status(400).json({
          success: false,
          code: 'MENTOR_NOT_ASSIGNED',
          message: `Academic Mentor has not been assigned to Section ${studentSection} yet. Leave cannot be raised currently. Please contact your administrator.`,
        });
      }

      if (mentor.isSyntheticMentor) {
        assignedTeacherId = mentor.teacherId._id || mentor.teacherId;
        mentorId = mentor.teacherId._id || mentor.teacherId;
      } else {
        mentorId = mentor.teacherId._id || mentor.teacherId;
      }
    }

    // 7. Process file uploads via Cloudinary (with local fallback)
    const attachments = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const uploadRes = await uploadToCloudinary(file.buffer, {
          folder: getLeaveFolder(tenantId),
          originalName: file.originalname,
          resourceType: 'auto',
        });

        attachments.push({
          url: uploadRes.url,
          publicId: uploadRes.publicId,
          originalName: file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size,
          bytes: uploadRes.bytes || file.size,
          uploadedAt: new Date(),
        });
      }
    }

    // 8. Initial approval routing setup
    // Leave routes directly to primary tier: teacher (single-subject) or mentor (all-classes / multi-subject).
    // HOD is NOT forced up front; teacher/mentor can directly approve or choose to forward to HOD when needed.
    const primaryApproverRole = flowType === 'single-subject' ? 'teacher' : 'mentor';
    const approvalChain = [
      {
        role: primaryApproverRole,
        status: 'pending',
        remarks: '',
      },
    ];

    // 9. Save LeaveRequest
    const newLeave = new LeaveRequest({
      tenantId,
      studentId,
      student: {
        name: student.name,
        rollNo: student.rollNo || '',
        section: studentSection,
        email: student.email || '',
      },
      section: studentSection,
      courseId: student.courseId,
      branch: student.branch || '',
      semester: student.semester || '',
      subjectId: singleSubjectDoc ? singleSubjectDoc._id : null,
      subjectIds: subjectIds.map((s) => new mongoose.Types.ObjectId(s)),
      flowType,
      mentorId,
      assignedTeacherId,
      isSyntheticMentor: Boolean(mentor?.isSyntheticMentor),
      examPeriodConflict,
      subjectInfo: singleSubjectDoc
        ? {
            subjectCode: singleSubjectDoc.subjectCode || '',
            subjectName: singleSubjectDoc.subjectName,
          }
        : undefined,
      leaveType,
      fromDate: start,
      toDate: end,
      sessionSlot,
      reason: reason.trim(),
      reasonDescription: reasonDescription.trim(),
      attachments,
      status: 'pending',
      approvalChain,
      currentApproverRole: flowType === 'single-subject' ? 'teacher' : 'mentor',
      reconciliationStatus: 'pending',
    });

    await newLeave.save();

    logger.info('Leave request created successfully', {
      leaveId: newLeave._id,
      studentId,
      flowType,
      mentorId,
      assignedTeacherId,
      examPeriodConflict,
    });

    publishLeaveSubmitted(tenantId, newLeave);

    return res.status(201).json({
      success: true,
      message: 'Leave request submitted successfully and queued for approval',
      data: newLeave,
    });
  } catch (error) {
    logger.error('Error creating leave request', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to create leave request',
      error: error.message,
    });
  }
};

/**
 * GET STUDENT'S OWN LEAVES
 * GET /api/leaves/student
 */
const getStudentLeaves = async (req, res) => {
  try {
    const studentId = req.user._id;
    const tenantId = req.user.tenantId;

    const leaves = await LeaveRequest.find({
      tenantId,
      studentId,
    })
      .populate('mentorId', 'name email department')
      .populate('assignedTeacherId', 'name email department')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: leaves,
    });
  } catch (error) {
    logger.error('Error fetching student leaves', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch leave history',
      error: error.message,
    });
  }
};

/**
 * GET TEACHER'S PENDING LEAVE APPROVAL QUEUE (Flow A: Subject-specific leaves)
 * GET /api/leaves/teacher/pending
 */
const getTeacherPendingLeaves = async (req, res) => {
  try {
    const teacherId = req.user._id;
    const tenantId = req.user.tenantId;

    // Fetch teacher profile to get assigned sections & subjects
    const teacher = await User.findOne({
      _id: teacherId,
      tenantId,
      role: 'teacher',
    }).lean();

    if (!teacher) {
      return res.status(403).json({
        success: false,
        message: 'Teacher profile not found',
      });
    }

    const assignedSections = new Set();
    const assignedSubjectIds = [];

    (teacher.assignedSubjects || []).forEach((as) => {
      if (as.section) assignedSections.add(as.section.trim().toUpperCase());
      if (as.subjectId) assignedSubjectIds.push(as.subjectId);
    });

    const query = {
      tenantId,
      status: 'pending',
      flowType: 'single-subject',
      currentApproverRole: 'teacher',
      approvalChain: { $elemMatch: { role: 'teacher', status: 'pending' } },
    };

    if (assignedSections.size > 0 || assignedSubjectIds.length > 0) {
      query.$or = [
        { assignedTeacherId: teacherId },
        {
          section: { $in: Array.from(assignedSections) },
          subjectId: { $in: assignedSubjectIds },
        },
      ];
    } else {
      query.assignedTeacherId = teacherId;
    }

    const pendingLeaves = await LeaveRequest.find(query)
      .populate('subjectId', 'subjectName subjectCode')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: pendingLeaves,
    });
  } catch (error) {
    logger.error('Error fetching teacher pending leaves', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch pending leave queue',
      error: error.message,
    });
  }
};

/**
 * GET MENTOR'S PENDING LEAVE APPROVAL QUEUE (Flow B: All-Classes & Multi-Subject)
 * GET /api/leaves/mentor/pending
 */
const getMentorPendingLeaves = async (req, res) => {
  try {
    const teacherId = req.user._id;
    const tenantId = req.user.tenantId;

    // Find mentor assignments for this teacher
    const myAssignments = await MentorAssignment.find({
      tenantId,
      teacherId,
      isActive: true,
    }).lean();

    // Option B: Also include any sections from User.customRoles
    const customRoleConditions = (req.user.customRoles || [])
      .filter(cr => cr.section)
      .map(cr => {
        const cond = { section: cr.section.toUpperCase() };
        if (cr.courseId) cond.courseId = cr.courseId;
        if (cr.branch) cond.branch = cr.branch;
        if (cr.semester) cond.semester = cr.semester;
        return cond;
      });

    const cohortConditions = [
      ...myAssignments.map((a) => {
        const cond = { section: a.section };
        if (a.courseId) cond.courseId = a.courseId;
        if (a.branch) cond.branch = a.branch;
        if (a.semester) cond.semester = a.semester;
        return cond;
      }),
      ...customRoleConditions,
    ];

    const query = {
      tenantId,
      status: 'pending',
      flowType: { $in: ['all-classes', 'multi-subject'] },
      currentApproverRole: 'mentor',
      approvalChain: { $elemMatch: { role: 'mentor', status: 'pending' } },
      $or: [
        { mentorId: teacherId },
        ...(cohortConditions.length > 0 ? cohortConditions : []),
      ],
    };

    const pendingLeaves = await LeaveRequest.find(query)
      .populate('mentorId', 'name email')
      .populate('subjectIds', 'subjectName subjectCode')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: pendingLeaves,
    });
  } catch (error) {
    logger.error('Error fetching mentor pending leaves', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch mentor pending queue',
      error: error.message,
    });
  }
};

/**
 * GET LEAVES BY SECTION OR ALL TENANT LEAVES (Admin & HOD)
 * GET /api/leaves/section/:section
 * GET /api/leaves/all
 */
const getSectionLeaves = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { section } = req.params;
    const { status, leaveType, fromDate, toDate, flowType } = req.query;

    const query = { tenantId };

    if (req.user?.role === 'teacher') {
      const assignedSecs = await getTeacherAssignedSections(req.user, tenantId);
      if (assignedSecs.length === 0) {
        return res.status(200).json({ success: true, data: [] });
      }
      if (section && section !== 'all') {
        const secClean = section.trim().toUpperCase();
        if (!assignedSecs.includes(secClean)) {
          return res.status(200).json({ success: true, data: [] });
        }
        query.section = secClean;
      } else {
        query.section = { $in: assignedSecs };
      }
    } else if (section && section !== 'all') {
      query.section = section.trim().toUpperCase();
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    if (leaveType && leaveType !== 'all') {
      query.leaveType = leaveType;
    }

    if (flowType && flowType !== 'all') {
      query.flowType = flowType;
    }

    if (fromDate || toDate) {
      query.fromDate = {};
      if (fromDate) query.fromDate.$gte = new Date(fromDate);
      if (toDate) query.fromDate.$lte = new Date(toDate);
    }

    const leaves = await LeaveRequest.find(query)
      .populate('mentorId', 'name email department')
      .populate('assignedTeacherId', 'name email department')
      .populate('subjectId', 'subjectName subjectCode')
      .populate('subjectIds', 'subjectName subjectCode')
      .populate('cancelledBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: leaves,
    });
  } catch (error) {
    logger.error('Error fetching section leaves', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch section leaves',
      error: error.message,
    });
  }
};

/**
 * APPROVE, REJECT, OR REQUEST INFO ON A LEAVE REQUEST
 * PUT /api/leaves/:id/approve
 */
const approveOrRejectLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, remarks } = req.body; // action: 'approve' | 'reject' | 'needs-more-info'
    const approverId = req.user._id;
    const approverRole = req.user.role; // 'teacher', 'admin', 'super_admin'
    const approverName = req.user.name || 'Staff';
    const tenantId = req.user.tenantId;

    const validActions = [
      'approve',
      'reject',
      'needs-more-info',
      'forward-hod',
      'escalate-hod',
      'forward-dean',
      'escalate-dean',
    ];

    if (!validActions.includes(action)) {
      return res.status(400).json({
        success: false,
        message: `Invalid action. Expected one of: ${validActions.join(', ')}`,
      });
    }

    if (action === 'reject' && (!remarks || remarks.trim().length < 5)) {
      return res.status(400).json({
        success: false,
        message: 'Remarks (min 5 characters) are mandatory when rejecting a leave request',
      });
    }

    const leave = await LeaveRequest.findOne({ _id: id, tenantId });
    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found',
      });
    }

    if (leave.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot act on a cancelled leave request',
      });
    }

    if (leave.status === 'rejected') {
      return res.status(400).json({
        success: false,
        message: 'This leave request has already been rejected',
      });
    }

    if (leave.status === 'attendance-updated') {
      return res.status(400).json({
        success: false,
        message: 'This leave request has already been approved and attendance reconciled',
      });
    }

    // Record this step in approvalChain
    let currentStep = leave.approvalChain.find((step) => step.status === 'pending');
    if (!currentStep) {
      currentStep = {
        role: approverRole === 'teacher' ? 'teacher' : 'admin',
        status: 'pending',
      };
      leave.approvalChain.push(currentStep);
    }

    currentStep.approverId = approverId;
    currentStep.approverName = approverName;
    currentStep.actedAt = new Date();
    currentStep.remarks = (remarks || '').trim();

    // 1. REJECT ACTION
    if (action === 'reject') {
      currentStep.status = 'rejected';
      leave.status = 'rejected';
      await leave.save();

      publishLeaveStatusChanged(tenantId, 'rejected', leave);

      return res.status(200).json({
        success: true,
        message: 'Leave request rejected',
        data: leave,
      });
    }

    // 2. NEEDS MORE INFO ACTION
    if (action === 'needs-more-info') {
      currentStep.status = 'needs-more-info';
      await leave.save();

      publishLeaveStatusChanged(tenantId, 'info_requested', leave);

      return res.status(200).json({
        success: true,
        message: 'Requested more information from student',
        data: leave,
      });
    }

    // 3. FORWARD / ESCALATE TO HOD ACTION (Teacher/Mentor -> HOD)
    if (action === 'forward-hod' || action === 'escalate-hod') {
      currentStep.status = 'approved';
      if (!currentStep.remarks) {
        currentStep.remarks = `Forwarded to HOD by ${approverName}`;
      }

      // Check if an HOD step already exists in chain
      const existingHodStep = leave.approvalChain.find(
        (s) => s.role === 'hod' && s.status === 'pending'
      );
      if (!existingHodStep) {
        leave.approvalChain.push({
          role: 'hod',
          status: 'pending',
          remarks: remarks ? `Forwarded by ${approverName}: ${remarks.trim()}` : `Forwarded by ${approverName} for departmental review.`,
        });
      }

      leave.currentApproverRole = 'hod';
      leave.status = 'pending';
      await leave.save();

      publishLeaveStatusChanged(tenantId, 'escalated', leave);

      return res.status(200).json({
        success: true,
        message: `Leave request approved by ${approverName} and forwarded to HOD for review.`,
        data: leave,
      });
    }

    // 4. FORWARD / ESCALATE TO DEAN ACTION (HOD -> Dean)
    if (action === 'forward-dean' || action === 'escalate-dean') {
      currentStep.status = 'approved';
      if (!currentStep.remarks) {
        currentStep.remarks = `Escalated to Dean by HOD ${approverName}`;
      }

      const existingDeanStep = leave.approvalChain.find(
        (s) => s.role === 'dean' && s.status === 'pending'
      );
      if (!existingDeanStep) {
        leave.approvalChain.push({
          role: 'dean',
          status: 'pending',
          remarks: remarks ? `Escalated by HOD ${approverName}: ${remarks.trim()}` : `Escalated by HOD ${approverName} for institutional review.`,
        });
      }

      leave.currentApproverRole = 'dean';
      leave.status = 'pending';
      await leave.save();

      publishLeaveStatusChanged(tenantId, 'escalated', leave);

      return res.status(200).json({
        success: true,
        message: `Leave request escalated to Dean by HOD ${approverName}.`,
        data: leave,
      });
    }

    // 5. DIRECT APPROVAL (Final Approval by this tier)
    currentStep.status = 'approved';

    // If teacher or mentor directly approves, remove any pending HOD/Dean steps that were unneeded
    leave.approvalChain = leave.approvalChain.filter(
      (step) => step.status !== 'pending'
    );

    // Final Approval reached! Execute automated attendance reconciliation
    leave.status = 'approved';
    await leave.save();

    const reconciliationOutcome = await reconcileAttendanceForLeave(leave, approverId);

    publishLeaveStatusChanged(tenantId, 'approved', leave);

    return res.status(200).json({
      success: true,
      message: `Leave request approved and attendance successfully reconciled (${reconciliationOutcome.updatedCount} updated, ${reconciliationOutcome.createdCount} synthetic records created).`,
      data: leave,
      reconciliation: reconciliationOutcome,
    });
  } catch (error) {
    logger.error('Error approving/rejecting leave request', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to process leave approval action',
      error: error.message,
    });
  }
};

/**
 * CANCEL A LEAVE REQUEST WITH AUTOMATED ATTENDANCE REVERT
 * POST /api/leaves/:id/cancel
 */
const cancelLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;
    const tenantId = req.user.tenantId;
    const { reason } = req.body;

    const leave = await LeaveRequest.findOne({ _id: id, tenantId });
    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found',
      });
    }

    const isOwner = leave.studentId.toString() === userId.toString();
    const isAdmin = ['admin', 'super_admin'].includes(userRole);
    const isAssignedStaff =
      (leave.mentorId && leave.mentorId.toString() === userId.toString()) ||
      (leave.assignedTeacherId && leave.assignedTeacherId.toString() === userId.toString());

    if (!isOwner && !isAdmin && !isAssignedStaff) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to cancel this leave request',
      });
    }

    if (leave.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'This leave request is already cancelled',
      });
    }

    // If leave was approved or reconciled with attendance, execute attendance revert
    let revertOutcome = null;
    if (['approved', 'attendance-updated'].includes(leave.status)) {
      revertOutcome = await executeAttendanceRevert(
        leave,
        userId,
        reason || 'User cancelled approved leave'
      );
      leave.reconciliationStatus = 'reverted';
    }

    leave.status = 'cancelled';
    leave.cancelledBy = userId;
    leave.cancelledAt = new Date();
    leave.revertOutcome = revertOutcome;
    await leave.save();

    logger.info('Leave request cancelled', {
      leaveId: leave._id,
      cancelledBy: userId,
      revertOutcome,
    });

    publishLeaveStatusChanged(tenantId, 'cancelled', leave);

    return res.status(200).json({
      success: true,
      message: 'Leave request cancelled and any reconciled attendance records successfully reverted',
      data: leave,
      revertOutcome,
    });
  } catch (error) {
    logger.error('Error cancelling leave request', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to cancel leave request',
      error: error.message,
    });
  }
};

/**
 * FORCE RE-RECONCILE ATTENDANCE FOR AN APPROVED LEAVE (Admin/Teacher)
 * POST /api/leaves/:id/reconcile
 */
const reconcileLeaveAttendanceEndpoint = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;
    const approverId = req.user._id;

    const leave = await LeaveRequest.findOne({ _id: id, tenantId });
    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found',
      });
    }

    if (!['approved', 'attendance-updated'].includes(leave.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only approved leave requests can be reconciled with attendance',
      });
    }

    const outcome = await reconcileAttendanceForLeave(leave, approverId);

    return res.status(200).json({
      success: true,
      message: 'Attendance re-reconciled successfully',
      reconciliation: outcome,
      data: leave,
    });
  } catch (error) {
    logger.error('Error re-reconciling leave attendance', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to reconcile attendance for leave',
      error: error.message,
    });
  }
};

// ============================================================================
// MENTOR ASSIGNMENT CRUD CONTROLLERS
// ============================================================================

/**
 * GET MENTOR ASSIGNMENTS FOR TENANT
 * GET /api/leaves/mentors
 */
const getMentorAssignments = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { section, courseId, branch, semester } = req.query;

    const query = { tenantId };
    if (section) query.section = section.trim().toUpperCase();
    if (courseId) query.courseId = courseId;
    if (branch) query.branch = branch;
    if (semester) query.semester = Number(semester);

    const assignments = await MentorAssignment.find(query)
      .populate('teacherId', 'name email department designation')
      .populate('courseId', 'courseName courseCode')
      .populate('assignedBy', 'name email')
      .sort({ section: 1, createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: assignments,
    });
  } catch (error) {
    logger.error('Error fetching mentor assignments', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch mentor assignments',
      error: error.message,
    });
  }
};

/**
 * CREATE OR UPDATE MENTOR ASSIGNMENT
 * POST /api/leaves/mentors
 */
const createMentorAssignment = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const {
      teacherId,
      section,
      courseId,
      branch,
      semester,
      academicYear,
      isPrimary,
    } = req.body;

    if (!teacherId || !section) {
      return res.status(400).json({
        success: false,
        message: 'teacherId and section are required fields',
      });
    }

    // Verify teacher
    const teacher = await User.findOne({
      _id: teacherId,
      tenantId,
      role: 'teacher',
      isActive: true,
    });

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Active teacher account not found',
      });
    }

    const secUpper = section.trim().toUpperCase();
    const semNum = semester ? Number(semester) : null;

    // If marked isPrimary, demote existing primary mentors for this cohort
    if (isPrimary) {
      await MentorAssignment.updateMany(
        {
          tenantId,
          section: secUpper,
          courseId: courseId || null,
          branch: branch || '',
          semester: semNum,
        },
        { $set: { isPrimary: false } }
      );
    }

    const assignment = await MentorAssignment.findOneAndUpdate(
      {
        tenantId,
        teacherId,
        section: secUpper,
        courseId: courseId || null,
        branch: branch || '',
        semester: semNum,
      },
      {
        $set: {
          tenantId,
          teacherId,
          section: secUpper,
          courseId: courseId || null,
          branch: branch || '',
          semester: semNum,
          academicYear: academicYear || new Date().getFullYear().toString(),
          isPrimary: isPrimary !== undefined ? Boolean(isPrimary) : true,
          isActive: true,
          assignedBy: req.user._id,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(201).json({
      success: true,
      message: 'Academic mentor assigned successfully',
      data: assignment,
    });
  } catch (error) {
    logger.error('Error assigning academic mentor', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to assign academic mentor',
      error: error.message,
    });
  }
};

/**
 * DELETE MENTOR ASSIGNMENT
 * DELETE /api/leaves/mentors/:id
 */
const deleteMentorAssignment = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    const deleted = await MentorAssignment.findOneAndDelete({ _id: id, tenantId });
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Mentor assignment not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Mentor assignment deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting mentor assignment', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to delete mentor assignment',
      error: error.message,
    });
  }
};

/**
 * EXPORT LEAVE REGISTER AS CSV
 * GET /api/leaves/export
 */
const exportLeavesCsv = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { section, status, leaveType, fromDate, toDate, flowType } = req.query;

    const query = { tenantId };
    if (section && section !== 'all') query.section = section.trim().toUpperCase();
    if (status && status !== 'all') query.status = status;
    if (leaveType && leaveType !== 'all') query.leaveType = leaveType;
    if (flowType && flowType !== 'all') query.flowType = flowType;
    if (fromDate || toDate) {
      query.fromDate = {};
      if (fromDate) query.fromDate.$gte = new Date(fromDate);
      if (toDate) query.fromDate.$lte = new Date(toDate);
    }

    const leaves = await LeaveRequest.find(query)
      .populate('mentorId', 'name email')
      .populate('assignedTeacherId', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    const headers = [
      'Leave ID',
      'Student Roll No',
      'Student Name',
      'Section',
      'Leave Type',
      'Routing Flow',
      'From Date (DD/MM/YYYY)',
      'To Date (DD/MM/YYYY)',
      'Total Days',
      'Status',
      'Reason',
      'Assigned Approver',
      'Exam Conflict',
      'Reconciliation Status',
      'Created Date (DD/MM/YYYY)',
    ];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = leaves.map((l) => {
      const fromD = formatDateDMY(l.fromDate);
      const toD = formatDateDMY(l.toDate);
      const createdD = formatDateDMY(l.createdAt);
      const diff = Math.ceil((new Date(l.toDate) - new Date(l.fromDate)) / (1000 * 60 * 60 * 24)) + 1;
      const assigned = l.mentorId?.name
        ? `Mentor: ${l.mentorId.name}`
        : l.assignedTeacherId?.name
        ? `Teacher: ${l.assignedTeacherId.name}`
        : 'Unassigned';

      return [
        escapeCsv(l._id),
        escapeCsv(l.student?.rollNo || 'N/A'),
        escapeCsv(l.student?.name || 'N/A'),
        escapeCsv(l.section),
        escapeCsv(l.leaveType),
        escapeCsv(l.flowType || 'all-classes'),
        escapeCsv(fromD),
        escapeCsv(toD),
        diff,
        escapeCsv(l.status),
        escapeCsv(l.reason),
        escapeCsv(assigned),
        escapeCsv(l.examPeriodConflict ? 'Yes' : 'No'),
        escapeCsv(l.reconciliationStatus || 'none'),
        escapeCsv(createdD),
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Leave_Register_${toISODateString(new Date())}.csv"`
    );
    return res.status(200).send(csvContent);
  } catch (error) {
    logger.error('Error exporting leaves CSV', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to export leave register CSV',
      error: error.message,
    });
  }
};

module.exports = {
  getScheduledSlotsPreview,
  createLeaveRequest,
  getStudentLeaves,
  getTeacherPendingLeaves,
  getMentorPendingLeaves,
  getSectionLeaves,
  approveOrRejectLeave,
  cancelLeave,
  reconcileLeaveAttendanceEndpoint,
  reconcileAttendanceForLeave,
  executeAttendanceRevert,
  getScheduledSlotsForRange,
  resolvePrimaryMentor,
  checkExamPeriodConflict,
  getMentorAssignments,
  createMentorAssignment,
  deleteMentorAssignment,
  exportLeavesCsv,
  formatDateDMY,
};
