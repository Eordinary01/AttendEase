const express = require("express");
const router = express.Router();
const { authenticateToken, authorizeRoles } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permission");
const { featureGuard } = require("../middleware/featureGuard");
const validate = require("../middleware/validate");
const { query } = require("express-validator");
const { getAttendanceReport, exportAttendanceReport } = require("../controllers/reportsController");

const getReportValidator = [
  query('section')
    .optional()
    .isString()
    .trim()
    .withMessage('Section must be a string'),
  query('subjectId')
    .optional()
    .isMongoId()
    .withMessage('Invalid subject ID format'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date')
    .toDate(),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
    .toDate(),
];

// Attendance report (admin or teacher with reports:view)
router.get("/attendance", authenticateToken, authorizeRoles(["admin", "teacher"]), requirePermission("reports:view"), featureGuard("reports"), getReportValidator, getAttendanceReport);

// CSV export (admin or teacher with reports:export)
router.get("/attendance/export", authenticateToken, authorizeRoles(["admin", "teacher"]), requirePermission("reports:export"), featureGuard("reports"), getReportValidator, exportAttendanceReport);

module.exports = router;