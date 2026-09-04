const mongoose = require('mongoose');
const User = require("../models/User");
const Enrollment = require("../models/Enrollment");
const Tenant = require("../models/Tenant");
const RefreshToken = require("../models/RefreshToken");
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const logger = require("../utils/logger");
const { logActivity } = require("../utils/activityLogger");
const emailService = require("../utils/emailService");
const { validatePassword } = require("../utils/passwordValidation");
const { isLockedOut, recordFailedAttempt, clearAttempts } = require("../utils/accountLockout");
const cache = require("../middleware/cache");
require('dotenv').config();

const { JWT_SECRET } = process.env;

/**
 * LOGIN - For all users (student, teacher, admin, super_admin)
 */
const login = async (req, res) => {
  let { email, password, subdomain } = req.body;

  logger.debug('Login attempt', { email, subdomain });

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required'
    });
  }

  email = email.toLowerCase().trim();

  // Get tenant from subdomain (if provided)
  let tenant = null;
  let tenantId = null;

  if (!subdomain) {
    return res.status(400).json({
      success: false,
      message: 'Please use your institution\'s unique login link (https://app.attendease.com/login/<your-subdomain>).'
    });
  }

  if (subdomain) {
    tenant = await Tenant.findOne({
      $or: [
        { subdomain: subdomain.toLowerCase() },
        { domain: subdomain.toLowerCase() }
      ],
      isActive: true
    }).lean();

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Invalid institution domain. Please check your URL.'
      });
    }
    tenantId = tenant._id;
  }

  try {
    // Build query - super admin doesn't have tenantId
    const query = { email };
    if (tenantId) {
      query.tenantId = tenantId;
    }

    const user = await User.findOne(query);
    logger.debug('User found check', { found: !!user, role: user?.role });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found! Please check your credentials.'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'This account has been deactivated. Contact your administrator.'
      });
    }

    // Check account lockout
    const lockout = isLockedOut(email, tenantId);
    if (lockout && lockout.locked) {
      return res.status(429).json({
        success: false,
        message: `Account temporarily locked due to too many failed attempts. Try again in ${lockout.remainingMinutes} minute(s).`
      });
    }

    // Verify password (bcrypt only — no plaintext fallback)
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      recordFailedAttempt(email, tenantId);
      return res.status(401).json({
        success: false,
        message: 'Invalid password'
      });
    }

    // Clear failed attempts on successful login
    clearAttempts(email, tenantId);

    // Update last login info
    user.lastLoginAt = new Date();
    user.lastLoginIP = req.ip;
    user.loginCount = (user.loginCount || 0) + 1;
    await user.save();

    // Generate 15-minute access token (standardized across all roles)
    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role,
        tenantId: user.tenantId,
        isSuperAdmin: user.role === 'super_admin',
        tokenVersion: user.tokenVersion || 0
      },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Generate 7-day refresh token
    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

    await RefreshToken.create({
      tokenHash,
      userId: user._id,
      tenantId: user.tenantId || user._id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ipAddress: req.ip,
      deviceFingerprint: req.headers['x-device-fingerprint'] || req.headers['user-agent'],
    });

    logActivity({
      tenantId: user.tenantId,
      userId: user._id,
      description: `Login: ${user.name} (${user.role})`,
      endpoint: '/api/auth/login',
      statusCode: 200,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      refreshToken: rawRefreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        section: user.section,
        rollNo: user.rollNo,
        courseId: user.courseId,
        courseName: user.courseName,
        branch: user.branch,
        semester: user.semester,
        admissionYear: user.admissionYear,
        isFirstLogin: user.isFirstLogin,
        tenantId: user.tenantId
      }
    });

  } catch (error) {
    logger.error('Login error', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

const superAdminLogin = async (req, res) => {
  const { email, password } = req.body;
  const { SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD } = process.env;

  if (!SUPER_ADMIN_EMAIL || !SUPER_ADMIN_PASSWORD) {
    return res.status(500).json({
      success: false,
      message: 'Super admin not configured'
    });
  }

  const adminEmails = (SUPER_ADMIN_EMAIL || '').split(',').map(e => e.trim().toLowerCase());

  if (!adminEmails.includes(email?.toLowerCase())) {
    return res.status(401).json({
      success: false,
      message: 'Invalid super admin credentials'
    });
  }

  // Check account lockout
  const lockout = isLockedOut(email, 'super_admin');
  if (lockout && lockout.locked) {
    return res.status(429).json({
      success: false,
      message: `Account temporarily locked due to too many failed attempts. Try again in ${lockout.remainingMinutes} minute(s).`
    });
  }

  try {
    let superAdmin = await User.findOne({
      email: email.toLowerCase(),
      role: 'super_admin'
    });

    if (!superAdmin) {
      const hashedPassword = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 10);
      superAdmin = new User({
        name: 'Super Administrator',
        email: email.toLowerCase(),
        password: hashedPassword,
        role: 'super_admin',
        isActive: true,
        emailVerified: true,
        profileComplete: true
      });
      await superAdmin.save();
    }

    // Verify password (bcrypt only — no plaintext fallback)
    const isValid = await bcrypt.compare(password, superAdmin.password);

    if (!isValid) {
      recordFailedAttempt(email, 'super_admin');
      return res.status(401).json({
        success: false,
        message: 'Invalid super admin credentials'
      });
    }

    clearAttempts(email, 'super_admin');

    superAdmin.lastLoginAt = new Date();
    superAdmin.loginCount = (superAdmin.loginCount || 0) + 1;
    await superAdmin.save();

    // Generate 15-minute access token (standardized across all roles)
    const token = jwt.sign(
      {
        userId: superAdmin._id,
        role: 'super_admin',
        isSuperAdmin: true,
        tokenVersion: superAdmin.tokenVersion || 0
      },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Generate 7-day refresh token
    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

    await RefreshToken.create({
      tokenHash,
      userId: superAdmin._id,
      tenantId: superAdmin._id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ipAddress: req.ip,
      deviceFingerprint: req.headers['x-device-fingerprint'] || req.headers['user-agent'],
    });

    logActivity({
      userId: superAdmin._id,
      description: `Super admin login: ${superAdmin.email}`,
      endpoint: '/api/auth/super-admin/login',
      statusCode: 200,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.json({
      success: true,
      message: 'Super admin login successful',
      token,
      refreshToken: rawRefreshToken,
      user: {
        id: superAdmin._id,
        name: superAdmin.name,
        email: superAdmin.email,
        role: 'super_admin',
        isSuperAdmin: true
      }
    });
  } catch (error) {
    logger.error('Super admin login error', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * REGISTER STUDENT - Within a tenant
 */
const registerStudent = async (req, res) => {
  let { email, enrollmentNumber, password, confirmPassword, subdomain } = req.body;

  logger.debug('Registration attempt', { enrollmentNumber, subdomain });

  // Validation
  if (!email || !enrollmentNumber || !password || !confirmPassword) {
    return res.status(400).json({
      success: false,
      message: 'All fields are required'
    });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({
      success: false,
      message: 'Passwords do not match'
    });
  }

  const passwordCheck = validatePassword(password);
  if (!passwordCheck.valid) {
    return res.status(400).json({
      success: false,
      message: passwordCheck.message
    });
  }

  email = email.toLowerCase().trim();
  enrollmentNumber = enrollmentNumber.toUpperCase().trim();

  // Get tenant from subdomain
  let tenantId = null;
  let tenant = null;

  if (subdomain) {
    tenant = await Tenant.findOne({
      $or: [
        { subdomain: subdomain.toLowerCase() },
        { domain: subdomain.toLowerCase() }
      ],
      isActive: true
    });

    if (!tenant) {
      logger.warn('Tenant not found for registration subdomain', { subdomain });
      return res.status(404).json({
        success: false,
        message: 'Invalid institution domain. Please check your URL.'
      });
    }
    tenantId = tenant._id;
    logger.debug('Tenant resolved for registration', { tenantName: tenant.name, tenantId });
  } else {
    logger.warn('No subdomain provided for student registration');
    return res.status(400).json({
      success: false,
      message: 'Institution subdomain is required'
    });
  }

  try {
    const query = {
      enrollmentNumber: enrollmentNumber,
      email: email,
      tenantId: tenantId
    };

    logger.debug('Looking for enrollment', { enrollmentNumber, tenantId });

    const enrollment = await Enrollment.findOne(query);

    if (!enrollment) {
      logger.debug('Enrollment not found for registration', { tenantId });

      const enrollmentWithoutTenant = await Enrollment.findOne({
        enrollmentNumber: enrollmentNumber,
        email: email
      });

      if (enrollmentWithoutTenant) {
        logger.warn('Enrollment tenant mismatch', { enrollmentTenantId: enrollmentWithoutTenant.tenantId, providedTenantId: tenantId });
        return res.status(404).json({
          success: false,
          message: 'Enrollment found but belongs to a different institution. Please check your domain.'
        });
      }

      return res.status(404).json({
        success: false,
        message: 'Invalid enrollment details. Please contact your institution.'
      });
    }

    logger.debug('Enrollment found for registration', {
      section: enrollment.section
    });

    if (enrollment.isRegistered) {
      logger.debug('Enrollment already registered', { tenantId });
      return res.status(400).json({
        success: false,
        message: 'This enrollment is already registered. Please login.'
      });
    }

    const existingUser = await User.findOne({ email, tenantId });
    if (existingUser) {
      logger.debug('User email already registered', { tenantId });
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    if (tenant) {
      const studentCount = await User.countDocuments({ tenantId, role: 'student' });
      logger.debug('Student limit check', { studentCount, maxStudents: tenant.limits?.maxStudents });

      if (tenant.limits?.maxStudents && studentCount >= tenant.limits.maxStudents) {
        logger.warn('Student limit reached for tenant', { tenantId });
        return res.status(403).json({
          success: false,
          message: 'Institution has reached maximum student limit. Please contact admin.',
          upgradeRequired: true
        });
      }
    }

    logger.debug('Creating student user account');
    const hashPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name: `${enrollment.firstName} ${enrollment.lastName}`.trim(),
      email,
      password: hashPassword,
      section: enrollment.section,
      role: 'student',
      rollNo: enrollmentNumber,
      tenantId: tenantId,
      emailVerified: true,
      parentName: enrollment.parentName || "",
      parentPhone: enrollment.parentPhone || "",
      parentEmail: enrollment.parentEmail || "",
      courseId: enrollment.courseId || null,
      courseName: enrollment.courseName || "",
      branch: enrollment.branch || "",
      semester: enrollment.semester || 1,
      admissionYear: enrollment.admissionYear || new Date().getFullYear(),
      totalSemesters: enrollment.totalSemesters || null,
    });

    await newUser.save();
    logger.info('Student user created', { userId: newUser._id, tenantId });

    enrollment.isRegistered = true;
    enrollment.registeredAt = Date.now();
    enrollment.userId = newUser._id;
    await enrollment.save();
    logger.debug('Enrollment updated after registration');

    if (tenant) {
      await tenant.updateStats();
      logger.debug('Tenant stats updated after student registration');
    }

    // Generate 15-minute access token (standardized across all roles)
    const token = jwt.sign(
      { userId: newUser._id, role: 'student', tenantId, tokenVersion: 0 },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Generate 7-day refresh token
    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const refreshTokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

    await RefreshToken.create({
      tokenHash: refreshTokenHash,
      userId: newUser._id,
      tenantId: tenantId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ipAddress: req.ip,
      deviceFingerprint: req.headers['x-device-fingerprint'] || req.headers['user-agent'],
    });

    logger.info('Student registration completed', { userId: newUser._id, tenantId });
    return res.status(201).json({
      success: true,
      message: 'Student registered successfully',
      token,
      refreshToken: rawRefreshToken,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        section: newUser.section,
        rollNo: newUser.rollNo,
        role: newUser.role,
        tenantId: newUser.tenantId
      }
    });

  } catch (error) {
    logger.error('Student registration error', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message
    });
  }
};

/**
 * TEACHER FIRST LOGIN - Set permanent password
 */
const registerTeacherFirstLogin = async (req, res) => {
  let { email, tempPassword, newPassword, confirmPassword, subdomain } = req.body;

  logger.debug('Teacher activation attempt', { subdomain });

  if (!email || !tempPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({
      success: false,
      message: 'All fields are required'
    });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({
      success: false,
      message: 'Passwords do not match'
    });
  }

  const passwordCheck = validatePassword(newPassword);
  if (!passwordCheck.valid) {
    return res.status(400).json({
      success: false,
      message: passwordCheck.message
    });
  }

  const emailLower = email.toLowerCase().trim();

  let tenantId = null;
  let tenant = null;

  if (subdomain) {
    tenant = await Tenant.findOne({
      $or: [
        { subdomain: subdomain.toLowerCase() },
        { domain: subdomain.toLowerCase() }
      ],
      isActive: true
    });

    if (!tenant) {
      logger.warn('Tenant not found for teacher activation subdomain', { subdomain });
      return res.status(404).json({
        success: false,
        message: 'Invalid institution domain. Please check your URL.'
      });
    }
    tenantId = tenant._id;
    logger.debug('Tenant resolved for teacher activation', { tenantName: tenant.name, tenantId });
  } else {
    logger.warn('No subdomain provided for teacher activation');
    return res.status(400).json({
      success: false,
      message: 'Institution subdomain is required'
    });
  }

  try {
    logger.debug('Looking for teacher to activate', { tenantId });

    const teacher = await User.findOne({
      email: emailLower,
      role: 'teacher',
      tenantId,
      isFirstLogin: true
    });

    if (!teacher) {
      logger.debug('Teacher not found or already activated', { tenantId });

      const existingTeacher = await User.findOne({
        email: emailLower,
        role: 'teacher',
        tenantId,
        isFirstLogin: false
      });

      if (existingTeacher) {
        logger.debug('Teacher already activated', { tenantId });
        return res.status(400).json({
          success: false,
          message: 'This account is already activated. Please login.'
        });
      }

      return res.status(404).json({
        success: false,
        message: 'Teacher account not found. Please check your email or contact administrator.'
      });
    }

    logger.debug('Teacher found for activation', { teacherId: teacher._id, tenantId });

    const isValid = await bcrypt.compare(tempPassword, teacher.password);
    if (!isValid) {
      logger.debug('Invalid temporary password for teacher activation', { tenantId });
      return res.status(401).json({
        success: false,
        message: 'Invalid temporary password. Please check with your administrator.'
      });
    }
    logger.debug('Temporary password verified for teacher');

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    teacher.password = hashedPassword;
    teacher.isFirstLogin = false;
    teacher.activatedAt = Date.now();
    await teacher.save();
    logger.info('Teacher account activated', { teacherId: teacher._id, tenantId });

    // Generate 15-minute access token (standardized across all roles)
    const token = jwt.sign(
      { userId: teacher._id, role: 'teacher', tenantId, tokenVersion: teacher.tokenVersion || 0 },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Generate 7-day refresh token
    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const refreshTokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

    await RefreshToken.create({
      tokenHash: refreshTokenHash,
      userId: teacher._id,
      tenantId: tenantId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ipAddress: req.ip,
      deviceFingerprint: req.headers['x-device-fingerprint'] || req.headers['user-agent'],
    });

    logger.info('Teacher activation completed', { teacherId: teacher._id, tenantId });

    return res.status(200).json({
      success: true,
      message: 'Password set successfully. You are now logged in.',
      token,
      refreshToken: rawRefreshToken,
      user: {
        id: teacher._id,
        name: teacher.name,
        email: teacher.email,
        role: teacher.role,
        section: teacher.section,
        tenantId: teacher.tenantId
      }
    });

  } catch (error) {
    logger.error('Teacher first login error', {
      error: error.message,
      stack: error.stack,
      name: error.name
    });
    return res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
        success: false,
        message: "User not found"
      });
    }

    let tenantInfo = null;
    if (user.tenantId) {
      const tenant = await Tenant.findById(user.tenantId).select('name subdomain branding subscription.plan');
      if (tenant) {
        tenantInfo = {
          id: tenant._id,
          name: tenant.name,
          subdomain: tenant.subdomain,
          branding: tenant.branding,
          plan: tenant.subscription.plan
        };
      }
    }

    return res.status(200).json({
      success: true,
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      section: user.section,
      rollNo: user.rollNo,
      isFirstLogin: user.isFirstLogin,
      assignedSubjects: user.assignedSubjects,
      isActive: user.isActive,
      tenantId: user.tenantId,
      tenantInfo: tenantInfo,
      isSuperAdmin: user.role === 'super_admin'
    });

  } catch (error) {
    logger.error("Verification error", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Error verifying token"
    });
  }
};

/**
 * CHANGE PASSWORD
 */
const changePassword = async (req, res) => {
  const { oldPassword, newPassword, confirmPassword } = req.body;

  if (!oldPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({
      success: false,
      message: 'All fields are required'
    });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({
      success: false,
      message: 'Passwords do not match'
    });
  }

  const passwordCheck = validatePassword(newPassword);
  if (!passwordCheck.valid) {
    return res.status(400).json({
      success: false,
      message: passwordCheck.message
    });
  }

  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const isValid = await bcrypt.compare(oldPassword, user.password);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    // Invalidate user cache
    await cache.del(`user:${user._id}`);

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    logger.error('Change password error', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * LOGOUT - Revoke the current refresh token
 */
const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await RefreshToken.findOneAndUpdate({ tokenHash }, { revoked: true });
      logger.info('Refresh token revoked on logout', { userId: req.user?.userId });
    }
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    logger.error('Logout error', { error: error.message });
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  }
};

/**
 * MOBILE LOGIN — Student login by enrollmentNumber (rollNo) + password.
 *
 * Designed for the ATTEND-AI mobile app / Phase 2 face-attendance flow.
 * Identifies the student via Enrollment.enrollmentNumber instead of email,
 * requires an explicit tenantId (mobile apps have no URL host), and uses
 * a stricter rate limit (5/15m) than web login.
 *
 * Reuses the same JWT (15m) + refresh token (7d) issuance as web login.
 * Account lockout is keyed on the user's email after resolving User via Enrollment.
 */
const mobileLogin = async (req, res) => {
  try {
    let { enrollmentNumber, password, tenantId, deviceFingerprint } = req.body;

    if (!enrollmentNumber || !password || !tenantId) {
      return res.status(400).json({
        success: false,
        message: "enrollmentNumber, password, and tenantId are required",
      });
    }

    enrollmentNumber = enrollmentNumber.toUpperCase().trim();

    // --- Resolve tenant from the provided tenantId ---
    if (!mongoose.Types.ObjectId.isValid(tenantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid tenantId format",
      });
    }

    const tenant = await Tenant.findById(tenantId).lean();
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: "Institution not found. Please check your tenant ID.",
      });
    }

    if (!tenant.isActive) {
      return res.status(403).json({
        success: false,
        message: "This institution is no longer active.",
      });
    }

    // --- Look up the Enrollment record (tenant-scoped) ---
    const enrollment = await Enrollment.findOne({
      enrollmentNumber,
      tenantId: tenant._id,
    }).lean();

    if (!enrollment) {
      logger.debug("mobileLogin: enrollment not found", {
        enrollmentNumber,
        tenantId: tenant._id,
      });
      return res.status(404).json({
        success: false,
        message: "Invalid enrollment number or institution.",
      });
    }

    if (!enrollment.isRegistered) {
      logger.debug("mobileLogin: enrollment not activated", {
        enrollmentNumber,
        tenantId: tenant._id,
      });
      return res.status(400).json({
        success: false,
        message: "This enrollment has not been activated yet. Please contact your institution.",
      });
    }

    // --- Look up the User (tenant-scoped, active only) ---
    const userId = enrollment.userId;
    if (!userId) {
      logger.warn("mobileLogin: enrollment has no linked user", {
        enrollmentNumber,
        tenantId: tenant._id,
      });
      return res.status(400).json({
        success: false,
        message: "Enrollment is not linked to a user account. Contact your institution.",
      });
    }

    const user = await User.findOne({
      _id: userId,
      tenantId: tenant._id,
      role: "student",
      isActive: true,
      isDeleted: false,
    });

    if (!user) {
      logger.debug("mobileLogin: user not found or inactive", {
        userId,
        tenantId: tenant._id,
      });
      return res.status(403).json({
        success: false,
        message: "This account has been deactivated. Contact your administrator.",
      });
    }

    // --- Account lockout (keyed on user's email, reuse existing lockout utils) ---
    const lockout = isLockedOut(user.email, tenant._id);
    if (lockout && lockout.locked) {
      return res.status(429).json({
        success: false,
        message: `Account temporarily locked due to too many failed attempts. Try again in ${lockout.remainingMinutes} minute(s).`,
      });
    }

    // --- Verify password ---
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      recordFailedAttempt(user.email, tenant._id);
      logger.debug("mobileLogin: invalid password", {
        userId: user._id,
        tenantId: tenant._id,
      });
      return res.status(401).json({
        success: false,
        message: "Invalid password",
      });
    }

    clearAttempts(user.email, tenant._id);

    // --- Update last login ---
    user.lastLoginAt = new Date();
    user.lastLoginIP = req.ip;
    user.loginCount = (user.loginCount || 0) + 1;
    await user.save();

    // --- Issue 15-minute access token + 7-day refresh token (same shape as web login) ---
    const token = jwt.sign(
      {
        userId: user._id,
        role: "student",
        tenantId: user.tenantId,
        tokenVersion: user.tokenVersion || 0,
      },
      JWT_SECRET,
      { expiresIn: "15m" }
    );

    const rawRefreshToken = crypto.randomBytes(40).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawRefreshToken).digest("hex");

    await RefreshToken.create({
      tokenHash,
      userId: user._id,
      tenantId: user.tenantId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ipAddress: req.ip,
      deviceFingerprint: deviceFingerprint || req.headers["user-agent"] || "",
    });

    logActivity({
      tenantId: user.tenantId,
      userId: user._id,
      description: `Mobile login: ${user.name} (${user.rollNo})`,
      endpoint: "/api/auth/mobile-login",
      statusCode: 200,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    logger.info("Mobile login successful", {
      userId: user._id,
      rollNo: user.rollNo,
      tenantId: user.tenantId,
      ipAddress: req.ip,
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      refreshToken: rawRefreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: "student",
        section: user.section,
        rollNo: user.rollNo,
        tenantId: user.tenantId,
      },
    });
  } catch (error) {
    logger.error("Error during mobile login", { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      message: "Server error during mobile login",
      error: error.message,
    });
  }
};

