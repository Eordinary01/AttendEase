const express = require("express");
const authRoute = express.Router();
const {authenticateToken} = require('../middleware/auth');
const {
  registerStudent,
  registerTeacherFirstLogin,
  login,
  verifyToken,
  changePassword
} = require("../controllers/userController");

/**
 * STUDENT ROUTES
 */

// Student Registration with Enrollment Verification
authRoute.post('/register/student', registerStudent);

/**
 * TEACHER ROUTES
 */

// Teacher First Login (changes temp password)
authRoute.post('/register/teacher/first-login', registerTeacherFirstLogin);


// Login for all users (student, teacher, admin)
authRoute.post('/login', login);

// Verify token and get user details
authRoute.get('/verify', authenticateToken, verifyToken);

// Change password (for any logged-in user)
authRoute.post('/change-password', authenticateToken, changePassword);

module.exports = authRoute;