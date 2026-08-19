const express = require("express");
const calendarRoute = express.Router();
const { authenticateToken, adminAuth } = require("../middleware/auth");
const { featureGuard } = require("../middleware/featureGuard");
const validate = require("../middleware/validate");
const { body, query } = require("express-validator");
const calendarController = require("../controllers/calendarController");

const createCalendar = [
  body('title')
    .notEmpty()
    .withMessage('Title is required')
    .isString()
    .trim()
    .withMessage('Title must be a string'),
  body('startDate')
    .notEmpty()
    .withMessage('Start date is required')
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date')
    .toDate(),
  body('endDate')
    .notEmpty()
    .withMessage('End date is required')
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
    .toDate(),
  body('description')
    .optional()
    .isString()
    .trim()
    .withMessage('Description must be a string'),
  body('type')
    .optional()
    .isIn(['event', 'holiday', 'exam', 'meeting', 'deadline'])
    .withMessage('Type must be one of: event, holiday, exam, meeting, deadline'),
];

const getCalendar = [
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
  query('type')
    .optional()
    .isIn(['event', 'holiday', 'exam', 'meeting', 'deadline'])
    .withMessage('Type must be one of: event, holiday, exam, meeting, deadline'),
];

calendarRoute.get("/", authenticateToken, featureGuard("calendar"), getCalendar, calendarController.getCalendar);
calendarRoute.post("/", authenticateToken, adminAuth, featureGuard("calendar"), createCalendar, calendarController.createCalendar);

module.exports = calendarRoute;