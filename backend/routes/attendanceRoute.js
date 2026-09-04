// routes/attendanceRoute.js
const express = require("express");
const attendanceRoute = express.Router();
const mongoose = require("mongoose");
const User = require("../models/User");
const Attendance = require("../models/Attendance");
const Subject = require("../models/Subject");
const {
  authenticateToken,
  teacherAuth,
  studentAuth,
  adminAuth,
  authorizeRoles,
} = require("../middleware/auth");
const { featureGuard } = require("../middleware/featureGuard");
const { requirePermission } = require("../middleware/permission");
const { escapeRegExp } = require("../utils/sanitize");
const logger = require("../utils/logger");
const validate = require("../middleware/validate");
const {
  markAttendance,
  updateAttendanceRecord,
  getAttendanceSummary,
  getAttendanceByDate,
} = require("../validators/attendance");
const {
  markAttendance: markAttendanceCtrl,
  getAttendanceRecords,
  getAttendanceSummary: getAttendanceSummaryCtrl,
  getStudentAttendanceStats,
  getAttendanceByDate: getAttendanceByDateCtrl,
  updateAttendanceRecord: updateAttendanceRecordCtrl,
  deleteAttendanceRecord,
  getAttendanceHistory,
} = require("../controllers/attendanceController");

// ==================== TEACHER-ONLY ROUTES ====================

/**
 * POST /api/attendance/mark
 * Mark attendance for a class session
 * Body: { subjectId, section, date, attendanceData }
 */
attendanceRoute.post("/mark", authenticateToken, teacherAuth, featureGuard("attendance"), markAttendance, markAttendanceCtrl);

/**
 * GET /api/attendance/summary
 * Get attendance summary for teacher's class
 * Query: ?subjectId=xxx&section=A
 */
attendanceRoute.get(
  "/summary",
  authenticateToken,
  teacherAuth,
  featureGuard("attendance"),
  getAttendanceSummary,
  getAttendanceSummaryCtrl,
);

/**
 * GET /api/attendance/by-date
 * Get attendance for a specific date
 * Query: ?date=2024-01-01&subjectId=xxx&section=A
 */
attendanceRoute.get(
  "/by-date",
  authenticateToken,
  teacherAuth,
  featureGuard("attendance"),
  getAttendanceByDate,
  getAttendanceByDateCtrl,
);

/**
 * PUT /api/attendance/:attendanceId
 * Update an attendance record
 * Body: { status, remarks }
 */
attendanceRoute.put(
  "/:attendanceId",
  authenticateToken,
  teacherAuth,
  featureGuard("attendance"),
  updateAttendanceRecord,
  updateAttendanceRecordCtrl,
);

/**
 * DELETE /api/attendance/:attendanceId
 * Delete an attendance record
 */
attendanceRoute.delete(
  "/:attendanceId",
  authenticateToken,
  teacherAuth,
  featureGuard("attendance"),
  deleteAttendanceRecord,
);

// ==================== STUDENT-ONLY ROUTES ====================

/**
 * GET /api/attendance/records
 * Get student's own attendance records
 * Query: ?subjectId=xxx&fromDate=2024-01-01&toDate=2024-12-31
 */
attendanceRoute.get(
  "/records",
  authenticateToken,
  (req, res, next) => {
    if (["student", "admin", "super_admin"].includes(req.user?.role)) return next();
    return res.status(403).json({ success: false, message: "Access denied" });
  },
  featureGuard("attendance"),
  getAttendanceRecords,
);

/**
 * GET /api/attendance/stats
 * Get student's attendance statistics
 * Query: ?subjectId=xxx
 */
attendanceRoute.get(
  "/stats",
  authenticateToken,
  authorizeRoles(["student", "teacher", "admin", "super_admin", "parent"]),
  featureGuard("attendance"),
  getStudentAttendanceStats,
);

attendanceRoute.get(
  "/student/stats",
  authenticateToken,
  authorizeRoles(["student", "teacher", "admin", "super_admin", "parent"]),
  featureGuard("attendance"),
  getStudentAttendanceStats,
);

