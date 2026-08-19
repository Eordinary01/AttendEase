// controllers/tenantController.js
const Tenant = require("../models/Tenant");
const User = require("../models/User");
const Plan = require("../models/Plan");
const Subject = require("../models/Subject");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const logger = require("../utils/logger");
const { getEffectiveModules, getEffectiveLimits } = require("../utils/planDefaults");
const { computeStorageUsedMB } = require("../utils/storageUsage");
const cache = require("../middleware/cache");

// // ==================== PUBLIC FUNCTIONS (No Auth Required) ====================

/**
 * REGISTER NEW TENANT (Institution)
 * Creates a new tenant and admin user
 * POST /api/tenant/register
 */
const registerTenant = async (req, res) => {
  try {
    console.log("📥 Registration request:", req.body);

    const {
      institutionName,
      email,
      password,
      phone,
      address,
      city,
      state,
      country,
      pincode,
      primaryColor,
      secondaryColor,
      welcomeMessage,
    } = req.body;

    // Validation
    if (!institutionName || !institutionName.trim()) {
      return res.status(400).json({
        success: false,
        message: "Institution name is required",
      });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    if (
      !password ||
      password.length < 8 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 8 characters long and include uppercase, lowercase, number, and special character.",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check for existing users with this email
    const existingUsers = await User.find({ email: normalizedEmail });
    if (existingUsers.length > 0) {
      let hasActiveTenant = false;
      let activeTenantName = "";

      for (const existingUser of existingUsers) {
        if (existingUser.role === "super_admin") {
          return res.status(400).json({
            success: false,
            message: "This email is reserved for a Super Admin account.",
          });
        }

        if (existingUser.tenantId) {
          const activeTenant = await Tenant.findById(existingUser.tenantId);
          if (activeTenant) {
            hasActiveTenant = true;
            activeTenantName = activeTenant.name;
            break;
          }
        }
      }

      if (hasActiveTenant) {
        return res.status(400).json({
          success: false,
          message: `An account with email '${normalizedEmail}' is already registered under '${activeTenantName}'. Please log in instead or use another email.`,
        });
      }

      // If user documents exist for this email but their associated tenants were deleted, clean up orphaned user records
      await User.deleteMany({ email: normalizedEmail });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Generate unique subdomain
      let subdomain = institutionName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .substring(0, 30);

      if (!subdomain) {
        subdomain = "institution";
      }

      let counter = 1;
      let originalSubdomain = subdomain;

      while (await Tenant.findOne({ subdomain })) {
        subdomain = `${originalSubdomain}${counter}`;
        counter++;
      }

      // Get free plan
      const freePlan = await Plan.findOne({ code: "free" });

      if (!freePlan) {
        throw new Error("Default plan not found. Please run seed:plans first.");
      }

      // Create tenant
      const tenant = new Tenant({
        name: institutionName.trim(),
        subdomain: subdomain,
        contact: {
          email: normalizedEmail,
          phone: phone || "",
          address: address || "",
          city: city || "",
          state: state || "",
          country: country || "India",
          pincode: pincode || "",
        },
        subscription: {
          plan: 'free',
          status: 'trial',
          startDate: new Date(),
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
        limits: freePlan.limits,
        branding: {
          institutionName: institutionName.trim(),
          primaryColor: primaryColor || "#6366f1",
          secondaryColor: secondaryColor || "#8b5cf6",
          welcomeMessage: welcomeMessage || "",
        },
        isActive: true,
        stats: {
          totalStudents: 0,
          totalTeachers: 0,
          totalAdmins: 1,
          totalSubjects: 0,
          storageUsedMB: 0,
        },
      });

      await tenant.save({ session });

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create admin user for the tenant
      const admin = new User({
        name: "Administrator",
        email: normalizedEmail,
        password: hashedPassword,
        role: "admin",
        tenantId: tenant._id,
        emailVerified: true,
        profileComplete: false,
        createdByAdmin: true,
        isFirstLogin: true,
      });

      await admin.save({ session });

      tenant.createdBy = admin._id;
      await tenant.save({ session });

      await session.commitTransaction();

      // Generate JWT token
      const token = jwt.sign(
        {
          userId: admin._id,
          role: "admin",
          tenantId: tenant._id,
        },
        process.env.JWT_SECRET,
        { expiresIn: "7d" },
      );

      const { logActivity } = require("../utils/activityLogger");
      logActivity({
        tenantId: tenant._id,
        userId: admin._id,
        description: `New tenant registered: ${tenant.name} (${tenant.subdomain})`,
        endpoint: '/api/tenant/register',
        statusCode: 201,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      return res.status(201).json({
        success: true,
        message: "Institution registered successfully!",
        data: {
          tenant: {
            id: tenant._id,
            name: tenant.name,
            subdomain: tenant.subdomain,
            subscription: tenant.subscription,
          },
          user: {
            id: admin._id,
            name: admin.name,
            email: admin.email,
            role: admin.role,
          },
          token,
        },
      });
    } catch (error) {
      await session.abortTransaction();
      logger.error("Transaction error", { error: error.message });
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    logger.error("Registration error", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Registration failed",
      error: error.message,
    });
  }
};

// ==================== PROTECTED FUNCTIONS (Require Authentication) ====================

/**
 * GET TENANT INFO
 * Get detailed information about the tenant
 * GET /api/tenant/info
 */
const getTenantInfo = async (req, res) => {
  try {
    const tenantId = req.tenantId;

    // Super admins / platform users have no tenant
    if (!tenantId) {
      return res.status(200).json({
        success: true,
        data: {
          tenant: null,
          plan: null
        }
      });
    }
    
    const tenant = await Tenant.findById(tenantId)
      .select('-limits -createdBy');
    
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    // ✅ Get up-to-date stats
    const [studentsCount, teachersCount, adminsCount, subjectsCount, storageUsedMB] = await Promise.all([
      User.countDocuments({ tenantId, role: 'student', isActive: { $ne: false } }),
      User.countDocuments({ tenantId, role: 'teacher', isActive: { $ne: false } }),
      User.countDocuments({ tenantId, role: 'admin', isActive: { $ne: false } }),
      Subject.countDocuments({ tenantId, isActive: { $ne: false } }),
      computeStorageUsedMB(tenantId),
    ]);

    const plan = await Plan.findOne({ code: tenant.subscription.plan })
      .select('name code description features modules pricing');

    return res.status(200).json({
      success: true,
      data: {
        tenant: {
          id: tenant._id,
          name: tenant.name,
          subdomain: tenant.subdomain,
          contact: tenant.contact,
          branding: tenant.branding,
          collegeMetadata: tenant.collegeMetadata || {
            institutionType: 'private',
            ugcCode: '',
            naacGrade: '',
            nirfEligible: false,
            aicteApproved: false,
          },
          settings: tenant.settings,
          subscription: tenant.subscription,
          limits: getEffectiveLimits(tenant.subscription?.plan, tenant.limits),
          createdAt: tenant.createdAt,
          stats: {
            students: studentsCount,
            teachers: teachersCount,
            admins: adminsCount,
            subjects: subjectsCount,
            storageUsed: storageUsedMB
          }
        },
        plan: plan ? {
          name: plan.name,
          code: plan.code,
          description: plan.description,
          features: plan.features,
          modules: require("../utils/planDefaults").getEffectiveModules(plan.code, plan.modules),
          pricing: plan.pricing
        } : {
          name: tenant.subscription?.plan ? tenant.subscription.plan.charAt(0).toUpperCase() + tenant.subscription.plan.slice(1) : "Free",
          code: tenant.subscription?.plan || "free",
          modules: require("../utils/planDefaults").getEffectiveModules(tenant.subscription?.plan),
        }
      }
    });

  } catch (error) {
    logger.error('Error fetching tenant info', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch tenant information',
      error: error.message
    });
  }
};

/**
 * UPDATE TENANT SETTINGS
 * Update tenant branding, settings, contact, and collegeMetadata
 * PUT /api/tenant/settings
 */
const updateTenantSettings = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { branding, settings, contact, collegeMetadata } = req.body;

    const tenant = await Tenant.findById(tenantId);

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: "Tenant not found",
      });
    }

    const oldBranding = tenant.branding ? { ...tenant.branding } : {};
    const oldSettings = tenant.settings ? { ...tenant.settings } : {};
    const oldCollegeMetadata = tenant.collegeMetadata ? { ...tenant.collegeMetadata } : {};

    if (branding) {
      tenant.branding = {
        ...(tenant.branding?.toObject ? tenant.branding.toObject() : tenant.branding),
        ...branding,
      };
      tenant.markModified('branding');
    }

    if (settings) {
      tenant.settings = {
        ...(tenant.settings?.toObject ? tenant.settings.toObject() : tenant.settings),
        ...settings,
      };
      tenant.markModified('settings');
    }

    if (contact) {
      tenant.contact = {
        ...(tenant.contact?.toObject ? tenant.contact.toObject() : tenant.contact),
        ...contact,
      };
      tenant.markModified('contact');
    }

    if (collegeMetadata) {
      tenant.collegeMetadata = {
        ...(tenant.collegeMetadata?.toObject ? tenant.collegeMetadata.toObject() : tenant.collegeMetadata),
        ...collegeMetadata,
      };
      tenant.markModified('collegeMetadata');
    }

    await tenant.save();

    // Invalidate tenant cache
    await cache.del(`tenant:${tenant._id}`);
    if (tenant.subdomain) {
      await cache.del(`tenant:subdomain:${tenant.subdomain}`);
    }

    const { logAudit } = require('../middleware/auditLogger');
    await logAudit(req, {
      action: 'TENANT_UPDATE',
      resourceType: 'Tenant',
      resourceId: tenant._id,
      before: { branding: oldBranding, settings: oldSettings, collegeMetadata: oldCollegeMetadata },
      after: { branding: tenant.branding, settings: tenant.settings, collegeMetadata: tenant.collegeMetadata },
    });

    return res.status(200).json({
      success: true,
      message: "Tenant settings updated successfully",
      data: {
        branding: tenant.branding,
        settings: tenant.settings,
        contact: tenant.contact,
        collegeMetadata: tenant.collegeMetadata,
      },
    });
  } catch (error) {
    logger.error("Error updating tenant settings", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Failed to update tenant settings",
      error: error.message,
    });
  }
};

