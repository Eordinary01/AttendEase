const Attendance = require("../models/Attendance");
const Subject = require("../models/Subject");
const User = require("../models/User");
const Timetable = require("../models/Timetable");
const Enrollment = require("../models/Enrollment");
const mongoose = require("mongoose");
const { getPagination, paginate, paginatedResponse } = require("../middleware/paginate");
const logger = require("../utils/logger");
const { toISODateString } = require("../utils/dateFormatter");
const {
  publishAttendanceMarked,
  publishAttendanceCorrected,
  publishAtRiskAlert,
} = require("../events/publishers");
require("dotenv").config();

/**
 * Batch resolves student documents (User + Enrollment fallback) in a single query pass
 * Eliminates N+1 DB lookup loops when formatting attendance records and summaries.
 */
async function batchResolveStudents(rawStudentIds, tenantId) {
  if (!rawStudentIds || rawStudentIds.length === 0) return new Map();

  const validObjectIds = rawStudentIds
    .filter((id) => id && mongoose.Types.ObjectId.isValid(String(id)))
    .map((id) => new mongoose.Types.ObjectId(String(id)));

  const studentMap = new Map();
  if (validObjectIds.length === 0) return studentMap;

  // 1. Bulk query User collection
  const users = await User.find({
    _id: { $in: validObjectIds },
    ...(tenantId ? { tenantId } : {}),
  })
    .select("name rollNo section email")
    .lean();

  users.forEach((u) => {
    studentMap.set(String(u._id), {
      id: u._id,
      name: u.name,
      rollNo: u.rollNo || "N/A",
      email: u.email || "",
      section: u.section || "",
    });
  });

  // 2. Bulk query Enrollment for any IDs unresolved via User
  const unresolvedIds = validObjectIds.filter((id) => !studentMap.has(String(id)));
  if (unresolvedIds.length > 0) {
    const enrollments = await Enrollment.find({
      ...(tenantId ? { tenantId } : {}),
      $or: [
        { _id: { $in: unresolvedIds } },
        { userId: { $in: unresolvedIds } },
      ],
    })
      .select("_id userId firstName lastName email enrollmentNumber section")
      .lean();

    enrollments.forEach((enr) => {
      const studentObj = {
        id: enr.userId || enr._id,
        name: `${enr.firstName || ""} ${enr.lastName || ""}`.trim() || enr.email,
        rollNo: enr.enrollmentNumber || "N/A",
        email: enr.email || "",
        section: enr.section || "",
      };
      studentMap.set(String(enr._id), studentObj);
      if (enr.userId) {
        studentMap.set(String(enr.userId), studentObj);
      }
    });
  }

  return studentMap;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const markAttendance = async (req, res) => {
  const { subjectId, section, date, attendanceData, timetableId } = req.body;
  const teacherId = req.user._id;
  const tenantId = req.user.tenantId;

  // Normalize attendanceData (supports both object map { [studentId]: status } and array format [{ studentId, status }])
  let normalizedAttendance = {};
  if (Array.isArray(attendanceData)) {
    for (const item of attendanceData) {
      if (item && (item.studentId || item.id || item._id)) {
        const sId = String(item.studentId || item.id || item._id);
        normalizedAttendance[sId] = item.status || "present";
      }
    }
  } else if (typeof attendanceData === "object" && attendanceData !== null) {
    normalizedAttendance = attendanceData;
  }

  if (!subjectId || !section || !date || Object.keys(normalizedAttendance).length === 0) {
    return res.status(400).json({
      success: false,
      message: "subjectId, section, date, and valid attendanceData are required",
    });
  }

  let session = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
  } catch (e) {
    session = null;
  }

  const cleanupSession = async (abort = false) => {
    if (session) {
      try {
        if (abort) await session.abortTransaction();
        else await session.commitTransaction();
      } catch (e) {}
      try { session.endSession(); } catch (e) {}
    }
  };

  try {
    if (req.user.role !== "teacher") {
      await cleanupSession(true);
      return res.status(403).json({
        success: false,
        message: "Only teachers can mark attendance",
      });
    }

    const subjectQuery = Subject.findOne({
      _id: subjectId,
      tenantId: tenantId,
      isActive: true
    });
    const subject = session ? await subjectQuery.session(session) : await subjectQuery;

    if (!subject) {
      await cleanupSession(true);
      return res.status(404).json({
        success: false,
        message: "Subject not found",
      });
    }

    const isAssigned = req.user.assignedSubjects?.some(
      (a) =>
        a.subjectId?.toString() === subjectId &&
        a.section?.trim().toUpperCase() === section?.trim().toUpperCase()
    );

    if (!isAssigned) {
      await cleanupSession(true);
      return res.status(403).json({
        success: false,
        message: "You are not assigned to teach this subject in this section",
      });
    }

    // Parse date
    const attendanceDate = new Date(date);
    if (isNaN(attendanceDate)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Invalid date format",
      });
    }

    // 📅 Timetable gate — attendance can only be marked against a scheduled class
    const day = WEEKDAYS[attendanceDate.getUTCDay()];
    const scheduledSlots = await Timetable.find({
      tenantId: tenantId,
      subjectId: subjectId,
      section: new RegExp(`^${section.trim()}$`, "i"),
      day: day,
      isActive: true,
      isNoClass: { $ne: true },
    }).session(session).lean();

    if (scheduledSlots.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `No class is scheduled for ${subject.subjectName} in Section ${section} on ${day}. Please add a timetable slot first.`,
        day,
      });
    }

    let classSlot = null;
    if (timetableId) {
      classSlot = scheduledSlots.find((s) => s._id.toString() === timetableId) || null;
      if (!classSlot) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: "The selected time slot is not scheduled for this class on this day",
          availableSlots: scheduledSlots,
        });
      }
    } else if (scheduledSlots.length === 1) {
      classSlot = scheduledSlots[0];
    } else {
      await session.abortTransaction();
      session.endSession();
      return res.status(409).json({
        success: false,
        message: `Multiple time slots found for ${subject.subjectName} in Section ${section} on ${day}. Please select a time slot.`,
        availableSlots: scheduledSlots,
      });
    }

    const dateStr = toISODateString(attendanceDate);
    const classSessionId = `${subjectId}_${section}_${dateStr}_${classSlot._id}`;

    // Get all students in this section once for validation within tenant
    const sectionRegex = new RegExp(`^${section.trim()}$`, "i");
    const studentsInSection = await User.find({
      role: "student",
      section: sectionRegex,
      tenantId: tenantId,
      isActive: true,
    }).select("_id").session(session);

    const Enrollment = require("../models/Enrollment");
    const enrollmentsInSection = await Enrollment.find({
      section: sectionRegex,
      tenantId: tenantId,
    }).select("_id userId").session(session);

    const validStudentIds = new Set();
    studentsInSection.forEach((s) => validStudentIds.add(s._id.toString()));
    enrollmentsInSection.forEach((e) => {
      validStudentIds.add(e._id.toString());
      if (e.userId) validStudentIds.add(e.userId.toString());
    });

    const isOfflineSync = req.headers['x-offline-sync'] === 'true' || req.body.isOfflineSync === true;
    const existingRecords = await Attendance.find({
      tenantId: tenantId,
      timetableId: classSlot._id,
      date: {
        $gte: new Date(`${dateStr}T00:00:00.000Z`),
        $lte: new Date(`${dateStr}T23:59:59.999Z`),
      },
    }).session(session).lean();

    // Separate pre-existing leave/synthetic records from regular attendance marking
    const nonLeaveRecords = existingRecords.filter((r) => {
      const isLeave = r.status === "leave";
      const isSyntheticOrApproved =
        r.remarks &&
        (/Synthetic Leave Record/i.test(r.remarks) || /Leave Approved:/i.test(r.remarks));
      return !(isLeave && isSyntheticOrApproved);
    });

    if (nonLeaveRecords.length > 0 && !isOfflineSync) {
      await cleanupSession(true);
      return res.status(409).json({
        success: false,
        message: `Attendance has already been marked for this class session on ${day} (${dateStr}). Re-marking or updating attendance is locked.`,
        code: "ALREADY_MARKED",
        existingCount: nonLeaveRecords.length,
      });
    }

    const existingMap = new Map(existingRecords.map((r) => [r.studentId.toString(), r]));

    if (existingRecords.length > 0 && isOfflineSync) {
      const conflicts = [];

      for (const [studentId, status] of Object.entries(attendanceData)) {
        const existing = existingMap.get(studentId);
        if (existing && existing.status !== status) {
          conflicts.push({
            studentId,
            existingStatus: existing.status,
            submittedStatus: status,
          });
        }
      }

      if (conflicts.length > 0) {
        await cleanupSession(true);
        return res.status(409).json({
          success: false,
          message: "Attendance was already synced by another device with conflicting status. Teacher review is required.",
          code: "SYNC_CONFLICT",
          conflicts,
        });
      }
    }

    const bulkOperations = [];
    const errors = [];
    const processedStudentIds = [];

    for (const [studentId, status] of Object.entries(normalizedAttendance)) {

      try {
        // Validate status
        if (!["present", "absent", "leave"].includes(status)) {
          errors.push(`Invalid status '${status}' for student ${studentId}`);
          continue;
        }

        // Quick validation using cached student set
        if (!validStudentIds.has(studentId)) {
          errors.push(
            `Student ${studentId} not found or not in section ${section}`,
          );
          continue;
        }

        processedStudentIds.push(studentId);

        // Prepare attendance data with tenantId
        const attendanceDoc = {
          tenantId: tenantId,
          studentId: studentId,
          subjectId: subjectId,
          subject: {
            subjectCode: subject.subjectCode,
            subjectName: subject.subjectName,
          },
          teacherId: teacherId,
          section: section,
          date: attendanceDate,
          status: status,
          semester: subject.semester,
          createdBy: teacherId,
          classSessionId: classSessionId,
          timetableId: classSlot._id,
          day: classSlot.day,
          startTime: classSlot.startTime,
          endTime: classSlot.endTime,
          room: classSlot.room || "",
          ipAddress: req.ip,
          deviceFingerprint: req.headers['x-device-fingerprint'] || req.headers['user-agent'],
          studentStats: {
            totalClasses: 0,
            presentCount: 0,
            absentCount: 0,
            leaveCount: 0,
            percentage: 0
          }
        };

        // Audit Trail: If overriding a student previously marked as 'leave' (e.g. mentor approved)
        const priorRecord = existingMap.get(studentId);
        if (priorRecord && priorRecord.status === "leave" && status !== "leave") {
          const teacherNote = req.body.remarks || `Marked ${status}`;
          attendanceDoc.remarks = `Overridden from leave by Teacher: ${teacherNote}`;
        } else if (priorRecord && priorRecord.remarks) {
          attendanceDoc.remarks = priorRecord.remarks;
        }

        bulkOperations.push({
          updateOne: {
            filter: {
              tenantId: tenantId,
              classSessionId: classSessionId,
              studentId: studentId,
            },
            update: { $set: attendanceDoc },
            upsert: true,
          },
        });

      } catch (error) {
        errors.push(`Error processing student ${studentId}: ${error.message}`);
      }
    }

    // Reject if no valid attendance records could be prepared
    if (bulkOperations.length === 0) {
      await cleanupSession(true);
      return res.status(400).json({
        success: false,
        message: "No valid student attendance records were created. " + (errors.length > 0 ? errors.join("; ") : `No students matched section ${section}`),
        errors: errors.length > 0 ? errors : ["No students matched section " + section],
      });
    }

    // Execute bulk operations if any
    await Attendance.bulkWrite(bulkOperations, { session });

    // Commit transaction so newly inserted records are visible to aggregation queries
    await cleanupSession(false);

    // Update statistics for each student after transaction commit (async via queue)
    if (processedStudentIds.length > 0) {
      const { addStatRecalcJob } = require('../queues/attendanceQueue');
      for (const studentId of processedStudentIds) {
        try {
          addStatRecalcJob(studentId, subjectId, tenantId);
        } catch (e) {}
      }

      // Phase 9: Consecutive absence detection for absent students + cache invalidation
      try {
        const cache = require("../middleware/cache");
        cache.delPattern(`risk:${tenantId}:*`);
        cache.delPattern(`risk:batch:${tenantId}:*`);
      } catch (e) {}

      for (const studentId of processedStudentIds) {
        if (normalizedAttendance[studentId] === "absent") {
          detectConsecutiveAbsence(studentId, tenantId, { subjectId, section }).catch((err) => {
            logger.warn("Consecutive absence check error", { studentId, error: err.message });
          });
        }
      }
    }

    // Proxy detection check (Item #14)
    if (req.ip && processedStudentIds.length > 0) {
      try {
        const Alert = require("../models/Alert");
        const sameIpCount = await Attendance.countDocuments({
          tenantId,
          classSessionId,
          ipAddress: req.ip,
        });

        if (sameIpCount > 40) {
          await Alert.create({
            tenantId,
            title: "Proxy Attendance Alert",
            message: `Unusual concentration of attendance marks (${sameIpCount}) from IP ${req.ip} for ${subject.subjectName} Section ${section}.`,
            type: "system",
            severity: "warning",
            status: "unread",
          });
        }
      } catch (alertErr) {
        logger.debug("Proxy alert evaluation skipped", { error: alertErr.message });
      }
    }

    const { logAudit } = require('../middleware/auditLogger');
    logAudit(req, {
      action: 'ATTENDANCE_MARK',
      resourceType: 'Attendance',
      resourceId: classSessionId,
      after: { recordsCount: bulkOperations.length, subjectId, section, date },
    });

    // Get class summary
    const classSummary = await getClassSummary(classSessionId, tenantId);

    // Publish real-time domain event (fire-and-forget)
    publishAttendanceMarked(tenantId, {
      sessionId: classSessionId,
      subjectId,
      section,
      date,
      recordsCreated: bulkOperations.length,
      stats: {
        totalStudents: studentsInSection.length,
        markedCount: bulkOperations.length,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Attendance marked successfully",
      recordsCreated: bulkOperations.length,
      errors: errors.length > 0 ? errors : null,
      classSessionId,
      classSummary,
      stats: {
        totalStudents: studentsInSection.length,
        markedCount: bulkOperations.length
      }
    });

  } catch (error) {
    await cleanupSession(true);
    logger.error("Error in markAttendance", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Error marking attendance"
    });
  }
};