/**
 * GET /api/attendance/history
 * Full attendance history for all roles (student/teacher/parent/admin)
 * Query: ?studentId=&subjectId=&section=&fromDate=&toDate=&status=&page=&limit=
 */
attendanceRoute.get(
  "/history",
  authenticateToken,
  authorizeRoles(["student", "teacher", "admin", "super_admin", "parent"]),
  featureGuard("attendance"),
  getAttendanceHistory
);

/**
 * GET /api/attendance
 * General attendance query (aliases to getAttendanceHistory)
 * Supports: ?subjectId=&section=&date=&fromDate=&toDate=&status=&page=&limit=
 */
attendanceRoute.get(
  "/",
  authenticateToken,
  authorizeRoles(["student", "teacher", "admin", "super_admin", "parent"]),
  featureGuard("attendance"),
  getAttendanceHistory
);

// ==================== ADMIN ROUTES ====================
// For tenant admins to view any attendance within their institution

/**
 * GET /api/attendance/admin/students
 * Get all students with attendance summary
 * Query: ?section=A&page=1&limit=50&sortBy=name&sortOrder=asc&courseId=X&branch=Y&semester=1
 */
attendanceRoute.get(
  "/admin/students",
  authenticateToken,
  authorizeRoles(["admin", "teacher"]),
  featureGuard("attendance"),
  async (req, res) => {
    try {
      const tenantId = req.user.tenantId;
      const {
        section,
        page = 1,
        limit = 50,
        search,
        sortBy = 'name',
        sortOrder = 'asc',
        courseId,
        branch,
        semester
      } = req.query;

      // Build query for students
      let query = {
        tenantId: tenantId,
        role: 'student',
        isActive: true
      };

      // Course filter
      if (courseId) {
        query.courseId = courseId;
      }

      // Branch filter (case-insensitive)
      if (branch) {
        query.branch = new RegExp(`^${branch.trim()}$`, "i");
      }

      // Semester filter
      if (semester) {
        const semNum = parseInt(String(semester).replace(/\D/g, ""), 10);
        if (!isNaN(semNum) && semNum > 0) {
          query.$and = (query.$and || []);
          query.$and.push({ $or: [{ semester: semNum }, { semester: String(semNum) }] });
        }
      }

      // Teachers without privileged management permissions can only view students in their assigned sections
      const isPrivileged = req.user.role === 'admin' ||
                           req.user.role === 'super_admin' ||
                           req.user.permissions?.includes("students:read") ||
                           req.user.permissions?.includes("students:write") ||
                           req.user.permissions?.includes("attendance:read_all") ||
                           req.user.permissions?.includes("*");

      if (req.user.role === 'teacher' && !isPrivileged) {
        const assignedSections = [...new Set((req.user.assignedSubjects || []).map(a => a.section).filter(Boolean))];
        if (assignedSections.length === 0) {
          return res.status(200).json({ success: true, data: [], pagination: { page: 1, limit: parseInt(limit), total: 0, pages: 0 } });
        }
        if (section && !assignedSections.includes(section)) {
          return res.status(403).json({ success: false, message: "You can only view students in your assigned sections" });
        }
        query.section = { $in: assignedSections };
      } else if (section) {
        query.section = section;
      }
      if (search) {
        const safeSearch = escapeRegExp(search);
        query.$or = [
          { name: { $regex: safeSearch, $options: 'i' } },
          { rollNo: { $regex: safeSearch, $options: 'i' } },
          { email: { $regex: safeSearch, $options: 'i' } }
        ];
      }

      const safeLimit = Math.min(2000, Math.max(1, parseInt(limit, 10) || 50));
      const safePage = Math.max(1, parseInt(page, 10) || 1);
      const skip = (safePage - 1) * safeLimit;

      // Get students with pagination
      const students = await User.find(query)
        .select('name email section rollNo phone parentName parentPhone courseId courseName branch semester admissionYear academicStatus totalSemesters')
        .populate('courseId', 'name code branches durationYears semestersPerYear')
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean();

      const total = await User.countDocuments(query);

      // Single aggregation for all students in current page (Item #12 optimization)
      const studentIdList = students.map(s => s._id);
      const statsMap = new Map();

      if (studentIdList.length > 0) {
        const statsAgg = await Attendance.aggregate([
          {
            $match: {
              tenantId: new mongoose.Types.ObjectId(tenantId),
              studentId: { $in: studentIdList }
            }
          },
          {
            $group: {
              _id: "$studentId",
              totalClasses: { $sum: 1 },
              presentCount: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
              absentCount: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
              leaveCount: { $sum: { $cond: [{ $eq: ['$status', 'leave'] }, 1, 0] } }
            }
          }
        ]);

        statsAgg.forEach(stat => {
          statsMap.set(stat._id.toString(), stat);
        });
      }

      const studentsWithAttendance = students.map((student) => {
        const overall = statsMap.get(student._id.toString()) || { totalClasses: 0, presentCount: 0, absentCount: 0, leaveCount: 0 };
        const attendancePercentage = overall.totalClasses > 0
          ? ((overall.presentCount / overall.totalClasses) * 100).toFixed(2)
          : 0;

        const resolvedCourseName = student.courseName || student.courseId?.name || student.courseId?.code || "";
        const resolvedCourseId = student.courseId?._id || student.courseId || null;

        return {
          id: student._id,
          _id: student._id,
          name: student.name,
          email: student.email,
          section: student.section,
          rollNo: student.rollNo,
          phone: student.phone || "",
          parentName: student.parentName || "",
          parentPhone: student.parentPhone || "",
          courseId: resolvedCourseId,
          courseName: resolvedCourseName,
          course: student.courseId ? { _id: student.courseId._id, name: student.courseId.name, code: student.courseId.code } : null,
          branch: student.branch || "",
          semester: student.semester || 1,
          admissionYear: student.admissionYear || 2025,
          academicStatus: student.academicStatus || "active",
          attendance: {
            totalClasses: overall.totalClasses,
            presentCount: overall.presentCount,
            absentCount: overall.absentCount,
            leaveCount: overall.leaveCount,
            percentage: parseFloat(attendancePercentage),
            status: attendancePercentage >= 75 ? 'good' : attendancePercentage >= 60 ? 'warning' : 'critical'
          }
        };
      });

      return res.status(200).json({
        success: true,
        message: 'Students attendance summary retrieved',
        data: studentsWithAttendance,
        pagination: {
          page: safePage,
          limit: safeLimit,
          total,
          pages: Math.ceil(total / safeLimit)
        }
      });

    } catch (error) {
      logger.error('Error fetching students attendance:', { error: error.message });
      return res.status(500).json({
        success: false,
        message: 'Error fetching students attendance'
      });
    }
  }
);