/**
 * GET TENANT USAGE
 * Get current usage statistics against plan limits
 * GET /api/tenant/usage
 */

const getTenantUsage = async (req, res) => {
  try {
    const tenantId = req.tenantId;

    // Super admins / platform users have no tenant
    if (!tenantId) {
      return res.status(200).json({
        success: true,
        data: {
          tenant: null,
          plan: null,
          usage: {
            students: { current: 0, limit: 0, percentage: 0, remaining: 0 },
            teachers: { current: 0, limit: 0, percentage: 0, remaining: 0 },
            admins: { current: 0, limit: 0, percentage: 0, remaining: 0 },
            subjects: { current: 0, limit: 0, percentage: 0, remaining: 0 },
            storage: { current: 0, limit: 0, percentage: 0, remaining: 0 },
          },
          warnings: [],
          isOverLimit: false,
        },
      });
    }

    const tenant = await Tenant.findById(tenantId);

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: "Tenant not found",
      });
    }

    const plan = await Plan.findOne({ code: tenant.subscription.plan });

    // ✅ FIX: Get current counts correctly
    const [studentsCount, teachersCount, adminsCount, subjectsCount, storageUsedMB] =
      await Promise.all([
        User.countDocuments({ tenantId, role: "student", isActive: { $ne: false } }),
        User.countDocuments({ tenantId, role: "teacher", isActive: { $ne: false } }),
        User.countDocuments({ tenantId, role: "admin", isActive: { $ne: false } }),
        Subject.countDocuments({ tenantId, isActive: { $ne: false } }),
        computeStorageUsedMB(tenantId),
      ]);

    console.log("📊 Usage counts:", {
      students: studentsCount,
      teachers: teachersCount,
      admins: adminsCount,
      subjects: subjectsCount,
      storage: storageUsedMB,
    });

    // ✅ Update tenant stats
    tenant.stats.totalStudents = studentsCount;
    tenant.stats.totalTeachers = teachersCount;
    tenant.stats.totalAdmins = adminsCount;
    tenant.stats.totalSubjects = subjectsCount;
    tenant.stats.storageUsedMB = storageUsedMB;
    await tenant.save();

    // ✅ Get effective plan limits
    const effectiveLimits = getEffectiveLimits(tenant.subscription?.plan, tenant.limits);

    // Calculate usage percentages
    const studentUsage = {
      current: studentsCount,
      limit: effectiveLimits.maxStudents || 50,
      percentage:
        effectiveLimits.maxStudents > 0
          ? (studentsCount / effectiveLimits.maxStudents) * 100
          : 0,
      remaining: Math.max(0, (effectiveLimits.maxStudents || 50) - studentsCount),
    };

    const teacherUsage = {
      current: teachersCount,
      limit: effectiveLimits.maxTeachers || 5,
      percentage:
        effectiveLimits.maxTeachers > 0
          ? (teachersCount / effectiveLimits.maxTeachers) * 100
          : 0,
      remaining: Math.max(0, (effectiveLimits.maxTeachers || 5) - teachersCount),
    };

    const adminUsage = {
      current: adminsCount,
      limit: effectiveLimits.maxAdmins || 1,
      percentage:
        effectiveLimits.maxAdmins > 0
          ? (adminsCount / effectiveLimits.maxAdmins) * 100
          : 0,
      remaining: Math.max(0, (effectiveLimits.maxAdmins || 1) - adminsCount),
    };

    const subjectUsage = {
      current: subjectsCount,
      limit: effectiveLimits.maxSubjects || 100,
      percentage:
        effectiveLimits.maxSubjects > 0
          ? (subjectsCount / effectiveLimits.maxSubjects) * 100
          : 0,
      remaining: Math.max(
        0,
        (effectiveLimits.maxSubjects || 100) - subjectsCount,
      ),
    };

    const storageUsage = {
      current: storageUsedMB,
      limit: effectiveLimits.maxStorageMB || 1024,
      percentage:
        effectiveLimits.maxStorageMB > 0
          ? (storageUsedMB / effectiveLimits.maxStorageMB) *
            100
          : 0,
      remaining: Math.max(
        0,
        (effectiveLimits.maxStorageMB || 1024) - storageUsedMB,
      ),
    };

    // Check if any limits are exceeded
    const warnings = [];
    if (studentsCount >= effectiveLimits.maxStudents) {
      warnings.push({
        type: "student",
        message: `Student limit reached (${studentsCount}/${effectiveLimits.maxStudents}). Please upgrade your plan.`,
      });
    }
    if (teachersCount >= effectiveLimits.maxTeachers) {
      warnings.push({
        type: "teacher",
        message: `Teacher limit reached (${teachersCount}/${effectiveLimits.maxTeachers}). Please upgrade your plan.`,
      });
    }
    if (subjectsCount >= (effectiveLimits.maxSubjects || 100)) {
      warnings.push({
        type: "subject",
        message: `Subject limit reached (${subjectsCount}/${effectiveLimits.maxSubjects || 100}). Please upgrade your plan.`,
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        tenant: {
          id: tenant._id,
          name: tenant.name,
          subdomain: tenant.subdomain,
          subscription: {
            plan: tenant.subscription.plan,
            status: tenant.subscription.status,
            trialEndsAt: tenant.subscription.status === 'trial' ? tenant.subscription.trialEndsAt : null,
            billingCycle: tenant.subscription.billingCycle,
          },
        },
        plan: {
          name: plan?.name || (tenant.subscription?.plan ? tenant.subscription.plan.charAt(0).toUpperCase() + tenant.subscription.plan.slice(1) : "Free"),
          code: plan?.code || tenant.subscription?.plan || "free",
          features: plan?.features || [],
          modules: require("../utils/planDefaults").getEffectiveModules(plan?.code || tenant.subscription?.plan, plan?.modules),
        },
        usage: {
          students: studentUsage,
          teachers: teacherUsage,
          admins: adminUsage,
          subjects: subjectUsage,
          storage: storageUsage,
        },
        warnings,
        isOverLimit: warnings.length > 0,
      },
    });
  } catch (error) {
    logger.error("Error fetching tenant usage", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Failed to fetch tenant usage",
      error: error.message,
    });
  }
};