const parentLogin = async (req, res) => {
  let { email, password, subdomain } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required' });
  }

  email = email.toLowerCase().trim();

  try {
    let tenantId = null;
    if (!subdomain) {
      return res.status(400).json({ success: false, message: 'Please use your institution\'s unique login link.' });
    }
    if (subdomain) {
      const tenant = await Tenant.findOne({
        $or: [
          { subdomain: subdomain.toLowerCase() },
          { domain: subdomain.toLowerCase() }
        ],
        isActive: true
      }).lean();
      if (!tenant) {
        return res.status(404).json({ success: false, message: 'Institution not found. Please check your subdomain.' });
      }
      tenantId = tenant._id;

      if (!tenant.settings?.enableParentPortal) {
        return res.status(403).json({ success: false, message: 'Parent portal is not enabled for this institution.' });
      }

      const Plan = require('../models/Plan');
      const plan = await Plan.findOne({ code: tenant.subscription?.plan });
      if (!plan || !plan.modules?.parentPortal) {
        return res.status(403).json({ success: false, message: 'Parent portal is not included in your current plan. Please contact the institution admin.' });
      }
    }

    const user = await User.findOne({
      tenantId,
      role: 'student',
      $or: [{ email }, { parentEmail: email }]
    });
    if (!user) {
      return res.status(404).json({ success: false, message: 'No parent account found with these credentials. Please check the email linked by your institution.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'This account has been deactivated.' });
    }

    // Check account lockout
    const lockout = isLockedOut(email, tenantId);
    if (lockout && lockout.locked) {
      return res.status(429).json({
        success: false,
        message: `Account temporarily locked due to too many failed attempts. Try again in ${lockout.remainingMinutes} minute(s).`
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      recordFailedAttempt(email, tenantId);
      return res.status(401).json({ success: false, message: 'Invalid password' });
    }

    clearAttempts(email, tenantId);

    user.lastLoginAt = new Date();
    await user.save();

    // Generate 15-minute access token (standardized across all roles)
    const token = jwt.sign(
      {
        userId: user._id,
        role: 'parent',
        tenantId: user.tenantId,
        accessMode: 'parent',
        tokenVersion: user.tokenVersion || 0
      },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Generate 7-day refresh token
    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const refreshTokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

    await RefreshToken.create({
      tokenHash: refreshTokenHash,
      userId: user._id,
      tenantId: user.tenantId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ipAddress: req.ip,
      deviceFingerprint: req.headers['x-device-fingerprint'] || req.headers['user-agent'],
    });

    return res.status(200).json({
      success: true,
      message: 'Parent login successful',
      token,
      refreshToken: rawRefreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: 'parent',
        studentName: user.name,
        studentRollNo: user.rollNo,
        tenantId: user.tenantId,
      }
    });
  } catch (error) {
    logger.error('Parent login error', { error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const setup2FA = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (user.twoFactorEnabled) {
      return res.status(400).json({ success: false, message: '2FA is already enabled' });
    }

    const secret = speakeasy.generateSecret({ name: `AttendEase:${user.email}` });

    user.twoFactorSecret = secret.base32;
    await user.save();

    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

    return res.status(200).json({
      success: true,
      data: { secret: secret.base32, qrCode: qrCodeUrl },
      message: 'Scan the QR code with your authenticator app',
    });
  } catch (error) {
    logger.error('2FA setup error', { error: error.message });
    return res.status(500).json({ success: false, message: 'Failed to setup 2FA' });
  }
};

const verify2FA = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: 'Verification token is required' });

    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (!user.twoFactorSecret) {
      return res.status(400).json({ success: false, message: '2FA not set up. Run setup first.' });
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 2,
    });

    if (!verified) {
      return res.status(401).json({ success: false, message: 'Invalid verification code' });
    }

    user.twoFactorEnabled = true;
    await user.save();

    // Invalidate user cache
    await cache.del(`user:${user._id}`);

    return res.status(200).json({ success: true, message: '2FA enabled successfully' });
  } catch (error) {
    logger.error('2FA verify error', { error: error.message });
    return res.status(500).json({ success: false, message: 'Failed to verify 2FA' });
  }
};

