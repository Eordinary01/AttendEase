const mongoose = require('mongoose');

const mentorAssignmentSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    teacherName: {
      type: String,
      required: true,
      trim: true,
    },
    teacherEmail: {
      type: String,
      trim: true,
      default: '',
    },
    // Academic cohort scoping
    section: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      default: null,
      index: true,
    },
    branch: {
      type: String,
      trim: true,
      default: '',
    },
    semester: {
      type: String,
      trim: true,
      default: '',
    },
    isPrimary: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Unique composite index: one mentor per academic cohort configuration per teacher
mentorAssignmentSchema.index(
  { tenantId: 1, section: 1, courseId: 1, branch: 1, semester: 1, teacherId: 1 },
  { unique: true }
);

mentorAssignmentSchema.index({ tenantId: 1, teacherId: 1, isActive: 1 });
mentorAssignmentSchema.index({ tenantId: 1, section: 1, isActive: 1 });

module.exports = mongoose.model('MentorAssignment', mentorAssignmentSchema);
