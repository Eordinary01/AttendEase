const mongoose = require("mongoose");

const calendarSchema = new mongoose.Schema({
  title: { type: String, required: true },
  date: { type: Date, required: true },
  description: { type: String }
});

module.exports = mongoose.model("CalendarEvent", calendarSchema);