async function updateStudentAttendanceStats(studentId, subjectId, tenantId, session = null) {
  try {
    const matchQuery = {
      studentId: new mongoose.Types.ObjectId(studentId),
      subjectId: new mongoose.Types.ObjectId(subjectId),
      tenantId: new mongoose.Types.ObjectId(tenantId)
    };

    const pipeline = [
      { $match: matchQuery },
      { $sort: { date: 1 } },
      {
        $group: {
          _id: null,
          totalClasses: { $sum: 1 },
          presentCount: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
          absentCount: { $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] } },
          leaveCount: { $sum: { $cond: [{ $eq: ["$status", "leave"] }, 1, 0] } },
        }
      }
    ];

    let agg = Attendance.aggregate(pipeline);
    if (session) agg = agg.session(session);
    const [stats] = await agg;
    if (!stats) return;

    const percentage = stats.totalClasses > 0
      ? Number(((stats.presentCount / stats.totalClasses) * 100).toFixed(2))
      : 0;

    await Attendance.updateMany(
      matchQuery,
      {
        $set: {
          "studentStats.totalClasses": stats.totalClasses,
          "studentStats.presentCount": stats.presentCount,
          "studentStats.absentCount": stats.absentCount,
          "studentStats.leaveCount": stats.leaveCount,
          "studentStats.percentage": percentage,
          updatedAt: Date.now()
        }
      },
      { session }
    );
  } catch (error) {
    logger.error(`Error updating stats for student ${studentId}`, { error: error.message });
    throw error;
  }
}

