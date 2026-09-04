const User = require("../models/User");
const Enrollment = require("../models/Enrollment");
const Timetable = require("../models/Timetable");
const Subject = require("../models/Subject");
const Attendance = require("../models/Attendance");
const mongoose = require("mongoose");
const logger = require("../utils/logger");
const { logActivity } = require("../utils/activityLogger");
const { toObjectId, escapeRegExp } = require("../utils/sanitize");
const path = require("path");
const fs = require("fs");

const FACE_UPLOADS_DIR = path.join(__dirname, "../uploads/face-attendance");

// Ensure the face-attendance uploads directory exists
try {
  fs.mkdirSync(FACE_UPLOADS_DIR, { recursive: true });
} catch (e) {
  // Warn only — the directory may already exist.
  logger.debug("face-attendance uploads dir check", { err: e?.message });
}

// ============================================================
// POST /api/faces/register — register a student's face descriptor
// ============================================================
const registerFace = async (req, res) => {
  let { studentId, faceDescriptor } = req.body;
  const tenantId = req.user.tenantId;
  const requesterId = req.user._id;
  const requesterRole = req.user.role;

  // --- Input validation ---
  if (!studentId) {
    return res.status(400).json({
      success: false,
      message: "studentId is required",
    });
  }

  // If sent via multipart/form-data, faceDescriptor is received as a string
  if (typeof faceDescriptor === "string") {
    try {
      faceDescriptor = JSON.parse(faceDescriptor);
    } catch (e) {
      if (faceDescriptor.includes(",")) {
        faceDescriptor = faceDescriptor
          .split(",")
          .map((n) => parseFloat(n.trim()))
          .filter((n) => !isNaN(n));
      }
    }
  }

  if (!faceDescriptor || !Array.isArray(faceDescriptor) || faceDescriptor.length === 0) {
    return res.status(400).json({
      success: false,
      message: "faceDescriptor is required and must be a non-empty array of numbers",
    });
  }

  // Validate and cast every element to a finite number
  for (let i = 0; i < faceDescriptor.length; i++) {
    const num = typeof faceDescriptor[i] === "number" ? faceDescriptor[i] : Number(faceDescriptor[i]);
    if (!isFinite(num)) {
      return res.status(400).json({
        success: false,
        message: `faceDescriptor[${i}] is not a valid number`,
      });
    }
    faceDescriptor[i] = num;
  }


  // --- Role + tenant check ---
  if (requesterRole !== "teacher" && requesterRole !== "admin" && requesterRole !== "super_admin") {
    return res.status(403).json({
      success: false,
      message: "Only teachers and admins can register face descriptors",
      userRole: requesterRole,
    });
  }

  // --- Find the target student (tenant-scoped) ---
  let student;
  try {
    student = await User.findOne({
      _id: studentId,
      tenantId: tenantId,
      role: "student",
      isActive: true,
      isDeleted: false,
    }).select("name rollNo section tenantId faceDescriptor");
  } catch (err) {
    logger.error("registerFace: error fetching student", { studentId, err: err?.message });
    return res.status(500).json({
      success: false,
      message: "Server error while looking up student",
    });
  }

  if (!student) {
    return res.status(404).json({
      success: false,
      message: "Student not found in this institution",
    });
  }

  // --- Cross-tenant guard (super_admin can act across tenants, others cannot) ---
  if (requesterRole !== "super_admin" && student.tenantId.toString() !== tenantId.toString()) {
    return res.status(403).json({
      success: false,
      message: "Cross-tenant access denied",
    });
  }

  // --- Duplicate Face Biometric Collision Check ---
  // Ensure this face is not already enrolled for another student in the same institution
  try {
    const existingEnrolledStudents = await User.find({
      tenantId: tenantId,
      role: "student",
      isActive: true,
      isDeleted: false,
      _id: { $ne: student._id },
      faceDescriptor: { $exists: true, $ne: null, $not: { $size: 0 } },
    }).select("name rollNo section courseName branch faceDescriptor").lean();

    const COLLISION_THRESHOLD = 0.48; // Euclidean distance threshold for matching identity
    let duplicateMatch = null;
    let minDistance = Infinity;

    for (const other of existingEnrolledStudents) {
      if (Array.isArray(other.faceDescriptor) && other.faceDescriptor.length === faceDescriptor.length) {
        let sum = 0;
        for (let i = 0; i < faceDescriptor.length; i++) {
          const diff = faceDescriptor[i] - other.faceDescriptor[i];
          sum += diff * diff;
        }
        const dist = Math.sqrt(sum);
        if (dist < COLLISION_THRESHOLD && dist < minDistance) {
          minDistance = dist;
          duplicateMatch = other;
        }
      }
    }

    if (duplicateMatch) {
      logger.warn("Face registration collision detected: Face already registered for another student", {
        targetStudentId: student._id,
        targetRollNo: student.rollNo,
        targetName: student.name,
        matchedStudentId: duplicateMatch._id,
        matchedRollNo: duplicateMatch.rollNo,
        matchedName: duplicateMatch.name,
        distance: minDistance,
        tenantId,
      });

      return res.status(409).json({
        success: false,
        message: `Face biometrics collision: This face is already enrolled for student "${duplicateMatch.name}" (Roll No: ${duplicateMatch.rollNo || "N/A"}, Sec: ${duplicateMatch.section || "N/A"}). The same face cannot be registered for multiple students.`,
        duplicateStudent: {
          id: duplicateMatch._id,
          name: duplicateMatch.name,
          rollNo: duplicateMatch.rollNo,
          section: duplicateMatch.section,
          courseName: duplicateMatch.courseName,
          branch: duplicateMatch.branch,
        },
        distance: Math.round(minDistance * 1000) / 1000,
      });
    }
  } catch (collisionErr) {
    logger.error("registerFace: error checking duplicate face collision", { err: collisionErr?.message });
  }

  // --- 100% Vector-Only Privacy Preservation ---
  // We NEVER store raw facial photos during enrollment or attendance.
  // Only the mathematical 128-dimensional numerical descriptor is retained.
  const faceImageUrl = null;
  const now = new Date();

  // --- Upsert the face descriptor onto the User ---
  try {
    const updated = await User.findByIdAndUpdate(
      studentId,
      {
        faceDescriptor: faceDescriptor,
        faceRegistered: true,
        isFaceRegistered: true,
        faceImageUrl: null, // Zero photo storage guarantee
        faceUpdatedAt: now,
      },
      { new: true, runValidators: true }
    ).select("name rollNo section faceDescriptor faceImageUrl faceUpdatedAt faceRegistered isFaceRegistered");

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Student not found (concurrent deletion?)",
      });
    }

    // Sync face registration status to Enrollment record if one exists
    try {
      await Enrollment.updateMany(
        {
          tenantId: tenantId,
          $or: [
            { userId: student._id },
            { email: student.email },
            { rollNo: student.rollNo },
            { enrollmentNumber: student.rollNo },
          ],
        },
        { $set: { isRegistered: true } }
      );
    } catch (enrErr) {
      logger.debug("Non-fatal enrollment face sync", { err: enrErr?.message });
    }

    logActivity({
      tenantId: tenantId,
      userId: requesterId,
      description: `Face vector descriptor registered (vector-only privacy) for ${student.name} (${student.rollNo})`,
      endpoint: "/api/faces/register",
      statusCode: 200,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    logger.info("Privacy-preserving face descriptor registered", {
      studentId: student._id,
      rollNo: student.rollNo,
      descriptorLength: faceDescriptor.length,
      zeroPhotoStorage: true,
      faceUpdatedAt: now,
      registeredBy: requesterId,
      tenantId: tenantId,
    });

    return res.status(200).json({
      success: true,
      message: "Face descriptor registered",
      faceImageUrl: null,
      faceUpdatedAt: now.toISOString(),
      registeredAt: now.toISOString(),
    });
  } catch (err) {
    logger.error("registerFace: error saving descriptor", { studentId, err: err?.message });
    return res.status(500).json({
      success: false,
      message: "Server error while saving face descriptor",
    });
  }
};

