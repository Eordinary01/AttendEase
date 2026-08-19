const express = require("express");
const router = express.Router();
const { authenticateToken, parentAuth } = require("../middleware/auth");
const { featureGuard } = require("../middleware/featureGuard");
const {
  getDashboard,
  getAttendanceRecords,
  getAttendanceStats,
  getSubjects,
  getAlerts,
  getTeachers,
  getProfile,
} = require("../controllers/parentController");

router.use(authenticateToken);
router.use(parentAuth);
router.use(featureGuard("parent_portal"));

router.get("/dashboard", getDashboard);
router.get("/attendance/records", getAttendanceRecords);
router.get("/attendance/stats", getAttendanceStats);
router.get("/subjects", getSubjects);
router.get("/alerts", getAlerts);
router.get("/teachers", getTeachers);
router.get("/profile", getProfile);

module.exports = router;