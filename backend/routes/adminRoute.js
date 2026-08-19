/**
 * Admin Routes
 * All routes require authentication
 * - Tenant Admin routes: require admin role (tenant-level management)
 * - Super Admin routes: require super_admin role (platform-level management)
 */

const express = require("express");
const adminRoute = express.Router();

// Import middleware
const {
  authenticateToken,
  adminAuth,
  authorizeRoles,
} = require("../middleware/auth");
const { featureGuard, limitGuard } = require("../middleware/featureGuard");
const { requirePermission, requireAnyPermission } = require("../middleware/permission");
const { require2FA } = require("../middleware/require2FA");
const upload = require("../middleware/fileUpload");
const validate = require("../middleware/validate");
const {
  createTeacher,
  createSubject,
  assignSubjectToTeacher,
  uploadEnrollments,
} = require("../validators/admin");

// Import controllers
const {
  // Tenant Admin functions
  getAllTeachers,
  createTeacher: createTeacherCtrl,
  getAllSubjects,
  createSubject: createSubjectCtrl,
  bulkCreateSubjects,
  bulkCreateTeachers,
  assignSubjectToTeacher: assignSubjectToTeacherCtrl,
  updateSubjectAssignment,
  getActiveSections,
  uploadEnrollments: uploadEnrollmentsCtrl,
  getAllEnrollments,
  getEnrollmentById,
  getEnrollmentsBySection,
  getMyEnrollment,
  getAllAssignments,
  deleteAssignment,
  getAssignmentsByTeacher,
  getAssignmentsBySubject,
  getAssignmentsBySection,

  // Super Admin functions
  getAllTenants,
  getTenantDetails,
  updateTenantSubscription,
  suspendTenant,
  activateTenant,
  deleteTenant,
  getPlatformStats,
  getAllLeads,
  updateLeadStatus,
  deleteLead,
  getLeadStats,
} = require("../controllers/adminController");

const {
  getActivityLogs,
  getRecentActivity,
  getActivityStats,
  getLogTenants,
} = require("../controllers/monitoringController");

const { deleteTeacher } = require("../controllers/userController");

// ==================== BASIC ROUTES (Free tier) ====================
adminRoute.get("/teachers", authenticateToken, authorizeRoles(["admin", "teacher"]), getAllTeachers);
adminRoute.get("/subjects", authenticateToken, authorizeRoles(["admin", "teacher"]), getAllSubjects);
adminRoute.get("/enrollments", authenticateToken, authorizeRoles(["admin", "teacher"]), requireAnyPermission("fee:collect", "students:read"), getAllEnrollments);
adminRoute.get(
  "/enrollments/:id",
  authenticateToken,
  adminAuth,
  getEnrollmentById,
);
adminRoute.get(
  "/enrollments/section/:section",
  authenticateToken,
  adminAuth,
  getEnrollmentsBySection,
);
adminRoute.get("/my-enrollment", authenticateToken, getMyEnrollment);
adminRoute.get("/active-sections", authenticateToken, adminAuth, getActiveSections);
adminRoute.get("/assignments", authenticateToken, adminAuth, getAllAssignments);
adminRoute.get(
  "/assignments/teacher/:teacherId",
  authenticateToken,
  adminAuth,
  getAssignmentsByTeacher,
);
adminRoute.get(
  "/assignments/subject/:subjectId",
  authenticateToken,
  adminAuth,
  getAssignmentsBySubject,
);
adminRoute.get(
  "/assignments/section/:section",
  authenticateToken,
  adminAuth,
  getAssignmentsBySection,
);
adminRoute.delete(
  "/assignments/:assignmentId",
  authenticateToken,
  adminAuth,
  deleteAssignment
);
adminRoute.delete(
  "/assignments",
  authenticateToken,
  adminAuth,
  deleteAssignment
);
adminRoute.post(
  "/assign-subject",
  authenticateToken,
  adminAuth,
  assignSubjectToTeacher,
  assignSubjectToTeacherCtrl,
);
adminRoute.put(
  "/assign-subject",
  authenticateToken,
  adminAuth,
  updateSubjectAssignment,
);
adminRoute.put(
  "/assignments/:assignmentId",
  authenticateToken,
  adminAuth,
  updateSubjectAssignment,
);

// ==================== RESOURCE-LIMITED ROUTES ====================
// ✅ Delete teacher
adminRoute.delete(
  "/teachers/:id",
  authenticateToken,
  adminAuth,
  deleteTeacher,
);

// ✅ Check teacher limit before creating
adminRoute.post(
  "/create-teacher",
  authenticateToken,
  adminAuth,
  limitGuard("teacher"),
  createTeacher,
  createTeacherCtrl,
);

// ✅ Check student limit before uploading
adminRoute.post(
  "/upload-enrollments",
  authenticateToken,
  adminAuth,
  upload.single("file"),
  limitGuard("student"),
  uploadEnrollments,
  uploadEnrollmentsCtrl,
);

// ✅ Check subject limit before creating
adminRoute.post(
  "/create-subject",
  authenticateToken,
  adminAuth,
  limitGuard("subject"),
  createSubject,
  createSubjectCtrl,
);