// Helper function to get class summary
async function getClassSummary(classSessionId, tenantId) {
  try {
    const records = await Attendance.find({ 
      classSessionId,
      tenantId: tenantId 
    });
    
    if (records.length === 0) return null;
    
    const totalStudents = records.length;
    const presentCount = records.filter(r => r.status === 'present').length;
    const absentCount = records.filter(r => r.status === 'absent').length;
    const leaveCount = records.filter(r => r.status === 'leave').length;
    
    return {
      date: records[0]?.date || new Date(),
      totalStudents,
      presentCount,
      absentCount,
      leaveCount,
      sessionId: classSessionId,
      attendanceRate: totalStudents > 0 ? (presentCount / totalStudents) * 100 : 0
    };
  } catch (error) {
    logger.error("Error getting class summary", { error: error.message });
    return null;
  }
}

async function getStudentIdList(user, tenantId) {
  const ids = [user._id];
  try {
    const Enrollment = mongoose.model("Enrollment");
    const enrollments = await Enrollment.find({
      $or: [
        { userId: user._id },
        { email: (user.email || "").toLowerCase() },
        ...(user.rollNo ? [{ enrollmentNumber: user.rollNo }] : []),
      ],
      tenantId,
    }).select("_id").lean();

    enrollments.forEach((e) => {
      if (e._id && !ids.some((id) => id.toString() === e._id.toString())) {
        ids.push(e._id);
      }
    });
  } catch (err) {}
  return ids;
}

/**
 * GET ATTENDANCE RECORDS
 */