const disable2FA = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    await user.save();

    // Invalidate user cache
    await cache.del(`user:${user._id}`);

    return res.status(200).json({ success: true, message: '2FA disabled successfully' });
  } catch (error) {
    logger.error('2FA disable error', { error: error.message });
    return res.status(500).json({ success: false, message: 'Failed to disable 2FA' });
  }
};

const get2FAStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('twoFactorEnabled');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    return res.status(200).json({ success: true, data: { twoFactorEnabled: user.twoFactorEnabled } });
  } catch (error) {
    logger.error('2FA status error', { error: error.message });
    return res.status(500).json({ success: false, message: 'Failed to get 2FA status' });
  }
};

const getSessions = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('lastLoginAt lastLoginIP loginCount tokenVersion');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const sessions = [{
      id: 'current',
      device: req.headers['user-agent'] || 'Unknown',
      ip: req.ip,
      lastActive: user.lastLoginAt,
      isCurrent: true,
    }];

    return res.status(200).json({ success: true, data: sessions });
  } catch (error) {
    logger.error('Get sessions error', { error: error.message });
    return res.status(500).json({ success: false, message: 'Failed to get sessions' });
  }
};

const logoutAllSessions = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    // Invalidate user cache
    await cache.del(`user:${user._id}`);

    return res.status(200).json({ success: true, message: 'All other sessions logged out. Please log in again.' });
  } catch (error) {
    logger.error('Logout all sessions error', { error: error.message });
    return res.status(500).json({ success: false, message: 'Failed to logout sessions' });
  }
};

