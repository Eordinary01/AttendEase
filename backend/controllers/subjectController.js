const mongoose = require("mongoose");
const Subject = require("../models/Subject");
const Course = require("../models/Course");
const User = require("../models/User");
const Enrollment = require("../models/Enrollment");
const cache = require("../middleware/cache");
const logger = require("../utils/logger");
require("dotenv").config();

const calculateSubjectYear = (semesterStr, semestersPerYear = 2) => {
  if (!semesterStr) return null;
  const semNum = parseInt(String(semesterStr).replace(/\D/g, ""), 10);
  if (isNaN(semNum) || semNum <= 0) return null;
  const sPerYear = Number(semestersPerYear) === 1 ? 1 : 2;
  return sPerYear === 1 ? semNum : Math.ceil(semNum / 2);
};

const BRANCH_ALIASES = {
  "CSE": ["CSE", "CS", "COMPUTER SCIENCE", "COMPUTER SCIENCE & ENGINEERING", "COMPUTER SCIENCE AND ENGINEERING"],
  "CS": ["CSE", "CS", "COMPUTER SCIENCE", "COMPUTER SCIENCE & ENGINEERING", "COMPUTER SCIENCE AND ENGINEERING"],
  "COMPUTER SCIENCE": ["CSE", "CS", "COMPUTER SCIENCE", "COMPUTER SCIENCE & ENGINEERING", "COMPUTER SCIENCE AND ENGINEERING"],
  "COMPUTER SCIENCE & ENGINEERING": ["CSE", "CS", "COMPUTER SCIENCE", "COMPUTER SCIENCE & ENGINEERING", "COMPUTER SCIENCE AND ENGINEERING"],
  "COMPUTER SCIENCE AND ENGINEERING": ["CSE", "CS", "COMPUTER SCIENCE", "COMPUTER SCIENCE & ENGINEERING", "COMPUTER SCIENCE AND ENGINEERING"],
  "IT": ["IT", "INFORMATION TECHNOLOGY"],
  "INFORMATION TECHNOLOGY": ["IT", "INFORMATION TECHNOLOGY"],
  "ECE": ["ECE", "ELECTRONICS", "ELECTRONICS & COMMUNICATION", "ELECTRONICS & COMMUNICATION ENGINEERING", "ELECTRONICS AND COMMUNICATION ENGINEERING"],
  "ELECTRONICS": ["ECE", "ELECTRONICS", "ELECTRONICS & COMMUNICATION", "ELECTRONICS & COMMUNICATION ENGINEERING", "ELECTRONICS AND COMMUNICATION ENGINEERING"],
  "EEE": ["EEE", "ELECTRICAL", "ELECTRICAL & ELECTRONICS", "ELECTRICAL & ELECTRONICS ENGINEERING"],
  "ELECTRICAL": ["EEE", "ELECTRICAL", "ELECTRICAL & ELECTRONICS", "ELECTRICAL & ELECTRONICS ENGINEERING"],
  "ME": ["ME", "MECHANICAL", "MECHANICAL ENGINEERING"],
  "MECHANICAL": ["ME", "MECHANICAL", "MECHANICAL ENGINEERING"],
  "MECHANICAL ENGINEERING": ["ME", "MECHANICAL", "MECHANICAL ENGINEERING"],
  "CIVIL": ["CIVIL", "CIVIL ENGINEERING", "CE"],
  "CE": ["CIVIL", "CIVIL ENGINEERING", "CE"],
  "CIVIL ENGINEERING": ["CIVIL", "CIVIL ENGINEERING", "CE"],
  "CHEM": ["CHEM", "CHEMISTRY", "CHEMICAL", "CHEMICAL ENGINEERING"],
  "CHEMISTRY": ["CHEM", "CHEMISTRY", "CHEMICAL", "CHEMICAL ENGINEERING"],
  "CHEMICAL": ["CHEM", "CHEMISTRY", "CHEMICAL", "CHEMICAL ENGINEERING"],
  "CHEMICAL ENGINEERING": ["CHEM", "CHEMISTRY", "CHEMICAL", "CHEMICAL ENGINEERING"],
  "AIML": ["AIML", "AI & ML", "AI/ML", "ARTIFICIAL INTELLIGENCE & MACHINE LEARNING", "ARTIFICIAL INTELLIGENCE AND MACHINE LEARNING"],
  "AI & ML": ["AIML", "AI & ML", "AI/ML", "ARTIFICIAL INTELLIGENCE & MACHINE LEARNING", "ARTIFICIAL INTELLIGENCE AND MACHINE LEARNING"],
  "AI/ML": ["AIML", "AI & ML", "AI/ML", "ARTIFICIAL INTELLIGENCE & MACHINE LEARNING", "ARTIFICIAL INTELLIGENCE AND MACHINE LEARNING"],
  "AIDS": ["AIDS", "AI & DS", "AI/DS", "ARTIFICIAL INTELLIGENCE & DATA SCIENCE", "ARTIFICIAL INTELLIGENCE AND DATA SCIENCE"],
  "DS": ["DS", "DATA SCIENCE"],
  "DATA SCIENCE": ["DS", "DATA SCIENCE"],
};

const isBranchMatch = (subjBranch, studentBranch, branchCodeToName, branchNameToCode) => {
  if (!subjBranch) return true; // Generic/common subject for the course
  if (!studentBranch) return true; // Student branch not specified

  const sUpper = String(subjBranch).trim().toUpperCase();
  const uUpper = String(studentBranch).trim().toUpperCase();

  if (sUpper === uUpper) return true;

  const aliasesS = BRANCH_ALIASES[sUpper] || [sUpper];
  const aliasesU = BRANCH_ALIASES[uUpper] || [uUpper];

  if (aliasesS.includes(uUpper) || aliasesU.includes(sUpper) || aliasesS.some((a) => aliasesU.includes(a))) {
    return true;
  }

  if (branchCodeToName) {
    const sLower = sUpper.toLowerCase();
    const uLower = uUpper.toLowerCase();
    const mappedNameS = branchCodeToName.get(sLower);
    if (mappedNameS && (mappedNameS === uLower || (BRANCH_ALIASES[mappedNameS.toUpperCase()] || []).includes(uUpper))) return true;
    const mappedCodeS = branchNameToCode?.get(sLower);
    if (mappedCodeS && (mappedCodeS === uLower || (BRANCH_ALIASES[mappedCodeS.toUpperCase()] || []).includes(uUpper))) return true;
  }

  return false;
};

