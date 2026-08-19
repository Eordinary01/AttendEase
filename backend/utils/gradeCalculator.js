const ExamResult = require("../models/ExamResult");
const Subject = require("../models/Subject");
const Exam = require("../models/Exam");

const PASS_PERCENTAGE = 40;

function calculateGrade(percentage) {
  if (percentage >= 90) return "A+";
  if (percentage >= 80) return "A";
  if (percentage >= 70) return "B+";
  if (percentage >= 60) return "B";
  if (percentage >= 50) return "C+";
  if (percentage >= 40) return "C";
  if (percentage >= 33) return "D";
  return "F";
}

// Standard 10-point grade point scale, aligned with the 40% pass threshold.
function gradePoints(percentage) {
  if (percentage >= 90) return 10;
  if (percentage >= 80) return 9;
  if (percentage >= 70) return 8;
  if (percentage >= 60) return 7;
  if (percentage >= 50) return 6;
  if (percentage >= 40) return 5;
  return 0;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

const SUBJECT_SELECT = "subjectId subjectName subjectCode semester examTypeCode type date maxMarks resultStatus isBacklog section shift";

/**
 * Compute the full grade picture for a single student:
 * per-subject status (passed / back / cleared), per-semester SGPA, overall CGPA.
 *
 * Hierarchy:
 *  - A subject is a BACK when its aggregate (published results) is below 40%.
 *  - A BACK is cleared only after a published supplementary/backlog exam (isBacklog)
 *    for that subject yields >= 40%. The backlog exam result replaces the failed one.
 *  - A semester containing any uncleared BACK has its SGPA blocked (awaiting clearance).
 *  - CGPA is hidden until every BACK across all semesters is cleared.
 *
 * @param {string} studentId
 * @param {string} tenantId
 */
async function computeStudentGrades(studentId, tenantId) {
  const results = await ExamResult.find({ studentId, tenantId })
    .populate({ path: "examId", select: SUBJECT_SELECT })
    .sort({ createdAt: 1 })
    .lean();

  const published = results.filter(r => r.examId?.resultStatus === "published");

  // Group published results by subject.
  const groups = {};
  published.forEach(r => {
    const exam = r.examId;
    const key = String(exam.subjectId || exam.subjectCode || exam.subjectName);
    if (!groups[key]) {
      groups[key] = { subjectId: exam.subjectId, subjectName: exam.subjectName, subjectCode: exam.subjectCode, semester: exam.semester, regular: [], backlog: [] };
    }
    if (exam.isBacklog) groups[key].backlog.push(r);
    else groups[key].regular.push(r);
  });

  // Fetch credits for the subjects involved.
  const subjectIds = Object.values(groups).map(g => g.subjectId).filter(Boolean);
  const subjectDocs = subjectIds.length > 0
    ? await Subject.find({ _id: { $in: subjectIds } }).select("credits subjectCode subjectName").lean()
    : [];
  const creditMap = new Map(subjectDocs.map(s => [String(s._id), Number(s.credits) || 0]));

  const subjects = [];
  const backlogs = [];
  let hasUnclearedBack = false;

  Object.values(groups).forEach(g => {
    const credits = g.subjectId ? (creditMap.get(String(g.subjectId)) || 0) : 0;

    let status;
    let percentage;
    let totalMarks;
    let obtainedMarks;
    let effectiveExam = null;
    let isClearedByBack = false;

    if (g.backlog.length > 0) {
      // Latest published backlog attempt replaces the failed regular attempt.
      const backAttempt = g.backlog[g.backlog.length - 1];
      percentage = backAttempt.maxMarks > 0 ? (backAttempt.marksObtained / backAttempt.maxMarks) * 100 : 0;
      status = percentage >= PASS_PERCENTAGE ? "cleared" : "back";
      totalMarks = backAttempt.maxMarks;
      obtainedMarks = backAttempt.marksObtained;
      effectiveExam = backAttempt;
      isClearedByBack = status === "cleared";
    } else {
      totalMarks = g.regular.reduce((acc, r) => acc + r.maxMarks, 0);
      obtainedMarks = g.regular.reduce((acc, r) => acc + r.marksObtained, 0);
      percentage = totalMarks > 0 ? (obtainedMarks / totalMarks) * 100 : 0;
      status = percentage >= PASS_PERCENTAGE ? "passed" : "back";
    }

    const roundedPercentage = Math.round(percentage * 10) / 10;
    const subject = {
      subjectId: g.subjectId,
      subjectName: g.subjectName,
      subjectCode: g.subjectCode || "",
      semester: g.semester,
      credits,
      status,
      isClearedByBack,
      aggregate: roundedPercentage,
      totalMarks,
      obtainedMarks,
      grade: calculateGrade(percentage),
      gradePoints: status === "back" ? 0 : gradePoints(percentage),
      exams: (effectiveExam ? [effectiveExam] : g.regular).map(r => ({
        type: r.examId.type,
        examTypeCode: r.examId.examTypeCode,
        date: r.examId.date,
        shift: r.examId.shift,
        marksObtained: r.marksObtained,
        maxMarks: r.maxMarks,
        grade: r.grade,
        percentage: r.percentage,
        isBacklog: r.examId.isBacklog,
      })),
    };

    subjects.push(subject);

    if (status === "back") {
      hasUnclearedBack = true;
      backlogs.push(subject);
    }
  });

  // Per-semester SGPA.
  const semesterMap = {};
  subjects.forEach(s => {
    const key = String(s.semester ?? "1");
    if (!semesterMap[key]) semesterMap[key] = { semester: s.semester, subjects: [], hasBack: false };
    semesterMap[key].subjects.push(s);
    if (s.status === "back") semesterMap[key].hasBack = true;
  });

  const semesters = Object.values(semesterMap).map(sem => {
    const countCredits = sem.subjects.reduce((acc, s) => acc + s.credits, 0);
    const gradeSum = sem.subjects.reduce((acc, s) => acc + s.gradePoints * s.credits, 0);
    return {
      semester: sem.semester,
      hasBack: sem.hasBack,
      sgpa: sem.hasBack || countCredits === 0 ? null : round2(gradeSum / countCredits),
      subjects: sem.subjects,
    };
  }).sort((a, b) => (Number(a.semester) || 0) - (Number(b.semester) || 0));

  // CGPA is hidden until every back is cleared.
  let cgpa = null;
  if (!hasUnclearedBack) {
    const totalCredits = subjects.reduce((acc, s) => acc + s.credits, 0);
    const gradeSum = subjects.reduce((acc, s) => acc + s.gradePoints * s.credits, 0);
    if (totalCredits > 0) cgpa = round2(gradeSum / totalCredits);
  }

  return {
    subjects,
    semesters,
    cgpa,
    hasBack: hasUnclearedBack,
    backlogs,
  };
}

/**
 * Compute students with active (uncleared) BACKs for a section/semester.
 * Used by admins/teachers to identify who needs to clear a subject.
 */
async function computeSectionBacklogs(tenantId, { section, semester }) {
  const results = await ExamResult.find({ tenantId })
    .populate({ path: "examId", select: SUBJECT_SELECT })
    .populate({ path: "studentId", select: "name rollNo section semester" })
    .lean();

  const published = results.filter(r => r.examId?.resultStatus === "published");

  // Group by student -> subject.
  const studentMap = {};
  published.forEach(r => {
    const st = r.studentId;
    if (!st) return;
    if (section && String(st.section).toUpperCase() !== String(section).toUpperCase()) return;
    if (semester && r.examId.semester != null && Number(r.examId.semester) !== Number(semester)) return;

    const key = String(st._id);
    if (!studentMap[key]) studentMap[key] = { student: st, subjects: {} };
    const skey = String(r.examId.subjectId || r.examId.subjectCode || r.examId.subjectName);
    if (!studentMap[key].subjects[skey]) {
      studentMap[key].subjects[skey] = { subjectId: r.examId.subjectId, subjectName: r.examId.subjectName, subjectCode: r.examId.subjectCode, semester: r.examId.semester, regular: [], backlog: [] };
    }
    if (r.examId.isBacklog) studentMap[key].subjects[skey].backlog.push(r);
    else studentMap[key].subjects[skey].regular.push(r);
  });

  const rows = [];
  Object.values(studentMap).forEach(({ student, subjects }) => {
    Object.values(subjects).forEach(sub => {
      const hasBackAttempt = sub.backlog.length > 0;
      const percentage = hasBackAttempt
        ? (sub.backlog[sub.backlog.length - 1].marksObtained / sub.backlog[sub.backlog.length - 1].maxMarks) * 100
        : (sub.regular.reduce((a, r) => a + r.marksObtained, 0) / sub.regular.reduce((a, r) => a + r.maxMarks, 0)) * 100;
      if (percentage >= PASS_PERCENTAGE) return;

      rows.push({
        studentId: student._id,
        name: student.name,
        rollNo: student.rollNo,
        section: student.section,
        subjectId: sub.subjectId,
        subjectName: sub.subjectName,
        subjectCode: sub.subjectCode,
        semester: sub.semester,
        percentage: Math.round(percentage * 10) / 10,
        hasBackAttempt,
      });
    });
  });

  rows.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  return rows;
}

module.exports = {
  PASS_PERCENTAGE,
  calculateGrade,
  gradePoints,
  computeStudentGrades,
  computeSectionBacklogs,
};
