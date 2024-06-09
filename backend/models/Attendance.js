const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  date: { type: Date, required: true },
  subject: { type: String, required: true },
  attended: { type: Boolean, required: true }
});

module.exports = mongoose.model("Attendance", attendanceSchema);