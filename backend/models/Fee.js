const mongoose = require("mongoose");

const feeSchema = mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Course",
  },
  section: {
    type: String,
    uppercase: true,
    trim: true,
  },
  branch: {
    type: String,
    uppercase: true,
    trim: true,
  },
  semester: {
    type: Number,
    min: 1,
  },
  feeType: {
    type: String,
    enum: ["tuition", "transport", "hostel", "other"],
    default: "tuition",
  },
  amount: { type: Number, required: true },
  paidAmount: { type: Number, default: 0 },
  dueDate: { type: Date, required: true },
  description: { type: String, trim: true },
  status: {
    type: String,
    enum: ["pending", "partial", "paid", "waived", "overdue"],
    default: "pending",
  },
  lateFee: { type: Number, default: 0 },
  academicYear: { type: String, trim: true },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

feeSchema.index({ tenantId: 1, studentId: 1 });
feeSchema.index({ tenantId: 1, status: 1 });
feeSchema.index({ tenantId: 1, dueDate: 1 });
feeSchema.index({ tenantId: 1, courseId: 1, section: 1, semester: 1 });
feeSchema.index({ tenantId: 1, courseId: 1, branch: 1, semester: 1 });

module.exports = mongoose.model("Fee", feeSchema);
