const express = require('express');
const router = express.Router();
const {
  authenticateToken,
  studentAuth,
  teacherAuth,
  adminAuth,
} = require('../middleware/auth');
const leaveMulter = require('../middleware/leaveMulter');
const validate = require('../middleware/validate');
const { body, param, query } = require('express-validator');
const {
  getScheduledSlotsPreview,
  createLeaveRequest,
  getStudentLeaves,
  getTeacherPendingLeaves,
  getMentorPendingLeaves,
  getSectionLeaves,
  approveOrRejectLeave,
  cancelLeave,
  reconcileLeaveAttendanceEndpoint,
  getMentorAssignments,
  createMentorAssignment,
  deleteMentorAssignment,
  exportLeavesCsv,
} = require('../controllers/leaveController');

// ============================================================================
// VALIDATORS
// ============================================================================

const createLeaveValidator = [
  body('leaveType')
    .notEmpty()
    .withMessage('Leave type is required')
    .isIn(['medical', 'od', 'on-duty', 'personal', 'bereavement', 'other'])
    .withMessage('Invalid leave type. Allowed: medical, od, on-duty, personal, bereavement, other'),
  body('fromDate')
    .notEmpty()
    .withMessage('From date is required')
    .isISO8601()
    .withMessage('From date must be a valid ISO 8601 date'),
  body('toDate')
    .notEmpty()
    .withMessage('To date is required')
    .isISO8601()
    .withMessage('To date must be a valid ISO 8601 date'),
  body('subjectId')
    .optional({ checkFalsy: true })
    .isMongoId()
    .withMessage('Invalid subject ID format'),
  body('subjectIds')
    .optional()
    .custom((val) => {
      if (Array.isArray(val) || typeof val === 'string') return true;
      throw new Error('subjectIds must be an array or JSON string');
    }),
  body('timetableId')
    .optional({ checkFalsy: true })
    .isMongoId()
    .withMessage('Invalid timetable slot ID format'),
  body('reason')
    .notEmpty()
    .withMessage('Reason summary is required')
    .isString()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Reason must be between 3 and 200 characters'),
  body('reasonDescription')
    .notEmpty()
    .withMessage('Detailed reason description is required')
    .isString()
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Reason description must be at least 10 characters'),
  body('adminOverride')
    .optional()
    .custom((val) => val === true || val === false || val === 'true' || val === 'false')
    .withMessage('adminOverride must be a boolean'),
];

const actionValidator = [
  param('id').isMongoId().withMessage('Invalid leave request ID'),
  body('action')
    .notEmpty()
    .withMessage('Action is required')
    .isIn(['approve', 'reject', 'needs-more-info', 'forward-hod', 'escalate-hod', 'forward-dean', 'escalate-dean'])
    .withMessage("Action must be 'approve', 'reject', 'needs-more-info', 'forward-hod', or 'forward-dean'"),
  body('remarks')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Remarks cannot exceed 1000 characters'),
];

const mentorAssignmentValidator = [
  body('teacherId').isMongoId().withMessage('Valid teacherId is required'),
  body('section')
    .notEmpty()
    .isString()
    .trim()
    .withMessage('Academic section is required'),
];

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /api/leaves/slots-preview
 * Check scheduled timetable slots for chosen dates, subject, and section
 */
router.get('/slots-preview', authenticateToken, getScheduledSlotsPreview);

/**
 * GET /api/leaves/export
 * Export leave register to CSV with DD/MM/YYYY dates
 */
router.get('/export', authenticateToken, exportLeavesCsv);

/**
 * POST /api/leaves
 * Create a new leave request (with up to 5 attachments via memory storage)
 */
router.post(
  '/',
  authenticateToken,
  studentAuth,
  leaveMulter.array('attachments', 5),
  createLeaveValidator,
  validate,
  createLeaveRequest
);

/**
 * GET /api/leaves/student
 * Get current student's leaves
 */
router.get('/student', authenticateToken, studentAuth, getStudentLeaves);

/**
 * GET /api/leaves/teacher/pending
 * Flow A: Get pending single-subject leave requests for subject teachers
 */
router.get('/teacher/pending', authenticateToken, teacherAuth, getTeacherPendingLeaves);

/**
 * GET /api/leaves/mentor/pending
 * Flow B: Get pending all-classes and multi-subject leaves for academic mentors
 */
router.get('/mentor/pending', authenticateToken, teacherAuth, getMentorPendingLeaves);

/**
 * GET /api/leaves/section/:section
 * Get leaves for a section or tenant (Admin/Teacher)
 */
router.get('/section/:section', authenticateToken, getSectionLeaves);

/**
 * PUT /api/leaves/:id/approve
 * Teacher / Mentor / HOD / Admin approves, rejects, or requests info
 */
router.put(
  '/:id/approve',
  authenticateToken,
  actionValidator,
  validate,
  approveOrRejectLeave
);

/**
 * POST /api/leaves/:id/cancel
 * Student, Mentor, or Admin cancels a leave request (with automated attendance revert if approved)
 */
router.post(
  '/:id/cancel',
  authenticateToken,
  param('id').isMongoId().withMessage('Invalid leave request ID'),
  validate,
  cancelLeave
);

/**
 * POST /api/leaves/:id/reconcile
 * Admin forces re-reconciliation of attendance for an approved leave
 */
router.post(
  '/:id/reconcile',
  authenticateToken,
  adminAuth,
  param('id').isMongoId().withMessage('Invalid leave request ID'),
  validate,
  reconcileLeaveAttendanceEndpoint
);

/**
 * GET /api/leaves/mentors
 * List mentor assignments (Admin/Teacher)
 */
router.get('/mentors', authenticateToken, getMentorAssignments);

/**
 * POST /api/leaves/mentors
 * Assign an academic mentor to a cohort section (Admin)
 */
router.post(
  '/mentors',
  authenticateToken,
  adminAuth,
  mentorAssignmentValidator,
  validate,
  createMentorAssignment
);

/**
 * DELETE /api/leaves/mentors/:id
 * Remove a mentor assignment (Admin)
 */
router.delete(
  '/mentors/:id',
  authenticateToken,
  adminAuth,
  param('id').isMongoId().withMessage('Invalid mentor assignment ID'),
  validate,
  deleteMentorAssignment
);

module.exports = router;
