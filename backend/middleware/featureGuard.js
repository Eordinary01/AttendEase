const Plan = require("../models/Plan");
const User = require("../models/User");
const APILog = require("../models/APILog");
const logger = require("../utils/logger");
const cache = require("./cache");

const displayNames = {
  attendance: "Attendance Management",
  biometric_attendance: "AI Biometric Face Attendance",
  face_attendance: "AI Biometric Face Attendance",
  exam_management: "Exam Management",
  exam_structure: "Exam Structure Configuration",
  exam_seating: "Exam Seating & Hall Tickets",
  finance_management: "Finance Management",
  library_management: "Library Management",
  hr_management: "HR Management",
  parent_portal: "Parent Portal",
  analytics: "Advanced Analytics",
  api_access: "API Access",
  custom_branding: "Custom Branding",
  data_export: "Data Export",
  bulk_operations: "Bulk Operations",
  academic_structure: "Academic Structure (Courses, Branches & Semesters)",
  white_label: "White Label Solution",
  dedicated_support: "Dedicated Support",
  priority_support: "Priority Support",
  basic_reports: "Basic Reports",
  email_support: "Email Support",
  timetable: "Timetable Management",
  timetable_management: "Timetable Management",
  custom_roles: "Custom Roles & RBAC",
  role_management: "Role Management",
  alerts: "Alerts & Notifications",
  calendar: "Academic Calendar",
  reports: "Reports & Analytics",
};

const { getEffectiveModules } = require("../utils/planDefaults");

// Plans store module flags in camelCase (e.g. bulkOperations), while feature
// guards are conventionally called with snake_case names (e.g. bulk_operations).
const toModuleKey = (name) => name.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

const moduleEnabled = (plan, featureName) => {
  const effectiveModules = getEffectiveModules(plan?.code, plan?.modules);
  return effectiveModules[featureName] === true || effectiveModules[toModuleKey(featureName)] === true;
};

async function findRequiredPlan(featureName) {
  const plans = await Plan.find({ isActive: true }).sort({ sortOrder: 1 }).lean();
  for (const plan of plans) {
    if (moduleEnabled(plan, featureName)) {
      return plan.code;
    }
  }
  return "enterprise";
}

function getFeatureDisplayName(featureName) {
  return displayNames[featureName] || featureName;
}

const featureGuard = (featureName, options = {}) => {
  return async (req, res, next) => {
    try {
      if (req.user?.role === 'super_admin') {
        return next();
      }

      if (!req.tenant) {
        return res.status(403).json({
          success: false,
          message: "Tenant not identified",
        });
      }

      // authenticateToken flattens req.tenant (plan at top level), while the
      // global tenantResolver leaves the full Tenant doc (subscription.plan).
      const planCode = req.tenant.subscription?.plan || req.tenant.plan;
      const tenantId = req.tenant._id || req.tenant.id;

      const planCacheKey = `plan:${planCode}`;
      let plan = await cache.get(planCacheKey);
      if (!plan) {
        plan = await Plan.findOne({ code: planCode }).lean();
        if (plan) await cache.set(planCacheKey, plan, 60);
      }

      if (!plan) {
        return res.status(403).json({
          success: false,
          message: "Plan configuration not found",
        });
      }

      const hasFeature = moduleEnabled(plan, featureName);

      if (!hasFeature) {
        const requiredPlan = await findRequiredPlan(featureName);

        return res.status(403).json({
          success: false,
          message: `'${getFeatureDisplayName(featureName)}' feature is not available in your current plan`,
          currentPlan: planCode,
          requiredPlan,
          upgradeRequired: true,
          upgradeUrl: `/pricing?plan=${requiredPlan}&feature=${featureName}`,
          feature: featureName,
        });
      }

      // Optional: Check API rate limits for API access feature
      if (options.rateLimit && featureName === "api_access") {
        const apiCallsToday = await getAPICallsCount(tenantId);
        const maxCalls = req.tenant.limits?.maxAPIcallsPerDay || 10000;

        if (apiCallsToday >= maxCalls) {
          return res.status(429).json({
            success: false,
            message:
              "Daily API call limit exceeded. Upgrade your plan for higher limits.",
            limit: maxCalls,
            current: apiCallsToday,
            upgradeRequired: true,
          });
        }
      }

      next();
    } catch (error) {
      logger.error("Feature guard error", { error: error.message });
      return res.status(500).json({
        success: false,
        message: "Feature check failed",
        error: error.message,
      });
    }
  };
};

