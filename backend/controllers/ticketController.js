const Ticket = require('../models/Ticket');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const upload = require('../middleware/multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

// Function to create a ticket
const createTicket = async (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: err });
    }

    const { document } = req.body;
    const tokenString = req.headers.authorization;
    const token = tokenString && tokenString.split(' ')[1];

    try {
      // Verify the token and extract user information
      const decoded = jwt.verify(token, JWT_SECRET);

      // Find the user details using the userId from the token
      const user = await User.findById(decoded.userId);

      // Extract the file filename from the uploaded file
      const file = req.file ? req.file.filename : null;

      const newTicket = new Ticket({
        rollNo: user.rollNo, // Use the logged-in user's rollNo
        section: user.section, // Use the logged-in user's section
        document,
        file,
        userId: user._id, // User ID from the decoded token
      });

      await newTicket.save();

      res.status(201).json({ message: 'Ticket created successfully', ticket: newTicket });
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({ message: 'Invalid token' });
      }
      console.error('Error creating ticket:', error);
      res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  });
};

// Function to get tickets
const getTickets = async (req, res) => {
  const tokenString = req.headers.authorization;
  const token = tokenString && tokenString.split(" ")[1];

  try {
    // Verify the token and extract user information
    const decoded = jwt.verify(token, JWT_SECRET);

    // Check if the user is a teacher
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let tickets;
    if (user.role === "teacher") {
      // Fetch all tickets for teachers
      tickets = await Ticket.find();
    } else {
      // Fetch only the logged-in user's tickets
      tickets = await Ticket.find({ userId: decoded.userId });
    }

    res.status(200).json(tickets);
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ message: "Invalid token" });
    }
    console.error("Error fetching tickets:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

// Function to approve ticket
const approveTicket = async (req, res) => {
  const { ticketId } = req.params;

  try {
    // Update the ticket response to 'Approved'
    const updatedTicket = await Ticket.findByIdAndUpdate(
      ticketId,
      { response: "Approved" },
      { new: true }
    );

    if (!updatedTicket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    res.status(200).json({ message: "Ticket approved", ticket: updatedTicket });
  } catch (error) {
    console.error("Error approving ticket:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

// Function to reject ticket
const rejectTicket = async (req, res) => {
  const { ticketId } = req.params;

  try {
    // Update the ticket response to 'Rejected'
    const updatedTicket = await Ticket.findByIdAndUpdate(
      ticketId,
      { response: "Rejected" },
      { new: true }
    );

    if (!updatedTicket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    res.status(200).json({ message: "Ticket rejected", ticket: updatedTicket });
  } catch (error) {
    console.error("Error rejecting ticket:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

const getUploadedFile = async (req, res) => {
  const { ticketId } = req.params;
  const userId = req.user.id; // Assuming the authenticateToken middleware adds user info to req

  try {
    const ticket = await Ticket.findById(ticketId);

    if (!ticket || !ticket.file) {
      return res.status(404).json({ message: "Ticket not found or file not uploaded" });
    }

    // Check if the user is authorized to access this file
    if (ticket.userId.toString() !== userId && req.user.role !== 'teacher') {
      return res.status(403).json({ message: "Unauthorized access to this file" });
    }

    // Construct the file path
    const filePath = path.join(__dirname, '..', 'uploads', ticket.file);

    // Check if the file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found" });
    }

    // Stream the file for download
    res.sendFile(filePath);
  } catch (error) {
    console.error("Error fetching uploaded file:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

module.exports = {
  createTicket,
  getTickets,
  approveTicket,
  rejectTicket,
  getUploadedFile
};
