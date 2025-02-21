const express = require("express");
const user_route= express();
const authenticateToken = require('../middleware/auth');




const{register,login,verifyToken} =  require("../controllers/userController")

user_route.post('/register',register);
user_route.post('/login',login);

user_route.get('/verify',authenticateToken,verifyToken );

module.exports = user_route;