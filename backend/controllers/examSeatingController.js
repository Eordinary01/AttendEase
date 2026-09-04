const crypto = require("crypto");
const mongoose = require("mongoose");
const ExamHall = require("../models/ExamHall");
const ExamSeatingAllocation = require("../models/ExamSeatingAllocation");
const Exam = require("../models/Exam");
const User = require("../models/User");
const Course = require("../models/Course");
const Subject = require("../models/Subject");
const Tenant = require("../models/Tenant");
const Enrollment = require("../models/Enrollment");
const logger = require("../utils/logger");

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

/**
 * Generate HMAC-SHA256 signature and QR token for an allocation
 */
function generateTicketQR(tenantId, allocation) {
  const secret = (process.env.JWT_SECRET || "attendease_secret") + "_" + String(tenantId);
  const rawPayload = {
    tenantId: String(tenantId),
    examId: String(allocation.examId),
    studentId: String(allocation.studentId),
    hallCode: allocation.hallCode,
    seatNumber: allocation.seatNumber,
    examDate: new Date(allocation.examDate).toISOString().split("T")[0],
    shift: allocation.shift,
    timestamp: Date.now(),
  };

  const payloadStr = JSON.stringify(rawPayload);
  const hash = crypto.createHmac("sha256", secret).update(payloadStr).digest("hex");
  const base64Payload = Buffer.from(payloadStr).toString("base64url");
  const qrPayload = `${base64Payload}.${hash}`;

  return { hash, qrPayload };
}

/**
 * Generate Master Admit Card QR token
 */
function generateMasterAdmitCardQR(tenantId, student, examPeriod, exams) {
  const secret = (process.env.JWT_SECRET || "attendease_secret") + "_" + String(tenantId);
  const rawPayload = {
    tenantId: String(tenantId),
    studentId: String(student._id || student.id),
    rollNo: student.rollNo || "",
    name: student.name || "",
    periodId: String(examPeriod?._id || examPeriod?.id || ""),
    periodName: examPeriod?.name || "",
    semester: student.semester || "",
    examsCount: exams?.length || 0,
    timestamp: Date.now(),
  };

  const payloadStr = JSON.stringify(rawPayload);
  const hash = crypto.createHmac("sha256", secret).update(payloadStr).digest("hex");
  const base64Payload = Buffer.from(payloadStr).toString("base64url");
  return `${base64Payload}.${hash}`;
}

/**
 * ─── EXAM HALL MANAGEMENT ───
 */

// 1. Create Exam Hall
exports.createHall = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { hallCode, name, building, floor, rows, cols, benchCapacity } = req.body;

    if (!hallCode || !name) {
      return res.status(400).json({ success: false, message: "Hall code and name are required." });
    }

    const cleanCode = hallCode.trim().toUpperCase();
    const existing = await ExamHall.findOne({ tenantId, hallCode: cleanCode });
    if (existing) {
      return res.status(409).json({ success: false, message: `Hall code '${cleanCode}' already exists.` });
    }

    const numRows = Math.max(1, parseInt(rows, 10) || 8);
    const numCols = Math.max(1, parseInt(cols, 10) || 5);
    const numBench = Math.max(1, Math.min(3, parseInt(benchCapacity, 10) || 1));
    const capacity = numRows * numCols * numBench;

    const hall = await ExamHall.create({
      tenantId,
      hallCode: cleanCode,
      name: name.trim(),
      building: building?.trim() || "Main Block",
      floor: floor?.trim() || "Ground Floor",
      rows: numRows,
      cols: numCols,
      benchCapacity: numBench,
      capacity,
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, data: hall, message: "Exam hall created successfully." });
  } catch (err) {
    logger.error("createHall error", { error: err.message });
    res.status(500).json({ success: false, message: "Failed to create exam hall." });
  }
};

// 2. Get All Exam Halls
exports.getHalls = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { isActive } = req.query;

    const filter = { tenantId };
    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    const halls = await ExamHall.find(filter).sort({ hallCode: 1 }).lean();
    res.json({ success: true, count: halls.length, data: halls });
  } catch (err) {
    logger.error("getHalls error", { error: err.message });
    res.status(500).json({ success: false, message: "Failed to fetch exam halls." });
  }
};

