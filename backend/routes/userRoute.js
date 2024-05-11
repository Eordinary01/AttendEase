const express = require("express");
const user_route= express();




const{register,login} =  require("../controllers/userController")

user_route.post('/register',register);
user_route.post('/login',login);

module.exports = user_route;