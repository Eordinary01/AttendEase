const mongoose = require("mongoose");

const timetableSchema = mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
  },
  day: {
    type: String,
    enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    required: true,
  },
  startTime: {
    type: String,
    required: true,
  },
  endTime: {
    type: String,
    required: true,
  },
  isNoClass: {
    type: Boolean,
    default: false,
  },
  subjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Subject",
  },
  subjectName: {
    type: String,
    default: "No Class",
  },
  subjectCode: {
    type: String,
    default: "",
  },
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  teacherName: {
    type: String,
    default: "N/A",
  },
  section: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
  },
  room: {
    type: String,
    trim: true,
    default: "",
  },
  semester: {
    type: String,
    trim: true,
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Course",
  },
  courseCode: {
    type: String,
    uppercase: true,
    trim: true,
    default: "",
  },
  branch: {
    type: String,
    trim: true,
    default: "",
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  isDeleted: {
    type: Boolean,
    default: false,
    index: true,
  },
  deletedAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

timetableSchema.index({ tenantId: 1, section: 1, day: 1, startTime: 1 });
timetableSchema.index({ tenantId: 1, section: 1, day: 1, isActive: 1 });
timetableSchema.index({ tenantId: 1, teacherId: 1, day: 1 });
timetableSchema.index({ tenantId: 1, subjectId: 1 });

module.exports = mongoose.model("Timetable", timetableSchema);
