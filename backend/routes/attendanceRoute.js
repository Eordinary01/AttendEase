const express = require("express");
const attendanceRoute = express();
const attendanceController = require("../controllers/attendanceController");
const authenticateToken = require("../middleware/auth");

attendanceRoute.post("/attendance", authenticateToken, attendanceController.updateAttendance);
attendanceRoute.get("/attendance", authenticateToken, attendanceController.getAttendanceRecords);

module.exports = attendanceRoute;