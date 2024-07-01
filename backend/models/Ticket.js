const mongoose = require('mongoose');

const TicketSchema = new mongoose.Schema({
  rollNo: {
    type: String,
    required: true,
  },
  section: {
    type: String,
    required: true,
  },
  document: {
    type: String,
    required: true,
  },
  file: {
    type: String,
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  response: {
    type: String,
    default: 'Pending',
  },
});

module.exports = mongoose.model('Ticket', TicketSchema);