// 3. Update Exam Hall
exports.updateHall = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { id } = req.params;
    const { hallCode, name, building, floor, rows, cols, benchCapacity, isActive } = req.body;

    const hall = await ExamHall.findOne({ _id: id, tenantId });
    if (!hall) {
      return res.status(404).json({ success: false, message: "Exam hall not found." });
    }

    if (hallCode && hallCode.trim().toUpperCase() !== hall.hallCode) {
      const cleanCode = hallCode.trim().toUpperCase();
      const existing = await ExamHall.findOne({ tenantId, hallCode: cleanCode, _id: { $ne: id } });
      if (existing) {
        return res.status(409).json({ success: false, message: `Hall code '${cleanCode}' already in use.` });
      }
      hall.hallCode = cleanCode;
    }

    if (name) hall.name = name.trim();
    if (building) hall.building = building.trim();
    if (floor) hall.floor = floor.trim();
    if (rows !== undefined) hall.rows = Math.max(1, parseInt(rows, 10));
    if (cols !== undefined) hall.cols = Math.max(1, parseInt(cols, 10));
    if (benchCapacity !== undefined) hall.benchCapacity = Math.max(1, Math.min(3, parseInt(benchCapacity, 10)));
    if (isActive !== undefined) hall.isActive = Boolean(isActive);

    hall.capacity = hall.rows * hall.cols * hall.benchCapacity;
    await hall.save();

    res.json({ success: true, data: hall, message: "Exam hall updated successfully." });
  } catch (err) {
    logger.error("updateHall error", { error: err.message });
    res.status(500).json({ success: false, message: "Failed to update exam hall." });
  }
};

