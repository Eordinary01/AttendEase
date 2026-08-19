// routes/billingRoutes.js
const express = require("express");
const router = express.Router();
const { authenticateToken, adminAuth } = require("../middleware/auth");
const { tenantResolver } = require("../middleware/tenantResolver");
const validate = require("../middleware/validate");
const {
  createSubscriptionOrder,
  verifyPayment,
  updateSubscription,
  continueFree,
} = require("../validators/billing");
const {
  getRazorpayKey,
  // Subscription Management
  createSubscriptionOrder: createSubscriptionOrderCtrl,
  cancelSubscription,
  updateSubscription: updateSubscriptionCtrl,
  continueFreeTier,
  getSubscriptionDetails,
  getTenantTransactions,
  adjustTenantBilling,
  // Plan Management
  getPlans,
  getCurrentPlan,

  // Invoice Management
  getInvoiceHistory,
  getInvoiceById,
  downloadInvoice,

  // Payment Management
  generatePaymentLink,
  verifyPayment: verifyPaymentCtrl,
  getPaymentDetails,
  requestRefund,

  // Webhook
  webhookHandler,

  // Usage & Analytics
  getBillingUsage,
  getBillingAnalytics,

  // Payment Methods
  addPaymentMethod,
  getPaymentMethods,
  deletePaymentMethod,
  setDefaultPaymentMethod,

  // Tax & Address
  updateBillingAddress,
  getTaxInvoices,

  // Tenant specific
  getTenantSubscriptionInfo,
  getUpcomingInvoice,
} = require("../controllers/billingController");

// ==================== PUBLIC WEBHOOK ROUTE ====================
// Razorpay webhook - no authentication required (verified by signature)
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  webhookHandler,
);

// ==================== PUBLIC PLAN ROUTES ====================
// Get all available plans (no authentication required)
router.get("/plans", getPlans);
router.get("/razorpay-key", getRazorpayKey);

// ==================== PROTECTED ROUTES ====================
// All routes below require authentication and tenant resolution
router.use(authenticateToken);
router.use(tenantResolver);

// ==================== SUBSCRIPTION MANAGEMENT ====================

/**
 * GET /api/billing/subscription
 * Get current tenant's subscription details
 */
router.get("/subscription", getSubscriptionDetails);

/**
 * GET /api/billing/tenant-subscription
 * Get subscription info with tenant details
 */
router.get("/tenant-subscription", getTenantSubscriptionInfo);

const idempotency = require("../middleware/idempotency");

/**
 * POST /api/billing/create-subscription
 * Create a new subscription (upgrade from free/trial)
 * Body: { planCode, billingCycle, paymentMethodId }
 */
router.post("/create-subscription", adminAuth, idempotency(), createSubscriptionOrder, createSubscriptionOrderCtrl);

const { require2FA } = require("../middleware/require2FA");

/**
 * POST /api/billing/update-subscription
 * Update existing subscription (upgrade/downgrade)
 * Body: { planCode, billingCycle }
 */
router.post("/update-subscription", adminAuth, idempotency(), updateSubscription, require2FA, updateSubscriptionCtrl);
router.post("/continue-free", adminAuth, continueFree, continueFreeTier);

/**
 * POST /api/billing/cancel-subscription
 * Cancel current subscription
 * Body: { cancelImmediately, reason }
 */
router.post("/cancel-subscription", adminAuth, require2FA, cancelSubscription);

/**
 * GET /api/billing/upcoming-invoice
 * Get upcoming invoice details
 */
router.get("/upcoming-invoice", getUpcomingInvoice);

// ==================== PLAN MANAGEMENT ====================

/**
 * GET /api/billing/current-plan
 * Get current plan with feature limits
 */
router.get("/current-plan", getCurrentPlan);

// ==================== INVOICE MANAGEMENT ====================

/**
 * GET /api/billing/invoices
 * Get invoice history with pagination
 * Query: ?page=1&limit=10&status=paid
 */
