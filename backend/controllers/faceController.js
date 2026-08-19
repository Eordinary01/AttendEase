const User = require("../models/User");
const Enrollment = require("../models/Enrollment");
const Timetable = require("../models/Timetable");
const Subject = require("../models/Subject");
const Attendance = require("../models/Attendance");
const mongoose = require("mongoose");
const logger = require("../utils/logger");
const { logActivity } = require("../utils/activityLogger");
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

  // --- Save the uploaded face image (if provided) ---
  let faceImageUrl = null;
  if (req.file) {
    // req.file comes from the multer middleware configured for this route.
    // Store a relative URL path for retrieval.
    faceImageUrl = `/uploads/face-attendance/${req.file.filename}`;
    logger.info("Face image stored", {
      studentId: student._id,
      filename: req.file.filename,
      tenantId: tenantId,
      registeredBy: requesterId,
    });
  }

  // --- Upsert the face descriptor onto the User ---
  try {
    const updated = await User.findByIdAndUpdate(
      studentId,
      {
        faceDescriptor: faceDescriptor,
        faceImageUrl: faceImageUrl,
      },
      { new: true, runValidators: true }
    ).select("name rollNo section faceDescriptor faceImageUrl");

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Student not found (concurrent deletion?)",
      });
    }

    logActivity({
      tenantId: tenantId,
      userId: requesterId,
      description: `Face descriptor registered for ${student.name} (${student.rollNo})`,
      endpoint: "/api/faces/register",
      statusCode: 200,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    logger.info("Face descriptor registered", {
      studentId: student._id,
      rollNo: student.rollNo,
      descriptorLength: faceDescriptor.length,
      hasImage: !!faceImageUrl,
      registeredBy: requesterId,
      tenantId: tenantId,
    });

    return res.status(200).json({
      success: true,
      message: "Face descriptor registered",
      faceImageUrl: faceImageUrl,
      registeredAt: new Date().toISOString(),
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

  // --- Teacher assignment check ---
  if (requesterRole === "teacher") {
    const isAssigned = req.user.assignedSubjects?.some(
      (a) =>
        a.subjectId?.toString() === subjectId &&
        a.section?.trim().toUpperCase() === (req.body.section || "").trim().toUpperCase()
    );

    // Also check that the teacher is assigned to this subject at all (section
    // will be derived from the timetable, so we accept any section match here).
    const isAssignedToSubject = req.user.assignedSubjects?.some(
      (a) => a.subjectId?.toString() === subjectId
    );

    if (!isAssignedToSubject) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to teach this subject",
      });
    }
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

  // Verify the timetable's subject matches the requested subjectId (if the
  // timetable has a subjectId field — some slots may be generic).
  if (timetableSlot.subjectId && timetableSlot.subjectId.toString() !== subjectId) {
    return res.status(400).json({
      success: false,
      message: "Timetable slot subject does not match the requested subjectId",
    });
  }

  // Derive section from the timetable (fall back to what the timetable says).
  const section = timetableSlot.section;

  // --- Build the classSessionId ---
  const day = timetableSlot.day || "Monday";
  const classSessionId = `${subjectId}_${section}_${attendanceDate.toISOString().split("T")[0]}`;

  // --- Pre-fetch existing records for this session (duplicate detection) ---
  let existingRecords = [];
  try {
    existingRecords = await Attendance.find({
      tenantId: tenantId,
      classSessionId: classSessionId,
    }).select("studentId status").lean();
  } catch (err) {
    logger.error("markFaceDetection: error fetching existing attendance", {
      classSessionId,
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

// Export all controller functions
module.exports = {
  registerFace,
  getFaceDescriptor,
  markFaceDetection,
};
