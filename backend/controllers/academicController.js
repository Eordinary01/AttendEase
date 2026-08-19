const Course = require("../models/Course");
const User = require("../models/User");
const Enrollment = require("../models/Enrollment");
const Subject = require("../models/Subject");
const Tenant = require("../models/Tenant");
const logger = require("../utils/logger");
const { toObjectId } = require("../utils/sanitize");

const sanitizeStr = (v) => (v === undefined || v === null ? "" : String(v).trim());

/**
 * Expected semester for a student based on admission year + current date.
 * 1 academic year = `semestersPerYear` semesters (default 2). Terms roll over
 * every `12 / semestersPerYear` months starting from `academicStartMonth`.
 */
const getExpectedSemester = (admissionYear, academicStartMonth, semestersPerYear) => {
  if (!admissionYear || isNaN(Number(admissionYear))) return null;
  const year = Number(admissionYear);
  const monthsPerSemester = 12 / (semestersPerYear === 1 ? 1 : 2);
  const startMonth = typeof academicStartMonth === "number" ? academicStartMonth : 5;
  const now = new Date();
  const elapsed = now.getFullYear() * 12 + now.getMonth() - (year * 12 + startMonth);
  if (elapsed < 0) return 1;
  return 1 + Math.floor(elapsed / monthsPerSemester);
};

const getTenant = async (req) => {
  const tenantId = req.user.tenantId;
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) return null;
  if (!tenant.settings.semesterStructure) {
    tenant.settings.semesterStructure = { semestersPerYear: 2, autoPromote: true, academicStartMonth: 5 };
  }
  return tenant;
};

/**
 * GET /api/academic/courses
 * List all courses for the tenant (with branches).
 */
const getCourses = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10);
    const limit = parseInt(req.query.limit, 10);
    const usePagination = !isNaN(page) && page > 0;

    const courses = await Course.find({ tenantId: req.user.tenantId, isActive: true })
      .sort({ name: 1 })
      .lean();

    const total = courses.length;
    if (usePagination) {
      const pageNum = Math.max(1, page);
      const pageSize = Math.max(1, limit || 10);
      const skip = (pageNum - 1) * pageSize;
      const paginated = courses.slice(skip, skip + pageSize);
      return res.status(200).json({
        success: true,
        data: paginated,
        pagination: { total, page: pageNum, limit: pageSize, pages: Math.ceil(total / pageSize) || 1 }
      });
    }

    return res.status(200).json({
      success: true,
      data: courses,
      pagination: { total, page: 1, limit: total, pages: 1 }
    });
  } catch (error) {
    logger.error("Error fetching courses", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to fetch courses" });
  }
};

/**
 * POST /api/academic/courses
 * Create a course with branches (each branch has its own duration + total semesters).
 */
const createCourse = async (req, res) => {
  try {
    const { name, code, description, durationYears, semestersPerYear, branches, feeStructure } = req.body;

    if (!name || !code) {
      return res.status(400).json({ success: false, message: "Course name and code are required" });
    }

    const cleanCode = sanitizeStr(code).toUpperCase();
    const existing = await Course.findOne({ tenantId: req.user.tenantId, code: cleanCode });
    if (existing) {
      if (!existing.isActive) {
        await Course.deleteOne({ _id: existing._id });
      } else {
        return res.status(400).json({ success: false, message: "A course with this code already exists" });
      }
    }

    const courseSemestersPerYear = 2;
    const course = await Course.create({
      tenantId: req.user.tenantId,
      name: sanitizeStr(name),
      code: cleanCode,
      description: sanitizeStr(description),
      durationYears: Number(durationYears) || 3,
      semestersPerYear: 2,
      branches: Array.isArray(branches) && branches.length > 0
        ? branches.map((b) => ({
            name: sanitizeStr(b.name),
            code: sanitizeStr(b.code).toUpperCase(),
            durationYears: Number(b.durationYears) || Number(durationYears) || 3,
            totalSemesters: Number(b.totalSemesters) || (Number(b.durationYears) || 3) * 2,
            feeStructure: b.feeStructure ? {
              enabled: Boolean(b.feeStructure.enabled),
              totalFee: Number(b.feeStructure.totalFee) || 0,
              description: typeof b.feeStructure.description === "string" ? b.feeStructure.description : "",
            } : (b.totalFee ? { enabled: true, totalFee: Number(b.totalFee) || 0, description: "" } : undefined),
            isActive: true,
          }))
        : [],
      feeStructure: feeStructure ? {
        enabled: Boolean(feeStructure.enabled),
        totalFee: Number(feeStructure.totalFee) || 0,
        description: typeof feeStructure.description === "string" ? feeStructure.description : "",
      } : undefined,
      createdBy: req.user._id,
    });

    return res.status(201).json({ success: true, message: "Course created successfully", data: course });
  } catch (error) {
    logger.error("Error creating course", { error: error.message });
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "A course with this code already exists" });
    }
    return res.status(500).json({ success: false, message: "Failed to create course" });
  }
};

