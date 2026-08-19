const mongoose = require("mongoose");

const subjectSchema = mongoose.Schema(
  {
    subjectCode: {
      type: String,
      required: true,
      // unique: true,
      uppercase: true,
      trim: true,
    },
    subjectName: {
      type: String,
      required: true,
      trim: true,
      // unique: true ,
    },
    description: {
      type: String,
      default: "",
    },
    credits: {
      type: Number,
      default: 0,
    },
    // Semester/Year info
    semester: {
      type: String,
      required: true,
      trim: true,
    },
    // Optional linkage to academic structure (Course model)
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", default: null },
    branch: { type: String, trim: true, default: "" },
    // Course code or program name (legacy free-text)
    courseCode: {
      type: String,
      trim: true,
    },
    // Track which admin created this
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
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

    department: String, // CSE, ECE, ME, etc.
    year: Number, // 1, 2, 3, 4

    //  Subject metadata
    isElective: { type: Boolean, default: false },
    prerequisites: [{ type: mongoose.Schema.Types.ObjectId, ref: "Subject" }],
    syllabus: String,
    outcomes: [String],
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Index for faster queries
subjectSchema.index({ subjectCode: 1 });
subjectSchema.index({ semester: 1 });

subjectSchema.index({ courseCode: 1 });

subjectSchema.index({ tenantId: 1, subjectCode: 1 }, { unique: true });

module.exports = mongoose.model("Subject", subjectSchema);