router.get("/invoices", getInvoiceHistory);

/**
 * GET /api/billing/invoices/:invoiceId
 * Get specific invoice details
 */
router.get("/invoices/:invoiceId", getInvoiceById);

/**
 * GET /api/billing/invoices/:invoiceId/download
 * Download invoice PDF
 */
router.get("/invoices/:invoiceId/download", downloadInvoice);

/**
 * GET /api/billing/tax-invoices
 * Get tax invoices for a specific period
 * Query: ?fromDate=2024-01-01&toDate=2024-12-31
 */
router.get("/tax-invoices", getTaxInvoices);

// ==================== PAYMENT MANAGEMENT ====================

/**
 * POST /api/billing/generate-payment-link
 * Generate a payment link for manual payment
 * Body: { planCode, billingCycle, description }
 */
router.post("/generate-payment-link", adminAuth, generatePaymentLink);

/**
 * POST /api/billing/verify-payment
 * Verify payment after successful transaction
 * Body: { razorpayOrderId, razorpayPaymentId, razorpaySignature }
 */
router.post("/verify-payment", adminAuth, idempotency(), verifyPayment, verifyPaymentCtrl);

/**
 * GET /api/billing/payments/:paymentId
 * Get payment details
 */
router.get("/payments/:paymentId", getPaymentDetails);

/**
 * POST /api/billing/refund/:paymentId
 * Request refund for a payment
 * Body: { amount, reason }
 */
router.post("/refund/:paymentId", adminAuth, require2FA, idempotency(), requestRefund);

// ==================== PAYMENT METHODS ====================

/**
 * GET /api/billing/payment-methods
 * Get all saved payment methods
 */
router.get("/payment-methods", getPaymentMethods);

/**
 * POST /api/billing/payment-methods
 * Add a new payment method
 * Body: { paymentMethodId, isDefault }
 */
router.post("/payment-methods", adminAuth, addPaymentMethod);

/**
 * DELETE /api/billing/payment-methods/:paymentMethodId
 * Delete a payment method
 */
router.delete("/payment-methods/:paymentMethodId", adminAuth, deletePaymentMethod);

/**
 * POST /api/billing/payment-methods/:paymentMethodId/default
 * Set a payment method as default
 */
router.post(
  "/payment-methods/:paymentMethodId/default",
  adminAuth,
  setDefaultPaymentMethod,
);

// ==================== BILLING ADDRESS ====================

/**
 * PUT /api/billing/address
 * Update billing address
 * Body: { name, address, city, state, country, pincode, phone, email }
 */
router.put("/address", adminAuth, updateBillingAddress);

// ==================== USAGE & ANALYTICS ====================

/**
 * GET /api/billing/usage
 * Get current billing cycle usage statistics
 */
router.get("/usage", getBillingUsage);

/**
 * GET /api/billing/analytics
 * Get billing analytics (cost analysis, predictions)
 * Query: ?period=month&year=2024
 */
router.get("/analytics", getBillingAnalytics);

// ==================== ADMIN BILLING ROUTES (Super Admin only) ====================
// These would be in superAdminRoutes.js, but can be added here with proper auth

/**
 * GET /api/billing/admin/tenants/:tenantId/transactions
 * Get all transactions for a tenant (Super Admin only)
 * Requires: super_admin role
 */
router.get(
  "/admin/tenants/:tenantId/transactions",
  (req, res, next) => {
    if (req.user.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Super admin access required",
      });
    }
    next();
  },
  getTenantTransactions,
);

/**
 * POST /api/billing/admin/tenants/:tenantId/adjust
 * Adjust billing for a tenant (credit/debit)
 * Body: { amount, reason, type }
 * Requires: super_admin role
 */
router.post(
  "/admin/tenants/:tenantId/adjust",
  (req, res, next) => {
    if (req.user.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Super admin access required",
      });
    }
    next();
  },
  adjustTenantBilling,
);

module.exports = router;