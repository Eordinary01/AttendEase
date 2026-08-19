const mongoose = require("mongoose");
const User = require("../models/User");
const Enrollment = require("../models/Enrollment");
const Attendance = require("../models/Attendance");
const Subject = require("../models/Subject");
const Course = require("../models/Course");
const logger = require("../utils/logger");

/**
 * Helper to collect all valid IDs for a student (User._id and Enrollment._id)
 * to ensure compatibility with bi-directional student references.
 */
async function getStudentIdList(studentUser, tenantId) {
  if (!studentUser) return [];
  const ids = [studentUser._id];
  try {
    const enrollments = await Enrollment.find({
      $or: [
        { userId: studentUser._id },
        { email: (studentUser.email || "").toLowerCase() },
        ...(studentUser.rollNo ? [{ enrollmentNumber: studentUser.rollNo }] : []),
      ],
      tenantId,
    }).select("_id").lean();

    enrollments.forEach((e) => {
      if (e._id && !ids.some((id) => id.toString() === e._id.toString())) {
        ids.push(e._id);
      }
    });
  } catch (err) {
    logger.warn("Error getting enrollment IDs for student", { error: err.message });
  }
  return ids;
}

/**
 * Resolve student's subjects from tenant curriculum (matching course, branch, semester)
 * and attach assigned teachers for their section.
 */
const resolveStudentSubjects = async (studentId, tenantId) => {
  const [student, enrollment] = await Promise.all([
    User.findById(studentId).lean(),
    Enrollment.findOne({ userId: studentId, tenantId }).lean(),
  ]);

  if (!student && !enrollment) return { section: null, subjects: [] };

  const section = String(enrollment?.section || student?.section || "").trim().toUpperCase();
  const studentCourseId = (student?.courseId || enrollment?.courseId)?.toString();
  const rawStudentBranch = student?.branch || enrollment?.branch || "";
  const studentBranch = String(rawStudentBranch).trim().toLowerCase();
  const studentSemester = String(student?.semester || enrollment?.semester || "").trim();

  // Find all active curriculum subjects for this tenant and course
  const subjectQuery = {
    tenantId,
    isActive: true,
  };
  if (studentCourseId) {
    subjectQuery.courseId = studentCourseId;
  }

  const allTenantSubjects = await Subject.find(subjectQuery).lean();

  // Pre-fetch course details for branch code <-> name resolution
  const branchCodeToName = new Map();
  const branchNameToCode = new Map();
  if (studentCourseId) {
    const courseDoc = await Course.findById(studentCourseId).lean();
    if (courseDoc && Array.isArray(courseDoc.branches)) {
      courseDoc.branches.forEach((b) => {
        if (b.code && b.name) {
          branchCodeToName.set(String(b.code).trim().toLowerCase(), String(b.name).trim().toLowerCase());
          branchNameToCode.set(String(b.name).trim().toLowerCase(), String(b.code).trim().toLowerCase());
        }
      });
    }
  }

  const matchesBranch = (subjBranch) => {
    if (!subjBranch || !studentBranch) return true;
    const normalizedSubj = String(subjBranch).trim().toLowerCase();
    if (normalizedSubj === studentBranch) return true;
    const mappedName = branchCodeToName.get(normalizedSubj);
    if (mappedName && mappedName === studentBranch) return true;
    const mappedCode = branchNameToCode.get(normalizedSubj);
    if (mappedCode && mappedCode === studentBranch) return true;
    return false;
  };

  const matchesSemester = (subjSem) => {
    if (!subjSem || !studentSemester) return true;
    const normSubjSem = String(subjSem).trim().toLowerCase();
    const normStudentSem = String(studentSemester).trim().toLowerCase();
    if (normSubjSem === normStudentSem) return true;
    const subjNum = normSubjSem.match(/\d+/)?.[0];
    const studentNum = normStudentSem.match(/\d+/)?.[0];
    if (subjNum && studentNum && subjNum === studentNum) return true;
    return false;
  };

  const studentCurriculumSubjects = allTenantSubjects.filter((s) => {
    return matchesBranch(s.branch) && matchesSemester(s.semester);
  });

  // Find assigned teachers for student's section
  let teacherMap = new Map();
  if (section) {
    const sectionRegex = new RegExp(`^${section}$`, "i");
    const teachersForSection = await User.find({
      role: "teacher",
      tenantId,
      "assignedSubjects.section": sectionRegex,
    }).populate("assignedSubjects.subjectId").lean();

    teachersForSection.forEach((teacher) => {
      (teacher.assignedSubjects || []).forEach((assignment) => {
        if (
          assignment.section &&
          assignment.section.trim().toUpperCase() === section &&
          assignment.subjectId
        ) {
          const sId = assignment.subjectId._id
            ? assignment.subjectId._id.toString()
            : assignment.subjectId.toString();
          teacherMap.set(sId, {
            id: teacher._id,
            name: teacher.name,
            email: teacher.email,
            phone: teacher.phone,
          });
        }
      });
    });
  }

  const subjects = studentCurriculumSubjects.map((subject) => {
    const teacher = teacherMap.get(subject._id.toString()) || null;
    return {
      id: subject._id,
      name: subject.subjectName,
      code: subject.subjectCode,
      section: section,
      teacherId: teacher?.id || null,
      teacherName: teacher?.name || null,
      teacherEmail: teacher?.email || null,
      teacherPhone: teacher?.phone || null,
      semester: subject.semester,
      branch: subject.branch,
      credits: subject.credits,
    };
  });

  return { section, subjects };
};