const getAttendanceRecords = async (req, res) => {
  const studentId = req.user._id;
  const tenantId = req.user.tenantId;
  const { subjectId, fromDate, toDate, page, limit } = req.query;

  try {
    if (!["student", "admin", "super_admin"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    let query = { tenantId };
    if (req.user.role === "student") {
      const studentIds = await getStudentIdList(req.user, tenantId);
      query.studentId = { $in: studentIds };
    } else if (req.query.studentId) {
      query.studentId = req.query.studentId;
    }
    
    if (subjectId) {
      query.subjectId = subjectId;
    }

    if (fromDate || toDate) {
      query.date = {};
      if (fromDate) query.date.$gte = new Date(fromDate);
      if (toDate) query.date.$lte = new Date(toDate);
    }

    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(2000, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (p - 1) * l;

    const total = await Attendance.countDocuments(query);
    const attendanceRecords = await Attendance.find(query)
      .populate("subjectId", "subjectCode subjectName semester")
      .populate("teacherId", "name email")
      .sort({ date: -1 })
      .lean()
      .skip(skip)
      .limit(l);

    const stats = attendanceRecords.reduce(
      (acc, record) => {
        acc.total++;
        acc[record.status + "Count"] = (acc[record.status + "Count"] || 0) + 1;

        if (!acc.bySubject[record.subjectId]) {
          acc.bySubject[record.subjectId] = {
            subjectCode: record.subject?.subjectCode,
            subjectName: record.subject?.subjectName,
            total: 0,
            present: 0,
            absent: 0,
            leave: 0,
          };
        }

        acc.bySubject[record.subjectId].total++;
        acc.bySubject[record.subjectId][record.status]++;

        return acc;
      },
      {
        total: 0,
        presentCount: 0,
        absentCount: 0,
        leaveCount: 0,
        bySubject: {},
      },
    );

    // Resolve academic fields with fallback to Enrollment if missing on User document
    let courseId = req.user.courseId || null;
    let courseName = req.user.courseName || "";
    let branch = req.user.branch || "";
    let semester = req.user.semester || 1;
    let admissionYear = req.user.admissionYear || null;

    if (!courseName || !branch || !admissionYear) {
      const Enrollment = mongoose.model("Enrollment");
      const enrollment = await Enrollment.findOne({
        $or: [
          { userId: req.user._id },
          { email: req.user.email },
          { enrollmentNumber: req.user.rollNo },
        ],
        tenantId,
      }).lean();

      if (enrollment) {
        courseId = courseId || enrollment.courseId || null;
        courseName = courseName || enrollment.courseName || "";
        branch = branch || enrollment.branch || "";
        semester = semester || enrollment.semester || 1;
        admissionYear = admissionYear || enrollment.admissionYear || null;

        // Self-heal User document in background if missing
        User.updateOne(
          { _id: req.user._id },
          {
            $set: {
              ...(courseId && { courseId }),
              ...(courseName && { courseName }),
              ...(branch && { branch }),
              ...(semester && { semester }),
              ...(admissionYear && { admissionYear }),
            },
          }
        ).catch(() => {});
      }
    }

    return res.status(200).json({
      success: true,
      message: "Attendance records retrieved successfully",
      count: attendanceRecords.length,
      student: {
        id: req.user._id,
        name: req.user.name,
        section: req.user.section,
        rollNo: req.user.rollNo,
        courseId,
        courseName,
        branch,
        semester,
        admissionYear,
      },
      stats: {
        totalClasses: stats.total,
        presentCount: stats.presentCount || 0,
        absentCount: stats.absentCount || 0,
        leaveCount: stats.leaveCount || 0,
        attendancePercentage:
          stats.total > 0
            ? (((stats.presentCount || 0) / stats.total) * 100).toFixed(2)
            : 0,
        bySubject: Object.values(stats.bySubject).map((s) => ({
          ...s,
          attendancePercentage:
            s.total > 0 ? ((s.present / s.total) * 100).toFixed(2) : 0,
        })),
      },
      data: attendanceRecords,
      records: attendanceRecords,
      pagination: {
        page: p,
        limit: l,
        total,
        totalPages: Math.ceil(total / l),
        hasNextPage: p * l < total,
        hasPrevPage: p > 1
      }
    });
  } catch (error) {
    logger.error("Error fetching attendance records", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Error fetching attendance records",
      error: error.message,
    });
  }
};

/**
 * GET ATTENDANCE SUMMARY
 */
const getAttendanceSummary = async (req, res) => {
  const teacherId = req.user._id;
  const tenantId = req.user.tenantId;
  const { subjectId, section } = req.query;

  if (!subjectId || !section) {
    return res.status(400).json({
      success: false,
      message: "subjectId and section are required",
    });
  }

  try {
    if (req.user.role !== "teacher") {
      return res.status(403).json({
        success: false,
        message: "Only teachers can view attendance summary",
      });
    }

    const isAssigned = req.user.assignedSubjects?.some(
      (a) =>
        a.subjectId?.toString() === subjectId &&
        a.section?.trim().toUpperCase() === section?.trim().toUpperCase()
    );

    if (!isAssigned) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to teach this subject in this section",
      });
    }

    const { page, limit, skip } = getPagination(req, 50, 200);
    const sectionRegex = new RegExp(`^${section.trim()}$`, "i");

    const matchQuery = {
      subjectId: new mongoose.Types.ObjectId(subjectId),
      section: sectionRegex,
      tenantId: new mongoose.Types.ObjectId(tenantId),
    };

    // 1. Group attendance stats per student
    const studentAggStats = await Attendance.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: "$studentId",
          totalClasses: { $sum: 1 },
          presentCount: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
          absentCount: { $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] } },
          leaveCount: { $sum: { $cond: [{ $eq: ["$status", "leave"] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
      { $skip: skip },
      { $limit: limit },
    ]);

    // Batch resolve student details for all aggregated rows in 1 query
    const studentIds = studentAggStats.map((s) => s._id).filter(Boolean);
    const studentMap = await batchResolveStudents(studentIds, tenantId);

    const studentSummary = studentAggStats.map((stat) => {
      const rawId = stat._id ? String(stat._id) : null;
      const sObj = rawId ? studentMap.get(rawId) : null;
      const name = sObj?.name || "Student";
      const rollNo = sObj?.rollNo || "";
      const percentage = stat.totalClasses > 0 ? Number(((stat.presentCount / stat.totalClasses) * 100).toFixed(2)) : 0;

      return {
        studentId: stat._id,
        name,
        rollNo,
        totalClasses: stat.totalClasses,
        presentCount: stat.presentCount,
        absentCount: stat.absentCount,
        leaveCount: stat.leaveCount,
        percentage,
      };
    });

    // 2. Class sessions summary & overall stats
    const [classSessions, overallStatsRaw] = await Promise.all([
      Attendance.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: "$classSessionId",
            date: { $first: "$date" },
            totalStudents: { $sum: 1 },
            presentCount: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
            absentCount: { $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] } },
            leaveCount: { $sum: { $cond: [{ $eq: ["$status", "leave"] }, 1, 0] } },
          },
        },
        {
          $project: {
            _id: 0,
            sessionId: "$_id",
            date: 1,
            totalStudents: 1,
            presentCount: 1,
            absentCount: 1,
            leaveCount: 1,
            attendanceRate: {
              $multiply: [{ $divide: ["$presentCount", "$totalStudents"] }, 100],
            },
          },
        },
        { $sort: { date: -1 } },
      ]),

      Attendance.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: null,
            totalSessions: { $addToSet: "$classSessionId" },
            totalAttendanceRecords: { $sum: 1 },
            presentRecords: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
          },
        },
        {
          $project: {
            _id: 0,
            totalSessions: { $size: "$totalSessions" },
            totalAttendanceRecords: 1,
            averageAttendance: {
              $cond: [
                { $eq: ["$totalAttendanceRecords", 0] },
                0,
                { $round: [{ $multiply: [{ $divide: ["$presentRecords", "$totalAttendanceRecords"] }, 100] }, 2] },
              ],
            },
          },
        },
      ]),
    ]);

    return res.status(200).json({
      success: true,
      message: "Attendance summary retrieved successfully",
      subject: {
        id: subjectId,
        section: section,
      },
      overallStats: overallStatsRaw[0] || {
        totalSessions: 0,
        totalAttendanceRecords: 0,
        averageAttendance: 0,
      },
      classSessions,
      studentSummary,
    });
  } catch (error) {
    logger.error("Error fetching attendance summary", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Error fetching attendance summary",
      error: error.message,
    });
  }
};

/**
 * GET STUDENT ATTENDANCE STATS
 */
const getStudentAttendanceStats = async (req, res) => {
  const tenantId = req.user.tenantId;
  const { subjectId, studentId } = req.query;

  try {
    if (!["student", "teacher", "admin", "super_admin", "parent"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    let targetStudentUser = null;
    if (studentId) {
      targetStudentUser = await User.findById(studentId).lean();
      if (!targetStudentUser) {
        const Enrollment = mongoose.model("Enrollment");
        const enr = await Enrollment.findById(studentId).lean();
        if (enr) {
          targetStudentUser = {
            _id: enr._id,
            name: `${enr.firstName || ''} ${enr.lastName || ''}`.trim() || enr.email,
            rollNo: enr.enrollmentNumber || "",
            email: enr.email || "",
            section: enr.section || "",
          };
        }
      }
    }

    if (!targetStudentUser && req.user.role === "student") {
      targetStudentUser = req.user;
    }

    if (!targetStudentUser) {
      return res.status(400).json({
        success: false,
        message: "Student ID is required or invalid",
      });
    }

    const studentIds = await getStudentIdList(targetStudentUser, tenantId);
    const objStudentIds = studentIds.map((id) => new mongoose.Types.ObjectId(id));

    let query = { 
      studentId: { $in: objStudentIds },
      tenantId: new mongoose.Types.ObjectId(tenantId)
    };
    if (subjectId && mongoose.Types.ObjectId.isValid(subjectId)) {
      query.subjectId = new mongoose.Types.ObjectId(subjectId);
    }

    const stats = await Attendance.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$subjectId",
          totalClasses: { $sum: 1 },
          presentCount: {
            $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] },
          },
          absentCount: {
            $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] },
          },
          leaveCount: {
            $sum: { $cond: [{ $eq: ["$status", "leave"] }, 1, 0] },
          },
          subjectCode: { $first: "$subject.subjectCode" },
          subjectName: { $first: "$subject.subjectName" },
        },
      },
      {
        $project: {
          _id: 0,
          subjectId: "$_id",
          subjectCode: 1,
          subjectName: 1,
          totalClasses: 1,
          presentCount: 1,
          absentCount: 1,
          leaveCount: 1,
          attendancePercentage: {
            $cond: [
              { $eq: ["$totalClasses", 0] },
              0,
              {
                $multiply: [
                  { $divide: ["$presentCount", "$totalClasses"] },
                  100,
                ],
              },
            ],
          },
        },
      },
    ]);

    const overallStats = await Attendance.aggregate([
      {
        $match: {
          studentId: { $in: objStudentIds },
          tenantId: new mongoose.Types.ObjectId(tenantId)
        },
      },
      {
        $group: {
          _id: null,
          totalClasses: { $sum: 1 },
          presentCount: {
            $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] },
          },
          absentCount: {
            $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] },
          },
          leaveCount: {
            $sum: { $cond: [{ $eq: ["$status", "leave"] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          totalClasses: 1,
          presentCount: 1,
          absentCount: 1,
          leaveCount: 1,
          overallPercentage: {
            $cond: [
              { $eq: ["$totalClasses", 0] },
              0,
              {
                $multiply: [
                  { $divide: ["$presentCount", "$totalClasses"] },
                  100,
                ],
              },
            ],
          },
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      message: "Student attendance statistics retrieved successfully",
      student: {
        id: targetStudentUser._id,
        name: targetStudentUser.name,
        rollNo: targetStudentUser.rollNo || "",
        section: targetStudentUser.section || "",
      },
      subjectWiseStats: stats,
      overallStats:
        overallStats.length > 0
          ? overallStats[0]
          : {
              totalClasses: 0,
              presentCount: 0,
              absentCount: 0,
              leaveCount: 0,
              overallPercentage: 0,
            },
    });
  } catch (error) {
    logger.error("Error fetching student attendance stats", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Error fetching attendance statistics",
      error: error.message,
    });
  }
};