/**
 * GET SETUP STATUS
 * Get onboarding progress for the tenant
 * GET /api/tenant/setup-status
 */
const getSetupStatus = async (req, res) => {
  try {
    const tenantId = req.tenantId;

    const [teachersCount, studentsCount, subjectsCount] = await Promise.all([
      User.countDocuments({ tenantId, role: "teacher", isActive: true }),
      User.countDocuments({ tenantId, role: "student", isActive: true }),
      Subject.countDocuments({ tenantId, isActive: true }),
    ]);

    const admin = await User.findOne({ tenantId, role: "admin" });

    const steps = {
      profile: {
        name: "Complete Profile",
        description: "Set up your institution profile",
        completed: admin?.profileComplete || false,
        required: true,
      },
      teachers: {
        name: "Add Teachers",
        description: "Create teacher accounts",
        completed: teachersCount > 0,
        required: false,
        current: teachersCount,
        target: 1,
      },
      subjects: {
        name: "Add Subjects",
        description: "Create subjects for your institution",
        completed: subjectsCount > 0,
        required: true,
        current: subjectsCount,
        target: 1,
      },
      students: {
        name: "Upload Students",
        description: "Upload student enrollments",
        completed: studentsCount > 0,
        required: true,
        current: studentsCount,
        target: 1,
      },
    };

    const completedSteps = Object.values(steps).filter(
      (step) => step.completed,
    ).length;
    const totalRequiredSteps = Object.values(steps).filter(
      (step) => step.required,
    ).length;
    const allCompleted = completedSteps >= totalRequiredSteps;
    const percentage = Math.round(
      (completedSteps / Object.keys(steps).length) * 100,
    );

    // Get next step suggestion
    let nextStep = null;
    for (const [key, step] of Object.entries(steps)) {
      if (!step.completed && step.required) {
        nextStep = {
          id: key,
          name: step.name,
          description: step.description,
        };
        break;
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        steps,
        allCompleted,
        percentage,
        nextStep,
        tenant: {
          name: req.tenant.name,
          subdomain: req.tenant.subdomain,
          subscription: req.tenant.subscription,
        },
      },
    });
  } catch (error) {
    logger.error("Error fetching setup status", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Failed to fetch setup status",
      error: error.message,
    });
  }
};