const getDashboard = async (req, res) => {
  try {
    const studentId = req.user._id;
    const tenantId = req.user.tenantId;

    const student = await User.findById(studentId)
      .select("name email rollNo section phone parentName parentPhone courseId courseName branch semester")
      .lean();

    if (!student) {
      return res.status(404).json({ success: false, message: "Student record not found" });
    }

    const studentIds = await getStudentIdList(student, tenantId);
    const objStudentIds = studentIds.map((id) => new mongoose.Types.ObjectId(id));
    const objTenantId = new mongoose.Types.ObjectId(tenantId);

    const [attendanceData, { subjects }] = await Promise.all([
      Attendance.aggregate([
        { $match: { studentId: { $in: objStudentIds }, tenantId: objTenantId } },
        {
          $group: {
            _id: null,
            totalClasses: { $sum: 1 },
            presentCount: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
            absentCount: { $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] } },
            leaveCount: { $sum: { $cond: [{ $eq: ["$status", "leave"] }, 1, 0] } },
          },
        },
      ]),
      resolveStudentSubjects(studentId, tenantId),
    ]);

    const overall = attendanceData[0] || { totalClasses: 0, presentCount: 0, absentCount: 0, leaveCount: 0 };
    const percentage = overall.totalClasses > 0 ? ((overall.presentCount / overall.totalClasses) * 100).toFixed(1) : 0;

    return res.status(200).json({
      success: true,
      data: {
        student: {
          name: student.name,
          email: student.email,
          rollNo: student.rollNo,
          section: student.section,
          courseName: student.courseName,
          branch: student.branch,
          semester: student.semester,
        },
        attendance: {
          totalClasses: overall.totalClasses,
          presentCount: overall.presentCount,
          absentCount: overall.absentCount,
          leaveCount: overall.leaveCount,
          percentage: parseFloat(percentage),
        },
        subjects: subjects.map((s) => ({
          id: s.id,
          name: s.name,
          code: s.code,
          section: s.section,
          teacherName: s.teacherName,
        })),
        alerts: [], // Announcements locked for parent role
      },
    });
  } catch (error) {
    logger.error("Error in parent dashboard", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to load dashboard" });
  }
};

