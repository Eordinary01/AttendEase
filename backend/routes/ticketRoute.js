const express = require("express");
const { createTicket } = require("../controllers/ticketController");

const ticketRoute = express.Router();

// Route for creating a new ticket
ticketRoute.post("/tickets", createTicket);

module.exports = ticketRoute;