/**
 * GET /api/attendance/admin/student/:studentId
 * Admin view complete student attendance details
 * Query: ?subjectId=xxx&fromDate=2024-01-01&toDate=2024-12-31&page=1&limit=50
 */
attendanceRoute.get(
  "/admin/student/:studentId",
  authenticateToken,
  adminAuth,
  async (req, res) => {
    try {
      const { studentId } = req.params;
      const tenantId = req.user.tenantId;
      const {
        subjectId,
        fromDate,
        toDate,
        page = 1,
        limit = 50,
        status,
        sortBy = 'date',
        sortOrder = 'desc'
      } = req.query;

      // Verify student belongs to tenant
      const student = await User.findOne({
        _id: studentId,
        tenantId: tenantId,
        role: 'student',
        isActive: true
      }).select('name email section rollNo phone address parentName parentPhone');

      if (!student) {
        return res.status(404).json({
          success: false,
          message: 'Student not found in your institution'
        });
      }

      // Build query
      let query = {
        studentId: studentId,
        tenantId: tenantId
      };

      if (subjectId) {
        const subject = await Subject.findOne({ _id: subjectId, tenantId: tenantId });
        if (!subject) {
          return res.status(404).json({
            success: false,
            message: 'Subject not found in your institution'
          });
        }
        query.subjectId = subjectId;
      }

      if (fromDate || toDate) {
        query.date = {};
        if (fromDate) query.date.$gte = new Date(fromDate);
        if (toDate) query.date.$lte = new Date(toDate);
      }

      if (status && ['present', 'absent', 'leave'].includes(status)) {
        query.status = status;
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const limitNum = parseInt(limit);

      // Get attendance records
      const [attendanceRecords, totalRecords] = await Promise.all([
        Attendance.find(query)
          .populate('subjectId', 'subjectCode subjectName semester credits')
          .populate('teacherId', 'name email')
          .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Attendance.countDocuments(query)
      ]);

      // Calculate overall statistics
      const overallStats = await Attendance.aggregate([
        { $match: { studentId: new mongoose.Types.ObjectId(studentId), tenantId: new mongoose.Types.ObjectId(tenantId) } },
        {
          $group: {
            _id: null,
            totalClasses: { $sum: 1 },
            presentCount: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
            absentCount: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
            leaveCount: { $sum: { $cond: [{ $eq: ['$status', 'leave'] }, 1, 0] } },
            firstAttendance: { $min: '$date' },
            lastAttendance: { $max: '$date' }
          }
        }
      ]);

      // Calculate subject-wise statistics
      const subjectWiseStats = await Attendance.aggregate([
        { $match: { studentId: new mongoose.Types.ObjectId(studentId), tenantId: new mongoose.Types.ObjectId(tenantId) } },
        {
          $group: {
            _id: '$subjectId',
            subjectCode: { $first: '$subject.subjectCode' },
            subjectName: { $first: '$subject.subjectName' },
            totalClasses: { $sum: 1 },
            presentCount: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
            absentCount: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
            leaveCount: { $sum: { $cond: [{ $eq: ['$status', 'leave'] }, 1, 0] } }
          }
        },
        {
          $addFields: {
            attendancePercentage: {
              $cond: [
                { $eq: ['$totalClasses', 0] },
                0,
                { $multiply: [{ $divide: ['$presentCount', '$totalClasses'] }, 100] }
              ]
            }
          }
        },
        { $sort: { attendancePercentage: -1 } }
      ]);

      // Calculate risk assessment
      const overall = overallStats[0] || { totalClasses: 0, presentCount: 0 };
      const attendancePercentage = overall.totalClasses > 0
        ? (overall.presentCount / overall.totalClasses) * 100
        : 0;

      let riskLevel = 'good';
      let riskMessage = '✅ GOOD: Attendance is excellent. Keep it up!';
      let riskColor = 'green';

      if (attendancePercentage < 60) {
        riskLevel = 'critical';
        riskMessage = '⚠️ CRITICAL: Attendance is severely low. Immediate intervention required.';
        riskColor = 'red';
      } else if (attendancePercentage < 75) {
        riskLevel = 'warning';
        riskMessage = '⚠️ WARNING: Attendance is below required 75% threshold.';
        riskColor = 'orange';
      } else if (attendancePercentage < 85) {
        riskLevel = 'moderate';
        riskMessage = '✓ MODERATE: Attendance is acceptable but can be improved.';
        riskColor = 'yellow';
      }

      return res.status(200).json({
        success: true,
        message: 'Student attendance details retrieved',
        data: {
          student: {
            id: student._id,
            name: student.name,
            email: student.email,
            section: student.section,
            rollNo: student.rollNo,
            phone: student.phone || 'N/A',
            address: student.address || 'N/A',
            parentName: student.parentName || 'N/A',
            parentPhone: student.parentPhone || 'N/A'
          },
          summary: {
            totalClasses: overall.totalClasses,
            presentCount: overall.presentCount,
            absentCount: overall.absentCount || 0,
            leaveCount: overall.leaveCount || 0,
            attendancePercentage: attendancePercentage.toFixed(2),
            firstAttendance: overall.firstAttendance,
            lastAttendance: overall.lastAttendance,
            riskAssessment: {
              level: riskLevel,
              message: riskMessage,
              color: riskColor
            }
          },
          subjectWise: subjectWiseStats.map(sub => ({
            subjectCode: sub.subjectCode,
            subjectName: sub.subjectName,
            totalClasses: sub.totalClasses,
            presentCount: sub.presentCount,
            absentCount: sub.absentCount,
            leaveCount: sub.leaveCount,
            attendancePercentage: sub.attendancePercentage.toFixed(2)
          })),
          attendanceRecords,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: totalRecords,
            pages: Math.ceil(totalRecords / parseInt(limit))
          }
        }
      });

    } catch (error) {
      logger.error('Error fetching student attendance:', { error: error.message });
      return res.status(500).json({
        success: false,
        message: 'Error fetching student attendance details'
      });
    }
  }
);