/**
 * GET ATTENDANCE BY DATE
 */
const getAttendanceByDate = async (req, res) => {
  const teacherId = req.user._id;
  const tenantId = req.user.tenantId;
  const { date, subjectId, section } = req.query;

  if (!date || !subjectId || !section) {
    return res.status(400).json({
      success: false,
      message: "date, subjectId, and section are required",
    });
  }

  try {
    if (req.user.role !== "teacher") {
      return res.status(403).json({
        success: false,
        message: "Only teachers can view attendance details",
      });
    }

    const isAssigned = req.user.assignedSubjects?.some(
      (a) =>
        a.subjectId?.toString() === subjectId &&
        a.section?.trim().toUpperCase() === section?.trim().toUpperCase()
    );

    if (!isAssigned) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to teach this subject in this section",
      });
    }

    let attendanceDate = new Date(date);
    if (isNaN(attendanceDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format. Please provide a valid date string or timestamp.",
      });
    }

    const startDate = new Date(attendanceDate);
    startDate.setUTCHours(0, 0, 0, 0);
    const endDate = new Date(attendanceDate);
    endDate.setUTCHours(23, 59, 59, 999);
    const dateStr = toISODateString(attendanceDate);
    const sectionRegex = new RegExp(`^${section.trim()}$`, "i");

    const attendance = await Attendance.find({
      subjectId: subjectId,
      section: sectionRegex,
      tenantId: tenantId,
      date: { $gte: startDate, $lte: endDate },
    }).sort({ createdAt: 1 }).lean();

    // Populate student details fallback (handles Enrollment IDs or missing User docs)
    const Enrollment = require("../models/Enrollment");
    const formattedAttendance = await Promise.all(
      attendance.map(async (rec) => {
        let studentObj = null;
        const rawId = rec.studentId;

        if (rawId) {
          const u = await User.findById(rawId).select("name rollNo email").lean();
          if (u) {
            studentObj = {
              _id: u._id,
              name: u.name,
              rollNo: u.rollNo || "",
              email: u.email || "",
            };
          } else {
            const enr = await Enrollment.findById(rawId).lean();
            if (enr) {
              studentObj = {
                _id: enr._id,
                name: `${enr.firstName || ''} ${enr.lastName || ''}`.trim() || enr.email,
                rollNo: enr.enrollmentNumber || "",
                email: enr.email || "",
              };
            } else {
              const enrByUserId = await Enrollment.findOne({ userId: rawId, tenantId }).lean();
              if (enrByUserId) {
                studentObj = {
                  _id: rawId,
                  name: `${enrByUserId.firstName || ''} ${enrByUserId.lastName || ''}`.trim() || enrByUserId.email,
                  rollNo: enrByUserId.enrollmentNumber || "",
                  email: enrByUserId.email || "",
                };
              }
            }
          }
        }
        return {
          ...rec,
          studentId: studentObj || { _id: rawId || null, name: "Student", rollNo: "" },
        };
      })
    );

    return res.status(200).json({
      success: true,
      message: "Attendance details retrieved successfully",
      date: dateStr,
      subject: { id: subjectId, section: section },
      totalRecords: formattedAttendance.length,
      attendance: formattedAttendance,
    });
  } catch (error) {
    logger.error("Error fetching attendance by date", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Error fetching attendance details",
      error: error.message,
    });
  }
};

/**
 * UPDATE ATTENDANCE RECORD
 */
const updateAttendanceRecord = async (req, res) => {
  const { attendanceId } = req.params;
  const { status, remarks } = req.body;
  const teacherId = req.user._id;
  const tenantId = req.user.tenantId;

  if (!status || !["present", "absent", "leave"].includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Valid status (present, absent, leave) is required",
    });
  }

  try {
    if (req.user.role !== "teacher") {
      return res.status(403).json({
        success: false,
        message: "Only teachers can update attendance",
      });
    }

    const attendance = await Attendance.findOne({
      _id: attendanceId,
      tenantId: tenantId
    });
    
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    if (attendance.teacherId.toString() !== teacherId) {
      return res.status(403).json({
        success: false,
        message: "You can only update attendance you marked",
      });
    }

    // Audit trail: If overriding a leave record, record teacher override note
    if (attendance.status === "leave" && status !== "leave") {
      attendance.remarks = remarks
        ? `Overridden from leave by Teacher: ${remarks}`
        : `Overridden from leave by Teacher: Status changed to ${status}`;
    } else if (remarks) {
      attendance.remarks = remarks;
    }
    attendance.status = status;
    attendance.updatedAt = Date.now();
    await attendance.save();

    await updateStudentAttendanceStats(attendance.studentId, attendance.subjectId, tenantId);

    // Invalidate risk cache
    try {
      const cache = require("../middleware/cache");
      cache.delPattern(`risk:${tenantId}:*`);
      cache.delPattern(`risk:batch:${tenantId}:*`);
    } catch (e) {}

    // Sync User model
    try {
      const student = await User.findById(attendance.studentId);
      if (student && typeof student.updateAttendanceSummary === 'function') {
        await student.updateAttendanceSummary();
      }
    } catch (e) {
      logger.error("Failed to sync User.attendance after update", { error: e.message });
    }

    // Publish real-time correction event (fire-and-forget)
    publishAttendanceCorrected(tenantId, {
      attendanceId: attendance._id,
      studentId: attendance.studentId,
      subjectId: attendance.subjectId,
      status: attendance.status,
      date: attendance.date,
      updatedBy: req.user._id,
    });

    return res.status(200).json({
      success: true,
      message: "Attendance record updated successfully",
      record: attendance,
    });
  } catch (error) {
    logger.error("Error updating attendance record", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Error updating attendance",
      error: error.message,
    });
  }
};