/**
 * LIMIT GUARD MIDDLEWARE
 * Checks if tenant has reached resource limits
 */
const limitGuard = (resourceType) => {
  return async (req, res, next) => {
    try {
      if (!req.tenant) {
        return res.status(403).json({
          success: false,
          message: "Tenant not identified",
        });
      }

      const tenantId = req.tenant._id || req.tenant.id;

      if (!req.tenant.limits) {
        logger.warn("Tenant limits not found, using defaults");
        req.tenant.limits = {
          maxStudents: 50,
          maxTeachers: 5,
          maxAdmins: 1,
          maxSubjects: 100,
          maxStorageMB: 1024,
          maxAPIcallsPerDay: 10000,
        };
      }

      const limits = req.tenant.limits;

      let currentCount = 0;
      let limit = 0;
      let resourceName = "";

      // Get current count based on resource type
      switch (resourceType) {
        case "student":
          currentCount = await User.countDocuments({
            tenantId: tenantId,
            role: "student",
            isActive: true,
          });
          limit = limits.maxStudents || 50;
          resourceName = "Students";
          break;

        case "teacher":
          currentCount = await User.countDocuments({
            tenantId: tenantId,
            role: "teacher",
            isActive: true,
          });
          limit = limits.maxTeachers || 5;
          resourceName = "Teachers";
          break;

        case "admin":
          currentCount = await User.countDocuments({
            tenantId: tenantId,
            role: "admin",
            isActive: true,
          });
          limit = limits.maxAdmins || 1;
          resourceName = "Admins";
          break;

        case "subject":
          const Subject = require("../models/Subject");
          currentCount = await Subject.countDocuments({
            tenantId: tenantId,
            isActive: true,
          });
          limit = limits.maxSubjects || 100;
          resourceName = "Subjects";
          break;

        default:
          return next();
      }

      // console.log(`📊 Limit check - ${resourceName}: ${currentCount}/${limit}`);

      if (currentCount >= limit) {
        const percentage = (currentCount / limit) * 100;

        return res.status(403).json({
          success: false,
          message: `${resourceName} limit exceeded (${currentCount}/${limit}). Please upgrade your plan to add more.`,
          resourceType,
          current: currentCount,
          limit: limit,
          percentage: Math.round(percentage),
          upgradeRequired: true,
          upgradeUrl: "/pricing",
        });
      }

      next();
    } catch (error) {
      logger.error("Limit guard error", { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        message: "Resource limit check failed",
        error: error.message,
      });
    }
  };
};

/**
 * USAGE GUARD MIDDLEWARE
 * Tracks and enforces usage-based limits
 */
const usageGuard = (metricType) => {
  return async (req, res, next) => {
    try {
      if (!req.tenant) {
        return res.status(403).json({
          success: false,
          message: "Tenant not identified",
        });
      }

      const tenantId = req.tenant._id || req.tenant.id;

      if (!req.tenant.limits) {
        req.tenant.limits = {
          maxStudents: 50,
          maxTeachers: 5,
          maxAdmins: 1,
          maxSubjects: 100,
          maxStorageMB: 1024,
          maxAPIcallsPerDay: 10000,
        };
      }

      const limits = req.tenant.limits;

      let currentUsage = 0;
      let limit = 0;

      switch (metricType) {
        case "storage":
          currentUsage = tenant.stats?.storageUsedMB || 0;
          limit = limits.maxStorageMB || 1024;
          break;

        case "api_calls":
          currentUsage = await getAPICallsCount(tenantId);
          limit = limits.maxAPIcallsPerDay || 10000;
          break;

        default:
          return next();
      }

      if (currentUsage >= limit) {
        return res.status(403).json({
          success: false,
          message: `${metricType.toUpperCase()} limit exceeded. Upgrade your plan for more capacity.`,
          metricType,
          current: currentUsage,
          limit: limit,
          upgradeRequired: true,
        });
      }

      next();
    } catch (error) {
      logger.error("Usage guard error", { error: error.message, stack: error.stack });
      next();
    }
  };
};

async function getAPICallsCount(tenantId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return await APILog.countDocuments({
    tenantId: tenantId,
    createdAt: { $gte: today },
  });
}

module.exports = {
  featureGuard,
  limitGuard,
  usageGuard,
};
