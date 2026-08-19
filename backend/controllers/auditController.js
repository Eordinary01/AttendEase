const AuditLog = require('../models/AuditLog');

/**
 * GET /api/admin/audit-logs
 * Retrieves audit logs for the tenant with filtering and pagination.
 */
const getAuditLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      action,
      resourceType,
      actorUserId,
      fromDate,
      toDate,
    } = req.query;

    const query = {};

    // Super admin can see all or filter by tenantId; admins only see their tenant
    if (req.user.role === 'super_admin') {
      if (req.query.tenantId) query.tenantId = req.query.tenantId;
    } else {
      query.tenantId = req.tenantId || req.user.tenantId;
    }

    if (action) query.action = action;
    if (resourceType) query.resourceType = resourceType;
    if (actorUserId) query.actorUserId = actorUserId;

    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) query.createdAt.$lte = new Date(toDate);
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .populate('actorUserId', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      AuditLog.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        logs,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum) || 1,
        },
      },
    });
  } catch (error) {
    console.error('Fetch Audit Logs Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch audit logs',
    });
  }
};

module.exports = { getAuditLogs };
