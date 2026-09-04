// controllers/userController.js
const mongoose = require("mongoose");
const User = require("../models/User");
const Tenant = require("../models/Tenant");
const Course = require("../models/Course");
const logger = require("../utils/logger");
const { escapeRegExp, toObjectId } = require("../utils/sanitize");
const cache = require("../middleware/cache");
const { uploadToCloudinary, deleteFromCloudinary } = require("../utils/cloudinary");

// ==================== PROFILE MANAGEMENT ====================

/**
 * GET /api/users/profile
 * Get current user's profile
 */
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('assignedSubjects.subjectId')
      .populate('courseId', 'name code branches');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Auto-detect profile completeness if essential profile fields are present
    if (!user.profileComplete) {
      let isComplete = false;
      if (user.role === 'teacher') {
        // Teacher is complete if they have phone or qualification or address filled
        if (user.phone || user.qualification || user.specialization || user.address) {
          isComplete = true;
        }
      } else if (user.role === 'student') {
        if (user.phone || user.parentName || user.parentPhone || user.address) {
          isComplete = true;
        }
      } else if (user.role === 'admin' || user.role === 'super_admin') {
        isComplete = true;
      }

      if (isComplete) {
        user.profileComplete = true;
        await User.findByIdAndUpdate(user._id, { profileComplete: true });
      }
    }
    
    return res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error('Error fetching profile', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch profile',
      error: error.message
    });
  }
};

/**
 * PUT /api/users/profile
 * Update current user's profile
 */
const updateProfile = async (req, res) => {
  try {
    const { name, phone, address, parentName, parentPhone, parentEmail, qualification, specialization } = req.body;
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Core fields editable by all roles
    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (address !== undefined) user.address = address;
    
    // Role-specific fields
    if (user.role === 'student') {
      if (parentName !== undefined) user.parentName = parentName;
      if (parentPhone !== undefined) user.parentPhone = parentPhone;
      if (parentEmail !== undefined) user.parentEmail = parentEmail;
    } else if (user.role === 'teacher') {
      if (qualification !== undefined) user.qualification = qualification;
      if (specialization !== undefined) user.specialization = specialization;
    }
    
    user.profileComplete = true;
    await user.save();
    
    // Invalidate user cache
    await cache.del(`user:${user._id}`);
    
    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        _id: user._id,
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        section: user.section,
        rollNo: user.rollNo,
        phone: user.phone,
        address: user.address,
        qualification: user.qualification,
        specialization: user.specialization,
        parentName: user.parentName,
        parentPhone: user.parentPhone,
        parentEmail: user.parentEmail,
        courseName: user.courseName,
        branch: user.branch,
        semester: user.semester,
        emailVerified: user.emailVerified,
        profileComplete: user.profileComplete,
        createdAt: user.createdAt,
      }
    });
  } catch (error) {
    logger.error('Error updating profile', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message
    });
  }
};

/**
 * POST /api/users/profile/photo
 * Upload user profile photo to Cloudinary
 */
const uploadProfilePhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an image file (jpeg, png, or webp)',
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const tenantSubfolder = user.tenantId ? user.tenantId.toString() : 'global';

    // Upload to Cloudinary with face-centered crop
    const uploadResult = await uploadToCloudinary(req.file.buffer, {
      folder: `attendease/avatars/${tenantSubfolder}`,
      publicId: `avatar_${user._id}`,
      resourceType: 'image',
      originalName: req.file.originalname,
      transformation: [
        { width: 400, height: 400, crop: 'fill', gravity: 'face' },
        { quality: 'auto', fetch_format: 'auto' }
      ],
    });

    user.avatar = uploadResult.url;
    user.profileComplete = true;
    await user.save();

    // Invalidate user cache
    await cache.del(`user:${user._id}`);

    logger.info(`Profile photo updated for user ${user._id}`, { url: uploadResult.url });

    return res.status(200).json({
      success: true,
      message: 'Profile photo uploaded successfully',
      data: {
        _id: user._id,
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        profileComplete: user.profileComplete,
      },
    });
  } catch (error) {
    logger.error('Error uploading profile photo', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to upload profile photo',
      error: error.message,
    });
  }
};

