const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    email:{type:String,required:true,unique:true},
    password:{type:String,required:true,unique:true},
    role:{type:String,enum:['student','teacher'],required:true},
});

const User = mongoose.model('User',userSchema);

module.exports = User;