/**
 * COMPLETE SETUP STEP
 * Mark a specific setup step as completed
 * POST /api/tenant/setup/complete
 */
const completeSetupStep = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { step } = req.body;

    if (!step) {
      return res.status(400).json({
        success: false,
        message: "Step name is required",
      });
    }

    const tenant = await Tenant.findById(tenantId);

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: "Tenant not found",
      });
    }

    if (!tenant.setupProgress) {
      tenant.setupProgress = {};
    }

    tenant.setupProgress[step] = {
      completed: true,
      completedAt: new Date(),
    };

    await tenant.save();

    // If profile is completed, update admin profileComplete flag
    if (step === "profile") {
      const admin = await User.findOne({ tenantId, role: "admin" });
      if (admin && !admin.profileComplete) {
        admin.profileComplete = true;
        await admin.save();
      }
    }

    return res.status(200).json({
      success: true,
      message: `Step '${step}' marked as completed`,
      data: {
        step,
        completedAt: tenant.setupProgress[step].completedAt,
      },
    });
  } catch (error) {
    logger.error("Error completing setup step", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Failed to update setup status",
      error: error.message,
    });
  }
};

/**
 * GET DASHBOARD STATS
 * Get dashboard statistics for the tenant admin
 * GET /api/tenant/dashboard-stats
 */
