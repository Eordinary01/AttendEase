const User = require("../models/User");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const Subject = require("../models/Subject");
const Attendance = require("../models/Attendance");
const Ticket = require("../models/Ticket");
const Tenant = require("../models/Tenant");
const Alert = require("../models/Alert");
const Invoice = require("../models/Invoice");
const SupportTicket = require("../models/SupportTicket");
const CalendarEvent = require("../models/Calendar");
const Lead = require("../models/Lead");
const APILog = require("../models/APILog");
const bcrypt = require("bcryptjs");
const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");
const mongoose = require("mongoose");
const { logActivity } = require("../utils/activityLogger");
const logger = require("../utils/logger");
const { escapeRegExp, toObjectId } = require("../utils/sanitize");
const { syncEnrollmentSubjects } = require("../utils/enrollmentSubjectSync");
const cache = require("../middleware/cache");
const {
  getActiveTenantSections,
  invalidateTenantSectionsCache,
  validateSectionsExist,
} = require("../utils/sectionHelper");
const { getEffectiveLimits, getEffectiveModules } = require("../utils/planDefaults");
require("dotenv").config();

// ==================== HELPER FUNCTIONS ====================

/**
 * Generate temporary password
 */
function generateTempPassword() {
  const length = 10;
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

/**
 * Calculate academic year from semester number and course semester structure
 */
const calculateSubjectYear = (semesterStr, semestersPerYear = 2) => {
  if (!semesterStr) return null;
  const semNum = parseInt(String(semesterStr).replace(/\D/g, ""), 10);
  if (isNaN(semNum) || semNum <= 0) return null;
  const sPerYear = Number(semestersPerYear) === 1 ? 1 : 2;
  return sPerYear === 1 ? semNum : Math.ceil(semNum / 2);
};

const { sendMail } = require('../utils/emailService');

async function sendTeacherCredentialsEmail(email, name, tempPassword, tenantName, tenantSubdomain) {
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const loginUrl = tenantSubdomain ? `${appUrl}/login/${tenantSubdomain}` : `${appUrl}/login`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <div style="text-align: center; padding-bottom: 20px; border-bottom: 2px solid #8b5cf6;">
        <h2 style="color: #6d28d9; margin: 0;">Welcome to ${tenantName || "AttendEase"}!</h2>
      </div>
      <div style="padding: 20px 0;">
        <p style="font-size: 16px; color: #334155;">Dear ${name},</p>
        <p style="font-size: 15px; color: #475569;">Your teacher account for <strong>${tenantName || "our institution"}</strong> has been created successfully.</p>
        <div style="background-color: #f8fafc; border-left: 4px solid #8b5cf6; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <h3 style="margin-top: 0; color: #1e293b;">Login Credentials</h3>
          <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
          <p style="margin: 5px 0;"><strong>Temporary Password:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${tempPassword}</code></p>
          <p style="margin: 10px 0 0 0;"><strong>Portal Login:</strong> <a href="${loginUrl}" style="color: #6d28d9; text-decoration: underline;">${loginUrl}</a></p>
        </div>
        <h4 style="color: #334155; margin-bottom: 8px;">Important Notes:</h4>
        <ul style="color: #475569; font-size: 14px; padding-left: 20px;">
          <li>Use the portal login link above to access your teacher dashboard.</li>
          <li>Please change your password immediately after your first login.</li>
          <li>Keep your login credentials secure and confidential.</li>
        </ul>
      </div>
      <div style="border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: center; color: #94a3b8; font-size: 12px;">
        &copy; ${new Date().getFullYear()} ${tenantName || "AttendEase"}. All rights reserved.
      </div>
    </div>
  `;
  return sendMail({
    to: email,
    subject: `${tenantName || "AttendEase"} - Teacher Account Created`,
    html,
  });
}

// ==================== TENANT ADMIN FUNCTIONS ====================

/**
 * UPLOAD STUDENT ENROLLMENTS VIA CSV
 * CSV format: enrollmentNumber, email, firstName, lastName, section
 * Tenant Admin only
 */


const uploadEnrollments = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only tenant admins can upload enrollments",
      });
    }

    const rawTenantId = req.tenantId || req.user?.tenantId || req.tenant?._id;
    const tenantId = toObjectId(rawTenantId);

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const fileExt = req.file.originalname.toLowerCase().split(".").pop();
    if (fileExt !== "csv") {
      if (req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        success: false,
        message: "Only CSV files are allowed",
      });
    }

    const filePath = req.file.path;
    let results = [];
    let errorCount = 0;
    const errors = [];

    if (!fs.existsSync(filePath)) {
      return res.status(400).json({
        success: false,
        message: "File not found",
      });
    }

    let fileContent = fs.readFileSync(filePath, "utf8");

    // Remove BOM if present
    if (fileContent.charCodeAt(0) === 0xfeff) {
      fileContent = fileContent.slice(1);
    }

    const lines = fileContent
      .split(/\r?\n/)
      .filter((line) => line.trim() !== "");

    if (lines.length === 0) {
      return res.status(400).json({
        success: false,
        message: "CSV file is empty",
      });
    }

    // ✅ Parse headers (first line) - Convert to lowercase for case-insensitive matching
    const rawHeaders = lines[0].split(",").map((header) => header.trim());
    console.log("📋 Raw headers:", rawHeaders);

    // ✅ Create a mapping from lowercase header to actual header
    const headerMap = {};
    rawHeaders.forEach((header) => {
      headerMap[header.toLowerCase()] = header;
    });
    console.log("📋 Header map:", headerMap);

    // ✅ Expected fields (in lowercase)
    const requiredFields = [
      "enrollmentnumber",
      "email",
      "firstname",
      "lastname",
      "section",
    ];

    // ✅ Check if all required fields exist (case-insensitive)
    const missingFields = requiredFields.filter((field) => !headerMap[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required columns: ${missingFields.join(", ")}. Found columns: ${rawHeaders.join(", ")}`,
      });
    }

    // ✅ Process data rows (skip header)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = parseCSVLine(line);

      // ✅ Create object using case-insensitive header mapping
      const row = {};
      rawHeaders.forEach((header, index) => {
        const lowerHeader = header.toLowerCase();
        row[lowerHeader] = values[index] ? values[index].trim() : "";
      });

      console.log(`📊 Row ${i}:`, row);

      // ✅ Validate required fields (using lowercase keys)
      const missingRowFields = requiredFields.filter(
        (field) => !row[field] || row[field] === "",
      );

      if (missingRowFields.length > 0) {
        errorCount++;
        errors.push(
          `Row ${i} missing required fields (${missingRowFields.join(", ")}): ${JSON.stringify(row)}`,
        );
        continue;
      }

      // ✅ Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(row.email)) {
        errorCount++;
        errors.push(`Row ${i} has invalid email: ${row.email}`);
        continue;
      }

      // ✅ Validate section
      if (!row.section.match(/^[A-Za-z0-9]+$/)) {
        errorCount++;
        errors.push(`Row ${i} has invalid section: ${row.section}`);
        continue;
      }

      results.push({
        tenantId: tenantId,
        enrollmentNumber: row.enrollmentnumber.toUpperCase().trim(),
        email: row.email.toLowerCase().trim(),
        firstName: row.firstname.trim(),
        lastName: row.lastname.trim(),
        section: row.section.trim().toUpperCase(),
        parentName: (row.parentname || "").trim(),
        parentPhone: (row.parentphone || "").trim(),
        parentEmail: (row.parentemail || "").trim().toLowerCase(),
        courseName: (row.course || "").trim(),
        branch: (row.branch || "").trim(),
        semester: row.semester ? parseInt(row.semester, 10) || undefined : undefined,
        admissionYear: row.admissionyear ? parseInt(row.admissionyear, 10) || undefined : undefined,
        uploadedBy: toObjectId(req.user._id),
      });
    }

    if (results.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid rows found in CSV. Please check the format.",
        errors: errors,
      });
    }

    // Reject intra-file duplicates before any resolution or insert
    const inFileEmails = new Set();
    const inFileEnrollments = new Set();
    const deduped = [];
    for (const row of results) {
      if (inFileEmails.has(row.email)) {
        errorCount++;
        errors.push(`Duplicate email '${row.email}' within the file (enrollment ${row.enrollmentNumber})`);
        continue;
      }
      if (inFileEnrollments.has(row.enrollmentNumber)) {
        errorCount++;
        errors.push(`Duplicate enrollment number '${row.enrollmentNumber}' within the file`);
        continue;
      }
      inFileEmails.add(row.email);
      inFileEnrollments.add(row.enrollmentNumber);
      deduped.push(row);
    }
    results = deduped;

    // Skip rows whose enrollmentNumber or email already exist for this tenant (re-upload safety)
    if (results.length > 0) {
      const existing = await Enrollment.find({
        tenantId,
        $or: [
          { enrollmentNumber: { $in: results.map(r => r.enrollmentNumber) } },
          { email: { $in: results.map(r => r.email) } },
        ],
      }).select("enrollmentNumber email").lean();

      const existingEnrollmentNumbers = new Set();
      const existingEmails = new Set();
      existing.forEach(e => {
        existingEnrollmentNumbers.add(e.enrollmentNumber);
        existingEmails.add(e.email);
      });

      const filtered = [];
      for (const row of results) {
        if (existingEnrollmentNumbers.has(row.enrollmentNumber)) {
          errorCount++;
          errors.push(`Enrollment number '${row.enrollmentNumber}' already exists for this tenant`);
          continue;
        }
        if (existingEmails.has(row.email)) {
          errorCount++;
          errors.push(`Email '${row.email}' already exists for this tenant`);
          continue;
        }
        filtered.push(row);
      }
      results = filtered;
    }

    // Resolve courseId from courseName for all rows; rows with an unknown course
    // or branch are skipped with a per-row error (valid rows are still imported)
    const uniqueCourseNames = [...new Set(results.map(r => r.courseName).filter(Boolean))];
    if (uniqueCourseNames.length > 0) {
      const courses = await Course.find({
        tenantId: tenantId,
        name: { $in: uniqueCourseNames },
        isActive: true,
      }).lean();

      const courseMap = {};
      courses.forEach(c => { courseMap[c.name.toLowerCase()] = c; });

      const resolved = [];
      for (const row of results) {
        if (!row.courseName) {
          resolved.push(row);
          continue;
        }
        const course = courseMap[row.courseName.toLowerCase()];
        if (!course) {
          errorCount++;
          errors.push(`Course "${row.courseName}" not found for enrollment ${row.enrollmentNumber}`);
          continue;
        }
        row.courseId = toObjectId(course._id);
        let branchMatch = null;
        if (row.branch) {
          const target = row.branch.toLowerCase();
          branchMatch = course.branches.find(
            (b) =>
              String(b.name || "").toLowerCase() === target ||
              String(b.code || "").toLowerCase() === target,
          );
          if (!branchMatch) {
            errorCount++;
            errors.push(`Branch "${row.branch}" not found in course "${row.courseName}" for enrollment ${row.enrollmentNumber}`);
            continue;
          }
          // Normalize branch to the canonical course branch name
          row.branch = branchMatch.name;
        }
        row.totalSemesters =
          branchMatch && branchMatch.totalSemesters
            ? branchMatch.totalSemesters
            : course.durationYears * course.semestersPerYear;
        resolved.push(row);
      }
      results = resolved;
    }

    try {
      const insertedEnrollments = await Enrollment.insertMany(results, {
        ordered: false,
      });
      const successCount = insertedEnrollments.length;

      await invalidateTenantSectionsCache(tenantId);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      return res.status(200).json({
        success: true,
        message:
          errorCount > 0
            ? `Enrollments uploaded (${successCount} imported, ${errorCount} skipped)`
            : "Enrollments uploaded successfully",
        successCount,
        errorCount,
        errors: errors.length > 0 ? errors : undefined,
        totalProcessed: results.length + errorCount,
      });
    } catch (error) {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      if (error.code === 11000) {
        const duplicateField = Object.keys(error.keyPattern)[0];
        return res.status(400).json({
          success: false,
          message: `Duplicate ${duplicateField} found in CSV`,
          error: error.message,
        });
      }
      return res.status(500).json({
        success: false,
        message: "Error saving enrollments",
        error: error.message,
      });
    }
  } catch (error) {
    logger.error("Error in uploadEnrollments", { error: error.message });
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// ✅ Helper function to parse CSV line with quoted values
function parseCSVLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        values.push(current);
        current = "";
      } else {
        current += char;
      }
    }
  }

  values.push(current);
  return values;
}

