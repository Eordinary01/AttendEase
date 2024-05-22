const express = require("express");
const { createTicket, getTickets, approveTicket, rejectTicket } = require("../controllers/ticketController");
const authenticateToken = require("../middleware/auth");
// const userAuth = require("../middleware/userAuth");

const ticketRoute = express.Router();

// Route for creating a new ticket (no authentication required)
ticketRoute.post("/tickets", createTicket);

// Route for getting all tickets (requires authentication)
ticketRoute.get("/tickets", authenticateToken, getTickets);

// Route for approving a ticket (requires authentication)
ticketRoute.put("/tickets/:ticketId/approve", authenticateToken, approveTicket);

// Route for rejecting a ticket (requires authentication)
ticketRoute.put("/tickets/:ticketId/reject", authenticateToken, rejectTicket);

module.exports = ticketRoute;