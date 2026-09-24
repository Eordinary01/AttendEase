const express = require("express");
const calendarRoute = express.Router();
const { authenticateToken, adminAuth } = require("../middleware/auth");
const { featureGuard } = require("../middleware/featureGuard");
const calendarController = require("../controllers/calendarController");

// Public within tenant (Students, Teachers, Parents, Admins can view)
calendarRoute.get("/", authenticateToken, featureGuard("calendar"), calendarController.getCalendar);

// Admin-only management endpoints
calendarRoute.post("/", authenticateToken, adminAuth, featureGuard("calendar"), calendarController.createCalendar);
calendarRoute.post("/bulk", authenticateToken, adminAuth, featureGuard("calendar"), calendarController.bulkCreateCalendar);
calendarRoute.put("/:id", authenticateToken, adminAuth, featureGuard("calendar"), calendarController.updateCalendar);
calendarRoute.delete("/:id", authenticateToken, adminAuth, featureGuard("calendar"), calendarController.deleteCalendar);

module.exports = calendarRoute;