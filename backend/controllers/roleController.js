const CustomRole = require("../models/CustomRole");
const User = require("../models/User");
const logger = require("../utils/logger");
const cache = require("../middleware/cache");

const createRole = async (req, res) => {
  try {
    const { name, description, permissions, assignedSections } = req.body;
    const tenantId = req.user.tenantId;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Role name is required" });
    }

    const existing = await CustomRole.findOne({ tenantId, name: name.trim() });
    if (existing) {
      return res.status(409).json({ success: false, message: "A role with this name already exists" });
    }

    const role = await CustomRole.create({
      tenantId,
      name: name.trim(),
      description: description || "",
      permissions: permissions || [],
      assignedSections: assignedSections || [],
      createdBy: req.user._id,
    });

    return res.status(201).json({ success: true, message: "Role created successfully", data: role });
  } catch (error) {
    logger.error("Error creating role", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to create role", error: error.message });
  }
};

const getRoles = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const roles = await CustomRole.find({ tenantId, isActive: true })
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, data: roles });
  } catch (error) {
    logger.error("Error fetching roles", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to fetch roles" });
  }
};

const getRoleById = async (req, res) => {
  try {
    const role = await CustomRole.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!role) {
      return res.status(404).json({ success: false, message: "Role not found" });
    }
    return res.status(200).json({ success: true, data: role });
  } catch (error) {
    logger.error("Error fetching role", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to fetch role" });
  }
};

const updateRole = async (req, res) => {
  try {
    const { name, description, permissions, assignedSections, isActive } = req.body;
    const role = await CustomRole.findOne({ _id: req.params.id, tenantId: req.user.tenantId });

    if (!role) {
      return res.status(404).json({ success: false, message: "Role not found" });
    }

    if (name && name.trim() !== role.name) {
      const existing = await CustomRole.findOne({ tenantId: req.user.tenantId, name: name.trim() });
      if (existing) {
        return res.status(409).json({ success: false, message: "A role with this name already exists" });
      }
      role.name = name.trim();
    }
    if (description !== undefined) role.description = description;
    if (permissions !== undefined) role.permissions = permissions;
    if (assignedSections !== undefined) role.assignedSections = assignedSections;
    if (isActive !== undefined) role.isActive = isActive;
    role.updatedBy = req.user._id;

    await role.save();

    const usersWithRole = await User.find({ tenantId: req.user.tenantId, "customRoles.roleId": role._id }).select("_id").lean();
    await Promise.all(usersWithRole.map(u => cache.del(`user:${u._id}`)));

    return res.status(200).json({ success: true, message: "Role updated successfully", data: role });
  } catch (error) {
    logger.error("Error updating role", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to update role" });
  }
};

const deleteRole = async (req, res) => {
  try {
    const role = await CustomRole.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!role) {
      return res.status(404).json({ success: false, message: "Role not found" });
    }

    const affectedUsers = await User.find({ tenantId: req.user.tenantId, "customRoles.roleId": role._id }).select("_id").lean();

    await User.updateMany(
      { tenantId: req.user.tenantId, "customRoles.roleId": role._id },
      { $pull: { customRoles: { roleId: role._id } } }
    );

    await Promise.all(affectedUsers.map(u => cache.del(`user:${u._id}`)));

    role.isActive = false;
    role.updatedBy = req.user._id;
    await role.save();

    return res.status(200).json({ success: true, message: "Role deleted successfully" });
  } catch (error) {
    logger.error("Error deleting role", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to delete role" });
  }
};

const assignRole = async (req, res) => {
  try {
    const { teacherId, roleId } = req.body;

    const teacher = await User.findOne({ _id: teacherId, tenantId: req.user.tenantId, role: "teacher" });
    if (!teacher) {
      return res.status(404).json({ success: false, message: "Teacher not found" });
    }

    const role = await CustomRole.findOne({ _id: roleId, tenantId: req.user.tenantId, isActive: true });
    if (!role) {
      return res.status(404).json({ success: false, message: "Role not found" });
    }

    const alreadyAssigned = teacher.customRoles?.some(cr => cr.roleId?.toString() === roleId);
    if (alreadyAssigned) {
      return res.status(409).json({ success: false, message: "Role already assigned to this teacher" });
    }

    teacher.customRoles = teacher.customRoles || [];
    teacher.customRoles.push({
      roleId: role._id,
      assignedAt: new Date(),
      assignedBy: req.user._id,
    });
    await teacher.save();
    await cache.del(`user:${teacher._id}`);

    return res.status(200).json({ success: true, message: "Role assigned successfully" });
  } catch (error) {
    logger.error("Error assigning role", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to assign role" });
  }
};

const unassignRole = async (req, res) => {
  try {
    const { teacherId, roleId } = req.params;

    const teacher = await User.findOne({ _id: teacherId, tenantId: req.user.tenantId, role: "teacher" });
    if (!teacher) {
      return res.status(404).json({ success: false, message: "Teacher not found" });
    }

    teacher.customRoles = (teacher.customRoles || []).filter(
      cr => cr.roleId?.toString() !== roleId
    );
    await teacher.save();
    await cache.del(`user:${teacher._id}`);

    return res.status(200).json({ success: true, message: "Role unassigned successfully" });
  } catch (error) {
    logger.error("Error unassigning role", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to unassign role" });
  }
};

const getTeacherRoles = async (req, res) => {
  try {
    const { teacherId } = req.params;
    const teacher = await User.findOne({ _id: teacherId, tenantId: req.user.tenantId })
      .populate("customRoles.roleId", "name description permissions assignedSections");

    if (!teacher) {
      return res.status(404).json({ success: false, message: "Teacher not found" });
    }

    return res.status(200).json({ success: true, data: teacher.customRoles || [] });
  } catch (error) {
    logger.error("Error fetching teacher roles", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to fetch teacher roles" });
  }
};

const getMyPermissions = async (req, res) => {
  try {
    if (req.user.role === "super_admin" || req.user.role === "admin") {
      return res.status(200).json({ success: true, data: { permissions: "all" } });
    }

    const roleIds = (req.user.customRoles || []).map(cr => cr.roleId);
    const roles = await CustomRole.find({ _id: { $in: roleIds }, isActive: true }).lean();
    const permissions = [...new Set(roles.flatMap(r => r.permissions || []))];

    return res.status(200).json({ success: true, data: { permissions } });
  } catch (error) {
    logger.error("Error fetching permissions", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to fetch permissions" });
  }
};

const getMyRoles = async (req, res) => {
  try {
    const { role, tenantId } = req.user;

    // Admin / super-admin implicitly hold all duties.
    if (role === "super_admin" || role === "admin") {
      return res.status(200).json({ success: true, data: { roles: [], permissions: "all" } });
    }

    const roleIds = (req.user.customRoles || []).map(cr => cr.roleId);
    const roles = await CustomRole.find({ _id: { $in: roleIds }, tenantId, isActive: true })
      .select("name description permissions assignedSections")
      .lean();

    const permissions = [...new Set(roles.flatMap(r => r.permissions || []))];

    return res.status(200).json({
      success: true,
      data: {
        roles: roles.map(r => ({
          _id: r._id,
          name: r.name,
          description: r.description,
          permissions: r.permissions || [],
          assignedSections: r.assignedSections || [],
        })),
        permissions,
      },
    });
  } catch (error) {
    logger.error("Error fetching my roles", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to fetch roles" });
  }
};

module.exports = {
  createRole, getRoles, getRoleById, updateRole, deleteRole,
  assignRole, unassignRole, getTeacherRoles, getMyPermissions, getMyRoles,
};
