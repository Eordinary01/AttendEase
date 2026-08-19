const mongoose = require("mongoose");
const Exam = require("../models/Exam");
const ExamResult = require("../models/ExamResult");
const User = require("../models/User");
const Subject = require("../models/Subject");
const Tenant = require("../models/Tenant");
const { requirePermission } = require("../middleware/permission");
const logger = require("../utils/logger");
const { toObjectId } = require("../utils/sanitize");
const { computeStudentGrades, computeSectionBacklogs, calculateGrade } = require("../utils/gradeCalculator");

// ─── Default exam structure (fallback when tenant has none configured) ───
const DEFAULT_EXAM_TYPES = [
  { name: "In-Term 1", code: "inTerm1", defaultDuration: 75, defaultMaxMarks: 40, isActive: true },
  { name: "In-Term 2", code: "inTerm2", defaultDuration: 75, defaultMaxMarks: 40, isActive: true },
  { name: "End-Term", code: "endTerm", defaultDuration: 180, defaultMaxMarks: 100, isActive: true },
  { name: "Practical", code: "practical", defaultDuration: 90, defaultMaxMarks: null, isActive: true },
];

const DEFAULT_SHIFTS = [
  { name: "I", startTime: "09:00", endTime: "10:15", isActive: true },
  { name: "II", startTime: "10:30", endTime: "11:45", isActive: true },
  { name: "III", startTime: "13:00", endTime: "14:15", isActive: true },
  { name: "IV", startTime: "14:30", endTime: "15:45", isActive: true },
];

// ─── Helpers ───
const timeToMinutes = (t) => {
  const [h, m] = String(t || "").split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : NaN;
};

const BRANCH_ALIASES = {
  "CSE": ["CSE", "CS", "COMPUTER SCIENCE", "COMPUTER SCIENCE & ENGINEERING", "COMPUTER SCIENCE AND ENGINEERING"],
  "CS": ["CSE", "CS", "COMPUTER SCIENCE", "COMPUTER SCIENCE & ENGINEERING", "COMPUTER SCIENCE AND ENGINEERING"],
  "COMPUTER SCIENCE": ["CSE", "CS", "COMPUTER SCIENCE", "COMPUTER SCIENCE & ENGINEERING", "COMPUTER SCIENCE AND ENGINEERING"],
  "COMPUTER SCIENCE & ENGINEERING": ["CSE", "CS", "COMPUTER SCIENCE", "COMPUTER SCIENCE & ENGINEERING", "COMPUTER SCIENCE AND ENGINEERING"],
  "COMPUTER SCIENCE AND ENGINEERING": ["CSE", "CS", "COMPUTER SCIENCE", "COMPUTER SCIENCE & ENGINEERING", "COMPUTER SCIENCE AND ENGINEERING"],
  "IT": ["IT", "INFORMATION TECHNOLOGY"],
  "INFORMATION TECHNOLOGY": ["IT", "INFORMATION TECHNOLOGY"],
  "ECE": ["ECE", "ELECTRONICS", "ELECTRONICS & COMMUNICATION", "ELECTRONICS & COMMUNICATION ENGINEERING", "ELECTRONICS AND COMMUNICATION ENGINEERING"],
  "ELECTRONICS": ["ECE", "ELECTRONICS", "ELECTRONICS & COMMUNICATION", "ELECTRONICS & COMMUNICATION ENGINEERING", "ELECTRONICS AND COMMUNICATION ENGINEERING"],
  "EEE": ["EEE", "ELECTRICAL", "ELECTRICAL & ELECTRONICS", "ELECTRICAL & ELECTRONICS ENGINEERING"],
  "ELECTRICAL": ["EEE", "ELECTRICAL", "ELECTRICAL & ELECTRONICS", "ELECTRICAL & ELECTRONICS ENGINEERING"],
  "ME": ["ME", "MECHANICAL", "MECHANICAL ENGINEERING"],
  "MECHANICAL": ["ME", "MECHANICAL", "MECHANICAL ENGINEERING"],
  "MECHANICAL ENGINEERING": ["ME", "MECHANICAL", "MECHANICAL ENGINEERING"],
  "CIVIL": ["CIVIL", "CIVIL ENGINEERING", "CE"],
  "CE": ["CIVIL", "CIVIL ENGINEERING", "CE"],
  "CIVIL ENGINEERING": ["CIVIL", "CIVIL ENGINEERING", "CE"],
  "CHEM": ["CHEM", "CHEMISTRY", "CHEMICAL", "CHEMICAL ENGINEERING"],
  "CHEMISTRY": ["CHEM", "CHEMISTRY", "CHEMICAL", "CHEMICAL ENGINEERING"],
  "CHEMICAL": ["CHEM", "CHEMISTRY", "CHEMICAL", "CHEMICAL ENGINEERING"],
  "CHEMICAL ENGINEERING": ["CHEM", "CHEMISTRY", "CHEMICAL", "CHEMICAL ENGINEERING"],
  "AIML": ["AIML", "AI & ML", "AI/ML", "ARTIFICIAL INTELLIGENCE & MACHINE LEARNING", "ARTIFICIAL INTELLIGENCE AND MACHINE LEARNING"],
  "AI & ML": ["AIML", "AI & ML", "AI/ML", "ARTIFICIAL INTELLIGENCE & MACHINE LEARNING", "ARTIFICIAL INTELLIGENCE AND MACHINE LEARNING"],
  "AI/ML": ["AIML", "AI & ML", "AI/ML", "ARTIFICIAL INTELLIGENCE & MACHINE LEARNING", "ARTIFICIAL INTELLIGENCE AND MACHINE LEARNING"],
  "AIDS": ["AIDS", "AI & DS", "AI/DS", "ARTIFICIAL INTELLIGENCE & DATA SCIENCE", "ARTIFICIAL INTELLIGENCE AND DATA SCIENCE"],
  "DS": ["DS", "DATA SCIENCE"],
  "DATA SCIENCE": ["DS", "DATA SCIENCE"],
};

const isBranchMatch = (b1, b2) => {
  if (!b1 || !b2) return true; // if one is unspecified, don't block
  const u1 = String(b1).trim().toUpperCase();
  const u2 = String(b2).trim().toUpperCase();
  if (u1 === u2) return true;

  const aliases1 = BRANCH_ALIASES[u1] || [u1];
  const aliases2 = BRANCH_ALIASES[u2] || [u2];

  return aliases1.includes(u2) || aliases2.includes(u1) || aliases1.some((a) => aliases2.includes(a));
};

const minutesToTime = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const getTenantExamStructure = async (tenantId) => {
  const tenant = await Tenant.findById(tenantId)
    .select("settings.examStructure settings.examPeriods")
    .lean();
  return {
    examTypes: tenant?.settings?.examStructure?.examTypes?.length
      ? tenant.settings.examStructure.examTypes
      : DEFAULT_EXAM_TYPES,
    shifts: tenant?.settings?.examStructure?.shifts?.length
      ? tenant.settings.examStructure.shifts
      : DEFAULT_SHIFTS,
    periods: tenant?.settings?.examPeriods || [],
  };
};

