// models/Alert.js
const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  title: {
    type: String,
    default: 'Announcement',
    trim: true,
    maxlength: 100
  },
  type: {
    type: String,
    enum: ['short_term', 'announcement'],
    default: 'announcement'
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isPlatformAlert: {
    type: Boolean,
    default: false
  },
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    default: null,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  targetRoles: [{
    type: String,
    enum: ['student', 'teacher', 'admin', 'super_admin'],
    default: ['student', 'teacher', 'admin']
  }],
  targetSections: [{
    type: String,
    uppercase: true,
    trim: true
  }],
  targetCourseIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course'
  }],
  targetBranches: [{
    type: String,
    trim: true
  }],
  targetSubjectIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject'
  }],
  expiryDate: {
    type: Date,
    default: null
  },
  metadata: {
    createdAt: { type: Date, default: Date.now },
    updatedAt: Date,
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdByRole: String,
    createdByName: String
  },
  deletedAt: Date,
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Indexes
alertSchema.index({ tenantId: 1, createdAt: -1 });
alertSchema.index({ tenantId: 1, targetRoles: 1, createdAt: -1 });
alertSchema.index({ tenantId: 1, isActive: 1, expiryDate: 1 });
alertSchema.index({ tenantId: 1, targetSections: 1 });
alertSchema.index({ isPlatformAlert: 1, createdAt: -1 });
alertSchema.index({ priority: 1 });
alertSchema.index({ expiryDate: 1 });

module.exports = mongoose.model('Alert', alertSchema);