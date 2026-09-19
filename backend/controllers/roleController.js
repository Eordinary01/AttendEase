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
    await cache.delPattern('roles:*').catch(() => {});

    return res.status(201).json({ success: true, message: "Role created successfully", data: role });
  } catch (error) {
    logger.error("Error creating role", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to create role", error: error.message });
  }
};

const MentorAssignment = require("../models/MentorAssignment");

const ensureStandardRoles = async (tenantId, userId) => {
  try {
    const standardRoles = [
      {
        name: "Academic Mentor",
        description: "Faculty mentor responsible for section/cohort academic guidance and student leave review",
        permissions: ["attendance:read", "attendance:report", "students:read"],
      },
      {
        name: "Class Advisor",
        description: "Class faculty advisor overseeing student welfare, cohort advisement, and class coordination",
        permissions: ["attendance:read", "attendance:report", "students:read", "timetable:read"],
      },
    ];

    for (const sr of standardRoles) {
      const exists = await CustomRole.findOne({ tenantId, name: sr.name });
      if (!exists) {
        await CustomRole.create({
          tenantId,
          name: sr.name,
          description: sr.description,
          permissions: sr.permissions,
          createdBy: userId,
        });
      }
    }
  } catch (e) {
    // Non-blocking
  }
};

const getRoles = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    let roles = await CustomRole.find({ tenantId, isActive: true })
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    if (roles.length === 0) {
      await ensureStandardRoles(tenantId, req.user._id);
      roles = await CustomRole.find({ tenantId, isActive: true })
        .populate("createdBy", "name email")
        .sort({ createdAt: -1 });
    }

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
    await cache.delPattern('roles:*').catch(() => {});

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
    await cache.delPattern('roles:*').catch(() => {});

    return res.status(200).json({ success: true, message: "Role deleted successfully" });
  } catch (error) {
    logger.error("Error deleting role", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to delete role" });
  }
};

