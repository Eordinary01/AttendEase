// models/SupportTicket.js
const mongoose = require('mongoose');

const adminNoteSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true,
    maxlength: 1000
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  addedByName: { type: String },
  addedByRole: { type: String },
  addedAt: { type: Date, default: Date.now }
}, { _id: true });

const supportTicketSchema = new mongoose.Schema({
  // Which tenant raised this ticket
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },
  tenantName: { type: String },   // denormalized for quick display

  // Who raised it (the admin user)
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  submitterName:  { type: String },
  submitterEmail: { type: String },

  // Ticket content
  subject: {
    type: String,
    required: true,
    trim: true,
    minlength: 5,
    maxlength: 150
  },
  description: {
    type: String,
    required: true,
    trim: true,
    minlength: 20,
    maxlength: 2000
  },
  category: {
    type: String,
    enum: ['trial_expired', 'billing', 'technical', 'account', 'other'],
    default: 'other'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },

  // Lifecycle
  status: {
    type: String,
    enum: ['open', 'in_progress', 'resolved', 'closed'],
    default: 'open'
  },

  // Super admin resolution
  resolution: {
    type: String,
    trim: true,
    maxlength: 2000
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  resolvedByName: { type: String },
  resolvedAt:     { type: Date },

  // Whether this ticket triggered tenant reactivation
  tenantReactivated: { type: Boolean, default: false },

  // Internal notes (super admin only)
  adminNotes: [adminNoteSchema],

  // Subscription context at the time of ticket creation (for reference)
  subscriptionContext: {
    plan:   { type: String },
    status: { type: String }
  }
}, {
  timestamps: true
});

// Indexes
supportTicketSchema.index({ tenantId: 1, createdAt: -1 });
supportTicketSchema.index({ status: 1, createdAt: -1 });
supportTicketSchema.index({ submittedBy: 1 });
supportTicketSchema.index({ category: 1 });

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