/**
 * CREATE TEACHER ACCOUNT
 * Tenant Admin only
 */
const createTeacher = async (req, res) => {
  const { name, email, rollNo, phone, address, qualification, specialization, joiningDate } = req.body;
  const tenantId = req.user.tenantId;

  if (!name || !email || !rollNo) {
    return res.status(400).json({
      success: false,
      message: "Name, email, and roll number are required",
    });
  }

  const emailLower = email.toLowerCase().trim();

  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only tenant admins can create teacher accounts",
      });
    }

    const tenant = await Tenant.findById(tenantId);
    const existingUser = await User.findOne({
      email: emailLower,
      tenantId: tenantId,
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already in use within your institution",
      });
    }

    const tempPassword = generateTempPassword();
    const hashedTempPassword = await bcrypt.hash(tempPassword, 10);

    const newTeacher = new User({
      name: name.trim(),
      email: emailLower,
      password: hashedTempPassword,
      role: "teacher",
      rollNo: rollNo.trim(),
      tenantId: tenantId,
      isActive: true,
      createdByAdmin: true,
      isFirstLogin: true,
      tempPasswordSent: true,
      tempPasswordSentAt: Date.now(),
      phone: phone ? phone.trim() : undefined,
      address: address ? address.trim() : undefined,
      qualification: qualification ? qualification.trim() : undefined,
      specialization: specialization ? specialization.trim() : undefined,
      joiningDate: joiningDate ? new Date(joiningDate) : undefined,
    });

    await newTeacher.save();

    await Tenant.findByIdAndUpdate(tenantId, {
      $inc: { "stats.totalTeachers": 1 },
    });

    await sendTeacherCredentialsEmail(email, name, tempPassword, tenant?.name, tenant?.subdomain);

    logActivity({
      tenantId,
      userId: req.user._id,
      description: `Teacher account created: ${newTeacher.name} (${newTeacher.email})`,
      endpoint: '/api/admin/create-teacher',
      statusCode: 201,
      ipAddress: req.ip,
    });

    return res.status(201).json({
      success: true,
      message:
        "Teacher account created successfully. Credentials sent to email.",
      teacher: {
        id: newTeacher._id,
        _id: newTeacher._id,
        name: newTeacher.name,
        email: newTeacher.email,
        role: newTeacher.role,
        rollNo: newTeacher.rollNo,
        phone: newTeacher.phone,
        address: newTeacher.address,
        qualification: newTeacher.qualification,
        specialization: newTeacher.specialization,
        joiningDate: newTeacher.joiningDate,
      },
    });
  } catch (error) {
    logger.error("Error creating teacher", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * CREATE SUBJECT
 * Tenant Admin only
 */
const createSubject = async (req, res) => {
  const {
    subjectCode,
    subjectName,
    description,
    credits,
    semester,
    courseCode,
    courseId,
    branch,
  } = req.body;
  const tenantId = req.user.tenantId;

  if (!subjectCode || !subjectName || !semester) {
    return res.status(400).json({
      success: false,
      message: "Subject code, name, and semester are required",
    });
  }

  try {
    if (req.user?.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only tenant admins can create subjects",
      });
    }

    const existingSubject = await Subject.findOne({
      subjectCode: subjectCode.toUpperCase(),
      tenantId: tenantId,
    });

    if (existingSubject) {
      return res.status(400).json({
        success: false,
        message: "Subject code already exists in your institution",
      });
    }

    let resolvedCourse = null;
    if (courseId) {
      resolvedCourse = await Course.findOne({ _id: courseId, tenantId, isActive: { $ne: false } });
      if (!resolvedCourse) {
        return res.status(400).json({ success: false, message: `Course ID "${courseId}" does not exist in your academic structure` });
      }
    } else if (courseCode && String(courseCode).trim()) {
      const codeClean = String(courseCode).trim().toUpperCase();
      resolvedCourse = await Course.findOne({
        tenantId,
        isActive: { $ne: false },
        $or: [{ code: codeClean }, { name: { $regex: new RegExp(`^${codeClean}$`, "i") } }],
      });
      if (!resolvedCourse) {
        return res.status(400).json({ success: false, message: `Course "${courseCode}" does not exist in your academic structure. Please create the course first or check the code.` });
      }
    }

    const semesterNum = parseInt(semester, 10);
    const calculatedYear = calculateSubjectYear(semester, resolvedCourse?.semestersPerYear || 2);

    // Resolve branch from course branches — normalize to canonical name if provided.
    // Do NOT auto-default to first active branch; leave empty so the user can assign.
    let finalBranch = branch?.trim() || "";
    if (resolvedCourse && Array.isArray(resolvedCourse.branches) && resolvedCourse.branches.length > 0 && finalBranch) {
      const activeBranches = resolvedCourse.branches.filter(b => b.isActive !== false);
      const matchedBranch = activeBranches.find(b =>
        String(b.name || "").toLowerCase() === finalBranch.toLowerCase() ||
        String(b.code || "").toLowerCase() === finalBranch.toLowerCase() ||
        String(b.name || "").toLowerCase().includes(finalBranch.toLowerCase()) ||
        finalBranch.toLowerCase().includes(String(b.code || "").toLowerCase())
      );
      if (matchedBranch) finalBranch = matchedBranch.code;
    }

    const newSubject = new Subject({
      subjectCode: subjectCode.toUpperCase().trim(),
      subjectName: subjectName.trim(),
      description: description?.trim() || "",
      credits: credits || 0,
      semester: Number.isFinite(semesterNum) && semesterNum >= 1 ? String(semesterNum) : String(semester).trim(),
      year: calculatedYear,
      courseCode: resolvedCourse ? resolvedCourse.code : (courseCode?.trim() || ""),
      courseId: resolvedCourse ? resolvedCourse._id : (courseId || null),
      branch: finalBranch,
      createdBy: req.user._id,
      tenantId: tenantId,
    });

    await newSubject.save();

    await Tenant.findByIdAndUpdate(tenantId, {
      $inc: { "stats.totalSubjects": 1 },
    });

    return res.status(201).json({
      success: true,
      message: "Subject created successfully",
      subject: newSubject,
    });
  } catch (error) {
    logger.error("Error creating subject", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * ASSIGN SUBJECT + SECTION TO TEACHER
 * Tenant Admin only
 */
const assignSubjectToTeacher = async (req, res) => {
  let { teacherId, subjectId, sections } = req.body;
  const tenantId = req.user.tenantId;

  if (typeof sections === "string") {
    sections = sections.split(",").map((s) => s.trim());
  }

  if (
    !teacherId ||
    !subjectId ||
    !sections ||
    !Array.isArray(sections) ||
    sections.length === 0
  ) {
    return res.status(400).json({
      success: false,
      message: "Teacher ID, subject ID, and at least one section are required",
    });
  }

  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only tenant admins can assign subjects to teachers",
      });
    }

    const teacher = await User.findOne({
      _id: teacherId,
      tenantId: tenantId,
      role: "teacher",
    });

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: "Teacher not found in your institution",
      });
    }

    const subject = await Subject.findOne({
      _id: subjectId,
      tenantId: tenantId,
    });

    if (!subject) {
      return res.status(404).json({
        success: false,
        message: "Subject not found in your institution",
      });
    }

    // Validate that sections exist in active student enrollments
    const sectionValidation = await validateSectionsExist(tenantId, sections);
    if (!sectionValidation.valid) {
      return res.status(400).json({
        success: false,
        message: sectionValidation.message,
        invalidSections: sectionValidation.invalidSections,
        availableSections: sectionValidation.availableSections,
      });
    }

    const results = {
      assigned: [],
      alreadyAssigned: [],
      assignedToOtherTeacher: [],
      studentsUpdated: 0,
    };

    for (const section of sections) {
      const trimmedSection = section.trim();

      // Check if ANY teacher in the institution already has this subject assigned for this section
      const existingTeacherForSubjectSection = await User.findOne({
        tenantId: tenantId,
        role: "teacher",
        assignedSubjects: {
          $elemMatch: {
            subjectId: subject._id,
            section: trimmedSection,
          },
        },
      }).select("name email");

      if (existingTeacherForSubjectSection) {
        if (existingTeacherForSubjectSection._id.toString() === teacher._id.toString()) {
          results.alreadyAssigned.push(trimmedSection);
        } else {
          results.assignedToOtherTeacher.push({
            section: trimmedSection,
            teacherName: existingTeacherForSubjectSection.name,
            teacherEmail: existingTeacherForSubjectSection.email,
          });
        }
        continue;
      }

      teacher.assignedSubjects.push({
        subjectId: subject._id,
        subjectName: subject.subjectName,
        section: trimmedSection,
        assignedDate: Date.now(),
      });

      results.assigned.push(trimmedSection);
    }

    if (results.assigned.length === 0 && results.assignedToOtherTeacher.length > 0) {
      const conflicts = results.assignedToOtherTeacher
        .map((c) => `Section '${c.section}' is already assigned to ${c.teacherName} (${c.teacherEmail})`)
        .join("; ");
      return res.status(400).json({
        success: false,
        message: `Cannot assign subject '${subject.subjectName}': ${conflicts}. A subject section can only be assigned to one teacher.`,
        assignedToOtherTeacher: results.assignedToOtherTeacher,
      });
    }

    if (results.assigned.length > 0) {
      await teacher.save();

      for (const section of results.assigned) {
        try {
          // Scope enrollment queries by section and tenant, matching courseId/semester
          // while supporting legacy enrollments where courseId/semester might be null or string
          const enrollmentFilter = { section: section, tenantId: tenantId };

          const courseOrs = subject.courseId
            ? [{ courseId: subject.courseId }, { courseId: null }, { courseId: { $exists: false } }]
            : null;

          let semOrs = null;
          if (subject.semester) {
            const semNum = parseInt(String(subject.semester).replace(/\D/g, ""), 10);
            if (!isNaN(semNum) && semNum > 0) {
              semOrs = [
                { semester: semNum },
                { semester: String(semNum) },
                { semester: null },
                { semester: { $exists: false } },
              ];
            }
          }

          if (courseOrs && semOrs) {
            enrollmentFilter.$and = [{ $or: courseOrs }, { $or: semOrs }];
          } else if (courseOrs) {
            enrollmentFilter.$or = courseOrs;
          } else if (semOrs) {
            enrollmentFilter.$or = semOrs;
          }

          const enrollmentsInSection = await Enrollment.find(enrollmentFilter);

          if (enrollmentsInSection.length > 0) {
            const updateResult = await Enrollment.updateMany(
              enrollmentFilter,
              {
                $addToSet: {
                  subjects: {
                    subjectId: subject._id,
                    subjectName: subject.subjectName,
                    subjectCode: subject.subjectCode || "",
                    teacherId: teacher._id,
                    teacherName: teacher.name,
                    assignedAt: new Date(),
                    isActive: true,
                  },
                },
              },
            );
            results.studentsUpdated += updateResult.modifiedCount;
          }
        } catch (error) {
          logger.error(`Error updating section ${section}`, { error: error.message });
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: "Subject assignment processed",
      data: {
        teacher: teacher.name,
        subject: subject.subjectName,
        sectionsAssigned: results.assigned,
        sectionsAlreadyAssigned: results.alreadyAssigned,
        sectionsAssignedToOtherTeacher: results.assignedToOtherTeacher,
        studentsUpdated: results.studentsUpdated,
      },
    });
  } catch (error) {
    logger.error("Error assigning subject", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * UPDATE SUBJECT ASSIGNMENT (PUT /api/admin/assign-subject)
 * Tenant Admin only
 * Updates the assigned sections / teacher for a subject assignment
 */
const updateSubjectAssignment = async (req, res) => {
  let { teacherId, subjectId, sections, oldTeacherId, oldSubjectId } = req.body;
  const tenantId = req.user.tenantId;

  if (typeof sections === "string") {
    sections = sections.split(",").map((s) => s.trim());
  }

  if (!teacherId || !subjectId || !sections || !Array.isArray(sections) || sections.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Teacher ID, subject ID, and at least one section are required",
    });
  }

  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only tenant admins can update subject assignments",
      });
    }

    const teacher = await User.findOne({
      _id: teacherId,
      tenantId: tenantId,
      role: "teacher",
    });

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: "Teacher not found in your institution",
      });
    }

    const subject = await Subject.findOne({
      _id: subjectId,
      tenantId: tenantId,
    });

    if (!subject) {
      return res.status(404).json({
        success: false,
        message: "Subject not found in your institution",
      });
    }

    // Validate that sections exist in active student enrollments
    const sectionValidation = await validateSectionsExist(tenantId, sections);
    if (!sectionValidation.valid) {
      return res.status(400).json({
        success: false,
        message: sectionValidation.message,
        invalidSections: sectionValidation.invalidSections,
        availableSections: sectionValidation.availableSections,
      });
    }

    const trimmedSections = sections.map((s) => s.trim().toUpperCase());

    // Check for conflicts with other teachers (excluding this teacher)
    for (const sec of trimmedSections) {
      const conflictTeacher = await User.findOne({
        tenantId: tenantId,
        role: "teacher",
        _id: { $ne: teacher._id },
        assignedSubjects: {
          $elemMatch: {
            subjectId: subject._id,
            section: new RegExp(`^${sec}$`, "i"),
          },
        },
      }).select("name email");

      if (conflictTeacher) {
        return res.status(400).json({
          success: false,
          message: `Section '${sec}' is already assigned to ${conflictTeacher.name} (${conflictTeacher.email}). A subject section can only be assigned to one teacher.`,
        });
      }
    }

    // If teacher was changed from oldTeacherId, clear old assignments from oldTeacher
    if (oldTeacherId && oldTeacherId.toString() !== teacherId.toString()) {
      const oldTeacher = await User.findOne({ _id: oldTeacherId, tenantId, role: "teacher" });
      if (oldTeacher) {
        const targetSubId = oldSubjectId || subjectId;
        oldTeacher.assignedSubjects = (oldTeacher.assignedSubjects || []).filter(
          (a) => a.subjectId.toString() !== targetSubId.toString()
        );
        await oldTeacher.save();
      }
    }

    // Clear previous assignments for this subject from this teacher
    teacher.assignedSubjects = (teacher.assignedSubjects || []).filter(
      (a) => a.subjectId.toString() !== subject._id.toString()
    );

    // Add new section assignments
    for (const sec of trimmedSections) {
      teacher.assignedSubjects.push({
        subjectId: subject._id,
        subjectName: subject.subjectName,
        section: sec,
        assignedDate: Date.now(),
      });
    }

    await teacher.save();

    // Sync enrollments: remove teacher from unassigned sections
    await Enrollment.updateMany(
      {
        tenantId,
        "subjects.subjectId": subject._id,
        "subjects.teacherId": teacher._id,
        section: { $nin: trimmedSections },
      },
      {
        $set: {
          "subjects.$.teacherId": null,
          "subjects.$.teacherName": null,
        },
      }
    ).catch((e) => logger.warn("Failed to unassign teacher from old enrollments", { error: e.message }));

    // Add/update teacher in newly assigned sections
    let studentsUpdated = 0;
    for (const sec of trimmedSections) {
      const enrollmentFilter = { section: sec, tenantId: tenantId };
      const courseOrs = subject.courseId
        ? [{ courseId: subject.courseId }, { courseId: null }, { courseId: { $exists: false } }]
        : null;

      let semOrs = null;
      if (subject.semester) {
        const semNum = parseInt(String(subject.semester).replace(/\D/g, ""), 10);
        if (!isNaN(semNum) && semNum > 0) {
          semOrs = [
            { semester: semNum },
            { semester: String(semNum) },
            { semester: null },
            { semester: { $exists: false } },
          ];
        }
      }

      if (courseOrs && semOrs) {
        enrollmentFilter.$and = [{ $or: courseOrs }, { $or: semOrs }];
      } else if (courseOrs) {
        enrollmentFilter.$or = courseOrs;
      } else if (semOrs) {
        enrollmentFilter.$or = semOrs;
      }

      const updateResult = await Enrollment.updateMany(
        enrollmentFilter,
        {
          $addToSet: {
            subjects: {
              subjectId: subject._id,
              subjectName: subject.subjectName,
              subjectCode: subject.subjectCode || "",
              teacherId: teacher._id,
              teacherName: teacher.name,
              assignedAt: new Date(),
              isActive: true,
            },
          },
        }
      );
      studentsUpdated += updateResult.modifiedCount;
    }

    logActivity({
      tenantId,
      userId: req.user._id,
      description: `Updated subject assignment for teacher ${teacher.name}: ${subject.subjectName} (${trimmedSections.join(", ")})`,
      endpoint: `/api/admin/assign-subject`,
      statusCode: 200,
      ipAddress: req.ip,
    });

    return res.status(200).json({
      success: true,
      message: "Subject assignment updated successfully",
      data: {
        teacher: teacher.name,
        subject: subject.subjectName,
        sections: trimmedSections,
        studentsUpdated,
      },
    });
  } catch (error) {
    logger.error("Error updating subject assignment", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * GET ALL TEACHERS (within tenant)
 */
const getAllTeachers = async (req, res) => {
  try {
    const rawTenantId = req.tenantId || req.user?.tenantId || req.tenant?._id;
    const tenantId = toObjectId(rawTenantId);
    const teachers = await User.find({
      role: "teacher",
      tenantId: tenantId,
    })
      .select("-password")
      .populate("assignedSubjects.subjectId")
      .populate("customRoles.roleId", "name");

    const transformedTeachers = teachers.map((teacher) => {
      const teacherObj = teacher.toObject();
      const assignmentsBySection = teacherObj.assignedSubjects.reduce(
        (acc, assignment) => {
          const section = assignment.section;
          if (!acc[section]) acc[section] = [];
          acc[section].push({
            subjectId: assignment.subjectId,
            subjectName: assignment.subjectName,
            assignedDate: assignment.assignedDate,
          });
          return acc;
        },
        {},
      );

      return {
        ...teacherObj,
        assignmentsBySection,
        teachingSections: Object.keys(assignmentsBySection),
      };
    });

    return res.status(200).json({
      success: true,
      message: "Teachers retrieved successfully",
      data: transformedTeachers,
    });
  } catch (error) {
    logger.error("Error fetching teachers", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * GET ALL SUBJECTS (within tenant)
 */
const getAllSubjects = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    let subjects = await Subject.find({
      isActive: true,
      tenantId: tenantId,
    })
      .populate("createdBy", "name email")
      .lean();

    const tenantCourses = await Course.find({ tenantId, isActive: { $ne: false } }).lean();
    if (tenantCourses.length > 0) {
      const courseMapById = new Map(tenantCourses.map(c => [String(c._id), c]));
      const courseMapByCode = new Map(tenantCourses.map(c => [String(c.code).toUpperCase(), c]));
      const courseMapByName = new Map(tenantCourses.map(c => [String(c.name).toUpperCase(), c]));

      for (let subject of subjects) {
        let matchedCourse = null;

        if (subject.courseId) {
          matchedCourse = courseMapById.get(String(subject.courseId));
        }
        if (!matchedCourse && subject.courseCode) {
          const codeUpper = String(subject.courseCode).toUpperCase();
          matchedCourse = courseMapByCode.get(codeUpper) || courseMapByName.get(codeUpper);
        }
        // Do NOT fall back to tenantCourses[0] or attempt fuzzy subject-name matching.
        // Unmatched subjects keep their existing courseId/courseCode untouched.

        if (matchedCourse) {
          const calculatedYear = calculateSubjectYear(subject.semester, matchedCourse.semestersPerYear || 2);
          let inferredBranch = subject.branch || "";
          if (Array.isArray(matchedCourse.branches) && matchedCourse.branches.length > 0) {
            const activeBranches = matchedCourse.branches.filter(b => b.isActive !== false);
            if (activeBranches.length > 0 && inferredBranch) {
              // Only normalize if the subject already has a branch — try to match it
              // against course branches (exact name or exact code match only).
              const matchedB = activeBranches.find(b =>
                String(b.name || "").toLowerCase() === String(inferredBranch).toLowerCase() ||
                String(b.code || "").toLowerCase() === String(inferredBranch).toLowerCase()
              );
              inferredBranch = matchedB ? matchedB.code : "";
            }
            // If subject has no branch (!inferredBranch) — leave it empty.
            // Do NOT default to first active branch; that causes wrong branch
            // assignment and breaks branch-level filtering.
          } else {
            // Course has no branches defined — clear any stale branch value
            inferredBranch = "";
          }

          const needUpdate =
            subject.courseCode !== matchedCourse.code ||
            String(subject.courseId || "") !== String(matchedCourse._id) ||
            subject.year !== calculatedYear ||
            subject.branch !== inferredBranch;

          subject.courseId = matchedCourse._id;
          subject.courseCode = matchedCourse.code;
          subject.year = calculatedYear;
          subject.branch = inferredBranch;

          if (needUpdate) {
            await Subject.updateOne(
              { _id: subject._id },
              { $set: { courseId: matchedCourse._id, courseCode: matchedCourse.code, year: calculatedYear, branch: inferredBranch } }
            );
          }
        } else {
          const calculatedYear = calculateSubjectYear(subject.semester, 2);
          if (calculatedYear && subject.year !== calculatedYear) {
            subject.year = calculatedYear;
            await Subject.updateOne({ _id: subject._id }, { $set: { year: calculatedYear } });
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: "Subjects retrieved successfully",
      data: subjects,
    });
  } catch (error) {
    logger.error("Error fetching subjects", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * GET ALL ENROLLMENTS (within tenant)
 */
const getAllEnrollments = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    let filter = { tenantId: req.user.tenantId };
    if (req.query.section) filter.section = req.query.section;
    if (req.query.isRegistered !== undefined)
      filter.isRegistered = req.query.isRegistered === "true";

    const total = await Enrollment.countDocuments(filter);
    const enrollments = await Enrollment.find(filter)
      .populate({ path: "userId", select: "name email role" })
      .populate({ path: "uploadedBy", select: "name email" })
      .populate({
        path: "subjects.subjectId",
        select: "subjectName subjectCode semester credits",
      })
      .populate({ path: "subjects.teacherId", select: "name email" })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const transformedEnrollments = await Promise.all(
      enrollments.map(async (enrollment) => {
        let subjectsList = enrollment.subjects;
        if (!subjectsList || subjectsList.length === 0) {
          subjectsList = await syncEnrollmentSubjects(enrollment);
        }
        const obj = enrollment.toObject();
        obj.subjects = subjectsList;

        return {
          ...obj,
          fullName: `${enrollment.firstName} ${enrollment.lastName}`,
          registeredUser: enrollment.userId
            ? {
                id: enrollment.userId._id,
                name: enrollment.userId.name,
                email: enrollment.userId.email,
                role: enrollment.userId.role,
              }
            : null,
          subjectCount: subjectsList?.length || 0,
          activeSubjectCount: subjectsList?.filter((s) => s.isActive).length || 0,
        };
      })
    );

    return res.status(200).json({
      success: true,
      message: "Enrollments retrieved successfully",
      data: {
        enrollments: transformedEnrollments,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    logger.error("Error fetching enrollments", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * GET ENROLLMENT BY ID
 */
const getEnrollmentById = async (req, res) => {
  const { id } = req.params;
  const tenantId = req.user.tenantId;

  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only tenant admins can view enrollments",
      });
    }

    const enrollment = await Enrollment.findOne({
      _id: id,
      tenantId: tenantId,
    })
      .populate({ path: "userId", select: "name email role" })
      .populate({ path: "uploadedBy", select: "name email" })
      .populate({
        path: "subjects.subjectId",
        select: "subjectName subjectCode semester credits",
      })
      .populate({ path: "subjects.teacherId", select: "name email" });

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: "Enrollment not found",
      });
    }

    let subjectsList = enrollment.subjects;
    if (!subjectsList || subjectsList.length === 0) {
      subjectsList = await syncEnrollmentSubjects(enrollment);
    }

    const dataObj = enrollment.toObject();
    dataObj.subjects = subjectsList;

    return res.status(200).json({
      success: true,
      message: "Enrollment retrieved successfully",
      data: dataObj,
    });
  } catch (error) {
    logger.error("Error fetching enrollment", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * GET ENROLLMENTS BY SECTION
 */
const getEnrollmentsBySection = async (req, res) => {
  const { section } = req.params;
  const tenantId = req.user.tenantId;

  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only tenant admins can view enrollments",
      });
    }

    const filter = {
      section: section,
      tenantId: tenantId,
    };
    if (req.query.courseId) filter.courseId = req.query.courseId;
    if (req.query.branch) filter.branch = new RegExp(`^${req.query.branch.trim()}$`, "i");

    const enrollments = await Enrollment.find(filter)
      .populate({ path: "userId", select: "name email" })
      .populate({
        path: "subjects.subjectId",
        select: "subjectName subjectCode",
      });

    const transformed = await Promise.all(
      enrollments.map(async (e) => {
        let subList = e.subjects;
        if (!subList || subList.length === 0) {
          subList = await syncEnrollmentSubjects(e);
        }
        const obj = e.toObject();
        obj.subjects = subList;
        return obj;
      })
    );

    return res.status(200).json({
      success: true,
      message: `Enrollments for section ${section} retrieved successfully`,
      count: transformed.length,
      data: transformed,
    });
  } catch (error) {
    logger.error("Error fetching enrollments by section", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * GET MY ENROLLMENT (for logged-in student)
 */
const getMyEnrollment = async (req, res) => {
  try {
    const enrollment = await Enrollment.findOne({
      userId: req.user._id,
      tenantId: req.user.tenantId,
    })
      .populate({
        path: "subjects.subjectId",
        select: "subjectName subjectCode semester credits description",
      })
      .populate({
        path: "subjects.teacherId",
        select: "name email",
      });

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: "Enrollment not found for this student",
      });
    }

    let activeSubjects = enrollment.getActiveSubjects();
    if (!activeSubjects || activeSubjects.length === 0) {
      activeSubjects = await syncEnrollmentSubjects(enrollment);
    }

    return res.status(200).json({
      success: true,
      message: "Your enrollment retrieved successfully",
      data: {
        enrollmentNumber: enrollment.enrollmentNumber,
        firstName: enrollment.firstName,
        lastName: enrollment.lastName,
        email: enrollment.email,
        section: enrollment.section,
        isRegistered: enrollment.isRegistered,
        registeredAt: enrollment.registeredAt,
        subjects: activeSubjects,
        subjectCount: activeSubjects.length,
      },
    });
  } catch (error) {
    logger.error("Error fetching your enrollment", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * GET ALL ASSIGNMENTS
 */
const getAllAssignments = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only tenant admins can view assignments",
      });
    }

    const teachers = await User.find({
      role: "teacher",
      tenantId: req.user.tenantId,
    })
      .select("name email rollNo assignedSubjects")
      .populate({
        path: "assignedSubjects.subjectId",
        select: "subjectName subjectCode semester credits description courseId courseCode branch year",
      });

    const assignments = [];

    // Batch enrollment counts: collect all unique sections, then one query
    const sectionSet = new Set();
    const teacherAssignmentMap = [];
    for (const teacher of teachers) {
      if (!teacher.assignedSubjects || teacher.assignedSubjects.length === 0) continue;
      for (const assignment of teacher.assignedSubjects) {
        const sec = assignment.section;
        sectionSet.add(sec);
        teacherAssignmentMap.push({ teacher, assignment, section: sec });
      }
    }

    const sectionCounts = {};
    if (sectionSet.size > 0) {
      const sections = Array.from(sectionSet);
      const countResults = await Enrollment.aggregate([
        { $match: { section: { $in: sections }, tenantId: req.user.tenantId } },
        { $group: { _id: '$section', count: { $sum: 1 } } }
      ]);
      for (const r of countResults) {
        sectionCounts[r._id] = r.count;
      }
    }

    for (const { teacher, assignment, section: sec } of teacherAssignmentMap) {
      const sub = assignment.subjectId;
      const studentCount = sectionCounts[sec] || 0;

      assignments.push({
        _id: assignment._id,
        teacher: {
          _id: teacher._id,
          name: teacher.name,
          email: teacher.email,
          rollNo: teacher.rollNo,
        },
        subject: sub
          ? {
            _id: sub._id,
            subjectName: sub.subjectName,
            subjectCode: sub.subjectCode,
            semester: sub.semester,
            credits: sub.credits,
            description: sub.description,
            courseId: sub.courseId,
            courseCode: sub.courseCode,
            branch: sub.branch,
            year: sub.year,
          }
          : {
            _id: assignment.subjectId,
            subjectName: assignment.subjectName,
            subjectCode: "N/A",
          },
        section: sec,
        assignedDate: assignment.assignedDate,
        studentsUpdated: studentCount,
        studentsCount: studentCount,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Assignments retrieved successfully",
      data: assignments,
      stats: {
        totalAssignments: assignments.length,
        totalTeachers: teachers.length,
        teachersWithAssignments: teachers.filter(
          (t) => t.assignedSubjects?.length > 0,
        ).length,
      },
    });
  } catch (error) {
    logger.error("Error fetching assignments", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

/**
 * DELETE ASSIGNMENT
 * Tenant Admin only
 * Deletes a teacher subject-section assignment by assignmentId or (teacherId, subjectId, section)
 */
const deleteAssignment = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only tenant admins can delete assignments",
      });
    }

    const tenantId = req.user.tenantId;
    const assignmentId = req.params.assignmentId || req.query.assignmentId || req.body.assignmentId;
    const { teacherId, subjectId, section } = req.body || {};

    let targetTeacher = null;
    let targetAssignmentId = null;
    let targetSubjectId = null;
    let targetSection = null;

    if (assignmentId && mongoose.Types.ObjectId.isValid(assignmentId)) {
      targetTeacher = await User.findOne({
        tenantId,
        role: "teacher",
        "assignedSubjects._id": assignmentId,
      });

      if (targetTeacher) {
        targetAssignmentId = assignmentId;
        const foundAss = targetTeacher.assignedSubjects.find(
          (a) => String(a._id) === String(assignmentId)
        );
        if (foundAss) {
          targetSubjectId = foundAss.subjectId;
          targetSection = foundAss.section;
        }
      }
    }

    if (!targetTeacher && teacherId) {
      targetTeacher = await User.findOne({
        _id: teacherId,
        tenantId,
        role: "teacher",
      });

      if (targetTeacher && subjectId && section) {
        const foundAss = targetTeacher.assignedSubjects.find(
          (a) =>
            String(a.subjectId) === String(subjectId) &&
            String(a.section).toUpperCase() === String(section).toUpperCase()
        );
        if (foundAss) {
          targetAssignmentId = foundAss._id;
          targetSubjectId = foundAss.subjectId;
          targetSection = foundAss.section;
        }
      }
    }

    if (!targetTeacher || !targetAssignmentId) {
      return res.status(404).json({
        success: false,
        message: "Teacher assignment not found",
      });
    }

    targetTeacher.assignedSubjects.pull({ _id: targetAssignmentId });
    await targetTeacher.save();

    if (targetSubjectId && targetSection) {
      await Enrollment.updateMany(
        {
          tenantId,
          section: targetSection,
          "subjects.subjectId": targetSubjectId,
          "subjects.teacherId": targetTeacher._id,
        },
        {
          $set: {
            "subjects.$.teacherId": null,
            "subjects.$.teacherName": null,
          },
        }
      ).catch((e) => logger.warn("Failed to clear teacher from enrollments", { error: e.message }));
    }

    logActivity({
      tenantId,
      userId: req.user._id,
      description: `Deleted assignment (${targetAssignmentId}) for teacher ${targetTeacher.name}`,
      endpoint: `/api/admin/assignments/${targetAssignmentId}`,
      statusCode: 200,
      ipAddress: req.ip,
    });

    return res.status(200).json({
      success: true,
      message: "Teacher assignment deleted successfully",
      data: {
        assignmentId: targetAssignmentId,
        teacherId: targetTeacher._id,
      },
    });
  } catch (error) {
    logger.error("Error deleting assignment", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Failed to delete teacher assignment",
      error: error.message,
    });
  }
};

