const mongoose = require("mongoose");

const examResultSchema = mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
  },
  examId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Exam",
    required: true,
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  marksObtained: { type: Number, default: 0 },
  maxMarks: { type: Number, required: true },
  percentage: { type: Number, default: 0 },
  grade: {
    type: String,
    enum: ["A+", "A", "B+", "B", "C+", "C", "D", "F", "I", ""],
    default: "",
  },
  remarks: { type: String, trim: true },
  status: {
    type: String,
    enum: ["pending", "graded"],
    default: "pending",
  },
  gradedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  gradedAt: { type: Date },
}, { timestamps: true });

examResultSchema.index({ tenantId: 1, examId: 1 });
examResultSchema.index({ tenantId: 1, studentId: 1 });
examResultSchema.index({ examId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model("ExamResult", examResultSchema);