/**
 * DELETE /api/users/profile/photo
 * Remove user profile photo
 */
const deleteProfilePhoto = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.avatar) {
      const tenantSubfolder = user.tenantId ? user.tenantId.toString() : 'global';
      await deleteFromCloudinary(`attendease/avatars/${tenantSubfolder}/avatar_${user._id}`);
      user.avatar = null;
      await user.save();
      await cache.del(`user:${user._id}`);
    }

    return res.status(200).json({
      success: true,
      message: 'Profile photo removed successfully',
      data: {
        _id: user._id,
        id: user._id,
        avatar: null,
      },
    });
  } catch (error) {
    logger.error('Error removing profile photo', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to remove profile photo',
      error: error.message,
    });
  }
};

// ==================== STUDENT MANAGEMENT ====================

/**
 * GET /api/users/students
 * Get all students (admin only)
 */
const getAllStudents = async (req, res) => {
  try {
    const { page = 1, limit = 1000, section, search, courseId, course, courseName, courseCode, branch, semester, subjectId } = req.query || {};
    const safeLimit = req.query?.limit === 'all' ? 5000 : Math.min(5000, Math.max(1, parseInt(limit, 10) || 1000));
    const skip = (Math.max(1, parseInt(page, 10) || 1) - 1) * safeLimit;
    
    const effectiveTenantId = req.tenantId || req.user?.tenantId;
    let query = { 
      role: 'student',
      isActive: true 
    };
    if (req.user?.role !== 'super_admin') {
      query.tenantId = effectiveTenantId;
    } else if (req.query.tenantId) {
      query.tenantId = req.query.tenantId;
    }

    // Course filter (by ObjectId or name/code)
    const targetCourse = courseId || course || courseName || courseCode;
    let courseIdsFromTarget = [];
    if (targetCourse) {
      const cStr = String(targetCourse).trim();
      if (mongoose.Types.ObjectId.isValid(cStr) && cStr.length === 24) {
        courseIdsFromTarget.push(new mongoose.Types.ObjectId(cStr));
      } else {
        const matchingCourses = await Course.find({
          tenantId: effectiveTenantId,
          $or: [
            { name: new RegExp(`^${escapeRegExp(cStr)}$`, "i") },
            { code: new RegExp(`^${escapeRegExp(cStr)}$`, "i") }
          ]
        }).select('_id').lean();
        courseIdsFromTarget = matchingCourses.map((c) => c._id);
      }

      const courseOr = [
        { courseName: new RegExp(`^${escapeRegExp(cStr)}$`, "i") }
      ];
      if (courseIdsFromTarget.length > 0) {
        courseOr.push({ courseId: { $in: courseIdsFromTarget } });
      }
      query.$and = query.$and || [];
      query.$and.push({ $or: courseOr });
    }

const BRANCH_ALIASES = {
  "CSE": ["CSE", "COMPUTER SCIENCE", "COMPUTER SCIENCE & ENGINEERING", "COMPUTER SCIENCE AND ENGINEERING"],
  "COMPUTER SCIENCE": ["CSE", "COMPUTER SCIENCE", "COMPUTER SCIENCE & ENGINEERING", "COMPUTER SCIENCE AND ENGINEERING"],
  "COMPUTER SCIENCE & ENGINEERING": ["CSE", "COMPUTER SCIENCE", "COMPUTER SCIENCE & ENGINEERING", "COMPUTER SCIENCE AND ENGINEERING"],
  "COMPUTER SCIENCE AND ENGINEERING": ["CSE", "COMPUTER SCIENCE", "COMPUTER SCIENCE & ENGINEERING", "COMPUTER SCIENCE AND ENGINEERING"],
  "IT": ["IT", "INFORMATION TECHNOLOGY"],
  "INFORMATION TECHNOLOGY": ["IT", "INFORMATION TECHNOLOGY"],
  "ECE": ["ECE", "ELECTRONICS", "ELECTRONICS & COMMUNICATION", "ELECTRONICS AND COMMUNICATION", "ELECTRONICS & COMMUNICATION ENGINEERING"],
  "ELECTRONICS": ["ECE", "ELECTRONICS", "ELECTRONICS & COMMUNICATION", "ELECTRONICS AND COMMUNICATION"],
  "ELECTRONICS & COMMUNICATION": ["ECE", "ELECTRONICS", "ELECTRONICS & COMMUNICATION", "ELECTRONICS AND COMMUNICATION"],
  "EE": ["EE", "ELECTRICAL", "ELECTRICAL ENGINEERING"],
  "ELECTRICAL": ["EE", "ELECTRICAL", "ELECTRICAL ENGINEERING"],
  "ME": ["ME", "MECHANICAL", "MECHANICAL ENGINEERING"],
  "MECHANICAL": ["ME", "MECHANICAL", "MECHANICAL ENGINEERING"],
  "MECHANICAL ENGINEERING": ["ME", "MECHANICAL", "MECHANICAL ENGINEERING"],
  "CIVIL": ["CIVIL", "CIVIL ENGINEERING"],
  "CIVIL ENGINEERING": ["CIVIL", "CIVIL ENGINEERING"],
  "CHEM": ["CHEM", "CHEMISTRY", "CHEMICAL", "CHEMICAL ENGINEERING"],
  "CHEMISTRY": ["CHEM", "CHEMISTRY", "CHEMICAL", "CHEMICAL ENGINEERING"],
  "CHEMICAL": ["CHEM", "CHEMISTRY", "CHEMICAL", "CHEMICAL ENGINEERING"],
  "ARCH": ["ARCH", "ARCHITECTURE"],
  "ARCHITECTURE": ["ARCH", "ARCHITECTURE"],
  "BBA": ["BBA", "BUSINESS ADMINISTRATION", "MANAGEMENT"],
  "MBA": ["MBA", "BUSINESS ADMINISTRATION", "MANAGEMENT"],
  "MANAGEMENT": ["BBA", "MBA", "BUSINESS ADMINISTRATION", "MANAGEMENT"]
};

    // Branch filter (case-insensitive with alias support e.g. CSE -> Computer Science)
    if (branch) {
      const bUpper = String(branch).trim().toUpperCase();
      const validBranches = BRANCH_ALIASES[bUpper] || [bUpper];
      const branchRegexes = validBranches.map((b) => new RegExp(`^${escapeRegExp(b)}$`, "i"));

      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { branch: { $in: branchRegexes } },
          { courseName: { $in: branchRegexes } },
        ]
      });
    }

    // Semester filter
    if (semester) {
      const semNum = parseInt(String(semester).replace(/\D/g, ""), 10);
      if (!isNaN(semNum) && semNum > 0) {
        query.$and = (query.$and || []);
        query.$and.push({ $or: [{ semester: semNum }, { semester: String(semNum) }] });
      }
    }

    // Teachers can strictly only see students assigned under their subjects, slots, and sections
    if (req.user?.role === 'teacher') {
      const Timetable = require('../models/Timetable');
      const Enrollment = require('../models/Enrollment');
      const teacherUserId = toObjectId(req.user._id || req.user.id);
      const activeTenantId = toObjectId(req.user?.tenantId || req.tenantId || req.tenant?._id);

      // Parallel execution of teacher assignments, timetable slots, and enrollments
      const [teacherDoc, teacherSlots, enrolledStudents] = await Promise.all([
        User.findById(teacherUserId).select('assignedSubjects').populate('assignedSubjects.subjectId').lean(),
        Timetable.find({ teacherId: teacherUserId, tenantId: activeTenantId }).populate('subjectId').lean(),
        Enrollment.find({
          tenantId: activeTenantId,
          $or: [
            { 'subjects.teacherId': teacherUserId },
            { 'assignedTeachers.teacherId': teacherUserId },
          ],
        }).select('userId rollNo enrollmentNumber email section courseId semester branch').lean(),
      ]);

      const teacherAssignments = teacherDoc?.assignedSubjects || req.user.assignedSubjects || [];

      const enrolledUserIds = enrolledStudents
        .map((e) => e.userId?.toString())
        .filter((id) => id && mongoose.Types.ObjectId.isValid(id))
        .map((id) => toObjectId(id));

      const enrolledRollNos = enrolledStudents
        .map((e) => (e.rollNo || e.enrollmentNumber || '').trim())
        .filter(Boolean);

      // Build criteria filters from assigned subjects & timetable slots
      const criteriaList = [];
      const assignedSectionsSet = new Set();

      teacherAssignments.forEach((a) => {
        const sec = (a.section || '').trim();
        if (sec) assignedSectionsSet.add(sec.toUpperCase());
        const sub = a.subjectId;
        const crit = {};
        if (sec) crit.section = new RegExp(`^${escapeRegExp(sec)}$`, 'i');
        const courseId = sub?.courseId?._id || sub?.courseId;
        if (courseId && mongoose.Types.ObjectId.isValid(courseId)) crit.courseId = toObjectId(courseId);
        if (sub?.branch) {
          const bUpper = String(sub.branch).trim().toUpperCase();
          const validBranches = BRANCH_ALIASES[bUpper] || [bUpper];
          const bRegexes = validBranches.map((b) => new RegExp(`^${escapeRegExp(b)}$`, 'i'));
          crit.$or = crit.$or || [];
          crit.$or.push({ branch: { $in: bRegexes } }, { courseName: { $in: bRegexes } });
        }
        if (sub?.semester) {
          const semNum = parseInt(String(sub.semester).replace(/\D/g, ''), 10);
          if (!isNaN(semNum) && semNum > 0) {
            crit.$or = crit.$or || [];
            crit.$or.push({ semester: semNum }, { semester: String(semNum) });
          }
        }
        if (Object.keys(crit).length > 0) criteriaList.push(crit);
      });

      teacherSlots.forEach((slot) => {
        const sec = (slot.section || '').trim();
        if (sec) assignedSectionsSet.add(sec.toUpperCase());
        const crit = {};
        if (sec) crit.section = new RegExp(`^${escapeRegExp(sec)}$`, 'i');
        const courseId = slot.courseId?._id || slot.courseId || slot.subjectId?.courseId;
        if (courseId && mongoose.Types.ObjectId.isValid(courseId)) crit.courseId = toObjectId(courseId);
        const branchVal = slot.branch || slot.subjectId?.branch;
        if (branchVal) {
          const bUpper = String(branchVal).trim().toUpperCase();
          const validBranches = BRANCH_ALIASES[bUpper] || [bUpper];
          const bRegexes = validBranches.map((b) => new RegExp(`^${escapeRegExp(b)}$`, 'i'));
          crit.$or = crit.$or || [];
          crit.$or.push({ branch: { $in: bRegexes } }, { courseName: { $in: bRegexes } });
        }
        const semVal = slot.semester || slot.subjectId?.semester;
        if (semVal) {
          const semNum = parseInt(String(semVal).replace(/\D/g, ''), 10);
          if (!isNaN(semNum) && semNum > 0) {
            crit.$or = crit.$or || [];
            crit.$or.push({ semester: semNum }, { semester: String(semNum) });
          }
        }
        if (Object.keys(crit).length > 0) criteriaList.push(crit);
      });

      enrolledStudents.forEach((e) => {
        const sec = (e.section || '').trim();
        if (sec) assignedSectionsSet.add(sec.toUpperCase());
      });

      const assignedSections = Array.from(assignedSectionsSet);

      // If teacher has zero assignments anywhere, return empty list
      if (assignedSections.length === 0 && enrolledUserIds.length === 0 && enrolledRollNos.length === 0 && criteriaList.length === 0) {
        return res.status(200).json({ success: true, data: [], pagination: { page: 1, limit: safeLimit, total: 0, pages: 0 } });
      }

      // Filter by requested section if passed
      if (section && section !== 'all') {
        const secClean = String(section).trim().toUpperCase();
        query.section = new RegExp(`^${escapeRegExp(secClean)}$`, 'i');
      }

      // Filter by requested subject if passed
      if (subjectId && mongoose.Types.ObjectId.isValid(subjectId)) {
        const targetSub = teacherAssignments.find((a) => (a.subjectId?._id || a.subjectId)?.toString() === subjectId?.toString())?.subjectId;
        if (targetSub) {
          const cId = targetSub.courseId?._id || targetSub.courseId;
          if (cId && mongoose.Types.ObjectId.isValid(cId)) {
            query.$and = query.$and || [];
            query.$and.push({ $or: [{ courseId: toObjectId(cId) }, { courseName: new RegExp(`^${escapeRegExp(String(targetSub.courseCode || ''))}$`, 'i') }] });
          }
          if (targetSub.branch) {
            const bUpper = String(targetSub.branch).trim().toUpperCase();
            const validBranches = BRANCH_ALIASES[bUpper] || [bUpper];
            const bRegexes = validBranches.map((b) => new RegExp(`^${escapeRegExp(b)}$`, 'i'));
            query.$and = query.$and || [];
            query.$and.push({ $or: [{ branch: { $in: bRegexes } }, { courseName: { $in: bRegexes } }] });
          }
          if (targetSub.semester) {
            const semNum = parseInt(String(targetSub.semester).replace(/\D/g, ''), 10);
            if (!isNaN(semNum) && semNum > 0) {
              query.$and = query.$and || [];
              query.$and.push({ $or: [{ semester: semNum }, { semester: String(semNum) }] });
            }
          }
        }
      }

      // Build overall teacher student match condition
      const teacherOrConditions = [];
      if (enrolledUserIds.length > 0) {
        teacherOrConditions.push({ _id: { $in: enrolledUserIds } });
      }
      if (enrolledRollNos.length > 0) {
        teacherOrConditions.push({ rollNo: { $in: enrolledRollNos } });
      }
      if (criteriaList.length > 0) {
        criteriaList.forEach((c) => teacherOrConditions.push(c));
      } else if (assignedSections.length > 0) {
        teacherOrConditions.push({
          section: { $in: assignedSections.map((s) => new RegExp(`^${escapeRegExp(s)}$`, 'i')) },
        });
      }

      if (teacherOrConditions.length > 0) {
        query.$and = query.$and || [];
        query.$and.push({ $or: teacherOrConditions });
      }
    } else if (section && section !== 'all') {
      query.section = new RegExp(`^${escapeRegExp(String(section).trim())}$`, "i");
    }

    if (search) {
      const safeSearch = escapeRegExp(search);
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { name: { $regex: safeSearch, $options: 'i' } },
          { email: { $regex: safeSearch, $options: 'i' } },
          { rollNo: { $regex: safeSearch, $options: 'i' } }
        ]
      });
    }
    
    const [rawStudents, total] = await Promise.all([
      User.find(query)
        .select('-password -faceDescriptor')
        .populate('courseId', 'name code')
        .sort({ name: 1 })
        .skip(skip)
        .limit(safeLimit)
        .lean(),
      User.countDocuments(query)
    ]);

    const students = rawStudents.map((s) => {
      const hasFace = Boolean(
        s.faceRegistered ||
        s.isFaceRegistered ||
        s.faceImageUrl
      );
      return {
        ...s,
        courseName: s.courseName || s.courseId?.name || s.courseId?.code || "",
        admissionYear: s.admissionYear || null,
        faceRegistered: hasFace,
        isFaceRegistered: hasFace,
      };
    });
    
    return res.status(200).json({
      success: true,
      data: students,
      pagination: {
        page: Math.max(1, parseInt(page, 10) || 1),
        limit: safeLimit,
        total,
        pages: Math.ceil(total / safeLimit)
      }
    });
  } catch (error) {
    logger.error('Error fetching students', { error: error.message });
    return res.status(200).json({
      success: true,
      data: [],
      pagination: { page: 1, limit: 1000, total: 0, pages: 0 },
      error: error.message
    });
  }
};

