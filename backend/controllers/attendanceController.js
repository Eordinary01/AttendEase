const Attendance = require("../models/Attendance");
const Subject = require("../models/Subject");
const User = require("../models/User");
const mongoose = require("mongoose");
require("dotenv").config();

const markAttendance = async (req, res) => {
  const { subjectId, section, date, attendanceData } = req.body;
  const teacherId = req.user._id;

  // Validation
  if (!subjectId || !section || !date || !attendanceData) {
    return res.status(400).json({
      message: "subjectId, section, date, and attendanceData are required",
    });
  }

  if (Object.keys(attendanceData).length === 0) {
    return res.status(400).json({
      message: "attendanceData cannot be empty",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Verify teacher exists and is a teacher
    const teacher = await User.findById(teacherId).session(session);
    if (!teacher || teacher.role !== "teacher") {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        message: "Only teachers can mark attendance",
      });
    }

    // Verify subject exists
    const subject = await Subject.findById(subjectId).session(session);
    if (!subject) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        message: "Subject not found",
      });
    }

    // Verify teacher is assigned to this subject + section
    const isAssigned = teacher.assignedSubjects.some(
      (assigned) =>
        assigned.subjectId.toString() === subjectId &&
        assigned.section === section,
    );

    if (!isAssigned) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        message: "You are not assigned to teach this subject in this section",
      });
    }

    // Parse date
    const attendanceDate = new Date(date);
    if (isNaN(attendanceDate)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Invalid date format",
      });
    }

    // Generate a unique session ID for this class
    const classSessionId = `${subjectId}_${section}_${attendanceDate.toISOString().split('T')[0]}`;

    // Check if attendance already exists for this session
    const existingSession = await Attendance.findOne({ classSessionId }).session(session);
    
    if (existingSession) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Attendance for this class session already exists",
        classSessionId
      });
    }

    // Get all students in this section once for validation
    const studentsInSection = await User.find({
      role: "student",
      section: section,
    })
      .select("_id")
      .session(session);

    const validStudentIds = new Set(
      studentsInSection.map((s) => s._id.toString()),
    );

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

        // Prepare attendance data
        const attendanceDoc = {
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
          studentStats: {
            totalClasses: 0,
            presentCount: 0,
            absentCount: 0,
            leaveCount: 0,
            percentage: 0
          }
        };

        bulkOperations.push({
          insertOne: { document: attendanceDoc },
        });

      } catch (error) {
        errors.push(`Error processing student ${studentId}: ${error.message}`);
      }
    }

    // Execute bulk operations if any
    if (bulkOperations.length > 0) {
      await Attendance.bulkWrite(bulkOperations, { session });
    }

    // Update statistics for each student
    if (processedStudentIds.length > 0) {
      for (const studentId of processedStudentIds) {
        await updateStudentAttendanceStats(studentId, subjectId, session);
      }
    }

    await session.commitTransaction();
    session.endSession();

    // Get class summary
    const classSummary = await getClassSummary(classSessionId);

    return res.status(201).json({
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
    await session.abortTransaction();
    session.endSession();
    console.error("Error in markAttendance:", error);
    return res.status(500).json({
      message: "Error marking attendance",
      error: error.message,
    });
  }
};



// Helper function to update student statistics with running totals
async function updateStudentAttendanceStats(studentId, subjectId, session = null) {
  try {
    console.log(`📊 Updating stats for student ${studentId}, subject ${subjectId}`);
    
    const matchQuery = {
      studentId: new mongoose.Types.ObjectId(studentId),
      subjectId: new mongoose.Types.ObjectId(subjectId)
    };
    
    // Get all records for this student and subject, sorted by date
    const allRecords = await Attendance.find(matchQuery)
      .sort({ date: 1 }) // Sort by date ascending (oldest first)
      .session(session);
    
    if (allRecords.length === 0) return;
    
    console.log(`Found ${allRecords.length} records to update with running totals`);
    
    // Calculate running totals
    let runningTotal = 0;
    let runningPresent = 0;
    let runningAbsent = 0;
    let runningLeave = 0;
    
    for (const record of allRecords) {
      runningTotal++;
      
      // Update running counts based on status
      switch (record.status) {
        case 'present':
          runningPresent++;
          break;
        case 'absent':
          runningAbsent++;
          break;
        case 'leave':
          runningLeave++;
          break;
      }
      
      // Calculate percentage based on running totals
      const percentage = runningTotal > 0 
        ? Number(((runningPresent / runningTotal) * 100).toFixed(2))
        : 0;
      
      // Update this specific record with its running totals
      record.studentStats = {
        totalClasses: runningTotal,
        presentCount: runningPresent,
        absentCount: runningAbsent,
        leaveCount: runningLeave,
        percentage: percentage
      };
      
      record.updatedAt = Date.now();
      await record.save({ session });
      
      console.log(`Record ${record.date.toISOString().split('T')[0]}: Total=${runningTotal}, Present=${runningPresent}, %=${percentage}%`);
    }
    
    console.log(`✅ Updated ${allRecords.length} records with running totals`);
    
  } catch (error) {
    console.error(`❌ Error updating stats for student ${studentId}:`, error);
    throw error;
  }
}

