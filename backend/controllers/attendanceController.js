const Attendance = require("../models/Attendance");
const Subject = require("../models/Subject");
const User = require("../models/User");
const Timetable = require("../models/Timetable");
const mongoose = require("mongoose");
const { paginate, paginatedResponse } = require("../middleware/paginate");
const logger = require("../utils/logger");
require("dotenv").config();

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const markAttendance = async (req, res) => {
  const { subjectId, section, date, attendanceData, timetableId } = req.body;
  const teacherId = req.user._id;
  const tenantId = req.user.tenantId;

  if (!subjectId || !section || !date || !attendanceData) {
    return res.status(400).json({
      success: false,
      message: "subjectId, section, date, and attendanceData are required",
    });
  }

  if (Object.keys(attendanceData).length === 0) {
    return res.status(400).json({
      success: false,
      message: "attendanceData cannot be empty",
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

    // Generate a unique session ID for this class
    const classSessionId = `${subjectId}_${section}_${attendanceDate.toISOString().split('T')[0]}`;

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
      classSessionId: classSessionId,
    }).session(session).lean();

    if (existingRecords.length > 0 && isOfflineSync) {
      const existingMap = new Map(existingRecords.map(r => [r.studentId.toString(), r]));
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

    for (const [studentId, status] of Object.entries(attendanceData)) {

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

    const total = await Attendance.countDocuments(query);
    const attendanceRecords = await Attendance.find(query)
      .populate("subjectId", "subjectCode subjectName semester")
      .populate("teacherId", "name email")
      .sort({ date: -1 })
      .lean()
      .skip((Math.max(1, parseInt(page, 10) || 1) - 1) * Math.min(100, Math.max(1, parseInt(limit, 10) || 50)))
      .limit(Math.min(100, Math.max(1, parseInt(limit, 10) || 50)));

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

    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

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

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;
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

    // Asynchronous resolution of student details (User & Enrollment)
    const Enrollment = require("../models/Enrollment");
    const studentSummary = await Promise.all(
      studentAggStats.map(async (stat) => {
        const rawId = stat._id;
        let name = "Student";
        let rollNo = "";

        if (rawId) {
          const u = await User.findById(rawId).select("name rollNo email").lean();
          if (u) {
            name = u.name;
            rollNo = u.rollNo || "";
          } else {
            const enr = await Enrollment.findById(rawId).lean();
            if (enr) {
              name = `${enr.firstName || ''} ${enr.lastName || ''}`.trim() || enr.email;
              rollNo = enr.enrollmentNumber || "";
            } else {
              const enrByUserId = await Enrollment.findOne({ userId: rawId, tenantId }).lean();
              if (enrByUserId) {
                name = `${enrByUserId.firstName || ''} ${enrByUserId.lastName || ''}`.trim() || enrByUserId.email;
                rollNo = enrByUserId.enrollmentNumber || "";
              }
            }
          }
        }

        const percentage = stat.totalClasses > 0 ? Number(((stat.presentCount / stat.totalClasses) * 100).toFixed(2)) : 0;

        return {
          studentId: rawId,
          name,
          rollNo,
          totalClasses: stat.totalClasses,
          presentCount: stat.presentCount,
          absentCount: stat.absentCount,
          leaveCount: stat.leaveCount,
          percentage,
        };
      })
    );

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
    const dateStr = attendanceDate.toISOString().split("T")[0];
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

    attendance.status = status;
    if (remarks) {
      attendance.remarks = remarks;
    }
    attendance.updatedAt = Date.now();
    await attendance.save();

    await updateStudentAttendanceStats(attendance.studentId, attendance.subjectId, tenantId);

    // Sync User model
    try {
      const student = await User.findById(attendance.studentId);
      if (student && typeof student.updateAttendanceSummary === 'function') {
        await student.updateAttendanceSummary();
      }
    } catch (e) {
      logger.error("Failed to sync User.attendance after update", { error: e.message });
    }

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
    if (section && role === "admin") query.section = section.toUpperCase();
    if (status && ["present", "absent", "leave"].includes(status)) {
      query.status = status;
    }
    if (fromDate || toDate) {
      query.date = {};
      if (fromDate) query.date.$gte = new Date(fromDate);
      if (toDate) query.date.$lte = new Date(toDate);
    }

    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (p - 1) * l;

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

    const Enrollment = require("../models/Enrollment");
    const formattedRecords = await Promise.all(
      records.map(async (r) => {
        let studentObj = null;
        const rawStudentId = r.studentId;

        if (rawStudentId) {
          const u = await User.findById(rawStudentId).select("name rollNo section email").lean();
          if (u) {
            studentObj = {
              id: u._id,
              name: u.name,
              rollNo: u.rollNo || "N/A",
              email: u.email || "",
              section: u.section || r.section,
            };
          } else {
            const enr = await Enrollment.findById(rawStudentId).lean();
            if (enr) {
              studentObj = {
                id: enr._id,
                name: `${enr.firstName || ''} ${enr.lastName || ''}`.trim() || enr.email,
                rollNo: enr.enrollmentNumber || "N/A",
                email: enr.email || "",
                section: enr.section || r.section,
              };
            } else {
              const enrByUserId = await Enrollment.findOne({ userId: rawStudentId, tenantId }).lean();
              if (enrByUserId) {
                studentObj = {
                  id: rawStudentId,
                  name: `${enrByUserId.firstName || ''} ${enrByUserId.lastName || ''}`.trim() || enrByUserId.email,
                  rollNo: enrByUserId.enrollmentNumber || "N/A",
                  email: enrByUserId.email || "",
                  section: enrByUserId.section || r.section,
                };
              }
            }
          }
        }

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
      })
    );

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
};