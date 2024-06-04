

const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  message: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 300, // 300 seconds (5 minutes) after creation
  },
});

const Alert = mongoose.model('Alert', alertSchema);

module.exports = Alert;
