const express = require("express");
const router = express.Router();
const { authenticateToken, authorizeRoles } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permission");
const { featureGuard } = require("../middleware/featureGuard");
const seatingController = require("../controllers/examSeatingController");

router.use(authenticateToken);
router.use(featureGuard("exam_seating"));

// ─── Student & Parent: Official Admit Card / Hall Ticket ───
router.get("/my-hall-ticket", seatingController.getMyHallTicket);

// ─── Exam Halls (Admin CRUD, Teacher Read) ───
router.get("/halls", seatingController.getHalls);
router.post(
  "/halls",
  authorizeRoles(["admin", "super_admin"]),
  requirePermission("exam:create"),
  seatingController.createHall
);
router.put(
  "/halls/:id",
  authorizeRoles(["admin", "super_admin"]),
  requirePermission("exam:update"),
  seatingController.updateHall
);
router.delete(
  "/halls/:id",
  authorizeRoles(["admin", "super_admin"]),
  requirePermission("exam:delete"),
  seatingController.deleteHall
);

// ─── Anti-Cheating Seating Allocation Generator ───
router.get(
  "/scheduled-dates",
  authorizeRoles(["admin", "super_admin", "teacher"]),
  requirePermission("exam:read"),
  seatingController.getScheduledExamDates
);
router.post(
  "/generate",
  authorizeRoles(["admin", "super_admin"]),
  requirePermission("exam:create"),
  seatingController.generateSeating
);
router.post(
  "/import-excel",
  authorizeRoles(["admin", "super_admin"]),
  requirePermission("exam:create"),
  seatingController.importSeatingAllocations
);

// ─── Seating Query & Hall Notice Matrix ───
router.get(
  "/allocations",
  authorizeRoles(["admin", "super_admin", "teacher"]),
  requirePermission("exam:read"),
  seatingController.getAllocations
);
router.get(
  "/hall-chart/:hallId",
  authorizeRoles(["admin", "super_admin", "teacher"]),
  requirePermission("exam:read"),
  seatingController.getHallChart
);

// ─── Invigilator Entrance QR Scanner & Check-in ───
router.post(
  "/verify-ticket",
  authorizeRoles(["admin", "super_admin", "teacher"]),
  requirePermission("exam:grade"),
  seatingController.verifyTicket
);
router.put(
  "/checkin/:allocationId",
  authorizeRoles(["admin", "super_admin", "teacher"]),
  requirePermission("exam:grade"),
  seatingController.manualCheckIn
);

module.exports = router;
