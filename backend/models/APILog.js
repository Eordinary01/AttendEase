// models/APILog.js
const mongoose = require('mongoose');

const apiLogSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  endpoint: {
    type: String,
    required: true
  },
  method: {
    type: String,
    required: true,
    enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ACTION']
  },
  description: {
    type: String,
    default: ''
  },
  statusCode: Number,
  responseTime: Number,
  ipAddress: String,
  userAgent: String,
  requestId: { type: String, index: true },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
    expires: 86400 // Auto-delete after 24 hours
  }
});

// Create index for faster queries
apiLogSchema.index({ tenantId: 1, createdAt: -1 });
apiLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('APILog', apiLogSchema);
