const mongoose = require("mongoose");

const calendarSchema = new mongoose.Schema({
  title: { type: String, required: true },
  date: { type: Date, required: true },
  description: { type: String },
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  }
}, { timestamps: true });

calendarSchema.index({ tenantId: 1, date: -1 });
calendarSchema.index({ tenantId: 1, createdBy: 1 });

module.exports = mongoose.model("CalendarEvent", calendarSchema);
