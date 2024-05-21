const jwt = require('jsonwebtoken');

// Replace this with your actual User model
const User = require('../models/User');

// Replace this with your JWT secret key
const JWT_SECRET = process.env.JWT_SECRET;

const authenticateToken = async (req, res, next) => {
  try {
    // Get the token from the Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      // Return a 401 Unauthorized error if no token is provided
      return res.status(401).json({ message: 'Authorization token missing' });
    }

    // Verify the token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Find the user associated with the token
    const user = await User.findById(decoded.userId);

    if (!user) {
      // Return a 403 Forbidden error if the user is not found
      return res.status(403).json({ message: 'Invalid token' });
    }

    // Add the user object to the request object
    req.user = user;

    // Proceed to the next middleware or route handler
    next();
  } catch (error) {
    console.error('Error authenticating token:', error);
    res.status(403).json({ message: 'Invalid token' });
  }
};

module.exports = authenticateToken;