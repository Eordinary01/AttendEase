const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/attendease_backend');
const express = require('express');
const app = express();
const cors = require('cors');

//Middleware 
app.use(express.json());

app.use(cors({
    origin:"*"

}));

const authRoutes = require('./routes/auth');
const requestRoutes = require('./routes/requests');
const userRoutes = require('./routes/users');

app.use('/api/auth', authRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/users', userRoutes);




const PORT = 8011;
app.listen(PORT,function(){
    console.log("Backend connected and running at "+PORT);
})