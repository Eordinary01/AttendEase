const mongoose = require('mongoose');

const leaveAttachmentSchema = new mongoose.Schema(
  {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
    },
    url: {
      type: String,
      default: '',
    },
    publicId: {
      type: String,
      default: '',
    },
    originalName: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      default: '',
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    bytes: {
      type: Number,
      default: 0,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const approvalStepSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['teacher', 'mentor', 'hod', 'dean', 'admin'],
      required: true,
    },
    approverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    approverName: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'needs-more-info'],
      default: 'pending',
    },
    remarks: {
      type: String,
      default: '',
      trim: true,
      maxlength: 1000,
    },
    actedAt: {
      type: Date,
    },
  },
  { _id: true }
);

const leaveRequestSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    student: {
      name: { type: String, required: true },
      rollNo: { type: String, default: '' },
      section: { type: String, required: true, uppercase: true, trim: true },
      email: { type: String, default: '' },
    },
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
    // Optional subject scope (if null, leave applies across all scheduled classes in section)
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      default: null,
      index: true,
    },
    // Multi-subject partial leave support
    subjectIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject',
      },
    ],
    subjectInfo: {
      subjectCode: { type: String, default: '' },
      subjectName: { type: String, default: '' },
    },
    flowType: {
      type: String,
      enum: ['single-subject', 'subject-specific', 'all-classes', 'multi-subject'],
      default: 'single-subject',
      index: true,
    },
    assignedTeacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    mentorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    isSyntheticMentor: {
      type: Boolean,
      default: false,
    },
    examPeriodConflict: {
      type: Boolean,
      default: false,
    },
    leaveType: {
      type: String,
      enum: ['medical', 'od', 'personal', 'bereavement', 'other'],
      required: true,
      index: true,
    },
    fromDate: {
      type: Date,
      required: true,
      index: true,
    },
    toDate: {
      type: Date,
      required: true,
      index: true,
    },
    // Optional half-day / single timetable slot selection
    sessionSlot: {
      timetableId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Timetable',
        default: null,
      },
      day: { type: String, default: '' },
      startTime: { type: String, default: '' },
      endTime: { type: String, default: '' },
      room: { type: String, default: '' },
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    reasonDescription: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    attachments: [leaveAttachmentSchema],
    status: {
      type: String,
      enum: [
        'pending',
        'approved',
        'rejected',
        'cancelled',
        'cancelled-pending-revert',
        'attendance-updated',
      ],
      default: 'pending',
      index: true,
    },
    approvalChain: [approvalStepSchema],
    currentApproverRole: {
      type: String,
      enum: ['teacher', 'mentor', 'hod', 'dean', 'admin'],
      default: 'teacher',
    },
    reconciliationStatus: {
      type: String,
      enum: ['pending', 'partial', 'completed', 'reverted'],
      default: 'pending',
    },
    reconciliationMeta: {
      updatedCount: { type: Number, default: 0 },
      createdCount: { type: Number, default: 0 },
      skippedCount: { type: Number, default: 0 },
      reconciledAt: { type: Date },
      notes: { type: String, default: '' },
    },
    // Cancellation & Revert Audit Trail
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    revertOutcome: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for optimal tenant-scoped queries
leaveRequestSchema.index({ tenantId: 1, studentId: 1, fromDate: -1 });
leaveRequestSchema.index({ tenantId: 1, section: 1, fromDate: -1 });
leaveRequestSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
leaveRequestSchema.index({ tenantId: 1, subjectId: 1, fromDate: -1 });
leaveRequestSchema.index({ tenantId: 1, mentorId: 1, status: 1 });
leaveRequestSchema.index({ tenantId: 1, assignedTeacherId: 1, status: 1 });

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);