const refresh = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ success: false, message: 'Refresh token is required' });
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const storedToken = await RefreshToken.findOne({ tokenHash, revoked: false });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
    }

    const user = await User.findById(storedToken.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'User not found or account inactive' });
    }

    // Revoke old refresh token (Replay Protection)
    storedToken.revoked = true;
    await storedToken.save();

    // Generate new 15-minute access token
    const newToken = jwt.sign(
      {
        userId: user._id,
        role: user.role,
        tenantId: user.tenantId,
        isSuperAdmin: user.role === 'super_admin',
        tokenVersion: user.tokenVersion || 0,
      },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Rotate refresh token (7 days)
    const newRawRefreshToken = crypto.randomBytes(40).toString('hex');
    const newTokenHash = crypto.createHash('sha256').update(newRawRefreshToken).digest('hex');

    await RefreshToken.create({
      tokenHash: newTokenHash,
      userId: user._id,
      tenantId: user.tenantId || user._id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ipAddress: req.ip,
      deviceFingerprint: req.headers['x-device-fingerprint'] || req.headers['user-agent'],
    });

    return res.status(200).json({
      success: true,
      token: newToken,
      refreshToken: newRawRefreshToken,
    });
  } catch (err) {
    logger.error('Refresh token error', { error: err.message });
    return res.status(500).json({ success: false, message: 'Failed to refresh token' });
  }
};

