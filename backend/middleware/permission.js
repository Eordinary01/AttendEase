const CustomRole = require("../models/CustomRole");
const logger = require("../utils/logger");

const requirePermission = (...requiredPermissions) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: "Authentication required" });
      }

      if (req.user.role === "super_admin") return next();

      if (req.user.role === "admin") return next();

      if (req.user.role === "teacher" && req.user.customRoles?.length > 0) {
        const roleIds = req.user.customRoles.map(cr => cr.roleId);
        const roles = await CustomRole.find({ _id: { $in: roleIds }, isActive: true }).lean();
        const userPermissions = new Set();
        roles.forEach(role => {
          (role.permissions || []).forEach(p => userPermissions.add(p));
        });

        const hasAll = requiredPermissions.every(p => userPermissions.has(p));
        if (hasAll) return next();

        return res.status(403).json({
          success: false,
          message: `Missing required permission(s): ${requiredPermissions.join(", ")}`,
        });
      }

      return res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action",
      });
    } catch (error) {
      logger.error("Permission check error", { error: error.message, stack: error.stack });
      return res.status(500).json({ success: false, message: "Server error" });
    }
  };
};

const getRolePermissions = async (user) => {
  if (!user.customRoles?.length) return new Set();
  const roleIds = user.customRoles.map(cr => cr.roleId);
  const roles = await CustomRole.find({ _id: { $in: roleIds }, isActive: true }).lean();
  const perms = new Set();
  roles.forEach(role => (role.permissions || []).forEach(p => perms.add(p)));
  return perms;
};

/**
 * Grants access if the user has ANY of the required permissions.
 * super_admin and admin always pass. Teachers pass if any of their active
 * custom roles grants at least one required permission.
 */
const requireAnyPermission = (...requiredPermissions) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: "Authentication required" });
      }

      if (req.user.role === "super_admin" || req.user.role === "admin") return next();

      if (req.user.role === "teacher") {
        const userPermissions = await getRolePermissions(req.user);
        const hasAny = requiredPermissions.some(p => userPermissions.has(p));
        if (hasAny) return next();
        return res.status(403).json({
          success: false,
          message: `Missing required permission(s): ${requiredPermissions.join(", ")}`,
        });
      }

      return res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action",
      });
    } catch (error) {
      logger.error("Permission check error (any)", { error: error.message, stack: error.stack });
      return res.status(500).json({ success: false, message: "Server error" });
    }
  };
};

module.exports = { requirePermission, requireAnyPermission };
