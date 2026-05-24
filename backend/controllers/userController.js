const User = require("../models/User");
const Enrollment = require("../models/Enrollment");
var bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const { JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

/**
 * LOGIN - For all users (student, teacher, admin)
 * Only requires email and password
 * Automatically sets role to admin if matches admin credentials
 */
const login = async (req, res) => {
  let { email, password } = req.body;

  console.log('🔐 Login attempt:', { email });

  if (!email || !password) {
    console.log('❌ Missing email or password');
    return res.status(400).json({ 
      message: 'Email and password are required' 
    });
  }

  // Convert to lowercase
  email = email.toLowerCase().trim();

  try {
    // Check if it's admin credentials from environment variables
    if (ADMIN_EMAIL && ADMIN_PASSWORD) {
      const adminEmails = ADMIN_EMAIL.split(',').map(e => e.trim().toLowerCase());
      console.log('🔍 Checking admin emails:', adminEmails);
      
      if (adminEmails.includes(email) && password === ADMIN_PASSWORD) {
        console.log('✅ Admin credentials matched');
        
        // Check if admin user exists in database
        let adminUser = await User.findOne({ email, role: 'admin' });
        console.log('🔍 Admin user found in DB:', adminUser ? 'Yes' : 'No');
        
        if (!adminUser) {
          console.log('🆕 Creating new admin user');
          // Create admin user if doesn't exist
          const hashPassword = await bcrypt.hash(password, 10);
          adminUser = new User({
            name: 'System Administrator',
            email,
            password: hashPassword,
            role: 'admin',
            isActive: true,
            isFirstLogin: false,
            section: 'Admin',
            createdAt: Date.now()
          });
          await adminUser.save();
          console.log('✅ Admin user created:', email);
        }

        // Generate token
        const token = jwt.sign(
          { userId: adminUser._id, role: 'admin' }, 
          JWT_SECRET, 
          { expiresIn: '7d' }
        );

        console.log('✅ Admin login successful, returning response:', {
          id: adminUser._id,
          name: adminUser.name,
          email: adminUser.email,
          role: adminUser.role
        });

        return res.status(200).json({
          success: true,
          message: 'Admin login successful',
          token,
          user: {
            id: adminUser._id,
            name: adminUser.name,
            email: adminUser.email,
            role: 'admin',
            section: adminUser.section,
            isFirstLogin: adminUser.isFirstLogin,
            isAdmin: true
          }
        });
      }
    }

    console.log('🔍 Checking regular user login');
    // Regular user login (student, teacher)
    const user = await User.findOne({ email });
    console.log('🔍 User found:', user ? `Yes - Role: ${user.role}` : 'No');

    if (!user) {
      console.log('❌ User not found');
      return res.status(404).json({ 
        success: false,
        message: 'User not found! Please register first.' 
      });
    }

    // Check if account is active
    if (!user.isActive) {
      console.log('❌ Account deactivated');
      return res.status(403).json({ 
        success: false,
        message: 'This account has been deactivated. Contact your administrator.' 
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log('🔍 Password valid:', isPasswordValid ? 'Yes' : 'No');
    
    if (!isPasswordValid) {
      console.log('❌ Invalid password');
      return res.status(401).json({ 
        success: false,
        message: 'Invalid password' 
      });
    }

    // Generate token
    const token = jwt.sign(
      { userId: user._id, role: user.role }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );

    console.log('✅ Login successful, returning response:', {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      section: user.section
    });

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        section: user.section,
        rollNo: user.rollNo,
        isFirstLogin: user.isFirstLogin
      }
    });

  } catch (error) {
    console.error('❌ Error logging in user:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Internal server error',
      error: error.message 
    });
  }
};