const forgotPassword = async (req, res) => {
  const { email, subdomain } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    let tenantId = null;
    if (subdomain) {
      const Tenant = require('../models/Tenant');
      const tenant = await Tenant.findOne({
        $or: [
          { subdomain: subdomain.toLowerCase().trim() },
          { domain: subdomain.toLowerCase().trim() }
        ],
        isActive: true
      }).lean();
      if (tenant) {
        tenantId = tenant._id;
      }
    }

    const query = {
      $or: [
        { email: normalizedEmail },
        { parentEmail: normalizedEmail }
      ]
    };
    if (tenantId) {
      query.tenantId = tenantId;
    }

    const user = await User.findOne(query);
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If your account exists, password reset instructions have been sent to your registered email.'
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.passwordResetToken = resetTokenHash;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    const targetEmail = user.parentEmail && user.parentEmail.toLowerCase() === normalizedEmail ? user.parentEmail : user.email;

    try {
      await emailService.sendPasswordResetEmail(targetEmail, user.name, resetToken);
      logger.info('Password reset email dispatched', { userId: user._id, email: targetEmail });
    } catch (emailErr) {
      logger.warn('Failed to send password reset email', { error: emailErr.message });
    }

    return res.status(200).json({
      success: true,
      message: 'If your account exists, password reset instructions have been sent to your registered email.',
      resetToken: process.env.NODE_ENV !== 'production' ? resetToken : undefined,
    });
  } catch (err) {
    logger.error('Forgot password error', { error: err.message });
    return res.status(500).json({ success: false, message: 'Failed to process forgot password request' });
  }
};

