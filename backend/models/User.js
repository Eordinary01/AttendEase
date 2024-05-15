const mongoose = require("mongoose");

const userSettingSchema = mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  section: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ["student", "teacher"], // Define the possible roles
    default: "student" // Set a default role
  }
});

module.exports = mongoose.model('User', userSettingSchema);