// 4. Delete / Deactivate Exam Hall
exports.deleteHall = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    // Check if hall has future allocations
    const activeAllocations = await ExamSeatingAllocation.countDocuments({
      tenantId,
      hallId: id,
      examDate: { $gte: new Date() },
    });

    if (activeAllocations > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete hall: it has ${activeAllocations} upcoming seating allocation(s). Please deallocate first or deactivate the hall.`,
      });
    }

    await ExamHall.findOneAndDelete({ _id: id, tenantId });
    res.json({ success: true, message: "Exam hall deleted successfully." });
  } catch (err) {
    logger.error("deleteHall error", { error: err.message });
    res.status(500).json({ success: false, message: "Failed to delete exam hall." });
  }
};

/**
 * ─── SCHEDULED EXAM DATES DISCOVERY ───
 */
exports.getScheduledExamDates = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const exams = await Exam.find({
      tenantId,
      status: { $ne: "cancelled" },
    })
      .select("date shift title subjectName subjectCode section branch courseId semester room")
      .sort({ date: 1, shift: 1 })
      .lean();

    const dateMap = new Map();

    exams.forEach((exam) => {
      if (!exam.date) return;
      const dateStr = new Date(exam.date).toISOString().split("T")[0];
      const shift = exam.shift || "I";
      const key = `${dateStr}__${shift}`;

      if (!dateMap.has(key)) {
        dateMap.set(key, {
          date: dateStr,
          shift,
          examsCount: 0,
          exams: [],
        });
      }

      const entry = dateMap.get(key);
      entry.examsCount++;
      entry.exams.push(exam);
    });

    const result = Array.from(dateMap.values());
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error("getScheduledExamDates error", { error: err.message });
    res.status(500).json({ success: false, message: "Failed to fetch scheduled exam dates." });
  }
};

/**
 * ─── SEATING ALLOCATION ENGINE (JUMBLE & SPLIT STRATEGY) ───
 */

exports.generateSeating = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { examDate, shift, hallIds, clearExisting = true } = req.body;

    if (!examDate || !shift || !Array.isArray(hallIds) || hallIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "examDate, shift (I-IV), and at least one hallId are required.",
      });
    }

    const dateStr = typeof examDate === "string" ? examDate.split("T")[0] : new Date(examDate).toISOString().split("T")[0];
    const startUtc = new Date(`${dateStr}T00:00:00.000Z`);
    const endUtc = new Date(`${dateStr}T23:59:59.999Z`);
    const startWindow = new Date(startUtc.getTime() - 14 * 3600 * 1000);
    const endWindow = new Date(endUtc.getTime() + 14 * 3600 * 1000);

    // 1. Fetch all scheduled exams on this Date and Shift (timezone resilient window)
    const rawScheduledExams = await Exam.find({
      tenantId,
      date: { $gte: startWindow, $lte: endWindow },
      shift: shift,
      status: { $ne: "cancelled" },
    }).lean();

    const scheduledExams = rawScheduledExams.filter((e) => {
      const eDateStr = new Date(e.date).toISOString().split("T")[0];
      return eDateStr === dateStr || (e.date >= startUtc && e.date <= endUtc);
    });

    if (scheduledExams.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No scheduled exams found for date ${dateStr} and shift ${shift}.`,
      });
    }

    // 2. Fetch selected Halls
    const halls = await ExamHall.find({
      tenantId,
      _id: { $in: hallIds },
      isActive: true,
    }).sort({ hallCode: 1 }).lean();

    if (halls.length === 0) {
      return res.status(404).json({ success: false, message: "No active exam halls found for the given IDs." });
    }

    const totalHallCapacity = halls.reduce((sum, h) => sum + (h.capacity || 0), 0);

    // 3. Gather eligible enrolled students grouped by Exam / Branch
    const groupBuckets = [];
    let totalCandidateCount = 0;

    for (const exam of scheduledExams) {
      const studentQuery = {
        tenantId,
        role: "student",
        isActive: true,
      };

      if (exam.section) {
        studentQuery.section = new RegExp(`^${exam.section.trim()}$`, "i");
      }
      if (exam.courseId) {
        studentQuery.courseId = exam.courseId;
      }
      if (exam.branch) {
        studentQuery.branch = new RegExp(`^${exam.branch.trim()}$`, "i");
      }
      if (exam.semester) {
        studentQuery.semester = exam.semester;
      }

      const students = await User.find(studentQuery)
        .select("_id name rollNo section courseId branch semester avatar")
        .sort({ rollNo: 1, name: 1 })
        .lean();

      if (students.length > 0) {
        groupBuckets.push({
          exam,
          groupKey: `${exam.courseId || ""}_${exam.branch || ""}_${exam.subjectCode || ""}`,
          students,
        });
        totalCandidateCount += students.length;
      }
    }

    if (totalCandidateCount === 0) {
      return res.status(400).json({
        success: false,
        message: "No enrolled students matched the criteria for scheduled exams in this shift.",
      });
    }

    if (totalCandidateCount > totalHallCapacity) {
      return res.status(400).json({
        success: false,
        message: `Capacity deficit: Total registered candidates (${totalCandidateCount}) exceed selected halls capacity (${totalHallCapacity}). Please select additional exam halls.`,
        requiredSeats: totalCandidateCount,
        availableSeats: totalHallCapacity,
      });
    }

    // 4. JUMBLE & SPLIT INTERLEAVING ALGORITHM
    // Sort groups by size descending to interleave smoothly
    groupBuckets.sort((a, b) => b.students.length - a.students.length);

    // Build interleaved student stream
    const candidateStream = [];
    let hasMore = true;
    let studentIndex = 0;

    while (hasMore) {
      hasMore = false;
      for (const group of groupBuckets) {
        if (studentIndex < group.students.length) {
          candidateStream.push({
            student: group.students[studentIndex],
            exam: group.exam,
          });
          hasMore = true;
        }
      }
      studentIndex++;
    }

    // 5. Allocate students to Halls (Row × Col × BenchPosition)
    const allocationsToSave = [];
    let streamPtr = 0;

    for (const hall of halls) {
      if (streamPtr >= candidateStream.length) break;

      const numRows = hall.rows || 8;
      const numCols = hall.cols || 5;
      const numBench = hall.benchCapacity || 1;

      for (let r = 1; r <= numRows; r++) {
        for (let c = 1; c <= numCols; c++) {
          for (let b = 1; b <= numBench; b++) {
            if (streamPtr >= candidateStream.length) break;

            const item = candidateStream[streamPtr++];
            const seatLabel = `${hall.hallCode}-R${r}C${c}${numBench > 1 ? `-${b}` : ""}`;

            const allocDoc = {
              tenantId,
              examId: item.exam._id,
              examPeriodId: item.exam.examPeriodId,
              shift: item.exam.shift || shift,
              examDate: startOfDay,
              startTime: item.exam.startTime || "",
              endTime: item.exam.endTime || "",
              hallId: hall._id,
              hallCode: hall.hallCode,
              hallName: hall.name,
              seatNumber: seatLabel,
              row: r,
              col: c,
              benchPosition: b,
              studentId: item.student._id,
              studentName: item.student.name,
              studentRollNo: item.student.rollNo || "",
              courseId: item.student.courseId,
              branch: item.student.branch || item.exam.branch || "",
              semester: item.student.semester || item.exam.semester,
              section: item.student.section || item.exam.section,
              subjectId: item.exam.subjectId,
              subjectCode: item.exam.subjectCode,
              subjectName: item.exam.subjectName,
              attendanceStatus: "pending",
              createdBy: req.user._id,
            };

            const { hash, qrPayload } = generateTicketQR(tenantId, allocDoc);
            allocDoc.ticketHash = hash;
            allocDoc.qrPayload = qrPayload;

            allocationsToSave.push(allocDoc);
          }
        }
      }
    }

    // 6. Clear existing allocations for this Date & Shift if requested
    if (clearExisting) {
      const examIds = scheduledExams.map((e) => e._id);
      await ExamSeatingAllocation.deleteMany({
        tenantId,
        examId: { $in: examIds },
        shift: shift,
        examDate: { $gte: startOfDay, $lte: endOfDay },
      });
    }

    // 7. Bulk Insert Allocations
    const inserted = await ExamSeatingAllocation.insertMany(allocationsToSave);

    res.status(201).json({
      success: true,
      message: `Successfully generated anti-cheating seating arrangement for ${inserted.length} candidates across ${halls.length} exam hall(s).`,
      summary: {
        totalAllocated: inserted.length,
        hallsUsed: halls.length,
        examsIncluded: scheduledExams.length,
        shift,
        date: examDate,
      },
      data: inserted,
    });
  } catch (err) {
    logger.error("generateSeating error", { error: err.message });
    res.status(500).json({ success: false, message: "Failed to generate seating allocation.", error: err.message });
  }
};

