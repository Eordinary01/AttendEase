const express = require("express");
const router = express.Router();
const { authenticateToken, authorizeRoles } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permission");
const { createStudent, updateStudent } = require("../controllers/studentController");

// Create student (admin or teacher with students:write)
router.post("/", authenticateToken, authorizeRoles(["admin", "teacher"]), requirePermission("students:write"), createStudent);

// Update student (admin or teacher with students:write)
router.put("/:id", authenticateToken, authorizeRoles(["admin", "teacher"]), requirePermission("students:write"), updateStudent);

module.exports = router;