// Helper function to get class summary
async function getClassSummary(classSessionId) {
  try {
    const records = await Attendance.find({ classSessionId });
    
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
    console.error("Error getting class summary:", error);
    return null;
  }
}

/**
 * GET ATTENDANCE RECORDS
 */
const getAttendanceRecords = async (req, res) => {
  const studentId = req.user._id;
  const { subjectId, fromDate, toDate } = req.query; // Removed classSlot

  try {
    const user = await User.findById(studentId);
    if (!user || user.role !== "student") {
      return res.status(403).json({
        message: "Only students can view their attendance records",
      });
    }

    let query = { studentId: studentId };
    
    if (subjectId) {
      query.subjectId = subjectId;
    }

    if (fromDate || toDate) {
      query.date = {};
      if (fromDate) query.date.$gte = new Date(fromDate);
      if (toDate) query.date.$lte = new Date(toDate);
    }

    const attendanceRecords = await Attendance.find(query)
      .populate("subjectId", "subjectCode subjectName semester")
      .populate("teacherId", "name email")
      .sort({ date: -1 })
      .lean();

    // Calculate statistics
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

    return res.status(200).json({
      message: "Attendance records retrieved successfully",
      count: attendanceRecords.length,
      student: {
        id: user._id,
        name: user.name,
        section: user.section,
        rollNo: user.rollNo,
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
      records: attendanceRecords,
    });
  } catch (error) {
    console.error("Error fetching attendance records:", error);
    return res.status(500).json({
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
  const { subjectId, section } = req.query;

  if (!subjectId || !section) {
    return res.status(400).json({
      message: "subjectId and section are required",
    });
  }

  try {
    const teacher = await User.findById(teacherId);
    if (!teacher || teacher.role !== "teacher") {
      return res.status(403).json({
        message: "Only teachers can view attendance summary",
      });
    }

    const isAssigned = teacher.assignedSubjects.some(
      (assigned) =>
        assigned.subjectId.toString() === subjectId &&
        assigned.section === section,
    );

    if (!isAssigned) {
      return res.status(403).json({
        message: "You are not assigned to teach this subject in this section",
      });
    }

    // Get comprehensive summary
    const [studentSummary, classSessions, overallStats] = await Promise.all([
      // Student-wise summary
      Attendance.aggregate([
        {
          $match: {
            subjectId: new mongoose.Types.ObjectId(subjectId),
            section: section
          }
        },
        {
          $group: {
            _id: "$studentId",
            totalClasses: { $first: "$studentStats.totalClasses" },
            presentCount: { $first: "$studentStats.presentCount" },
            absentCount: { $first: "$studentStats.absentCount" },
            leaveCount: { $first: "$studentStats.leaveCount" },
            percentage: { $first: "$studentStats.percentage" }
          }
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "student"
          }
        },
        { $unwind: "$student" },
        {
          $project: {
            studentId: "$_id",
            name: "$student.name",
            rollNo: "$student.rollNo",
            totalClasses: 1,
            presentCount: 1,
            absentCount: 1,
            leaveCount: 1,
            percentage: { $round: ["$percentage", 2] }
          }
        },
        { $sort: { name: 1 } }
      ]),

      // Class sessions - using direct query instead of static method
      Attendance.aggregate([
        {
          $match: {
            subjectId: new mongoose.Types.ObjectId(subjectId),
            section: section
          }
        },
        {
          $group: {
            _id: "$classSessionId",
            date: { $first: "$date" },
            totalStudents: { $sum: 1 },
            presentCount: {
              $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] }
            },
            absentCount: {
              $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] }
            },
            leaveCount: {
              $sum: { $cond: [{ $eq: ["$status", "leave"] }, 1, 0] }
            }
          }
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
              $multiply: [
                { $divide: ["$presentCount", "$totalStudents"] },
                100
              ]
            }
          }
        },
        { $sort: { date: -1 } }
      ]),

      // Overall statistics
      Attendance.aggregate([
        {
          $match: {
            subjectId: new mongoose.Types.ObjectId(subjectId),
            section: section
          }
        },
        {
          $group: {
            _id: null,
            totalSessions: { $addToSet: "$classSessionId" },
            totalAttendanceRecords: { $sum: 1 },
            averageAttendance: { $avg: "$studentStats.percentage" }
          }
        },
        {
          $project: {
            _id: 0,
            totalSessions: { $size: "$totalSessions" },
            totalAttendanceRecords: 1,
            averageAttendance: { $round: ["$averageAttendance", 2] }
          }
        }
      ])
    ]);

    return res.status(200).json({
      message: "Attendance summary retrieved successfully",
      subject: {
        id: subjectId,
        section: section
      },
      overallStats: overallStats[0] || {
        totalSessions: 0,
        totalAttendanceRecords: 0,
        averageAttendance: 0
      },
      classSessions,
      studentSummary
    });

  } catch (error) {
    console.error("Error fetching attendance summary:", error);
    return res.status(500).json({
      message: "Error fetching attendance summary",
      error: error.message,
    });
  }
};