/**
 * ─── ALLOCATIONS & ROOM CHARTS ───
 */

// 1. Get Allocations with filtering
exports.getAllocations = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { examId, examDate, shift, hallId, studentId, attendanceStatus } = req.query;

    const filter = { tenantId };
    if (examId) filter.examId = examId;
    if (hallId) filter.hallId = hallId;
    if (studentId) filter.studentId = studentId;
    if (shift) filter.shift = shift;
    if (attendanceStatus) filter.attendanceStatus = attendanceStatus;

    if (examDate) {
      const dStr = typeof examDate === "string" ? examDate.split("T")[0] : new Date(examDate).toISOString().split("T")[0];
      const startUtc = new Date(`${dStr}T00:00:00.000Z`);
      const endUtc = new Date(`${dStr}T23:59:59.999Z`);
      filter.examDate = {
        $gte: new Date(startUtc.getTime() - 14 * 3600 * 1000),
        $lte: new Date(endUtc.getTime() + 14 * 3600 * 1000),
      };
    }

    const rawAllocations = await ExamSeatingAllocation.find(filter)
      .sort({ hallCode: 1, row: 1, col: 1, benchPosition: 1 })
      .lean();

    const allocations = examDate
      ? rawAllocations.filter((a) => {
          const aDateStr = new Date(a.examDate).toISOString().split("T")[0];
          const targetStr = typeof examDate === "string" ? examDate.split("T")[0] : new Date(examDate).toISOString().split("T")[0];
          return aDateStr === targetStr;
        })
      : rawAllocations;

    res.json({ success: true, count: allocations.length, data: allocations });
  } catch (err) {
    logger.error("getAllocations error", { error: err.message });
    res.status(500).json({ success: false, message: "Failed to fetch seating allocations." });
  }
};

// 2. Get Room Seating Chart Matrix (for door notice / visual grid)
exports.getHallChart = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { hallId } = req.params;
    const { examDate, shift } = req.query;

    if (!hallId || !examDate || !shift) {
      return res.status(400).json({ success: false, message: "hallId, examDate, and shift are required." });
    }

    const hall = await ExamHall.findOne({ _id: hallId, tenantId }).lean();
    if (!hall) {
      return res.status(404).json({ success: false, message: "Exam hall not found." });
    }

    const dStr = typeof examDate === "string" ? examDate.split("T")[0] : new Date(examDate).toISOString().split("T")[0];
    const startUtc = new Date(`${dStr}T00:00:00.000Z`);
    const endUtc = new Date(`${dStr}T23:59:59.999Z`);

    const rawAllocations = await ExamSeatingAllocation.find({
      tenantId,
      hallId,
      shift,
      examDate: {
        $gte: new Date(startUtc.getTime() - 14 * 3600 * 1000),
        $lte: new Date(endUtc.getTime() + 14 * 3600 * 1000),
      },
    }).lean();

    const allocations = rawAllocations.filter((a) => {
      const aDateStr = new Date(a.examDate).toISOString().split("T")[0];
      return aDateStr === dStr;
    });

    // Construct 2D Matrix for rendering
    const grid = [];
    const allocMap = new Map();
    allocations.forEach((a) => {
      allocMap.set(`${a.row}_${a.col}_${a.benchPosition || 1}`, a);
    });

    for (let r = 1; r <= hall.rows; r++) {
      const rowList = [];
      for (let c = 1; c <= hall.cols; c++) {
        const benches = [];
        for (let b = 1; b <= hall.benchCapacity; b++) {
          const alloc = allocMap.get(`${r}_${c}_${b}`) || null;
          benches.push({
            seatNumber: `${hall.hallCode}-R${r}C${c}${hall.benchCapacity > 1 ? `-${b}` : ""}`,
            row: r,
            col: c,
            benchPosition: b,
            allocation: alloc,
            isOccupied: Boolean(alloc),
          });
        }
        rowList.push(benches);
      }
      grid.push(rowList);
    }

    res.json({
      success: true,
      data: {
        hall,
        shift,
        examDate,
        totalAllocated: allocations.length,
        grid,
      },
    });
  } catch (err) {
    logger.error("getHallChart error", { error: err.message });
    res.status(500).json({ success: false, message: "Failed to generate hall chart." });
  }
};

/**
 * ─── STUDENT ADMIT CARD / HALL TICKET ───
 */