const computeEndTime = (startTime, duration) => {
  if (!startTime || !duration) return null;
  const startMin = timeToMinutes(startTime);
  if (Number.isNaN(startMin)) return null;
  return minutesToTime(startMin + duration);
};

// Convert Excel serial date (e.g. 46266.229) to JS Date
const excelSerialToDate = (serial) => {
  const num = Number(serial);
  if (Number.isNaN(num) || num < 1 || num > 2958465) return null; // max ~9999-12-31
  // Excel epoch = Jan 1 1900, but has leap-year bug (day 60 = Feb 29 1900 doesn't exist)
  // JS epoch offset: 25569 days between 1900-01-01 and 1970-01-01
  const ms = Math.round((num - 25569) * 86400000);
  const d = new Date(ms);
  return isNaN(d.getTime()) ? null : d;
};

// Normalise any date value (ISO string, Date object, or Excel serial) to "YYYY-MM-DD"
const normalizeDate = (val) => {
  if (!val) return null;
  // Already a proper date string
  if (typeof val === "string" && val.includes("-")) {
    const parts = val.split("T")[0].split(" ")[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(parts)) return parts;
  }
  // Excel serial number (pure numeric or numeric string)
  const asNum = Number(val);
  if (!Number.isNaN(asNum) && asNum > 1000 && asNum < 2958465) {
    const d = excelSerialToDate(asNum);
    if (d) {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const dy = String(d.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${dy}`;
    }
  }
  // JS Date object
  const d = new Date(val);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dy = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dy}`;
  }
  return null;
};

const formatDateKey = (val) => {
  return normalizeDate(val) || "";
};

const findExamConflicts = async (tenantId, entry, excludeId = null, pendingBatch = []) => {
  const section = String(entry.section || "").toUpperCase();
  const semester = entry.semester != null && entry.semester !== "" ? parseInt(String(entry.semester).replace(/\D/g, ""), 10) : null;
  const courseId = entry.courseId ? String(entry.courseId) : null;
  const branch = entry.branch ? String(entry.branch).toUpperCase() : null;
  const room = entry.room ? String(entry.room).trim().toLowerCase() : null;

  const entryStartMin = timeToMinutes(entry.startTime);
  const entryEndMin = timeToMinutes(entry.endTime);

  if (!entry.date || Number.isNaN(entryStartMin) || Number.isNaN(entryEndMin)) return [];

  const entryDateKey = formatDateKey(entry.date);
  if (!entryDateKey) return [];

  const startOfDay = new Date(`${entryDateKey}T00:00:00.000Z`);
  const endOfDay = new Date(`${entryDateKey}T23:59:59.999Z`);

  // 1. Check against DB (date range query for full format compatibility)
  const query = {
    tenantId,
    isActive: true,
    date: { $gte: startOfDay, $lte: endOfDay },
  };
  if (excludeId) query._id = { $ne: excludeId };

  const existing = await Exam.find(query).lean();
  const conflicts = [];

  const checkOverlap = (ex, label = "") => {
    const exStartMin = timeToMinutes(ex.startTime);
    const exEndMin = timeToMinutes(ex.endTime);
    if (Number.isNaN(exStartMin) || Number.isNaN(exEndMin)) return;

    const overlaps = entryStartMin < exEndMin && exStartMin < entryEndMin;
    if (!overlaps) return;

    const exSection = String(ex.section || "").toUpperCase();
    const exSemester = ex.semester != null && ex.semester !== "" ? parseInt(String(ex.semester).replace(/\D/g, ""), 10) : null;
    const exCourseId = ex.courseId ? String(ex.courseId) : null;
    const exBranch = ex.branch ? String(ex.branch).toUpperCase() : null;
    const exRoom = ex.room ? String(ex.room).trim().toLowerCase() : null;

    // 1. Room collision: same physical room at overlapping time
    if (room && exRoom && room === exRoom) {
      conflicts.push(`Room ${entry.room} is already booked for "${ex.title}" (${ex.subjectCode || ex.subjectName || ""}) at ${ex.startTime}-${ex.endTime}${label}`);
    }

    // 2. Student cohort collision: same section, semester, and course/branch at overlapping time
    if (section && exSection && section === exSection) {
      const sameSemester = (semester != null && exSemester != null) ? semester === exSemester : true;
      const sameCourse = (courseId && exCourseId) ? courseId === exCourseId : true;
      const sameBranch = (branch && exBranch) ? isBranchMatch(branch, exBranch) : true;

      if (sameSemester && sameCourse && sameBranch) {
        const semLabel = semester ? ` (Sem ${semester})` : "";
        conflicts.push(
          `Section ${section}${semLabel} already has "${ex.title}" (${ex.subjectCode || ex.subjectName || ""}) at ${ex.startTime}-${ex.endTime}${label}`
        );
      }
    }
  };

  for (const ex of existing) {
    checkOverlap(ex);
  }

  // 2. Check against pending batch rows in the same upload
  for (const pending of pendingBatch) {
    const pendingDateKey = formatDateKey(pending.date);
    if (pendingDateKey && pendingDateKey === entryDateKey) {
      checkOverlap(pending, " (in this import batch)");
    }
  }

  return [...new Set(conflicts)];
};

const findInvigilatorConflicts = async (tenantId, invigilators, date, startTime, endTime, excludeId = null) => {
  if (!invigilators || invigilators.length === 0) return [];

  const entryStartMin = timeToMinutes(startTime);
  const entryEndMin = timeToMinutes(endTime);
  if (Number.isNaN(entryStartMin) || Number.isNaN(entryEndMin)) return [];

  const query = { tenantId, date, isActive: true, invigilators: { $in: invigilators } };
  if (excludeId) query._id = { $ne: excludeId };

  const existing = await Exam.find(query).populate("invigilators", "name").lean();
  const conflicts = [];

  for (const ex of existing) {
    const exStartMin = timeToMinutes(ex.startTime);
    const exEndMin = timeToMinutes(ex.endTime);
    if (Number.isNaN(exStartMin) || Number.isNaN(exEndMin)) continue;

    const overlaps = entryStartMin < exEndMin && exStartMin < entryEndMin;
    if (!overlaps) continue;

    const clashingTeachers = (ex.invigilators || [])
      .filter((t) => invigilators.includes(String(t._id)))
      .map((t) => t.name);
    if (clashingTeachers.length > 0) {
      conflicts.push(
        `Teacher${clashingTeachers.length > 1 ? "s" : ""} ${clashingTeachers.join(", ")} already assigned as invigilator for "${ex.title}" at ${ex.startTime}-${ex.endTime}`
      );
    }
  }

  return [...new Set(conflicts)];
};

// ─── Helpers for Exam Config & Period Resolution ───

/**
 * Resolves & validates Exam payload against tenant's configured Exam Structure & Periods
 * Enforces strict Exam Type validation, compulsory Exam Period resolution, and timeline checks.
 */
const resolveAndValidateExamConfig = (tenantStructure, payload) => {
  const errors = [];
  const { examTypes = [], periods = [], shifts = [] } = tenantStructure;

  const rawTypeCode = payload.examTypeCode || payload.type;
  if (!rawTypeCode) {
    errors.push("examTypeCode or type is required");
    return { errors };
  }

  // 1. Validate Exam Type against configured active exam types
  const validTypeDef = examTypes.find(
    (t) =>
      t.isActive !== false &&
      (String(t.code).toLowerCase() === String(rawTypeCode).toLowerCase() ||
        String(t.name).toLowerCase() === String(rawTypeCode).toLowerCase())
  );

  if (!validTypeDef) {
    const allowedCodes = examTypes.filter(t => t.isActive !== false).map((t) => t.code).join(", ");
    errors.push(`Invalid exam type "${rawTypeCode}". Configured active exam types are: ${allowedCodes || "none"}`);
    return { errors };
  }

  const resolvedExamTypeCode = validTypeDef.code;

  // 2. Resolve & Validate Exam Period (COMPULSORY)
  let resolvedExamPeriodId = payload.examPeriodId;
  let matchedPeriod = null;

  if (resolvedExamPeriodId) {
    matchedPeriod = periods.find(
      (p) =>
        String(p._id || p.id) === String(resolvedExamPeriodId) ||
        String(p.name).toLowerCase() === String(resolvedExamPeriodId).toLowerCase()
    );
  }

  // Auto-resolution by examTypeCode if not matched by ID/name
  if (!matchedPeriod) {
    matchedPeriod = periods.find(
      (p) => String(p.examTypeCode).toLowerCase() === String(resolvedExamTypeCode).toLowerCase()
    );
  }

  // Single active period fallback if only 1 period exists
  if (!matchedPeriod && periods.length === 1) {
    matchedPeriod = periods[0];
  }

  if (!matchedPeriod) {
    const periodList = periods.map((p) => `"${p.name}" (${p.examTypeCode})`).join(", ");
    errors.push(
      `Exam period is compulsory and could not be resolved for exam type "${resolvedExamTypeCode}". Configured periods: ${
        periodList || "No exam periods configured"
      }`
    );
    return { errors };
  }

  resolvedExamPeriodId = matchedPeriod._id || matchedPeriod.id || matchedPeriod.name;

  // 3. Validate exam date against matched exam period's start and end date timeline
  if (payload.date && matchedPeriod.startDate && matchedPeriod.endDate) {
    const examDateKey = formatDateKey(payload.date);
    const startKey = formatDateKey(matchedPeriod.startDate);
    const endKey = formatDateKey(matchedPeriod.endDate);

    if (examDateKey && startKey && endKey) {
      if (examDateKey < startKey || examDateKey > endKey) {
        errors.push(
          `Exam date "${examDateKey}" is outside the configured exam period "${matchedPeriod.name}" (${startKey} to ${endKey})`
        );
      }
    }
  }

  // 4. Resolve Shift & Duration
  const resolvedShift = payload.shift || "I";
  const shiftDef = shifts.find((s) => s.name === resolvedShift);
  if (!shiftDef && shifts.length > 0) {
    errors.push(`Invalid shift "${resolvedShift}". Configured shifts: ${shifts.map((s) => s.name).join(", ")}`);
    return { errors };
  }

  return {
    errors,
    validTypeDef,
    matchedPeriod,
    resolvedExamTypeCode,
    resolvedExamPeriodId,
    resolvedShift,
    shiftDef,
  };
};

// ─── CRUD ───

const createExam = async (req, res) => {
  try {
    const {
      subjectId, subjectName, subjectCode, section, title, type,
      examTypeCode, examPeriodId, courseId, branch, semester,
      shift, duration, date, startTime, endTime,
      maxMarks, passingMarks, room, description, invigilators, isBacklog,
    } = req.body;

    if (!subjectId || !section || !title || !date) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const structure = await getTenantExamStructure(req.user.tenantId);

    // Enforce Exam Type validation and compulsory Exam Period resolution
    const configResult = resolveAndValidateExamConfig(structure, req.body);
    if (configResult.errors && configResult.errors.length > 0) {
      return res.status(400).json({ success: false, message: configResult.errors.join("; ") });
    }

    const { validTypeDef, matchedPeriod, resolvedExamTypeCode, resolvedExamPeriodId, resolvedShift, shiftDef } = configResult;

    // Validate and auto-fill from subject
    const subject = await Subject.findOne({
      _id: toObjectId(subjectId),
      tenantId: req.user.tenantId,
      isActive: true,
    }).lean();

    if (!subject) {
      return res.status(400).json({
        success: false,
        message: `Subject with ID "${subjectId}" was not found in your institution`,
      });
    }

    let finalSubjectName = subject.subjectName;
    let finalSubjectCode = subject.subjectCode;
    let finalCourseId = subject.courseId || courseId;
    let finalBranch = subject.branch || branch;
    let finalSemester = semester !== undefined && semester !== "" && semester != null
      ? parseInt(String(semester).replace(/\D/g, ""), 10)
      : undefined;

    if (finalSemester === undefined && subject.semester) {
      const parsedSubSem = parseInt(String(subject.semester).replace(/\D/g, ""), 10);
      if (!isNaN(parsedSubSem)) finalSemester = parsedSubSem;
    }

    let finalDuration = duration && !Number.isNaN(parseInt(duration)) ? parseInt(duration) : undefined;
    let finalStartTime = startTime;
    let finalEndTime = endTime;

    if (!finalStartTime && shiftDef) {
      finalStartTime = shiftDef.startTime;
    }

    if (!finalDuration && finalStartTime && finalEndTime) {
      const startM = timeToMinutes(finalStartTime);
      const endM = timeToMinutes(finalEndTime);
      if (!Number.isNaN(startM) && !Number.isNaN(endM) && endM > startM) {
        finalDuration = endM - startM;
      }
    }

    if (!finalDuration && shiftDef) {
      finalDuration = timeToMinutes(shiftDef.endTime) - timeToMinutes(shiftDef.startTime);
    }

    if (!finalDuration && validTypeDef?.defaultDuration) {
      finalDuration = validTypeDef.defaultDuration;
    }

    if (!finalEndTime && finalStartTime && finalDuration) {
      finalEndTime = computeEndTime(finalStartTime, finalDuration);
    }

    // Resolve maxMarks from exam type config (source of truth on create)
    let finalMaxMarks = maxMarks;
    if (validTypeDef?.defaultMaxMarks != null) finalMaxMarks = validTypeDef.defaultMaxMarks;
    if (finalMaxMarks == null) finalMaxMarks = 100;

    // Conflict check
    const conflicts = await findExamConflicts(req.user.tenantId, {
      section,
      semester: finalSemester,
      courseId: finalCourseId,
      branch: finalBranch,
      date,
      startTime: finalStartTime,
      endTime: finalEndTime,
      room,
    });
    if (conflicts.length > 0) {
      return res.status(409).json({ success: false, message: "Schedule conflict", conflicts });
    }

    // Invigilator conflict check
    const invigilatorIds = Array.isArray(invigilators) ? invigilators.filter(Boolean) : [];
    if (invigilatorIds.length > 2) {
      return res.status(400).json({ success: false, message: "Maximum 2 invigilators allowed" });
    }
    if (invigilatorIds.length > 0) {
      const invigConflicts = await findInvigilatorConflicts(req.user.tenantId, invigilatorIds, date, finalStartTime, finalEndTime);
      if (invigConflicts.length > 0) {
        return res.status(409).json({ success: false, message: "Invigilator conflict", conflicts: invigConflicts });
      }
    }

    const exam = await Exam.create({
      tenantId: req.user.tenantId,
      subjectId,
      subjectName: finalSubjectName,
      subjectCode: finalSubjectCode,
      section: section.toUpperCase(),
      title,
      type: resolvedExamTypeCode,
      examTypeCode: resolvedExamTypeCode,
      examPeriodId: resolvedExamPeriodId,
      courseId: finalCourseId || undefined,
      branch: finalBranch || undefined,
      semester: finalSemester || undefined,
      shift: resolvedShift,
      duration: finalDuration || undefined,
      date,
      startTime: finalStartTime,
      endTime: finalEndTime,
      maxMarks: finalMaxMarks,
      passingMarks: passingMarks !== undefined ? parseInt(passingMarks) : Math.round(finalMaxMarks * 0.4),
      room: room || undefined,
      description: description || undefined,
      invigilators: invigilatorIds,
      isBacklog: isBacklog === true || isBacklog === "true",
      createdBy: req.user._id,
    });

    return res.status(201).json({ success: true, data: exam });
  } catch (error) {
    logger.error("Error creating exam", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to create exam" });
  }
};

const getExams = async (req, res) => {
  try {
    const { section, subjectId, status, type, examTypeCode, examPeriodId, shift, courseId, branch, semester, startDate, endDate } = req.query;
    const filter = { tenantId: req.user.tenantId, isActive: true };

    if (subjectId) filter.subjectId = subjectId;
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (examTypeCode) filter.examTypeCode = examTypeCode;
    if (examPeriodId) filter.examPeriodId = examPeriodId;
    if (shift) filter.shift = shift;

    if (req.user.role === "student") {
      const studentSection = section || req.user.section;
      if (studentSection) filter.section = new RegExp(`^${studentSection.trim()}$`, "i");
    } else if (section) {
      filter.section = new RegExp(`^${section.trim()}$`, "i");
    }

    if (courseId) {
      filter.$or = [{ courseId: courseId }, { courseCode: new RegExp(`^${courseId}$`, "i") }];
    }

    const andConditions = [];

    let targetBranch = branch || (req.user.role === "student" ? req.user.branch : null);
    let targetSemester = semester || (req.user.role === "student" ? req.user.semester : null);

    if (req.user.role === "student" && (!targetBranch || !targetSemester)) {
      const Enrollment = require("../models/Enrollment");
      const enrollment = await Enrollment.findOne({
        $or: [
          { userId: req.user._id },
          ...(req.user.email ? [{ email: req.user.email.toLowerCase() }] : []),
        ],
        tenantId: req.user.tenantId,
      }).lean();

      if (enrollment) {
        targetBranch = targetBranch || enrollment.branch;
        targetSemester = targetSemester || enrollment.semester;
      }
    }

    if (targetBranch) {
      const bUpper = targetBranch.trim().toUpperCase();
      const validBranches = BRANCH_ALIASES[bUpper] || [bUpper];
      const branchRegexes = validBranches.map((b) => new RegExp(`^${b}$`, "i"));

      if (req.user.role === "student") {
        andConditions.push({ branch: { $in: branchRegexes } });
      } else {
        andConditions.push({
          $or: [
            { branch: { $in: branchRegexes } },
            { branch: "" },
            { branch: null },
            { branch: { $exists: false } }
          ]
        });
      }
    }

    if (targetSemester) {
      const semNum = parseInt(String(targetSemester).replace(/\D/g, ""), 10);
      if (!isNaN(semNum) && semNum > 0) {
        if (req.user.role === "student") {
          // Strict semester matching for students: only show exams corresponding to their semester
          andConditions.push({ semester: semNum });
        } else {
          andConditions.push({
            $or: [
              { semester: semNum },
              { semester: String(semNum) },
              { semester: "" },
              { semester: null },
              { semester: { $exists: false } }
            ]
          });
        }
      }
    }

    if (andConditions.length > 0) {
      filter.$and = andConditions;
    }

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const exams = await Exam.find(filter)
      .sort({ date: 1, startTime: 1 })
      .populate("createdBy", "name")
      .populate("invigilators", "name")
      .lean();

    return res.status(200).json({ success: true, data: exams });
  } catch (error) {
    logger.error("Error fetching exams", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to fetch exams" });
  }
};

const getExamById = async (req, res) => {
  try {
    const exam = await Exam.findOne({ _id: req.params.id, tenantId: req.user.tenantId })
      .populate("createdBy", "name")
      .populate("invigilators", "name email")
      .lean();
    if (!exam) return res.status(404).json({ success: false, message: "Exam not found" });

    const isStaff = req.user.role === "admin" || req.user.role === "teacher";
    const canViewResults = isStaff || exam.resultStatus === "published";

    const results = canViewResults
      ? await ExamResult.find({ examId: exam._id, tenantId: req.user.tenantId })
          .populate("studentId", "name email rollNo section")
          .populate("gradedBy", "name")
          .sort("studentId.rollNo")
          .lean()
      : [];

    return res.status(200).json({ success: true, data: { exam, results } });
  } catch (error) {
    logger.error("Error fetching exam", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to fetch exam" });
  }
};

const updateExam = async (req, res) => {
  try {
    const exam = await Exam.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!exam) return res.status(404).json({ success: false, message: "Exam not found" });

    const {
      title, type, examTypeCode, shift, duration, courseId, branch, semester,
      date, startTime, endTime, maxMarks, passingMarks, room, description, status, invigilators, isBacklog,
    } = req.body;

    if (title !== undefined) exam.title = title;
    if (type !== undefined) exam.type = type;
    if (examTypeCode !== undefined) exam.examTypeCode = examTypeCode;
    if (isBacklog !== undefined) exam.isBacklog = Boolean(isBacklog);
    if (shift !== undefined) exam.shift = shift;
    if (duration !== undefined) exam.duration = duration;
    if (courseId !== undefined) exam.courseId = courseId;
    if (branch !== undefined) exam.branch = branch;
    if (semester !== undefined) exam.semester = semester !== "" && semester != null ? parseInt(semester) : undefined;
    if (date !== undefined) exam.date = date;
    if (startTime !== undefined) exam.startTime = startTime;
    if (endTime !== undefined) exam.endTime = endTime;
    if (maxMarks !== undefined) exam.maxMarks = maxMarks;
    if (passingMarks !== undefined) exam.passingMarks = passingMarks;
    if (room !== undefined) exam.room = room;
    if (description !== undefined) exam.description = description;
    if (status !== undefined) exam.status = status;
    if (invigilators !== undefined) {
      const invigIds = Array.isArray(invigilators) ? invigilators.filter(Boolean) : [];
      if (invigIds.length > 2) {
        return res.status(400).json({ success: false, message: "Maximum 2 invigilators allowed" });
      }
      exam.invigilators = invigIds;
    }

    // Re-check conflicts if date/section/shift/times changed
    if (date !== undefined || shift !== undefined || startTime !== undefined || endTime !== undefined || room !== undefined) {
      const conflicts = await findExamConflicts(req.user.tenantId, {
        section: exam.section,
        semester: exam.semester,
        courseId: exam.courseId,
        branch: exam.branch,
        date: exam.date,
        startTime: exam.startTime,
        endTime: exam.endTime,
        room: exam.room,
      }, exam._id);
      if (conflicts.length > 0) {
        return res.status(409).json({ success: false, message: "Schedule conflict", conflicts });
      }
    }

    // Re-check invigilator conflicts if invigilators, date, or times changed
    if (invigilators !== undefined || date !== undefined || startTime !== undefined || endTime !== undefined) {
      const invigIds = exam.invigilators || [];
      if (invigIds.length > 0) {
        const invigConflicts = await findInvigilatorConflicts(
          req.user.tenantId, invigIds, exam.date, exam.startTime, exam.endTime, exam._id
        );
        if (invigConflicts.length > 0) {
          return res.status(409).json({ success: false, message: "Invigilator conflict", conflicts: invigConflicts });
        }
      }
    }

    await exam.save();
    return res.status(200).json({ success: true, data: exam });
  } catch (error) {
    logger.error("Error updating exam", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to update exam" });
  }
};

const deleteExam = async (req, res) => {
  try {
    const exam = await Exam.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!exam) return res.status(404).json({ success: false, message: "Exam not found" });

    await ExamResult.deleteMany({ examId: exam._id, tenantId: req.user.tenantId });

    exam.isActive = false;
    exam.status = "cancelled";
    await exam.save();

    return res.status(200).json({ success: true, message: "Exam deleted" });
  } catch (error) {
    logger.error("Error deleting exam", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to delete exam" });
  }
};

const submitGrades = async (req, res) => {
  try {
    const { examId } = req.params;
    const { results } = req.body;

    const exam = await Exam.findOne({ _id: examId, tenantId: req.user.tenantId });
    if (!exam) return res.status(404).json({ success: false, message: "Exam not found" });

    if (!Array.isArray(results) || results.length === 0) {
      return res.status(400).json({ success: false, message: "Results array is required" });
    }

    // Resolve studentId from rollNo when only rollNo is provided (CSV bulk upload).
    const resolvedResults = [];
    for (const r of results) {
      if (r.studentId) {
        resolvedResults.push(r);
        continue;
      }
      if (!r.rollNo) {
        return res.status(400).json({
          success: false,
          message: "Each result requires studentId or rollNo",
        });
      }
      const matched = await User.findOne({
        tenantId: req.user.tenantId,
        role: "student",
        rollNo: String(r.rollNo).trim(),
      }).select("_id section courseId branch semester").lean();
      if (!matched) {
        return res.status(400).json({
          success: false,
          message: `No student found with rollNo ${r.rollNo} in this institution`,
        });
      }
      resolvedResults.push({ ...r, studentId: matched._id });
    }

    // Validate that every student belongs to this tenant and matches the exam's
    // academic context (section / course / branch / semester) when both are set.
    const studentIds = resolvedResults.map(r => r.studentId).filter(Boolean);
    const students = await User.find({
      _id: { $in: studentIds },
      tenantId: req.user.tenantId,
      role: "student",
    }).select("section courseId branch semester").lean();
    const studentMap = new Map(students.map(s => [String(s._id), s]));

    const unknown = studentIds.filter(id => !studentMap.has(String(id)));
    if (unknown.length > 0) {
      return res.status(400).json({
        success: false,
        message: `${unknown.length} student(s) do not exist in this institution`,
      });
    }

    const mismatches = [];
    for (const r of resolvedResults) {
      const st = studentMap.get(String(r.studentId));
      if (!st) continue;
      const reasons = [];
      if (exam.section && st.section && String(st.section).toUpperCase() !== String(exam.section).toUpperCase()) {
        reasons.push(`section "${st.section}" (expected "${exam.section}")`);
      }
      if (exam.courseId && st.courseId && String(st.courseId) !== String(exam.courseId)) {
        reasons.push(`course mismatch`);
      }
      if (exam.branch && st.branch && !isBranchMatch(st.branch, exam.branch)) {
        reasons.push(`branch "${st.branch}" (expected "${exam.branch}")`);
      }
      if (exam.semester && st.semester && Number(st.semester) !== Number(exam.semester)) {
        reasons.push(`semester ${st.semester} (expected ${exam.semester})`);
      }
      if (reasons.length > 0) {
        mismatches.push({
          rollNo: r.rollNo || st.rollNo,
          name: st.name,
          reasons: reasons.join(", "),
        });
      }
    }

    if (mismatches.length > 0) {
      const summary = mismatches.slice(0, 3).map(m => `Student ${m.rollNo || ""}: ${m.reasons}`).join("; ");
      return res.status(400).json({
        success: false,
        message: `${mismatches.length} result(s) do not match the exam's profile: ${summary}`,
        mismatches,
      });
    }

    // Guard against uploading results for the wrong subject: when a row carries
    // subjectCode/semester (bulk upload), they must match the exam's own context.
    const subjectMismatches = resolvedResults.filter(r => {
      if (r.subjectCode && exam.subjectCode && String(r.subjectCode).trim().toUpperCase() !== String(exam.subjectCode).toUpperCase()) return true;
      if (r.semester != null && exam.semester != null && Number(r.semester) !== Number(exam.semester)) return true;
      return false;
    });
    if (subjectMismatches.length > 0) {
      return res.status(400).json({
        success: false,
        message: `${subjectMismatches.length} result(s) do not match the exam's subject (${exam.subjectCode || exam.subjectName} / Semester ${exam.semester})`,
      });
    }

    const examMaxMarks = Number(exam.maxMarks) || 100;

    // Validate marksObtained against exam entity's maxMarks
    const marksExceeded = resolvedResults.filter(r => Number(r.marksObtained) > examMaxMarks);
    if (marksExceeded.length > 0) {
      const summary = marksExceeded.slice(0, 3).map(r => `Student ${r.rollNo || ""}: scored ${r.marksObtained} (max allowed: ${examMaxMarks})`).join("; ");
      return res.status(400).json({
        success: false,
        message: `${marksExceeded.length} student(s) have marks exceeding exam max marks (${examMaxMarks}): ${summary}`,
      });
    }

    const operations = resolvedResults.map(r => {
      const marks = Number(r.marksObtained);
      const percentage = examMaxMarks > 0 ? (marks / examMaxMarks) * 100 : 0;
      const grade = calculateGrade(percentage);
      return {
        updateOne: {
          filter: { examId, studentId: r.studentId, tenantId: req.user.tenantId },
          update: {
            $set: {
              marksObtained: marks,
              maxMarks: examMaxMarks,
              percentage: Math.round(percentage * 10) / 10,
              grade,
              remarks: r.remarks || "",
              status: "graded",
              gradedBy: req.user._id,
              gradedAt: new Date(),
            },
          },
          upsert: true,
        },
      };
    });

    await ExamResult.bulkWrite(operations);

    exam.status = "completed";
    // Any change to grades pulls the exam back to draft so it must be
    // re-published before students can see the updated results.
    if (exam.resultStatus === "published") {
      exam.resultStatus = "draft";
      exam.publishedAt = undefined;
      exam.publishedBy = undefined;
    }
    await exam.save();

    return res.status(200).json({ success: true, message: "Grades submitted successfully" });
  } catch (error) {
    logger.error("Error submitting grades", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to submit grades" });
  }
};

// ─── Result Publication ───

const publishExamResults = async (req, res) => {
  try {
    const { examId } = req.params;
    const exam = await Exam.findOne({ _id: examId, tenantId: req.user.tenantId });
    if (!exam) return res.status(404).json({ success: false, message: "Exam not found" });

    if (exam.status === "cancelled") {
      return res.status(400).json({ success: false, message: "Cannot publish results for a cancelled exam" });
    }

    const gradedCount = await ExamResult.countDocuments({
      examId: exam._id,
      tenantId: req.user.tenantId,
      status: "graded",
    });
    if (gradedCount === 0) {
      return res.status(400).json({
        success: false,
        message: "No graded results to publish. Submit grades first.",
      });
    }

    exam.resultStatus = "published";
    exam.publishedAt = new Date();
    exam.publishedBy = req.user._id;
    await exam.save();

    return res.status(200).json({ success: true, message: "Results published", data: exam });
  } catch (error) {
    logger.error("Error publishing exam results", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to publish results" });
  }
};

const unpublishExamResults = async (req, res) => {
  try {
    const { examId } = req.params;
    const exam = await Exam.findOne({ _id: examId, tenantId: req.user.tenantId });
    if (!exam) return res.status(404).json({ success: false, message: "Exam not found" });

    exam.resultStatus = "draft";
    exam.publishedAt = undefined;
    exam.publishedBy = undefined;
    await exam.save();

    return res.status(200).json({ success: true, message: "Results unpublished", data: exam });
  } catch (error) {
    logger.error("Error unpublishing exam results", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to unpublish results" });
  }
};

// ─── Individual Result Update (only updates; creation is always bulk) ───

const updateResult = async (req, res) => {
  try {
    const { examId, studentId } = req.params;
    const { marksObtained, maxMarks, remarks } = req.body;

    const exam = await Exam.findOne({ _id: examId, tenantId: req.user.tenantId });
    if (!exam) return res.status(404).json({ success: false, message: "Exam not found" });

    const student = await User.findOne({
      _id: studentId,
      tenantId: req.user.tenantId,
      role: "student",
    }).select("section courseId branch semester").lean();
    if (!student) {
      return res.status(400).json({ success: false, message: "Student does not exist in this institution" });
    }
    if (exam.section && student.section && String(student.section).toUpperCase() !== String(exam.section).toUpperCase()) {
      return res.status(400).json({ success: false, message: "Student section does not match the exam section" });
    }

    const result = await ExamResult.findOne({ examId, studentId, tenantId: req.user.tenantId });
    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Result not found. Results can only be created via bulk grade upload.",
      });
    }

    const examMaxMarks = Number(exam.maxMarks) || result.maxMarks || 100;
    const finalMarks = marksObtained != null && !Number.isNaN(parseFloat(marksObtained)) ? parseFloat(marksObtained) : result.marksObtained;
    if (finalMarks > examMaxMarks) {
      return res.status(400).json({
        success: false,
        message: `Marks obtained (${finalMarks}) cannot exceed exam maximum marks (${examMaxMarks})`,
      });
    }

    const percentage = examMaxMarks > 0 ? (finalMarks / examMaxMarks) * 100 : 0;

    result.marksObtained = finalMarks;
    result.maxMarks = examMaxMarks;
    result.percentage = Math.round(percentage * 10) / 10;
    result.grade = calculateGrade(percentage);
    if (remarks !== undefined) result.remarks = remarks || "";
    result.status = "graded";
    result.gradedBy = req.user._id;
    result.gradedAt = new Date();
    await result.save();

    // Re-grading pulls the exam back to draft so it must be re-published.
    if (exam.resultStatus === "published") {
      exam.resultStatus = "draft";
      exam.publishedAt = undefined;
      exam.publishedBy = undefined;
    }
    await exam.save();

    return res.status(200).json({ success: true, message: "Result updated", data: result });
  } catch (error) {
    logger.error("Error updating result", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to update result" });
  }
};

const getMyResults = async (req, res) => {
  try {
    const results = await ExamResult.find({ studentId: req.user._id, tenantId: req.user.tenantId })
      .populate({
        path: "examId",
        select: "title type examTypeCode subjectId subjectName subjectCode semester date maxMarks section shift duration resultStatus isBacklog",
      })
      .sort({ createdAt: -1 })
      .lean();

    // Students/parents only see published results.
    const published = results.filter(r => r.examId?.resultStatus === "published");

    return res.status(200).json({ success: true, data: published });
  } catch (error) {
    logger.error("Error fetching results", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to fetch results" });
  }
};

const getUpcomingExams = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("role section semester courseId branch assignedSubjects").lean();
    let userSection = user?.section;
    let userSemester = user?.semester;
    let userCourseId = user?.courseId;
    let userBranch = user?.branch;

    if ((req.user.role === "student" || req.user.role === "parent" || req.user.accessMode === "parent") && (!userSemester || !userSection)) {
      const Enrollment = require("../models/Enrollment");
      const enrollment = await Enrollment.findOne({
        $or: [
          { userId: req.user._id },
          ...(req.user.email ? [{ email: req.user.email.toLowerCase() }] : []),
        ],
        tenantId: req.user.tenantId,
      }).lean();
      if (enrollment) {
        userSection = userSection || enrollment.section;
        userSemester = userSemester || enrollment.semester;
        userCourseId = userCourseId || enrollment.courseId;
        userBranch = userBranch || enrollment.branch;
      }
    }

    const { section, semester, courseId, type } = req.query;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const filter = {
      tenantId: req.user.tenantId,
      isActive: true,
      status: { $in: ["scheduled", "in_progress"] },
      date: { $gte: startOfToday },
    };

    if (req.user.role === "student") {
      if (userSection) filter.section = new RegExp(`^${userSection.trim()}$`, "i");
      if (userSemester) {
        const semNum = parseInt(String(userSemester).replace(/\D/g, ""), 10);
        if (!isNaN(semNum) && semNum > 0) filter.semester = semNum;
      }
      if (userCourseId) filter.courseId = userCourseId;

      if (userBranch) {
        const bUpper = String(userBranch).trim().toUpperCase();
        const validBranches = BRANCH_ALIASES[bUpper] || [bUpper];
        const branchRegexes = validBranches.map((b) => new RegExp(`^${b}$`, "i"));
        filter.branch = { $in: branchRegexes };
      }
    } else {
      if (section) filter.section = new RegExp(`^${section.trim()}$`, "i");
      if (semester) filter.semester = parseInt(semester);
      if (courseId) filter.courseId = courseId;
      if (req.query.branch) {
        const bUpper = String(req.query.branch).trim().toUpperCase();
        const validBranches = BRANCH_ALIASES[bUpper] || [bUpper];
        const branchRegexes = validBranches.map((b) => new RegExp(`^${b}$`, "i"));
        filter.branch = { $in: branchRegexes };
      }
    }
    if (type) filter.type = type;

    const exams = await Exam.find(filter)
      .sort({ date: 1, startTime: 1 })
      .populate("courseId", "code name")
      .populate("subjectId", "subjectName subjectCode semester")
      .lean();

    return res.status(200).json({ success: true, data: exams });
  } catch (error) {
    logger.error("Error fetching upcoming exams", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to fetch upcoming exams" });
  }
};

const getGradeReport = async (req, res) => {
  try {
    const data = await computeStudentGrades(req.user._id, req.user.tenantId);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("Error fetching grade report", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to fetch grade report" });
  }
};

const getBacklogs = async (req, res) => {
  try {
    const { section, semester } = req.query;
    const backlogs = await computeSectionBacklogs(req.user.tenantId, { section, semester });
    return res.status(200).json({ success: true, data: backlogs });
  } catch (error) {
    logger.error("Error fetching backlogs", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to fetch backlogs" });
  }
};

const EXAM_TYPES = ["quiz", "midterm", "final", "practical", "assignment"];

const bulkCreateExams = async (req, res) => {
  try {
    const { exams } = req.body;
    if (!Array.isArray(exams) || exams.length === 0) {
      return res.status(400).json({ success: false, message: "Exams array is required" });
    }

    const rawTenantId = req.tenantId || req.user?.tenantId || req.tenant?._id;
    const tenantId = toObjectId(rawTenantId);

    // Pre-fetch tenant data for resolution
    const [structure, tenant] = await Promise.all([
      getTenantExamStructure(tenantId),
      Tenant.findById(tenantId).select("settings.examPeriods").lean(),
    ]);
    const periodDefs = tenant?.settings?.examPeriods || [];

    const rowErrors = [];
    const valid = [];

    for (let i = 0; i < exams.length; i++) {
      const raw = exams[i] || {};

      // Skip empty/trailing rows from spreadsheets
      const hasContent = Object.values(raw).some((v) => v != null && String(v).trim() !== "" && String(v).trim() !== "=");
      if (!hasContent) continue;

      // Normalize date from Excel serial number if needed
      if (raw.date) {
        const normalized = normalizeDate(raw.date);
        if (normalized) raw.date = normalized;
      }

      const {
        subjectId, subjectName, subjectCode, section, title, type,
        examTypeCode, shift, courseId, courseCode, branch, semester,
        examPeriodId, date, startTime, endTime, maxMarks, passingMarks, room, description, duration,
        invigilators, isBacklog,
      } = raw;

      const errors = [];
      if (!subjectId) errors.push("subjectId is required");
      if (!section) errors.push("section is required");
      if (!title) errors.push("title is required");
      if (!date) errors.push("date is required");

      if (errors.length > 0) {
        rowErrors.push({ index: i, error: errors.join("; ") });
        continue;
      }

      // Enforce Exam Type validation and compulsory Exam Period resolution
      const configResult = resolveAndValidateExamConfig(structure, raw);
      if (configResult.errors && configResult.errors.length > 0) {
        rowErrors.push({ index: i, error: configResult.errors.join("; ") });
        continue;
      }

      const { validTypeDef, matchedPeriod, resolvedExamTypeCode, resolvedExamPeriodId, resolvedShift, shiftDef } = configResult;

      // Look up subject in tenant — accept by valid ObjectId OR fallback by subjectCode in this tenant
      let sub = null;
      if (mongoose.Types.ObjectId.isValid(subjectId)) {
        sub = await Subject.findOne({ _id: toObjectId(subjectId), tenantId, isActive: true }).lean();
      }
      if (!sub && subjectCode) {
        sub = await Subject.findOne({ subjectCode: String(subjectCode).trim().toUpperCase(), tenantId, isActive: true }).lean();
      }

      if (!sub) {
        rowErrors.push({
          index: i,
          error: `Subject not found in your institution (ID: "${subjectId}"${subjectCode ? `, Code: "${subjectCode}"` : ""})`,
        });
        continue;
      }

      let resolvedSubjectName = sub.subjectName;
      let resolvedSubjectCode = sub.subjectCode;
      let resolvedCourseId = sub.courseId || courseId;
      let resolvedBranch = sub.branch || branch;
      let resolvedSemester = semester !== undefined && semester !== "" && semester != null
        ? parseInt(String(semester).replace(/\D/g, ""), 10)
        : undefined;

      if (resolvedSemester === undefined && sub.semester) {
        const parsedSubSem = parseInt(String(sub.semester).replace(/\D/g, ""), 10);
        if (!isNaN(parsedSubSem)) resolvedSemester = parsedSubSem;
      }

      // Resolve courseCode → courseId if courseId not yet resolved
      if (!resolvedCourseId && courseCode) {
        const Course = require("../models/Course");
        const course = await Course.findOne({ tenantId, code: String(courseCode).toUpperCase() }).lean();
        if (course) resolvedCourseId = course._id;
      }

      let resolvedStartTime = startTime;
      let resolvedDuration = duration && !Number.isNaN(parseInt(duration)) ? parseInt(duration) : undefined;
      if (!resolvedStartTime && shiftDef) resolvedStartTime = shiftDef.startTime;
      let resolvedEndTime = endTime;

      if (!resolvedDuration && resolvedStartTime && resolvedEndTime) {
        const startM = timeToMinutes(resolvedStartTime);
        const endM = timeToMinutes(resolvedEndTime);
        if (!Number.isNaN(startM) && !Number.isNaN(endM) && endM > startM) {
          resolvedDuration = endM - startM;
        }
      }

      if (!resolvedDuration && shiftDef) {
        resolvedDuration = timeToMinutes(shiftDef.endTime) - timeToMinutes(shiftDef.startTime);
      }

      if (!resolvedDuration && validTypeDef?.defaultDuration) {
        resolvedDuration = validTypeDef.defaultDuration;
      }

      if (!resolvedEndTime && resolvedStartTime && resolvedDuration) {
        resolvedEndTime = computeEndTime(resolvedStartTime, resolvedDuration);
      }

      // Resolve maxMarks from exam type config (source of truth on create)
      let resolvedMaxMarks = maxMarks;
      if (validTypeDef?.defaultMaxMarks != null) resolvedMaxMarks = validTypeDef.defaultMaxMarks;
      if (resolvedMaxMarks == null) resolvedMaxMarks = 100;

      // Conflict check (against DB and active import batch)
      const conflicts = await findExamConflicts(tenantId, {
        section,
        semester: resolvedSemester,
        courseId: resolvedCourseId,
        branch: resolvedBranch,
        date,
        startTime: resolvedStartTime,
        endTime: resolvedEndTime,
        room,
      }, null, valid);
      if (conflicts.length > 0) {
        rowErrors.push({ index: i, error: conflicts.join("; ") });
        continue;
      }

      // Validate invigilators
      const invigIds = Array.isArray(invigilators) ? invigilators.filter(Boolean).map(toObjectId) : [];
      if (invigIds.length > 2) {
        rowErrors.push({ index: i, error: "Maximum 2 invigilators allowed" });
        continue;
      }
      if (invigIds.length > 0) {
        const invigConflicts = await findInvigilatorConflicts(
          tenantId, invigIds, date, resolvedStartTime, resolvedEndTime
        );
        if (invigConflicts.length > 0) {
          rowErrors.push({ index: i, error: invigConflicts.join("; ") });
          continue;
        }
      }

      valid.push({
        tenantId,
        subjectId: toObjectId(subjectId),
        subjectName: resolvedSubjectName || "",
        subjectCode: resolvedSubjectCode || "",
        section: String(section).toUpperCase(),
        title,
        type: resolvedExamTypeCode,
        examTypeCode: resolvedExamTypeCode,
        examPeriodId: toObjectId(resolvedExamPeriodId),
        courseId: resolvedCourseId ? toObjectId(resolvedCourseId) : undefined,
        branch: resolvedBranch || undefined,
        semester: resolvedSemester !== undefined && !isNaN(resolvedSemester) ? Number(resolvedSemester) : undefined,
        shift: resolvedShift,
        duration: resolvedDuration || undefined,
        date,
        startTime: resolvedStartTime,
        endTime: resolvedEndTime || "",
        maxMarks: Number(resolvedMaxMarks),
        passingMarks: passingMarks != null ? Number(passingMarks) : Math.round(Number(resolvedMaxMarks) * 0.4),
        room: room || "",
        description: description || "",
        createdBy: toObjectId(req.user._id),
        invigilators: invigIds,
        isBacklog: Boolean(isBacklog),
        isActive: raw.isActive !== undefined && raw.isActive !== "" ? (raw.isActive === true || raw.isActive === "true" || raw.isActive === "TRUE") : true,
      });
    }

    if (rowErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Bulk import rejected — ${rowErrors.length} row(s) have errors`,
        errors: rowErrors,
      });
    }

    const created = await Exam.insertMany(valid, { ordered: false });
    return res.status(201).json({ success: true, message: `${created.length} exams created`, data: created });
  } catch (error) {
    logger.error("Error bulk creating exams", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to bulk create exams" });
  }
};

// ─── Exam Structure (Enterprise) ───

const getExamStructure = async (req, res) => {
  try {
    const structure = await getTenantExamStructure(req.user.tenantId);
    return res.status(200).json({ success: true, data: structure });
  } catch (error) {
    logger.error("Error fetching exam structure", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to fetch exam structure" });
  }
};

const updateExamStructure = async (req, res) => {
  try {
    const { examTypes, shifts } = req.body;
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) return res.status(404).json({ success: false, message: "Tenant not found" });

    tenant.settings = tenant.settings || {};
    if (examTypes) tenant.settings.examStructure = tenant.settings.examStructure || {};
    if (examTypes) tenant.settings.examStructure.examTypes = examTypes;
    if (shifts) tenant.settings.examStructure = tenant.settings.examStructure || {};
    if (shifts) tenant.settings.examStructure.shifts = shifts;

    await tenant.save();
    const saved = [];
    if (examTypes) saved.push("exam types");
    if (shifts) saved.push("shifts");
    return res.status(200).json({ success: true, message: `Exam structure saved (${saved.join(", ")})` });
  } catch (error) {
    logger.error("Error updating exam structure", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to update exam structure" });
  }
};

// ─── Exam Periods ───

const getExamPeriods = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.user.tenantId)
      .select("settings.examPeriods")
      .lean();
    const periods = tenant?.settings?.examPeriods || [];
    return res.status(200).json({ success: true, data: periods });
  } catch (error) {
    logger.error("Error fetching exam periods", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to fetch exam periods" });
  }
};

const updateExamPeriods = async (req, res) => {
  try {
    const { examPeriods } = req.body;
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) return res.status(404).json({ success: false, message: "Tenant not found" });

    tenant.settings = tenant.settings || {};
    tenant.settings.examPeriods = examPeriods;

    await tenant.save();
    return res.status(200).json({ success: true, message: "Exam periods updated" });
  } catch (error) {
    logger.error("Error updating exam periods", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to update exam periods" });
  }
};

// ─── Teacher Exam Duty ───

const getMyDuty = async (req, res) => {
  try {
    const exams = await Exam.find({
      tenantId: req.user.tenantId,
      invigilators: req.user._id,
      isActive: true,
      status: { $ne: "completed" },
    })
      .sort({ date: -1, startTime: 1 })
      .populate("subjectId", "subjectName subjectCode")
      .populate("invigilators", "name email")
      .lean();

    return res.status(200).json({ success: true, data: exams });
  } catch (error) {
    logger.error("Error fetching exam duty", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to fetch exam duty" });
  }
};

module.exports = {
  createExam, getExams, getExamById, updateExam, deleteExam,
  submitGrades, getMyResults, getUpcomingExams, getGradeReport, getBacklogs, bulkCreateExams,
  getExamStructure, updateExamStructure, getExamPeriods, updateExamPeriods,
  getMyDuty,
  publishExamResults, unpublishExamResults, updateResult,
};
