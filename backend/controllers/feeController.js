const mongoose = require("mongoose");
const Fee = require("../models/Fee");
const Transaction = require("../models/Transaction");
const User = require("../models/User");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const Tenant = require("../models/Tenant");
const logger = require("../utils/logger");
const { getCurrentAcademicYearSemesters, buildSemesterTimeline, getSemesterDeadline } = require("../utils/semesterUtils");
const { getNextSequence } = require("../utils/counter");

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
  if (!b1 || !b2) return true;
  const u1 = String(b1).trim().toUpperCase();
  const u2 = String(b2).trim().toUpperCase();
  if (u1 === u2) return true;
  const list1 = BRANCH_ALIASES[u1] || [u1];
  const list2 = BRANCH_ALIASES[u2] || [u2];
  return list1.includes(u2) || list2.includes(u1) || list1.some(a => list2.includes(a));
};

const generateReceiptNumber = async (tenantId) => {
  return getNextSequence(tenantId, 'RCP');
};

const createFee = async (req, res) => {
  try {
    const { fees } = req.body;

    if (!Array.isArray(fees) || fees.length === 0) {
      return res.status(400).json({ success: false, message: "Fees array is required" });
    }

    // Collect unique studentIds needing resolution
    const needResolve = fees.filter(f => f.studentId && (!f.courseId || !f.branch || !f.semester));
    const studentIds = [...new Set(needResolve.map(f => String(f.studentId)))];
    let studentMap = new Map();
    if (studentIds.length > 0) {
      const students = await User.find({ _id: { $in: studentIds.map(id => new mongoose.Types.ObjectId(id)) } })
        .select("courseId courseName branch semester section").lean();
      students.forEach(s => studentMap.set(String(s._id), s));
    }

    // Collect unique courseIds needing fee structure lookup
    const needCourseFee = fees.filter(f => f.courseId && (!f.amount || f.amount <= 0) && f.feeType === "tuition");
    const courseIds = [...new Set([
      ...needCourseFee.map(f => String(f.courseId)),
      ...[...studentMap.values()].filter(s => s.courseId).map(s => String(s.courseId)),
    ])];
    let courseMap = new Map();
    if (courseIds.length > 0) {
      const courses = await Course.find({ _id: { $in: courseIds.map(id => new mongoose.Types.ObjectId(id)) } })
        .select("branches.feeStructure feeStructure semestersPerYear durationYears").lean();
      courses.forEach(c => courseMap.set(String(c._id), c));
    }

    const enriched = fees.map(f => {
      const student = studentMap.get(String(f.studentId));
      const courseId = f.courseId || student?.courseId || null;
      const branch = (f.branch || student?.branch || "").toUpperCase().trim();
      const semester = f.semester || student?.semester || undefined;
      const section = (f.section || student?.section || "").toUpperCase().trim();

      // Auto-derive amount from course fee structure if tuition and amount missing
      let amount = f.amount;
      if (courseId && (!amount || amount <= 0) && f.feeType === "tuition") {
        const course = courseMap.get(String(courseId));
        if (course) {
          const semestersPerYear = course.semestersPerYear || 2;
          const totalSemesters = (course.durationYears || 4) * semestersPerYear;
          // Branch-level fee takes priority
          if (branch && course.branches) {
            const branchObj = course.branches.find(b =>
              String(b.code || "").toUpperCase() === branch ||
              String(b.name || "").toUpperCase() === branch
            );
            if (branchObj?.feeStructure?.enabled && branchObj.feeStructure.totalFee > 0) {
              amount = branchObj.feeStructure.totalFee / totalSemesters;
            }
          }
          // Fall back to course-level fee
          if ((!amount || amount <= 0) && course.feeStructure?.enabled && course.feeStructure.totalFee > 0) {
            amount = course.feeStructure.totalFee / totalSemesters;
          }
        }
      }

      return {
        ...f,
        tenantId: req.user.tenantId,
        createdBy: req.user._id,
        dueDate: new Date(f.dueDate),
        courseId: courseId || undefined,
        branch: branch || undefined,
        section: section || undefined,
        semester: semester || undefined,
        amount: amount ? parseFloat(Number(amount).toFixed(2)) : f.amount,
      };
    });

    const created = await Fee.insertMany(enriched);
    return res.status(201).json({ success: true, data: created, count: created.length });
  } catch (error) {
    logger.error("Error creating fees", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to create fees" });
  }
};

const getFees = async (req, res) => {
  try {
    const { studentId, status, feeType, section, courseId, branch, dueBefore, dueAfter } = req.query;
    const filter = { tenantId: req.user.tenantId, isActive: true };

    if (studentId) filter.studentId = studentId;
    if (status) filter.status = status;
    if (feeType) filter.feeType = feeType;
    if (courseId) filter.courseId = courseId;
    if (branch) {
      const bUpper = String(branch).trim().toUpperCase();
      const validBranches = BRANCH_ALIASES[bUpper] || [bUpper];
      const branchRegexes = validBranches.map(b => new RegExp(`^${b}$`, "i"));
      filter.$or = [
        { branch: { $in: branchRegexes } },
        { section: { $in: branchRegexes } },
      ];
    }
    if (dueBefore) filter.dueDate = { ...filter.dueDate, $lte: new Date(dueBefore) };
    if (dueAfter) filter.dueDate = { ...filter.dueDate, $gte: new Date(dueAfter) };

    let fees = await Fee.find(filter)
      .populate("studentId", "name email rollNo section branch courseId courseName")
      .populate("courseId", "name code durationYears semestersPerYear")
      .sort({ dueDate: -1 })
      .lean();

    // Auto-apply late fees for overdue unpaid records
    const tenant = await Tenant.findOne({ _id: req.user.tenantId }).select("lateFeePerDay").lean();
    const lateFeePerDay = tenant?.lateFeePerDay ?? 1000;
    const now = new Date();
    const bulkUpdates = [];

    for (const fee of fees) {
      if (fee.status === "paid" || fee.status === "waived") continue;
      const dueDate = new Date(fee.dueDate);
      if (now > dueDate) {
        const daysOverdue = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
        const expectedLateFee = daysOverdue * lateFeePerDay;
        if (fee.lateFee !== expectedLateFee) {
          bulkUpdates.push({
            updateOne: { filter: { _id: fee._id }, update: { $set: { lateFee: expectedLateFee } } }
          });
          fee.lateFee = expectedLateFee;
        }
        if (fee.status !== "overdue" && fee.status !== "partial") {
          bulkUpdates.push({
            updateOne: { filter: { _id: fee._id }, update: { $set: { status: "overdue" } } }
          });
          fee.status = "overdue";
        }
      }
    }

    if (bulkUpdates.length > 0) {
      Fee.bulkWrite(bulkUpdates).catch(err => logger.error("Error updating late fees", { error: err.message }));
    }

    if (section && !branch) {
      fees = fees.filter(f => f.studentId?.section === section.toUpperCase());
    }

    return res.status(200).json({ success: true, data: fees });
  } catch (error) {
    logger.error("Error fetching fees", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to fetch fees" });
  }
};

const getFeeById = async (req, res) => {
  try {
    const fee = await Fee.findOne({ _id: req.params.id, tenantId: req.user.tenantId })
      .populate("studentId", "name email rollNo section")
      .lean();

    if (!fee) return res.status(404).json({ success: false, message: "Fee record not found" });

    const transactions = await Transaction.find({ feeId: fee._id, tenantId: req.user.tenantId })
      .populate("collectedBy", "name")
      .sort({ transactionDate: -1 })
      .lean();

    return res.status(200).json({ success: true, data: { fee, transactions } });
  } catch (error) {
    logger.error("Error fetching fee", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to fetch fee record" });
  }
};

const updateFee = async (req, res) => {
  try {
    const fee = await Fee.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!fee) return res.status(404).json({ success: false, message: "Fee record not found" });

    const { amount, feeType, dueDate, description, lateFee, academicYear, term } = req.body;
    if (amount !== undefined) fee.amount = amount;
    if (feeType !== undefined) fee.feeType = feeType;
    if (dueDate !== undefined) fee.dueDate = dueDate;
    if (description !== undefined) fee.description = description;
    if (lateFee !== undefined) fee.lateFee = lateFee;
    if (academicYear !== undefined) fee.academicYear = academicYear;
    if (term !== undefined) fee.term = term;

    await fee.save();
    return res.status(200).json({ success: true, data: fee });
  } catch (error) {
    logger.error("Error updating fee", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to update fee" });
  }
};

const deleteFee = async (req, res) => {
  try {
    const fee = await Fee.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!fee) return res.status(404).json({ success: false, message: "Fee record not found" });

    fee.isActive = false;
    await fee.save();

    return res.status(200).json({ success: true, message: "Fee record deleted" });
  } catch (error) {
    logger.error("Error deleting fee", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to delete fee" });
  }
};

const waiveFee = async (req, res) => {
  try {
    const fee = await Fee.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!fee) return res.status(404).json({ success: false, message: "Fee record not found" });

    fee.status = "waived";
    fee.paidAmount = fee.amount;
    await fee.save();

    return res.status(200).json({ success: true, data: fee, message: "Fee waived successfully" });
  } catch (error) {
    logger.error("Error waiving fee", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to waive fee" });
  }
};

const collectPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, mode, notes } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Valid amount is required" });
    }

    if (!mode) {
      return res.status(400).json({ success: false, message: "Payment mode is required" });
    }

    const fee = await Fee.findOne({ _id: id, tenantId: req.user.tenantId });
    if (!fee) return res.status(404).json({ success: false, message: "Fee record not found" });

    if (fee.status === "paid" || fee.status === "waived") {
      return res.status(400).json({ success: false, message: "Fee is already paid/waived" });
    }

    const receiptNumber = await generateReceiptNumber(req.user.tenantId);

    const transaction = await Transaction.create({
      tenantId: req.user.tenantId,
      feeId: fee._id,
      studentId: fee.studentId,
      amount,
      mode,
      receiptNumber,
      collectedBy: req.user._id,
      notes: notes || "",
      status: "completed",
    });

    const newPaid = fee.paidAmount + amount;
    const overpaid = newPaid > fee.amount;

    fee.paidAmount = overpaid ? fee.amount : newPaid;

    if (fee.paidAmount >= fee.amount) {
      fee.status = "paid";
    } else if (fee.paidAmount > 0) {
      fee.status = "partial";
    }

    await fee.save();

    if (overpaid) {
      const excess = newPaid - fee.amount;
      return res.status(200).json({
        success: true,
        data: { transaction, fee },
        message: `Payment collected. Note: ${excess} excess amount recorded as overpayment.`,
      });
    }

    return res.status(201).json({ success: true, data: { transaction, fee } });
  } catch (error) {
    logger.error("Error collecting payment", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to collect payment" });
  }
};

