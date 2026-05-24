const express = require("express");
const attendanceRoute = express.Router();
const {authenticateToken} = require('../middleware/auth');
const {
  markAttendance,
  getAttendanceRecords,
  getAttendanceSummary,
  getStudentAttendanceStats,
  getAttendanceByDate,
  updateAttendanceRecord,
  deleteAttendanceRecord
} = require("../controllers/attendanceController");

/**
 * ATTENDANCE ROUTES
 * All routes require authentication
 */

// Mark attendance (Teacher only)
attendanceRoute.post('/mark', authenticateToken, markAttendance);

// Get attendance records (Student views their own)
attendanceRoute.get('/records', authenticateToken, getAttendanceRecords);

// Get attendance summary (Teacher views class summary)
attendanceRoute.get('/summary', authenticateToken, getAttendanceSummary);

// Get student attendance statistics
attendanceRoute.get('/stats', authenticateToken, getStudentAttendanceStats);

// Get attendance for a specific date
attendanceRoute.get('/by-date', authenticateToken, getAttendanceByDate);

// Update attendance record (Teacher only)
attendanceRoute.put('/:attendanceId', authenticateToken, updateAttendanceRecord);

// Delete attendance record (Teacher only)
attendanceRoute.delete('/:attendanceId', authenticateToken, deleteAttendanceRecord);

module.exports = attendanceRoute;