const isSemesterMatch = (subjSem, studentSem) => {
  if (!subjSem || !studentSem) return true;
  const sStr = String(subjSem).trim().toLowerCase();
  const uStr = String(studentSem).trim().toLowerCase();
  if (sStr === uStr) return true;

  const sNum = parseInt(sStr.replace(/\D/g, ""), 10);
  const uNum = parseInt(uStr.replace(/\D/g, ""), 10);
  if (!isNaN(sNum) && !isNaN(uNum) && sNum === uNum) return true;

  return false;
};

const isCourseMatch = (subjCourseId, studentCourseId, subjCourseCode, studentCourseCode) => {
  if (!studentCourseId && !studentCourseCode) return true;
  if (subjCourseId && studentCourseId) {
    if (String(subjCourseId) === String(studentCourseId)) return true;
  }
  if (studentCourseCode && (subjCourseCode || subjCourseId)) {
    const sCode = String(subjCourseCode || "").trim().toUpperCase();
    const uCode = String(studentCourseCode).trim().toUpperCase();
    if (sCode && sCode === uCode) return true;
  }
  if (subjCourseId || subjCourseCode) return false;
  return true;
};

/**
 * CREATE SUBJECT
 * Only admin can create subjects
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

  // Validation
  if (!subjectCode || !subjectName || !semester) {
    return res.status(400).json({
      message: "Subject code, name, and semester are required",
    });
  }

  try {
    // Authorization is enforced by the route middleware (subjects:write permission)

    // Sanitize inputs
    const sanitizedSubjectCode = subjectCode.toUpperCase().trim();
    const sanitizedSubjectName = subjectName.trim();
    const semesterNum = parseInt(semester, 10);
    const sanitizedSemester = Number.isFinite(semesterNum) && semesterNum >= 1 ? String(semesterNum) : String(semester).trim();
    const sanitizedCourseCode = courseCode ? courseCode.trim() : "";

    // Check if subject code already exists (case-insensitive)
    const existingSubjectByCode = await Subject.findOne({
      subjectCode: sanitizedSubjectCode,
      tenantId: req.user.tenantId,
    });

    if (existingSubjectByCode) {
      return res.status(400).json({
        message: "Subject code already exists",
        field: "subjectCode",
        existingValue: existingSubjectByCode.subjectCode,
      });
    }

    // Check if subject name already exists (case-insensitive)
    // Using regex for case-insensitive search
    const existingSubjectByName = await Subject.findOne({
      subjectName: { $regex: new RegExp(`^${sanitizedSubjectName}$`, "i") },
      tenantId: req.user.tenantId,
    });

    if (existingSubjectByName) {
      return res.status(400).json({
        message: "Subject name already exists",
        field: "subjectName",
        existingValue: existingSubjectByName.subjectName,
      });
    }

    // Optional: Check for duplicate in same semester/course if needed
    // This prevents same subject name in same semester/course combination
    const existingSubjectInSemester = await Subject.findOne({
      subjectName: { $regex: new RegExp(`^${sanitizedSubjectName}$`, "i") },
      semester: sanitizedSemester,
      ...(sanitizedCourseCode && { courseCode: sanitizedCourseCode }),
      tenantId: req.user.tenantId,
    });

    if (existingSubjectInSemester) {
      return res.status(400).json({
        message: `Subject with name "${sanitizedSubjectName}" already exists in semester ${sanitizedSemester}${sanitizedCourseCode ? ` for course ${sanitizedCourseCode}` : ""}`,
        field: "subjectName",
        existingValue: existingSubjectInSemester.subjectName,
      });
    }

    let resolvedCourse = null;
    if (courseId) {
      resolvedCourse = await Course.findOne({ _id: courseId, tenantId: req.user.tenantId, isActive: { $ne: false } });
      if (!resolvedCourse) {
        return res.status(400).json({ message: `Course ID "${courseId}" does not exist in your academic structure` });
      }
    } else if (sanitizedCourseCode) {
      const codeClean = sanitizedCourseCode.toUpperCase();
      resolvedCourse = await Course.findOne({
        tenantId: req.user.tenantId,
        isActive: { $ne: false },
        $or: [{ code: codeClean }, { name: { $regex: new RegExp(`^${codeClean}$`, "i") } }],
      });
      if (!resolvedCourse) {
        return res.status(400).json({ message: `Course "${sanitizedCourseCode}" does not exist in your academic structure. Please create the course first or check the code.` });
      }
    }

    // Create subject
    const calculatedYear = calculateSubjectYear(sanitizedSemester, resolvedCourse?.semestersPerYear || 2);

    // Resolve branch from course branches — normalize to canonical name if provided.
    // Do NOT auto-default to first active branch; leave empty so the user can assign.
    let finalBranch = branch ? branch.trim() : "";
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
      subjectCode: sanitizedSubjectCode,
      subjectName: sanitizedSubjectName,
      description: description ? description.trim() : "",
      credits: credits || 0,
      semester: sanitizedSemester,
      year: calculatedYear,
      courseCode: resolvedCourse ? resolvedCourse.code : sanitizedCourseCode,
      courseId: resolvedCourse ? resolvedCourse._id : (courseId || null),
      branch: finalBranch,
      createdBy: req.user._id,
      tenantId: req.user.tenantId,
      isActive: true,
    });

    await newSubject.save();
    await cache.delPattern(`subjects:${req.user.tenantId}:*`).catch(() => {});

    return res.status(201).json({
      message: "Subject created successfully",
      subject: {
        id: newSubject._id,
        subjectCode: newSubject.subjectCode,
        subjectName: newSubject.subjectName,
        semester: newSubject.semester,
        credits: newSubject.credits,
        description: newSubject.description,
        courseCode: newSubject.courseCode,
        createdBy: newSubject.createdBy,
        isActive: newSubject.isActive,
        createdAt: newSubject.createdAt,
        tenantId: newSubject.tenantId,
      },
    });
  } catch (error) {
    logger.error("Error creating subject", { error: error.message });

    // Handle duplicate key error from MongoDB (just in case)
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        message: `Duplicate value for ${field}`,
        error: error.message,
      });
    }

    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * GET ALL SUBJECTS - Role-based view
 * Admin: See all subjects with all details + assignment info
 * Teacher: See subjects assigned to them + all active subjects (filtered view)
 * Student: See subjects for their section only
 */
