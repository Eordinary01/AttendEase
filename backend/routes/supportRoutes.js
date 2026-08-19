// routes/supportRoutes.js
'use strict';

const express = require('express');
const router  = express.Router();

const {
  authenticateToken,
  adminAuth,
  superAdminAuth,
  authorizeRoles
} = require('../middleware/auth');

const validate = require('../middleware/validate');
const {
  createSupportTicket,
  updateSupportTicket,
  getSupportTickets,
} = require('../validators/support');

const {
  createSupportTicket: createSupportTicketCtrl,
  getMyTickets,
  getTicketById,
  getAllTickets,
  updateTicketStatus: updateTicketStatusCtrl,
  addAdminNote,
  resolveAndReactivateTenant
} = require('../controllers/supportController');

// ─── Admin (Tenant) Routes ───────────────────────────────────────────────────
// These work even when the tenant's subscription is expired
// (because /api/support is in the auth.js bypass list)

/**
 * POST /api/support
 * Create a new support ticket (tenant admin only)
 */
router.post('/', authenticateToken, adminAuth, createSupportTicket, createSupportTicketCtrl);

/**
 * GET /api/support/my-tickets
 * List the tenant's own tickets (paginated)
 */
router.get('/my-tickets', authenticateToken, adminAuth, getSupportTickets, getMyTickets);

// ─── Super Admin Routes ───────────────────────────────────────────────────────

/**
 * GET /api/support/admin/all
 * List ALL tickets across tenants (super admin only)
 */
router.get('/admin/all', authenticateToken, superAdminAuth, getSupportTickets, getAllTickets);

/**
 * PUT /api/support/admin/:id/status
 * Update a ticket's status (super admin only)
 */
router.put('/admin/:id/status', authenticateToken, superAdminAuth, updateSupportTicket, updateTicketStatusCtrl);

/**
 * POST /api/support/admin/:id/notes
 * Add an internal note to a ticket (super admin only)
 */
router.post('/admin/:id/notes', authenticateToken, superAdminAuth, addAdminNote);

/**
 * POST /api/support/admin/:id/resolve-reactivate
 * Resolve ticket AND reactivate the tenant on free plan (super admin only)
 */
router.post('/admin/:id/resolve-reactivate', authenticateToken, superAdminAuth, resolveAndReactivateTenant);

// ─── Shared Routes ────────────────────────────────────────────────────────────

/**
 * GET /api/support/:id
 * Get a single ticket (admin = own tenant; super_admin = any)
 * NOTE: must come AFTER named sub-routes to avoid matching 'admin' or 'my-tickets' as :id
 */
router.get('/:id', authenticateToken, authorizeRoles(['admin', 'super_admin']), getTicketById);

module.exports = router;