/**
 * GET /api/users/students/:id
 * Get student by ID
 */
const getStudentById = async (req, res) => {
  try {
    const student = await User.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
      role: 'student'
    }).select('-password');
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      data: student
    });
  } catch (error) {
    logger.error('Error fetching student', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch student',
      error: error.message
    });
  }
};

/**
 * PUT /api/users/students/:id
 * Update student
 */
const updateStudent = async (req, res) => {
  try {
    const { name, email, section, rollNo, phone, address, parentName, parentPhone } = req.body;
    
    const student = await User.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
      role: 'student'
    });
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }
    
    if (name) student.name = name;
    if (email) student.email = email;
    if (section) student.section = section;
    if (rollNo) student.rollNo = rollNo;
    if (phone) student.phone = phone;
    if (address) student.address = address;
    if (parentName) student.parentName = parentName;
    if (parentPhone) student.parentPhone = parentPhone;
    if (req.body.parentEmail) student.parentEmail = req.body.parentEmail;
    
    await student.save();
    
    return res.status(200).json({
      success: true,
      message: 'Student updated successfully',
      data: student
    });
  } catch (error) {
    logger.error('Error updating student', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to update student',
      error: error.message
    });
  }
};

/**
 * DELETE /api/users/students/:id
 * Delete student (soft delete)
 */
