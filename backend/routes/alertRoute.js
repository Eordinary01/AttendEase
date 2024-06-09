// routes/alertRoute.js
const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');

// Create an alert
router.post('/alerts', alertController.createAlert);

// Fetch alerts
router.get('/alerts', alertController.getAlerts);

module.exports = router;
