const express = require("express");
const subjectRoute = express.Router();
const {authenticateToken, adminAuth} = require('../middleware/auth');
const {
  createSubject,
  getAllSubjects,
  getSubjectById,
  getSubjectsBySemester,
  getSubjectsByCourseCode,
  updateSubject,
  deactivateSubject,
  deleteSubject,
  getTeacherSubjects,
  searchSubjects
} = require("../controllers/subjectController");

/**
 * SUBJECT MANAGEMENT ROUTES
 * Most routes require authentication
 * Admin-only routes require admin role
 */

// Create subject (Admin only) - KEEP THIS as the single source
subjectRoute.post('/create', authenticateToken, adminAuth, createSubject);

// Get all subjects (Auth required) - student/teacher view
subjectRoute.get('/all', authenticateToken, getAllSubjects);

// Get subject by ID (Auth required)
subjectRoute.get('/:subjectId', authenticateToken, getSubjectById);

// Get subjects by semester (Auth required)
subjectRoute.get('/semester/:semester', authenticateToken, getSubjectsBySemester);

// Get subjects by course code (Auth required)
// subjectRoute.get('/course/:courseCode', authenticateToken, getSubjectsByCourseCode);

// Update subject (Admin only)
// subjectRoute.put('/:subjectId', authenticateToken, adminAuth, updateSubject);

// Deactivate subject (Admin only)
// subjectRoute.patch('/:subjectId/deactivate', authenticateToken, adminAuth, deactivateSubject);

// Delete subject (Admin only)
// subjectRoute.delete('/:subjectId', authenticateToken, adminAuth, deleteSubject);

// Get subjects assigned to a teacher (Auth required)
subjectRoute.get('/teacher/:teacherId/assignments', authenticateToken, getTeacherSubjects);

// Search subjects (Auth required)
subjectRoute.get('/search/query', authenticateToken, searchSubjects);

module.exports = subjectRoute;