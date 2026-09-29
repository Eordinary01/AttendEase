const mongoose = require('mongoose');

const semesterPromotionSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    jobId: {
      type: String,
      default: null,
    },
    type: {
      type: String,
      enum: ['manual', 'background_batch', 'auto_scanner'],
      default: 'manual',
    },
    promotedCount: {
      type: Number,
      default: 0,
    },
    graduatedCount: {
      type: Number,
      default: 0,
    },
    eligibleCount: {
      type: Number,
      default: 0,
    },
    skippedCount: {
      type: Number,
      default: 0,
    },
    failedCount: {
      type: Number,
      default: 0,
    },
    details: [
      {
        id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        name: String,
        rollNo: String,
        section: String,
        from: Number,
        to: Number,
        graduated: Boolean,
      },
    ],
    runBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    runByName: {
      type: String,
      default: 'System',
    },
    status: {
      type: String,
      enum: ['completed', 'failed', 'partial'],
      default: 'completed',
    },
    executedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('SemesterPromotion', semesterPromotionSchema);
