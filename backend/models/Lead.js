const mongoose = require("mongoose");

const LeadSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["contact", "demo"],
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
  },
  institutionName: {
    type: String,
    required: true,
  },
  studentCount: {
    type: String,
  },
  status: {
    type: String,
    enum: ["new", "contacted", "converted", "closed"],
    default: "new",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Lead", LeadSchema);