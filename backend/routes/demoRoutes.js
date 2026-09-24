const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { claimDemo, releaseDemo, getDemoStatus } = require('../controllers/demoController');

// Rate limiter for claim attempts (prevents brute-force claim spamming)
const claimLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: { success: false, message: 'Too many demo requests. Please slow down.' },
});

router.post('/claim', claimLimiter, claimDemo);
router.post('/release', releaseDemo);
router.get('/status', getDemoStatus);

module.exports = router;