const deleteStudent = async (req, res) => {
  try {
    const student = await User.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
      role: 'student'
    });
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }
    
    student.isActive = false;
    await student.save();
    
    return res.status(200).json({
      success: true,
      message: 'Student deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting student', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to delete student',
      error: error.message
    });
  }
};

// ==================== TEACHER MANAGEMENT ====================

/**
 * GET /api/users/teachers
 * Get all teachers (admin only)
 */
const getAllTeachers = async (req, res) => {
  try {
    const effectiveTenantId = req.tenantId || req.user?.tenantId;
    let query = {
      role: 'teacher',
      isActive: true
    };
    if (req.user?.role !== 'super_admin') {
      query.tenantId = effectiveTenantId;
    } else if (req.query.tenantId) {
      query.tenantId = req.query.tenantId;
    }

    const teachers = await User.find(query)
      .select('-password')
      .populate('assignedSubjects.subjectId');
    
    return res.status(200).json({
      success: true,
      data: teachers
    });
  } catch (error) {
    logger.error('Error fetching teachers', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch teachers',
      error: error.message
    });
  }
};

/**
 * GET /api/users/teachers/:id
 * Get teacher by ID
 */
const getTeacherById = async (req, res) => {
  try {
    const teacher = await User.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
      role: 'teacher'
    })
      .select('-password')
      .populate('assignedSubjects.subjectId');
    
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      data: teacher
    });
  } catch (error) {
    logger.error('Error fetching teacher', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch teacher',
      error: error.message
    });
  }
};