exports.getMyHallTicket = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

    // 1. Resolve Target Student ID (support staff previewing, parents viewing child, students viewing self)
    let targetStudentId = req.user._id;
    if (["admin", "super_admin", "teacher"].includes(req.user.role) && req.query.studentId) {
      targetStudentId = req.query.studentId;
    } else if (req.user.role === "parent" || req.user.accessMode === "parent") {
      const enr = await Enrollment.findOne({
        tenantId,
        $or: [
          ...(req.user.studentId ? [{ userId: req.user.studentId }] : []),
          ...(req.user.email ? [{ parentEmail: req.user.email.toLowerCase().trim() }] : []),
          ...(req.user.phone ? [{ parentPhone: req.user.phone.trim() }] : []),
        ],
      }).lean();
      if (enr?.userId) {
        targetStudentId = enr.userId;
      }
    }

    // 2. Fetch student profile & enrollment
    const studentUser = await User.findOne({ _id: targetStudentId, tenantId })
      .select("name rollNo section courseId branch semester email avatar phone")
      .lean();

    if (!studentUser) {
      return res.status(404).json({ success: false, message: "Student profile not found." });
    }

    const enrollment = await Enrollment.findOne({
      tenantId,
      $or: [
        { userId: studentUser._id },
        ...(studentUser.email ? [{ email: studentUser.email.toLowerCase().trim() }] : []),
        ...(studentUser.rollNo ? [{ enrollmentNumber: studentUser.rollNo.trim() }, { rollNo: studentUser.rollNo.trim() }] : []),
      ],
    }).lean();

    const studentCourseId = studentUser.courseId || enrollment?.courseId || null;
    const studentBranch = String(studentUser.branch || enrollment?.branch || "").trim();
    const studentSemester = studentUser.semester || enrollment?.semester || null;
    const studentSection = String(studentUser.section || enrollment?.section || "A").trim().toUpperCase();

    let courseName = "";
    if (studentCourseId) {
      const course = await Course.findById(studentCourseId).select("name code courseName courseCode").lean();
      if (course) {
        courseName = course.name || course.courseName || course.code || "";
        if (course.code && !courseName.includes(course.code)) {
          courseName = `${courseName} (${course.code})`;
        }
      }
    }

    const student = {
      ...studentUser,
      courseId: studentCourseId,
      courseName: courseName || "Undergraduate Program",
      branch: studentBranch || "General",
      semester: studentSemester,
      section: studentSection,
      enrollmentNumber: enrollment?.enrollmentNumber || studentUser.rollNo || "N/A",
    };

    // 3. Fetch all Exam Periods from Tenant Settings & Tenant Branding
    const tenant = await Tenant.findById(tenantId)
      .select("name subdomain domain branding settings.examPeriods settings.examStructure")
      .lean();

    const institutionName = tenant?.branding?.institutionName || tenant?.name || "ACADEMIC EXAMINATION AUTHORITY";
    const institutionLogo = tenant?.branding?.logo || null;
    const institution = {
      name: institutionName,
      logo: institutionLogo,
      subdomain: tenant?.subdomain || "",
    };

    // Filter out completed exam periods (i.e. where endDate has passed)
    const nowMs = Date.now();
    const isPeriodCompleted = (p) => {
      if (!p.endDate) return false;
      const end = new Date(p.endDate);
      end.setHours(23, 59, 59, 999);
      return end.getTime() < nowMs;
    };

    const rawPeriods = (tenant?.settings?.examPeriods || []).filter((p) => p.isActive !== false && !isPeriodCompleted(p));

    if (rawPeriods.length === 0) {
      return res.json({
        success: false,
        code: "NO_ACTIVE_PERIODS",
        message: "No active or upcoming examination periods are currently open. Completed examination periods have been closed.",
        data: {
          student,
          institution,
          examPeriod: null,
          availablePeriods: [],
          examsCount: 0,
          allocations: [],
          canDownload: false,
        },
      });
    }

    // 4. Enrich Periods with Scheduled Exams count for this student's semester & branch
    const enrichedPeriods = await Promise.all(
      rawPeriods.map(async (p) => {
        const periodExams = await Exam.find({
          tenantId,
          examPeriodId: p._id,
          status: { $ne: "cancelled" },
          ...(studentSemester ? { semester: studentSemester } : {}),
        }).lean();

        const matchedExams = periodExams.filter((e) => {
          const courseMatch = !studentCourseId || !e.courseId || String(e.courseId) === String(studentCourseId);
          const branchMatch = isBranchMatch(e.branch, studentBranch);
          return courseMatch && branchMatch;
        });

        return {
          _id: p._id,
          id: p._id,
          name: p.name,
          examTypeCode: p.examTypeCode || "",
          startDate: p.startDate,
          endDate: p.endDate,
          isActive: p.isActive,
          examsCount: matchedExams.length,
          hasExams: matchedExams.length > 0,
        };
      })
    );

    // 5. Resolve Selected Exam Period
    const requestedPeriodId = req.query.examPeriodId;
    let selectedPeriod = null;

    if (requestedPeriodId) {
      selectedPeriod = enrichedPeriods.find((p) => String(p._id) === String(requestedPeriodId)) || null;
    }

    if (!selectedPeriod) {
      // Prioritize the first period that has exams scheduled, or first active period
      selectedPeriod = enrichedPeriods.find((p) => p.hasExams) || enrichedPeriods[0];
    }

    // 6. Check if Admin has created exams for this Exam Period
    const examsInPeriod = await Exam.find({
      tenantId,
      examPeriodId: selectedPeriod._id,
      status: { $ne: "cancelled" },
      ...(studentSemester ? { semester: studentSemester } : {}),
    }).sort({ date: 1, shift: 1, startTime: 1 }).lean();

    const matchingExams = examsInPeriod.filter((e) => {
      const courseMatch = !studentCourseId || !e.courseId || String(e.courseId) === String(studentCourseId);
      const branchMatch = isBranchMatch(e.branch, studentBranch);
      return courseMatch && branchMatch;
    });

    // GATE: If NO exams have been created for this exam period for student's semester & branch
    if (matchingExams.length === 0) {
      return res.json({
        success: false,
        code: "EXAMS_NOT_CREATED",
        message: `No examinations have been scheduled for "${selectedPeriod.name}"${studentSemester ? ` (Semester ${studentSemester})` : ""} yet. The Admit Card cannot be generated or downloaded until exams are scheduled by the administration.`,
        data: {
          student,
          institution,
          examPeriod: selectedPeriod,
          availablePeriods: enrichedPeriods,
          examsCount: 0,
          allocations: [],
          canDownload: false,
        },
      });
    }

    // 7. Fetch Seating Allocations for this Student in this Exam Period
    const existingAllocations = await ExamSeatingAllocation.find({
      tenantId,
      studentId: studentUser._id,
      examPeriodId: selectedPeriod._id,
    }).lean();

    const allocMapByExamId = new Map();
    const allocMapBySubjCode = new Map();

    existingAllocations.forEach((a) => {
      if (a.examId) allocMapByExamId.set(String(a.examId), a);
      if (a.subjectCode) allocMapBySubjCode.set(String(a.subjectCode).toUpperCase(), a);
    });

    // 8. Build Complete Exam Schedule Rows for the Admit Card
    const enrichedAllocations = matchingExams.map((exam) => {
      const alloc = allocMapByExamId.get(String(exam._id)) || allocMapBySubjCode.get(String(exam.subjectCode).toUpperCase());
      const hallCode = alloc?.hallCode || exam.room || "TBA";
      const hallName = alloc?.hallName || (exam.room ? `Room ${exam.room}` : "Examination Venue");
      const seatNumber = alloc?.seatNumber || (alloc ? "Allocated" : "Assigned at Venue");

      const ticketQR = alloc?.qrPayload || generateTicketQR(tenantId, {
        examId: exam._id,
        studentId: studentUser._id,
        hallCode,
        seatNumber,
        examDate: exam.date,
        shift: exam.shift || "I",
      }).qrPayload;

      return {
        _id: alloc?._id || exam._id,
        examId: exam._id,
        examDate: exam.date,
        shift: exam.shift || "I",
        startTime: exam.startTime || "",
        endTime: exam.endTime || "",
        subjectId: exam.subjectId,
        subjectCode: exam.subjectCode,
        subjectName: exam.subjectName,
        hallId: alloc?.hallId || null,
        hallCode,
        hallName,
        seatNumber,
        attendanceStatus: alloc?.attendanceStatus || "scheduled",
        qrPayload: ticketQR,
      };
    });

    // Master Admit Card QR
    const masterTicketQR = generateMasterAdmitCardQR(tenantId, student, selectedPeriod, enrichedAllocations);

    return res.json({
      success: true,
      canDownload: true,
      data: {
        student,
        institution,
        examPeriod: selectedPeriod,
        availablePeriods: enrichedPeriods,
        examsCount: enrichedAllocations.length,
        allocations: enrichedAllocations,
        qrPayload: masterTicketQR,
        instructions: [
          "Candidate must carry this Admit Card along with their official Student Identity Card to the exam hall.",
          "Candidates must occupy their assigned seats 15 minutes before the commencement of the examination.",
          "Electronic devices, smartwatches, and programmable calculators are strictly prohibited inside the hall.",
          "Tampering with the cryptographic QR code on this ticket is a punishable offense under institutional academic integrity policies.",
        ],
      },
    });
  } catch (err) {
    logger.error("getMyHallTicket error", { error: err.message });
    return res.status(500).json({ success: false, message: "Failed to fetch student admit card." });
  }
};