/**
 * GET /api/attendance/admin/section/:section
 * Get attendance summary for all students in a section
 * Query: ?page=1&limit=50
 */
attendanceRoute.get(
  "/admin/section/:section",
  authenticateToken,
  adminAuth,
  async (req, res) => {
    try {
      const { section } = req.params;
      const tenantId = req.user.tenantId;
      const { page = 1, limit = 50, sortBy = 'name', sortOrder = 'asc' } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Find all students in the section
      const students = await User.find({
        tenantId: tenantId,
        role: 'student',
        section: section,
        isActive: true
      })
        .select('name email rollNo')
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await User.countDocuments({
        tenantId: tenantId,
        role: 'student',
        section: section,
        isActive: true
      });

      // Get attendance statistics for each student
      const studentsWithAttendance = await Promise.all(
        students.map(async (student) => {
          const stats = await Attendance.aggregate([
            {
              $match: {
                studentId: student._id,
                tenantId: tenantId
              }
            },
            {
              $group: {
                _id: null,
                totalClasses: { $sum: 1 },
                presentCount: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
                absentCount: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
                leaveCount: { $sum: { $cond: [{ $eq: ['$status', 'leave'] }, 1, 0] } }
              }
            }
          ]);

          const overall = stats[0] || { totalClasses: 0, presentCount: 0 };
          const attendancePercentage = overall.totalClasses > 0
            ? ((overall.presentCount / overall.totalClasses) * 100).toFixed(2)
            : 0;

          return {
            id: student._id,
            name: student.name,
            rollNo: student.rollNo,
            email: student.email,
            totalClasses: overall.totalClasses,
            presentCount: overall.presentCount,
            attendancePercentage: parseFloat(attendancePercentage),
            status: attendancePercentage >= 75 ? 'good' : attendancePercentage >= 60 ? 'warning' : 'critical'
          };
        })
      );

      // Calculate section summary
      const sectionSummary = studentsWithAttendance.reduce(
        (acc, student) => {
          acc.totalStudents++;
          acc.totalClasses += student.totalClasses;
          acc.totalPresent += student.presentCount;
          if (student.status === 'good') acc.goodCount++;
          else if (student.status === 'warning') acc.warningCount++;
          else acc.criticalCount++;
          return acc;
        },
        {
          totalStudents: 0,
          totalClasses: 0,
          totalPresent: 0,
          goodCount: 0,
          warningCount: 0,
          criticalCount: 0
        }
      );

      sectionSummary.averageAttendance = sectionSummary.totalClasses > 0
        ? ((sectionSummary.totalPresent / sectionSummary.totalClasses) * 100).toFixed(2)
        : 0;

      return res.status(200).json({
        success: true,
        message: `Attendance summary for section ${section}`,
        data: {
          section,
          summary: sectionSummary,
          students: studentsWithAttendance,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
          }
        }
      });

    } catch (error) {
      logger.error('Error fetching section attendance:', { error: error.message });
      return res.status(500).json({
        success: false,
        message: 'Error fetching section attendance'
      });
    }
  }
);

