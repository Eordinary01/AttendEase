const DEFAULT_PLAN_MODULES = {
  free: {
    attendance: true,
    biometricAttendance: false,
    timetable: false,
    timetableManagement: false,
    customRoles: false,
    roleManagement: false,
    examManagement: false,
    examStructure: false,
    examSeating: false,
    financeManagement: false,
    libraryManagement: false,
    hrManagement: false,
    parentPortal: false,
    analytics: false,
    apiAccess: false,
    customBranding: false,
    dataExport: false,
    bulkOperations: false,
    bulkImport: false,
    academicStructure: true,
    whiteLabel: false,
    prioritySupport: false,
    dedicatedSupport: false,
    alerts: true,
    alertsManagement: true,
    calendar: true,
    calendarManagement: true,
    reports: false,
  },
  basic: {
    attendance: true,
    biometricAttendance: false,
    timetable: true,
    timetableManagement: true,
    customRoles: false,
    roleManagement: false,
    examManagement: true,
    examStructure: false,
    examSeating: false,
    financeManagement: false,
    libraryManagement: false,
    hrManagement: false,
    parentPortal: false,
    analytics: true,
    apiAccess: false,
    customBranding: false,
    dataExport: true,
    bulkOperations: false,
    bulkImport: false,
    academicStructure: true,
    whiteLabel: false,
    prioritySupport: true,
    dedicatedSupport: false,
    alerts: true,
    alertsManagement: true,
    calendar: true,
    calendarManagement: true,
    reports: true,
  },
  professional: {
    attendance: true,
    biometricAttendance: false,
    timetable: true,
    timetableManagement: true,
    customRoles: true,
    roleManagement: true,
    examManagement: true,
    examStructure: false,
    examSeating: true,
    financeManagement: true,
    libraryManagement: true,
    hrManagement: false,
    parentPortal: true,
    analytics: true,
    apiAccess: true,
    customBranding: true,
    dataExport: true,
    bulkOperations: false,
    bulkImport: false,
    academicStructure: true,
    whiteLabel: false,
    prioritySupport: true,
    dedicatedSupport: false,
    alerts: true,
    alertsManagement: true,
    calendar: true,
    calendarManagement: true,
    reports: true,
  },
  enterprise: {
    attendance: true,
    biometricAttendance: true,
    timetable: true,
    timetableManagement: true,
    customRoles: true,
    roleManagement: true,
    examManagement: true,
    examStructure: true,
    examSeating: true,
    financeManagement: true,
    libraryManagement: true,
    hrManagement: true,
    parentPortal: true,
    analytics: true,
    apiAccess: true,
    customBranding: true,
    dataExport: true,
    bulkOperations: true,
    bulkImport: true,
    academicStructure: true,
    whiteLabel: true,
    prioritySupport: true,
    dedicatedSupport: true,
    alerts: true,
    alertsManagement: true,
    calendar: true,
    calendarManagement: true,
    reports: true,
  },
};

const DEFAULT_PLAN_LIMITS = {
  free: {
    maxStudents: 50,
    maxTeachers: 5,
    maxAdmins: 1,
    maxSubjects: 20,
    maxStorageMB: 1024,
    maxAPIcallsPerDay: 1000,
  },
  basic: {
    maxStudents: 200,
    maxTeachers: 20,
    maxAdmins: 3,
    maxSubjects: 50,
    maxStorageMB: 10240,
    maxAPIcallsPerDay: 10000,
  },
  professional: {
    maxStudents: 1000,
    maxTeachers: 100,
    maxAdmins: 10,
    maxSubjects: 200,
    maxStorageMB: 51200,
    maxAPIcallsPerDay: 50000,
  },
  enterprise: {
    maxStudents: 10000,
    maxTeachers: 1000,
    maxAdmins: 50,
    maxSubjects: 1000,
    maxStorageMB: 512000,
    maxAPIcallsPerDay: 1000000,
  },
};

/**
 * Returns merged, effective module flags for a given plan code and optional raw modules object.
 */
const getEffectiveModules = (planCode, rawModules = {}) => {
  const code = (planCode || "free").toLowerCase();
  const defaults = DEFAULT_PLAN_MODULES[code] || DEFAULT_PLAN_MODULES.free;
  const merged = { ...defaults };
  if (rawModules && typeof rawModules === "object") {
    Object.keys(rawModules).forEach((key) => {
      const val = rawModules[key];
      // Only explicit raw flags override defaults; undefined/null (unset Mongoose
      // paths on non-lean documents) fall back to the plan's default value.
      if (val !== undefined && val !== null) {
        merged[key] = val;
      }
    });
  }

  // Enterprise plan ALWAYS includes ALL features and modules enabled
  if (code === "enterprise") {
    Object.keys(DEFAULT_PLAN_MODULES.enterprise).forEach((key) => {
      merged[key] = true;
    });
  }

  return merged;
};

/**
 * Returns merged, effective resource limits for a given plan code and optional raw limits object.
 */
const getEffectiveLimits = (planCode, rawLimits = {}) => {
  const code = (planCode || "free").toLowerCase();
  const defaults = DEFAULT_PLAN_LIMITS[code] || DEFAULT_PLAN_LIMITS.free;
  const merged = { ...defaults };
  if (rawLimits && typeof rawLimits === "object") {
    Object.keys(rawLimits).forEach((key) => {
      const val = rawLimits[key];
      // Keep rawLimit if provided and higher than default or explicitly overridden
      if (val !== undefined && val !== null) {
        merged[key] = Math.max(merged[key] || 0, val);
      }
    });
  }
  return merged;
};

/**
 * Applies a plan upgrade/change to a Tenant instance:
 * 1. Sets tenant.subscription.plan = planCode
 * 2. Recalculates effective limits & modules
 * 3. Auto-enables plan features in tenant.settings (parent portal, online payments, etc.)
 * 4. Marks modified fields for Mongoose change tracking
 */
const applyPlanUpgradeToTenant = (tenant, planCode) => {
  if (!tenant || !planCode) return;

  const code = String(planCode).toLowerCase();
  tenant.subscription.plan = code;

  if (tenant.subscription.status === 'active' || code !== 'free') {
    tenant.subscription.trialEndsAt = null;
  }

  const effectiveLimits = getEffectiveLimits(code, tenant.limits);
  const effectiveModules = getEffectiveModules(code, tenant.modules);

  tenant.limits = effectiveLimits;
  tenant.modules = effectiveModules;

  if (!tenant.settings) tenant.settings = {};

  if (effectiveModules.parentPortal) {
    tenant.settings.enableParentPortal = true;
  }
  if (effectiveModules.financeManagement) {
    tenant.settings.enableOnlinePayments = true;
  }

  if (typeof tenant.markModified === 'function') {
    tenant.markModified('limits');
    tenant.markModified('modules');
    tenant.markModified('settings');
    tenant.markModified('subscription');
  }
};

module.exports = {
  DEFAULT_PLAN_MODULES,
  DEFAULT_PLAN_LIMITS,
  getEffectiveModules,
  getEffectiveLimits,
  applyPlanUpgradeToTenant,
};
