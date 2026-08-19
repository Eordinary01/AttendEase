const APILog = require('../models/APILog');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const logger = require('../utils/logger');

const isSuperAdmin = (req) => req.user?.role === 'super_admin';

const enrichLogs = async (logs) => {
  const tenantIds = [...new Set(logs.map((l) => l.tenantId?.toString()).filter(Boolean))];
  const userIds = [...new Set(logs.map((l) => l.userId?.toString()).filter(Boolean))];

  const [tenants, users] = await Promise.all([
    tenantIds.length ? Tenant.find({ _id: { $in: tenantIds } }).select('name subdomain').lean() : [],
    userIds.length ? User.find({ _id: { $in: userIds } }).select('name email role').lean() : [],
  ]);

  const tenantMap = Object.fromEntries(tenants.map((t) => [t._id.toString(), t]));
  const userMap = Object.fromEntries(users.map((u) => [u._id.toString(), u]));

  return logs.map((l) => ({
    ...l,
    tenantName: l.tenantId ? tenantMap[l.tenantId.toString()]?.name || 'Deleted tenant' : 'Platform',
    tenantSubdomain: l.tenantId ? tenantMap[l.tenantId.toString()]?.subdomain || '' : '',
    userName: l.userId ? userMap[l.userId.toString()]?.name || 'Deleted user' : 'Anonymous',
    userEmail: l.userId ? userMap[l.userId.toString()]?.email || '' : '',
    userRole: l.userId ? userMap[l.userId.toString()]?.role || '' : '',
  }));
};

/**
 * GET /api/admin/super/logs
 * Paginated, filterable activity log (all tenants).
 */
const getActivityLogs = async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ success: false, message: 'Super admin access required' });
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.tenantId) filter.tenantId = req.query.tenantId;
    if (req.query.userId) filter.userId = req.query.userId;
    if (req.query.method) filter.method = req.query.method;
    if (req.query.statusGroup === 'error') filter.statusCode = { $gte: 400 };
    else if (req.query.statusGroup === 'success') filter.statusCode = { $lt: 400 };
    else if (req.query.status) {
      const status = parseInt(req.query.status);
      if (!isNaN(status)) filter.statusCode = status;
    }
    if (req.query.endpoint) filter.endpoint = { $regex: req.query.endpoint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    if (req.query.description) filter.description = { $regex: req.query.description, $options: 'i' };
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
    }

    const [total, logs] = await Promise.all([
      APILog.countDocuments(filter),
      APILog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        logs: await enrichLogs(logs),
        pagination: {
          total,
          page,
          limit,
          pages: Math.max(1, Math.ceil(total / limit)),
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching activity logs', { error: error.message });
    return res.status(500).json({ success: false, message: 'Failed to fetch activity logs', error: error.message });
  }
};

/**
 * GET /api/admin/super/logs/recent?since=<epochMs>&limit=N
 * Newest activity after a timestamp — powers the live feed.
 */
const getRecentActivity = async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ success: false, message: 'Super admin access required' });
    }

    const since = req.query.since ? new Date(parseInt(req.query.since)) : new Date(Date.now() - 60000);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 30));

    const logs = await APILog.find({ createdAt: { $gte: since } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        logs: await enrichLogs(logs),
        now: Date.now(),
      },
    });
  } catch (error) {
    logger.error('Error fetching recent activity', { error: error.message });
    return res.status(500).json({ success: false, message: 'Failed to fetch recent activity', error: error.message });
  }
};

/**
 * GET /api/admin/super/logs/stats?hours=24
 * Aggregations for the monitoring dashboard.
 */
