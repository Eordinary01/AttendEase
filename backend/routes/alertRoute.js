// Add this to your Express server

const express = require('express');
const router = express.Router();
const Alert = require('../models/Alert'); // Your Alert model

// Create an alert
router.post('/alerts', async (req, res) => {
  try {
    const { message } = req.body;
    const newAlert = new Alert({ message });
    await newAlert.save();
    res.status(201).json(newAlert);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create alert' });
  }
});

// Fetch alerts
router.get('/alerts', async (req, res) => {
  try {
    const alerts = await Alert.find();
    res.status(200).json(alerts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

module.exports = router;
