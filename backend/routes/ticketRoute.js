const express = require('express');
const { createTicket, getTickets, approveTicket, rejectTicket,getUploadedFile } = require('../controllers/ticketController');
const authenticateToken = require('../middleware/auth');

const ticketRoute = express.Router();



// Route for creating a new ticket (requires authentication)
ticketRoute.post('/tickets', authenticateToken, createTicket);

// Route for getting all tickets (requires authentication)
ticketRoute.get('/tickets', authenticateToken, getTickets);

// Route for approving a ticket (requires authentication)
ticketRoute.put('/tickets/:ticketId/approve', authenticateToken, approveTicket);

// Route for rejecting a ticket (requires authentication)
ticketRoute.put('/tickets/:ticketId/reject', authenticateToken, rejectTicket);
    
ticketRoute.get('/tickets/:ticketId/file', authenticateToken,getUploadedFile);


module.exports = ticketRoute;
