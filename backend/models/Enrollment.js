const mongoose = require("mongoose");

const enrollmentSchema = mongoose.Schema(
  {
    enrollmentNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    section: {
      type: String,
      required: true,
      trim: true,
    },
    // Track if student has registered
    isRegistered: {
      type: Boolean,
      default: false,
    },
    // When student registered
    registeredAt: {
      type: Date,
      default: null,
    },
    // Link to User model after registration
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // Subjects assigned to this student based on their section
    subjects: [
      {
        subjectId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Subject",
          required: true,
        },
        subjectName: {
          type: String,
          required: true,
        },
        subjectCode: {
          type: String,
          default: "", // Optional: if subjects have codes
        },
        teacherId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        teacherName: {
          type: String,
          required: true,
        },
        assignedAt: {
          type: Date,
          default: Date.now,
        },
        // Optional: track if subject is active for current semester
        isActive: {
          type: Boolean,
          default: true,
        },
      },
    ],
    // Admin notes (optional)
    notes: {
      type: String,
      default: "",
    },
    // Track when enrollment was uploaded
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    // Which admin uploaded this
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },

    // NEW: Academic year tracking
    academicYear: String,
    semester: Number,

    // NEW: Academic structure (course/branch)
    courseName: { type: String, trim: true, default: "" },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", default: null },
    branch: { type: String, trim: true, default: "" },
    admissionYear: Number,
    totalSemesters: Number,

    // NEW: Parent/guardian contact details (captured at upload time)
    parentName: { type: String, trim: true },
    parentPhone: { type: String, trim: true },
    parentEmail: { type: String, lowercase: true, trim: true },

    // NEW: Enrollment status
    enrollmentStatus: {
      type: String,
      enum: ["active", "transferred", "graduated", "dropped"],
      default: "active",
    },
  },
  { timestamps: true },
);

// Indexes for faster queries
enrollmentSchema.index({ email: 1 });
enrollmentSchema.index({ section: 1 });
enrollmentSchema.index({ isRegistered: 1 });
enrollmentSchema.index({ "subjects.subjectId": 1 });
enrollmentSchema.index({ "subjects.teacherId": 1 });

// Tenant-scoped compound indexes
enrollmentSchema.index({ tenantId: 1, enrollmentNumber: 1 }, { unique: true });
enrollmentSchema.index({ tenantId: 1, email: 1 });
enrollmentSchema.index({ tenantId: 1, section: 1 });
enrollmentSchema.index({ tenantId: 1, isRegistered: 1 });

// Method to get active subjects
enrollmentSchema.methods.getActiveSubjects = function () {
  return this.subjects.filter((subject) => subject.isActive);
};

// Static method to update subjects for entire section
// Optional { courseId, semester } scoping prevents cross-course contamination
enrollmentSchema.statics.updateSectionSubjects = async function (
  section,
  subjectData,
  teacherData,
  tenantId,
  { courseId, semester } = {}
) {
  const filter = { section: section, tenantId: tenantId };
  if (courseId) filter.courseId = courseId;
  if (semester) filter.semester = semester;

  return await this.updateMany(
    filter,
    {
      $addToSet: {
        subjects: {
          subjectId: subjectData._id,
          subjectName: subjectData.subjectName,
          subjectCode: subjectData.subjectCode || "",
          teacherId: teacherData._id,
          teacherName: teacherData.name,
          assignedAt: new Date(),
        },
      },
    },
  );
};

// Static method to remove subject from section
// Optional { courseId, semester } scoping prevents cross-course contamination
enrollmentSchema.statics.removeSubjectFromSection = async function (
  section,
  subjectId,
  tenantId,
  { courseId, semester } = {}
) {
  const filter = { section: section, tenantId: tenantId };
  if (courseId) filter.courseId = courseId;
  if (semester) filter.semester = semester;

  return await this.updateMany(
    filter,
    {
      $pull: {
        subjects: { subjectId: subjectId },
      },
    },
  );
};

module.exports = mongoose.model("Enrollment", enrollmentSchema);
