const express = require("express");
const router = express.Router();
const { authenticateToken, adminAuth, teacherAuth, authorizeRoles } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permission");
const { featureGuard } = require("../middleware/featureGuard");
const validate = require("../middleware/validate");
const {
  createEntry,
  updateEntry,
  bulkCreate,
  getBySection,
  getAll,
} = require("../validators/timetable");
const {
  createEntry: createEntryCtrl,
  bulkCreate: bulkCreateCtrl,
  getAll: getAllCtrl,
  getBySection: getBySectionCtrl,
  getByTeacher,
  updateEntry: updateEntryCtrl,
  deleteEntry,
} = require("../controllers/timetableController");

router.use(authenticateToken);
router.use(featureGuard("timetable"));

router.get("/section/:section", getBySection, validate, getBySectionCtrl);
router.get("/teacher/:teacherId", authorizeRoles(["admin", "teacher"]), getByTeacher);
router.get("/teacher", teacherAuth, getByTeacher);

router.get("/", adminAuth, getAll, validate, getAllCtrl);
router.post("/", authorizeRoles(["admin", "teacher"]), requirePermission("timetable:write"), createEntry, validate, createEntryCtrl);
router.post("/bulk", featureGuard("bulk_operations"), authorizeRoles(["admin", "teacher"]), requirePermission("timetable:write"), bulkCreate, validate, bulkCreateCtrl);
router.put("/:id", authorizeRoles(["admin", "teacher"]), requirePermission("timetable:write"), updateEntry, updateEntryCtrl);
router.delete("/:id", authorizeRoles(["admin", "teacher"]), requirePermission("timetable:write"), deleteEntry);

module.exports = router;