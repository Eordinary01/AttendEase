const mongoose = require("mongoose");
const Attendance = require("../models/Attendance");
const User = require("../models/User");
const logger = require("../utils/logger");
const { getTodayISODateString } = require("../utils/dateFormatter");

const getTeacherSectionFilter = (user) => {
  if (user.role !== "teacher") return null;
  const sections = [...new Set((user.assignedSubjects || []).map(a => a.section).filter(Boolean))];
  return sections.length ? { $in: sections } : { $in: [] };
};

const buildReport = async (req) => {
  const { section, fromDate, toDate, subjectId, courseId, branch, semester } = req.query;
  const tenantId = req.user.tenantId;
  const sectionFilter = getTeacherSectionFilter(req.user);

  let targetCourseId = courseId;
  let targetBranch = branch;
  let targetSemester = semester;

  if (subjectId) {
    const Subject = mongoose.model("Subject");
    const sub = await Subject.findById(subjectId).lean();
    if (sub) {
      if (!targetCourseId && sub.courseId) targetCourseId = sub.courseId;
      if (!targetBranch && sub.branch) targetBranch = sub.branch;
      if (!targetSemester && sub.semester) targetSemester = sub.semester;
    }
  }

  const studentQuery = { tenantId, role: "student", isActive: true };
  if (section) studentQuery.section = section.toUpperCase();
  else if (sectionFilter) studentQuery.section = sectionFilter;

  if (targetCourseId) {
    studentQuery.courseId = new mongoose.Types.ObjectId(targetCourseId);
  }
  if (targetBranch) {
    studentQuery.branch = new RegExp(`^${targetBranch.trim()}$`, "i");
  }

  const students = await User.find(studentQuery).select("name email section rollNo").sort({ section: 1, name: 1 }).lean();

  const dateFilter = {};
  if (fromDate) dateFilter.$gte = new Date(fromDate);
  if (toDate) dateFilter.$lte = new Date(new Date(toDate).getTime() + 24 * 60 * 60 * 1000);

  const attendanceMatch = { tenantId: new mongoose.Types.ObjectId(tenantId) };
  if (Object.keys(dateFilter).length) attendanceMatch.date = dateFilter;
  if (subjectId) attendanceMatch.subjectId = new mongoose.Types.ObjectId(subjectId);

  const subjectLookup = await Attendance.aggregate([
    { $match: attendanceMatch },
    { $group: { _id: "$subjectId", subjectName: { $first: "$subjectName" }, subjectCode: { $first: "$subjectCode" }, section: { $first: "$section" } } },
  ]);
  const subjects = subjectLookup.filter(s => s._id);

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

  const recordMap = new Map(records.map(r => [String(r._id), r]));

  const rows = students.map(s => {
    const r = recordMap.get(String(s._id)) || { totalClasses: 0, presentCount: 0, absentCount: 0, leaveCount: 0 };
    const percentage = r.totalClasses > 0 ? Number(((r.presentCount / r.totalClasses) * 100).toFixed(2)) : 0;
    
    // Phase 9 Deficit Trajectory Math
    const projectedClasses = Math.max(r.totalClasses, 60);
    const remainingClasses = Math.max(0, projectedClasses - r.totalClasses);
    let classesRequired = 0;
    let isMathematicallyImpossible = false;

    if (r.totalClasses > 0 && percentage < 75) {
      // Consecutive classes needed to reach >= 75% attendance:
      const rawRequired = Math.ceil((0.75 * r.totalClasses - r.presentCount) / 0.25);
      classesRequired = Math.max(0, rawRequired);

      // Minimum classes to achieve 75% by semester end:
      const minClassesToPassSemester = Math.ceil(0.75 * projectedClasses - r.presentCount);

      if (minClassesToPassSemester > remainingClasses || (r.presentCount + remainingClasses) < (0.75 * projectedClasses)) {
        isMathematicallyImpossible = true;
      }
    }

    let riskLevel = "good";
    if (r.totalClasses === 0) {
      riskLevel = "no-data";
    } else if (isMathematicallyImpossible) {
      riskLevel = "critical";
    } else if (percentage >= 75) {
      riskLevel = "good";
    } else if (percentage >= 65) {
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
    } else if (riskLevel === "critical") {
      alertMessage = "🔴 CRITICAL: Attendance is severely low. Immediate intervention required.";
    } else {
      alertMessage = "No attendance data recorded yet.";
    }

    return {
      id: s._id,
      name: s.name,
      email: s.email,
      rollNo: s.rollNo,
      section: s.section,
      totalClasses: r.totalClasses,
      presentCount: r.presentCount,
      absentCount: r.absentCount,
      leaveCount: r.leaveCount,
      percentage,
      status: riskLevel,
      riskLevel,
      projectedClasses,
      remainingClasses,
      classesRequired,
      isMathematicallyImpossible,
      alertMessage,
    };
  });

  const summary = rows.reduce((acc, r) => {
    acc.totalStudents++;
    acc.totalClasses += r.totalClasses;
    acc.totalPresent += r.presentCount;
    if (r.riskLevel === "good") acc.goodCount++;
    else if (r.riskLevel === "warning") acc.warningCount++;
    else if (r.riskLevel === "critical") acc.criticalCount++;
    else acc.noDataCount++;
    if (r.isMathematicallyImpossible) acc.impossibleCount++;
    return acc;
  }, { totalStudents: 0, totalClasses: 0, totalPresent: 0, goodCount: 0, warningCount: 0, criticalCount: 0, impossibleCount: 0, noDataCount: 0 });
  summary.averageAttendance = summary.totalClasses > 0 ? Number(((summary.totalPresent / summary.totalClasses) * 100).toFixed(2)) : 0;

  return { rows, summary, subjects, filters: { section: section || null, fromDate: fromDate || null, toDate: toDate || null, subjectId: subjectId || null } };
};

const getAttendanceReport = async (req, res) => {
  try {
    const report = await buildReport(req);
    return res.status(200).json({ success: true, data: report });
  } catch (error) {
    logger.error("Error generating attendance report", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to generate attendance report" });
  }
};

const exportAttendanceReport = async (req, res) => {
  try {
    const report = await buildReport(req);
    const header = "Name,Email,Roll No,Section,Total Classes,Present,Absent,Leave,Percentage,Status";
    const lines = report.rows.map(r => [
      `"${r.name}"`,
      `"${r.email}"`,
      `"${r.rollNo}"`,
      `"${r.section}"`,
      r.totalClasses,
      r.presentCount,
      r.absentCount,
      r.leaveCount,
      r.percentage,
      `"${r.status}"`,
    ].join(","));
    const csv = [header, ...lines].join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="attendance-report-${getTodayISODateString()}.csv"`);
    return res.status(200).send(csv);
  } catch (error) {
    logger.error("Error exporting attendance report", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to export attendance report" });
  }
};

module.exports = { getAttendanceReport, exportAttendanceReport };
