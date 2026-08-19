// controllers/supportController.js
'use strict';

const SupportTicket = require('../models/SupportTicket');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

// ─── Helpers ────────────────────────────────────────────────────────────────

const sanitizeString = (str) =>
  typeof str === 'string' ? str.trim().replace(/[<>]/g, '') : '';

// ─── Admin (Tenant) Endpoints ────────────────────────────────────────────────

/**
 * POST /api/support
 * Tenant admin creates a support ticket.
 * Works even when the tenant's subscription is expired (bypass list).
 */
const createSupportTicket = async (req, res) => {
  try {
    const userId   = req.user._id;
    const tenantId = req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'No tenant associated with this account.' });
    }

    // Rate-limit: max 5 OPEN tickets per tenant at a time
    const openCount = await SupportTicket.countDocuments({
      tenantId,
      status: { $in: ['open', 'in_progress'] }
    });
    if (openCount >= 5) {
      return res.status(429).json({
        success: false,
        message: 'You already have 5 open support tickets. Please wait for them to be resolved before raising a new one.'
      });
    }

    const { subject, description, category, priority } = req.body;

    // Validation
    const cleanSubject     = sanitizeString(subject);
    const cleanDescription = sanitizeString(description);
    const cleanCategory    = category || 'other';
    const cleanPriority    = priority || 'medium';

    if (!cleanSubject || cleanSubject.length < 5 || cleanSubject.length > 150) {
      return res.status(400).json({ success: false, message: 'Subject must be between 5 and 150 characters.' });
    }
    if (!cleanDescription || cleanDescription.length < 20 || cleanDescription.length > 2000) {
      return res.status(400).json({ success: false, message: 'Description must be between 20 and 2000 characters.' });
    }
    const validCategories = ['trial_expired', 'billing', 'technical', 'account', 'other'];
    if (!validCategories.includes(cleanCategory)) {
      return res.status(400).json({ success: false, message: `Category must be one of: ${validCategories.join(', ')}` });
    }
    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    if (!validPriorities.includes(cleanPriority)) {
      return res.status(400).json({ success: false, message: `Priority must be one of: ${validPriorities.join(', ')}` });
    }

    // Fetch tenant info for denormalization and subscription context
    const tenant = await Tenant.findById(tenantId).select('name subscription');
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found.' });
    }

    const ticket = await SupportTicket.create({
      tenantId,
      tenantName:  tenant.name,
      submittedBy:    userId,
      submitterName:  req.user.name,
      submitterEmail: req.user.email,
      subject:     cleanSubject,
      description: cleanDescription,
      category:    cleanCategory,
      priority:    cleanPriority,
      subscriptionContext: {
        plan:   tenant.subscription?.plan || 'unknown',
        status: tenant.subscription?.status || 'unknown'
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Support ticket created successfully. Our team will review it shortly.',
      data: { ticket }
    });
  } catch (err) {
    logger.error('createSupportTicket error', { error: err.message });
    return res.status(500).json({ success: false, message: 'Failed to create support ticket.' });
  }
};

/**
 * GET /api/support/my-tickets
 * Tenant admin fetches their own tickets (paginated).
 */
const getMyTickets = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'No tenant associated with this account.' });
    }

    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const skip  = (page - 1) * limit;

    const filter = { tenantId };
    if (req.query.status) filter.status = req.query.status;

    const [tickets, total] = await Promise.all([
      SupportTicket.find(filter)
        .select('-adminNotes')             // admin notes are internal
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SupportTicket.countDocuments(filter)
    ]);

    return res.json({
      success: true,
      data: {
        tickets,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }
      }
    });
  } catch (err) {
    logger.error('getMyTickets error', { error: err.message });
    return res.status(500).json({ success: false, message: 'Failed to fetch tickets.' });
  }
};

/**
 * GET /api/support/:id
 * Admin fetches a single ticket they own; super_admin can fetch any.
 */
const getTicketById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid ticket ID.' });
    }

    const ticket = req.user.role === 'super_admin'
      ? await SupportTicket.findById(id).lean()
      : await SupportTicket.findOne({ _id: id, tenantId: req.user.tenantId }).lean();
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }

    // Strip internal admin notes for non-super-admin
    if (req.user.role !== 'super_admin') {
      delete ticket.adminNotes;
    }

    return res.json({ success: true, data: { ticket } });
  } catch (err) {
    logger.error('getTicketById error', { error: err.message });
    return res.status(500).json({ success: false, message: 'Failed to fetch ticket.' });
  }
};

// ─── Super Admin Endpoints ───────────────────────────────────────────────────

/**
 * GET /api/support/admin/all
 * Super admin fetches all tickets with optional filters.
 */