/**
 * POST /api/academic/courses/bulk
 * Transactional bulk creation (plan-gated by bulk_operations). Rejects the
 * whole file if any row is invalid — mirrors bulkCreateExams: per-row errors are
 * reported and nothing is inserted when a row fails.
 */
const bulkCreateCourses = async (req, res) => {
  try {
    const { courses } = req.body;
    if (!Array.isArray(courses) || courses.length === 0) {
      return res.status(400).json({ success: false, message: "Courses array is required" });
    }

    const rawTenantId = req.tenantId || req.user?.tenantId || req.tenant?._id;
    const tenantId = toObjectId(rawTenantId);
    const existing = await Course.find({ tenantId }).select("code").lean();
    const existingCodes = new Set(existing.map((c) => String(c.code).toUpperCase()));
    const seenCodes = new Set();

    const rowErrors = [];
    const valid = [];

    for (let i = 0; i < courses.length; i++) {
      const raw = courses[i] || {};
      const errors = [];

      const name = sanitizeStr(raw.name);
      const code = sanitizeStr(raw.code).toUpperCase();
      const courseSemestersPerYear = 2;
      const durationYears = Number(raw.durationYears) || 3;

      // branches may arrive as a real array (JSON body) or a JSON string (CSV/Excel)
      let rawBranches = raw.branches;
      if (typeof rawBranches === "string") {
        try {
          rawBranches = JSON.parse(rawBranches);
        } catch (e) {
          rawBranches = null;
        }
      }

      let branches = [];
      if (Array.isArray(rawBranches) && rawBranches.length > 0) {
        branches = rawBranches
          .filter((b) => b && (typeof b === "object" || typeof b === "string"))
          .map((b) => {
            const obj = typeof b === "string" ? { name: b, code: b } : b;
            const brName = sanitizeStr(obj.name);
            const brCode = sanitizeStr(obj.code) || brName;
            const brFee = Number(obj.feeAmount) || Number(obj.totalFee) || (obj.feeStructure?.totalFee ? Number(obj.feeStructure.totalFee) : 0);
            return {
              name: brName,
              code: brCode.toUpperCase(),
              durationYears: Number(obj.durationYears) || durationYears,
              totalSemesters: Number(obj.totalSemesters) || (Number(obj.durationYears) || durationYears) * 2,
              feeStructure: brFee > 0 ? {
                enabled: true,
                totalFee: brFee,
                description: `Branch tuition fee for ${brName}`,
              } : undefined,
              isActive: true,
            };
          });
        if (branches.some((b) => !b.name)) {
          errors.push("Each branch in branches list must have a name");
        }
      }

      if (!name) errors.push("Course Name is required");
      if (!code) errors.push("Course Code is required");
      else if (existingCodes.has(code)) errors.push(`Course Code '${code}' already exists in your institution`);
      else if (seenCodes.has(code)) errors.push(`Course Code '${code}' is repeated multiple times in your file`);
      seenCodes.add(code);

      if (errors.length > 0) {
        rowErrors.push({ index: i, error: errors.join("; ") });
        continue;
      }

      const courseTotalFee = Number(raw.totalFee) || (raw.feeStructure?.totalFee ? Number(raw.feeStructure.totalFee) : 0);
      const feeStructure = courseTotalFee > 0 ? {
        enabled: true,
        totalFee: courseTotalFee,
        description: raw.feeDescription || raw.feeStructure?.description || `Base fee for ${name}`,
      } : undefined;

      valid.push({
        tenantId,
        name,
        code,
        description: sanitizeStr(raw.description),
        durationYears,
        semestersPerYear: 2,
        branches,
        feeStructure,
        isActive: raw.isActive !== undefined && raw.isActive !== "" ? (raw.isActive === true || raw.isActive === "true" || raw.isActive === "TRUE") : true,
        createdBy: toObjectId(req.user._id),
      });
    }

    if (rowErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Bulk course import failed: ${rowErrors.length} row(s) contain errors. Please review the highlighted issues below.`,
        errors: rowErrors,
      });
    }

    const createdDocs = [];
    const INSERT_CHUNK = 1000;
    for (let i = 0; i < valid.length; i += INSERT_CHUNK) {
      const chunk = valid.slice(i, i + INSERT_CHUNK);
      const inserted = await Course.insertMany(chunk, { ordered: false });
      createdDocs.push(...inserted);
    }
    return res.status(201).json({ success: true, message: `${createdDocs.length} courses created successfully`, count: createdDocs.length, data: createdDocs });
  } catch (error) {
    logger.error("Error bulk creating courses", { error: error.message });
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "One or more course codes already exist", error: error.message });
    }
    return res.status(500).json({ success: false, message: "Failed to bulk create courses" });
  }
};

/**
 * PUT /api/academic/courses/:id
 * Update a course (name, code, duration, semestersPerYear, branches).
 */
const updateCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, description, durationYears, semestersPerYear, branches, isActive, feeStructure } = req.body;

    const course = await Course.findOne({ _id: id, tenantId: req.user.tenantId });
    if (!course) return res.status(404).json({ success: false, message: "Course not found" });

    if (name !== undefined) course.name = sanitizeStr(name);
    if (description !== undefined) course.description = sanitizeStr(description);
    if (durationYears !== undefined) course.durationYears = Number(durationYears) || course.durationYears;
    if (semestersPerYear !== undefined) course.semestersPerYear = 2;
    if (isActive !== undefined) course.isActive = Boolean(isActive);

    if (feeStructure !== undefined) {
      course.feeStructure = {
        enabled: Boolean(feeStructure.enabled),
        totalFee: Number(feeStructure.totalFee) || 0,
        description: typeof feeStructure.description === "string" ? feeStructure.description : "",
      };
    }

    if (code !== undefined) {
      const cleanCode = sanitizeStr(code).toUpperCase();
      const dup = await Course.findOne({ tenantId: req.user.tenantId, code: cleanCode, _id: { $ne: course._id } });
      if (dup) return res.status(409).json({ success: false, message: "A course with this code already exists" });
      course.code = cleanCode;
    }

    if (Array.isArray(branches)) {
      course.branches = branches.map((b) => ({
        name: sanitizeStr(b.name),
        code: sanitizeStr(b.code).toUpperCase(),
        durationYears: Number(b.durationYears) || 3,
        totalSemesters: Number(b.totalSemesters) || (Number(b.durationYears) || 3) * 2,
        feeStructure: b.feeStructure ? {
          enabled: Boolean(b.feeStructure.enabled),
          totalFee: Number(b.feeStructure.totalFee) || 0,
          description: typeof b.feeStructure.description === "string" ? b.feeStructure.description : "",
        } : (b.totalFee !== undefined ? { enabled: Number(b.totalFee) > 0, totalFee: Number(b.totalFee) || 0, description: "" } : undefined),
        isActive: b.isActive !== false,
      }));
    }

    await course.save();
    return res.status(200).json({ success: true, message: "Course updated successfully", data: course });
  } catch (error) {
    logger.error("Error updating course", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to update course" });
  }
};

/**
 * DELETE /api/academic/courses/:id
 * Delete a course. Refuse if students or subjects are linked to it unless force=true.
 */
const deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const force = req.query.force === "true" || req.body?.force === true;
    const tenantId = req.user.tenantId;

    const course = await Course.findOne({ _id: id, tenantId });
    if (!course) return res.status(404).json({ success: false, message: "Course not found" });

    const [linkedStudents, linkedSubjects] = await Promise.all([
      User.countDocuments({ tenantId, role: "student", $or: [{ courseId: id }, { courseName: course.name }] }),
      Subject.countDocuments({ tenantId, $or: [{ courseId: id }, { courseCode: course.code }] }),
    ]);

    if ((linkedStudents > 0 || linkedSubjects > 0) && !force) {
      return res.status(400).json({
        success: false,
        canForce: true,
        linkedStudents,
        linkedSubjects,
        message: `Cannot delete course "${course.name}" — it is linked to ${linkedStudents} student(s) and ${linkedSubjects} subject(s).`,
      });
    }

    if (force) {
      await Promise.all([
        User.updateMany(
          { tenantId, role: "student", $or: [{ courseId: id }, { courseName: course.name }] },
          { $set: { courseId: null, courseName: "" } }
        ),
        Subject.updateMany(
          { tenantId, $or: [{ courseId: id }, { courseCode: course.code }] },
          { $set: { courseId: null, courseCode: "" } }
        ),
      ]);
    }

    await Course.deleteOne({ _id: id, tenantId });
    return res.status(200).json({ success: true, message: `Course "${course.name}" deleted successfully` });
  } catch (error) {
    logger.error("Error deleting course", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to delete course" });
  }
};

/**
 * GET /api/academic/structure
 * Returns the tenant's semester rules + a small summary (courses, branches, students by semester).
 */
const getStructure = async (req, res) => {
  try {
    const tenant = await getTenant(req);
    const structure = tenant?.settings?.semesterStructure || { semestersPerYear: 2, autoPromote: true, academicStartMonth: 5 };

    const [courseCount, studentCount, bySemester] = await Promise.all([
      Course.countDocuments({ tenantId: req.user.tenantId, isActive: true }),
      User.countDocuments({ tenantId: req.user.tenantId, role: "student", isActive: true }),
      User.aggregate([
        { $match: { tenantId: req.user.tenantId, role: "student", isActive: true } },
        { $group: { _id: { semester: "$semester", status: "$academicStatus" }, count: { $sum: 1 } } },
      ]),
    ]);

    const studentBySemester = {};
    bySemester.forEach((row) => {
      const key = String(row._id.semester || "?");
      studentBySemester[key] = (studentBySemester[key] || 0) + row.count;
    });

    return res.status(200).json({
      success: true,
      data: {
        structure,
        summary: {
          courses: courseCount,
          students: studentCount,
          studentBySemester,
        },
      },
    });
  } catch (error) {
    logger.error("Error fetching structure", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to fetch structure" });
  }
};

/**
 * PUT /api/academic/structure
 * Update semester rules (semestersPerYear 1|2, autoPromote, academicStartMonth).
 * Gated by featureGuard("academic_structure") at the route.
 */
const updateStructure = async (req, res) => {
  try {
    const { semestersPerYear, autoPromote, academicStartMonth } = req.body;
    const tenant = await getTenant(req);
    if (!tenant) return res.status(404).json({ success: false, message: "Tenant not found" });

    const structure = tenant.settings.semesterStructure || {};
    if (semestersPerYear === 1 || semestersPerYear === 2) structure.semestersPerYear = semestersPerYear;
    if (autoPromote !== undefined) structure.autoPromote = Boolean(autoPromote);
    if (academicStartMonth !== undefined && Number(academicStartMonth) >= 0 && Number(academicStartMonth) <= 11) {
      structure.academicStartMonth = Number(academicStartMonth);
    }
    tenant.settings.semesterStructure = structure;
    await tenant.save();

    return res.status(200).json({ success: true, message: "Semester rules updated", data: { structure } });
  } catch (error) {
    logger.error("Error updating structure", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to update structure" });
  }
};

const buildPromotionContext = async (tenantId) => {
  const tenant = await Tenant.findById(tenantId);
  const structure = tenant?.settings?.semesterStructure || { semestersPerYear: 2, autoPromote: true, academicStartMonth: 5 };

  const [students, courses] = await Promise.all([
    User.find({
      tenantId,
      role: "student",
      isActive: true,
      academicStatus: { $ne: "graduated" },
    }).select("name rollNo section email courseId courseName branch semester admissionYear totalSemesters academicStatus holdPromotion lastPromotedAt").lean(),
    Course.find({ tenantId, isActive: true }).select("name code durationYears semestersPerYear branches").lean(),
  ]);

  const courseMap = new Map(courses.map((c) => [String(c._id), c]));

  const eligible = [];
  const skipped = [];
  let graduating = 0;

  students.forEach((student) => {
    const totalSemesters = student.totalSemesters || (() => {
      const course = courseMap.get(String(student.courseId));
      if (!course) return null;
      const branch = student.branch
        ? course.branches.find((b) => b.name.toLowerCase() === student.branch.toLowerCase())
        : null;
      return branch ? branch.totalSemesters : course.durationYears * course.semestersPerYear;
    })();

    const expected = getExpectedSemester(student.admissionYear, structure.academicStartMonth, structure.semestersPerYear);
    const current = student.semester || 1;

    if (student.holdPromotion) {
      skipped.push({ ...student, expectedSemester: expected, reason: "Promotion on hold" });
      return;
    }
    if (expected === null) {
      skipped.push({ ...student, expectedSemester: expected, reason: "Missing admission year" });
      return;
    }
    if (expected <= current) {
      skipped.push({ ...student, expectedSemester: expected, reason: "Not yet due" });
      return;
    }

    // Due for promotion
    if (totalSemesters && current >= totalSemesters) {
      // They've completed the final semester -> graduate instead of advancing further
      graduating++;
      eligible.push({
        ...student,
        expectedSemester: expected,
        nextSemester: current,
        willGraduate: true,
        totalSemesters,
      });
      return;
    }

    eligible.push({
      ...student,
      expectedSemester: expected,
      nextSemester: Math.min(current + 1, totalSemesters || current + 1),
      willGraduate: false,
      totalSemesters,
    });
  });

  return { structure, eligible, skipped, graduating };
};

/**
 * GET /api/academic/promotion-preview
 * Preview which students would advance on the next promotion run.
 */
const getPromotionPreview = async (req, res) => {
  try {
    const { eligible, skipped, graduating, structure } = await buildPromotionContext(req.user.tenantId);
    return res.status(200).json({
      success: true,
      data: {
        structure,
        eligible,
        skipped,
        eligibleCount: eligible.length,
        skippedCount: skipped.length,
        graduatingCount: graduating,
      },
    });
  } catch (error) {
    logger.error("Error previewing promotion", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to preview promotion" });
  }
};

/**
 * POST /api/academic/promote
 * Promote students by one semester (or graduate those at the cap).
 * Body: { studentIds?: string[] } — if omitted, promotes all eligible.
 */
const promoteStudents = async (req, res) => {
  try {
    const { studentIds } = req.body;
    const tenantId = req.user.tenantId;
    const { eligible } = await buildPromotionContext(tenantId);

    const targets = Array.isArray(studentIds) && studentIds.length > 0
      ? eligible.filter((s) => studentIds.includes(String(s._id)))
      : eligible;

    if (targets.length === 0) {
      return res.status(200).json({ success: true, message: "No students are due for promotion", data: { promoted: 0, graduated: 0 } });
    }

    const now = new Date();
    let promoted = 0;
    let graduated = 0;
    const details = [];

    for (const student of targets) {
      const updates = {
        semester: student.nextSemester,
        lastPromotedAt: now,
      };

      if (student.willGraduate) {
        updates.academicStatus = "graduated";
        updates.graduatedAt = now;
        graduated++;
      } else {
        promoted++;
      }

      await User.updateOne({ _id: student._id, tenantId }, { $set: updates });

      // Keep the linked Enrollment in sync
      await Enrollment.updateOne(
        { userId: student._id, tenantId },
        { $set: { semester: student.nextSemester, ...(student.willGraduate ? { enrollmentStatus: "graduated" } : {}) } },
      );

      details.push({
        id: student._id,
        name: student.name,
        rollNo: student.rollNo,
        section: student.section,
        from: student.semester,
        to: student.nextSemester,
        graduated: Boolean(student.willGraduate),
      });
    }

    return res.status(200).json({
      success: true,
      message: `Promotion complete — ${promoted} promoted, ${graduated} graduated`,
      data: { promoted, graduated, details },
    });
  } catch (error) {
    logger.error("Error promoting students", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to promote students" });
  }
};

const getSemesterTimeline = async (req, res) => {
  try {
    const { id } = req.params;
    const course = await Course.findOne({ _id: id, tenantId: req.user.tenantId }).lean();
    if (!course) return res.status(404).json({ success: false, message: "Course not found" });

    const tenant = await Tenant.findOne({ _id: req.user.tenantId }).select("settings.semesterStructure").lean();
    const semestersPerYear = tenant?.settings?.semesterStructure?.semestersPerYear || course.semestersPerYear || 2;
    const academicStartMonth = tenant?.settings?.semesterStructure?.academicStartMonth ?? 5;

    const { buildSemesterTimeline } = require("../utils/semesterUtils");
    const timeline = buildSemesterTimeline({
      semestersPerYear,
      durationYears: course.durationYears,
      academicStartMonth,
    });

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const formatted = timeline.map(s => ({
      semester: s.semester,
      startDate: s.startDate,
      endDate: s.endDate,
      label: `Semester ${s.semester} (${months[s.startDate.getMonth()]} ${s.startDate.getFullYear()} – ${months[s.endDate.getMonth()]} ${s.endDate.getFullYear()})`,
      academicYear: s.academicYear,
    }));

    return res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    logger.error("Error fetching semester timeline", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to fetch semester timeline" });
  }
};

module.exports = {
  getCourses,
  createCourse,
  bulkCreateCourses,
  updateCourse,
  deleteCourse,
  getStructure,
  updateStructure,
  getPromotionPreview,
  promoteStudents,
  getExpectedSemester,
  getSemesterTimeline,
};
