const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/attendance_dev', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ MongoDB Connected');
}).catch(err => {
  console.error('❌ MongoDB Connection Error:', err.message);
});

const app = express();

// Basic security for development
app.disable('x-powered-by'); // Hide Express version

// Increase JSON limit for file uploads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS Configuration - Allow all in development
app.use(cors({
  origin: '*', // Allow all origins in development
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Request logging for development
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({ 
    message: "Attendance Management API - Development",
    version: "1.0.0",
    status: "running",
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      users: "/api/users",
      tickets: "/api/tickets",
      attendance: "/api/attendance",
      subjects: "/api/subjects",
      alerts: "/api/alerts",
      calendar: "/api/calendar"
    },
    docs: "Check README.md for API documentation"
  });
});

// Import and use routes
const userRoute = require("./routes/userRoute");
const adminRoute = require("./routes/adminRoute");
const ticketRoute = require("./routes/ticketRoute");
const alertRoute = require("./routes/alertRoute");
const attendanceRoute = require("./routes/attendanceRoute");
const calendarRoute = require("./routes/calendarRoute");
const allUser = require("./routes/user");
const subjectRoute = require("./routes/subjectRoute");

// Apply routes
app.use("/api", userRoute);
app.use("/api/admin", adminRoute);
app.use("/api/tickets", ticketRoute);
app.use("/api/alerts", alertRoute);
app.use("/api/attendance", attendanceRoute);
app.use("/api/calendar", calendarRoute);
app.use("/api/users", allUser);
app.use("/api/subjects", subjectRoute);

// Simple error handler for development
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  
  res.status(err.status || 500).json({
    error: 'Error',
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Start the server
const PORT = process.env.PORT || 8011;
app.listen(PORT, () => {
  console.log(`🚀 Development Server running on port ${PORT}`);
  console.log(`📁 http://localhost:${PORT}`);
  console.log(`📁 http://127.0.0.1:${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});