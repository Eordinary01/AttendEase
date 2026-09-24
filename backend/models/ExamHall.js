const mongoose = require("mongoose");

const examHallSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    hallCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    building: {
      type: String,
      trim: true,
      default: "Main Block",
    },
    floor: {
      type: String,
      trim: true,
      default: "Ground Floor",
    },
    rows: {
      type: Number,
      required: true,
      default: 8,
      min: 1,
      max: 50,
    },
    cols: {
      type: Number,
      required: true,
      default: 5,
      min: 1,
      max: 30,
    },
    capacity: {
      type: Number,
      required: true,
      default: 40,
      min: 1,
    },
    benchCapacity: {
      type: Number,
      default: 1,
      min: 1,
      max: 3,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// Compound Unique Index per Tenant
examHallSchema.index({ tenantId: 1, hallCode: 1 }, { unique: true });
examHallSchema.index({ tenantId: 1, isActive: 1 });

module.exports = mongoose.model("ExamHall", examHallSchema);
