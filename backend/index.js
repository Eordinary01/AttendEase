const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/attendease_backend');
const express = require('express');
const app = express();
const cors = require('cors');

//Middleware 
app.use(express.json());

app.use(cors({
    origin: 'http://localhost:3000',  // Allow requests from localhost:3000
    methods: ['GET', 'POST', 'PUT', 'DELETE'],  // Allow these methods
    allowedHeaders: ['Content-Type', 'Authorization'],  // Allow these headers
  }));


// for user routes
const userRoute = require("./routes/userRoute");
app.use("/api",userRoute);

// for ticket routes
const ticketRoute = require("./routes/ticketRoute");
app.use("/api",ticketRoute);




const PORT = 8011;
app.listen(PORT,function(){
    console.log("Backend connected and running at "+PORT);
})