/**
 * PUT /api/users/teachers/:id
 * Update teacher
 */
const updateTeacher = async (req, res) => {
  try {
    const { name, email, phone, address } = req.body;
    
    const teacher = await User.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
      role: 'teacher'
    });
    
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found'
      });
    }
    
    if (name) teacher.name = name;
    if (email) teacher.email = email;
    if (phone) teacher.phone = phone;
    if (address) teacher.address = address;
    
    await teacher.save();
    
    // Invalidate user cache
    await cache.del(`user:${teacher._id}`);
    
    return res.status(200).json({
      success: true,
      message: 'Teacher updated successfully',
      data: teacher
    });
  } catch (error) {
    logger.error('Error updating teacher', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to update teacher',
      error: error.message
    });
  }
};

/**
 * DELETE /api/users/teachers/:id
 * Delete teacher (soft delete)
 */
const deleteTeacher = async (req, res) => {
  try {
    const teacher = await User.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
      role: 'teacher'
    });
    
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found'
      });
    }

    const tenantId = req.tenantId;

    // Soft delete — clean up references and mark teacher and timetables as deleted
    const Timetable = require("../models/Timetable");
    const Attendance = require("../models/Attendance");
    const Enrollment = require("../models/Enrollment");

    await Promise.all([
      Timetable.updateMany({ tenantId, teacherId: teacher._id }, { $set: { isDeleted: true, deletedAt: new Date(), isActive: false } }),
      Attendance.updateMany({ tenantId, teacherId: teacher._id }, { $set: { teacherId: null } }),
      Enrollment.updateMany(
        { tenantId, "subjects.teacherId": teacher._id },
        { $pull: { subjects: { teacherId: teacher._id } } }
      ),
    ]);

    teacher.isActive = false;
    teacher.isDeleted = true;
    teacher.deletedAt = new Date();
    await teacher.save();

    // Invalidate user and tenant cache
    await cache.del(`user:${teacher._id}`);
    await cache.del(`tenant:${tenantId}`);

    return res.status(200).json({
      success: true,
      message: 'Teacher deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting teacher', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to delete teacher',
      error: error.message
    });
  }
};