/**
 * ─── INVIGILATOR QR SCANNER & 1-TAP CHECK-IN ───
 */

exports.verifyTicket = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { qrToken, targetHallId, autoCheckIn = true } = req.body;

    if (!qrToken || typeof qrToken !== "string") {
      return res.status(400).json({ success: false, message: "QR token is required." });
    }

    const parts = qrToken.split(".");
    if (parts.length !== 2) {
      return res.status(400).json({ success: false, message: "Malformed or invalid QR code format." });
    }

    const [base64Payload, providedSignature] = parts;
    const payloadStr = Buffer.from(base64Payload, "base64url").toString("utf-8");

    let payload;
    try {
      payload = JSON.parse(payloadStr);
    } catch {
      return res.status(400).json({ success: false, message: "Invalid payload JSON encoding in QR code." });
    }

    // Cryptographic HMAC-SHA256 signature verification
    const secret = (process.env.JWT_SECRET || "attendease_secret") + "_" + String(tenantId);
    const expectedSignature = crypto.createHmac("sha256", secret).update(payloadStr).digest("hex");

    if (providedSignature !== expectedSignature) {
      logger.warn("Admit Card QR signature mismatch (Tamper attempt)", {
        tenantId,
        studentId: payload?.studentId,
        provided: providedSignature,
      });
      return res.status(403).json({
        success: false,
        message: "⛔ Cryptographic signature verification failed! The Admit Card QR code has been tampered with or is invalid.",
        code: "SIGNATURE_MISMATCH",
      });
    }

    // Find the allocation in database
    const allocation = await ExamSeatingAllocation.findOne({
      tenantId,
      examId: payload.examId,
      studentId: payload.studentId,
      examDate: new Date(payload.examDate),
      shift: payload.shift,
    });

    if (!allocation) {
      return res.status(404).json({
        success: false,
        message: "No seating allocation record matches this QR token in the current institution.",
      });
    }

    // Check hall match
    let hallMismatch = false;
    let hallMismatchMessage = "";
    if (targetHallId && String(allocation.hallId) !== String(targetHallId)) {
      hallMismatch = true;
      hallMismatchMessage = `⚠️ Student is allocated to ${allocation.hallCode} (${allocation.hallName || "Exam Hall"}), not this room!`;
    }

    // Auto check-in if valid
    if (autoCheckIn && !hallMismatch) {
      allocation.attendanceStatus = "present";
      allocation.checkedInAt = new Date();
      allocation.checkedInBy = req.user._id;
      allocation.checkInMethod = "qr_scan";
      await allocation.save();
    }

    // Fetch student photo & profile for visual confirmation
    const studentUser = await User.findById(allocation.studentId)
      .select("name rollNo avatar email section branch semester")
      .lean();

    res.json({
      success: true,
      verified: true,
      hallMismatch,
      hallMismatchMessage,
      data: {
        allocation,
        student: studentUser,
      },
      message: hallMismatch
        ? hallMismatchMessage
        : `✅ Identity verified! ${allocation.studentName} checked in to Seat ${allocation.seatNumber}.`,
    });
  } catch (err) {
    logger.error("verifyTicket error", { error: err.message });
    res.status(500).json({ success: false, message: "Failed to verify Admit Card QR code." });
  }
};

