// routes/ticketRoute.js
const express = require('express');
const router = express.Router();
const { authenticateToken, teacherAuth, studentAuth, adminAuth } = require('../middleware/auth');
const upload = require('../middleware/multer');
const validate = require("../middleware/validate");
const { body, param } = require("express-validator");
const {
  getStudentSubjectsAndTeachers,
  createAbsenceProofTicket,
  getPendingAbsenceTickets,
  verifyAbsenceProof,
  markAttendanceAfterVerification,
  getStudentAbsenceTickets,
  addVerificationNote,
  getVerificationStats,
  getUploadedFile,
  getTicketDetails
} = require('../controllers/ticketController');

const createTicketValidator = [
  body('subjectId')
    .notEmpty()
    .withMessage('Subject ID is required')
    .isMongoId()
    .withMessage('Invalid subject ID format'),
  body('teacherId')
    .notEmpty()
    .withMessage('Teacher ID is required')
    .isMongoId()
    .withMessage('Invalid teacher ID format'),
  body('absentDate')
    .notEmpty()
    .withMessage('Absent date is required')
    .isISO8601()
    .withMessage('Absent date must be a valid ISO 8601 date')
    .toDate(),
  body('reason')
    .notEmpty()
    .withMessage('Reason is required')
    .isIn(['medical', 'family', 'family-emergency', 'personal', 'academic', 'institutional-work', 'other'])
    .withMessage('Reason must be one of: medical, family, family-emergency, personal, academic, institutional-work, other'),
  body('reasonDescription')
    .optional()
    .isString()
    .trim()
    .withMessage('Reason description must be a string'),
];

const verifyTicketValidator = [
  param('ticketId')
    .notEmpty()
    .withMessage('Ticket ID is required')
    .isMongoId()
    .withMessage('Invalid ticket ID format'),
  body('verificationStatus')
    .notEmpty()
    .withMessage('Verification status is required')
    .isIn(['verified', 'rejected', 'needs-more-info', 'approved'])
    .withMessage('Verification status must be verified, rejected, or needs-more-info'),
  body('verificationRemarks')
    .optional()
    .isString()
    .trim()
    .withMessage('Verification remarks must be a string'),
];

const addNoteValidator = [
  param('ticketId')
    .notEmpty()
    .withMessage('Ticket ID is required')
    .isMongoId()
    .withMessage('Invalid ticket ID format'),
  body('content')
    .notEmpty()
    .withMessage('Note content is required')
    .isString()
    .trim()
    .withMessage('Note content must be a string'),
];

const getTicketValidator = [
  param('ticketId')
    .notEmpty()
    .withMessage('Ticket ID is required')
    .isMongoId()
    .withMessage('Invalid ticket ID format'),
];

const getFileValidator = [
  param('ticketId')
    .notEmpty()
    .withMessage('Ticket ID is required')
    .isMongoId()
    .withMessage('Invalid ticket ID format'),
  param('fileId')
    .notEmpty()
    .withMessage('File ID is required')
    .isMongoId()
    .withMessage('Invalid file ID format'),
];

// ==================== STUDENT ROUTES ====================

/**
 * GET /api/tickets/student/subjects-teachers
 * Get subjects and corresponding assigned teachers for the student
 */
router.get('/student/subjects-teachers',
  authenticateToken,
  studentAuth,
  getStudentSubjectsAndTeachers
);

/**
 * POST /api/tickets/
 * Create a new absence proof ticket
 * Body: { subjectId, teacherId, absentDate, reason, reasonDescription } + files
 */
router.post('/',
  authenticateToken,
  studentAuth,
  upload.array('files', 5),
  createTicketValidator,
  createAbsenceProofTicket
);

/**
 * GET /api/tickets/student
 * GET /api/tickets/my-tickets
 * Get student's own tickets
 */
router.get('/student',
  authenticateToken,
  studentAuth,
  getStudentAbsenceTickets
);

router.get('/my-tickets',
  authenticateToken,
  studentAuth,
  getStudentAbsenceTickets
);

// ==================== TEACHER ROUTES ====================

/**
 * GET /api/tickets/teacher/pending
 * Get pending tickets for teacher's subjects
 */
router.get('/teacher/pending',
  authenticateToken,
  teacherAuth,
  getPendingAbsenceTickets
);

/**
 * PUT /api/tickets/:ticketId/verify
 * Verify a ticket (approve/reject)
 * Body: { verificationStatus, verificationRemarks }
 */
router.put('/:ticketId/verify',
  authenticateToken,
  teacherAuth,
  verifyTicketValidator,
  verifyAbsenceProof
);

/**
 * POST /api/tickets/:ticketId/mark-attendance
 * Mark attendance after verification
 */
router.post('/:ticketId/mark-attendance',
  authenticateToken,
  teacherAuth,
  getTicketValidator,
  markAttendanceAfterVerification
);

/**
 * POST /api/tickets/:ticketId/notes
 * Add verification notes
 * Body: { content }
 */
router.post('/:ticketId/notes',
  authenticateToken,
  teacherAuth,
  addNoteValidator,
  addVerificationNote
);

/**
 * GET /api/tickets/teacher/stats
 * Get teacher's verification statistics
 */
router.get('/teacher/stats',
  authenticateToken,
  teacherAuth,
  getVerificationStats
);

// ==================== SHARED ROUTES ====================
// Accessible by multiple roles

/**
 * GET /api/tickets/:ticketId
 * Get ticket details (student own, teacher assigned, admin any)
 */
router.get('/:ticketId',
  authenticateToken,
  getTicketValidator,
  getTicketDetails
);

/**
 * GET /api/tickets/:ticketId/files/:fileId
 * Download uploaded file (with permission check)
 */
router.get('/:ticketId/files/:fileId',
  authenticateToken,
  getFileValidator,
  getUploadedFile
);

module.exports = router;