// ==================== USER STATUS MANAGEMENT ====================

const activateUser = async (req, res) => {
  try {
    const user = await User.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    user.isActive = true;
    await user.save();
    
    // Invalidate user cache
    await cache.del(`user:${user._id}`);
    
    return res.status(200).json({
      success: true,
      message: 'User activated successfully'
    });
  } catch (error) {
    logger.error('Error activating user', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to activate user',
      error: error.message
    });
  }
};

const deactivateUser = async (req, res) => {
  try {
    const user = await User.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    user.isActive = false;
    await user.save();
    
    // Invalidate user cache
    await cache.del(`user:${user._id}`);
    
    return res.status(200).json({
      success: true,
      message: 'User deactivated successfully'
    });
  } catch (error) {
    logger.error('Error deactivating user', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to deactivate user',
      error: error.message
    });
  }
};

// ==================== SEARCH ====================

const searchUsers = async (req, res) => {
  try {
    const { q, role, limit = 20 } = req.query;
    
    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }
    
    let query = {
      tenantId: req.tenantId,
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { rollNo: { $regex: q, $options: 'i' } }
      ]
    };
    
    if (role) query.role = role;
    
    const users = await User.find(query)
      .select('-password')
      .limit(parseInt(limit));
    
    return res.status(200).json({
      success: true,
      data: users,
      count: users.length
    });
  } catch (error) {
    logger.error('Error searching users', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to search users',
      error: error.message
    });
  }
};

