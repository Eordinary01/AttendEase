const express = require("express");
const router = express.Router();
const { authenticateToken, adminAuth, authorizeRoles } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permission");
const { featureGuard } = require("../middleware/featureGuard");
const validate = require("../middleware/validate");
const {
  createFee,
  updateFee,
  waiveFee,
  collectPayment,
  getFees,
} = require("../validators/fee");
const {
  createFee: createFeeCtrl,
  getFees: getFeesCtrl,
  getFeeById,
  updateFee: updateFeeCtrl,
  deleteFee,
  waiveFee: waiveFeeCtrl,
  collectPayment: collectPaymentCtrl,
  getTransactions,
  getDefaulters,
  getFeeSummary,
  getMyFees,
  generateCourseFees,
} = require("../controllers/feeController");

router.use(authenticateToken);

// Feature guard for finance management module
router.use(featureGuard("finance_management"));

router.get("/my-fees", getMyFees);
router.get("/summary", getFeeSummary);
router.get("/defaulters", getDefaulters);
router.get("/transactions", getTransactions);

router.get("/:id", getFeeById);

router.get("/", getFees, getFeesCtrl);

router.post("/generate-course", authorizeRoles(["admin", "teacher"]), requirePermission("fee:collect"), generateCourseFees);
router.post("/", authorizeRoles(["admin", "teacher"]), requirePermission("fee:collect"), createFee, validate, createFeeCtrl);
router.put("/:id", authorizeRoles(["admin", "teacher"]), requirePermission("fee:collect"), updateFee, validate, updateFeeCtrl);
router.delete("/:id", authorizeRoles(["admin", "teacher"]), requirePermission("fee:collect"), deleteFee);

router.patch("/:id/waive", authorizeRoles(["admin", "teacher"]), requirePermission("fee:waive"), waiveFee, validate, waiveFeeCtrl);
router.post("/:id/pay", authorizeRoles(["admin", "teacher"]), requirePermission("fee:collect"), collectPayment, validate, collectPaymentCtrl);

module.exports = router;