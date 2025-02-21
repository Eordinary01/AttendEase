const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subject: {
    name: { type: String, required: true },
    code: { type: String, required: true }
  },
  date: { type: Date, required: true },
  attendedClasses: { type: Number, default: 0 },
  totalClasses: { type: Number, default: 0 },
  individualPercentage: { type: Number, default: 0 },
  overallPercentage: { type: Number, default: 0 },
  status: { type: String, enum: ['absent', 'present'], default: 'absent' }
});

module.exports = mongoose.model("Attendance", attendanceSchema);