// ============================================================
// GET /api/faces/:studentId — retrieve a student's face descriptor
// ============================================================
const getFaceDescriptor = async (req, res) => {
  const { studentId } = req.params;
  const tenantId = req.user.tenantId;
  const requesterRole = req.user.role;

  if (!studentId) {
    return res.status(400).json({
      success: false,
      message: "studentId is required (path parameter)",
    });
  }

  if (requesterRole !== "teacher" && requesterRole !== "admin" && requesterRole !== "super_admin") {
    return res.status(403).json({
      success: false,
      message: "Only teachers and admins can retrieve face descriptors",
      userRole: requesterRole,
    });
  }

  let student;
  try {
    student = await User.findOne({
      _id: studentId,
      tenantId: tenantId,
      role: "student",
      isActive: true,
      isDeleted: false,
    }).select("name rollNo section tenantId faceDescriptor faceImageUrl createdAt");
  } catch (err) {
    logger.error("getFaceDescriptor: error fetching student", { studentId, err: err?.message });
    return res.status(500).json({
      success: false,
      message: "Server error while looking up student",
    });
  }

  if (!student) {
    return res.status(404).json({
      success: false,
      message: "Student not found in this institution",
    });
  }

  if (requesterRole !== "super_admin" && student.tenantId && student.tenantId.toString() !== tenantId.toString()) {
    return res.status(403).json({
      success: false,
      message: "Cross-tenant access denied",
    });
  }

  if (!student.faceDescriptor) {
    return res.status(404).json({
      success: false,
      message: "No face descriptor registered for this student",
    });
  }

  return res.status(200).json({
    success: true,
    studentId: student._id,
    name: student.name,
    rollNo: student.rollNo,
    section: student.section,
    faceDescriptor: student.faceDescriptor,
    faceImageUrl: student.faceImageUrl || null,
    registeredAt: student.createdAt?.toISOString() || null,
  });
};

