const express = require("express");
const router = express.Router();
const User = require("../models/User");
const auth = require("../middleware/auth")

// Get users with optional section filter
router.get("/users", auth, async (req, res) => {
  try {
    // Check if section query parameter exists
    const filter = {};
    if (req.query.section) {
      filter.section = req.query.section;
    }

    // Only fetch necessary fields
    const users = await User.find(filter, 'name section rollNo');
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Error fetching users" });
  }
});

// Get specific user by ID
router.get("/users/:id", auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id, 'name section rollNo email role');
    if (!user) {
      return res.status(404).json({ message: "User not found.." });
    }
    res.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ message: "Error fetching user information" });
  }
});

module.exports = router;