const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');

// Connect to MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/attendease_backend', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const app = express();
app.use(express.json());

// Define CORS options
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (['http://127.0.0.1:3000', 'http://localhost:3000'].indexOf(origin) === -1) {
      return callback(new Error('Not allowed by CORS'));
    }
    return callback(null, true);
  },
  optionsSuccessStatus: 200
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Enable pre-flight requests for all routes
app.options('*', cors(corsOptions));

// Debugging middleware to log the origin of requests
app.use((req, res, next) => {
  // console.log('Request Origin:', req.headers.origin);
  next();
});

// Import and use routes
const userRoute = require("./routes/userRoute");
app.use("/api", userRoute);

const ticketRoute = require("./routes/ticketRoute");
app.use("/api", ticketRoute);

// Start the server
const PORT = 8011;
app.listen(PORT, function() {
  console.log("Backend connected and running at " + PORT);
});