const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ success: false, message: 'Token and new password are required' });
  }

  const passwordCheck = validatePassword(newPassword);
  if (!passwordCheck.valid) {
    return res.status(400).json({ success: false, message: passwordCheck.message });
  }

  try {
    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      passwordResetToken: resetTokenHash,
      passwordResetExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired password reset token' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.isFirstLogin = false;
    await user.save();

    // Invalidate user cache
    await cache.del(`user:${user._id}`);

    return res.status(200).json({
      success: true,
      message: 'Password has been reset successfully! You can now log in with your new password.'
    });
  } catch (err) {
    logger.error('Reset password error', { error: err.message });
    return res.status(500).json({ success: false, message: 'Failed to reset password' });
  }
};

/**
 * Send email verification OTP via Brevo
 */
const sendEmailVerification = async (req, res) => {
  try {
    const userId = req.user?._id || req.body?.userId;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.emailVerified) {
      return res.status(400).json({ success: false, message: 'Email is already verified' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.emailVerificationOTP = otp;
    user.emailVerificationExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
    await user.save();

    await emailService.sendVerificationOTP(user.email, user.name, otp);

    return res.status(200).json({
      success: true,
      message: `Verification code sent to ${user.email}`,
    });
  } catch (error) {
    logger.error('Error sending verification email', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to send verification email',
      error: error.message,
    });
  }
};

/**
 * Verify email using OTP
 */
const verifyEmail = async (req, res) => {
  try {
    const { otp } = req.body;
    const userId = req.user?._id || req.body?.userId;

    if (!otp) {
      return res.status(400).json({ success: false, message: 'Verification OTP is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.emailVerified) {
      return res.status(200).json({ success: true, message: 'Email is already verified' });
    }

    if (!user.emailVerificationOTP || user.emailVerificationOTP !== otp.toString().trim()) {
      return res.status(400).json({ success: false, message: 'Invalid verification code' });
    }

    if (user.emailVerificationExpires && new Date() > user.emailVerificationExpires) {
      return res.status(400).json({ success: false, message: 'Verification code has expired. Please request a new one.' });
    }

    user.emailVerified = true;
    user.emailVerificationOTP = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully!',
      data: {
        emailVerified: true,
      },
    });
  } catch (error) {
    logger.error('Error verifying email', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to verify email',
      error: error.message,
    });
  }
};

module.exports = {
  registerStudent,
  registerTeacherFirstLogin,
  login,
  superAdminLogin,
  parentLogin,
  mobileLogin,
  verifyToken,
  changePassword,
  logout,
  refresh,
  forgotPassword,
  resetPassword,
  setup2FA,
  verify2FA,
  disable2FA,
  get2FAStatus,
  getSessions,
  logoutAllSessions,
  sendEmailVerification,
  verifyEmail,
};