/**
 * GET /api/attendance/admin/subject/:subjectId
 * Get attendance summary for all students in a subject
 * Query: ?section=A&page=1&limit=50
 */
attendanceRoute.get(
  "/admin/subject/:subjectId",
  authenticateToken,
  adminAuth,
  async (req, res) => {
    try {
      const { subjectId } = req.params;
      const tenantId = req.user.tenantId;
      const { section, page = 1, limit = 50, sortBy = 'name', sortOrder = 'asc' } = req.query;

      // Verify subject belongs to tenant
      const subject = await Subject.findOne({ _id: subjectId, tenantId: tenantId });
      if (!subject) {
        return res.status(404).json({
          success: false,
          message: 'Subject not found in your institution'
        });
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Build query for students
      let studentQuery = {
        tenantId: tenantId,
        role: 'student',
        isActive: true
      };
      if (section) studentQuery.section = section;

      const students = await User.find(studentQuery)
        .select('name email rollNo section')
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await User.countDocuments(studentQuery);

      // Get attendance for each student for this subject
      const studentsWithAttendance = await Promise.all(
        students.map(async (student) => {
          const stats = await Attendance.aggregate([
            {
              $match: {
                studentId: student._id,
                subjectId: new mongoose.Types.ObjectId(subjectId),
                tenantId: tenantId
              }
            },
            {
              $group: {
                _id: null,
                totalClasses: { $sum: 1 },
                presentCount: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
                absentCount: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
                leaveCount: { $sum: { $cond: [{ $eq: ['$status', 'leave'] }, 1, 0] } }
              }
            }
          ]);

          const overall = stats[0] || { totalClasses: 0, presentCount: 0 };
          const attendancePercentage = overall.totalClasses > 0
            ? ((overall.presentCount / overall.totalClasses) * 100).toFixed(2)
            : 0;

          return {
            id: student._id,
            name: student.name,
            rollNo: student.rollNo,
            section: student.section,
            email: student.email,
            totalClasses: overall.totalClasses,
            presentCount: overall.presentCount,
            absentCount: overall.absentCount || 0,
            leaveCount: overall.leaveCount || 0,
            attendancePercentage: parseFloat(attendancePercentage)
          };
        })
      );

      // Calculate subject summary
      const subjectSummary = studentsWithAttendance.reduce(
        (acc, student) => {
          acc.totalStudents++;
          acc.totalClasses += student.totalClasses;
          acc.totalPresent += student.presentCount;
          return acc;
        },
        { totalStudents: 0, totalClasses: 0, totalPresent: 0 }
      );

      subjectSummary.averageAttendance = subjectSummary.totalClasses > 0
        ? ((subjectSummary.totalPresent / subjectSummary.totalClasses) * 100).toFixed(2)
        : 0;

      return res.status(200).json({
        success: true,
        message: `Attendance summary for subject ${subject.subjectName}`,
        data: {
          subject: {
            id: subject._id,
            name: subject.subjectName,
            code: subject.subjectCode
          },
          summary: subjectSummary,
          students: studentsWithAttendance,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
          }
        }
      });

    } catch (error) {
      logger.error('Error fetching subject attendance:', { error: error.message });
      return res.status(500).json({
        success: false,
        message: 'Error fetching subject attendance'
      });
    }
  }
);

