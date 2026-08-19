const express = require("express");
const router = express.Router();
const { authenticateToken, adminAuth } = require("../middleware/auth");
const { featureGuard } = require("../middleware/featureGuard");
const { require2FA } = require("../middleware/require2FA");
const validate = require("../middleware/validate");
const {
  createRole,
  updateRole,
  assignRole,
  unassignRole,
  getRoles,
} = require("../validators/role");
const {
  createRole: createRoleCtrl,
  getRoles: getRolesCtrl,
  getRoleById,
  updateRole: updateRoleCtrl,
  deleteRole,
  assignRole: assignRoleCtrl,
  unassignRole: unassignRoleCtrl,
  getTeacherRoles,
  getMyPermissions,
  getMyRoles,
} = require("../controllers/roleController");

router.use(authenticateToken);
router.use(featureGuard("custom_roles"));

router.get("/my-permissions", getMyPermissions);
router.get("/my-roles", getMyRoles);

router.get("/teachers/:teacherId", adminAuth, getTeacherRoles);

router.post("/assign", adminAuth, require2FA, assignRole, assignRoleCtrl);
router.delete("/assign/:teacherId/:roleId", adminAuth, require2FA, unassignRole, unassignRoleCtrl);

router.post("/", adminAuth, require2FA, createRole, createRoleCtrl);
router.get("/", adminAuth, getRoles, getRolesCtrl);
router.get("/:id", adminAuth, getRoleById);
router.put("/:id", adminAuth, require2FA, updateRole, updateRoleCtrl);
router.delete("/:id", adminAuth, require2FA, deleteRole);

module.exports = router;