const getDashboardStats = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    
    const [studentsCount, teachersCount, adminsCount, subjectsCount, todayAttendance, pendingTickets] = await Promise.all([
      User.countDocuments({ tenantId, role: 'student', isActive: true }),
      User.countDocuments({ tenantId, role: 'teacher', isActive: true }),
      User.countDocuments({ tenantId, role: 'admin', isActive: true }),
      Subject.countDocuments({ tenantId, isActive: true }),
      // Today's attendance count
      require('../models/Attendance').countDocuments({
        tenantId,
        date: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          $lt: new Date(new Date().setHours(23, 59, 59, 999))
        }
      }),
      // Pending tickets count
      require('../models/Ticket').countDocuments({
        tenantId,
        status: 'open'
      })
    ]);

    // Update tenant stats
    await Tenant.findByIdAndUpdate(tenantId, {
      'stats.totalStudents': studentsCount,
      'stats.totalTeachers': teachersCount,
      'stats.totalAdmins': adminsCount,
      'stats.totalSubjects': subjectsCount
    });

    // Get recent activities (parallelized)
    const [recentEnrollments, recentTickets] = await Promise.all([
      require('../models/Enrollment').find({ tenantId })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('firstName lastName enrollmentNumber createdAt'),
      require('../models/Ticket').find({ tenantId })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('studentId', 'name')
        .select('studentId reason status createdAt')
    ]);

    const recentActivities = [];

    recentEnrollments.forEach(en => {
      recentActivities.push({
        type: 'enrollment',
        message: `New student enrolled: ${en.firstName} ${en.lastName} (${en.enrollmentNumber})`,
        time: en.createdAt,
        icon: 'UserPlus'
      });
    });

    recentTickets.forEach(ticket => {
      recentActivities.push({
        type: 'ticket',
        message: `New ticket from ${ticket.studentId?.name || 'Student'}: ${ticket.reason}`,
        time: ticket.createdAt,
        status: ticket.status,
        icon: 'Ticket'
      });
    });

    // Sort activities by time
    recentActivities.sort((a, b) => new Date(b.time) - new Date(a.time));
    const topActivities = recentActivities.slice(0, 10);

    return res.status(200).json({
      success: true,
      data: {
        counts: {
          students: studentsCount,
          teachers: teachersCount,
          admins: adminsCount,
          subjects: subjectsCount,
          todayAttendance,
          pendingTickets
        },
        recentActivities: topActivities,
        stats: {
          totalStudents: studentsCount,
          totalTeachers: teachersCount,
          totalAdmins: adminsCount,
          totalSubjects: subjectsCount
        }
      }
    });

  } catch (error) {
    logger.error('Error fetching dashboard stats', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
      error: error.message
    });
  }
};

const path = require('path');
const fs = require('fs');

const uploadBrandingImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const tenantId = req.tenantId;
    const imageType = req.body.type === "favicon" ? "favicon" : "logo";
    const relativePath = `uploads/${req.file.filename}`;
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const imageUrl = `${baseUrl}/${relativePath}`;

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return res.status(404).json({ success: false, message: "Tenant not found" });
    }

    if (!tenant.branding) tenant.branding = {};
    tenant.branding[imageType] = imageUrl;
    await tenant.save();

    // Invalidate tenant cache
    await cache.del(`tenant:${tenant._id}`);
    if (tenant.subdomain) {
      await cache.del(`tenant:subdomain:${tenant.subdomain}`);
    }

    return res.status(200).json({
      success: true,
      message: `${imageType} uploaded successfully`,
      data: { [imageType]: imageUrl },
    });
  } catch (error) {
    logger.error("Error uploading branding image", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to upload image" });
  }
};

module.exports = {
  // Public functions
  registerTenant,

  // Protected functions
  getTenantInfo,
  updateTenantSettings,
  getTenantUsage,
  uploadBrandingImage,
  getSetupStatus,
  completeSetupStep,
  getDashboardStats,
};