/**
 * GET /api/attendance/admin/dashboard/stats
 * Get admin dashboard statistics for attendance
 */
attendanceRoute.get(
  "/admin/dashboard/stats",
  authenticateToken,
  adminAuth,
  async (req, res) => {
    try {
      const tenantId = req.user.tenantId;
      const { date = new Date().toISOString().split('T')[0] } = req.query;

      const selectedDate = new Date(date);
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Get today's attendance statistics
      const todayStats = await Attendance.aggregate([
        {
          $match: {
            tenantId: new mongoose.Types.ObjectId(tenantId),
            date: { $gte: startOfDay, $lte: endOfDay }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
            absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
            leave: { $sum: { $cond: [{ $eq: ['$status', 'leave'] }, 1, 0] } }
          }
        }
      ]);

      // Get overall statistics
      const overallStats = await Attendance.aggregate([
        {
          $match: {
            tenantId: new mongoose.Types.ObjectId(tenantId)
          }
        },
        {
          $group: {
            _id: null,
            totalClasses: { $sum: 1 },
            presentCount: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
            absentCount: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
            leaveCount: { $sum: { $cond: [{ $eq: ['$status', 'leave'] }, 1, 0] } }
          }
        }
      ]);

      // Get section-wise attendance
      const sectionStats = await User.aggregate([
        {
          $match: {
            tenantId: new mongoose.Types.ObjectId(tenantId),
            role: 'student',
            isActive: true
          }
        },
        {
          $group: {
            _id: '$section',
            totalStudents: { $sum: 1 }
          }
        }
      ]);

      // Get low attendance students (below 75%)
      const lowAttendanceStudents = await Attendance.aggregate([
        {
          $match: {
            tenantId: new mongoose.Types.ObjectId(tenantId)
          }
        },
        {
          $group: {
            _id: '$studentId',
            totalClasses: { $sum: 1 },
            presentCount: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } }
          }
        },
        {
          $addFields: {
            percentage: {
              $cond: [
                { $eq: ['$totalClasses', 0] },
                0,
                { $multiply: [{ $divide: ['$presentCount', '$totalClasses'] }, 100] }
              ]
            }
          }
        },
        {
          $match: { percentage: { $lt: 75 } }
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'student'
          }
        },
        { $unwind: '$student' },
        {
          $project: {
            studentId: '$_id',
            name: '$student.name',
            rollNo: '$student.rollNo',
            section: '$student.section',
            totalClasses: 1,
            presentCount: 1,
            percentage: { $round: ['$percentage', 2] }
          }
        },
        { $sort: { percentage: 1 } },
        { $limit: 10 }
      ]);

      const overall = overallStats[0] || { totalClasses: 0, presentCount: 0, absentCount: 0, leaveCount: 0 };
      const today = todayStats[0] || { total: 0, present: 0, absent: 0, leave: 0 };
      const overallPercentage = overall.totalClasses > 0
        ? ((overall.presentCount / overall.totalClasses) * 100).toFixed(2)
        : 0;

      return res.status(200).json({
        success: true,
        message: 'Admin dashboard statistics retrieved',
        data: {
          today: {
            totalRecords: today.total,
            present: today.present,
            absent: today.absent,
            leave: today.leave,
            attendanceRate: today.total > 0 ? ((today.present / today.total) * 100).toFixed(2) : 0
          },
          overall: {
            totalClasses: overall.totalClasses,
            presentCount: overall.presentCount,
            absentCount: overall.absentCount,
            leaveCount: overall.leaveCount,
            attendanceRate: overallPercentage
          },
          sections: sectionStats,
          lowAttendanceStudents,
          totalStudents: sectionStats.reduce((sum, s) => sum + s.totalStudents, 0)
        }
      });

    } catch (error) {
      logger.error('Error fetching admin stats:', { error: error.message });
      return res.status(500).json({
        success: false,
        message: 'Error fetching dashboard statistics'
      });
    }
  }
);

// ==================== FEATURE-GATED ROUTES (Commented for future use) ====================
// Advanced Analytics (Basic+)
// attendanceRoute.get('/analytics/predictive',
//   authenticateToken,
//   teacherAuth,
//   featureGuard('analytics'),
//   getPredictiveAnalytics
// );

// Bulk Operations (Enterprise only)
// attendanceRoute.post('/bulk-upload',
//   authenticateToken,
//   teacherAuth,
//   featureGuard('bulk_operations'),
//   bulkUploadAttendance
// );

module.exports = attendanceRoute;