/**
 * DELETE ATTENDANCE RECORD
 */
const deleteAttendanceRecord = async (req, res) => {
  const { attendanceId } = req.params;
  const teacherId = req.user._id;
  const tenantId = req.user.tenantId;

  try {
    if (req.user.role !== "teacher") {
      return res.status(403).json({
        success: false,
        message: "Only teachers can delete attendance records",
      });
    }

    const attendance = await Attendance.findOne({
      _id: attendanceId,
      tenantId: tenantId
    });
    
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    if (attendance.teacherId.toString() !== teacherId) {
      return res.status(403).json({
        success: false,
        message: "You can only delete attendance you marked",
      });
    }

    const { studentId, subjectId } = attendance;
    await Attendance.deleteOne({ _id: attendanceId, tenantId: tenantId });

    // Update statistics after deletion
    await updateStudentAttendanceStats(studentId, subjectId, tenantId);

    // Invalidate risk cache
    try {
      const cache = require("../middleware/cache");
      cache.delPattern(`risk:${tenantId}:*`);
      cache.delPattern(`risk:batch:${tenantId}:*`);
    } catch (e) {}

    // Sync User model
    try {
      const student = await User.findById(studentId);
      if (student && typeof student.updateAttendanceSummary === 'function') {
        await student.updateAttendanceSummary();
      }
    } catch (e) {
      logger.error("Failed to sync User.attendance after delete", { error: e.message });
    }

    return res.status(200).json({
      success: true,
      message: "Attendance record deleted successfully",
    });
  } catch (error) {
    logger.error("Error deleting attendance record", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Error deleting attendance",
      error: error.message,
    });
  }
};

const getAttendanceHistory = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const role = req.user.role;
    const {
      studentId,
      subjectId,
      section,
      fromDate,
      toDate,
      status,
      page = 1,
      limit = 50,
    } = req.query;

    let query = { tenantId };

    // Role-based filtering
    if (role === "student" || role === "parent" || req.user.accessMode === "parent") {
      const studentIds = await getStudentIdList(req.user, tenantId);
      query.studentId = { $in: studentIds };
    } else if (role === "teacher") {
      const assignedSections = [
        ...new Set(
          (req.user.assignedSubjects || []).map((a) => a.section).filter(Boolean)
        ),
      ];
      if (assignedSections.length === 0) {
        return res.status(200).json({
          success: true,
          data: [],
          stats: { totalClasses: 0, presentCount: 0, absentCount: 0, leaveCount: 0, percentage: 0 },
          pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
        });
      }
      query.section = { $in: assignedSections };
      if (section && assignedSections.includes(section.toUpperCase())) {
        query.section = section.toUpperCase();
      }
    }

    if (studentId && ["admin", "super_admin"].includes(role)) {
      query.studentId = studentId;
    }
    if (subjectId) query.subjectId = subjectId;
    if (req.query.timetableId) query.timetableId = req.query.timetableId;
    if (section && role === "admin") query.section = section.toUpperCase();
    if (status && ["present", "absent", "leave"].includes(status)) {
      query.status = status;
    }
    const singleDate = req.query.date;
    if (singleDate && !fromDate && !toDate) {
      const dStart = new Date(singleDate);
      dStart.setHours(0, 0, 0, 0);
      const dEnd = new Date(singleDate);
      dEnd.setHours(23, 59, 59, 999);
      query.date = { $gte: dStart, $lte: dEnd };
    } else if (fromDate || toDate) {
      query.date = {};
      if (fromDate) query.date.$gte = new Date(fromDate);
      if (toDate) query.date.$lte = new Date(toDate);
    }

    const { page: p, limit: l, skip } = getPagination(req, 50, 200);

    const [records, total] = await Promise.all([
      Attendance.find(query)
        .populate("subjectId", "subjectCode subjectName")
        .populate("teacherId", "name")
        .sort({ date: -1 })
        .skip(skip)
        .limit(l)
        .lean(),
      Attendance.countDocuments(query),
    ]);

    // Batch resolve all student details in one single roundtrip
    const uniqueStudentIds = [...new Set(records.map((r) => r.studentId).filter(Boolean))];
    const studentMap = await batchResolveStudents(uniqueStudentIds, tenantId);

    const formattedRecords = records.map((r) => {
      const rawStudentId = r.studentId ? String(r.studentId) : null;
      const studentObj = rawStudentId ? studentMap.get(rawStudentId) : null;

      return {
        id: r._id,
        date: r.date,
        day: r.day || "Monday",
        startTime: r.startTime || "09:00 AM",
        endTime: r.endTime || "10:00 AM",
        room: r.room || "LH-101",
        student: studentObj || {
          id: rawStudentId || null,
          name: "Student",
          rollNo: "N/A",
          email: "",
          section: r.section || "",
        },
        subject: {
          id: r.subjectId?._id,
          code: r.subjectId?.subjectCode || r.subject?.subjectCode,
          name: r.subjectId?.subjectName || r.subject?.subjectName,
        },
        teacher: {
          id: r.teacherId?._id,
          name: r.teacherId?.name,
        },
        status: r.status,
        remarks: r.remarks,
        section: r.section,
        semester: r.semester,
        classSessionId: r.classSessionId,
      };
    });

    const matchQuery = { ...query };
    if (matchQuery.tenantId && mongoose.Types.ObjectId.isValid(matchQuery.tenantId)) {
      matchQuery.tenantId = new mongoose.Types.ObjectId(matchQuery.tenantId);
    }
    if (matchQuery.studentId) {
      if (typeof matchQuery.studentId === "object" && matchQuery.studentId.$in) {
        matchQuery.studentId = {
          $in: matchQuery.studentId.$in.map((id) => new mongoose.Types.ObjectId(id)),
        };
      } else if (mongoose.Types.ObjectId.isValid(matchQuery.studentId)) {
        matchQuery.studentId = new mongoose.Types.ObjectId(matchQuery.studentId);
      }
    }
    if (matchQuery.subjectId && mongoose.Types.ObjectId.isValid(matchQuery.subjectId)) {
      matchQuery.subjectId = new mongoose.Types.ObjectId(matchQuery.subjectId);
    }

    const aggResults = await Attendance.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalClasses: { $sum: 1 },
          presentCount: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
          absentCount: { $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] } },
          leaveCount: { $sum: { $cond: [{ $eq: ["$status", "leave"] }, 1, 0] } },
        },
      },
    ]);

    const stats = aggResults[0] || { totalClasses: 0, presentCount: 0, absentCount: 0, leaveCount: 0 };
    stats.percentage = stats.totalClasses > 0
      ? Number(((stats.presentCount / stats.totalClasses) * 100).toFixed(2))
      : 0;

    return res.status(200).json({
      success: true,
      data: formattedRecords,
      stats,
      pagination: {
        page: p,
        limit: l,
        total,
        totalPages: Math.ceil(total / l),
        hasNextPage: p * l < total,
        hasPrevPage: p > 1,
      },
    });
  } catch (error) {
    logger.error("Error fetching attendance history", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Error fetching attendance history",
      error: error.message,
    });
  }
};

