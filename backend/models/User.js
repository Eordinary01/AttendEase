const mongoose = require("mongoose");

const userSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    section: {
      type: String,
      required: function () {
        return this.role === "student";
      },
      trim: true,
    },
    role: {
      type: String,
      enum: ["student", "teacher", "admin", "super_admin"],
      default: "student",
    },
    rollNo: {
      type: String,
      required: function () {
        return this.role !== "admin" && this.role !== "super_admin";
      },
      trim: true,
    },
    assignedSubjects: [
      {
        subjectId: { type: mongoose.Schema.Types.ObjectId, ref: "Subject" },
        subjectName: String,
        section: String,
        assignedDate: { type: Date, default: Date.now },
      },
    ],
    subjectAttendance: [
      {
        subjectId: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
        subjectName: String,
        subjectCode: String,
        totalClasses: { type: Number, default: 0 },
        presentCount: { type: Number, default: 0 },
        absentCount: { type: Number, default: 0 },
        leaveCount: { type: Number, default: 0 },
        percentage: { type: Number, default: 0 },
        lastAttended: { type: Date, default: null },
      },
    ],
    attendance: {
      totalClasses: { type: Number, default: 0 },
      presentCount: { type: Number, default: 0 },
      absentCount: { type: Number, default: 0 },
      leaveCount: { type: Number, default: 0 },
      overallPercentage: { type: Number, default: 0 },
    },
    createdByAdmin: { type: Boolean, default: false },
    isFirstLogin: { type: Boolean, default: true },
    tempPasswordSent: { type: Boolean, default: false },
    tempPasswordSentAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
    
    // Optional teacher/profile details
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    qualification: { type: String, trim: true },
    specialization: { type: String, trim: true },
    joiningDate: { type: Date, default: null },

    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: function() {
        return this.role !== "super_admin";
      },
      index: true,
    },
    
    lastLoginAt: Date,
    lastLoginIP: String,
    loginCount: { type: Number, default: 0 },

    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: String,
    passwordResetToken: String,
    passwordResetExpires: Date,
    emailVerified: { type: Boolean, default: false },
    emailVerificationOTP: String,
    emailVerificationExpires: Date,
    tokenVersion: { type: Number, default: 0 },
    profileComplete: { type: Boolean, default: false },

    // Custom roles assigned to teachers
    customRoles: [{
      roleId: { type: mongoose.Schema.Types.ObjectId, ref: "CustomRole" },
      assignedAt: { type: Date, default: Date.now },
      assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    }],

    // Parent contact fields
    parentName: { type: String, trim: true },
    parentPhone: { type: String, trim: true },
    parentEmail: { type: String, lowercase: true, trim: true },

    // Face recognition (ATTEND-AI integration — Phase 1)
    // Stored descriptor from face-api.js (128-dim or 512-dim FloatArray,
    // serialized as a plain number array). Null until a face is registered.
    faceDescriptor: {
      type: [Number],
      default: null,
    },
    // URL to the registered face image (stored in backend/uploads/face-attendance/).
    // Optional — kept for audit/debugging, not used for recognition at runtime.
    faceImageUrl: {
      type: String,
      trim: true,
      default: null,
    },

    // Academic structure (students)
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", default: null },
    courseName: { type: String, trim: true, default: "" },
    branch: { type: String, trim: true, default: "" },
    semester: { type: Number, default: 1, min: 1 },
    admissionYear: { type: Number, default: null },
    academicYear: { type: String, trim: true, default: "" },
    totalSemesters: { type: Number, default: null },
    holdPromotion: { type: Boolean, default: false },
    academicStatus: {
      type: String,
      enum: ["active", "graduated", "transferred", "dropped"],
      default: "active",
    },
    graduatedAt: { type: Date, default: null },
    lastPromotedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ section: 1 });
userSchema.index({ rollNo: 1 });
userSchema.index({ "subjectAttendance.subjectId": 1 });
userSchema.index({ tenantId: 1, role: 1 });
userSchema.index({ tenantId: 1, email: 1 }, { unique: true });
userSchema.index({ tenantId: 1, rollNo: 1 }, { unique: true, sparse: true });
userSchema.index({ tenantId: 1, courseId: 1 });
userSchema.index({ tenantId: 1, semester: 1 });

