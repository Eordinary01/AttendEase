const Subject = require("../models/Subject");
const User = require("../models/User");
const Enrollment = require("../models/Enrollment");
require('dotenv').config();

/**
 * CREATE SUBJECT
 * Only admin can create subjects
 */
const createSubject = async (req, res) => {
  const { subjectCode, subjectName, description, credits, semester, courseCode } = req.body;

  // Validation
  if (!subjectCode || !subjectName || !semester) {
    return res.status(400).json({
      message: 'Subject code, name, and semester are required'
    });
  }

  try {
    // Check if user is admin
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        message: 'Only admins can create subjects'
      });
    }

    // Sanitize inputs
    const sanitizedSubjectCode = subjectCode.toUpperCase().trim();
    const sanitizedSubjectName = subjectName.trim();
    const sanitizedSemester = semester.trim();
    const sanitizedCourseCode = courseCode ? courseCode.trim() : '';

    // Check if subject code already exists (case-insensitive)
    const existingSubjectByCode = await Subject.findOne({ 
      subjectCode: sanitizedSubjectCode 
    });
    
    if (existingSubjectByCode) {
      return res.status(400).json({
        message: 'Subject code already exists',
        field: 'subjectCode',
        existingValue: existingSubjectByCode.subjectCode
      });
    }

    // Check if subject name already exists (case-insensitive)
    // Using regex for case-insensitive search
    const existingSubjectByName = await Subject.findOne({ 
      subjectName: { $regex: new RegExp(`^${sanitizedSubjectName}$`, 'i') }
    });
    
    if (existingSubjectByName) {
      return res.status(400).json({
        message: 'Subject name already exists',
        field: 'subjectName',
        existingValue: existingSubjectByName.subjectName
      });
    }

    // Optional: Check for duplicate in same semester/course if needed
    // This prevents same subject name in same semester/course combination
    const existingSubjectInSemester = await Subject.findOne({
      subjectName: { $regex: new RegExp(`^${sanitizedSubjectName}$`, 'i') },
      semester: sanitizedSemester,
      ...(sanitizedCourseCode && { courseCode: sanitizedCourseCode })
    });

    if (existingSubjectInSemester) {
      return res.status(400).json({
        message: `Subject with name "${sanitizedSubjectName}" already exists in semester ${sanitizedSemester}${sanitizedCourseCode ? ` for course ${sanitizedCourseCode}` : ''}`,
        field: 'subjectName',
        existingValue: existingSubjectInSemester.subjectName
      });
    }

    // Create subject
    const newSubject = new Subject({
      subjectCode: sanitizedSubjectCode,
      subjectName: sanitizedSubjectName,
      description: description ? description.trim() : '',
      credits: credits || 0,
      semester: sanitizedSemester,
      courseCode: sanitizedCourseCode,
      createdBy: req.user._id,
      isActive: true
    });

    await newSubject.save();

    return res.status(201).json({
      message: 'Subject created successfully',
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
        createdAt: newSubject.createdAt
      }
    });

  } catch (error) {
    console.error('Error creating subject:', error);
    
    // Handle duplicate key error from MongoDB (just in case)
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        message: `Duplicate value for ${field}`,
        error: error.message
      });
    }

    return res.status(500).json({
      message: 'Internal server error',
      error: error.message
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
        message: 'User not found'
      });
    }

    let response = {};

    // ADMIN VIEW - See everything
    if (user.role === 'admin') {
      const subjects = await Subject.find({})
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 });

      // Get assignment information from User model
      const subjectsWithDetails = await Promise.all(subjects.map(async (subject) => {
        // Find all teachers who have this subject assigned
        const teachersWithSubject = await User.find({
          role: 'teacher',
          'assignedSubjects.subjectId': subject._id
        }).select('name email assignedSubjects.$');

        const assignments = teachersWithSubject.map(teacher => {
          const assignment = teacher.assignedSubjects.find(
            a => a.subjectId.toString() === subject._id.toString()
          );
          return {
            teacherId: teacher._id,
            teacherName: teacher.name,
            section: assignment ? assignment.section : null,
            assignedDate: assignment ? assignment.assignedDate : null
          };
        });

        return {
          ...subject.toObject(),
          assignments: assignments,
          totalAssignments: assignments.length
        };
      }));

      response = {
        message: 'All subjects retrieved successfully',
        count: subjectsWithDetails.length,
        subjects: subjectsWithDetails,
        stats: {
          totalSubjects: subjectsWithDetails.length,
          activeSubjects: subjectsWithDetails.filter(s => s.isActive).length,
          subjectsWithAssignments: subjectsWithDetails.filter(s => s.totalAssignments > 0).length
        }
      };
    }
    
    // TEACHER VIEW - See their assigned subjects + all active subjects
    else if (user.role === 'teacher') {
      // Get teacher with populated assigned subjects
      const teacherWithAssignments = await User.findById(user._id)
        .populate('assignedSubjects.subjectId');

      // Get detailed info for assigned subjects
      const assignedSubjectsDetails = await Promise.all(
        teacherWithAssignments.assignedSubjects.map(async (assignment) => {
          const subject = assignment.subjectId;
          
          // Get student count for this section
          const studentsCount = await Enrollment.countDocuments({ 
            section: assignment.section,
            isRegistered: true 
          });

          return {
            assignmentId: assignment._id,
            subject: {
              id: subject?._id,
              subjectCode: subject.subjectCode,
              subjectName: subject.subjectName,
              semester: subject.semester,
              credits: subject.credits,
              description: subject.description
            },
            section: assignment.section,
            assignedDate: assignment.assignedDate,
            studentsCount
          };
        })
      );

      // Get all active subjects (for reference)
      const allActiveSubjects = await Subject.find({ isActive: true });

      // Group by section
      const bySection = assignedSubjectsDetails.reduce((acc, curr) => {
        if (!acc[curr.section]) {
          acc[curr.section] = [];
        }
        acc[curr.section].push(curr.subject);
        return acc;
      }, {});

      response = {
        message: 'Subjects retrieved successfully',
        role: 'teacher',
        teacherInfo: {
          id: user._id,
          name: user.name,
          email: user.email
        },
        assignedSubjects: {
          count: assignedSubjectsDetails.length,
          subjects: assignedSubjectsDetails
        },
        bySection,
        allActiveSubjects: allActiveSubjects.map(s => ({
          id: s._id,
          subjectCode: s.subjectCode,
          subjectName: s.subjectName,
          semester: s.semester
        }))
      };
    }
    
    // STUDENT VIEW - See subjects for their section only
    else if (user.role === 'student') {
      // Find student's enrollment
      const enrollment = await Enrollment.findOne({ userId: user._id });
      
      if (!enrollment) {
        return res.status(404).json({
          message: 'Enrollment not found for this student'
        });
      }

      // Find all teachers teaching this section
      const teachersForSection = await User.find({
        role: 'teacher',
        'assignedSubjects.section': enrollment.section
      }).populate('assignedSubjects.subjectId');

      // Extract subjects for this section
      const subjectsWithTeachers = [];
      
      teachersForSection.forEach(teacher => {
        teacher.assignedSubjects.forEach(assignment => {
          if (assignment.section === enrollment.section && assignment.subjectId) {
            subjectsWithTeachers.push({
              subject: {
                id: assignment.subjectId._id,
                subjectCode: assignment.subjectId.subjectCode,
                subjectName: assignment.subjectId.subjectName,
                semester: assignment.subjectId.semester,
                credits: assignment.subjectId.credits,
                description: assignment.subjectId.description
              },
              teacher: {
                id: teacher._id,
                name: teacher.name,
                email: teacher.email
              },
              section: assignment.section,
              assignedDate: assignment.assignedDate
            });
          }
        });
      });

      response = {
        message: 'Your subjects retrieved successfully',
        role: 'student',
        studentInfo: {
          id: user._id,
          name: user.name,
          email: user.email,
          enrollmentNumber: enrollment.enrollmentNumber,
          section: enrollment.section
        },
        subjects: subjectsWithTeachers,
        count: subjectsWithTeachers.length
      };
    }

    return res.status(200).json(response);

  } catch (error) {
    console.error('Error fetching subjects:', error);
    return res.status(500).json({
      message: 'Internal server error',
      error: error.message
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
      message: 'Subject ID is required'
    });
  }

  try {
    const user = await User.findById(req.user._id);
    const subject = await Subject.findById(subjectId)
      .populate('createdBy', 'name email');

    if (!subject) {
      return res.status(404).json({
        message: 'Subject not found'
      });
    }

    let response = {};

    // ADMIN - Can see everything
    if (user.role === 'admin') {
      // Find all teachers assigned to this subject
      const teachersWithSubject = await User.find({
        role: 'teacher',
        'assignedSubjects.subjectId': subject._id
      }).select('name email assignedSubjects.$');

      const assignments = await Promise.all(teachersWithSubject.map(async (teacher) => {
        const assignment = teacher.assignedSubjects.find(
          a => a.subjectId.toString() === subject._id.toString()
        );
        
        const studentsCount = await Enrollment.countDocuments({ 
          section: assignment.section 
        });

        return {
          teacher: {
            id: teacher._id,
            name: teacher.name,
            email: teacher.email
          },
          section: assignment.section,
          assignedDate: assignment.assignedDate,
          studentsCount
        };
      }));

      response = {
        message: 'Subject retrieved successfully',
        subject: {
          ...subject.toObject(),
          assignments
        }
      };
    }
    
    // TEACHER - Can see if assigned or if subject is active
    else if (user.role === 'teacher') {
      // Check if this subject is assigned to the teacher
      const teacher = await User.findById(user._id)
        .populate('assignedSubjects.subjectId');

      const isAssigned = teacher.assignedSubjects.find(
        assignment => assignment.subjectId?._id.toString() === subjectId
      );

      if (!isAssigned && !subject.isActive) {
        return res.status(403).json({
          message: 'You do not have access to this subject'
        });
      }

      // If assigned, show with section details
      if (isAssigned) {
        const studentsInSection = await Enrollment.countDocuments({ 
          section: isAssigned.section 
        });

        response = {
          message: 'Subject retrieved successfully',
          subject: {
            id: subject._id,
            subjectCode: subject.subjectCode,
            subjectName: subject.subjectName,
            semester: subject.semester,
            credits: subject.credits,
            description: subject.description
          },
          yourAssignment: {
            section: isAssigned.section,
            assignedDate: isAssigned.assignedDate,
            studentsInSection
          }
        };
      } else {
        // Just show subject info
        response = {
          message: 'Subject retrieved successfully',
          subject: {
            id: subject._id,
            subjectCode: subject.subjectCode,
            subjectName: subject.subjectName,
            semester: subject.semester,
            credits: subject.credits,
            description: subject.description
          }
        };
      }
    }
    
    // STUDENT - Can see only if in their section
    else if (user.role === 'student') {
      const enrollment = await Enrollment.findOne({ userId: user._id });
      
      if (!enrollment) {
        return res.status(404).json({
          message: 'Enrollment not found'
        });
      }

      // Find teacher teaching this subject in student's section
      const teacher = await User.findOne({
        role: 'teacher',
        'assignedSubjects.subjectId': subject._id,
        'assignedSubjects.section': enrollment.section
      }).select('name email assignedSubjects.$');

      if (!teacher) {
        return res.status(403).json({
          message: 'This subject is not available in your section'
        });
      }

      const assignment = teacher.assignedSubjects.find(
        a => a.subjectId.toString() === subject._id.toString() && 
             a.section === enrollment.section
      );

      response = {
        message: 'Subject retrieved successfully',
        subject: {
          id: subject._id,
          subjectCode: subject.subjectCode,
          subjectName: subject.subjectName,
          semester: subject.semester,
          credits: subject.credits,
          description: subject.description
        },
        teacher: {
          id: teacher._id,
          name: teacher.name,
          email: teacher.email
        },
        section: assignment.section,
        assignedDate: assignment.assignedDate
      };
    }

    return res.status(200).json(response);

  } catch (error) {
    console.error('Error fetching subject:', error);
    return res.status(500).json({
      message: 'Internal server error',
      error: error.message
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
      message: 'Semester is required'
    });
  }

  try {
    const user = await User.findById(req.user._id);
    
    let response = {};

    // ADMIN - All subjects in semester
    if (user.role === 'admin') {
      const subjects = await Subject.find({ semester: semester.trim() })
        .populate('createdBy', 'name email')
        .sort({ subjectCode: 1 });

      response = {
        message: `Subjects for semester ${semester} retrieved successfully`,
        count: subjects.length,
        semester,
        subjects
      };
    }
    
    // TEACHER - Active subjects + their assignments in this semester
    else if (user.role === 'teacher') {
      // Get all active subjects in this semester
      const subjects = await Subject.find({ 
        semester: semester.trim(), 
        isActive: true 
      }).sort({ subjectCode: 1 });
      
      // Get teacher's assignments
      const teacher = await User.findById(user._id)
        .populate('assignedSubjects.subjectId');

      const subjectsWithStatus = subjects.map(subject => {
        const assignment = teacher.assignedSubjects.find(
          a => a.subjectId?._id.toString() === subject._id.toString()
        );
        
        return {
          ...subject.toObject(),
          isAssignedToYou: !!assignment,
          yourSection: assignment ? assignment.section : null,
          assignedDate: assignment ? assignment.assignedDate : null
        };
      });

      response = {
        message: `Subjects for semester ${semester} retrieved successfully`,
        count: subjectsWithStatus.length,
        semester,
        subjects: subjectsWithStatus
      };
    }
    
    // STUDENT - Only subjects in their section for this semester
    else if (user.role === 'student') {
      const enrollment = await Enrollment.findOne({ userId: user._id });
      
      if (!enrollment) {
        return res.status(404).json({
          message: 'Enrollment not found'
        });
      }

      // Find all teachers teaching this section
      const teachers = await User.find({
        role: 'teacher',
        'assignedSubjects.section': enrollment.section
      }).populate('assignedSubjects.subjectId');

      // Filter subjects by semester
      const subjectsInSemester = [];
      
      teachers.forEach(teacher => {
        teacher.assignedSubjects.forEach(assignment => {
          if (assignment.section === enrollment.section && 
              assignment.subjectId && 
              assignment.subjectId.semester === semester.trim()) {
            subjectsInSemester.push({
              subject: {
                id: assignment.subjectId._id,
                subjectCode: assignment.subjectId.subjectCode,
                subjectName: assignment.subjectId.subjectName,
                semester: assignment.subjectId.semester,
                credits: assignment.subjectId.credits,
                description: assignment.subjectId.description
              },
              teacher: {
                id: teacher._id,
                name: teacher.name,
                email: teacher.email
              },
              section: assignment.section,
              assignedDate: assignment.assignedDate
            });
          }
        });
      });

      response = {
        message: `Your subjects for semester ${semester} retrieved successfully`,
        count: subjectsInSemester.length,
        semester,
        section: enrollment.section,
        subjects: subjectsInSemester
      };
    }

    return res.status(200).json(response);

  } catch (error) {
    console.error('Error fetching subjects by semester:', error);
    return res.status(500).json({
      message: 'Internal server error',
      error: error.message
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
      message: 'Teacher ID is required'
    });
  }

  try {
    const requester = await User.findById(req.user._id);
    
    // Check permissions
    if (requester.role !== 'admin' && requester._id.toString() !== teacherId) {
      return res.status(403).json({
        message: 'You do not have permission to view this information'
      });
    }

    const teacher = await User.findById(teacherId)
      .populate('assignedSubjects.subjectId');

    if (!teacher || teacher.role !== 'teacher') {
      return res.status(404).json({
        message: 'Teacher not found'
      });
    }

    // Filter assignments
    let assignments = teacher.assignedSubjects;

    if (section) {
      assignments = assignments.filter(a => a.section === section);
    }

    // Process assignments
    const subjectsWithDetails = await Promise.all(
      assignments.map(async (assignment) => {
        const subject = assignment.subjectId;
        
        if (!subject) return null;

        const studentsInSection = await Enrollment.countDocuments({ 
          section: assignment.section 
        });

        const registeredStudents = await Enrollment.countDocuments({ 
          section: assignment.section,
          isRegistered: true 
        });

        return {
          assignmentId: assignment._id,
          subject: {
            id: subject._id,
            subjectCode: subject.subjectCode,
            subjectName: subject.subjectName,
            semester: subject.semester,
            credits: subject.credits,
            description: subject.description,
            isActive: subject.isActive
          },
          section: assignment.section,
          assignedDate: assignment.assignedDate,
          stats: {
            totalStudents: studentsInSection,
            registeredStudents,
            pendingRegistration: studentsInSection - registeredStudents
          }
        };
      })
    );

    // Remove null values
    const validSubjects = subjectsWithDetails.filter(s => s !== null);

    // Filter by semester if provided
    let filteredSubjects = validSubjects;
    if (semester) {
      filteredSubjects = validSubjects.filter(
        s => s.subject.semester === semester
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
    const availableSections = [...new Set(teacher.assignedSubjects.map(a => a.section))];
    const availableSemesters = [...new Set(
      teacher.assignedSubjects
        .map(a => a.subjectId?.semester)
        .filter(Boolean)
    )];

    return res.status(200).json({
      message: 'Teacher subjects retrieved successfully',
      teacher: {
        id: teacher._id,
        name: teacher.name,
        email: teacher.email
      },
      filters: {
        applied: {
          section: section || 'all',
          semester: semester || 'all'
        },
        availableSections,
        availableSemesters
      },
      stats: {
        totalAssignments: filteredSubjects.length,
        totalSections: Object.keys(bySection).length,
        totalStudents: filteredSubjects.reduce((sum, s) => sum + s.stats.totalStudents, 0)
      },
      subjects: filteredSubjects,
      groupedBySection: bySection
    });

  } catch (error) {
    console.error('Error fetching teacher subjects:', error);
    return res.status(500).json({
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * SEARCH SUBJECTS - Role-based search
 */
const searchSubjects = async (req, res) => {
  const { query } = req.query;

  if (!query || query.trim() === '') {
    return res.status(400).json({
      message: 'Search query is required'
    });
  }

  try {
    const user = await User.findById(req.user._id);
    
    const searchRegex = new RegExp(query, 'i');
    const searchQuery = {
      $or: [
        { subjectCode: searchRegex },
        { subjectName: searchRegex },
        { description: searchRegex }
      ]
    };

    let response = {};

    // ADMIN - Search all subjects
    if (user.role === 'admin') {
      const subjects = await Subject.find(searchQuery)
        .populate('createdBy', 'name email')
        .limit(20);

      response = {
        message: `Found ${subjects.length} subject(s) matching "${query}"`,
        query,
        count: subjects.length,
        subjects
      };
    }
    
    // TEACHER - Search active subjects + show if assigned
    else if (user.role === 'teacher') {
      searchQuery.isActive = true;
      const subjects = await Subject.find(searchQuery).limit(20);

      const teacher = await User.findById(user._id)
        .populate('assignedSubjects.subjectId');

      const subjectsWithStatus = subjects.map(subject => {
        const assignment = teacher.assignedSubjects.find(
          a => a.subjectId?._id.toString() === subject._id.toString()
        );
        
        return {
          ...subject.toObject(),
          isAssignedToYou: !!assignment,
          yourSection: assignment ? assignment.section : null,
          assignedDate: assignment ? assignment.assignedDate : null
        };
      });

      response = {
        message: `Found ${subjectsWithStatus.length} subject(s) matching "${query}"`,
        query,
        count: subjectsWithStatus.length,
        subjects: subjectsWithStatus
      };
    }
    
    // STUDENT - Search only subjects in their section
    else if (user.role === 'student') {
      const enrollment = await Enrollment.findOne({ userId: user._id });
      
      if (!enrollment) {
        return res.status(404).json({
          message: 'Enrollment not found'
        });
      }

      // Find all teachers teaching this section
      const teachers = await User.find({
        role: 'teacher',
        'assignedSubjects.section': enrollment.section
      }).populate({
        path: 'assignedSubjects.subjectId',
        match: {
          $or: [
            { subjectCode: searchRegex },
            { subjectName: searchRegex }
          ]
        }
      });

      const matchingSubjects = [];
      
      teachers.forEach(teacher => {
        teacher.assignedSubjects.forEach(assignment => {
          if (assignment.section === enrollment.section && 
              assignment.subjectId) {
            matchingSubjects.push({
              subject: {
                id: assignment.subjectId._id,
                subjectCode: assignment.subjectId.subjectCode,
                subjectName: assignment.subjectId.subjectName,
                semester: assignment.subjectId.semester,
                credits: assignment.subjectId.credits
              },
              teacher: {
                id: teacher._id,
                name: teacher.name,
                email: teacher.email
              },
              section: assignment.section,
              assignedDate: assignment.assignedDate
            });
          }
        });
      });

      response = {
        message: `Found ${matchingSubjects.length} subject(s) in your section matching "${query}"`,
        query,
        count: matchingSubjects.length,
        subjects: matchingSubjects
      };
    }

    return res.status(200).json(response);

  } catch (error) {
    console.error('Error searching subjects:', error);
    return res.status(500).json({
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Export all functions
module.exports = {
  createSubject,
  getAllSubjects,
  getSubjectById,
  getSubjectsBySemester,
  getTeacherSubjects,
  searchSubjects
};