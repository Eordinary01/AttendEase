const express = require("express");
const { createTicket, getTickets } = require("../controllers/ticketController");

const ticketRoute = express.Router();

// Route for creating a new ticket
ticketRoute.post("/tickets", createTicket);
ticketRoute.get("/tickets",getTickets)

module.exports = ticketRoute;
