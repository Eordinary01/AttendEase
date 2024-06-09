// routes/calendar.js
const express = require("express");
const calendarRoute = express.Router();
const calendarController = require("../controllers/calendarController");

calendarRoute.get("/", calendarController.getCalendar);
calendarRoute.post("/", calendarController.createCalendar);

module.exports = router;
