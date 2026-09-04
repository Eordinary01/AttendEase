// routes/userRoute.js
const express = require("express");
const userRoute = express.Router();
const { authenticateToken, adminAuth, teacherAuth, studentAuth, authorizeRoles } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  updateProfile,
  createStudent,
  updateStudent,
  createTeacher,
  updateTeacher,
  createAdmin,
  bulkUploadUsers,
  searchUsers,
} = require('../validators/user');
const {
  // Student management
  getAllStudents,
  getStudentById,
  updateStudent: updateStudentCtrl,
  deleteStudent,
  
  // Teacher management
  getAllTeachers,
  getTeacherById,
  updateTeacher: updateTeacherCtrl,
  deleteTeacher,
  
  // Admin management
  getAllAdmins,
  getAdminById,
  
  // Profile management
  getProfile,
  updateProfile: updateProfileCtrl,
  uploadProfilePhoto,
  deleteProfilePhoto,
  getUserById,
  
  // Bulk operations
  bulkUploadUsers: bulkUploadUsersCtrl,
  bulkDeleteUsers,
  
  // User status
  activateUser,
  deactivateUser,
  
  // User search
  searchUsers: searchUsersCtrl,
} = require("../controllers/userController");

const multer = require('multer');
const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (jpeg, png, webp) are allowed'));
    }
  }
});

const { featureGuard, limitGuard } = require('../middleware/featureGuard');
const { bulkCreateTeachers } = require('../controllers/adminController');

// ==================== PROFILE ROUTES ====================

/**
 * GET /api/users/profile
 * Get current user's profile
 */
userRoute.get('/profile', authenticateToken, getProfile);

/**
 * PUT /api/users/profile
 * Update current user's profile
 */
userRoute.put('/profile', authenticateToken, updateProfile, updateProfileCtrl);

/**
 * POST /api/users/profile/photo
 * Upload current user's profile photo
 */
userRoute.post('/profile/photo', authenticateToken, photoUpload.single('photo'), uploadProfilePhoto);

/**
 * DELETE /api/users/profile/photo
 * Remove current user's profile photo
 */
userRoute.delete('/profile/photo', authenticateToken, deleteProfilePhoto);

// ==================== STUDENT MANAGEMENT (Admin only) ====================

/**
 * GET /api/users/students
 * Get all students (admin + teacher; teachers see only their assigned sections)
 */
userRoute.get('/students', authenticateToken, authorizeRoles(["admin", "teacher"]), getAllStudents);

/**
 * GET /api/users/students/:id
 * Get student by ID
 */
userRoute.get('/students/:id', authenticateToken, authorizeRoles(["admin", "teacher"]), getStudentById);

/**
 * PUT /api/users/students/:id
 * Update student
 */
userRoute.put('/students/:id', authenticateToken, adminAuth, updateStudent, updateStudentCtrl);

/**
 * DELETE /api/users/students/:id
 * Delete student
 */
userRoute.delete('/students/:id', authenticateToken, adminAuth, deleteStudent);

// ==================== TEACHER MANAGEMENT (Admin only) ====================

/**
 * GET /api/users/teachers
 * Get all teachers (admin only)
 */
userRoute.get('/teachers', authenticateToken, adminAuth, getAllTeachers);

/**
 * GET /api/users/teachers/:id
 * Get teacher by ID
 */
userRoute.get('/teachers/:id', authenticateToken, adminAuth, getTeacherById);

/**
 * PUT /api/users/teachers/:id
 * Update teacher
 */
userRoute.put('/teachers/:id', authenticateToken, adminAuth, updateTeacher, updateTeacherCtrl);

/**
 * DELETE /api/users/teachers/:id
 * Delete teacher
 */
userRoute.delete('/teachers/:id', authenticateToken, adminAuth, deleteTeacher);

// ==================== ADMIN MANAGEMENT (Super Admin only) ====================

/**
 * GET /api/users/admins
 * Get all admins (super admin only)
 */
userRoute.get('/admins', authenticateToken, adminAuth, getAllAdmins);

/**
 * GET /api/users/admins/:id
 * Get admin by ID
 */
userRoute.get('/admins/:id', authenticateToken, adminAuth, getAdminById);

// ==================== USER STATUS MANAGEMENT ====================

/**
 * POST /api/users/:id/activate
 * Activate a user (admin only)
 */
userRoute.post('/:id/activate', authenticateToken, adminAuth, activateUser);

/**
 * POST /api/users/:id/deactivate
 * Deactivate a user (admin only)
 */
userRoute.post('/:id/deactivate', authenticateToken, adminAuth, deactivateUser);

// ==================== BULK OPERATIONS ====================

/**
 * POST /api/users/bulk-upload
 * Bulk upload users via CSV (admin only)
 */
userRoute.post('/bulk-upload', authenticateToken, adminAuth, bulkUploadUsers, bulkUploadUsersCtrl);

/**
 * POST /api/users/bulk-teachers
 * Bulk upload teachers (admin only, plan gated)
 */
userRoute.post('/bulk-teachers', authenticateToken, adminAuth, featureGuard('bulk_operations'), limitGuard('teacher'), bulkCreateTeachers);

/**
 * DELETE /api/users/bulk-delete
 * Bulk delete users (admin only)
 */
userRoute.delete('/bulk-delete', authenticateToken, adminAuth, bulkDeleteUsers);

// ==================== SEARCH ====================

/**
 * GET /api/users/search
 * Search users by name, email, or roll number
 * Query: ?q=searchTerm&role=student
 */
userRoute.get('/search', authenticateToken, adminAuth, searchUsers, searchUsersCtrl);

/**
 * GET /api/users/:id
 * Get single user by ID
 */
userRoute.get('/:id', authenticateToken, getUserById);

module.exports = userRoute;