// ✅ Bulk creation (Plan gated: bulk_operations)
adminRoute.post(
  "/bulk-subjects",
  authenticateToken,
  adminAuth,
  featureGuard("bulk_operations"),
  limitGuard("subject"),
  bulkCreateSubjects
);

adminRoute.post(
  "/bulk-teachers",
  authenticateToken,
  adminAuth,
  featureGuard("bulk_operations"),
  limitGuard("teacher"),
  bulkCreateTeachers
);

// ==================== SUPER ADMIN ROUTES ====================
// These routes are for platform-wide management across all tenants
// All require super_admin role

/**
 * GET /api/admin/super/tenants
 * Get all tenants in the platform
 * Requires: Authentication + Super Admin role
 */
adminRoute.get(
  "/super/tenants",
  authenticateToken,
  authorizeRoles(["super_admin"]),
  getAllTenants,
);

/**
 * GET /api/admin/super/tenants/:tenantId
 * Get details of a specific tenant
 * Requires: Authentication + Super Admin role
 */
adminRoute.get(
  "/super/tenants/:tenantId",
  authenticateToken,
  authorizeRoles(["super_admin"]),
  getTenantDetails,
);

/**
 * PUT /api/admin/super/tenants/:tenantId/subscription
 * Update a tenant's subscription plan
 * Requires: Authentication + Super Admin role
 * Body: { plan, status, billingCycle }
 */
adminRoute.put(
  "/super/tenants/:tenantId/subscription",
  authenticateToken,
  authorizeRoles(["super_admin"]),
  require2FA,
  updateTenantSubscription,
);

/**
 * POST /api/admin/super/tenants/:tenantId/suspend
 * Suspend a tenant (prevents access)
 * Requires: Authentication + Super Admin role
 */
adminRoute.post(
  "/super/tenants/:tenantId/suspend",
  authenticateToken,
  authorizeRoles(["super_admin"]),
  require2FA,
  suspendTenant,
);

/**
 * POST /api/admin/super/tenants/:tenantId/activate
 * Activate a suspended tenant
 * Requires: Authentication + Super Admin role
 */
adminRoute.post(
  "/super/tenants/:tenantId/activate",
  authenticateToken,
  authorizeRoles(["super_admin"]),
  require2FA,
  activateTenant,
);

/**
 * DELETE /api/admin/super/tenants/:tenantId
 * Delete a tenant and all associated data
 * Requires: Authentication + Super Admin role
 */
adminRoute.delete(
  "/super/tenants/:tenantId",
  authenticateToken,
  authorizeRoles(["super_admin"]),
  require2FA,
  deleteTenant,
);

/**
 * GET /api/admin/super/stats
 * Get platform-wide statistics
 * Requires: Authentication + Super Admin role
 */
adminRoute.get(
  "/super/stats",
  authenticateToken,
  authorizeRoles(["super_admin"]),
  getPlatformStats,
);

// ==================== SUPER ADMIN LEAD MANAGEMENT ====================

/**
 * GET /api/admin/super/leads
 * Get all leads with pagination, filters
 * Requires: Authentication + Super Admin role
 * Query: page, limit, type, status, search
 */
adminRoute.get(
  "/super/leads",
  authenticateToken,
  authorizeRoles(["super_admin"]),
  getAllLeads,
);

/**
 * GET /api/admin/super/leads/stats
 * Get lead statistics
 * Requires: Authentication + Super Admin role
 */
adminRoute.get(
  "/super/leads/stats",
  authenticateToken,
  authorizeRoles(["super_admin"]),
  getLeadStats,
);

/**
 * PATCH /api/admin/super/leads/:id
 * Update lead status
 * Requires: Authentication + Super Admin role
 * Body: { status }
 */
adminRoute.patch(
  "/super/leads/:id",
  authenticateToken,
  authorizeRoles(["super_admin"]),
  updateLeadStatus,
);

/**
 * DELETE /api/admin/super/leads/:id
 * Delete a lead
 * Requires: Authentication + Super Admin role
 */
adminRoute.delete(
  "/super/leads/:id",
  authenticateToken,
  authorizeRoles(["super_admin"]),
  require2FA,
  deleteLead,
);

// ==================== SUPER ADMIN MONITORING ====================
// Platform-wide activity log & real-time monitoring

/**
 * GET /api/admin/super/logs
 * Paginated, filterable activity log across all tenants
 */
adminRoute.get(
  "/super/logs",
  authenticateToken,
  authorizeRoles(["super_admin"]),
  getActivityLogs,
);

/**
 * GET /api/admin/super/logs/recent?since=<epochMs>
 * Newest activity since a timestamp (live feed)
 */
adminRoute.get(
  "/super/logs/recent",
  authenticateToken,
  authorizeRoles(["super_admin"]),
  getRecentActivity,
);

/**
 * GET /api/admin/super/logs/stats?hours=24
 * Aggregated stats for the monitoring dashboard
 */
adminRoute.get(
  "/super/logs/stats",
  authenticateToken,
  authorizeRoles(["super_admin"]),
  getActivityStats,
);

/**
 * GET /api/admin/super/logs/tenants
 * Tenants with 24h activity counts (filter dropdown)
 */
adminRoute.get(
  "/super/logs/tenants",
  authenticateToken,
  authorizeRoles(["super_admin"]),
  getLogTenants,
);


module.exports = adminRoute;