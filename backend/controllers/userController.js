// controllers/userController.js (Add these functions)
const User = require("../models/User");
const Tenant = require("../models/Tenant");
const logger = require("../utils/logger");
const { escapeRegExp } = require("../utils/sanitize");
const cache = require("../middleware/cache");

// ==================== PROFILE MANAGEMENT ====================

/**
 * GET /api/users/profile
 * Get current user's profile
 */
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('assignedSubjects.subjectId');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
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

// ==================== STUDENT MANAGEMENT ====================

/**
 * GET /api/users/students
 * Get all students (admin only)
 */
const getAllStudents = async (req, res) => {
  try {
    const { page = 1, limit = 50, section, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
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

    // Teachers can only see students in their assigned sections
    if (req.user?.role === 'teacher') {
      const assignedSections = [...new Set((req.user.assignedSubjects || []).map(a => a.section).filter(Boolean))];
      if (assignedSections.length > 0) {
        const allowed = section ? assignedSections.filter(s => s === section) : assignedSections;
        if (allowed.length === 0) {
          return res.status(200).json({ success: true, data: [], pagination: { page: 1, limit, total: 0, pages: 0 } });
        }
        query.section = allowed.length === 1 ? allowed[0] : { $in: allowed };
      } else {
        return res.status(200).json({ success: true, data: [], pagination: { page: 1, limit, total: 0, pages: 0 } });
      }
    } else if (section) {
      query.section = section;
    }
    if (search) {
      const safeSearch = escapeRegExp(search);
      query.$or = [
        { name: { $regex: safeSearch, $options: 'i' } },
        { email: { $regex: safeSearch, $options: 'i' } },
        { rollNo: { $regex: safeSearch, $options: 'i' } }
      ];
    }
    
    const [students, total] = await Promise.all([
      User.find(query)
        .select('-password')
        .sort({ name: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(query)
    ]);
    
    return res.status(200).json({
      success: true,
      data: students,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Error fetching students', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch students',
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

module.exports = {
  // Profile
  getProfile,
  updateProfile,
  
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