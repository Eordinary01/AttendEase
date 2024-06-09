// controllers/alertController.js
const Alert = require('../models/Alert');

// Create an alert
const createAlert = async (req, res) => {
  try {
    const { message } = req.body;
    const newAlert = new Alert({ message });
    await newAlert.save();
    res.status(201).json(newAlert);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create alert' });
  }
};

// Fetch alerts
 const getAlerts = async (req, res) => {
  try {
    const alerts = await Alert.find();
    res.status(200).json(alerts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
};

module.exports = {
    createAlert,
    getAlerts

}
