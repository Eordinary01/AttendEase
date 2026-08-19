const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { authenticateToken } = require("../middleware/auth")
const logger = require("../utils/logger");

const Subject = require("../models/Subject");
const Course = require("../models/Course");

// Get users with optional section, subjectId, courseId, branch, semester filters
router.get("/users", authenticateToken, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { section, courseId, branch, semester, subjectId } = req.query;

    let targetCourseId = courseId;
    let targetBranch = branch;
    let targetSemester = semester;
    let targetSection = section ? section.trim() : null;

    // If subjectId provided, resolve courseId, branch & semester from Subject document if not explicitly passed
    if (subjectId) {
      const subject = await Subject.findOne({ _id: subjectId, tenantId }).lean();
      if (subject) {
        if (!targetCourseId && subject.courseId) targetCourseId = subject.courseId.toString();
        if (!targetBranch && subject.branch) targetBranch = subject.branch;
        if (!targetSemester && subject.semester) targetSemester = subject.semester;
      }
    }

    // Resolve branch CODE <-> branch NAME to match both formats in User/Enrollment
    let branchRegexes = [];
    if (targetBranch) {
      const trimmedBranch = targetBranch.trim();
      branchRegexes.push(new RegExp(`^${trimmedBranch}$`, "i"));

      let courseDoc = null;
      if (targetCourseId) {
        courseDoc = await Course.findOne({ _id: targetCourseId, tenantId }).lean();
      }
      const courses = courseDoc ? [courseDoc] : await Course.find({ tenantId, isActive: true }).lean();

      courses.forEach((c) => {
        if (Array.isArray(c.branches)) {
          c.branches.forEach((b) => {
            const bCode = String(b.code || "").trim();
            const bName = String(b.name || "").trim();
            if (bCode.toLowerCase() === trimmedBranch.toLowerCase() && bName) {
              branchRegexes.push(new RegExp(`^${bName}$`, "i"));
            }
            if (bName.toLowerCase() === trimmedBranch.toLowerCase() && bCode) {
              branchRegexes.push(new RegExp(`^${bCode}$`, "i"));
            }
          });
        }
      });
    }

    // Build User & Enrollment filters
    const userFilter = { tenantId, role: "student", isActive: true };
    const Enrollment = require("../models/Enrollment");
    const enrollmentFilter = { tenantId, isRegistered: true };

    if (targetSection) {
      const secRegex = new RegExp(`^${targetSection}$`, "i");
      userFilter.section = secRegex;
      enrollmentFilter.section = secRegex;
    }

    // Strict filtering: If targetCourseId is provided, enforce exact course matching
    if (targetCourseId) {
      userFilter.courseId = targetCourseId;
      enrollmentFilter.courseId = targetCourseId;
    }

    if (branchRegexes.length > 0) {
      userFilter.branch = { $in: branchRegexes };
      enrollmentFilter.branch = { $in: branchRegexes };
    }

    const andConditions = [];
    if (targetSemester) {
      const semNum = parseInt(String(targetSemester).replace(/\D/g, ""), 10);
      if (!isNaN(semNum) && semNum > 0) {
        const semOrs = [{ semester: semNum }, { semester: String(semNum) }];
        andConditions.push({ $or: semOrs });
      }
    }

    if (andConditions.length > 0) {
      userFilter.$and = andConditions;
    }

    // Fetch users from User collection
    let users = await User.find(userFilter, "name section rollNo email courseId courseName branch semester").lean();

    // Fetch enrollments matching filter
    const enrollments = await Enrollment.find(enrollmentFilter).lean();

    // Merge students from Enrollment who have completed registration
    const seenUserIds = new Set(users.map((u) => u._id.toString()));
    const seenEmails = new Set(users.map((u) => (u.email || "").toLowerCase()).filter(Boolean));

    for (const enr of enrollments) {
      const emailLower = (enr.email || "").toLowerCase();
      const userIdStr = enr.userId ? enr.userId.toString() : null;

      if ((userIdStr && seenUserIds.has(userIdStr)) || (emailLower && seenEmails.has(emailLower))) {
        continue; // Already included from User collection
      }

      // Check if student's linked user exists
      let matchedUser = null;
      if (enr.userId) {
        matchedUser = await User.findById(enr.userId).lean();
      } else if (enr.email) {
        matchedUser = await User.findOne({ email: enr.email, tenantId, role: "student" }).lean();
      }

      if (matchedUser && matchedUser.role === "student" && matchedUser.isActive !== false) {
        if (!seenUserIds.has(matchedUser._id.toString())) {
          seenUserIds.add(matchedUser._id.toString());
          if (matchedUser.email) seenEmails.add(matchedUser.email.toLowerCase());
          users.push({
            _id: matchedUser._id,
            name: matchedUser.name,
            section: matchedUser.section || enr.section,
            rollNo: matchedUser.rollNo || enr.enrollmentNumber,
            email: matchedUser.email,
            courseId: matchedUser.courseId || enr.courseId,
            courseName: matchedUser.courseName || enr.courseName,
            branch: matchedUser.branch || enr.branch,
            semester: matchedUser.semester || enr.semester,
            isRegistered: true,
          });
        }
      }
    }

    res.json(users);
  } catch (error) {
    logger.error("Error fetching users:", { error: error.message });
    res.status(500).json({ message: "Error fetching users" });
  }
});

// Get specific user by ID
router.get("/users/:id", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.id, 'name section rollNo email role');
    if (!user) {
      return res.status(404).json({ message: "User not found.." });
    }
    res.json(user);
  } catch (error) {
    logger.error("Error fetching user:", { error: error.message });
    res.status(500).json({ message: "Error fetching user information" });
  }
});

module.exports = router;