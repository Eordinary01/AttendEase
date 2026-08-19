const User = require("../models/User");
const Enrollment = require("../models/Enrollment");
const Course = require("../models/Course");
const bcrypt = require("bcryptjs");
const logger = require("../utils/logger");

const sanitizeSection = (section) => String(section || "").trim().toUpperCase();
const sanitizeStr = (v) => (v === undefined || v === null ? "" : String(v).trim());
const toSemester = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
};

/**
 * Resolves an optional courseId + branch into denormalized student fields.
 * Returns { courseId, courseName, branch, totalSemesters } and a warning if the
 * branch doesn't exist in the course.
 */
const resolveAcademicContext = async (courseId, branch, tenantId) => {
  if (!courseId) {
    return { courseId: null, courseName: "", branch: sanitizeStr(branch), totalSemesters: null, warning: null };
  }
  const course = await Course.findOne({ _id: courseId, tenantId, isActive: true }).lean();
  if (!course) {
    return { courseId: null, courseName: "", branch: sanitizeStr(branch), totalSemesters: null, warning: "Selected course was not found" };
  }

  const branchName = sanitizeStr(branch);
  const matched = branchName
    ? course.branches.find((b) => b.name.toLowerCase() === branchName.toLowerCase())
    : null;

  if (branchName && course.branches.length > 0 && !matched) {
    const valid = course.branches.map((b) => b.name).join(", ");
    return {
      courseId: course._id,
      courseName: course.name,
      branch: branchName,
      totalSemesters: null,
      warning: `Branch "${branchName}" is not defined for ${course.name}. Valid branches: ${valid || "none"}.`,
    };
  }

  const totalSemesters = matched
    ? matched.totalSemesters
    : course.durationYears * course.semestersPerYear;

  return {
    courseId: course._id,
    courseName: course.name,
    branch: matched ? matched.name : branchName,
    totalSemesters,
    warning: null,
  };
};

const createStudent = async (req, res) => {
  try {
    const {
      name, email, rollNo, section, password, phone, parentName, parentPhone, parentEmail,
      courseId, branch, semester, admissionYear,
    } = req.body;

    if (!name || !email || !rollNo || !section) {
      return res.status(400).json({ success: false, message: "Name, email, roll number and section are required" });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanRoll = rollNo.trim().toUpperCase();
    const cleanSection = sanitizeSection(section);
    const tenantId = req.user.tenantId;

    const existing = await User.findOne({ $or: [{ email: cleanEmail }, { rollNo: cleanRoll }], tenantId });
    if (existing) {
      return res.status(400).json({ success: false, message: "A student with this email or roll number already exists" });
    }

    const studentLimit = req.tenant?.limits?.maxStudents;
    if (studentLimit) {
      const count = await User.countDocuments({ tenantId, role: "student", isActive: true });
      if (count >= studentLimit) {
        return res.status(403).json({ success: false, message: "Institution has reached the maximum student limit.", upgradeRequired: true });
      }
    }

    const academic = await resolveAcademicContext(courseId, branch, tenantId);
    const cleanSemester = toSemester(semester);
    const cleanAdmissionYear = admissionYear ? parseInt(admissionYear, 10) : new Date().getFullYear();

    if (academic.warning) {
      return res.status(400).json({ success: false, message: academic.warning });
    }

    const hashPassword = await bcrypt.hash(password || "Student@123", 10);

    const user = await User.create({
      name: name.trim(),
      email: cleanEmail,
      password: hashPassword,
      section: cleanSection,
      role: "student",
      rollNo: cleanRoll,
      tenantId,
      isFirstLogin: true,
      createdByAdmin: true,
      phone: phone || "",
      parentName: parentName || "",
      parentPhone: parentPhone || "",
      parentEmail: parentEmail ? parentEmail.toLowerCase().trim() : "",
      emailVerified: true,
      courseId: academic.courseId,
      courseName: academic.courseName,
      branch: academic.branch,
      semester: cleanSemester,
      admissionYear: cleanAdmissionYear,
      totalSemesters: academic.totalSemesters,
      academicStatus: "active",
    });

    await Enrollment.create({
      enrollmentNumber: cleanRoll,
      email: cleanEmail,
      firstName: name.trim().split(" ").slice(0, -1).join(" ") || name.trim(),
      lastName: name.trim().split(" ").pop() || "",
      section: cleanSection,
      isRegistered: true,
      registeredAt: new Date(),
      userId: user._id,
      tenantId,
      parentName: parentName || "",
      parentPhone: parentPhone || "",
      parentEmail: parentEmail ? parentEmail.toLowerCase().trim() : "",
      courseId: academic.courseId,
      courseName: academic.courseName,
      branch: academic.branch,
      semester: cleanSemester,
      admissionYear: cleanAdmissionYear,
      totalSemesters: academic.totalSemesters,
    });

    return res.status(201).json({
      success: true,
      message: "Student created successfully",
      data: {
        id: user._id, name: user.name, email: user.email, rollNo: user.rollNo, section: user.section,
        courseId: user.courseId, courseName: user.courseName, branch: user.branch,
        semester: user.semester, admissionYear: user.admissionYear,
      },
    });
  } catch (error) {
    logger.error("Error creating student", { error: error.message });
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "A student with this email or roll number already exists" });
    }
    return res.status(500).json({ success: false, message: "Failed to create student" });
  }
};

