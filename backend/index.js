const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');

// Connect to MongoDB
mongoose.connect('mongodb+srv://parthmanocha2901:nM1f3T9HLQItVAqQ@cluster0.ecvzxuo.mongodb.net/attend_backend?retryWrites=true&w=majority&appName=Cluster0', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const app = express();
app.use(express.json());

app.get("/",(req,res)=>{
  res.json({message:"Hello Dev!!Hi"});
});

// Define CORS options
// const corsOptions = {
//   origin: (origin, callback) => {
//     // Allow requests with no origin (like mobile apps or curl requests)
//     if (!origin) return callback(null, true);
//     if (['http://127.0.0.1:3000', 'http://localhost:3000','https://attendease-gajo.onrender.com/'].indexOf(origin) === -1) {
//       return callback(new Error('Not allowed by CORS'));
//     }
//     return callback(null, true);
//   },
//   optionsSuccessStatus: 200
// };

// // Apply CORS middleware before defining any routes
// app.use(cors(corsOptions));

// // Enable pre-flight requests for all routes
// app.options('*', cors(corsOptions));

// // Debugging middleware to log the origin of requests
// app.use((req, res, next) => {
//   console.log('Request Origin:', req.headers.origin);
//   next();
// });

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, DELETE, PATCH"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});



// Define CORS options
const corsOptions = {
  origin: ['http://127.0.0.1:3000', 'http://localhost:3000', 'https://attend-ease-f.vercel.app', 'https://attendease-gajo.onrender.com,http://127.0.0.1:8011/'],
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
  credentials: true,
  optionsSuccessStatus: 204
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Enable pre-flight requests for all routes
app.options('*', cors(corsOptions));

// Debugging middleware to log the origin of requests
app.use((req, res, next) => {
  console.log('Request Origin:', req.headers.origin);
  next();
});

// Import and use routes
const userRoute = require("./routes/userRoute");
app.use("/api", userRoute);

const ticketRoute = require("./routes/ticketRoute");
app.use("/api", ticketRoute);
const alertRoute = require("./routes/alertRoute");
app.use("/api",alertRoute);

const attendanceRoute = require("./routes/attendanceRoute");
app.use("/api",attendanceRoute);

const calendarRoute = require("./routes/calendarRoute");
app.use("/api",calendarRoute);
const allUser = require("./routes/user");
app.use("/api",allUser);
// Start the server
const PORT = 8011;
app.listen(PORT, function() {
  console.log("Backend connected and running at " + PORT);
});
