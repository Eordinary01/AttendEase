// routes/attendance.js
const express = require("express");
const attendanceRoute = express();
const attendanceController = require("../controllers/attendanceController");

attendanceRoute.post("/attendance", attendanceController.updateAttendance);
attendanceRoute.get("/attendance", attendanceController.getAttendanceRecords);

module.exports = attendanceRoute;
