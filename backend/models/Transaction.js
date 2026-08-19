const mongoose = require("mongoose");

const transactionSchema = mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
  },
  feeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Fee",
    required: true,
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  amount: { type: Number, required: true },
  mode: {
    type: String,
    enum: ["cash", "online", "cheque", "bank_transfer"],
    required: true,
  },
  receiptNumber: { type: String, trim: true },
  transactionDate: { type: Date, default: Date.now },
  collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  notes: { type: String, trim: true },
  status: {
    type: String,
    enum: ["completed", "refunded", "failed"],
    default: "completed",
  },
}, { timestamps: true });

transactionSchema.index({ tenantId: 1, feeId: 1 });
transactionSchema.index({ tenantId: 1, studentId: 1 });
transactionSchema.index({ receiptNumber: 1, tenantId: 1 }, { unique: true });

module.exports = mongoose.model("Transaction", transactionSchema);
