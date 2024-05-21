const Ticket = require("../models/Ticket");
const jwt = require('jsonwebtoken');
const User = require("../models/User");
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

// Function to create a ticket
const createTicket = async (req, res) => {
  const { document } = req.body; // Only 'document' is passed in body
  const tokenString = req.headers.authorization;
  const token = tokenString && tokenString.split(' ')[1];

  try {
    // Verify the token and extract user information
    const decoded = jwt.verify(token, JWT_SECRET);

    // Find the user details using the userId from the token
    const User = require('../models/User'); // Import your User model
    const user = await User.findById(decoded.userId);

    const newTicket = new Ticket({
      rollNo: user.rollNo, // Use the logged-in user's rollNo
      section: user.section, // Use the logged-in user's section
      document,
      userId: user._id, // User ID from the decoded token
    });

    await newTicket.save();

    res.status(201).json({ message: "Ticket created successfully", ticket: newTicket });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ message: 'Invalid token' });
    }
    console.error("Error creating ticket:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};
const getTickets = async (req, res) => {
  const tokenString = req.headers.authorization;
  const token = tokenString && tokenString.split(' ')[1];

  try {
    // Verify the token and extract user information
    const decoded = jwt.verify(token, JWT_SECRET);

    // Check if the user is a teacher
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let tickets;
    if (user.role === 'teacher') {
      // Fetch all tickets for teachers
      tickets = await Ticket.find();
    } else {
      // Fetch only the logged-in user's tickets
      tickets = await Ticket.find({ userId: decoded.userId });
    }

    res.status(200).json(tickets);
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ message: 'Invalid token' });
    }
    console.error("Error fetching tickets:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};



// Approve ticket function
const approveTicket = async (req, res) => {
  const { ticketId } = req.params;

  try {
    // Update the ticket response to 'Approved'
    const updatedTicket = await Ticket.findByIdAndUpdate(
      ticketId,
      { response: 'Approved' },
      { new: true }
    );

    if (!updatedTicket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    res.status(200).json({ message: 'Ticket approved', ticket: updatedTicket });
  } catch (error) {
    console.error('Error approving ticket:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

// Reject ticket function
const rejectTicket = async (req, res) => {
  const { ticketId } = req.params;

  try {
    // Update the ticket response to 'Rejected'
    const updatedTicket = await Ticket.findByIdAndUpdate(
      ticketId,
      { response: 'Rejected' },
      { new: true }
    );

    if (!updatedTicket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    res.status(200).json({ message: 'Ticket rejected', ticket: updatedTicket });
  } catch (error) {
    console.error("Error rejecting ticket:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

module.exports = {
  createTicket,
  getTickets,
  approveTicket,
  rejectTicket,
};
