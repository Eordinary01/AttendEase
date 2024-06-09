// routes/attendance.js
const express = require("express");
const attendanceRoute = express();
const attendanceController = require("../controllers/attendanceController");

attendanceRoute.post("/", attendanceController.updateAttendance);
attendanceRoute.get("/", attendanceController.getAttendanceRecords);

module.exports = router;