/**
 * GET ASSIGNMENTS BY TEACHER
 */
const getAssignmentsByTeacher = async (req, res) => {
  const { teacherId } = req.params;
  const tenantId = req.user.tenantId;

  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only tenant admins can view assignments",
      });
    }

    const teacher = await User.findOne({
      _id: teacherId,
      tenantId: tenantId,
      role: "teacher",
    })
      .select("name email rollNo assignedSubjects")
      .populate({
        path: "assignedSubjects.subjectId",
        select: "subjectName subjectCode semester credits description courseId courseCode branch year",
      });

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: "Teacher not found",
      });
    }

    const assignments = teacher.assignedSubjects.map((assignment) => ({
      _id: assignment._id,
      subject: assignment.subjectId
        ? {
          _id: assignment.subjectId._id,
          subjectName: assignment.subjectId.subjectName,
          subjectCode: assignment.subjectId.subjectCode,
          semester: assignment.subjectId.semester,
          credits: assignment.subjectId.credits,
          courseId: assignment.subjectId.courseId,
          courseCode: assignment.subjectId.courseCode,
          branch: assignment.subjectId.branch,
          year: assignment.subjectId.year,
        }
        : {
          _id: assignment.subjectId,
          subjectName: assignment.subjectName,
          subjectCode: "N/A",
        },
      section: assignment.section,
      assignedDate: assignment.assignedDate,
    }));

    const bySection = assignments.reduce((acc, curr) => {
      if (!acc[curr.section]) {
        acc[curr.section] = [];
      }
      acc[curr.section].push(curr);
      return acc;
    }, {});

    return res.status(200).json({
      success: true,
      message: "Teacher assignments retrieved successfully",
      data: {
        teacher: {
          _id: teacher._id,
          name: teacher.name,
          email: teacher.email,
          rollNo: teacher.rollNo,
        },
        totalAssignments: assignments.length,
        assignments,
        bySection,
      },
    });
  } catch (error) {
    logger.error("Error fetching teacher assignments", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * GET ASSIGNMENTS BY SUBJECT
 */
const getAssignmentsBySubject = async (req, res) => {
  const { subjectId } = req.params;
  const tenantId = req.user.tenantId;

  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only tenant admins can view assignments",
      });
    }

    const subject = await Subject.findOne({
      _id: subjectId,
      tenantId: tenantId,
    });

    if (!subject) {
      return res.status(404).json({
        success: false,
        message: "Subject not found",
      });
    }

    const teachers = await User.find({
      role: "teacher",
      tenantId: tenantId,
      "assignedSubjects.subjectId": subjectId,
    })
      .select("name email rollNo assignedSubjects")
      .populate({
        path: "assignedSubjects.subjectId",
        select: "subjectName subjectCode",
      });

    const assignments = [];

    teachers.forEach((teacher) => {
      teacher.assignedSubjects.forEach((assignment) => {
        if (assignment.subjectId?._id.toString() === subjectId) {
          assignments.push({
            _id: assignment._id,
            teacher: {
              _id: teacher._id,
              name: teacher.name,
              email: teacher.email,
              rollNo: teacher.rollNo,
            },
            section: assignment.section,
            assignedDate: assignment.assignedDate,
          });
        }
      });
    });

    return res.status(200).json({
      success: true,
      message: "Subject assignments retrieved successfully",
      data: {
        subject: {
          _id: subject._id,
          subjectName: subject.subjectName,
          subjectCode: subject.subjectCode,
          semester: subject.semester,
        },
        totalTeachers: assignments.length,
        assignments,
      },
    });
  } catch (error) {
    logger.error("Error fetching subject assignments", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * GET ASSIGNMENTS BY SECTION
 */
const getAssignmentsBySection = async (req, res) => {
  const { section } = req.params;
  const tenantId = req.user.tenantId;

  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only tenant admins can view assignments",
      });
    }

    const teachers = await User.find({
      role: "teacher",
      tenantId: tenantId,
      "assignedSubjects.section": section,
    })
      .select("name email rollNo assignedSubjects")
      .populate({
        path: "assignedSubjects.subjectId",
        select: "subjectName subjectCode semester credits",
      });

    const assignments = [];

    teachers.forEach((teacher) => {
      teacher.assignedSubjects.forEach((assignment) => {
        if (assignment.section === section) {
          assignments.push({
            _id: assignment._id,
            teacher: {
              _id: teacher._id,
              name: teacher.name,
              email: teacher.email,
              rollNo: teacher.rollNo,
            },
            subject: assignment.subjectId
              ? {
                _id: assignment.subjectId._id,
                subjectName: assignment.subjectId.subjectName,
                subjectCode: assignment.subjectId.subjectCode,
                semester: assignment.subjectId.semester,
                credits: assignment.subjectId.credits,
              }
              : {
                _id: assignment.subjectId,
                subjectName: assignment.subjectName,
                subjectCode: "N/A",
              },
            assignedDate: assignment.assignedDate,
          });
        }
      });
    });

    const studentCount = await Enrollment.countDocuments({
      section: section,
      tenantId: tenantId,
    });

    return res.status(200).json({
      success: true,
      message: `Assignments for section ${section} retrieved successfully`,
      data: {
        section,
        studentCount,
        totalAssignments: assignments.length,
        totalTeachers: teachers.length,
        assignments,
      },
    });
  } catch (error) {
    logger.error("Error fetching section assignments", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// ==================== SUPER ADMIN FUNCTIONS ====================

/**
 * GET ALL TENANTS (Super Admin only)
 */
const getAllTenants = async (req, res) => {
  try {
    if (req.user.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Super admin access required",
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const [rawTenants, total] = await Promise.all([
      Tenant.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Tenant.countDocuments({})
    ]);

    const tenants = rawTenants.map((t) => ({
      ...t,
      limits: getEffectiveLimits(t.subscription?.plan, t.limits),
      modules: getEffectiveModules(t.subscription?.plan, t.modules),
    }));

    return res.status(200).json({
      success: true,
      message: "Tenants retrieved successfully",
      data: tenants,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error("Error fetching tenants", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

/**
 * GET TENANT DETAILS (Super Admin only)
 */
const getTenantDetails = async (req, res) => {
  try {
    if (req.user.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Super admin access required",
      });
    }

    const tenant = await Tenant.findById(req.params.tenantId).lean();
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: "Tenant not found",
      });
    }

    tenant.limits = getEffectiveLimits(tenant.subscription?.plan, tenant.limits);
    tenant.modules = getEffectiveModules(tenant.subscription?.plan, tenant.modules);

    return res.status(200).json({
      success: true,
      message: "Tenant details retrieved successfully",
      data: tenant,
    });
  } catch (error) {
    logger.error("Error fetching tenant", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * UPDATE TENANT SUBSCRIPTION (Super Admin only)
 */
const updateTenantSubscription = async (req, res) => {
  try {
    if (req.user.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Super admin access required",
      });
    }

    const { plan, status, billingCycle } = req.body;
    const tenant = await Tenant.findById(req.params.tenantId);

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: "Tenant not found",
      });
    }

    if (plan) {
      const { applyPlanUpgradeToTenant } = require('../utils/planDefaults');
      applyPlanUpgradeToTenant(tenant, plan);
    }
    if (status) tenant.subscription.status = status;
    if (billingCycle) tenant.subscription.billingCycle = billingCycle;

    if (tenant.subscription.status === 'active' || tenant.subscription.plan !== 'free') {
      tenant.subscription.trialEndsAt = null;
    }

    await tenant.save();

    // Invalidate tenant cache
    await cache.del(`tenant:${tenant._id}`);
    if (tenant.subdomain) {
      await cache.del(`tenant:subdomain:${tenant.subdomain}`);
    }

    logActivity({
      tenantId: tenant._id,
      userId: req.user._id,
      description: `Subscription updated for ${tenant.name} (plan: ${tenant.subscription.plan}, status: ${tenant.subscription.status})`,
      endpoint: `/api/admin/super/tenants/${tenant._id}/subscription`,
      statusCode: 200,
      ipAddress: req.ip,
    });

    const tenantObj = tenant.toObject();
    tenantObj.limits = getEffectiveLimits(tenant.subscription.plan, tenant.limits);
    tenantObj.modules = getEffectiveModules(tenant.subscription.plan, tenant.modules);

    return res.status(200).json({
      success: true,
      message: "Tenant subscription updated successfully",
      data: tenantObj,
    });
  } catch (error) {
    logger.error("Error updating tenant subscription", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * SUSPEND TENANT (Super Admin only)
 */
const suspendTenant = async (req, res) => {
  try {
    if (req.user.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Super admin access required",
      });
    }

    const tenant = await Tenant.findById(req.params.tenantId);
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: "Tenant not found",
      });
    }

    tenant.subscription.status = "suspended";
    await tenant.save();

    // Invalidate tenant cache
    await cache.del(`tenant:${tenant._id}`);
    if (tenant.subdomain) {
      await cache.del(`tenant:subdomain:${tenant.subdomain}`);
    }

    logActivity({
      tenantId: tenant._id,
      userId: req.user._id,
      description: `Tenant suspended: ${tenant.name}`,
      endpoint: `/api/admin/super/tenants/${tenant._id}/suspend`,
      statusCode: 200,
      ipAddress: req.ip,
    });

    return res.status(200).json({
      success: true,
      message: "Tenant suspended successfully",
    });
  } catch (error) {
    logger.error("Error suspending tenant", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * ACTIVATE TENANT (Super Admin only)
 */
const activateTenant = async (req, res) => {
  try {
    if (req.user.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Super admin access required",
      });
    }

    const tenant = await Tenant.findById(req.params.tenantId);
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: "Tenant not found",
      });
    }

    tenant.subscription.status = "active";
    await tenant.save();

    // Invalidate tenant cache
    await cache.del(`tenant:${tenant._id}`);
    if (tenant.subdomain) {
      await cache.del(`tenant:subdomain:${tenant.subdomain}`);
    }

    logActivity({
      tenantId: tenant._id,
      userId: req.user._id,
      description: `Tenant activated: ${tenant.name}`,
      endpoint: `/api/admin/super/tenants/${tenant._id}/activate`,
      statusCode: 200,
      ipAddress: req.ip,
    });

    return res.status(200).json({
      success: true,
      message: "Tenant activated successfully",
    });
  } catch (error) {
    logger.error("Error activating tenant", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * DELETE TENANT (Super Admin only)
 */
const deleteTenant = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (req.user.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Super admin access required",
      });
    }

    const tenant = await Tenant.findById(req.params.tenantId);
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: "Tenant not found",
      });
    }

    await User.deleteMany({
      $or: [
        { tenantId: tenant._id },
        { tenantId: tenant._id.toString() },
        { email: tenant.contact?.email?.toLowerCase() }
      ]
    }, { session });
    await Subject.deleteMany({ tenantId: tenant._id }, { session });
    await Enrollment.deleteMany({ tenantId: tenant._id }, { session });
    await Attendance.deleteMany({ tenantId: tenant._id }, { session });
    await Ticket.deleteMany({ tenantId: tenant._id }, { session });
    await Alert.deleteMany({ tenantId: tenant._id }, { session });
    await Invoice.deleteMany({ tenantId: tenant._id }, { session });
    await SupportTicket.deleteMany({ tenantId: tenant._id }, { session });
    await CalendarEvent.deleteMany({ tenantId: tenant._id }, { session });
    await APILog.deleteMany({ tenantId: tenant._id }, { session });
    await Tenant.deleteOne({ _id: tenant._id }, { session });

    await session.commitTransaction();

    // Invalidate tenant cache
    await cache.del(`tenant:${tenant._id}`);
    if (tenant.subdomain) {
      await cache.del(`tenant:subdomain:${tenant.subdomain}`);
    }

    logActivity({
      tenantId: tenant._id,
      userId: req.user._id,
      description: `Tenant deleted: ${tenant.name} (${tenant.subdomain})`,
      endpoint: `/api/admin/super/tenants/${tenant._id}`,
      statusCode: 200,
      ipAddress: req.ip,
    });

    return res.status(200).json({
      success: true,
      message: "Tenant and all associated data deleted successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    logger.error("Error deleting tenant", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

/**
 * GET PLATFORM STATS (Super Admin only)
 */
const getPlatformStats = async (req, res) => {
  try {
    if (req.user.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Super admin access required",
      });
    }

    const [
      totalTenants,
      activeTenants,
      totalStudents,
      totalTeachers,
      totalAdmins,
      totalSubjects,
      totalAttendanceRecords,
      totalTickets,
    ] = await Promise.all([
      Tenant.countDocuments(),
      Tenant.countDocuments({ "subscription.status": "active" }),
      User.countDocuments({ role: "student" }),
      User.countDocuments({ role: "teacher" }),
      User.countDocuments({ role: "admin" }),
      Subject.countDocuments(),
      Attendance.countDocuments(),
      Ticket.countDocuments(),
    ]);

    return res.status(200).json({
      success: true,
      message: "Platform statistics retrieved successfully",
      data: {
        tenants: {
          total: totalTenants,
          active: activeTenants,
        },
        users: {
          students: totalStudents,
          teachers: totalTeachers,
          admins: totalAdmins,
          total: totalStudents + totalTeachers + totalAdmins,
        },
        content: {
          subjects: totalSubjects,
          attendanceRecords: totalAttendanceRecords,
          tickets: totalTickets,
        },
      },
    });
  } catch (error) {
    logger.error("Error fetching platform stats", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * BULK CREATE SUBJECTS
 * Tenant Admin only (Plan gated: bulk_operations)
 */
const bulkCreateSubjects = async (req, res) => {
  try {
    const rawEntries = req.body.subjects || req.body.entries || req.body;
    const subjectsList = Array.isArray(rawEntries) ? rawEntries : [];

    if (subjectsList.length === 0) {
      return res.status(400).json({ success: false, message: "Subjects array is required and cannot be empty" });
    }

    const rawTenantId = req.tenantId || req.user?.tenantId || req.tenant?._id;
    const tenantId = toObjectId(rawTenantId);
    const rowErrors = [];
    const validSubjects = [];
    const seenCodes = new Set();

    const existingSubjects = await Subject.find({ tenantId, isActive: true }).select("subjectCode").lean();
    const existingCodeSet = new Set(existingSubjects.map(s => String(s.subjectCode).toUpperCase()));

    const tenantCourses = await Course.find({ tenantId, isActive: { $ne: false } }).lean();
    const courseMapById = new Map();
    const courseMapByCode = new Map();
    const courseMapByName = new Map();

    tenantCourses.forEach((c) => {
      courseMapById.set(String(c._id), c);
      if (c.code) courseMapByCode.set(String(c.code).toUpperCase(), c);
      if (c.name) courseMapByName.set(String(c.name).toUpperCase(), c);
    });

    for (let i = 0; i < subjectsList.length; i++) {
      const raw = subjectsList[i] || {};
      const subjectCode = String(raw.subjectCode || "").toUpperCase().trim();
      const subjectName = String(raw.subjectName || "").trim();
      const semesterNum = parseInt(raw.semester, 10);
      const semester = Number.isFinite(semesterNum) && semesterNum >= 1 ? String(semesterNum) : String(raw.semester || "").trim();
      const credits = Number(raw.credits) || 4;
      const description = String(raw.description || "").trim();
      const rawCourseCode = String(raw.courseCode || "").trim();
      const rawCourseId = raw.courseId ? String(raw.courseId).trim() : null;
      const rawCourseName = String(raw.course || raw.program || "").trim();
      const rawBranch = String(raw.branch || "").trim();

      const errors = [];
      if (!subjectCode) errors.push("Subject Code is required");
      if (!subjectName) errors.push("Subject Name is required");
      if (!semester) errors.push("Semester is required");

      if (subjectCode) {
        if (seenCodes.has(subjectCode)) {
          errors.push(`Subject Code '${subjectCode}' is repeated multiple times in your file`);
        } else if (existingCodeSet.has(subjectCode)) {
          errors.push(`Subject Code '${subjectCode}' is already registered in your institution`);
        }
      }

      const candidates = [rawCourseId, rawCourseCode, rawCourseName].filter(Boolean);
      let resolvedCourse = null;

      for (const key of candidates) {
        const keyUpper = key.toUpperCase();
        resolvedCourse =
          courseMapById.get(key) ||
          courseMapByCode.get(keyUpper) ||
          courseMapByName.get(keyUpper) ||
          null;
        if (resolvedCourse) break;
      }

      if (candidates.length > 0 && !resolvedCourse) {
        errors.push(`Course '${candidates.join(" / ")}' was not found in your academic structure`);
      }

      let finalBranch = rawBranch;
      if (resolvedCourse && rawBranch && Array.isArray(resolvedCourse.branches) && resolvedCourse.branches.length > 0) {
        const matchedBranch = resolvedCourse.branches.find(
          (b) => b.isActive !== false && (
            String(b.name || "").toLowerCase() === rawBranch.toLowerCase() ||
            String(b.code || "").toLowerCase() === rawBranch.toLowerCase()
          )
        );
        if (matchedBranch) {
          finalBranch = matchedBranch.code;
        }
      }

      if (errors.length > 0) {
        rowErrors.push({ index: i, error: errors.join("; ") });
      } else {
        seenCodes.add(subjectCode);
        const calculatedYear = calculateSubjectYear(semester, resolvedCourse?.semestersPerYear || 2);

        validSubjects.push({
          tenantId,
          subjectCode,
          subjectName,
          semester,
          year: calculatedYear,
          credits,
          description,
          courseCode: resolvedCourse ? resolvedCourse.code : rawCourseCode,
          courseId: resolvedCourse ? toObjectId(resolvedCourse._id) : (rawCourseId ? toObjectId(rawCourseId) : null),
          branch: finalBranch,
          isActive: raw.isActive !== undefined && raw.isActive !== "" ? (raw.isActive === true || raw.isActive === "true" || raw.isActive === "TRUE") : true,
          createdBy: toObjectId(req.user._id),
        });
      }
    }

    if (rowErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Bulk subject import failed: ${rowErrors.length} row(s) contain errors. Please review the highlighted issues below.`,
        errors: rowErrors,
      });
    }

    const createdDocs = [];
    const INSERT_CHUNK = 1000;
    for (let i = 0; i < validSubjects.length; i += INSERT_CHUNK) {
      const chunk = validSubjects.slice(i, i + INSERT_CHUNK);
      const inserted = await Subject.insertMany(chunk, { ordered: false });
      createdDocs.push(...inserted);
    }

    await Tenant.findByIdAndUpdate(tenantId, {
      $inc: { "stats.totalSubjects": createdDocs.length },
    });

    logActivity({
      tenantId,
      userId: req.user._id,
      description: `Bulk created ${createdDocs.length} subjects`,
      endpoint: '/api/admin/bulk-subjects',
      statusCode: 201,
      ipAddress: req.ip,
    });

    return res.status(201).json({
      success: true,
      message: `${createdDocs.length} subjects created successfully`,
      count: createdDocs.length,
      data: createdDocs,
    });
  } catch (error) {
    logger.error("Error bulk creating subjects", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to bulk create subjects", error: error.message });
  }
};

/**
 * BULK CREATE TEACHERS
 * Tenant Admin only (Plan gated: bulk_operations)
 */
const bulkCreateTeachers = async (req, res) => {
  try {
    const rawEntries = req.body.teachers || req.body.users || req.body.entries || req.body;
    const teachersList = Array.isArray(rawEntries) ? rawEntries : [];

    if (teachersList.length === 0) {
      return res.status(400).json({ success: false, message: "Teachers array is required and cannot be empty" });
    }

    const rawTenantId = req.tenantId || req.user?.tenantId || req.tenant?._id;
    const tenantId = toObjectId(rawTenantId);
    const tenant = await Tenant.findById(tenantId);
    const rowErrors = [];
    const validTeachers = [];
    const seenEmails = new Set();
    const seenRollNos = new Set();

    const existingUsers = await User.find({ tenantId }).select("email rollNo").lean();
    const existingEmailSet = new Set(existingUsers.map(u => String(u.email).toLowerCase()));
    const existingRollNoSet = new Set(existingUsers.map(u => String(u.rollNo || "").toUpperCase()).filter(Boolean));

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    for (let i = 0; i < teachersList.length; i++) {
      const raw = teachersList[i] || {};
      const name = String(raw.name || "").trim();
      const email = String(raw.email || "").toLowerCase().trim();
      let rollNo = String(raw.rollNo || "").trim();
      const phone = String(raw.phone || "").trim();
      const qualification = String(raw.qualification || "").trim();
      const specialization = String(raw.specialization || "").trim();
      const address = String(raw.address || "").trim();
      const joiningDate = raw.joiningDate ? new Date(raw.joiningDate) : undefined;
      const isActive = raw.isActive !== undefined && raw.isActive !== null
        ? (raw.isActive === true || String(raw.isActive).toLowerCase() === "true" || String(raw.isActive) === "1")
        : true;

      const errors = [];
      if (!name) errors.push("Name is required");
      if (!email) errors.push("Email is required");
      else if (!emailRegex.test(email)) errors.push("Invalid email format");

      if (!rollNo) {
        rollNo = `TCH-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
      }

      if (email) {
        if (seenEmails.has(email)) {
          errors.push(`Email '${email}' is repeated multiple times in your file`);
        } else if (existingEmailSet.has(email)) {
          errors.push(`Email '${email}' is already registered in your institution`);
        }
      }

      if (rollNo) {
        const rollUpper = rollNo.toUpperCase();
        if (seenRollNos.has(rollUpper)) {
          errors.push(`ID/Roll Number '${rollNo}' is repeated multiple times in your file`);
        } else if (existingRollNoSet.has(rollUpper)) {
          errors.push(`ID/Roll Number '${rollNo}' is already assigned to another member`);
        }
      }

      if (errors.length > 0) {
        rowErrors.push({ index: i, error: errors.join("; ") });
      } else {
        seenEmails.add(email);
        seenRollNos.add(rollNo.toUpperCase());

        const tempPassword = generateTempPassword();
        validTeachers.push({
          teacherObj: {
            name,
            email,
            password: "", // populated in parallel batch below
            role: "teacher",
            rollNo,
            tenantId,
            isActive: isActive,
            createdByAdmin: true,
            isFirstLogin: true,
            tempPasswordSent: true,
            tempPasswordSentAt: Date.now(),
            phone: phone || undefined,
            qualification: qualification || undefined,
            specialization: specialization || undefined,
            address: address || undefined,
            joiningDate,
          },
          rawEmail: email,
          rawName: name,
          tempPassword,
        });
      }
    }

    if (rowErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Bulk teacher import failed: ${rowErrors.length} row(s) contain errors. Please review the highlighted issues below.`,
        errors: rowErrors,
      });
    }

    // High-speed parallel password hashing in chunks of 25 (25x faster for large datasets)
    const HASH_BATCH_SIZE = 25;
    for (let i = 0; i < validTeachers.length; i += HASH_BATCH_SIZE) {
      const batch = validTeachers.slice(i, i + HASH_BATCH_SIZE);
      await Promise.all(
        batch.map(async (v) => {
          v.teacherObj.password = await bcrypt.hash(v.tempPassword, 10);
        })
      );
    }

    const docsToInsert = validTeachers.map(v => v.teacherObj);
    const createdDocs = [];
    const INSERT_CHUNK = 1000;
    for (let i = 0; i < docsToInsert.length; i += INSERT_CHUNK) {
      const chunk = docsToInsert.slice(i, i + INSERT_CHUNK);
      const inserted = await User.insertMany(chunk, { ordered: false });
      createdDocs.push(...inserted);
    }

    await Tenant.findByIdAndUpdate(tenantId, {
      $inc: { "stats.totalTeachers": createdDocs.length },
    });

    // Non-blocking asynchronous background email dispatching
    setImmediate(async () => {
      logger.info(`Starting asynchronous background teacher email dispatch for ${validTeachers.length} teacher(s)...`);
      const BATCH_SIZE = 5;
      const DELAY_MS = 150;

      for (let i = 0; i < validTeachers.length; i += BATCH_SIZE) {
        const batch = validTeachers.slice(i, i + BATCH_SIZE);
        await Promise.allSettled(
          batch.map(v =>
            sendTeacherCredentialsEmail(
              v.rawEmail,
              v.rawName,
              v.tempPassword,
              tenant?.name,
              tenant?.subdomain
            ).catch(err => logger.error(`Background email send error for ${v.rawEmail}`, { error: err.message }))
          )
        );

        if (i + BATCH_SIZE < validTeachers.length) {
          await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
      }
      logger.info(`Completed background teacher email dispatch for ${validTeachers.length} teacher(s).`);
    });

    logActivity({
      tenantId,
      userId: req.user._id,
      description: `Bulk created ${createdDocs.length} teacher accounts`,
      endpoint: '/api/admin/bulk-teachers',
      statusCode: 201,
      ipAddress: req.ip,
    });

    return res.status(201).json({
      success: true,
      message: `${createdDocs.length} teacher account(s) created successfully. Welcome & activation emails are being sent in the background.`,
      emailsScheduled: true,
      count: createdDocs.length,
      data: createdDocs,
    });
  } catch (error) {
    logger.error("Error bulk creating teachers", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to bulk create teachers", error: error.message });
  }
};



/**
 * GET ALL LEADS (Super Admin only)
 */
const getAllLeads = async (req, res) => {
  try {
    if (req.user.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Super admin access required",
      });
    }

    const { page = 1, limit = 20, type, status, search } = req.query;
    const query = {};

    if (type && ["contact", "demo"].includes(type)) {
      query.type = type;
    }
    if (status && ["new", "contacted", "converted", "closed"].includes(status)) {
      query.status = status;
    }
    if (search) {
      const safeSearch = escapeRegExp(search);
      query.$or = [
        { name: { $regex: safeSearch, $options: "i" } },
        { email: { $regex: safeSearch, $options: "i" } },
        { institutionName: { $regex: safeSearch, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const leads = await Lead.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Lead.countDocuments(query);

    return res.status(200).json({
      success: true,
      message: "Leads retrieved successfully",
      data: leads,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    logger.error("Error fetching leads", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * UPDATE LEAD STATUS (Super Admin only)
 */
const updateLeadStatus = async (req, res) => {
  try {
    if (req.user.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Super admin access required",
      });
    }

    const { id } = req.params;
    const { status } = req.body;

    if (!status || !["new", "contacted", "converted", "closed"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Valid status is required (new, contacted, converted, closed)",
      });
    }

    const lead = await Lead.findByIdAndUpdate(id, { status }, { new: true });

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Lead status updated successfully",
      data: lead,
    });
  } catch (error) {
    logger.error("Error updating lead status", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * DELETE LEAD (Super Admin only)
 */
const deleteLead = async (req, res) => {
  try {
    if (req.user.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Super admin access required",
      });
    }

    const { id } = req.params;
    const lead = await Lead.findByIdAndDelete(id);

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Lead deleted successfully",
    });
  } catch (error) {
    logger.error("Error deleting lead", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * GET LEAD STATS (Super Admin only)
 */
const getLeadStats = async (req, res) => {
  try {
    if (req.user.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Super admin access required",
      });
    }

    const [total, byType, byStatus, recent] = await Promise.all([
      Lead.countDocuments(),
      Lead.aggregate([
        { $group: { _id: "$type", count: { $sum: 1 } } },
      ]),
      Lead.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Lead.find().sort({ createdAt: -1 }).limit(5),
    ]);

    return res.status(200).json({
      success: true,
      message: "Lead statistics retrieved successfully",
      data: {
        total,
        byType: byType.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        byStatus: byStatus.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        recent,
      },
    });
  } catch (error) {
    logger.error("Error fetching lead stats", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * GET ACTIVE SECTIONS
 * Returns distinct active student sections for the current tenant
 */
const getActiveSections = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || req.tenantId;
    const sections = await getActiveTenantSections(tenantId);
    return res.status(200).json({
      success: true,
      message: "Active sections retrieved successfully",
      count: sections.length,
      data: sections,
    });
  } catch (error) {
    logger.error("Error fetching active sections", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Failed to fetch active sections",
      error: error.message,
    });
  }
};

module.exports = {
  uploadEnrollments,
  createTeacher,
  createSubject,
  bulkCreateSubjects,
  bulkCreateTeachers,
  assignSubjectToTeacher,
  updateSubjectAssignment,
  getActiveSections,
  getAllTeachers,
  getAllSubjects,
  getAllEnrollments,
  getEnrollmentById,
  getEnrollmentsBySection,
  getMyEnrollment,
  getAllAssignments,
  deleteAssignment,
  getAssignmentsByTeacher,
  getAssignmentsBySubject,
  getAssignmentsBySection,

  // Super Admin functions
  getAllTenants,
  getTenantDetails,
  updateTenantSubscription,
  suspendTenant,
  activateTenant,
  deleteTenant,
  getPlatformStats,

  // Lead Management functions
  getAllLeads,
  updateLeadStatus,
  deleteLead,
  getLeadStats,
};
