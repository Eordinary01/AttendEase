// routes/attendance.js
const express = require("express");
const router = express.Router();
const attendanceController = require("../controllers/attendanceController");

router.post("/", attendanceController.updateAttendance);
router.get("/", attendanceController.getAttendanceRecords);

module.exports = router;