// 2. Manual Check-in / Status update by Invigilator
exports.manualCheckIn = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { allocationId } = req.params;
    const { status, remarks } = req.body;

    if (!status || !["pending", "present", "absent", "malpractice"].includes(status)) {
      return res.status(400).json({ success: false, message: "Valid status ('pending', 'present', 'absent', 'malpractice') is required." });
    }

    const allocation = await ExamSeatingAllocation.findOne({ _id: allocationId, tenantId });
    if (!allocation) {
      return res.status(404).json({ success: false, message: "Seating allocation record not found." });
    }

    allocation.attendanceStatus = status;
    allocation.remarks = remarks || allocation.remarks || "";
    if (status === "present") {
      allocation.checkedInAt = new Date();
      allocation.checkedInBy = req.user._id;
      allocation.checkInMethod = "manual";
    }

    await allocation.save();

    res.json({
      success: true,
      data: allocation,
      message: `Status for ${allocation.studentName} updated to ${status}.`,
    });
  } catch (err) {
    logger.error("manualCheckIn error", { error: err.message });
    res.status(500).json({ success: false, message: "Failed to update attendance status." });
  }
};

/**
 * 3. Bulk Import Seating Allocations from Excel / CSV
 */
exports.importSeatingAllocations = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { rows, clearExisting = false } = req.body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: "An array of seating rows is required for import." });
    }

    const halls = await ExamHall.find({ tenantId, isActive: true }).lean();
    const hallMapByCode = new Map(halls.map((h) => [h.hallCode.toUpperCase(), h]));

    const rollNumbers = rows.map((r) => String(r.rollNo || r.studentRollNo || "").trim().toUpperCase()).filter(Boolean);
    const students = await User.find({
      tenantId,
      role: "student",
      rollNo: { $in: rollNumbers },
    }).lean();
    const studentMapByRoll = new Map(students.map((s) => [s.rollNo.toUpperCase(), s]));

    const exams = await Exam.find({ tenantId, status: { $ne: "cancelled" } }).lean();

    const createdAllocations = [];
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rollNo = String(row.rollNo || row.studentRollNo || "").trim().toUpperCase();
      const hallCode = String(row.hallCode || "").trim().toUpperCase();
      const seatNumber = String(row.seatNumber || "").trim().toUpperCase();
      const rawDate = row.examDate || row.date;
      const shift = String(row.shift || "I").trim();
      const subjectCode = String(row.subjectCode || "").trim().toUpperCase();

      if (!rollNo || !hallCode || !seatNumber || !rawDate) {
        errors.push(`Row ${i + 1}: Missing required fields (rollNo, hallCode, seatNumber, examDate).`);
        continue;
      }

      const hall = hallMapByCode.get(hallCode);
      if (!hall) {
        errors.push(`Row ${i + 1}: Hall code "${hallCode}" does not exist.`);
        continue;
      }

      const student = studentMapByRoll.get(rollNo);
      if (!student) {
        errors.push(`Row ${i + 1}: Student with Roll No "${rollNo}" not found.`);
        continue;
      }

      const dateStr = typeof rawDate === "string" ? rawDate.split("T")[0] : new Date(rawDate).toISOString().split("T")[0];
      const examDateObj = new Date(dateStr);

      const matchedExam = exams.find((e) => {
        const eDateStr = new Date(e.date).toISOString().split("T")[0];
        const matchDate = eDateStr === dateStr;
        const matchShift = String(e.shift || "I") === shift;
        const matchSubject = !subjectCode || String(e.subjectCode || "").toUpperCase() === subjectCode;
        const matchSec = !e.section || !student.section || String(e.section).toUpperCase() === String(student.section).toUpperCase();
        return matchDate && matchShift && matchSubject && matchSec;
      }) || exams.find((e) => {
        const eDateStr = new Date(e.date).toISOString().split("T")[0];
        return eDateStr === dateStr && String(e.shift || "I") === shift;
      });

      let rowNum = parseInt(row.row) || 1;
      let colNum = parseInt(row.col) || 1;
      const seatMatch = seatNumber.match(/R(\d+)C(\d+)/i);
      if (seatMatch) {
        rowNum = parseInt(seatMatch[1], 10);
        colNum = parseInt(seatMatch[2], 10);
      }

      const rawAlloc = {
        tenantId,
        examPeriodId: matchedExam?.examPeriodId,
        examId: matchedExam?._id,
        studentId: student._id,
        studentName: student.name,
        studentRollNo: student.rollNo,
        courseId: student.courseId || matchedExam?.courseId,
        branch: student.branch || matchedExam?.branch,
        semester: student.semester || matchedExam?.semester || 1,
        section: student.section || matchedExam?.section || "A",
        examDate: examDateObj,
        shift,
        subjectId: matchedExam?.subjectId,
        subjectCode: matchedExam?.subjectCode || subjectCode,
        subjectName: matchedExam?.subjectName || "Examination Paper",
        hallId: hall._id,
        hallCode: hall.hallCode,
        hallName: hall.name,
        seatNumber,
        row: rowNum,
        col: colNum,
        benchPosition: 1,
        attendanceStatus: "pending",
      };

      const { hash, qrPayload } = generateTicketQR(tenantId, rawAlloc);

      createdAllocations.push({
        ...rawAlloc,
        ticketHash: hash,
        qrPayload,
      });
    }

    if (errors.length > 0 && createdAllocations.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Failed to import seating allocations due to validation errors.",
        errors,
      });
    }

    if (clearExisting && createdAllocations.length > 0) {
      const firstAlloc = createdAllocations[0];
      await ExamSeatingAllocation.deleteMany({
        tenantId,
        examDate: firstAlloc.examDate,
        shift: firstAlloc.shift,
      });
    }

    const bulkOps = createdAllocations.map((alloc) => ({
      updateOne: {
        filter: {
          tenantId,
          examDate: alloc.examDate,
          shift: alloc.shift,
          seatNumber: alloc.seatNumber,
          hallId: alloc.hallId,
        },
        update: { $set: alloc },
        upsert: true,
      },
    }));

    await ExamSeatingAllocation.bulkWrite(bulkOps);

    res.json({
      success: true,
      message: `Successfully imported ${createdAllocations.length} seating allocation(s).`,
      importedCount: createdAllocations.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    logger.error("importSeatingAllocations error", { error: err.message });
    res.status(500).json({ success: false, message: "Failed to import seating allocations.", error: err.message });
  }
};