const assignRole = async (req, res) => {
  try {
    const { teacherId, roleId, courseId, branch, semester, section, isPrimary } = req.body;

    const teacher = await User.findOne({ _id: teacherId, tenantId: req.user.tenantId, role: "teacher" });
    if (!teacher) {
      return res.status(404).json({ success: false, message: "Teacher not found" });
    }

    const role = await CustomRole.findOne({ _id: roleId, tenantId: req.user.tenantId, isActive: true });
    if (!role) {
      return res.status(404).json({ success: false, message: "Role not found" });
    }

    const normSection = section ? section.trim().toUpperCase() : "";
    const normBranch = branch ? branch.trim() : "";
    const normSemester = semester ? Number(semester) : null;
    const courseIdVal = courseId || null;

    const alreadyAssigned = teacher.customRoles?.some(cr => {
      const matchRole = cr.roleId?.toString() === roleId;
      const matchSection = (cr.section || "").toUpperCase() === normSection;
      const matchBranch = (cr.branch || "").toLowerCase() === normBranch.toLowerCase();
      const matchCourse = (cr.courseId?.toString() || "") === (courseIdVal ? courseIdVal.toString() : "");
      return matchRole && matchSection && matchBranch && matchCourse;
    });

    if (alreadyAssigned) {
      let scopeDetail = "";
      if (normSection) scopeDetail = ` for Section ${normSection}`;
      else if (normBranch) scopeDetail = ` for Department ${normBranch}`;
      return res.status(409).json({
        success: false,
        message: `Role "${role.name}" is already assigned to this teacher${scopeDetail}`,
      });
    }

    const isMentorOrAdvisor = /mentor|advisor/i.test(role.name);
    const resolvedIsPrimary = normSection && isMentorOrAdvisor ? true : (isPrimary === true);

    teacher.customRoles = teacher.customRoles || [];
    teacher.customRoles.push({
      roleId: role._id,
      courseId: courseIdVal,
      branch: normBranch,
      semester: normSemester,
      section: normSection,
      isPrimary: resolvedIsPrimary,
      assignedAt: new Date(),
      assignedBy: req.user._id,
    });
    await teacher.save();

    // If section is provided and role is mentor/advisor, sync to MentorAssignment
    if (normSection && isMentorOrAdvisor) {
      // Demote existing primary mentor for this section
      await MentorAssignment.updateMany(
        { tenantId: req.user.tenantId, section: normSection, isPrimary: true },
        { $set: { isPrimary: false } }
      );
      await MentorAssignment.findOneAndUpdate(
        {
          tenantId: req.user.tenantId,
          section: normSection,
        },
        {
          $set: {
            tenantId: req.user.tenantId,
            teacherId: teacher._id,
            teacherName: teacher.name,
            teacherEmail: teacher.email || "",
            section: normSection,
            courseId: courseIdVal,
            branch: normBranch,
            semester: normSemester ? String(normSemester) : "",
            isPrimary: true,
            isActive: true,
            assignedBy: req.user._id,
          },
        },
        { upsert: true, new: true }
      );
    }

    await cache.del(`user:${teacher._id}`);
    await cache.delPattern('roles:*').catch(() => {});

    return res.status(200).json({ success: true, message: "Role assigned successfully" });
  } catch (error) {
    logger.error("Error assigning role", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to assign role", error: error.message });
  }
};

const unassignRole = async (req, res) => {
  try {
    const { teacherId, roleId } = req.params;
    const { assignmentId, section } = req.query;

    const teacher = await User.findOne({ _id: teacherId, tenantId: req.user.tenantId, role: "teacher" });
    if (!teacher) {
      return res.status(404).json({ success: false, message: "Teacher not found" });
    }

    // Find the specific assignment entry to unassign
    const target = (teacher.customRoles || []).find(cr => {
      if (assignmentId && cr._id?.toString() === assignmentId) return true;
      if (cr._id?.toString() === roleId) return true;
      if (cr.roleId?.toString() === roleId) {
        if (section) return (cr.section || "").toUpperCase() === section.trim().toUpperCase();
        return true;
      }
      return false;
    });

    if (target) {
      // If this role had a section, check if it was mentor/advisor and clean up MentorAssignment
      if (target.section) {
        const roleDoc = await CustomRole.findById(target.roleId).lean();
        const isMentorOrAdvisor = roleDoc && /mentor|advisor/i.test(roleDoc.name);
        if (isMentorOrAdvisor || target.isPrimary) {
          await MentorAssignment.deleteMany({
            tenantId: req.user.tenantId,
            teacherId: teacher._id,
            section: target.section.toUpperCase(),
          }).catch(() => {});
        }
      }

      teacher.customRoles = (teacher.customRoles || []).filter(
        cr => cr._id?.toString() !== target._id?.toString()
      );
      await teacher.save();
    } else {
      // Fallback: filter out by roleId or _id
      teacher.customRoles = (teacher.customRoles || []).filter(
        cr => cr.roleId?.toString() !== roleId && cr._id?.toString() !== roleId
      );
      await teacher.save();
    }

    await cache.del(`user:${teacher._id}`);
    await cache.delPattern('roles:*').catch(() => {});

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
      .populate("customRoles.roleId", "name description permissions assignedSections")
      .populate("customRoles.courseId", "name code branches");

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
    const { role, tenantId, _id } = req.user;

    // Admin / super-admin implicitly hold all duties.
    if (role === "super_admin" || role === "admin") {
      return res.status(200).json({ success: true, data: { roles: [], assignments: [], permissions: "all" } });
    }

    const myUser = await User.findById(_id)
      .populate("customRoles.roleId", "name description permissions assignedSections")
      .populate("customRoles.courseId", "name code")
      .lean();

    const assignments = (myUser?.customRoles || []).map(cr => ({
      _id: cr._id,
      roleId: cr.roleId?._id,
      name: cr.roleId?.name || "Role",
      description: cr.roleId?.description || "",
      permissions: cr.roleId?.permissions || [],
      section: cr.section || "",
      semester: cr.semester,
      branch: cr.branch || "",
      course: cr.courseId?.code || cr.courseId?.name || "",
      isPrimary: cr.isPrimary || false,
    }));

    const permissions = [...new Set(assignments.flatMap(r => r.permissions || []))];

    return res.status(200).json({
      success: true,
      data: {
        roles: assignments,
        assignments,
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
