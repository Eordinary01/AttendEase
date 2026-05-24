const express = require('express');
const router = express.Router();
const {authenticateToken} = require('../middleware/auth');
const checkRole = require('../middleware/checkRole');
const upload = require('../middleware/multer');

const {
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

// Student routes
router.post('/',
  authenticateToken,
  checkRole('student'),
  upload.array('files', 5),
  createAbsenceProofTicket
);

router.get('/student',
  authenticateToken,
  checkRole('student'),
  getStudentAbsenceTickets
);

// Teacher routes
router.get('/teacher/pending',
  authenticateToken,
  checkRole('teacher'),
  getPendingAbsenceTickets
);

router.put('/:ticketId/verify',
  authenticateToken,
  checkRole('teacher'),
  verifyAbsenceProof
);

router.post('/:ticketId/mark-attendance',
  authenticateToken,
  checkRole('teacher'),
  markAttendanceAfterVerification
);

router.post('/:ticketId/notes',
  authenticateToken,
  checkRole('teacher'),
  addVerificationNote
);

router.get('/teacher/stats',
  authenticateToken,
  checkRole('teacher'),
  getVerificationStats
);

// Shared routes
router.get('/:ticketId',
  authenticateToken,
  checkRole('student', 'teacher', 'admin'),
  getTicketDetails
);

router.get('/:ticketId/files/:fileId',
  authenticateToken,
  checkRole('student', 'teacher', 'admin'),
  getUploadedFile
);

module.exports = router;