const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, email, rollNo, section, phone, parentName, parentPhone, parentEmail, isActive,
      courseId, branch, semester, admissionYear, totalSemesters, holdPromotion, academicStatus,
    } = req.body;
    const tenantId = req.user.tenantId;

    const user = await User.findOne({ _id: id, tenantId, role: "student" });
    if (!user) return res.status(404).json({ success: false, message: "Student not found" });

    if (name !== undefined) user.name = name.trim();
    if (phone !== undefined) user.phone = phone;
    if (parentName !== undefined) user.parentName = parentName;
    if (parentPhone !== undefined) user.parentPhone = parentPhone;
    if (parentEmail !== undefined) user.parentEmail = parentEmail.toLowerCase().trim();
    if (holdPromotion !== undefined) user.holdPromotion = Boolean(holdPromotion);
    if (semester !== undefined) user.semester = toSemester(semester);
    if (admissionYear !== undefined) user.admissionYear = admissionYear ? parseInt(admissionYear, 10) : new Date().getFullYear();
    if (totalSemesters !== undefined) user.totalSemesters = totalSemesters ? parseInt(totalSemesters, 10) : null;

    if (academicStatus !== undefined) {
      if (["active", "graduated", "transferred", "dropped"].includes(academicStatus)) {
        user.academicStatus = academicStatus;
        if (academicStatus === "graduated" && !user.graduatedAt) user.graduatedAt = new Date();
        if (academicStatus === "active") user.graduatedAt = null;
      }
    }

    if (email !== undefined) {
      const cleanEmail = email.toLowerCase().trim();
      const dup = await User.findOne({ email: cleanEmail, tenantId, _id: { $ne: user._id } });
      if (dup) return res.status(409).json({ success: false, message: "Email already in use by another student" });
      user.email = cleanEmail;
    }

    if (rollNo !== undefined) {
      const cleanRoll = rollNo.trim().toUpperCase();
      const dup = await User.findOne({ rollNo: cleanRoll, tenantId, _id: { $ne: user._id } });
      if (dup) return res.status(409).json({ success: false, message: "Roll number already in use by another student" });
      user.rollNo = cleanRoll;
    }

    if (section !== undefined) user.section = sanitizeSection(section);
    if (isActive !== undefined) user.isActive = isActive;

    // Course/branch changed? Re-resolve academic context
    if (courseId !== undefined || branch !== undefined) {
      const newCourseId = courseId !== undefined ? courseId : user.courseId;
      const newBranch = branch !== undefined ? branch : user.branch;
      const academic = await resolveAcademicContext(newCourseId, newBranch, tenantId);
      if (academic.warning) {
        return res.status(400).json({ success: false, message: academic.warning });
      }
      user.courseId = academic.courseId;
      user.courseName = academic.courseName;
      user.branch = academic.branch;
      if (user.totalSemesters === null || courseId !== undefined) {
        user.totalSemesters = academic.totalSemesters;
      }
    }

    await user.save();

    if (email !== undefined || rollNo !== undefined || section !== undefined || name !== undefined ||
        courseId !== undefined || branch !== undefined || semester !== undefined || admissionYear !== undefined) {
      await Enrollment.findOneAndUpdate(
        { userId: user._id, tenantId },
        {
          $set: {
            ...(email !== undefined && { email: user.email }),
            ...(rollNo !== undefined && { enrollmentNumber: user.rollNo }),
            ...(section !== undefined && { section: user.section }),
            ...(name !== undefined && { firstName: user.name.split(" ").slice(0, -1).join(" ") || user.name, lastName: user.name.split(" ").pop() || "" }),
            ...(courseId !== undefined && { courseId: user.courseId, courseName: user.courseName, totalSemesters: user.totalSemesters }),
            ...(branch !== undefined && { branch: user.branch }),
            ...(semester !== undefined && { semester: user.semester }),
            ...(admissionYear !== undefined && { admissionYear: user.admissionYear }),
          },
        },
        { upsert: false }
      );
    }

    return res.status(200).json({
      success: true,
      message: "Student updated successfully",
      data: {
        id: user._id, name: user.name, email: user.email, rollNo: user.rollNo, section: user.section,
        courseId: user.courseId, courseName: user.courseName, branch: user.branch,
        semester: user.semester, admissionYear: user.admissionYear,
      },
    });
  } catch (error) {
    logger.error("Error updating student", { error: error.message });
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "Email or roll number already in use" });
    }
    return res.status(500).json({ success: false, message: "Failed to update student" });
  }
};

module.exports = { createStudent, updateStudent };