/**
 * Phase 9: 75% Attendance Deficit Trajectory Engine
 * Computes projected semester trajectory, classes required to reach 75%,
 * impossibility detection, and standardized alert messages.
 */
async function computeDeficitTrajectory(studentId, tenantId, subjectId = null) {
  const match = {
    tenantId: new mongoose.Types.ObjectId(tenantId),
    studentId: new mongoose.Types.ObjectId(studentId),
  };
  if (subjectId && mongoose.Types.ObjectId.isValid(subjectId)) {
    match.subjectId = new mongoose.Types.ObjectId(subjectId);
  }

  const agg = await Attendance.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalClasses: { $sum: 1 },
        presentCount: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
        absentCount: { $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] } },
        leaveCount: { $sum: { $cond: [{ $eq: ["$status", "leave"] }, 1, 0] } },
      },
    },
  ]);

  const stats = agg[0] || { totalClasses: 0, presentCount: 0, absentCount: 0, leaveCount: 0 };
  const totalClasses = stats.totalClasses;
  const presentCount = stats.presentCount;
  const absentCount = stats.absentCount;
  const leaveCount = stats.leaveCount;

  const attendancePercentage = totalClasses > 0
    ? Number(((presentCount / totalClasses) * 100).toFixed(2))
    : 0;

  // Resolve projected classes based on timetable frequency
  let projectedClasses = 60; // Standard baseline
  try {
    let section = null;
    const student = await User.findById(studentId).select("section").lean();
    section = student?.section;

    if (section) {
      const ttQuery = {
        tenantId: new mongoose.Types.ObjectId(tenantId),
        section: section.toUpperCase(),
        isNoClass: { $ne: true },
      };
      if (subjectId && mongoose.Types.ObjectId.isValid(subjectId)) {
        ttQuery.subjectId = new mongoose.Types.ObjectId(subjectId);
      }
      const weeklySlots = await Timetable.countDocuments(ttQuery);
      if (weeklySlots > 0) {
        // Standard semester = ~15 active teaching weeks
        projectedClasses = Math.max(totalClasses, weeklySlots * 15);
      } else {
        projectedClasses = Math.max(totalClasses, 60);
      }
    } else {
      projectedClasses = Math.max(totalClasses, 60);
    }
  } catch (e) {
    projectedClasses = Math.max(totalClasses, 60);
  }

  const remainingClasses = Math.max(0, projectedClasses - totalClasses);

  let classesRequired = 0;
  let isMathematicallyImpossible = false;

  if (totalClasses === 0) {
    classesRequired = 0;
    isMathematicallyImpossible = false;
  } else if (attendancePercentage >= 75) {
    classesRequired = 0;
    isMathematicallyImpossible = false;
  } else {
    // Consecutive classes needed to reach >= 75% attendance:
    // (presentCount + c) / (totalClasses + c) >= 0.75 => 0.25 * c >= 0.75 * totalClasses - presentCount
    const rawRequired = Math.ceil((0.75 * totalClasses - presentCount) / 0.25);
    classesRequired = Math.max(0, rawRequired);

    // Minimum classes to achieve 75% by semester end:
    const minClassesToPassSemester = Math.ceil(0.75 * projectedClasses - presentCount);

    // Impossible if needed exceeds remaining classes or even 100% on remaining cannot reach 75%
    if (minClassesToPassSemester > remainingClasses || (presentCount + remainingClasses) < (0.75 * projectedClasses)) {
      isMathematicallyImpossible = true;
    }
  }

  let riskLevel = "good";
  if (totalClasses === 0) {
    riskLevel = "good";
  } else if (isMathematicallyImpossible) {
    riskLevel = "critical";
  } else if (attendancePercentage >= 75) {
    riskLevel = "good";
  } else if (attendancePercentage >= 65) {
    riskLevel = "warning";
  } else {
    riskLevel = "critical";
  }

  let alertMessage = "";
  if (riskLevel === "good") {
    alertMessage = "✅ GOOD: Attendance is excellent. Keep it up!";
  } else if (riskLevel === "warning") {
    alertMessage = `⚠️ WARNING: Needs ${classesRequired} consecutive classes to reach 75%`;
  } else if (isMathematicallyImpossible) {
    alertMessage = "🔴 CRITICAL: Mathematically impossible to reach 75% before semester end without medical condonation waiver";
  } else {
    alertMessage = "🔴 CRITICAL: Attendance is severely low. Immediate intervention required.";
  }

  return {
    studentId,
    tenantId,
    subjectId: subjectId || null,
    totalClasses,
    presentCount,
    absentCount,
    leaveCount,
    attendancePercentage,
    projectedClasses,
    remainingClasses,
    classesRequired,
    isMathematicallyImpossible,
    riskLevel,
    alertMessage,
  };
}

/**
 * Phase 9: Consecutive Absence Multi-Tier Escalation Detector
 * Checks sorted attendance records for 3 consecutive absences on scheduled class days.
 */
async function detectConsecutiveAbsence(studentId, tenantId, options = {}) {
  const query = {
    tenantId: new mongoose.Types.ObjectId(tenantId),
    studentId: new mongoose.Types.ObjectId(studentId),
  };
  if (options.subjectId && mongoose.Types.ObjectId.isValid(options.subjectId)) {
    query.subjectId = new mongoose.Types.ObjectId(options.subjectId);
  }

  const records = await Attendance.find(query)
    .sort({ date: -1 })
    .select("date status section subjectId")
    .limit(30)
    .lean();

  let streakLength = 0;
  let lastAbsenceDate = null;

  for (const r of records) {
    if (r.status === "absent") {
      streakLength += 1;
      if (!lastAbsenceDate) {
        lastAbsenceDate = r.date;
      }
    } else if (r.status === "present" || r.status === "leave") {
      break;
    }
  }

  if (streakLength >= 3) {
    const Alert = require("../models/Alert");
    // Check if already triggered for this exact lastAbsenceDate
    const existing = await Alert.findOne({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      type: "absence_escalation",
      "metadata.studentId": new mongoose.Types.ObjectId(studentId),
      "metadata.lastAbsenceDate": lastAbsenceDate,
    });

    if (existing) {
      return {
        triggered: false,
        alreadyEscalated: true,
        streakLength,
        lastAbsenceDate,
        studentId,
      };
    }

    // Trigger escalation via queue or non-blocking async
    const { addAbsenceEscalationJob } = require("../queues/attendanceQueue");
    await addAbsenceEscalationJob({
      studentId,
      tenantId,
      streakLength,
      lastAbsenceDate,
      subjectId: options.subjectId,
      section: options.section || records[0]?.section,
    });

    publishAtRiskAlert(tenantId, {
      studentId,
      streakLength,
      lastAbsenceDate,
      subjectId: options.subjectId,
      section: options.section || records[0]?.section,
    });

    return {
      triggered: true,
      streakLength,
      lastAbsenceDate,
      studentId,
    };
  }

  return {
    triggered: false,
    streakLength,
    lastAbsenceDate: null,
    studentId,
  };
}