const getAllTickets = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip  = (page - 1) * limit;

    const filter = {};
    if (req.query.status)   filter.status   = req.query.status;
    if (req.query.priority) filter.priority = req.query.priority;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.tenantId && mongoose.isValidObjectId(req.query.tenantId)) {
      filter.tenantId = new mongoose.Types.ObjectId(req.query.tenantId);
    }

    const [tickets, total] = await Promise.all([
      SupportTicket.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SupportTicket.countDocuments(filter)
    ]);

    // Summary counts for the dashboard
    const [openCount, inProgressCount, resolvedCount] = await Promise.all([
      SupportTicket.countDocuments({ status: 'open' }),
      SupportTicket.countDocuments({ status: 'in_progress' }),
      SupportTicket.countDocuments({ status: 'resolved' })
    ]);

    return res.json({
      success: true,
      data: {
        tickets,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        summary: { open: openCount, inProgress: inProgressCount, resolved: resolvedCount }
      }
    });
  } catch (err) {
    logger.error('getAllTickets error', { error: err.message });
    return res.status(500).json({ success: false, message: 'Failed to fetch tickets.' });
  }
};

/**
 * PUT /api/support/admin/:id/status
 * Super admin updates ticket status (and optionally adds a resolution note).
 */
const updateTicketStatus = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid ticket ID.' });
    }

    const { status, resolution } = req.body;
    const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    const ticket = await SupportTicket.findById(id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }

    ticket.status = status;
    if (resolution) ticket.resolution = sanitizeString(resolution);
    if (status === 'resolved' || status === 'closed') {
      ticket.resolvedBy     = req.user._id;
      ticket.resolvedByName = req.user.name;
      ticket.resolvedAt     = new Date();
    }

    await ticket.save();

    return res.json({ success: true, message: 'Ticket status updated.', data: { ticket } });
  } catch (err) {
    logger.error('updateTicketStatus error', { error: err.message });
    return res.status(500).json({ success: false, message: 'Failed to update ticket status.' });
  }
};

/**
 * POST /api/support/admin/:id/notes
 * Super admin adds an internal note to a ticket.
 */
const addAdminNote = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid ticket ID.' });
    }

    const content = sanitizeString(req.body.content);
    if (!content || content.length < 3 || content.length > 1000) {
      return res.status(400).json({ success: false, message: 'Note must be between 3 and 1000 characters.' });
    }

    const ticket = await SupportTicket.findByIdAndUpdate(
      id,
      {
        $push: {
          adminNotes: {
            content,
            addedBy:     req.user._id,
            addedByName: req.user.name,
            addedByRole: req.user.role,
            addedAt:     new Date()
          }
        }
      },
      { new: true }
    );

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }

    return res.json({ success: true, message: 'Note added.', data: { ticket } });
  } catch (err) {
    logger.error('addAdminNote error', { error: err.message });
    return res.status(500).json({ success: false, message: 'Failed to add note.' });
  }
};

/**
 * POST /api/support/admin/:id/resolve-reactivate
 * Super admin resolves the ticket AND reactivates the tenant on the free plan.
 * Sets: subscription.status = 'active', subscription.plan = 'free',
 *       clears trialEndsAt so they won't be blocked again as a trial.
 */
const resolveAndReactivateTenant = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Invalid ticket ID.' });
    }

    const resolution = sanitizeString(req.body.resolution || 'Tenant reactivated on free plan by super admin.');

    const ticket = await SupportTicket.findById(id).session(session);
    if (!ticket) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }

    if (ticket.tenantReactivated) {
      await session.abortTransaction();
      session.endSession();
      return res.status(409).json({ success: false, message: 'This ticket has already triggered a reactivation.' });
    }

    // Reactivate the tenant: free plan, active status, no trial expiry
    const tenant = await Tenant.findById(ticket.tenantId).session(session);
    if (!tenant) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Associated tenant not found.' });
    }

    tenant.subscription.status     = 'active';
    tenant.subscription.plan       = 'free';
    tenant.subscription.trialEndsAt = null;   // null = no trial expiry, permanently free
    await tenant.save({ session });

    // Resolve the ticket
    ticket.status             = 'resolved';
    ticket.resolution         = resolution;
    ticket.resolvedBy         = req.user._id;
    ticket.resolvedByName     = req.user.name;
    ticket.resolvedAt         = new Date();
    ticket.tenantReactivated  = true;
    await ticket.save({ session });

    await session.commitTransaction();
    session.endSession();

    console.log(`✅ Tenant ${tenant.name} (${tenant._id}) reactivated on free plan by ${req.user.name}`);

    return res.json({
      success: true,
      message: `Ticket resolved and tenant "${tenant.name}" reactivated on free plan.`,
      data: { ticket, tenantId: tenant._id, tenantName: tenant.name }
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    logger.error('resolveAndReactivateTenant error', { error: err.message });
    return res.status(500).json({ success: false, message: 'Failed to resolve ticket and reactivate tenant.' });
  }
};

module.exports = {
  createSupportTicket,
  getMyTickets,
  getTicketById,
  getAllTickets,
  updateTicketStatus,
  addAdminNote,
  resolveAndReactivateTenant
};