const getTransactions = async (req, res) => {
  try {
    const { studentId, mode, feeId, from, to } = req.query;
    const filter = { tenantId: req.user.tenantId };

    if (studentId) filter.studentId = studentId;
    if (mode) filter.mode = mode;
    if (feeId) filter.feeId = feeId;
    if (from || to) {
      filter.transactionDate = {};
      if (from) filter.transactionDate.$gte = new Date(from);
      if (to) filter.transactionDate.$lte = new Date(to);
    }

    const transactions = await Transaction.find(filter)
      .populate("studentId", "name email rollNo section")
      .populate("collectedBy", "name")
      .populate("feeId", "amount feeType dueDate")
      .sort({ transactionDate: -1 })
      .lean();

    return res.status(200).json({ success: true, data: transactions });
  } catch (error) {
    logger.error("Error fetching transactions", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to fetch transactions" });
  }
};

const getDefaulters = async (req, res) => {
  try {
    const { section } = req.query;
    const now = new Date();

    const filter = {
      tenantId: req.user.tenantId,
      isActive: true,
      status: { $in: ["pending", "partial", "overdue"] },
      dueDate: { $lt: now },
    };

    let fees = await Fee.find(filter)
      .populate("studentId", "name email rollNo section")
      .sort({ dueDate: 1 })
      .lean();

    if (section) {
      fees = fees.filter(f => f.studentId?.section === section.toUpperCase());
    }

    const grouped = {};
    fees.forEach(f => {
      const sid = f.studentId?._id?.toString() || "unknown";
      if (!grouped[sid]) {
        grouped[sid] = {
          student: f.studentId,
          totalDue: 0,
          totalPaid: 0,
          overdueCount: 0,
          fees: [],
        };
      }
      grouped[sid].totalDue += f.amount;
      grouped[sid].totalPaid += f.paidAmount;
      grouped[sid].overdueCount += 1;
      grouped[sid].fees.push(f);
    });

    return res.status(200).json({ success: true, data: Object.values(grouped) });
  } catch (error) {
    logger.error("Error fetching defaulters", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to fetch defaulters" });
  }
};

const getFeeSummary = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

    const [
      totalFees,
      totalCollected,
      totalPending,
      totalWaived,
      overdueCount,
      paidCount,
      pendingCount,
      partialCount,
    ] = await Promise.all([
      Fee.aggregate([{ $match: { tenantId: new mongoose.Types.ObjectId(tenantId), isActive: true } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      Fee.aggregate([{ $match: { tenantId: new mongoose.Types.ObjectId(tenantId), isActive: true } }, { $group: { _id: null, total: { $sum: "$paidAmount" } } }]),
      Fee.aggregate([{ $match: { tenantId: new mongoose.Types.ObjectId(tenantId), isActive: true, status: { $nin: ["paid", "waived"] } } }, { $group: { _id: null, total: { $sum: { $subtract: ["$amount", "$paidAmount"] } } } }]),
      Fee.aggregate([{ $match: { tenantId: new mongoose.Types.ObjectId(tenantId), isActive: true, status: "waived" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      Fee.countDocuments({ tenantId, isActive: true, status: { $in: ["pending", "partial"] }, dueDate: { $lt: new Date() } }),
      Fee.countDocuments({ tenantId, isActive: true, status: "paid" }),
      Fee.countDocuments({ tenantId, isActive: true, status: "pending" }),
      Fee.countDocuments({ tenantId, isActive: true, status: "partial" }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        totalFees: totalFees[0]?.total || 0,
        totalCollected: totalCollected[0]?.total || 0,
        totalPending: totalPending[0]?.total || 0,
        totalWaived: totalWaived[0]?.total || 0,
        overdueCount,
        paidCount,
        pendingCount,
        partialCount,
      },
    });
  } catch (error) {
    logger.error("Error fetching fee summary", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to fetch fee summary" });
  }
};

const getMyFees = async (req, res) => {
  try {
    const { semester } = req.query;
    const tenantId = req.user.tenantId;

    // Resolve student IDs (User._id and linked Enrollment._id)
    const studentIds = [req.user._id];
    let courseId = req.user.courseId || null;
    let branch = req.user.branch || "";

    const enrollment = await Enrollment.findOne({
      $or: [
        { userId: req.user._id },
        ...(req.user.email ? [{ email: req.user.email.toLowerCase() }] : []),
      ],
      tenantId,
    }).lean();

    if (enrollment) {
      if (enrollment._id && !studentIds.some((id) => id.toString() === enrollment._id.toString())) {
        studentIds.push(enrollment._id);
      }
      courseId = courseId || enrollment.courseId || null;
      branch = branch || enrollment.branch || "";
    }

    const filter = { tenantId, studentId: { $in: studentIds }, isActive: true };
    if (semester) filter.semester = parseInt(semester, 10);

    const fees = await Fee.find(filter)
      .populate("courseId", "name code durationYears semestersPerYear branches")
      .sort({ semester: 1, dueDate: -1 })
      .lean();

    // Auto-apply late fees
    const tenant = await Tenant.findOne({ _id: tenantId }).select("lateFeePerDay settings.semesterStructure").lean();
    const lateFeePerDay = tenant?.lateFeePerDay ?? 1000;
    const now = new Date();
    const bulkUpdates = [];

    for (const fee of fees) {
      if (fee.status === "paid" || fee.status === "waived") continue;
      const dueDate = new Date(fee.dueDate);
      if (now > dueDate) {
        const daysOverdue = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
        const expectedLateFee = daysOverdue * lateFeePerDay;
        if (fee.lateFee !== expectedLateFee) {
          bulkUpdates.push({ updateOne: { filter: { _id: fee._id }, update: { $set: { lateFee: expectedLateFee } } } });
          fee.lateFee = expectedLateFee;
        }
        if (fee.status !== "overdue" && fee.status !== "partial") {
          bulkUpdates.push({ updateOne: { filter: { _id: fee._id }, update: { $set: { status: "overdue" } } } });
          fee.status = "overdue";
        }
      }
    }
    if (bulkUpdates.length > 0) Fee.bulkWrite(bulkUpdates).catch(() => {});

    const feeIds = fees.map(f => f._id);
    const transactions = await Transaction.find({ feeId: { $in: feeIds }, tenantId })
      .populate("collectedBy", "name")
      .populate("feeId", "semester feeType description amount")
      .sort({ transactionDate: -1 })
      .lean();

    // Resolve student course & totalSemesters
    let studentCourse = fees[0]?.courseId || null;
    if (!studentCourse && courseId) {
      studentCourse = await Course.findOne({ _id: courseId, tenantId }).lean();
    }

    const semestersPerYear = tenant?.settings?.semesterStructure?.semestersPerYear || studentCourse?.semestersPerYear || 2;
    
    let totalSemesters = 6;
    if (studentCourse) {
      const branchUpper = (branch || "").trim().toUpperCase();
      const branchDef = Array.isArray(studentCourse.branches)
        ? studentCourse.branches.find(
            (b) =>
              (b.name || "").trim().toUpperCase() === branchUpper ||
              (b.code || "").trim().toUpperCase() === branchUpper
          )
        : null;

      totalSemesters = branchDef?.totalSemesters || ((studentCourse.durationYears || 3) * semestersPerYear);
    }

    const currentSemester = parseInt(String(req.user.semester || enrollment?.semester || "1").replace(/\D/g, ""), 10) || 1;

    const enrichedFees = fees.map(f => {
      const sem = f.semester || 1;
      const isOdd = sem % 2 !== 0;
      const isCurrentSemester = sem === currentSemester;
      const isUpcomingSemester = sem > currentSemester;
      const isPastSemester = sem < currentSemester;
      const windowLabel = isOdd ? "July – December" : "January – June";
      const deadlineLabel = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(f.dueDate));

      return {
        ...f,
        isCurrentSemester,
        isUpcomingSemester,
        isPastSemester,
        windowLabel,
        deadlineLabel,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        fees: enrichedFees,
        transactions,
        currentSemester,
        totalSemesters,
        semestersPerYear,
        courseName: studentCourse?.name || "",
        branch: branch || "",
      },
    });
  } catch (error) {
    logger.error("Error fetching my fees", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to fetch fees" });
  }
};

const generateCourseFees = async (req, res) => {
  try {
    const { courseId, section, dueDate, academicYear } = req.body;

    if (!courseId || !section) {
      return res.status(400).json({ success: false, message: "courseId and section are required" });
    }

    const course = await Course.findOne({ _id: courseId, tenantId: req.user.tenantId, isActive: true }).lean();
    if (!course) return res.status(404).json({ success: false, message: "Course not found" });

    // Resolve branch definition from course
    const sectionUpper = String(section).trim().toUpperCase();
    const branchDef = (course.branches || []).find(
      b => String(b.code || "").toUpperCase() === sectionUpper || String(b.name || "").toUpperCase() === sectionUpper
    );
    const branchCode = branchDef?.code || sectionUpper;
    const branchName = branchDef ? branchDef.name : section;

    // Branch specific fee overrides general course fee structure
    const branchFee = (branchDef?.feeStructure?.enabled && Number(branchDef?.feeStructure?.totalFee) > 0)
      ? Number(branchDef.feeStructure.totalFee)
      : (Number(branchDef?.totalFee) > 0 ? Number(branchDef.totalFee) : null);

    const effectiveTotalFee = branchFee !== null
      ? branchFee
      : (course.feeStructure?.enabled ? Number(course.feeStructure.totalFee) || 0 : 0);

    if (!effectiveTotalFee || effectiveTotalFee <= 0) {
      return res.status(400).json({ success: false, message: "Fee structure not enabled or configured for this course/branch" });
    }

    // Wire to tenant's semester structure (Default July start: academicStartMonth = 6)
    const tenant = await Tenant.findOne({ _id: req.user.tenantId }).select("settings.semesterStructure").lean();
    const semestersPerYear = tenant?.settings?.semesterStructure?.semestersPerYear || 2;
    const academicStartMonth = tenant?.settings?.semesterStructure?.academicStartMonth ?? 6;
    const totalSemesters = branchDef?.totalSemesters || (course.durationYears * semestersPerYear);
    const amountPerSemester = Math.round((effectiveTotalFee / totalSemesters) * 100) / 100;

    // Get current academic year semesters using shared utility
    const { currentYearNumber, semesters: currentYearSemesters } = getCurrentAcademicYearSemesters({
      semestersPerYear,
      durationYears: course.durationYears,
      academicStartMonth,
    });
    const semNumbers = currentYearSemesters.map(s => s.semester);

    // Bi-directional branch alias matching for students
    const validBranches = BRANCH_ALIASES[branchCode] || BRANCH_ALIASES[branchName.toUpperCase()] || [branchCode, branchName.toUpperCase()];
    const branchRegexes = validBranches.map(b => new RegExp(`^${b}$`, "i"));

    // Find students via Enrollment AND direct User collection
    const [enrollments, directUsers] = await Promise.all([
      Enrollment.find({
        tenantId: req.user.tenantId,
        courseId,
        branch: { $in: branchRegexes },
        enrollmentStatus: "active",
      }).select("userId").lean(),
      User.find({
        tenantId: req.user.tenantId,
        role: "student",
        courseId,
        branch: { $in: branchRegexes },
        isActive: true,
      }).select("_id").lean(),
    ]);

    const studentIdSet = new Set([
      ...enrollments.map(e => e.userId ? String(e.userId) : null).filter(id => id && id !== "undefined" && id !== "null"),
      ...directUsers.map(u => String(u._id)),
    ]);
    const studentIds = Array.from(studentIdSet);

    if (studentIds.length === 0) {
      return res.status(400).json({ success: false, message: `No active students found in course "${course.name}" for branch "${branchCode}"` });
    }

    // Build full timeline to get semester start/end dates for due dates
    const fullTimeline = buildSemesterTimeline({
      semestersPerYear,
      durationYears: course.durationYears,
      academicStartMonth,
    });
    const dueDateOverride = dueDate ? new Date(dueDate) : null;
    const now = new Date();
    const currentCalendarYear = now.getFullYear();

    // Build fee records ONLY for current academic year semesters
    const feeRecords = [];
    let skipped = 0;
    for (const sem of semNumbers) {
      const semInfo = fullTimeline.find(t => t.semester === sem) || null;
      // Academic deadline calculated directly from tenant's configured academic structure
      const standardDeadline = getSemesterDeadline(sem, {
        semestersPerYear,
        academicStartMonth,
        durationYears: course.durationYears,
        anchorYear: currentCalendarYear,
      });
      const feeDueDate = dueDateOverride || (semInfo ? semInfo.endDate : standardDeadline);

      // Check per-student duplicates
      const existing = await Fee.find({
        tenantId: req.user.tenantId,
        courseId,
        $or: [
          { section: sectionUpper },
          { branch: branchCode },
          { branch: { $in: branchRegexes } },
        ],
        semester: sem,
        feeType: "tuition",
        isActive: true,
      }).select("studentId").lean();
      const existingIds = new Set(existing.map(f => String(f.studentId)));

      for (const studentId of studentIds) {
        if (existingIds.has(String(studentId))) { skipped++; continue; }
        feeRecords.push({
          tenantId: req.user.tenantId,
          studentId,
          courseId,
          section: sectionUpper,
          branch: branchCode,
          semester: sem,
          feeType: "tuition",
          amount: amountPerSemester,
          paidAmount: 0,
          dueDate: feeDueDate,
          description: `${course.name} (${branchCode}) - Semester ${sem} Tuition Fee`,
          status: "pending",
          academicYear: semInfo?.academicYear || academicYear || "",
          createdBy: req.user._id,
        });
      }
    }

    if (feeRecords.length === 0) {
      return res.status(400).json({ success: false, message: `Fee records already exist for Academic Year ${currentYearNumber} (semesters ${semNumbers.join(", ")})` });
    }

    const created = await Fee.insertMany(feeRecords);
    return res.status(201).json({
      success: true,
      message: `Generated ${created.length} fee(s) for ${course.name} - Branch ${branchCode} — Academic Year ${currentYearNumber} (Semesters ${semNumbers.join(", ")})`,
      count: created.length,
      skipped,
      amountPerSemester,
    });
  } catch (error) {
    logger.error("Error generating course fees", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to generate course fees" });
  }
};

module.exports = {
  createFee, getFees, getFeeById, updateFee, deleteFee,
  waiveFee, collectPayment, getTransactions, getDefaulters,
  getFeeSummary, getMyFees, generateCourseFees,
};