/**
 * GET STUDENT ATTENDANCE STATS
 */
const getStudentAttendanceStats = async (req, res) => {
  const studentId = req.user._id;
  const { subjectId } = req.query;

  try {
    const student = await User.findById(studentId);
    if (!student || student.role !== "student") {
      return res.status(403).json({
        message: "Only students can view their stats",
      });
    }

    let query = { studentId: studentId };
    if (subjectId) {
      query.subjectId = subjectId;
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
          studentId: new mongoose.Types.ObjectId(studentId),
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
      message: "Student attendance statistics retrieved successfully",
      student: {
        id: student._id,
        name: student.name,
        rollNo: student.rollNo,
        section: student.section,
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
    console.error("Error fetching student attendance stats:", error);
    return res.status(500).json({
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
  const { date, subjectId, section } = req.query; // Removed classSlot

  if (!date || !subjectId || !section) {
    return res.status(400).json({
      message: "date, subjectId, and section are required",
    });
  }

  try {
    const teacher = await User.findById(teacherId);
    if (!teacher || teacher.role !== "teacher") {
      return res.status(403).json({
        message: "Only teachers can view attendance details",
      });
    }

    const isAssigned = teacher.assignedSubjects.some(
      (assigned) =>
        assigned.subjectId.toString() === subjectId &&
        assigned.section === section,
    );

    if (!isAssigned) {
      return res.status(403).json({
        message: "You are not assigned to teach this subject in this section",
      });
    }

    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const attendance = await Attendance.find({
      subjectId: subjectId,
      section: section,
      date: { $gte: startDate, $lte: endDate },
    })
      .populate("studentId", "name rollNo")
      .sort({ "studentId.rollNo": 1 })
      .lean();

    return res.status(200).json({
      message: "Attendance details retrieved successfully",
      date: startDate.toISOString().split("T")[0],
      subject: { id: subjectId, section: section },
      totalRecords: attendance.length,
      attendance: attendance,
    });
  } catch (error) {
    console.error("Error fetching attendance by date:", error);
    return res.status(500).json({
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

  if (!status || !["present", "absent", "leave"].includes(status)) {
    return res.status(400).json({
      message: "Valid status (present, absent, leave) is required",
    });
  }

  try {
    const teacher = await User.findById(teacherId);
    if (!teacher || teacher.role !== "teacher") {
      return res.status(403).json({
        message: "Only teachers can update attendance",
      });
    }

    const attendance = await Attendance.findById(attendanceId);
    if (!attendance) {
      return res.status(404).json({
        message: "Attendance record not found",
      });
    }

    if (attendance.teacherId.toString() !== teacherId) {
      return res.status(403).json({
        message: "You can only update attendance you marked",
      });
    }

    attendance.status = status;
    if (remarks) {
      attendance.remarks = remarks;
    }
    attendance.updatedAt = Date.now();
    await attendance.save();

    // Update statistics after change
    await updateStudentAttendanceStats(attendance.studentId, attendance.subjectId);

    return res.status(200).json({
      message: "Attendance record updated successfully",
      record: attendance,
    });
  } catch (error) {
    console.error("Error updating attendance record:", error);
    return res.status(500).json({
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

  try {
    const teacher = await User.findById(teacherId);
    if (!teacher || teacher.role !== "teacher") {
      return res.status(403).json({
        message: "Only teachers can delete attendance records",
      });
    }

    const attendance = await Attendance.findById(attendanceId);
    if (!attendance) {
      return res.status(404).json({
        message: "Attendance record not found",
      });
    }

    if (attendance.teacherId.toString() !== teacherId) {
      return res.status(403).json({
        message: "You can only delete attendance you marked",
      });
    }

    const { studentId, subjectId } = attendance;
    await Attendance.findByIdAndDelete(attendanceId);

    // Update statistics after deletion
    await updateStudentAttendanceStats(studentId, subjectId);

    return res.status(200).json({
      message: "Attendance record deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting attendance record:", error);
    return res.status(500).json({
      message: "Error deleting attendance",
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
};