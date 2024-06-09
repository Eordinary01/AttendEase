// routes/calendar.js
const express = require("express");
const router = express.Router();
const calendarController = require("../controllers/calendarController");

router.get("/", calendarController.getCalendar);
router.post("/", calendarController.createCalendar);

module.exports = router;
