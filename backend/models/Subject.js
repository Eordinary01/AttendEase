const mongoose = require("mongoose");

const subjectSchema = mongoose.Schema(
  {
    subjectCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },
    subjectName: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },
    description: {
      type: String,
      default: ""
    },
    credits: {
      type: Number,
      default: 0
    },
    // Semester/Year info
    semester: {
      type: String,
      required: true,
      trim: true
    },
    // Course code or program name
    courseCode: {
      type: String,
      trim: true
    },
    // Track which admin created this
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

// Index for faster queries
subjectSchema.index({ subjectCode: 1 });
subjectSchema.index({ semester: 1 });
subjectSchema.index({ subjectName: 1 });
subjectSchema.index({ courseCode: 1 });

module.exports = mongoose.model('Subject', subjectSchema);