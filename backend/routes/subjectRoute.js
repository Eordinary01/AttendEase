const express = require("express");
const subjectRoute = express.Router();
const { authenticateToken, adminAuth, authorizeRoles } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const { featureGuard, limitGuard } = require('../middleware/featureGuard');
const { cacheMiddleware } = require('../middleware/cache');
const validate = require('../middleware/validate');
const {
  createSubject,
  updateSubject,
  getSubjects,
} = require('../validators/subject');
const {
  createSubject: createSubjectCtrl,
  getAllSubjects,
  getSubjectById,
  getSubjectsBySemester,
  getSubjectsByCourseCode,
  updateSubject: updateSubjectCtrl,
  deactivateSubject,
  deleteSubject,
  getTeacherSubjects,
  searchSubjects,
} = require('../controllers/subjectController');
const { bulkCreateSubjects } = require('../controllers/adminController');

/**
 * SUBJECT MANAGEMENT ROUTES
 * Most routes require authentication
 * Admin-only routes require admin role
 * Subject mutation routes require the subjects:write permission
 */

// Create subject (admin or teacher with subjects:write)
subjectRoute.post('/create', authenticateToken, authorizeRoles(['admin', 'teacher']), requirePermission('subjects:write'), createSubject, createSubjectCtrl);

// Bulk create subjects (Plan gated: bulk_operations)
subjectRoute.post('/bulk', authenticateToken, authorizeRoles(['admin', 'teacher']), requirePermission('subjects:write'), featureGuard('bulk_operations'), limitGuard('subject'), bulkCreateSubjects);

// Get all subjects (Auth required) - student/teacher view
subjectRoute.get('/all', authenticateToken, cacheMiddleware('subjects', 300), getAllSubjects);
subjectRoute.get('/student/enrolled', authenticateToken, cacheMiddleware('subjects', 300), getAllSubjects);

// Get subjects assigned to a teacher (Auth required)
subjectRoute.get('/teacher/:teacherId/assignments', authenticateToken, getTeacherSubjects);

// Get subjects by semester (Auth required)
subjectRoute.get('/semester/:semester', authenticateToken, getSubjectsBySemester);

// Search subjects (Auth required)
subjectRoute.get('/search/query', authenticateToken, getSubjects, searchSubjects);

// Get subject by ID (Auth required)
subjectRoute.get('/:subjectId', authenticateToken, getSubjectById);

// Update subject (admin or teacher with subjects:write)
subjectRoute.put('/:subjectId', authenticateToken, authorizeRoles(['admin', 'teacher']), requirePermission('subjects:write'), updateSubject, updateSubjectCtrl);

// Deactivate subject (admin or teacher with subjects:write)
subjectRoute.patch('/:subjectId/deactivate', authenticateToken, authorizeRoles(['admin', 'teacher']), requirePermission('subjects:write'), deactivateSubject);

// Delete subject (admin or teacher with subjects:write)
subjectRoute.delete('/:subjectId', authenticateToken, authorizeRoles(['admin', 'teacher']), requirePermission('subjects:write'), deleteSubject);

module.exports = subjectRoute;