/**
 * GET /api/attendance/analytics/deficit
 * Returns deficit trajectory for a student
 */
const getDeficitTrajectory = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    let targetStudentId = req.query.studentId;

    if (req.user.role === "student") {
      targetStudentId = req.user._id.toString();
    } else if (!targetStudentId) {
      return res.status(400).json({ success: false, message: "studentId query parameter is required" });
    }

    const { subjectId } = req.query;
    const cache = require("../middleware/cache");
    const cacheKey = `risk:${tenantId}:${targetStudentId}${subjectId ? `:${subjectId}` : ""}`;

    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.status(200).json({ success: true, data: cached, cached: true });
    }

    const trajectory = await computeDeficitTrajectory(targetStudentId, tenantId, subjectId);
    await cache.set(cacheKey, trajectory, 120);

    return res.status(200).json({ success: true, data: trajectory });
  } catch (error) {
    logger.error("Error computing deficit trajectory", { error: error.message });
    return res.status(500).json({ success: false, message: "Error computing deficit trajectory", error: error.message });
  }
};

/**
 * GET /api/attendance/analytics/risk
 * Batch endpoint: returns risk analysis for all students in a section/subject
 */
const getBatchRiskAnalytics = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { section, subjectId, courseId } = req.query;

    const cache = require("../middleware/cache");
    const cacheKey = `risk:batch:${tenantId}:${section || "all"}:${subjectId || "all"}`;

    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.status(200).json({ success: true, data: cached.students, summary: cached.summary, cached: true });
    }

    const studentQuery = { tenantId, role: "student", isActive: true };
    if (section) studentQuery.section = section.trim().toUpperCase();
    if (courseId && mongoose.Types.ObjectId.isValid(courseId)) {
      studentQuery.courseId = new mongoose.Types.ObjectId(courseId);
    }

    const students = await User.find(studentQuery).select("name email section rollNo").lean();

    const attendanceMatch = { tenantId: new mongoose.Types.ObjectId(tenantId) };
    if (subjectId && mongoose.Types.ObjectId.isValid(subjectId)) {
      attendanceMatch.subjectId = new mongoose.Types.ObjectId(subjectId);
    }
    if (section) {
      attendanceMatch.section = section.trim().toUpperCase();
    }

    const records = await Attendance.aggregate([
      { $match: attendanceMatch },
      {
        $group: {
          _id: "$studentId",
          totalClasses: { $sum: 1 },
          presentCount: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
          absentCount: { $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] } },
          leaveCount: { $sum: { $cond: [{ $eq: ["$status", "leave"] }, 1, 0] } },
        },
      },
    ]);

    const recordMap = new Map(records.map((r) => [String(r._id), r]));

    // Check weekly timetable frequency for projected classes
    let weeklySlots = 0;
    if (section) {
      const ttQuery = {
        tenantId: new mongoose.Types.ObjectId(tenantId),
        section: section.trim().toUpperCase(),
        isNoClass: { $ne: true },
      };
      if (subjectId && mongoose.Types.ObjectId.isValid(subjectId)) {
        ttQuery.subjectId = new mongoose.Types.ObjectId(subjectId);
      }
      weeklySlots = await Timetable.countDocuments(ttQuery);
    }

    const studentResults = students.map((s) => {
      const r = recordMap.get(String(s._id)) || { totalClasses: 0, presentCount: 0, absentCount: 0, leaveCount: 0 };
      const totalClasses = r.totalClasses;
      const presentCount = r.presentCount;
      const absentCount = r.absentCount;
      const leaveCount = r.leaveCount;

      const attendancePercentage = totalClasses > 0
        ? Number(((presentCount / totalClasses) * 100).toFixed(2))
        : 0;

      const projectedClasses = weeklySlots > 0 ? Math.max(totalClasses, weeklySlots * 15) : Math.max(totalClasses, 60);
      const remainingClasses = Math.max(0, projectedClasses - totalClasses);

      let classesRequired = 0;
      let isMathematicallyImpossible = false;

      if (totalClasses > 0 && attendancePercentage < 75) {
        // Consecutive classes needed to reach >= 75% attendance:
        const rawRequired = Math.ceil((0.75 * totalClasses - presentCount) / 0.25);
        classesRequired = Math.max(0, rawRequired);

        // Minimum classes to achieve 75% by semester end:
        const minClassesToPassSemester = Math.ceil(0.75 * projectedClasses - presentCount);

        if (minClassesToPassSemester > remainingClasses || (presentCount + remainingClasses) < (0.75 * projectedClasses)) {
          isMathematicallyImpossible = true;
        }
      }

      let riskLevel = "good";
      if (totalClasses === 0) {
        riskLevel = "good";
      } else if (isMathematicallyImpossible) {
        riskLevel = "critical";
      } else if (attendancePercentage >= 75) {
        riskLevel = "good";
      } else if (attendancePercentage >= 65) {
        riskLevel = "warning";
      } else {
        riskLevel = "critical";
      }

      let alertMessage = "";
      if (riskLevel === "good") {
        alertMessage = "✅ GOOD: Attendance is excellent. Keep it up!";
      } else if (riskLevel === "warning") {
        alertMessage = `⚠️ WARNING: Needs ${classesRequired} consecutive classes to reach 75%`;
      } else if (isMathematicallyImpossible) {
        alertMessage = "🔴 CRITICAL: Mathematically impossible to reach 75% before semester end without medical condonation waiver";
      } else {
        alertMessage = "🔴 CRITICAL: Attendance is severely low. Immediate intervention required.";
      }

      return {
        id: s._id,
        name: s.name,
        email: s.email,
        rollNo: s.rollNo,
        section: s.section,
        totalClasses,
        presentCount,
        absentCount,
        leaveCount,
        attendancePercentage,
        projectedClasses,
        remainingClasses,
        classesRequired,
        isMathematicallyImpossible,
        riskLevel,
        alertMessage,
      };
    });

    const summary = studentResults.reduce(
      (acc, s) => {
        acc.totalStudents++;
        if (s.riskLevel === "good") acc.goodCount++;
        else if (s.riskLevel === "warning") acc.warningCount++;
        else if (s.riskLevel === "critical") acc.criticalCount++;
        if (s.isMathematicallyImpossible) acc.impossibleCount++;
        return acc;
      },
      { totalStudents: 0, goodCount: 0, warningCount: 0, criticalCount: 0, impossibleCount: 0 }
    );

    await cache.set(cacheKey, { students: studentResults, summary }, 120);

    return res.status(200).json({
      success: true,
      data: studentResults,
      summary,
    });
  } catch (error) {
    logger.error("Error computing batch risk analytics", { error: error.message });
    return res.status(500).json({ success: false, message: "Error computing batch risk analytics", error: error.message });
  }
};

module.exports = {
  markAttendance,
  getAttendanceRecords,
  getAttendanceSummary,
  getStudentAttendanceStats,
  getAttendanceByDate,
  updateAttendanceRecord,
  deleteAttendanceRecord,
  updateStudentAttendanceStats,
  getAttendanceHistory,
  computeDeficitTrajectory,
  detectConsecutiveAbsence,
  getDeficitTrajectory,
  getBatchRiskAnalytics,
};