// ============================================================
// POST /api/attendance/mark-face-detection — mark attendance from
// a batch of face-verified student IDs, using an existing
// timetable slot. Reuses the trusted attendance-marking path.
// ============================================================
const markFaceDetection = async (req, res) => {
  const {
    timetableId,
    subjectId,
    verifiedStudents,
    timestamp,
    remarks,
  } = req.body;

  const teacherId = req.user._id;
  const tenantId = req.user.tenantId;
  const requesterRole = req.user.role;

  // --- Input validation ---
  if (!timetableId) {
    return res.status(400).json({
      success: false,
      message: "timetableId is required",
    });
  }

  if (!subjectId) {
    return res.status(400).json({
      success: false,
      message: "subjectId is required",
    });
  }

  if (!verifiedStudents || !Array.isArray(verifiedStudents) || verifiedStudents.length === 0) {
    return res.status(400).json({
      success: false,
      message: "verifiedStudents must be a non-empty array",
    });
  }

  // Validate each entry in verifiedStudents
  for (let i = 0; i < verifiedStudents.length; i++) {
    const entry = verifiedStudents[i];
    if (!entry || !entry.studentId) {
      return res.status(400).json({
        success: false,
        message: `verifiedStudents[${i}] missing studentId`,
      });
    }
    if (entry.confidence !== undefined && (typeof entry.confidence !== "number" || entry.confidence < 0 || entry.confidence > 1)) {
      return res.status(400).json({
        success: false,
        message: `verifiedStudents[${i}] confidence must be a number between 0 and 1`,
      });
    }
  }

  // --- Role check ---
  if (requesterRole !== "teacher" && requesterRole !== "admin" && requesterRole !== "super_admin") {
    return res.status(403).json({
      success: false,
      message: "Only teachers and admins can mark face-detected attendance",
      userRole: requesterRole,
    });
  }

  const attendanceDate = timestamp ? new Date(timestamp) : new Date();
  if (isNaN(attendanceDate.getTime())) {
    return res.status(400).json({
      success: false,
      message: "Invalid timestamp format",
    });
  }

  // --- Resolve the subject (tenant-scoped) ---
  let subject;
  try {
    subject = await Subject.findOne({
      _id: subjectId,
      tenantId: tenantId,
      isActive: true,
    }).lean();
  } catch (err) {
    logger.error("markFaceDetection: error fetching subject", { subjectId, err: err?.message });
    return res.status(500).json({
      success: false,
      message: "Server error while looking up subject",
    });
  }

  if (!subject) {
    return res.status(404).json({
      success: false,
      message: "Subject not found in this institution",
    });
  }

  // --- Resolve the timetable slot ---
  let timetableSlot = null;
  try {
    timetableSlot = await Timetable.findOne({
      _id: timetableId,
      tenantId: tenantId,
      isActive: true,
      isNoClass: { $ne: true },
    }).lean();
  } catch (err) {
    logger.error("markFaceDetection: error fetching timetable", { timetableId, err: err?.message });
    return res.status(500).json({
      success: false,
      message: "Server error while looking up timetable",
    });
  }

  if (!timetableSlot) {
    return res.status(404).json({
      success: false,
      message: "Timetable slot not found or not active",
    });
  }

  // --- Teacher assignment check (Admins and Super Admins manage whole tenant org) ---
  if (requesterRole === "teacher") {
    const isAssignedToSubject = req.user.assignedSubjects?.some(
      (a) => a.subjectId?.toString() === subjectId
    );
    const isSlotTeacher = timetableSlot.teacherId && timetableSlot.teacherId.toString() === teacherId.toString();

    if (!isAssignedToSubject && !isSlotTeacher) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to teach this subject or timetable slot",
      });
    }
  }

  // Verify the timetable's subject matches the requested subjectId (if the
  // timetable has a subjectId field — some slots may be generic).
  if (timetableSlot.subjectId && timetableSlot.subjectId.toString() !== subjectId) {
    return res.status(400).json({
      success: false,
      message: "Timetable slot subject does not match the requested subjectId",
    });
  }

  // Live Day Gate: Attendance can ONLY be marked for the current day's scheduled session
  const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const currentDay = WEEKDAYS[new Date().getDay()];

  if (timetableSlot.day && timetableSlot.day.trim().toLowerCase() !== currentDay.toLowerCase()) {
    return res.status(400).json({
      success: false,
      message: `Cannot mark attendance for a ${timetableSlot.day} session today (${currentDay}). Live face attendance is restricted to today's scheduled classes only.`,
      scheduledDay: timetableSlot.day,
      currentDay: currentDay,
    });
  }

  // Derive section from the timetable (fall back to what the timetable says).
  const section = timetableSlot.section;

  // --- Build the classSessionId ---
  const day = currentDay;
  const dateStr = attendanceDate.toISOString().split("T")[0];
  const classSessionId = `${subjectId}_${section}_${dateStr}_${timetableId}`;

  // --- Pre-fetch existing records for this specific timetable slot session (duplicate detection) ---
  let existingRecords = [];
  try {
    existingRecords = await Attendance.find({
      tenantId: tenantId,
      timetableId: timetableId,
      date: {
        $gte: new Date(`${dateStr}T00:00:00.000Z`),
        $lte: new Date(`${dateStr}T23:59:59.999Z`),
      },
    }).select("studentId status").lean();
  } catch (err) {
    logger.error("markFaceDetection: error fetching existing attendance", {
      classSessionId,
      timetableId,
      err: err?.message,
    });
    return res.status(500).json({
      success: false,
      message: "Server error while checking existing attendance",
    });
  }

  const existingMap = new Map(existingRecords.map((r) => [r.studentId.toString(), r]));

  // --- Validate students in batch ---
  const validStudentIds = new Set();
  const studentsInSection = await User.find({
    role: "student",
    section: new RegExp(`^${section.trim()}$`, "i"),
    tenantId: tenantId,
    isActive: true,
    isDeleted: false,
  }).select("_id").lean();

  studentsInSection.forEach((s) => validStudentIds.add(s._id.toString()));

  // Also include students from enrollments in this section (in case some
  // students are referenced via enrollment.userId).
  try {
    const enrollmentsInSection = await Enrollment.find({
      section: new RegExp(`^${section.trim()}$`, "i"),
      tenantId: tenantId,
    }).select("_id userId").lean();

    enrollmentsInSection.forEach((e) => {
      validStudentIds.add(e._id.toString());
      if (e.userId) validStudentIds.add(e.userId.toString());
    });
  } catch (err) {
    logger.warn("markFaceDetection: error fetching enrollments", { section, err: err?.message });
    // Non-fatal — continue with student lookup only.
  }

  // --- Process each verified student ---
  const marked = [];
  const skipped = [];
  const errors = [];

  for (const entry of verifiedStudents) {
    const { studentId, confidence } = entry;

    // Validate student belongs to this section + tenant
    if (!validStudentIds.has(studentId)) {
      errors.push({
        studentId,
        reason: `Student not found in section ${section}`,
      });
      continue;
    }

    // Duplicate check — if already marked in this session, skip with a warning
    if (existingMap.has(studentId)) {
      skipped.push(studentId);
      logger.debug("markFaceDetection: student already marked in session", {
        studentId,
        classSessionId,
        existingStatus: existingMap.get(studentId).status,
      });
      continue;
    }

    // --- Create the attendance record ---
    try {
      await Attendance.create({
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
        status: "present",
        semester: subject.semester || "",
        createdBy: teacherId,
        classSessionId: classSessionId,
        timetableId: timetableSlot._id,
        day: timetableSlot.day || day,
        startTime: timetableSlot.startTime || "",
        endTime: timetableSlot.endTime || "",
        room: timetableSlot.room || "",
        ipAddress: req.ip,
        deviceFingerprint: req.headers["x-device-fingerprint"] || req.headers["user-agent"] || "",
        proxyFlagged: false,
        proxyReason: "",
        remarks: remarks || "Face attendance via mobile",
      });
      marked.push(studentId);
    } catch (err) {
      // Duplicate key error (unique index on tenantId+classSessionId+studentId)
      // can happen if two requests race — treat as skipped.
      if (err?.code === 11000 || err?.message?.includes("duplicate key")) {
        skipped.push(studentId);
        logger.debug("markFaceDetection: duplicate key race, skipping", { studentId, classSessionId });
      } else {
        errors.push({
          studentId,
          reason: err?.message || "Failed to create attendance record",
        });
        logger.error("markFaceDetection: error creating attendance", {
          studentId,
          classSessionId,
          err: err?.message,
        });
      }
    }
  }

  // --- Recalculate attendance summaries for affected students ---
  if (marked.length > 0) {
    try {
      for (const sId of marked) {
        // 1. Update running stats on Attendance records
        if (typeof Attendance.updateStudentTotals === "function") {
          await Attendance.updateStudentTotals(sId, subjectId, tenantId);
        }

        // 2. Update summary on Student User model
        const studentUser = await User.findOne({
          _id: sId,
          tenantId: tenantId,
          role: "student",
        });
        if (studentUser && typeof studentUser.updateAttendanceSummary === "function") {
          await studentUser.updateAttendanceSummary();
        }
      }

      logger.info("markFaceDetection: attendance summaries recalculated", {
        markedCount: marked.length,
        classSessionId,
        tenantId,
      });
    } catch (err) {
      // Non-fatal — attendance records are created; summary recalc failure
      // is a background concern. Log and continue.
      logger.error("markFaceDetection: error recalculating summaries", {
        markedCount: marked.length,
        classSessionId,
        err: err?.message,
      });
    }
  }

  // --- Log the activity ---
  logActivity({
    tenantId: tenantId,
    userId: teacherId,
    description: `Face attendance marked: ${marked.length} present, ${skipped.length} skipped, ${errors.length} errors`,
    endpoint: "/api/attendance/mark-face-detection",
    statusCode: 200,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  logger.info("markFaceDetection: batch completed", {
    markedCount: marked.length,
    skippedCount: skipped.length,
    errorCount: errors.length,
    classSessionId,
    subjectId,
    section,
    teacherId,
    tenantId,
  });

  // --- Build response ---
  const response = {
    success: true,
    message: `Attendance marked for ${marked.length} students`,
    marked: marked,
    skipped: skipped,
    errors: errors.length > 0 ? errors : undefined,
    classSessionId,
    date: attendanceDate.toISOString(),
  };

  const statusCode = errors.length > 0 ? 207 : 200; // 207 Multi-Status if partial errors
  return res.status(statusCode).json(response);
};

// ============================================================
// GET /api/faces/section/:section — retrieve face descriptors for
// all registered students in a section (fast batch sync)
// ============================================================
const getSectionFaceDescriptors = async (req, res) => {
  try {
    const { section } = req.params;
    const { courseId, branch, semester, since } = req.query || {};
    const tenantId = req.user?.tenantId || req.tenantId;
    const requesterRole = req.user?.role;

    if (requesterRole !== "teacher" && requesterRole !== "admin" && requesterRole !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Only teachers and admins can retrieve face descriptors",
      });
    }

    const isAllSections = !section || String(section).trim().toLowerCase() === "all";
    const cleanTenantId = toObjectId(tenantId);

    const query = {
      role: "student",
      isActive: true,
      isDeleted: false,
      faceDescriptor: { $exists: true, $ne: null, $not: { $size: 0 } },
    };

    if (cleanTenantId) {
      query.$or = [{ tenantId: cleanTenantId }, { tenantId: String(tenantId) }];
    } else if (tenantId) {
      query.tenantId = tenantId;
    }

    if (!isAllSections) {
      query.section = new RegExp(`^${escapeRegExp(section.trim())}$`, "i");
    }

    // Incremental delta sync: If client provides a valid timestamp, fetch only modified descriptors
    if (since) {
      const sinceDate = new Date(since);
      if (!isNaN(sinceDate.getTime())) {
        const deltaCondition = [
          { faceUpdatedAt: { $gt: sinceDate } },
          { updatedAt: { $gt: sinceDate } },
        ];
        if (query.$or) {
          query.$and = query.$and || [];
          query.$and.push({ $or: deltaCondition });
        } else {
          query.$or = deltaCondition;
        }
      }
    }

    const BRANCH_ALIASES = {
      "CSE": ["CSE", "COMPUTER SCIENCE", "COMPUTER SCIENCE & ENGINEERING", "COMPUTER SCIENCE AND ENGINEERING"],
      "COMPUTER SCIENCE": ["CSE", "COMPUTER SCIENCE", "COMPUTER SCIENCE & ENGINEERING", "COMPUTER SCIENCE AND ENGINEERING"],
      "IT": ["IT", "INFORMATION TECHNOLOGY"],
      "INFORMATION TECHNOLOGY": ["IT", "INFORMATION TECHNOLOGY"],
      "ECE": ["ECE", "ELECTRONICS", "ELECTRONICS & COMMUNICATION"],
      "ME": ["ME", "MECHANICAL", "MECHANICAL ENGINEERING"],
      "CIVIL": ["CIVIL", "CIVIL ENGINEERING"],
      "CHEM": ["CHEM", "CHEMISTRY", "CHEMICAL", "CHEMICAL ENGINEERING"],
      "CHEMISTRY": ["CHEM", "CHEMISTRY", "CHEMICAL", "CHEMICAL ENGINEERING"],
      "ARCH": ["ARCH", "ARCHITECTURE"],
      "ARCHITECTURE": ["ARCH", "ARCHITECTURE"],
    };

    if (courseId) {
      query.courseId = courseId;
    }
    if (branch) {
      const bUpper = String(branch).trim().toUpperCase();
      const validBranches = BRANCH_ALIASES[bUpper] || [bUpper];
      const branchRegexes = validBranches.map((b) => new RegExp(`^${b}$`, "i"));
      query.branch = { $in: branchRegexes };
    }
    if (semester) {
      const semNum = parseInt(String(semester).replace(/\D/g, ""), 10);
      if (!isNaN(semNum) && semNum > 0) {
        query.$and = (query.$and || []);
        query.$and.push({ $or: [{ semester: semNum }, { semester: String(semNum) }] });
      }
    }

    const students = await User.find(query)
      .select("name rollNo section faceDescriptor faceImageUrl faceUpdatedAt updatedAt createdAt")
      .lean();

    let maxUpdatedAt = null;
    const data = students.map((s) => {
      const updatedTimestamp = s.faceUpdatedAt || s.updatedAt || s.createdAt || new Date();
      const isoStr = updatedTimestamp instanceof Date ? updatedTimestamp.toISOString() : new Date(updatedTimestamp).toISOString();
      if (!maxUpdatedAt || isoStr > maxUpdatedAt) {
        maxUpdatedAt = isoStr;
      }

      return {
        studentId: s._id,
        name: s.name,
        rollNo: s.rollNo,
        section: s.section,
        descriptor: s.faceDescriptor,
        faceImageUrl: null, // Zero photo storage guarantee
        updatedAt: isoStr,
      };
    });

    return res.status(200).json({
      success: true,
      count: data.length,
      isDelta: Boolean(since),
      since: since || null,
      maxUpdatedAt: maxUpdatedAt || (since ? since : new Date().toISOString()),
      data: data,
    });
  } catch (error) {
    logger.error("getSectionFaceDescriptors: error fetching section descriptors", {
      section: req.params?.section,
      err: error?.message,
    });
    return res.status(500).json({
      success: false,
      message: "Server error while fetching section face descriptors",
    });
  }
};

// Export all controller functions
module.exports = {
  registerFace,
  getFaceDescriptor,
  getSectionFaceDescriptors,
  markFaceDetection,
};

