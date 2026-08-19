const express = require("express");
const router = express.Router();
const { authenticateToken, superAdminAuth } = require("../middleware/auth");
const { require2FA } = require("../middleware/require2FA");
const { createPlan, updatePlan, deletePlan, getPlanById } = require("../controllers/planController");

router.use(authenticateToken);
router.use(superAdminAuth);

router.post("/", require2FA, createPlan);
router.put("/:id", require2FA, updatePlan);
router.delete("/:id", require2FA, deletePlan);
router.get("/:id", getPlanById);

module.exports = router;
