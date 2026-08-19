const mongoose = require("mongoose");

const examSchema = mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
  },
  subjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Subject",
    required: true,
  },
  subjectName: { type: String, required: true },
  subjectCode: { type: String },
  section: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  type: {
    type: String,
    default: "quiz",
  },
  examTypeCode: { type: String },
  examPeriodId: { type: mongoose.Schema.Types.ObjectId },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
  branch: { type: String },
  semester: { type: Number },
  shift: {
    type: String,
    enum: ["I", "II", "III", "IV"],
  },
  duration: { type: Number },
  date: { type: Date, required: true },
  startTime: { type: String },
  endTime: { type: String },
  maxMarks: { type: Number, required: true },
  passingMarks: { type: Number, default: 0 },
  room: { type: String, trim: true },
  invigilators: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  }],
  description: { type: String, trim: true },
  status: {
    type: String,
    enum: ["scheduled", "in_progress", "completed", "cancelled"],
    default: "scheduled",
  },
  resultStatus: {
    type: String,
    enum: ["draft", "published"],
    default: "draft",
  },
  isBacklog: {
    type: Boolean,
    default: false,
  },
  publishedAt: { type: Date },
  publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

examSchema.index({ tenantId: 1, section: 1, date: -1 });
examSchema.index({ tenantId: 1, subjectId: 1, date: -1 });
examSchema.index({ tenantId: 1, status: 1 });
examSchema.index({ tenantId: 1, section: 1, date: 1, shift: 1 });
examSchema.index({ tenantId: 1, date: 1, invigilators: 1 });

module.exports = mongoose.model("Exam", examSchema);