// Methods
userSchema.methods.updateAttendanceSummary = async function () {
  const Attendance = mongoose.model("Attendance");
  const matchStage = {
    studentId: new mongoose.Types.ObjectId(this._id),
    tenantId: new mongoose.Types.ObjectId(this.tenantId),
  };

  // Overall stats
  const [overall] = await Attendance.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalClasses: { $sum: 1 },
        presentCount: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
        absentCount: { $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] } },
        leaveCount: { $sum: { $cond: [{ $eq: ["$status", "leave"] }, 1, 0] } },
      },
    },
  ]);

  // Per-subject stats
  const subjectAgg = await Attendance.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: "$subjectId",
        subjectName: { $first: "$subject.subjectName" },
        subjectCode: { $first: "$subject.subjectCode" },
        totalClasses: { $sum: 1 },
        presentCount: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
        absentCount: { $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] } },
        leaveCount: { $sum: { $cond: [{ $eq: ["$status", "leave"] }, 1, 0] } },
        lastAttended: { $max: "$date" },
      },
    },
    {
      $addFields: {
        percentage: {
          $cond: [
            { $eq: ["$totalClasses", 0] },
            0,
            { $multiply: [{ $divide: ["$presentCount", "$totalClasses"] }, 100] },
          ],
        },
      },
    },
  ]);

  if (overall) {
    this.attendance = {
      totalClasses: overall.totalClasses,
      presentCount: overall.presentCount,
      absentCount: overall.absentCount,
      leaveCount: overall.leaveCount,
      overallPercentage:
        overall.totalClasses > 0
          ? (overall.presentCount / overall.totalClasses) * 100
          : 0,
    };
  } else {
    this.attendance = {
      totalClasses: 0,
      presentCount: 0,
      absentCount: 0,
      leaveCount: 0,
      overallPercentage: 0,
    };
  }

  this.subjectAttendance = subjectAgg.map((s) => ({
    subjectId: s._id,
    subjectName: s.subjectName || "",
    subjectCode: s.subjectCode || "",
    totalClasses: s.totalClasses,
    presentCount: s.presentCount,
    absentCount: s.absentCount,
    leaveCount: s.leaveCount,
    percentage: s.percentage,
    lastAttended: s.lastAttended,
  }));

  await this.save();
};

userSchema.statics.bulkUpdateAttendance = async function (studentIds, tenantId) {
  const User = this;
  for (const studentId of studentIds) {
    const user = await User.findOne({ _id: studentId, tenantId });
    if (user && user.role === "student") await user.updateAttendanceSummary();
  }
};

userSchema.methods.getClassStatistics = async function (subjectId, section) {
  if (this.role !== "teacher") return null;
  const Attendance = mongoose.model("Attendance");
  const stats = await Attendance.aggregate([
    {
      $match: {
        subjectId: new mongoose.Types.ObjectId(subjectId),
        section: section,
        teacherId: this._id,
        tenantId: this.tenantId
      },
    },
    {
      $group: {
        _id: null,
        totalClasses: { $sum: 1 },
        totalStudents: { $addToSet: "$studentId" },
        presentCount: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
        absentCount: { $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] } },
        leaveCount: { $sum: { $cond: [{ $eq: ["$status", "leave"] }, 1, 0] } },
      },
    },
    {
      $project: {
        _id: 0,
        totalClasses: 1,
        totalStudents: { $size: "$totalStudents" },
        presentCount: 1,
        absentCount: 1,
        leaveCount: 1,
        averageAttendance: {
          $multiply: [
            { $divide: ["$presentCount", { $multiply: ["$totalClasses", { $size: "$totalStudents" }] }] },
            100,
          ],
        },
      },
    },
  ]);
  return stats[0] || { totalClasses: 0, totalStudents: 0, presentCount: 0, absentCount: 0, leaveCount: 0, averageAttendance: 0 };
};

// Pre-save middleware
userSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  if (this.role !== "admin" && this.role !== "super_admin" && this.rollNo) {
    this.rollNo = this.rollNo.trim().toUpperCase();
  }
  if (this.role === "student" && this.section) {
    this.section = this.section.trim().toUpperCase();
  }
  next();
});

userSchema.pre("findOneAndUpdate", function (next) {
  this.set({ updatedAt: Date.now() });
  next();
});

userSchema.index({ tenantId: 1, role: 1, section: 1 });
userSchema.index({ tenantId: 1, role: 1, isActive: 1 });

module.exports = mongoose.model("User", userSchema);