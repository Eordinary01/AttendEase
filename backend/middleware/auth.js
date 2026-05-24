const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * AUTHENTICATE TOKEN
 * Verifies JWT token and attaches full user object to request
 * This middleware already looks up user from database ✓
 */
const authenticateToken = async (req, res, next) => {
  try {
    // Get the token from the Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    // console.log('🔐 Auth Middleware - Token received:', token ? 'Yes' : 'No');
    
    if (!token) {
      console.log('❌ No token provided');
      return res.status(401).json({ message: 'Authorization token missing' });
    }

    // Verify the token
    const decoded = jwt.verify(token, JWT_SECRET);
    // console.log('🔐 Token decoded payload:', decoded);

    // Extract user ID from token (support multiple field names)
    let userId;
    if (decoded.userId) {
      userId = decoded.userId;
    } else if (decoded.id) {
      userId = decoded.id;
    } else if (decoded._id) {
      userId = decoded._id;
    } else {
      return res.status(403).json({ message: 'Token missing user identifier' });
    }

    // console.log('🔐 Extracted userId:', userId);

    // Find the user associated with the token
    const user = await User.findById(userId).select('-password'); // Exclude password

    if (!user) {
      console.log('❌ User not found for userId:', userId);
      return res.status(403).json({ message: 'Invalid token - user not found' });
    }

    // Add the user object to the request object
    req.user = user;
    req.userId = user._id;  // Explicitly add userId to req
    
    console.log('✅ User authenticated:', { 
      id: user._id, 
      role: user.role, 
      email: user.email 
    });

    // Proceed to the next middleware or route handler
    next();
  } catch (error) {
    console.error('❌ Error authenticating token:', error.message);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ message: 'Invalid token format' });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({ 
        message: 'Token expired',
        expiredAt: error.expiredAt 
      });
    }
    
    res.status(403).json({ 
      message: 'Invalid or expired token',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * ADMIN AUTHORIZATION
 * Checks if authenticated user is an admin
 * MUST be used AFTER authenticateToken middleware
 * 
 * Example usage in routes:
 * router.get('/admin/teachers', authenticateToken, adminAuth, controller)
 */
const adminAuth = (req, res, next) => {
  try {
    // Check if user is attached from authenticateToken
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    console.log('Admin Check - User role:', req.user.role);

    // Check if user role is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        message: 'Only admins can view teachers',
        userRole: req.user.role 
      });
    }

    // User is admin, proceed
    next();
  } catch (error) {
    console.error('Error in adminAuth:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  authenticateToken,
  adminAuth
};