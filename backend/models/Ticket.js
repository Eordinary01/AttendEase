const mongoose = require("mongoose");

const ticketSchema = mongoose.Schema({

    rollNo: {
        type: String,
        required: true
      },
      
      section: {
        type: String,
        required: true
      },
      document: {
        type: String,
        required: true
      }

});

module.exports = mongoose.model('Ticket', ticketSchema);