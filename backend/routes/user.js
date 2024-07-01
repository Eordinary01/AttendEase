const express = require("express");
const router = express.Router();
const User = require("../models/User");

router.get("/users", async (req, res) => {
  try {
    const users = await User.find({}, 'name section rollNo'); // Only fetch necessary fields
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Error fetching users" });
  }
});

router.get("/users/:id", async (req,res)=>{
  try {

    const user = await User.findById(req.params.id,'name section rollNo email role');
    if(!user){
      return res.status(404).json({message:"User not found.."})
    }
    res.json(user);
    
  } catch (error) {
    res.status(500).json({message:"Error fetching user information"})
    
  }
})

module.exports = router;
