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
    enum: ["student", "teacher"], 
    default: "student" 
  },
  rollNo: {
    type: String,
    required: true
  },
  attendance: {
    totalAttended: { type: Number, default: 0 },
    totalClasses: { type: Number, default: 0 },
    overallPercentage: { type: Number, default: 0 },
    absentClasses: { type: Number, default: 0 }
  }
});


module.exports = mongoose.model('User', userSettingSchema);
