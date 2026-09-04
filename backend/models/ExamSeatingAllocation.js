const mongoose = require("mongoose");

const examSeatingAllocationSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
      required: true,
      index: true,
    },
    examPeriodId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    shift: {
      type: String,
      enum: ["I", "II", "III", "IV"],
      default: "I",
    },
    examDate: {
      type: Date,
      required: true,
      index: true,
    },
    startTime: {
      type: String,
      trim: true,
    },
    endTime: {
      type: String,
      trim: true,
    },
    hallId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExamHall",
      required: true,
      index: true,
    },
    hallCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    hallName: {
      type: String,
      trim: true,
    },
    seatNumber: {
      type: String,
      required: true,
      trim: true,
    },
    row: {
      type: Number,
      required: true,
    },
    col: {
      type: Number,
      required: true,
    },
    benchPosition: {
      type: Number,
      default: 1,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    studentName: {
      type: String,
      required: true,
      trim: true,
    },
    studentRollNo: {
      type: String,
      trim: true,
      default: "",
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
    },
    courseName: {
      type: String,
      trim: true,
    },
    branch: {
      type: String,
      trim: true,
    },
    semester: {
      type: Number,
    },
    section: {
      type: String,
      trim: true,
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
    },
    subjectCode: {
      type: String,
      trim: true,
    },
    subjectName: {
      type: String,
      trim: true,
    },
    ticketHash: {
      type: String,
      trim: true,
    },
    qrPayload: {
      type: String,
      trim: true,
    },
    attendanceStatus: {
      type: String,
      enum: ["pending", "present", "absent", "malpractice"],
      default: "pending",
      index: true,
    },
    checkedInAt: {
      type: Date,
    },
    checkedInBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    checkInMethod: {
      type: String,
      enum: ["qr_scan", "manual"],
      default: "manual",
    },
    remarks: {
      type: String,
      trim: true,
      default: "",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// Compound Unique Indexes for Guaranteed Conflict Prevention
examSeatingAllocationSchema.index({ tenantId: 1, examId: 1, studentId: 1 }, { unique: true });
examSeatingAllocationSchema.index(
  { tenantId: 1, examDate: 1, shift: 1, hallId: 1, row: 1, col: 1, benchPosition: 1 },
  { unique: true }
);
examSeatingAllocationSchema.index({ tenantId: 1, studentId: 1, examDate: -1 });
examSeatingAllocationSchema.index({ tenantId: 1, hallId: 1, examDate: 1, shift: 1 });

module.exports = mongoose.model("ExamSeatingAllocation", examSeatingAllocationSchema);
