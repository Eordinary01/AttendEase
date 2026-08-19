const mongoose = require("mongoose");

const branchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, uppercase: true },
    durationYears: { type: Number, required: true, min: 1, default: 3 },
    totalSemesters: { type: Number, required: true, min: 1, default: 6 },
    feeStructure: {
      enabled: { type: Boolean, default: false },
      totalFee: { type: Number, default: 0, min: 0 },
      description: { type: String, default: "", trim: true },
    },
    isActive: { type: Boolean, default: true },
  },
  { _id: true },
);

const courseSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    description: { type: String, default: "" },
    durationYears: { type: Number, default: 3, min: 1 },
    semestersPerYear: { type: Number, default: 2, enum: [2] },
    branches: [branchSchema],
    feeStructure: {
      enabled: { type: Boolean, default: false },
      totalFee: { type: Number, default: 0, min: 0 },
      description: { type: String, default: "", trim: true },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

courseSchema.index({ tenantId: 1, code: 1 }, { unique: true });

// Static helper to resolve a course + optional branch into a denormalized context
courseSchema.statics.resolveContext = async function (courseId, branchName, tenantId) {
  if (!courseId) return null;
  const course = await this.findOne({ _id: courseId, tenantId, isActive: true }).lean();
  if (!course) return null;

  const branch = branchName
    ? course.branches.find((b) => b.name.toLowerCase() === String(branchName).toLowerCase())
    : null;

  const totalSemesters = branch
    ? branch.totalSemesters
    : course.durationYears * course.semestersPerYear;

  return {
    courseId: course._id,
    courseName: course.name,
    branch: branch ? branch.name : branchName || "",
    totalSemesters,
    courseSemestersPerYear: course.semestersPerYear,
  };
};

module.exports = mongoose.model("Course", courseSchema);
