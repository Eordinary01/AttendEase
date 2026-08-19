const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    // Student Information
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Subject Information (Reference to Subject collection)
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
      index: true,
    },

    // Subject Details (Denormalized for quick access)
    subject: {
      subjectCode: {
        type: String,
        required: true,
      },
      subjectName: {
        type: String,
        required: true,
      },
    },

    // Teacher Information (who marked attendance)
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Section Information
    section: {
      type: String,
      required: true,
      index: true,
      uppercase: true,
      trim: true,
    },

    // Attendance Details
    date: {
      type: Date,
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["present", "absent", "leave"],
      default: "absent",
      required: true,
    },

    // Remarks (optional - reason for absence, etc.)
    remarks: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },

    // 📊 NEW: Running totals for quick access
    studentStats: {
      totalClasses: { type: Number, default: 0 },
      presentCount: { type: Number, default: 0 },
      absentCount: { type: Number, default: 0 },
      leaveCount: { type: Number, default: 0 },
      percentage: { type: Number, default: 0 },
    },

    // 📊 NEW: Class session identifier
    classSessionId: {
      type: String,
      required: true,
      index: true,
    },

    // 📅 Timetable slot (denormalized from the scheduled class)
    timetableId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Timetable",
      index: true,
    },
    day: {
      type: String,
      trim: true,
    },
    startTime: {
      type: String,
      trim: true,
    },
    endTime: {
      type: String,
      trim: true,
    },
    room: {
      type: String,
      trim: true,
      default: "",
    },

    // Proxy Detection Metadata (Item 11)
    ipAddress: String,
    deviceFingerprint: String,
    proxyFlagged: { type: Boolean, default: false },
    proxyReason: String,

    // Semester/Batch Information
    semester: {
      type: String,
      trim: true,
      index: true,
    },

    // Track who created this record
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },

    updatedAt: {
      type: Date,
      default: Date.now,
    },

    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

// 📊 COMPOUND INDEXES for efficient queries
attendanceSchema.index({ studentId: 1, subjectId: 1, date: -1 });
attendanceSchema.index({ subjectId: 1, section: 1, date: -1 });
attendanceSchema.index({ teacherId: 1, date: -1 });
attendanceSchema.index({ tenantId: 1, studentId: 1, date: -1 });
attendanceSchema.index({ tenantId: 1, classSessionId: 1, studentId: 1 }, { unique: true });
attendanceSchema.index({ tenantId: 1, subjectId: 1, section: 1, date: -1 });
attendanceSchema.index({ tenantId: 1, teacherId: 1, date: -1 });

// 📊 STATIC METHODS for statistics
attendanceSchema.statics.getClassSessions = async function (
  subjectId,
  section,
  tenantId
) {
  return await this.aggregate([
    {
      $match: {
        subjectId: new mongoose.Types.ObjectId(subjectId),
        section: section,
        tenantId: new mongoose.Types.ObjectId(tenantId)
      },
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          sessionId: "$classSessionId",
        },
        date: { $first: "$date" },
        totalStudents: { $sum: 1 },
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
        sessionId: "$_id.sessionId",
        date: 1,
        totalStudents: 1,
        presentCount: 1,
        absentCount: 1,
        leaveCount: 1,
        attendanceRate: {
          $multiply: [{ $divide: ["$presentCount", "$totalStudents"] }, 100],
        },
      },
    },
    { $sort: { date: -1 } },
  ]);
};

// 📊 METHOD to update student running totals
attendanceSchema.statics.updateStudentTotals = async function (
  studentId,
  subjectId,
  tenantId
) {
  const stats = await this.aggregate([
    {
      $match: {
        studentId: new mongoose.Types.ObjectId(studentId),
        subjectId: new mongoose.Types.ObjectId(subjectId),
        tenantId: new mongoose.Types.ObjectId(tenantId)

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
  ]);

  if (stats.length > 0) {
    const stat = stats[0];
    const percentage = (stat.presentCount / stat.totalClasses) * 100;

    await this.updateMany(
      { studentId: studentId, subjectId: subjectId },
      {
        $set: {
          "studentStats.totalClasses": stat.totalClasses,
          "studentStats.presentCount": stat.presentCount,
          "studentStats.absentCount": stat.absentCount,
          "studentStats.leaveCount": stat.leaveCount,
          "studentStats.percentage": percentage,
        },
      },
    );
  }
};

attendanceSchema.index({ tenantId: 1, studentId: 1, date: -1 });

module.exports = mongoose.model("Attendance", attendanceSchema);