// Rest of the functions remain the same...
const registerStudent = async (req, res) => {
  let { email, enrollmentNumber, password, confirmPassword } = req.body;

  // Validation
  if (!email || !enrollmentNumber || !password || !confirmPassword) {
    return res.status(400).json({ 
      message: 'Email, enrollment number, and password are required' 
    });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ 
      message: 'Passwords do not match' 
    });
  }

  if (password.length < 6) {
    return res.status(400).json({ 
      message: 'Password must be at least 6 characters long' 
    });
  }

  // Convert to lowercase
  email = email.toLowerCase().trim();
  enrollmentNumber = enrollmentNumber.toUpperCase().trim();
  
  try {
    // Step 1: Check if enrollment number exists and matches email
    const enrollment = await Enrollment.findOne({ 
      enrollmentNumber, 
      email 
    });

    if (!enrollment) {
      return res.status(404).json({ 
        message: 'Invalid enrollment number or email. Please contact your college administrator.' 
      });
    }

    // Step 2: Check if already registered
    if (enrollment.isRegistered) {
      return res.status(400).json({ 
        message: 'This enrollment number is already registered. Please login instead.' 
      });
    }

    // Step 3: Check if user already exists
    let existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        message: 'Email already registered' 
      });
    }

    // Step 4: Hash password
    const hashPassword = await bcrypt.hash(password, 10);

    // Step 5: Create new student user
    const newUser = new User({
      name: `${enrollment.firstName} ${enrollment.lastName}`,
      email,
      password: hashPassword,
      section: enrollment.section,
      role: 'student',
      rollNo: enrollmentNumber,
      isFirstLogin: false,
      createdAt: Date.now()
    });

    await newUser.save();

    // Step 6: Update enrollment record
    enrollment.isRegistered = true;
    enrollment.registeredAt = Date.now();
    enrollment.userId = newUser._id;
    await enrollment.save();

    // Step 7: Generate token
    const token = jwt.sign(
      { userId: newUser._id }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );

    return res.status(201).json({ 
      message: 'Student registered successfully',
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        section: newUser.section,
        rollNo: newUser.rollNo,
        role: newUser.role
      }
    });

  } catch (error) {
    console.error('Error registering student:', error);
    return res.status(500).json({ 
      message: 'Internal server error during registration' 
    });
  }
};

/**
 * TEACHER REGISTRATION - Only via Admin Creation
 * Teachers cannot self-register, only admin can create them
 * Uses temporary password sent via email
 */
const registerTeacherFirstLogin = async (req, res) => {
  const { email, tempPassword, newPassword, confirmPassword } = req.body;

  if (!email || !tempPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ 
      message: 'All fields are required' 
    });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ 
      message: 'Passwords do not match' 
    });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ 
      message: 'Password must be at least 6 characters long' 
    });
  }

  const emailLower = email.toLowerCase().trim();

  try {
    // Find teacher with temporary password
    const teacher = await User.findOne({ 
      email: emailLower, 
      role: 'teacher',
      isFirstLogin: true
    });

    if (!teacher) {
      return res.status(404).json({ 
        message: 'Teacher account not found or already activated' 
      });
    }

    // Verify temporary password
    const isTempPasswordValid = await bcrypt.compare(tempPassword, teacher.password);
    if (!isTempPasswordValid) {
      return res.status(401).json({ 
        message: 'Invalid temporary password' 
      });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update teacher account
    teacher.password = hashedNewPassword;
    teacher.isFirstLogin = false;
    await teacher.save();

    // Generate token
    const token = jwt.sign(
      { userId: teacher._id }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );

    return res.status(200).json({ 
      message: 'Password changed successfully. You are now logged in.',
      token,
      user: {
        id: teacher._id,
        name: teacher.name,
        email: teacher.email,
        role: teacher.role,
        section: teacher.section
      }
    });

  } catch (error) {
    console.error('Error in teacher first login:', error);
    return res.status(500).json({ 
      message: 'Internal server error' 
    });
  }
};

/**
 * VERIFY TOKEN - Get current user details
 */
const verifyToken = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .select("-password")
      .populate('assignedSubjects.subjectId');

    if (!user) {
      return res.status(404).json({ 
        message: "User not found" 
      });
    }

    return res.status(200).json({
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      section: user.section,
      rollNo: user.rollNo,
      isFirstLogin: user.isFirstLogin,
      assignedSubjects: user.assignedSubjects,
      isActive: user.isActive
    });

  } catch (error) {
    console.error("Verification error:", error);
    return res.status(500).json({ 
      message: "Error while verifying token" 
    });
  }
};

/**
 * CHANGE PASSWORD - For first login (teacher) or anytime
 */
const changePassword = async (req, res) => {
  const { oldPassword, newPassword, confirmPassword } = req.body;

  if (!oldPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ 
      message: 'All fields are required' 
    });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ 
      message: 'New passwords do not match' 
    });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ 
      message: 'Password must be at least 6 characters long' 
    });
  }

  try {
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({ 
        message: 'User not found' 
      });
    }

    // Verify old password
    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isOldPasswordValid) {
      return res.status(401).json({ 
        message: 'Current password is incorrect' 
      });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedNewPassword;
    await user.save();

    return res.status(200).json({ 
      message: 'Password changed successfully' 
    });

  } catch (error) {
    console.error('Error changing password:', error);
    return res.status(500).json({ 
      message: 'Internal server error' 
    });
  }
};

module.exports = {
  registerStudent,
  registerTeacherFirstLogin,
  login,
  verifyToken,
  changePassword
};