const getAllSubjects = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    let response = {};

    // ADMIN VIEW - See everything
    if (user.role === "admin") {
      const subjects = await Subject.find({
        tenantId: req.user.tenantId,
        isActive: true,
      })
        .populate("createdBy", "name email")
        .sort({ createdAt: -1 });

      // Normalize branch on read: resolve against course branches, clear stale values.
      const courses = await Course.find({ tenantId: req.user.tenantId, isActive: true }).lean();
      const courseMap = new Map(courses.map(c => [String(c._id), c]));
      for (const subject of subjects) {
        const matchedCourse = courseMap.get(String(subject.courseId));
        if (matchedCourse && Array.isArray(matchedCourse.branches) && matchedCourse.branches.length > 0) {
          const activeBranches = matchedCourse.branches.filter(b => b.isActive !== false);
          if (subject.branch) {
            const matched = activeBranches.find(b =>
              String(b.name || "").toLowerCase() === String(subject.branch).toLowerCase() ||
              String(b.code || "").toLowerCase() === String(subject.branch).toLowerCase()
            );
            if (matched) {
              if (subject.branch !== matched.code) {
                subject.branch = matched.code;
                await Subject.updateOne({ _id: subject._id }, { $set: { branch: matched.code } });
              }
            } else {
              subject.branch = "";
              await Subject.updateOne({ _id: subject._id }, { $set: { branch: "" } });
            }
          }
        }
      }

      // Get assignment information from User model
      const subjectsWithDetails = await Promise.all(
        subjects.map(async (subject) => {
          // Find all teachers who have this subject assigned
          const teachersWithSubject = await User.find({
            role: "teacher",
            "assignedSubjects.subjectId": subject._id,
            tenantId: req.user.tenantId,
          }).select("name email assignedSubjects.$");

          const assignments = teachersWithSubject.map((teacher) => {
            const assignment = teacher.assignedSubjects.find(
              (a) => a.subjectId.toString() === subject._id.toString(),
            );
            return {
              teacherId: teacher._id,
              teacherName: teacher.name,
              section: assignment ? assignment.section : null,
              assignedDate: assignment ? assignment.assignedDate : null,
            };
          });

          return {
            ...subject.toObject(),
            assignments: assignments,
            totalAssignments: assignments.length,
          };
        }),
      );

      response = {
        message: "All subjects retrieved successfully",
        count: subjectsWithDetails.length,
        subjects: subjectsWithDetails,
        stats: {
          totalSubjects: subjectsWithDetails.length,
          activeSubjects: subjectsWithDetails.filter((s) => s.isActive).length,
          subjectsWithAssignments: subjectsWithDetails.filter(
            (s) => s.totalAssignments > 0,
          ).length,
        },
      };
    }

    // TEACHER VIEW - See their assigned subjects + all active subjects
    else if (user.role === "teacher") {
      // Get teacher with populated assigned subjects
      const teacherWithAssignments = await User.findById(user._id).populate(
        "assignedSubjects.subjectId",
      );

      // Get detailed info for assigned subjects
      const assignedSubjectsDetails = await Promise.all(
        teacherWithAssignments.assignedSubjects.map(async (assignment) => {
          const subject = assignment.subjectId;

          // Get student count for this subject's course & section
          const countFilter = {
            section: new RegExp(`^${assignment.section.trim()}$`, "i"),
            isRegistered: true,
            tenantId: req.user.tenantId,
          };
          if (subject?.courseId) {
            countFilter.courseId = subject.courseId;
          }
          const studentsCount = await Enrollment.countDocuments(countFilter);

          return {
            assignmentId: assignment._id,
            subject: {
              id: subject?._id,
              subjectCode: subject.subjectCode,
              subjectName: subject.subjectName,
              semester: subject.semester,
              credits: subject.credits,
              description: subject.description,
              courseId: subject.courseId,
              courseCode: subject.courseCode || "",
              branch: subject.branch || "",
            },
            section: assignment.section,
            assignedDate: assignment.assignedDate,
            studentsCount,
          };
        }),
      );

      // Get all active subjects (for reference)
      const allActiveSubjects = await Subject.find({
        isActive: true,
        tenantId: req.user.tenantId,
      });

      // Group by section
      const bySection = assignedSubjectsDetails.reduce((acc, curr) => {
        if (!acc[curr.section]) {
          acc[curr.section] = [];
        }
        acc[curr.section].push(curr.subject);
        return acc;
      }, {});

      response = {
        message: "Subjects retrieved successfully",
        role: "teacher",
        teacherInfo: {
          id: user._id,
          name: user.name,
          email: user.email,
        },
        assignedSubjects: {
          count: assignedSubjectsDetails.length,
          subjects: assignedSubjectsDetails,
        },
        bySection,
        allActiveSubjects: allActiveSubjects.map((s) => ({
          id: s._id,
          subjectCode: s.subjectCode,
          subjectName: s.subjectName,
          semester: s.semester,
          courseId: s.courseId,
          courseCode: s.courseCode || "",
          branch: s.branch || "",
        })),
      };
    }

    // STUDENT & PARENT VIEW - See subjects strictly for their course, branch, semester & section
    else if (user.role === "student" || user.role === "parent" || req.user.accessMode === "parent") {
      // Find student's enrollment with fallback to email/rollNo
      const enrollment = await Enrollment.findOne({
        $or: [
          { userId: user._id },
          ...(user.email ? [{ email: user.email.toLowerCase().trim() }] : []),
          ...(user.rollNo ? [{ enrollmentNumber: user.rollNo.trim() }, { rollNo: user.rollNo.trim() }] : []),
        ],
        tenantId: req.user.tenantId,
      }).lean();

      // Determine student academic context (fallback gracefully to user profile)
      let studentCourseId = (user.courseId || enrollment?.courseId)?.toString() || null;
      let studentCourseCode = (user.courseCode || enrollment?.courseCode || user.courseName || enrollment?.courseName || "")?.toString().trim();
      const rawStudentBranch = user.branch || enrollment?.branch || "";
      const studentBranch = String(rawStudentBranch).trim();
      const studentSemester = String(user.semester || enrollment?.semester || "").trim();
      const studentSection = String(enrollment?.section || user.section || "").trim().toUpperCase();

      // If studentCourseId is missing but studentCourseCode is present, resolve from Course collection
      if (!studentCourseId && studentCourseCode) {
        const foundCourse = await Course.findOne({
          tenantId: req.user.tenantId,
          $or: [
            { code: studentCourseCode.toUpperCase() },
            { name: { $regex: new RegExp(`^${studentCourseCode}$`, "i") } },
          ],
        }).lean();
        if (foundCourse) {
          studentCourseId = foundCourse._id.toString();
          studentCourseCode = foundCourse.code;
        }
      }

      // Pre-fetch course details for branch code <-> name resolution
      const branchCodeToName = new Map();
      const branchNameToCode = new Map();
      if (studentCourseId && mongoose.Types.ObjectId.isValid(studentCourseId)) {
        const courseDoc = await Course.findById(studentCourseId).lean();
        if (courseDoc && Array.isArray(courseDoc.branches)) {
          courseDoc.branches.forEach((b) => {
            if (b.code && b.name) {
              branchCodeToName.set(String(b.code).trim().toLowerCase(), String(b.name).trim().toLowerCase());
              branchNameToCode.set(String(b.name).trim().toLowerCase(), String(b.code).trim().toLowerCase());
            }
          });
        }
      }

      // Step 1: Query active subjects for student's course
      let subjectQuery = {
        tenantId: req.user.tenantId,
        isActive: true,
      };

      if (studentCourseId) {
        if (mongoose.Types.ObjectId.isValid(studentCourseId)) {
          subjectQuery.$or = [
            { courseId: studentCourseId },
            { courseId: new mongoose.Types.ObjectId(studentCourseId) },
            ...(studentCourseCode ? [{ courseCode: new RegExp(`^${studentCourseCode}$`, "i") }] : []),
          ];
        } else {
          subjectQuery.courseId = studentCourseId;
        }
      }

      const allTenantSubjects = await Subject.find(subjectQuery).lean();

      // Step 2: Strictly filter subjects for student's course, branch & semester
      const studentCurriculumSubjects = allTenantSubjects.filter((s) => {
        // Course check
        const courseMatch = !studentCourseId || isCourseMatch(s.courseId, studentCourseId, s.courseCode, studentCourseCode);
        if (!courseMatch) return false;

        // Branch check
        const branchMatch = isBranchMatch(s.branch, studentBranch, branchCodeToName, branchNameToCode);
        if (!branchMatch) return false;

        // Semester check
        const semesterMatch = isSemesterMatch(s.semester, studentSemester);
        if (!semesterMatch) return false;

        return true;
      });

      // Step 3: Find teacher assignments ONLY for these valid student subjects in studentSection
      const validSubjectIds = new Set(studentCurriculumSubjects.map((s) => s._id.toString()));
      const teacherMap = new Map();

      if (studentSection && validSubjectIds.size > 0) {
        const sectionRegex = new RegExp(`^${studentSection}$`, "i");
        const teachersForSection = await User.find({
          role: "teacher",
          tenantId: req.user.tenantId,
          "assignedSubjects.section": sectionRegex,
          "assignedSubjects.subjectId": { $in: Array.from(validSubjectIds).map((id) => new mongoose.Types.ObjectId(id)) },
        }).lean();

        teachersForSection.forEach((teacher) => {
          (teacher.assignedSubjects || []).forEach((assignment) => {
            if (
              assignment.section &&
              assignment.section.trim().toUpperCase() === studentSection &&
              assignment.subjectId
            ) {
              const sId = assignment.subjectId.toString();
              if (validSubjectIds.has(sId)) {
                teacherMap.set(sId, {
                  teacher: {
                    id: teacher._id,
                    name: teacher.name,
                    email: teacher.email,
                  },
                  section: assignment.section,
                  assignedDate: assignment.assignedDate,
                });
              }
            }
          });
        });
      }

      // Step 4: Map final subjects with teacher info (ONLY from verified curriculum subjects)
      const subjectsWithTeachers = studentCurriculumSubjects.map((subject) => {
        const teacherInfo = teacherMap.get(subject._id.toString());
        return {
          id: subject._id,
          _id: subject._id,
          subjectCode: subject.subjectCode,
          subjectName: subject.subjectName,
          semester: subject.semester,
          credits: subject.credits,
          courseId: subject.courseId,
          courseCode: subject.courseCode,
          branch: subject.branch,
          subject: {
            id: subject._id,
            subjectCode: subject.subjectCode,
            subjectName: subject.subjectName,
            semester: subject.semester,
            credits: subject.credits,
            description: subject.description,
            courseId: subject.courseId,
            courseCode: subject.courseCode,
            branch: subject.branch,
          },
          teacher: teacherInfo ? teacherInfo.teacher : null,
          section: studentSection,
          assignedDate: teacherInfo ? teacherInfo.assignedDate : null,
        };
      });

      response = {
        message: "Your subjects retrieved successfully",
        role: "student",
        studentInfo: {
          id: user._id,
          name: user.name,
          email: user.email,
          enrollmentNumber: enrollment?.enrollmentNumber || user.rollNo,
          section: studentSection,
          courseId: user.courseId || enrollment?.courseId,
          courseName: user.courseName || enrollment?.courseName,
          branch: user.branch || enrollment?.branch,
          semester: user.semester || enrollment?.semester,
        },
        subjects: subjectsWithTeachers,
        count: subjectsWithTeachers.length,
      };
    }

    return res.status(200).json(response);
  } catch (error) {
    logger.error("Error fetching subjects", { error: error.message });
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * GET SUBJECT BY ID - Role-based access
 */
const getSubjectById = async (req, res) => {
  const { subjectId } = req.params;

  if (!subjectId) {
    return res.status(400).json({
      message: "Subject ID is required",
    });
  }

  try {
    const user = await User.findById(req.user._id);
    const subject = await Subject.findOne({
      _id: subjectId,
      tenantId: req.user.tenantId,
    }).populate("createdBy", "name email");

    if (!subject) {
      return res.status(404).json({
        message: "Subject not found",
      });
    }

    let response = {};

    // ADMIN - Can see everything
    if (user.role === "admin") {
      // Find all teachers assigned to this subject
      const teachersWithSubject = await User.find({
        role: "teacher",
        "assignedSubjects.subjectId": subject._id,
        tenantId: req.user.tenantId,
      }).select("name email assignedSubjects.$");

      const assignments = await Promise.all(
        teachersWithSubject.map(async (teacher) => {
          const assignment = teacher.assignedSubjects.find(
            (a) => a.subjectId.toString() === subject._id.toString(),
          );

          const countFilter = {
            section: new RegExp(`^${assignment.section.trim()}$`, "i"),
            tenantId: req.user.tenantId,
            isRegistered: true,
          };
          if (subject?.courseId) {
            countFilter.courseId = subject.courseId;
          }
          const studentsCount = await Enrollment.countDocuments(countFilter);

          return {
            teacher: {
              id: teacher._id,
              name: teacher.name,
              email: teacher.email,
            },
            section: assignment.section,
            assignedDate: assignment.assignedDate,
            studentsCount,
          };
        }),
      );

      response = {
        message: "Subject retrieved successfully",
        subject: {
          ...subject.toObject(),
          assignments,
        },
      };
    }

    // TEACHER - Can see if assigned or if subject is active
    else if (user.role === "teacher") {
      // Check if this subject is assigned to the teacher
      const teacher = await User.findById(user._id).populate(
        "assignedSubjects.subjectId",
      );

      const isAssigned = teacher.assignedSubjects.find(
        (assignment) => assignment.subjectId?._id.toString() === subjectId,
      );

      if (!isAssigned && !subject.isActive) {
        return res.status(403).json({
          message: "You do not have access to this subject",
        });
      }

      // If assigned, show with section details
      if (isAssigned) {
        const countFilter = {
          section: new RegExp(`^${isAssigned.section.trim()}$`, "i"),
          tenantId: req.user.tenantId,
          isRegistered: true,
        };
        if (subject?.courseId) {
          countFilter.courseId = subject.courseId;
        }
        const studentsInSection = await Enrollment.countDocuments(countFilter);

        response = {
          message: "Subject retrieved successfully",
          subject: {
            id: subject._id,
            subjectCode: subject.subjectCode,
            subjectName: subject.subjectName,
            semester: subject.semester,
            credits: subject.credits,
            description: subject.description,
          },
          yourAssignment: {
            section: isAssigned.section,
            assignedDate: isAssigned.assignedDate,
            studentsInSection,
          },
        };
      } else {
        // Just show subject info
        response = {
          message: "Subject retrieved successfully",
          subject: {
            id: subject._id,
            subjectCode: subject.subjectCode,
            subjectName: subject.subjectName,
            semester: subject.semester,
            credits: subject.credits,
            description: subject.description,
          },
        };
      }
    }

    // STUDENT - Can see only if matching course, branch, and in their section
    else if (user.role === "student" || user.role === "parent" || req.user.accessMode === "parent") {
      const enrollment = await Enrollment.findOne({
        $or: [
          { userId: user._id },
          ...(user.email ? [{ email: user.email.toLowerCase().trim() }] : []),
          ...(user.rollNo ? [{ enrollmentNumber: user.rollNo.trim() }, { rollNo: user.rollNo.trim() }] : []),
        ],
        tenantId: req.user.tenantId,
      }).lean();

      let studentCourseId = (user.courseId || enrollment?.courseId)?.toString() || null;
      let studentCourseCode = (user.courseCode || enrollment?.courseCode || user.courseName || enrollment?.courseName || "")?.toString().trim();
      const studentBranch = String(user.branch || enrollment?.branch || "").trim();
      const studentSection = String(enrollment?.section || user.section || "").trim().toUpperCase();

      if (studentCourseId && !isCourseMatch(subject.courseId, studentCourseId, subject.courseCode, studentCourseCode)) {
        return res.status(403).json({
          message: "This subject is not part of your enrolled course",
        });
      }

      if (subject.branch && !isBranchMatch(subject.branch, studentBranch)) {
        return res.status(403).json({
          message: "This subject is not part of your enrolled branch / specialization",
        });
      }

      // Find teacher teaching this subject in student's section
      const teacher = await User.findOne({
        role: "teacher",
        "assignedSubjects.subjectId": subject._id,
        "assignedSubjects.section": new RegExp(`^${studentSection}$`, "i"),
        tenantId: req.user.tenantId,
      }).select("name email assignedSubjects.$");

      const assignment = teacher?.assignedSubjects?.find(
        (a) =>
          a.subjectId.toString() === subject._id.toString() &&
          String(a.section).trim().toUpperCase() === studentSection,
      );

      response = {
        message: "Subject retrieved successfully",
        subject: {
          id: subject._id,
          subjectCode: subject.subjectCode,
          subjectName: subject.subjectName,
          semester: subject.semester,
          credits: subject.credits,
          description: subject.description,
          courseId: subject.courseId,
          courseCode: subject.courseCode,
          branch: subject.branch,
        },
        teacher: teacher ? {
          id: teacher._id,
          name: teacher.name,
          email: teacher.email,
        } : null,
        section: studentSection,
        assignedDate: assignment ? assignment.assignedDate : null,
      };
    }

    return res.status(200).json(response);
  } catch (error) {
    logger.error("Error fetching subject", { error: error.message });
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * GET SUBJECTS BY SEMESTER - Role-based
 */
const getSubjectsBySemester = async (req, res) => {
  const { semester } = req.params;

  if (!semester) {
    return res.status(400).json({
      message: "Semester is required",
    });
  }

  try {
    const user = await User.findById(req.user._id);

    let response = {};

    // ADMIN - All subjects in semester
    if (user.role === "admin") {
      const subjects = await Subject.find({
        semester: semester.trim(),
        tenantId: req.user.tenantId,
      })
        .populate("createdBy", "name email")
        .sort({ subjectCode: 1 });

      response = {
        message: `Subjects for semester ${semester} retrieved successfully`,
        count: subjects.length,
        semester,
        subjects,
      };
    }

    // TEACHER - Active subjects + their assignments in this semester
    else if (user.role === "teacher") {
      // Get all active subjects in this semester
      const subjects = await Subject.find({
        semester: semester.trim(),
        isActive: true,
        tenantId: req.user.tenantId,
      }).sort({ subjectCode: 1 });

      // Get teacher's assignments
      const teacher = await User.findById(user._id).populate(
        "assignedSubjects.subjectId",
      );

      const subjectsWithStatus = subjects.map((subject) => {
        const assignment = teacher.assignedSubjects.find(
          (a) => a.subjectId?._id.toString() === subject._id.toString(),
        );

        return {
          ...subject.toObject(),
          isAssignedToYou: !!assignment,
          yourSection: assignment ? assignment.section : null,
          assignedDate: assignment ? assignment.assignedDate : null,
        };
      });

      response = {
        message: `Subjects for semester ${semester} retrieved successfully`,
        count: subjectsWithStatus.length,
        semester,
        subjects: subjectsWithStatus,
      };
    }

    // STUDENT - Only subjects in their section for this semester, scoped by course & branch
    else if (user.role === "student" || user.role === "parent" || req.user.accessMode === "parent") {
      const enrollment = await Enrollment.findOne({
        $or: [
          { userId: user._id },
          ...(user.email ? [{ email: user.email.toLowerCase().trim() }] : []),
          ...(user.rollNo ? [{ enrollmentNumber: user.rollNo.trim() }, { rollNo: user.rollNo.trim() }] : []),
        ],
        tenantId: req.user.tenantId,
      }).lean();

      let studentCourseId = (user.courseId || enrollment?.courseId)?.toString() || null;
      let studentCourseCode = (user.courseCode || enrollment?.courseCode || user.courseName || enrollment?.courseName || "")?.toString().trim();
      const studentBranch = String(user.branch || enrollment?.branch || "").trim();
      const studentSection = String(enrollment?.section || user.section || "").trim().toUpperCase();

      // Find active subjects for student's course in this semester
      const subjectQuery = {
        semester: String(semester).trim(),
        tenantId: req.user.tenantId,
        isActive: true,
      };
      if (studentCourseId) {
        if (mongoose.Types.ObjectId.isValid(studentCourseId)) {
          subjectQuery.$or = [
            { courseId: studentCourseId },
            { courseId: new mongoose.Types.ObjectId(studentCourseId) },
            ...(studentCourseCode ? [{ courseCode: new RegExp(`^${studentCourseCode}$`, "i") }] : []),
          ];
        } else {
          subjectQuery.courseId = studentCourseId;
        }
      }

      const rawSubjects = await Subject.find(subjectQuery).lean();

      const matchedSubjects = rawSubjects.filter((s) => {
        const courseMatch = !studentCourseId || isCourseMatch(s.courseId, studentCourseId, s.courseCode, studentCourseCode);
        if (!courseMatch) return false;
        return isBranchMatch(s.branch, studentBranch);
      });

      const validSubjectIds = new Set(matchedSubjects.map((s) => s._id.toString()));
      const teacherMap = new Map();

      if (studentSection && validSubjectIds.size > 0) {
        const sectionRegex = new RegExp(`^${studentSection}$`, "i");
        const teachers = await User.find({
          role: "teacher",
          tenantId: req.user.tenantId,
          "assignedSubjects.section": sectionRegex,
          "assignedSubjects.subjectId": { $in: Array.from(validSubjectIds).map((id) => new mongoose.Types.ObjectId(id)) },
        }).lean();

        teachers.forEach((t) => {
          (t.assignedSubjects || []).forEach((a) => {
            if (a.section && String(a.section).trim().toUpperCase() === studentSection && a.subjectId) {
              const sId = a.subjectId.toString();
              if (validSubjectIds.has(sId)) {
                teacherMap.set(sId, {
                  id: t._id,
                  name: t.name,
                  email: t.email,
                  assignedDate: a.assignedDate,
                });
              }
            }
          });
        });
      }

      const subjectsInSemester = matchedSubjects.map((subject) => {
        const teacher = teacherMap.get(subject._id.toString());
        return {
          subject: {
            id: subject._id,
            subjectCode: subject.subjectCode,
            subjectName: subject.subjectName,
            semester: subject.semester,
            credits: subject.credits,
            description: subject.description,
            courseId: subject.courseId,
            courseCode: subject.courseCode,
            branch: subject.branch,
          },
          teacher: teacher || null,
          section: studentSection,
          assignedDate: teacher?.assignedDate || null,
        };
      });

      response = {
        message: `Your subjects for semester ${semester} retrieved successfully`,
        count: subjectsInSemester.length,
        semester,
        section: studentSection,
        subjects: subjectsInSemester,
      };
    }

    return res.status(200).json(response);
  } catch (error) {
    logger.error("Error fetching subjects by semester", { error: error.message });
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * GET TEACHER'S SUBJECTS WITH FILTERS
 */
const getTeacherSubjects = async (req, res) => {
  const { teacherId } = req.params;
  const { section, semester } = req.query;

  if (!teacherId) {
    return res.status(400).json({
      message: "Teacher ID is required",
    });
  }

  try {
    const requesterRole = req.user?.role;
    const requesterId = String(req.user?._id || "");
    const tenantId = req.user?.tenantId || req.tenantId;

    // Check permissions
    if (requesterRole !== "admin" && requesterRole !== "super_admin" && requesterId !== String(teacherId)) {
      return res.status(403).json({
        message: "You do not have permission to view this information",
      });
    }

    const teacher = await User.findOne({
      _id: teacherId,
      tenantId: tenantId,
    }).populate("assignedSubjects.subjectId");

    if (!teacher) {
      return res.status(200).json({
        success: true,
        message: "Teacher not found",
        subjects: [],
        data: [],
      });
    }

    // Filter assignments
    let assignments = teacher.assignedSubjects;

    if (section) {
      assignments = assignments.filter((a) => a.section === section);
    }

    // Process assignments
    const subjectsWithDetails = await Promise.all(
      assignments.map(async (assignment) => {
        const subject = assignment.subjectId;

        if (!subject) return null;

        const countFilter = {
          section: new RegExp(`^${assignment.section.trim()}$`, "i"),
          tenantId: req.user.tenantId,
        };
        if (subject?.courseId) {
          countFilter.courseId = subject.courseId;
        }
        const studentsInSection = await Enrollment.countDocuments(countFilter);

        const registeredStudents = await Enrollment.countDocuments({
          ...countFilter,
          isRegistered: true,
        });

        return {
          assignmentId: assignment._id,
          subject: {
            id: subject._id,
            _id: subject._id,
            subjectCode: subject.subjectCode,
            subjectName: subject.subjectName,
            semester: subject.semester,
            credits: subject.credits,
            description: subject.description,
            isActive: subject.isActive,
            courseId: subject.courseId,
            courseCode: subject.courseCode,
            branch: subject.branch,
          },
          subjectId: subject._id,
          subjectCode: subject.subjectCode,
          subjectName: subject.subjectName,
          semester: subject.semester,
          courseId: subject.courseId,
          courseCode: subject.courseCode,
          branch: subject.branch,
          section: assignment.section,
          assignedDate: assignment.assignedDate,
          stats: {
            totalStudents: studentsInSection,
            registeredStudents,
            pendingRegistration: studentsInSection - registeredStudents,
          },
        };
      }),
    );

    // Remove null values
    const validSubjects = subjectsWithDetails.filter((s) => s !== null);

    // Filter by semester if provided
    let filteredSubjects = validSubjects;
    if (semester) {
      filteredSubjects = validSubjects.filter(
        (s) => s.subject.semester === semester,
      );
    }

    // Group by section
    const bySection = filteredSubjects.reduce((acc, curr) => {
      if (!acc[curr.section]) {
        acc[curr.section] = [];
      }
      acc[curr.section].push(curr);
      return acc;
    }, {});

    // Get unique sections and semesters
    const availableSections = [
      ...new Set(teacher.assignedSubjects.map((a) => a.section)),
    ];
    const availableSemesters = [
      ...new Set(
        teacher.assignedSubjects
          .map((a) => a.subjectId?.semester)
          .filter(Boolean),
      ),
    ];

    return res.status(200).json({
      message: "Teacher subjects retrieved successfully",
      teacher: {
        id: teacher._id,
        name: teacher.name,
        email: teacher.email,
      },
      filters: {
        applied: {
          section: section || "all",
          semester: semester || "all",
        },
        availableSections,
        availableSemesters,
      },
      stats: {
        totalAssignments: filteredSubjects.length,
        totalSections: Object.keys(bySection).length,
        totalStudents: filteredSubjects.reduce(
          (sum, s) => sum + s.stats.totalStudents,
          0,
        ),
      },
      subjects: filteredSubjects,
      groupedBySection: bySection,
    });
  } catch (error) {
    logger.error("Error fetching teacher subjects", { error: error.message });
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * SEARCH SUBJECTS - Role-based search
 */
const searchSubjects = async (req, res) => {
  const { query } = req.query;

  if (!query || query.trim() === "") {
    return res.status(400).json({
      message: "Search query is required",
    });
  }

  try {
    const user = await User.findById(req.user._id);

    const searchRegex = new RegExp(query, "i");
    const searchQuery = {
      $or: [
        { subjectCode: searchRegex },
        { subjectName: searchRegex },
        { description: searchRegex },
      ],
      tenantId: req.user.tenantId,
    };

    let response = {};

    // ADMIN - Search all subjects
    if (user.role === "admin") {
      const subjects = await Subject.find(searchQuery)
        .populate("createdBy", "name email")
        .limit(20);

      response = {
        message: `Found ${subjects.length} subject(s) matching "${query}"`,
        query,
        count: subjects.length,
        subjects,
      };
    }

    // TEACHER - Search active subjects + show if assigned
    else if (user.role === "teacher") {
      searchQuery.isActive = true;
      const subjects = await Subject.find(searchQuery).limit(20);

      const teacher = await User.findById(user._id).populate(
        "assignedSubjects.subjectId",
      );

      const subjectsWithStatus = subjects.map((subject) => {
        const assignment = teacher.assignedSubjects.find(
          (a) => a.subjectId?._id.toString() === subject._id.toString(),
        );

        return {
          ...subject.toObject(),
          isAssignedToYou: !!assignment,
          yourSection: assignment ? assignment.section : null,
          assignedDate: assignment ? assignment.assignedDate : null,
        };
      });

      response = {
        message: `Found ${subjectsWithStatus.length} subject(s) matching "${query}"`,
        query,
        count: subjectsWithStatus.length,
        subjects: subjectsWithStatus,
      };
    }

    // STUDENT - Search only subjects in their course, branch, and section
    else if (user.role === "student" || user.role === "parent" || req.user.accessMode === "parent") {
      const enrollment = await Enrollment.findOne({
        $or: [
          { userId: user._id },
          ...(user.email ? [{ email: user.email.toLowerCase().trim() }] : []),
          ...(user.rollNo ? [{ enrollmentNumber: user.rollNo.trim() }, { rollNo: user.rollNo.trim() }] : []),
        ],
        tenantId: req.user.tenantId,
      }).lean();

      let studentCourseId = (user.courseId || enrollment?.courseId)?.toString() || null;
      let studentCourseCode = (user.courseCode || enrollment?.courseCode || user.courseName || enrollment?.courseName || "")?.toString().trim();
      const studentBranch = String(user.branch || enrollment?.branch || "").trim();
      const studentSection = String(enrollment?.section || user.section || "").trim().toUpperCase();

      // Find all matching active subjects for the student's course & branch
      const searchSubjQuery = {
        tenantId: req.user.tenantId,
        isActive: true,
        $or: [{ subjectCode: searchRegex }, { subjectName: searchRegex }],
      };
      if (studentCourseId) {
        if (mongoose.Types.ObjectId.isValid(studentCourseId)) {
          searchSubjQuery.$and = [
            {
              $or: [
                { courseId: studentCourseId },
                { courseId: new mongoose.Types.ObjectId(studentCourseId) },
                ...(studentCourseCode ? [{ courseCode: new RegExp(`^${studentCourseCode}$`, "i") }] : []),
              ],
            },
          ];
        } else {
          searchSubjQuery.courseId = studentCourseId;
        }
      }

      const rawSubjects = await Subject.find(searchSubjQuery).lean();

      const matchedSubjects = rawSubjects.filter((s) => {
        const courseMatch = !studentCourseId || isCourseMatch(s.courseId, studentCourseId, s.courseCode, studentCourseCode);
        if (!courseMatch) return false;
        return isBranchMatch(s.branch, studentBranch);
      });

      const validSubjectIds = new Set(matchedSubjects.map((s) => s._id.toString()));
      const teacherMap = new Map();

      if (studentSection && validSubjectIds.size > 0) {
        const sectionRegex = new RegExp(`^${studentSection}$`, "i");
        const teachers = await User.find({
          role: "teacher",
          tenantId: req.user.tenantId,
          "assignedSubjects.section": sectionRegex,
          "assignedSubjects.subjectId": { $in: Array.from(validSubjectIds).map((id) => new mongoose.Types.ObjectId(id)) },
        }).lean();

        teachers.forEach((t) => {
          (t.assignedSubjects || []).forEach((a) => {
            if (a.section && String(a.section).trim().toUpperCase() === studentSection && a.subjectId) {
              const sId = a.subjectId.toString();
              if (validSubjectIds.has(sId)) {
                teacherMap.set(sId, {
                  id: t._id,
                  name: t.name,
                  email: t.email,
                  assignedDate: a.assignedDate,
                });
              }
            }
          });
        });
      }

      const matchingSubjects = matchedSubjects.map((subject) => {
        const teacher = teacherMap.get(subject._id.toString());
        return {
          subject: {
            id: subject._id,
            subjectCode: subject.subjectCode,
            subjectName: subject.subjectName,
            semester: subject.semester,
            credits: subject.credits,
            courseId: subject.courseId,
            courseCode: subject.courseCode,
            branch: subject.branch,
          },
          teacher: teacher || null,
          section: studentSection,
          assignedDate: teacher?.assignedDate || null,
        };
      });

      response = {
        message: `Found ${matchingSubjects.length} subject(s) in your course and branch matching "${query}"`,
        query,
        count: matchingSubjects.length,
        subjects: matchingSubjects,
      };
    }

    return res.status(200).json(response);
  } catch (error) {
    logger.error("Error searching subjects", { error: error.message });
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * UPDATE SUBJECT
 * Admin or teacher with subjects:write (enforced by route middleware)
 */
const updateSubject = async (req, res) => {
  try {
    const { subjectId } = req.params;
    const { subjectCode, subjectName, description, credits, semester, courseCode, courseId, branch } = req.body;

    const subject = await Subject.findOne({ _id: subjectId, tenantId: req.user.tenantId });
    if (!subject) {
      return res.status(404).json({ message: "Subject not found" });
    }

    const sanitizedCode = subjectCode ? subjectCode.toUpperCase().trim() : subject.subjectCode;
    const sanitizedName = subjectName ? subjectName.trim() : subject.subjectName;

    if (subjectCode && subjectCode.toUpperCase().trim() !== subject.subjectCode) {
      const dup = await Subject.findOne({ subjectCode: sanitizedCode, tenantId: req.user.tenantId, _id: { $ne: subject._id } });
      if (dup) return res.status(400).json({ message: "Subject code already exists", field: "subjectCode" });
    }

    if (subjectName && subjectName.trim().toLowerCase() !== subject.subjectName.toLowerCase()) {
      const dup = await Subject.findOne({ subjectName: { $regex: new RegExp(`^${sanitizedName}$`, "i") }, tenantId: req.user.tenantId, _id: { $ne: subject._id } });
      if (dup) return res.status(400).json({ message: "Subject name already exists", field: "subjectName" });
    }

    subject.subjectCode = sanitizedCode;
    subject.subjectName = sanitizedName;
    if (description !== undefined) subject.description = description.trim();
    if (credits !== undefined) subject.credits = credits;
    if (semester !== undefined) {
      const semesterNum = parseInt(semester, 10);
      subject.semester = Number.isFinite(semesterNum) && semesterNum >= 1 ? String(semesterNum) : String(semester).trim();
    }
    if (courseCode !== undefined) subject.courseCode = courseCode.trim();
    if (courseId !== undefined) subject.courseId = courseId || null;
    if (branch !== undefined) subject.branch = branch.trim();

    await subject.save();
    await cache.delPattern(`subjects:${req.user.tenantId}:*`).catch(() => {});

    return res.status(200).json({ message: "Subject updated successfully", subject });
  } catch (error) {
    logger.error("Error updating subject", { error: error.message });
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

/**
 * DEACTIVATE SUBJECT
 * Soft-delete: marks subject inactive
 */
const deactivateSubject = async (req, res) => {
  try {
    const subject = await Subject.findOne({ _id: req.params.subjectId, tenantId: req.user.tenantId });
    if (!subject) return res.status(404).json({ message: "Subject not found" });

    subject.isActive = false;
    await subject.save();
    await cache.delPattern(`subjects:${req.user.tenantId}:*`).catch(() => {});

    return res.status(200).json({ message: "Subject deactivated successfully", subject });
  } catch (error) {
    logger.error("Error deactivating subject", { error: error.message });
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

/**
 * DELETE SUBJECT
 * Hard-delete: removes subject and its teacher assignments
 */
const deleteSubject = async (req, res) => {
  try {
    const subject = await Subject.findOne({ _id: req.params.subjectId, tenantId: req.user.tenantId });
    if (!subject) return res.status(404).json({ message: "Subject not found" });

    await User.updateMany(
      { tenantId: req.user.tenantId, "assignedSubjects.subjectId": subject._id },
      { $pull: { assignedSubjects: { subjectId: subject._id } } }
    );

    await subject.deleteOne();
    await cache.delPattern(`subjects:${req.user.tenantId}:*`).catch(() => {});

    return res.status(200).json({ message: "Subject deleted successfully" });
  } catch (error) {
    logger.error("Error deleting subject", { error: error.message });
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

// Export all functions
module.exports = {
  createSubject,
  getAllSubjects,
  getSubjectById,
  getSubjectsBySemester,
  getTeacherSubjects,
  searchSubjects,
  updateSubject,
  deactivateSubject,
  deleteSubject,
};