// Placeholder for bulk operations
const bulkUploadUsers = async (req, res) => {
  res.status(501).json({ success: false, message: 'Not implemented yet' });
};

const bulkDeleteUsers = async (req, res) => {
  res.status(501).json({ success: false, message: 'Not implemented yet' });
};

const getAllAdmins = async (req, res) => {
  try {
    const effectiveTenantId = req.tenantId || req.user?.tenantId;
    let query = { role: "admin", isActive: true };
    if (req.user?.role !== "super_admin") {
      query.tenantId = effectiveTenantId;
    } else if (req.query.tenantId) {
      query.tenantId = req.query.tenantId;
    }

    const admins = await User.find(query).select("-password").lean();
    return res.status(200).json({
      success: true,
      data: admins,
    });
  } catch (error) {
    logger.error("Error fetching admins", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Failed to fetch admins",
      error: error.message,
    });
  }
};

const getAdminById = async (req, res) => {
  try {
    const effectiveTenantId = req.tenantId || req.user?.tenantId;
    let query = { _id: req.params.id, role: "admin" };
    if (req.user?.role !== "super_admin") {
      query.tenantId = effectiveTenantId;
    }

    const admin = await User.findOne(query).select("-password").lean();
    if (!admin) {
      return res.status(404).json({ success: false, message: "Admin not found" });
    }
    return res.status(200).json({ success: true, data: admin });
  } catch (error) {
    logger.error("Error fetching admin by ID", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to fetch admin" });
  }
};

/**
 * GET /api/users/:id
 * Get user by ID (scoped to tenant unless super_admin)
 */
const getUserById = async (req, res) => {
  try {
    const effectiveTenantId = req.tenantId || req.user?.tenantId;
    let query = { _id: req.params.id };
    if (req.user?.role !== "super_admin") {
      query.tenantId = effectiveTenantId;
    }

    const user = await User.findOne(query).select("-password").lean();
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    logger.error("Error fetching user by ID", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Failed to fetch user",
      error: error.message,
    });
  }
};

module.exports = {
  // Profile
  getProfile,
  updateProfile,
  uploadProfilePhoto,
  deleteProfilePhoto,
  getUserById,
  
  // Student management
  getAllStudents,
  getStudentById,
  updateStudent,
  deleteStudent,
  
  // Teacher management
  getAllTeachers,
  getTeacherById,
  updateTeacher,
  deleteTeacher,
  
  // Admin management
  getAllAdmins,
  getAdminById,
  
  // User status
  activateUser,
  deactivateUser,
  
  // Bulk operations
  bulkUploadUsers,
  bulkDeleteUsers,
  
  // Search
  searchUsers
};