const getAttendanceRecords = async (req, res) => {
  try {
    const studentUser = await User.findById(req.user._id).lean();
    const tenantId = req.user.tenantId;
    const { subjectId, limit = 50 } = req.query;

    const studentIds = await getStudentIdList(studentUser || req.user, tenantId);
    const objStudentIds = studentIds.map((id) => new mongoose.Types.ObjectId(id));

    const match = { studentId: { $in: objStudentIds }, tenantId };
    if (subjectId && mongoose.Types.ObjectId.isValid(subjectId)) {
      match.subjectId = new mongoose.Types.ObjectId(subjectId);
    }

    const records = await Attendance.find(match)
      .sort({ date: -1 })
      .limit(parseInt(limit))
      .populate("subjectId", "subjectName subjectCode")
      .lean();

    return res.status(200).json({ success: true, data: records });
  } catch (error) {
    logger.error("Error fetching parent attendance records", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to fetch attendance records" });
  }
};

const getAttendanceStats = async (req, res) => {
  try {
    const studentUser = await User.findById(req.user._id).lean();
    const tenantId = req.user.tenantId;

    const studentIds = await getStudentIdList(studentUser || req.user, tenantId);
    const objStudentIds = studentIds.map((id) => new mongoose.Types.ObjectId(id));
    const objTenantId = new mongoose.Types.ObjectId(tenantId);

    const stats = await Attendance.aggregate([
      { $match: { studentId: { $in: objStudentIds }, tenantId: objTenantId } },
      {
        $group: {
          _id: "$subjectId",
          totalClasses: { $sum: 1 },
          presentCount: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
          absentCount: { $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] } },
          leaveCount: { $sum: { $cond: [{ $eq: ["$status", "leave"] }, 1, 0] } },
          denormName: { $first: "$subject.subjectName" },
          denormCode: { $first: "$subject.subjectCode" },
        },
      },
      {
        $lookup: {
          from: "subjects",
          localField: "_id",
          foreignField: "_id",
          as: "subjectDoc",
        },
      },
      {
        $project: {
          _id: 0,
          subjectId: "$_id",
          subjectName: {
            $ifNull: [
              "$denormName",
              { $arrayElemAt: ["$subjectDoc.subjectName", 0] },
              "Subject",
            ],
          },
          subjectCode: {
            $ifNull: [
              "$denormCode",
              { $arrayElemAt: ["$subjectDoc.subjectCode", 0] },
              "",
            ],
          },
          totalClasses: 1,
          presentCount: 1,
          absentCount: 1,
          leaveCount: 1,
          percentage: {
            $cond: [
              { $gt: ["$totalClasses", 0] },
              { $round: [{ $multiply: [{ $divide: ["$presentCount", "$totalClasses"] }, 100] }, 1] },
              0,
            ],
          },
        },
      },
      { $sort: { subjectName: 1 } },
    ]);

    return res.status(200).json({ success: true, data: stats });
  } catch (error) {
    logger.error("Error fetching parent attendance stats", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to fetch attendance stats" });
  }
};

const getSubjects = async (req, res) => {
  try {
    const { subjects } = await resolveStudentSubjects(req.user._id, req.user.tenantId);

    return res.status(200).json({
      success: true,
      data: subjects.map((s) => ({
        id: s.id,
        name: s.name,
        code: s.code,
        section: s.section,
        semester: s.semester,
        branch: s.branch,
        credits: s.credits,
        teacher: s.teacherName ? { id: s.teacherId, name: s.teacherName, email: s.teacherEmail, phone: s.teacherPhone } : null,
      })),
    });
  } catch (error) {
    logger.error("Error fetching parent subjects", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to fetch subjects" });
  }
};

const getAlerts = async (req, res) => {
  // Announcements locked for parent role
  return res.status(200).json({ success: true, data: [] });
};

const getTeachers = async (req, res) => {
  try {
    const { subjects } = await resolveStudentSubjects(req.user._id, req.user.tenantId);

    const teacherMap = new Map();
    subjects.forEach((s) => {
      if (!s.teacherId) return;
      const tKey = s.teacherId.toString();
      if (!teacherMap.has(tKey)) {
        teacherMap.set(tKey, {
          id: s.teacherId,
          name: s.teacherName,
          email: s.teacherEmail,
          phone: s.teacherPhone,
          subjects: [],
        });
      }
      teacherMap.get(tKey).subjects.push({ name: s.name, code: s.code });
    });

    return res.status(200).json({ success: true, data: Array.from(teacherMap.values()) });
  } catch (error) {
    logger.error("Error fetching parent teachers", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to fetch teachers" });
  }
};

const getProfile = async (req, res) => {
  try {
    const student = await User.findById(req.user._id)
      .select("name email rollNo section phone address parentName parentPhone parentEmail courseId courseName branch semester")
      .lean();

    return res.status(200).json({ success: true, data: student });
  } catch (error) {
    logger.error("Error fetching parent profile", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to fetch profile" });
  }
};

module.exports = {
  getDashboard,
  getAttendanceRecords,
  getAttendanceStats,
  getSubjects,
  getAlerts,
  getTeachers,
  getProfile,
};