const getActivityStats = async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ success: false, message: 'Super admin access required' });
    }

    const hours = Math.min(168, Math.max(1, parseInt(req.query.hours) || 24));
    const since = new Date(Date.now() - hours * 3600 * 1000);
    const activeSince = new Date(Date.now() - 30 * 60 * 1000);

    const [total, errors, avgResp, methodAgg, statusAgg, hourAgg, topTenantsAgg, topEndpointsAgg, activeTenantIds, activeUsers] =
      await Promise.all([
        APILog.countDocuments({ createdAt: { $gte: since } }),
        APILog.countDocuments({ createdAt: { $gte: since }, statusCode: { $gte: 400 } }),
        APILog.aggregate([
          { $match: { createdAt: { $gte: since }, responseTime: { $exists: true } } },
          { $group: { _id: null, avg: { $avg: '$responseTime' }, max: { $max: '$responseTime' } } },
        ]),
        APILog.aggregate([
          { $match: { createdAt: { $gte: since } } },
          { $group: { _id: '$method', count: { $sum: 1 } } },
        ]),
        APILog.aggregate([
          { $match: { createdAt: { $gte: since } } },
          {
            $group: {
              _id: {
                $cond: [
                  { $and: [{ $gte: ['$statusCode', 400] }, { $lt: ['$statusCode', 500] }] }, '4xx',
                  { $cond: [{ $gte: ['$statusCode', 500] }, '5xx',
                    { $cond: [{ $gte: ['$statusCode', 300] }, '3xx', '2xx'] }] },
                ],
              },
              count: { $sum: 1 },
            },
          },
        ]),
        APILog.aggregate([
          { $match: { createdAt: { $gte: since } } },
          {
            $group: {
              _id: {
                y: { $year: '$createdAt' },
                m: { $month: '$createdAt' },
                d: { $dayOfMonth: '$createdAt' },
                h: { $hour: '$createdAt' },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { '_id.y': 1, '_id.m': 1, '_id.d': 1, '_id.h': 1 } },
        ]),
        APILog.aggregate([
          { $match: { createdAt: { $gte: since }, tenantId: { $ne: null } } },
          { $group: { _id: '$tenantId', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 6 },
        ]),
        APILog.aggregate([
          { $match: { createdAt: { $gte: since } } },
          { $group: { _id: { $toLower: '$endpoint' }, count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 8 },
        ]),
        APILog.distinct('tenantId', { createdAt: { $gte: activeSince }, tenantId: { $ne: null } }),
        APILog.distinct('userId', { createdAt: { $gte: activeSince }, userId: { $ne: null } }),
      ]);

    // Fill a continuous per-hour series
    const series = [];
    const byHour = new Map();
    hourAgg.forEach((h) => {
      const key = `${h._id.y}-${String(h._id.m).padStart(2, '0')}-${String(h._id.d).padStart(2, '0')} ${String(h._id.h).padStart(2, '0')}:00`;
      byHour.set(key, h.count);
    });
    const start = new Date(since);
    start.setMinutes(0, 0, 0);
    for (let i = 0; i <= hours; i++) {
      const t = new Date(start.getTime() + i * 3600 * 1000);
      const key = `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')} ${String(t.getUTCHours()).padStart(2, '0')}:00`;
      series.push({ time: key.slice(11), timestamp: t.toISOString(), count: byHour.get(key) || 0 });
    }

    const methodCount = Object.fromEntries(methodAgg.map((m) => [m._id, m.count]));
    const statusCount = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 };
    statusAgg.forEach((s) => { statusCount[s._id] = s.count; });

    const tenantIds = topTenantsAgg.map((t) => t._id).filter(Boolean);
    const tenantDocs = tenantIds.length
      ? await Tenant.find({ _id: { $in: tenantIds } }).select('name subdomain').lean()
      : [];
    const tenantNameMap = Object.fromEntries(tenantDocs.map((t) => [t._id.toString(), t.name]));
    const topTenants = topTenantsAgg.map((t) => ({
      tenantId: t._id,
      name: tenantNameMap[t._id.toString()] || 'Deleted tenant',
      count: t.count,
    }));

    return res.status(200).json({
      success: true,
      data: {
        range: { hours },
        total,
        errors,
        errorRate: total ? Math.round((errors / total) * 1000) / 10 : 0,
        avgResponseTime: Math.round(avgResp[0]?.avg || 0),
        maxResponseTime: Math.round(avgResp[0]?.max || 0),
        activeTenants: activeTenantIds.length,
        activeUsers: activeUsers.length,
        series,
        methods: methodCount,
        status: statusCount,
        topTenants,
        topEndpoints: topEndpointsAgg.map((e) => ({ endpoint: e._id, count: e.count })),
      },
    });
  } catch (error) {
    logger.error('Error fetching activity stats', { error: error.message });
    return res.status(500).json({ success: false, message: 'Failed to fetch activity stats', error: error.message });
  }
};

/**
 * GET /api/admin/super/logs/tenants
 * Tenant list with last-24h activity counts (for the filter dropdown).
 */
const getLogTenants = async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ success: false, message: 'Super admin access required' });
    }

    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const [tenants, counts] = await Promise.all([
      Tenant.find().select('name subdomain subscription.status').lean(),
      APILog.aggregate([
        { $match: { createdAt: { $gte: since }, tenantId: { $ne: null } } },
        { $group: { _id: '$tenantId', count: { $sum: 1 } } },
      ]),
    ]);

    const countMap = Object.fromEntries(counts.map((c) => [c._id.toString(), c.count]));
    const rows = tenants.map((t) => ({
      _id: t._id,
      name: t.name,
      subdomain: t.subdomain,
      status: t.subscription?.status || 'unknown',
      activityCount: countMap[t._id.toString()] || 0,
    }));
    rows.sort((a, b) => b.activityCount - a.activityCount);

    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    logger.error('Error fetching log tenants', { error: error.message });
    return res.status(500).json({ success: false, message: 'Failed to fetch log tenants', error: error.message });
  }
};

module.exports = { getActivityLogs, getRecentActivity, getActivityStats, getLogTenants };
