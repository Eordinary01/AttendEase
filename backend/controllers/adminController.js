const User = require("../models/User");
const Enrollment = require("../models/Enrollment");
const Subject = require("../models/Subject");
const bcrypt = require("bcryptjs");
const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");
require("dotenv").config();

/**
 * UPLOAD STUDENT ENROLLMENTS VIA CSV
 * CSV format: enrollmentNumber, email, firstName, lastName, section
 */
const uploadEnrollments = async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        message: "Only admins can upload enrollments",
      });
    }

    // Check if file is provided
    if (!req.file) {
      return res.status(400).json({
        message: "No file uploaded",
      });
    }

    // Check file type
    const fileExt = req.file.originalname.toLowerCase().split(".").pop();
    if (fileExt !== "csv") {
      // Delete the uploaded file
      if (req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        message: "Only CSV files are allowed",
      });
    }

    const filePath = req.file.path;
    const results = [];
    let errorCount = 0;
    const errors = [];

    // Parse CSV file
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => {
        console.log("DEBUG - Parsed row:", data);
        console.log(
          "DEBUG - enrollmentNumber exists?",
          !!data.enrollmentNumber,
        );
        console.log("DEBUG - All keys:", Object.keys(data));

        // Validate required fields
        const requiredFields = [
          "enrollmentNumber",
          "email",
          "firstName",
          "lastName",
          "section",
        ];
        const missingFields = requiredFields.filter((field) => !data[field]);

        if (missingFields.length > 0) {
          errorCount++;
          errors.push(
            `Row missing required fields (${missingFields.join(", ")}): ${JSON.stringify(data)}`,
          );
          return;
        }

        results.push({
          enrollmentNumber: data.enrollmentNumber.toUpperCase().trim(),
          email: data.email.toLowerCase().trim(),
          firstName: data.firstName.trim(),
          lastName: data.lastName.trim(),
          section: data.section.trim().toUpperCase(),
          uploadedBy: req.user.userId, // Use req.user.userId directly
        });
      })
      .on("end", async () => {
        try {
          // Insert all enrollments
          const insertedEnrollments = await Enrollment.insertMany(results, {
            ordered: false,
          });
          const successCount = insertedEnrollments.length;

          // Delete uploaded file
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }

          return res.status(200).json({
            message: "Enrollments uploaded successfully",
            successCount,
            errorCount,
            errors: errors.length > 0 ? errors : undefined,
            totalProcessed: results.length + errorCount,
          });
        } catch (error) {
          // Handle duplicate key errors
          if (error.code === 11000) {
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
            const duplicateField = Object.keys(error.keyPattern)[0];
            return res.status(400).json({
              message: `Duplicate ${duplicateField} found in CSV`,
              error: error.message,
            });
          }

          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          return res.status(500).json({
            message: "Error saving enrollments",
            error: error.message,
          });
        }
      })
      .on("error", (error) => {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        return res.status(400).json({
          message: "Error parsing CSV file",
          error: error.message,
        });
      });
  } catch (error) {
    console.error("Error in uploadEnrollments:", error);
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * CREATE TEACHER ACCOUNT
 * Only admin can create teachers
 * Sends temporary password via email
 */
const createTeacher = async (req, res) => {
  const { name, email, rollNo } = req.body;

  // Validation
  if (!name || !email || !rollNo) {
    return res.status(400).json({
      message: "Name, email, and roll number are required",
    });
  }

  const emailLower = email.toLowerCase().trim();

  try {
    // Check if user is admin
    // const admin = await User.findById(req.user.userId);
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        message: "Only admins can create teacher accounts",
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email: emailLower });
    if (existingUser) {
      return res.status(400).json({
        message: "Email already in use",
      });
    }

    // Generate temporary password
    const tempPassword = generateTempPassword();
    const hashedTempPassword = await bcrypt.hash(tempPassword, 10);

    // Create teacher account
    const newTeacher = new User({
      name: name.trim(),
      email: emailLower,
      password: hashedTempPassword,
      // section: section.trim(),
      role: "teacher",
      rollNo: rollNo.trim(),
      createdByAdmin: true,
      isFirstLogin: true,
      tempPasswordSent: true,
      tempPasswordSentAt: Date.now(),
    });

    await newTeacher.save();

    // Send email with temporary password
    await sendTeacherCredentialsEmail(email, name, tempPassword);

    return res.status(201).json({
      message:
        "Teacher account created successfully. Credentials sent to email.",
      teacher: {
        id: newTeacher._id,
        name: newTeacher.name,
        email: newTeacher.email,
        // section: newTeacher.section,
        role: newTeacher.role,
      },
    });
  } catch (error) {
    console.error("Error creating teacher:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
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
  } = req.body;

  if (!subjectCode || !subjectName || !semester) {
    return res.status(400).json({
      message: "Subject code, name, and semester are required",
    });
  }

  try {
    if (req.user?.role !== "admin") {
      return res.status(403).json({
        message: "Only admins can create subjects",
      });
    }

    const existingSubject = await Subject.findOne({
      subjectCode: subjectCode.toUpperCase(),
    });

    if (existingSubject) {
      return res.status(400).json({
        message: "Subject code already exists",
      });
    }

    const newSubject = new Subject({
      subjectCode: subjectCode.toUpperCase().trim(),
      subjectName: subjectName.trim(),
      description: description?.trim() || "",
      credits: credits || 0,
      semester: semester.trim(),
      courseCode: courseCode?.trim() || "",
      createdBy: req.userId,
    });

    await newSubject.save();

    return res.status(201).json({
      message: "Subject created successfully",
      subject: newSubject,
    });
  } catch (error) {
    console.error("Error creating subject:", error);

    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * ASSIGN SUBJECT + SECTION TO TEACHER
 * Now allows same subject to be assigned to multiple sections
 */
const assignSubjectToTeacher = async (req, res) => {
  let { teacherId, subjectId, sections } = req.body;

  // Handle if sections is a string
  if (typeof sections === 'string') {
    sections = sections.split(',').map(s => s.trim());
  }

  if (
    !teacherId ||
    !subjectId ||
    !sections ||
    !Array.isArray(sections) ||
    sections.length === 0
  ) {
    return res.status(400).json({
      message: "Teacher ID, subject ID, and at least one section are required",
    });
  }

  try {
    // Check if user is admin
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        message: "Only admins can assign subjects to teachers",
      });
    }

    // Find teacher
    const teacher = await User.findById(teacherId);
    if (!teacher || teacher.role !== "teacher") {
      return res.status(404).json({
        message: "Teacher not found",
      });
    }

    // Find subject
    const subject = await Subject.findById(subjectId);
    if (!subject) {
      return res.status(404).json({
        message: "Subject not found",
      });
    }

    const results = {
      assigned: [],
      alreadyAssigned: [],
      studentsUpdated: 0
    };

    // Process EACH SECTION INDIVIDUALLY
    for (const section of sections) {
      const trimmedSection = section.trim();

      // Check if this specific section is already assigned
      const existingAssignment = teacher.assignedSubjects.find(
        (assigned) => 
          assigned.subjectId.toString() === subjectId && 
          assigned.section === trimmedSection  // Compare individual section
      );

      if (existingAssignment) {
        results.alreadyAssigned.push(trimmedSection);
        continue;
      }

      // Add SEPARATE entry for EACH section
      teacher.assignedSubjects.push({
        subjectId: subject._id,
        subjectName: subject.subjectName,
        section: trimmedSection,  // Store SINGLE section, not comma-separated
        assignedDate: Date.now(),
      });

      results.assigned.push(trimmedSection);
    }

    // Save teacher if there are new assignments
    if (results.assigned.length > 0) {
      await teacher.save();
      console.log(`✅ Teacher updated with ${results.assigned.length} new section assignments`);

      // Update enrollments for each section
      for (const section of results.assigned) {
        try {
          // Check if section has enrollments
          const enrollmentsInSection = await Enrollment.find({ section: section });
          console.log(`Found ${enrollmentsInSection.length} enrollments in section ${section}`);

          if (enrollmentsInSection.length > 0) {
            const updateResult = await Enrollment.updateMany(
              { section: section },
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

            console.log(`✅ Updated ${updateResult.modifiedCount} enrollments for section ${section}`);
            results.studentsUpdated += updateResult.modifiedCount;
          } else {
            console.log(`⚠️ No enrollments found for section ${section}`);
          }
        } catch (error) {
          console.error(`❌ Error updating section ${section}:`, error);
        }
      }
    }

    return res.status(200).json({
      message: "Subject assignment processed",
      data: {
        teacher: teacher.name,
        subject: subject.subjectName,
        sectionsAssigned: results.assigned,
        sectionsAlreadyAssigned: results.alreadyAssigned,
        studentsUpdated: results.studentsUpdated,
        totalSectionsProcessed: sections.length
      }
    });

  } catch (error) {
    console.error("Error assigning subject:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * GET ALL TEACHERS
 * Show teachers with their subject assignments grouped by section
 */
const getAllTeachers = async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        message: "Only admins can view teachers",
      });
    }

    const teachers = await User.find({ role: "teacher" })
      .select("-password")
      .populate("assignedSubjects.subjectId");

    // Transform data to show assignments grouped by section
    const transformedTeachers = teachers.map((teacher) => {
      const teacherObj = teacher.toObject();

      // Group assignments by section
      const assignmentsBySection = teacherObj.assignedSubjects.reduce(
        (acc, assignment) => {
          const section = assignment.section;
          if (!acc[section]) {
            acc[section] = [];
          }
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
      message: "Teachers retrieved successfully",
      data: transformedTeachers,
    });
  } catch (error) {
    console.error("Error fetching teachers:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * GET TEACHERS BY SECTION
 * Find all teachers teaching a specific section
 */
const getTeachersBySection = async (req, res) => {
  const { section } = req.params;

  try {
    const teachers = await User.find({
      role: "teacher",
      "assignedSubjects.section": section,
    })
      .select("-password")
      .populate("assignedSubjects.subjectId");

    const teachersWithSubjects = teachers.map((teacher) => {
      const sectionAssignments = teacher.assignedSubjects.filter(
        (a) => a.section === section,
      );

      return {
        id: teacher._id,
        name: teacher.name,
        email: teacher.email,
        rollNo: teacher.rollNo,
        subjects: sectionAssignments.map((a) => ({
          subjectId: a.subjectId,
          subjectName: a.subjectName,
          assignedDate: a.assignedDate,
        })),
      };
    });

    return res.status(200).json({
      message: `Teachers teaching section ${section}`,
      data: teachersWithSubjects,
    });
  } catch (error) {
    console.error("Error fetching teachers by section:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * GET ALL SUBJECTS
 * Only admin can view
 */
const getAllSubjects = async (req, res) => {
  try {
    // Check if user is admin
    // const admin = await User.findById(req.user.userId);
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        message: "Only admins can view subjects",
      });
    }

    const subjects = await Subject.find({ isActive: true }).populate(
      "createdBy",
      "name email",
    );

    return res.status(200).json({
      message: "Subjects retrieved successfully",
      data: subjects,
    });
  } catch (error) {
    console.error("Error fetching subjects:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * GET ALL ENROLLMENTS
 * Admin only - Get all student enrollments with details
 */
const getAllEnrollments = async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        message: "Only admins can view all enrollments",
      });
    }

    // Get enrollments with pagination (optional)
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // Build query filters (optional)
    let filter = {};

    // Filter by section if provided
    if (req.query.section) {
      filter.section = req.query.section;
    }

    // Filter by registration status if provided
    if (req.query.isRegistered !== undefined) {
      filter.isRegistered = req.query.isRegistered === "true";
    }

    // Get total count for pagination
    const total = await Enrollment.countDocuments(filter);

    // Get enrollments with proper population
    const enrollments = await Enrollment.find(filter)
      .populate({
        path: "userId",
        select: "name email role", // User fields to populate
      })
      .populate({
        path: "uploadedBy",
        select: "name email", // Admin who uploaded
      })
      .populate({
        path: "subjects.subjectId",
        select: "subjectName subjectCode semester credits",
      })
      .populate({
        path: "subjects.teacherId",
        select: "name email",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Transform the data for better response structure
    const transformedEnrollments = enrollments.map((enrollment) => {
      const enrollmentObj = enrollment.toObject();

      return {
        ...enrollmentObj,
        // Add full name
        fullName: `${enrollment.firstName} ${enrollment.lastName}`,
        // Add registered user details if exists
        registeredUser: enrollment.userId
          ? {
              id: enrollment.userId._id,
              name: enrollment.userId.name,
              email: enrollment.userId.email,
              role: enrollment.userId.role,
            }
          : null,
        // Count subjects
        subjectCount: enrollment.subjects?.length || 0,
        // Count active subjects
        activeSubjectCount:
          enrollment.subjects?.filter((s) => s.isActive).length || 0,
      };
    });

    return res.status(200).json({
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
    console.error("Error fetching enrollments:", error);
    return res.status(500).json({
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

  try {
    const enrollment = await Enrollment.findById(id)
      .populate({
        path: "userId",
        select: "name email role",
      })
      .populate({
        path: "uploadedBy",
        select: "name email",
      })
      .populate({
        path: "subjects.subjectId",
        select: "subjectName subjectCode semester credits",
      })
      .populate({
        path: "subjects.teacherId",
        select: "name email",
      });

    if (!enrollment) {
      return res.status(404).json({
        message: "Enrollment not found",
      });
    }

    return res.status(200).json({
      message: "Enrollment retrieved successfully",
      data: enrollment,
    });
  } catch (error) {
    console.error("Error fetching enrollment:", error);
    return res.status(500).json({
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

  try {
    const enrollments = await Enrollment.find({ section })
      .populate({
        path: "userId",
        select: "name email",
      })
      .populate({
        path: "subjects.subjectId",
        select: "subjectName subjectCode",
      });

    return res.status(200).json({
      message: `Enrollments for section ${section} retrieved successfully`,
      count: enrollments.length,
      data: enrollments,
    });
  } catch (error) {
    console.error("Error fetching enrollments by section:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * GET STUDENT ENROLLMENT (for logged-in student)
 */
const getMyEnrollment = async (req, res) => {
  try {
    const enrollment = await Enrollment.findOne({ userId: req.user._id })
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
        message: "Enrollment not found for this student",
      });
    }

    // Get only active subjects
    const activeSubjects = enrollment.getActiveSubjects();

    return res.status(200).json({
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
    console.error("Error fetching your enrollment:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};


/**
 * GET ALL ASSIGNMENTS
 * Fetch all teacher-subject assignments with details
 * Returns: List of all assignments grouped by teacher or as individual entries
 */
const getAllAssignments = async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        message: "Only admins can view assignments",
      });
    }

    // Get all teachers with their assigned subjects populated
    const teachers = await User.find({ role: "teacher" })
      .select("name email rollNo assignedSubjects")
      .populate({
        path: "assignedSubjects.subjectId",
        select: "subjectName subjectCode semester credits description",
      });

    // Transform the data into a flat list of assignments
    const assignments = [];
    
    teachers.forEach((teacher) => {
      // Skip teachers with no assignments
      if (!teacher.assignedSubjects || teacher.assignedSubjects.length === 0) {
        return;
      }

      // Create an entry for each assignment
      teacher.assignedSubjects.forEach((assignment) => {
        assignments.push({
          _id: assignment._id,
          teacher: {
            _id: teacher._id,
            name: teacher.name,
            email: teacher.email,
            rollNo: teacher.rollNo,
          },
          subject: assignment.subjectId ? {
            _id: assignment.subjectId._id,
            subjectName: assignment.subjectId.subjectName,
            subjectCode: assignment.subjectId.subjectCode,
            semester: assignment.subjectId.semester,
            credits: assignment.subjectId.credits,
            description: assignment.subjectId.description,
          } : {
            _id: assignment.subjectId,
            subjectName: assignment.subjectName,
            subjectCode: "N/A",
          },
          section: assignment.section,
          assignedDate: assignment.assignedDate,
        });
      });
    });

    // Also fetch assignments that might be in the system but teacher reference is broken
    // This is optional - you can skip if not needed

    return res.status(200).json({
      message: "Assignments retrieved successfully",
      data: assignments,
      stats: {
        totalAssignments: assignments.length,
        totalTeachers: teachers.length,
        teachersWithAssignments: teachers.filter(t => t.assignedSubjects?.length > 0).length,
      },
    });

  } catch (error) {
    console.error("Error fetching assignments:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * GET ASSIGNMENTS BY TEACHER
 * Fetch assignments for a specific teacher
 */
const getAssignmentsByTeacher = async (req, res) => {
  const { teacherId } = req.params;

  try {
    // Check if user is admin
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        message: "Only admins can view assignments",
      });
    }

    const teacher = await User.findById(teacherId)
      .select("name email rollNo assignedSubjects")
      .populate({
        path: "assignedSubjects.subjectId",
        select: "subjectName subjectCode semester credits description",
      });

    if (!teacher || teacher.role !== "teacher") {
      return res.status(404).json({
        message: "Teacher not found",
      });
    }

    // Transform assignments
    const assignments = teacher.assignedSubjects.map((assignment) => ({
      _id: assignment._id,
      subject: assignment.subjectId ? {
        _id: assignment.subjectId._id,
        subjectName: assignment.subjectId.subjectName,
        subjectCode: assignment.subjectId.subjectCode,
        semester: assignment.subjectId.semester,
        credits: assignment.subjectId.credits,
      } : {
        _id: assignment.subjectId,
        subjectName: assignment.subjectName,
        subjectCode: "N/A",
      },
      section: assignment.section,
      assignedDate: assignment.assignedDate,
    }));

    // Group by section
    const bySection = assignments.reduce((acc, curr) => {
      if (!acc[curr.section]) {
        acc[curr.section] = [];
      }
      acc[curr.section].push(curr);
      return acc;
    }, {});

    return res.status(200).json({
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
    console.error("Error fetching teacher assignments:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * GET ASSIGNMENTS BY SUBJECT
 * Fetch all teachers assigned to a specific subject
 */
const getAssignmentsBySubject = async (req, res) => {
  const { subjectId } = req.params;

  try {
    // Check if user is admin
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        message: "Only admins can view assignments",
      });
    }

    // Find subject
    const subject = await Subject.findById(subjectId);
    if (!subject) {
      return res.status(404).json({
        message: "Subject not found",
      });
    }

    // Find all teachers assigned this subject
    const teachers = await User.find({
      role: "teacher",
      "assignedSubjects.subjectId": subjectId,
    })
      .select("name email rollNo assignedSubjects")
      .populate({
        path: "assignedSubjects.subjectId",
        select: "subjectName subjectCode",
      });

    // Extract assignments for this subject
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
    console.error("Error fetching subject assignments:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * GET ASSIGNMENTS BY SECTION
 * Fetch all teachers and subjects for a specific section
 */
const getAssignmentsBySection = async (req, res) => {
  const { section } = req.params;

  try {
    // Check if user is admin
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        message: "Only admins can view assignments",
      });
    }

    // Find all teachers teaching this section
    const teachers = await User.find({
      role: "teacher",
      "assignedSubjects.section": section,
    })
      .select("name email rollNo assignedSubjects")
      .populate({
        path: "assignedSubjects.subjectId",
        select: "subjectName subjectCode semester credits",
      });

    // Extract assignments for this section
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
            subject: assignment.subjectId ? {
              _id: assignment.subjectId._id,
              subjectName: assignment.subjectId.subjectName,
              subjectCode: assignment.subjectId.subjectCode,
              semester: assignment.subjectId.semester,
              credits: assignment.subjectId.credits,
            } : {
              _id: assignment.subjectId,
              subjectName: assignment.subjectName,
              subjectCode: "N/A",
            },
            assignedDate: assignment.assignedDate,
          });
        }
      });
    });

    // Get enrolled students count for this section
    const studentCount = await Enrollment.countDocuments({ section });

    return res.status(200).json({
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
    console.error("Error fetching section assignments:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

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
 * Send teacher credentials via email
 */
async function sendTeacherCredentialsEmail(email, name, tempPassword) {
  try {
    // Configure email service (update with your email config)
    const transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || "Gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "ERP System - Teacher Account Created",
      html: `
        <h2>Welcome to ERP System!</h2>
        <p>Dear ${name},</p>
        <p>Your teacher account has been created successfully.</p>
        <h3>Login Credentials:</h3>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Temporary Password:</strong> ${tempPassword}</p>
        <p><strong>Login URL:</strong> ${process.env.APP_URL || "http://localhost:3000"}/login</p>
        <h3>Important:</h3>
        <ul>
          <li>Please change your password on first login</li>
          <li>Do not share your credentials with anyone</li>
          <li>Contact admin if you have any issues</li>
        </ul>
        <p>Best regards,<br/>ERP System Admin</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${email}`);
  } catch (error) {
    console.error("Error sending email:", error);
    // Don't throw error, as teacher was already created
    // Log it for admin to handle manually
  }
}

module.exports = {
  uploadEnrollments,
  createTeacher,
  createSubject,
  assignSubjectToTeacher,
  getAllTeachers,
  getAllSubjects,
  getAllEnrollments,
  getEnrollmentById,
  getEnrollmentsBySection,
  getMyEnrollment,
  getAllAssignments,
  getAssignmentsByTeacher,
  getAssignmentsBySubject,
  getAssignmentsBySection,
  
};
