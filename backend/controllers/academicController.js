const Course = require("../models/Course");
const User = require("../models/User");
const Enrollment = require("../models/Enrollment");
const Subject = require("../models/Subject");
const Tenant = require("../models/Tenant");
const SemesterPromotion = require("../models/SemesterPromotion");
const logger = require("../utils/logger");
const { toObjectId } = require("../utils/sanitize");
const {
  buildPromotionContext,
  scanForDuePromotions,
  runPromotionBatch,
  computeExpectedSemester,
} = require("../services/promotionService");
const { enqueuePromotionBatch, getJobStatus } = require("../queue");
const { publishPromotionCompleted } = require("../events/publishers");

const sanitizeStr = (v) => (v === undefined || v === null ? "" : String(v).trim());

/**
 * Expected semester re-exported from promotionService for compatibility and deduplication.
 */
const getExpectedSemester = computeExpectedSemester;

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

/**
 * GET /api/academic/promotion-preview
 * Preview which students would advance on the next promotion run.
 */
const getPromotionPreview = async (req, res) => {
  try {
    const {
      eligible,
      skipped,
      graduating,
      structure,
      missingAdmissionYearCount,
      missingCourseCount,
      missingCourseStudents,
    } = await buildPromotionContext(req.user.tenantId);

    return res.status(200).json({
      success: true,
      data: {
        structure,
        eligible,
        skipped,
        eligibleCount: eligible.length,
        skippedCount: skipped.length,
        graduatingCount: graduating,
        missingAdmissionYearCount: missingAdmissionYearCount || 0,
        missingCourseCount: missingCourseCount || 0,
        missingCourseStudents: missingCourseStudents || [],
      },
    });
  } catch (error) {
    logger.error("Error previewing promotion", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to preview promotion" });
  }
};

/**
 * POST /api/academic/promote
 * Synchronously promote students by one semester (or graduate those at the cap).
 * Body: { studentIds?: string[] } — if omitted, promotes all eligible.
 */
const promoteStudents = async (req, res) => {
  try {
    const { studentIds } = req.body;
    const tenantId = req.user.tenantId;

    const result = await runPromotionBatch(tenantId, studentIds, {
      runBy: req.user?._id,
      runByName: req.user?.name || "Admin",
      type: "manual",
    });

    // Publish event for SSE notification
    publishPromotionCompleted(tenantId, { jobId: null, ...result });

    return res.status(200).json({
      success: true,
      message: `Promotion complete — ${result.promoted} promoted, ${result.graduated} graduated`,
      data: result,
    });
  } catch (error) {
    logger.error("Error promoting students", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to promote students" });
  }
};

/**
 * POST /api/academic/promote/batch
 * Enqueue background promotion batch job via Bull queue.
 * Body: { studentIds?: string[] }
 */
const promoteStudentsBatch = async (req, res) => {
  try {
    const { studentIds } = req.body;
    const tenantId = req.user.tenantId;

    const { jobId, skipped, message } = await enqueuePromotionBatch(tenantId, studentIds, {
      runBy: req.user?._id,
      runByName: req.user?.name || "Admin",
      type: "background_batch",
    });
    if (skipped || !jobId) {
      return res.status(200).json({
        success: false,
        fallbackSync: true,
        message: message || "Background queue unavailable; use direct promotion.",
      });
    }

    return res.status(200).json({
      success: true,
      jobId,
      message: "Promotion background job queued successfully",
    });
  } catch (error) {
    logger.error("Error enqueueing promotion batch", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to enqueue promotion batch" });
  }
};

/**
 * GET /api/academic/promote/status/:jobId
 * Check status and progress of a background promotion batch job.
 */
const getPromotionJobStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    const status = await getJobStatus(jobId);
    if (!status) {
      return res.status(404).json({ success: false, message: "Promotion job not found or expired" });
    }

    return res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    logger.error("Error fetching promotion job status", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to fetch promotion job status" });
  }
};

/**
 * GET /api/academic/promote/audit
 * Fetch historical semester promotion audit records for the tenant.
 */
const getPromotionAudit = async (req, res) => {
  try {
    const auditLogs = await SemesterPromotion.find({ tenantId: req.user.tenantId })
      .sort({ executedAt: -1 })
      .limit(50)
      .lean();

    return res.status(200).json({
      success: true,
      data: auditLogs,
    });
  } catch (error) {
    logger.error("Error fetching promotion audit logs", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to fetch promotion audit logs" });
  }
};

/**
 * GET /api/academic/promote/settings
 * Fetch current promotion settings for the tenant.
 */
const getPromotionSettings = async (req, res) => {
  try {
    const tenant = await getTenant(req);
    if (!tenant) return res.status(404).json({ success: false, message: "Tenant not found" });

    const structure = tenant.settings?.semesterStructure || {
      semestersPerYear: 2,
      autoPromote: true,
      academicStartMonth: 5,
    };

    return res.status(200).json({
      success: true,
      data: structure,
    });
  } catch (error) {
    logger.error("Error fetching promotion settings", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to fetch promotion settings" });
  }
};

/**
 * POST /api/academic/promote/settings
 * Update promotion settings for the tenant.
 */
const updatePromotionSettings = async (req, res) => {
  try {
    const { autoPromote, semestersPerYear, academicStartMonth } = req.body;
    const tenant = await getTenant(req);
    if (!tenant) return res.status(404).json({ success: false, message: "Tenant not found" });

    const structure = tenant.settings.semesterStructure || {};
    if (autoPromote !== undefined) structure.autoPromote = Boolean(autoPromote);
    if (semestersPerYear === 1 || semestersPerYear === 2) structure.semestersPerYear = semestersPerYear;
    if (academicStartMonth !== undefined && Number(academicStartMonth) >= 0 && Number(academicStartMonth) <= 11) {
      structure.academicStartMonth = Number(academicStartMonth);
    }
    tenant.settings.semesterStructure = structure;
    await tenant.save();

    return res.status(200).json({
      success: true,
      message: "Promotion settings updated successfully",
      data: structure,
    });
  } catch (error) {
    logger.error("Error updating promotion settings", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to update promotion settings" });
  }
};

/**
 * POST /api/academic/students/bulk-assign-course
 * Bulk assign a course and optional branch to selected student IDs.
 */
const bulkAssignCourse = async (req, res) => {
  try {
    const { studentIds, courseId, branch } = req.body;
    const tenantId = req.user.tenantId;

    if (!courseId) {
      return res.status(400).json({ success: false, message: "Course ID is required" });
    }
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ success: false, message: "studentIds array cannot be empty" });
    }

    const course = await Course.findOne({ _id: courseId, tenantId, isActive: true }).lean();
    if (!course) {
      return res.status(404).json({ success: false, message: "Active course not found" });
    }

    const updatePayload = {
      courseId: course._id,
      courseName: course.name,
    };
    if (branch) {
      updatePayload.branch = branch;
    }

    const userResult = await User.updateMany(
      { _id: { $in: studentIds }, tenantId, role: "student" },
      { $set: updatePayload }
    );

    // Synchronize enrollments if any exist
    try {
      await Enrollment.updateMany(
        { userId: { $in: studentIds }, tenantId },
        { $set: { courseId: course._id, ...(branch ? { branch } : {}) } }
      );
    } catch (syncErr) {
      logger.warn("Enrollment sync failed during bulkAssignCourse (suppressed)", { error: syncErr.message });
    }

    logger.info("Bulk assigned course to students", {
      tenantId,
      courseId,
      matched: userResult.matchedCount,
      modified: userResult.modifiedCount,
    });

    return res.status(200).json({
      success: true,
      message: `Successfully assigned course ${course.name} to ${userResult.modifiedCount} student(s)`,
      modifiedCount: userResult.modifiedCount,
      matchedCount: userResult.matchedCount,
    });
  } catch (error) {
    logger.error("Error in bulkAssignCourse", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to bulk assign course" });
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
  promoteStudentsBatch,
  getPromotionJobStatus,
  getPromotionAudit,
  getPromotionSettings,
  updatePromotionSettings,
  bulkAssignCourse,
  getExpectedSemester,
  getSemesterTimeline,
};
