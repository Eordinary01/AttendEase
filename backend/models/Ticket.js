const mongoose = require('mongoose');

const proofDocumentSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    default: () => new mongoose.Types.ObjectId()
  },
  filename: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  fileType: {
    type: String,
    enum: ['medical', 'permission', 'other'],
    default: 'other'
  },
  fileSize: Number,
  mimeType: String,
  uploadedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

const ticketSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  student: {
    name: String,
    rollNo: String,
    section: String,
    email: String
  },
  subjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: true
  },
  subjectInfo: {
    subjectCode: String,
    subjectName: String
  },
  absentDate: {
    type: Date,
    required: true
  },
  reason: {
    type: String,
    enum: ['medical', 'family-emergency', 'institutional-work', 'other'],
    required: true
  },
  reasonDescription: {
    type: String,
    required: true,
    minlength: 10,
    maxlength: 500
  },
  proofDocuments: [proofDocumentSchema],
  status: {
    type: String,
    enum: ['open', 'under-review', 'verified', 'rejected', 'attendance-updated'],
    default: 'open'
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected', 'needs-more-info'],
    default: 'pending'
  },
  verificationRemarks: String,
  assignedTeacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  assignedTeacher: {
    name: String,
    email: String
  },
  verifiedByTeacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verifiedTeacher: {
    name: String,
    email: String
  },
  verifiedAt: Date,
  attendanceMarked: {
    type: Boolean,
    default: false
  },
  attendanceMarkedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  attendanceMarkedAt: Date,
  internalNotes: [{
    noteBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    noteByName: String,
    content: String,
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  }
}, {
  timestamps: true
});

// Indexes for better performance
ticketSchema.index({ studentId: 1, createdAt: -1 });
ticketSchema.index({ subjectId: 1, verificationStatus: 1 });
ticketSchema.index({ assignedTeacherId: 1, verificationStatus: 1 });
ticketSchema.index({ verifiedByTeacherId: 1 });
ticketSchema.index({ status: 1 });
ticketSchema.index({ tenantId: 1, studentId: 1, createdAt: -1 });
ticketSchema.index({ tenantId: 1, assignedTeacherId: 1, verificationStatus: 1 });
ticketSchema.index({ tenantId: 1, verifiedByTeacherId: 1, status: 1 });
ticketSchema.index({ tenantId: 1, status: 1 });

module.exports = mongoose.model('Ticket', ticketSchema);