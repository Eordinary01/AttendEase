// controllers/alertController.js
const Alert = require('../models/Alert');
const User = require('../models/User');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const {
  publishAlertCreated,
  publishAlertUpdated,
  publishAlertExpired,
} = require('../events/publishers');

/**
 * CREATE ANNOUNCEMENT/ALERT
 * Admin can create alerts for their tenant
 * Super Admin can create platform-wide alerts
 */
const SHORT_TERM_HOURS = 6;
const ANNOUNCEMENT_DAYS = 7;

const createAlert = async (req, res) => {
  try {
    const { message, isGlobal, targetRoles, expiryDate, priority, title, type, targetSections, targetCourseIds, targetBranches, targetSubjectIds } = req.body;
    const userId = req.user._id;
    const tenantId = req.user.tenantId;
    const userRole = req.user.role;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Alert message is required' });
    }
    if (message.length > 1000) {
      return res.status(400).json({ success: false, message: 'Alert message cannot exceed 1000 characters' });
    }

    let isPlatformAlert = false;
    let targetTenantId = tenantId;

    if (userRole === 'super_admin' && isGlobal === true) {
      isPlatformAlert = true;
      targetTenantId = null;
    } else if (userRole !== 'admin' && userRole !== 'super_admin' && userRole !== 'teacher') {
      return res.status(403).json({ success: false, message: 'Only admins and teachers can create alerts' });
    }

    let resolvedSections = Array.isArray(targetSections) ? targetSections.map(s => s.trim().toUpperCase()) : [];
    let resolvedCourseIds = Array.isArray(targetCourseIds) ? targetCourseIds.filter(Boolean) : [];
    let resolvedBranches = Array.isArray(targetBranches) ? targetBranches.map(b => b.trim()) : [];
    let resolvedSubjectIds = Array.isArray(targetSubjectIds) ? targetSubjectIds.filter(Boolean) : [];

    // If creator is a teacher, auto-derive courseId, branch & subjectId from assigned subjects for target sections
    if (userRole === 'teacher') {
      const teacher = await User.findById(userId).populate("assignedSubjects.subjectId").lean();
      const assigned = teacher?.assignedSubjects || [];

      const secSet = new Set(resolvedSections);
      const matchingAssigned = assigned.filter(a => secSet.size === 0 || secSet.has((a.section || "").trim().toUpperCase()));

      matchingAssigned.forEach(a => {
        const sub = a.subjectId;
        if (sub) {
          if (sub._id && !resolvedSubjectIds.some(id => id.toString() === sub._id.toString())) {
            resolvedSubjectIds.push(sub._id);
          }
          if (sub.courseId && !resolvedCourseIds.some(id => id.toString() === sub.courseId.toString())) {
            resolvedCourseIds.push(sub.courseId);
          }
          if (sub.branch && !resolvedBranches.includes(sub.branch)) {
            resolvedBranches.push(sub.branch);
          }
        }
      });
    }

    const alertType = type || 'announcement';
    let computedExpiry = expiryDate ? new Date(expiryDate) : null;
    if (!computedExpiry) {
      const now = new Date();
      if (alertType === 'short_term') {
        now.setHours(now.getHours() + SHORT_TERM_HOURS);
        computedExpiry = now;
      } else {
        now.setDate(now.getDate() + ANNOUNCEMENT_DAYS);
        computedExpiry = now;
      }
    }

    const newAlert = new Alert({
      message: message.trim(),
      title: title || 'Announcement',
      type: alertType,
      priority: priority || 'normal',
      isActive: true,
      isPlatformAlert,
      tenantId: targetTenantId,
      createdBy: userId,
      readBy: [userId],
      targetRoles: targetRoles || ['student', 'teacher', 'admin'],
      targetSections: resolvedSections,
      targetCourseIds: resolvedCourseIds,
      targetBranches: resolvedBranches,
      targetSubjectIds: resolvedSubjectIds,
      expiryDate: computedExpiry,
      metadata: {
        createdAt: new Date(),
        createdByRole: userRole,
        createdByName: req.user.name
      }
    });

    await newAlert.save();

    // Emit real-time event (excluding sender from live push)
    publishAlertCreated(targetTenantId, newAlert, userId ? String(userId) : null);

    return res.status(201).json({
      success: true,
      message: 'Alert created successfully',
      data: {
        id: newAlert._id,
        message: newAlert.message,
        title: newAlert.title,
        type: newAlert.type,
        priority: newAlert.priority,
        targetSections: newAlert.targetSections,
        targetCourseIds: newAlert.targetCourseIds,
        targetBranches: newAlert.targetBranches,
        targetSubjectIds: newAlert.targetSubjectIds,
        isPlatformAlert: newAlert.isPlatformAlert,
        createdAt: newAlert.createdAt,
        expiryDate: newAlert.expiryDate
      }
    });
  } catch (error) {
    logger.error('Error creating alert', { error: error.message });
    return res.status(500).json({ success: false, message: 'Failed to create alert' });
  }
};

const getAlerts = async (req, res) => {
  try {
    const userId = req.user._id;
    const tenantId = req.user.tenantId;
    const userRole = req.user.role;
    const { includeExpired = false, limit = 50, priority, type } = req.query;

    if (userRole === 'parent' || req.user.accessMode === 'parent') {
      return res.status(200).json({ success: true, count: 0, alerts: [], data: [] });
    }

    let allAlerts = [];

    if (userRole === 'super_admin') {
      const query = { isActive: true };
      if (req.query.tenantId) {
        // Super Admin explicitly auditing a specific campus tenant
        query.tenantId = req.query.tenantId;
      } else {
        // Super Admin platform view: ONLY platform-wide alerts, NEVER campus automated alerts
        query.$or = [
          { isPlatformAlert: true },
          { targetRoles: 'super_admin' },
        ];
      }
      if (includeExpired !== 'true') query.expiryDate = { $gte: new Date() };
      allAlerts = await Alert.find(query)
        .sort({ priority: -1, createdAt: -1 })
        .limit(parseInt(limit, 10))
        .populate('createdBy', 'name email role')
        .lean();
    } else if (userRole === 'teacher' || userRole === 'admin') {
      const query = {
        isActive: true,
        $or: [
          { isPlatformAlert: true },
          { tenantId, createdBy: userId },
          { tenantId, targetRoles: userRole },
          { tenantId, targetSections: { $size: 0 }, targetCourseIds: { $size: 0 } },
        ],
      };
      if (includeExpired !== 'true') {
        query.expiryDate = { $gte: new Date() };
      }
      allAlerts = await Alert.find(query)
        .sort({ priority: -1, createdAt: -1 })
        .limit(parseInt(limit, 10))
        .populate('createdBy', 'name email role')
        .lean();
    } else {
      // Student role: fetch user & enrollment profile for strict targeting
      const user = await User.findById(userId).select('section courseId branch semester email rollNo').lean();
      const Enrollment = mongoose.model('Enrollment');
      const enrollment = await Enrollment.findOne({
        $or: [
          { userId },
          ...(user?.email ? [{ email: user.email.toLowerCase() }] : []),
        ],
        tenantId,
      }).lean();

      const studentSection = (user?.section || enrollment?.section || "").trim().toUpperCase();
      const studentCourseId = user?.courseId || enrollment?.courseId || null;
      const studentBranch = (user?.branch || enrollment?.branch || "").trim().toUpperCase();

      const branchCodeMap = {
        "CSE": ["CSE", "COMPUTER SCIENCE", "COMPUTER SCIENCE & ENGINEERING"],
        "COMPUTER SCIENCE": ["CSE", "COMPUTER SCIENCE", "COMPUTER SCIENCE & ENGINEERING"],
        "CHEM": ["CHEM", "CHEMISTRY"],
        "CHEMISTRY": ["CHEM", "CHEMISTRY"],
        "ME": ["ME", "MECHANICAL", "MECHANICAL ENGINEERING"],
        "ECE": ["ECE", "ELECTRONICS"],
        "CIVIL": ["CIVIL", "CIVIL ENGINEERING"]
      };

      const validBranches = branchCodeMap[studentBranch] || (studentBranch ? [studentBranch] : []);

      const rawAlerts = await Alert.find({
        isActive: true,
        $or: [{ isPlatformAlert: true }, { tenantId }],
        targetRoles: { $in: ['student'] },
        ...(includeExpired !== 'true' ? { expiryDate: { $gte: new Date() } } : {}),
      })
        .sort({ priority: -1, createdAt: -1 })
        .limit(parseInt(limit, 10))
        .populate('createdBy', 'name email role')
        .lean();

      // Filter alerts strictly against student's section, courseId, and branch
      allAlerts = rawAlerts.filter((alert) => {
        if (alert.isPlatformAlert) return true;

        const hasSec = Array.isArray(alert.targetSections) && alert.targetSections.length > 0;
        const hasCourse = Array.isArray(alert.targetCourseIds) && alert.targetCourseIds.length > 0;
        const hasBranch = Array.isArray(alert.targetBranches) && alert.targetBranches.length > 0;

        // Global tenant alert (no target specified)
        if (!hasSec && !hasCourse && !hasBranch) return true;

        if (hasSec) {
          const matchSec = alert.targetSections.some((s) => String(s).trim().toUpperCase() === studentSection);
          if (!matchSec) return false;
        }

        if (hasCourse && studentCourseId) {
          const matchCourse = alert.targetCourseIds.some((cid) => cid.toString() === studentCourseId.toString());
          if (!matchCourse) return false;
        }

        if (hasBranch && validBranches.length > 0) {
          const matchBranch = alert.targetBranches.some((b) =>
            validBranches.includes(String(b).trim().toUpperCase())
          );
          if (!matchBranch) return false;
        }

        return true;
      });
    }

    return res.status(200).json({
      success: true,
      count: allAlerts.length,
      data: allAlerts.map(alert => ({
        id: alert._id,
        title: alert.title,
        message: alert.message,
        type: alert.type,
        priority: alert.priority,
        targetSections: alert.targetSections,
        targetCourseIds: alert.targetCourseIds,
        targetBranches: alert.targetBranches,
        isPlatformAlert: alert.isPlatformAlert,
        isRead: Boolean(
          alert.readBy &&
          alert.readBy.some(uid => uid.toString() === req.user._id.toString())
        ),
        createdAt: alert.createdAt,
        expiryDate: alert.expiryDate,
        createdBy: alert.createdBy ? {
          id: alert.createdBy._id,
          name: alert.createdBy.name,
          role: alert.createdBy.role
        } : null
      }))
    });
  } catch (error) {
    logger.error('Error fetching alerts', { error: error.message });
    return res.status(500).json({ success: false, message: 'Failed to fetch alerts' });
  }
};

/**
 * UPDATE ALERT
 * Admin can update their own alerts
 */
const updateAlert = async (req, res) => {
  try {
    const { alertId } = req.params;
    const { message, title, priority, expiryDate, isActive } = req.body;
    const userId = req.user._id;
    const tenantId = req.user.tenantId;
    const userRole = req.user.role;

    // Find alert
    const alert = userRole === 'super_admin'
      ? await Alert.findById(alertId)
      : await Alert.findOne({ _id: alertId, tenantId });
    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    // Update fields
    if (message) alert.message = message.trim();
    if (title) alert.title = title;
    if (priority) alert.priority = priority;
    if (expiryDate) alert.expiryDate = new Date(expiryDate);
    if (isActive !== undefined) alert.isActive = isActive;

    alert.updatedAt = new Date();
    alert.metadata.updatedBy = userId;
    alert.metadata.updatedAt = new Date();

    await alert.save();

    // Emit real-time event (excluding sender from live push)
    publishAlertUpdated(alert.tenantId, alert, userId);

    return res.status(200).json({
      success: true,
      message: 'Alert updated successfully',
      data: alert
    });

  } catch (error) {
    logger.error('Error updating alert', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to update alert',
      error: error.message
    });
  }
};

/**
 * DELETE ALERT
 * Admin can delete their own alerts
 */
const deleteAlert = async (req, res) => {
  try {
    const { alertId } = req.params;
    const tenantId = req.user.tenantId;
    const userRole = req.user.role;

    const alert = userRole === 'super_admin'
      ? await Alert.findById(alertId)
      : await Alert.findOne({ _id: alertId, tenantId });
    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    // Soft delete or hard delete? Let's do soft delete
    alert.isActive = false;
    alert.deletedAt = new Date();
    alert.deletedBy = req.user._id;
    await alert.save();

    // Emit real-time event (excluding sender from live push)
    publishAlertExpired(alert.tenantId, alert._id, req.user._id);

    return res.status(200).json({
      success: true,
      message: 'Alert deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting alert', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to delete alert',
      error: error.message
    });
  }
};

/**
 * GET ALERT STATISTICS
 * Admin can see alert statistics for their tenant
 */
const getAlertStats = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const userRole = req.user.role;
    const { fromDate, toDate } = req.query;

    let query = { isActive: true };

    if (userRole === 'super_admin') {
      // Super admin sees all
    } else {
      query.$or = [
        { tenantId: tenantId },
        { isPlatformAlert: true }
      ];
    }

    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) query.createdAt.$lte = new Date(toDate);
    }

    const stats = await Alert.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          activeNow: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { expiryDate: null },
                    { expiryDate: { $gte: new Date() } }
                  ]
                },
                1,
                0
              ]
            }
          },
          byPriority: {
            $push: "$priority"
          },
          platformWide: {
            $sum: { $cond: [{ $eq: ["$isPlatformAlert", true] }, 1, 0] }
          }
        }
      },
      {
        $project: {
          total: 1,
          activeNow: 1,
          platformWide: 1,
          lowPriority: {
            $size: {
              $filter: { input: "$byPriority", as: "p", cond: { $eq: ["$$p", "low"] } }
            }
          },
          normalPriority: {
            $size: {
              $filter: { input: "$byPriority", as: "p", cond: { $eq: ["$$p", "normal"] } }
            }
          },
          highPriority: {
            $size: {
              $filter: { input: "$byPriority", as: "p", cond: { $eq: ["$$p", "high"] } }
            }
          },
          urgentPriority: {
            $size: {
              $filter: { input: "$byPriority", as: "p", cond: { $eq: ["$$p", "urgent"] } }
            }
          }
        }
      }
    ]);

    return res.status(200).json({
      success: true,
      message: 'Alert statistics retrieved',
      data: stats.length > 0 ? stats[0] : {
        total: 0,
        activeNow: 0,
        platformWide: 0,
        lowPriority: 0,
        normalPriority: 0,
        highPriority: 0,
        urgentPriority: 0
      }
    });

  } catch (error) {
    logger.error('Error fetching alert stats', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error.message
    });
  }
};

/**
 * MARK ALERT AS READ (for user-specific read tracking)
 */
const markAlertAsRead = async (req, res) => {
  try {
    const { alertId } = req.params;
    const userId = req.user._id;

    await Alert.findByIdAndUpdate(alertId, {
      $addToSet: { readBy: userId }
    });

    return res.status(200).json({
      success: true,
      message: 'Alert marked as read'
    });

  } catch (error) {
    logger.error('Error marking alert as read', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to mark alert as read',
      error: error.message
    });
  }
};

/**
 * MARK ALL ALERTS AS READ (for current user)
 */
const markAllAlertsAsRead = async (req, res) => {
  try {
    const userId = req.user._id;
    const tenantId = req.user.tenantId;

    await Alert.updateMany(
      {
        isActive: true,
        $or: [{ tenantId }, { isPlatformAlert: true }],
        readBy: { $ne: userId }
      },
      { $addToSet: { readBy: userId } }
    );

    return res.status(200).json({
      success: true,
      message: 'All alerts marked as read'
    });

  } catch (error) {
    logger.error('Error marking all alerts as read', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to mark all alerts as read',
      error: error.message
    });
  }
};

/**
 * GET AUTOMATED ALERTS (Tenant Admin dedicated section)
 * Full ledger of automated system notifications for the tenant
 */
const getAutomatedAlerts = async (req, res) => {
  try {
    let tenantId = req.user.tenantId || req.query.tenantId;
    const { status = 'all', priority, type, search, page = 1, limit = 20 } = req.query;

    const automatedTypes = [
      'absence_escalation',
      'attendance_warning',
      'system',
      'proxy_warning',
      'promotion_notice',
      'fee_reminder'
    ];

    const query = {
      type: type && automatedTypes.includes(type) ? type : { $in: automatedTypes },
      isActive: true,
    };

    if (tenantId) {
      query.tenantId = tenantId;
    }

    if (priority && priority !== 'all') {
      query.priority = priority;
    }

    if (status === 'unresolved') {
      query['metadata.resolved'] = { $ne: true };
    } else if (status === 'resolved') {
      query['metadata.resolved'] = true;
    }

    if (search && search.trim()) {
      const s = search.trim();
      query.$or = [
        { title: { $regex: s, $options: 'i' } },
        { message: { $regex: s, $options: 'i' } },
        { 'metadata.studentName': { $regex: s, $options: 'i' } },
        { 'metadata.rollNo': { $regex: s, $options: 'i' } },
        { 'metadata.section': { $regex: s, $options: 'i' } },
      ];
    }

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const tenantFilter = tenantId ? { tenantId } : {};

    const [alerts, total, unresolvedCount, absenceCount, proxyCount] = await Promise.all([
      Alert.find(query)
        .sort({ 'metadata.resolved': 1, priority: -1, createdAt: -1 })
        .skip(skip)
        .limit(take)
        .populate('createdBy', 'name email')
        .lean(),
      Alert.countDocuments(query),
      Alert.countDocuments({
        ...tenantFilter,
        type: { $in: automatedTypes },
        isActive: true,
        'metadata.resolved': { $ne: true },
      }),
      Alert.countDocuments({
        ...tenantFilter,
        type: 'absence_escalation',
        isActive: true,
      }),
      Alert.countDocuments({
        ...tenantFilter,
        type: { $in: ['system', 'proxy_warning'] },
        isActive: true,
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        alerts,
        pagination: {
          total,
          page: parseInt(page, 10),
          pages: Math.ceil(total / take) || 1,
          limit: take,
        },
        stats: {
          total,
          unresolved: unresolvedCount,
          unresolvedCount,
          absenceEscalations: absenceCount,
          absenceCount,
          systemProxyAlerts: proxyCount,
          proxyCount,
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching automated alerts', { error: error.message });
    return res.status(500).json({ success: false, message: 'Failed to fetch automated alerts' });
  }
};

/**
 * RESOLVE / ACKNOWLEDGE ALERT
 */
const resolveAlert = async (req, res) => {
  try {
    const alertId = req.params.alertId || req.params.id;
    if (!alertId || !mongoose.Types.ObjectId.isValid(alertId)) {
      return res.status(400).json({ success: false, message: 'Invalid or missing alert ID' });
    }

    const { note } = req.body || {};
    const query = { _id: alertId };
    if (req.user.role !== 'super_admin' && req.user.tenantId) {
      query.tenantId = req.user.tenantId;
    }

    const alert = await Alert.findOne(query);
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }

    const currentResolved = Boolean(alert.metadata?.resolved);
    const nextResolved = !currentResolved;

    alert.metadata = {
      ...(alert.metadata || {}),
      resolved: nextResolved,
      resolvedAt: nextResolved ? new Date() : null,
      resolvedBy: nextResolved ? req.user.name : null,
      resolvedByName: nextResolved ? req.user.name : null,
      resolvedById: nextResolved ? req.user._id : null,
      resolutionNote: nextResolved && note ? String(note).trim() : (nextResolved ? (alert.metadata?.resolutionNote || '') : null),
    };

    alert.markModified('metadata');
    await alert.save();

    return res.status(200).json({
      success: true,
      message: nextResolved ? 'Alert acknowledged and marked as resolved' : 'Alert marked as action required',
      data: alert,
    });
  } catch (error) {
    logger.error('Error resolving alert', { error: error.message });
    return res.status(500).json({ success: false, message: 'Failed to update alert resolution' });
  }
};

/**
 * TEST TRIGGER AUTOMATED ALERT (Simulation for Tenant Admins)
 */
const testTriggerAutomatedAlert = async (req, res) => {
  try {
    let tenantId = req.user.tenantId || req.body.tenantId || req.query.tenantId;
    if (!tenantId && req.user.role === 'super_admin') {
      const Tenant = require('../models/Tenant');
      const firstTenant = await Tenant.findOne().select('_id');
      tenantId = firstTenant?._id || null;
    }

    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'No target tenant found for simulation' });
    }

    const { type = 'absence_escalation', severity = 'high' } = req.body;

    const titleMap = {
      absence_escalation: 'Test Escalation: 3 Consecutive Absences Simulation',
      attendance_warning: 'Test Notice: Low Attendance Defaulter Warning (<75%)',
      proxy_warning: 'Test Security: Unusual IP Attendance Pattern Detected',
      promotion_notice: 'Test Academic: Semester Promotion Readiness Notice',
      fee_reminder: 'Test Finance: Tuition Fee Payment Due Notice',
    };

    const messageMap = {
      absence_escalation: 'Sample Student (Roll No: TEST-101) in Section A has missed 3 consecutive scheduled classes. Automated early warning test execution.',
      attendance_warning: 'Sample Student attendance is currently 68.5% (below institutional threshold of 75%). Academic intervention advised.',
      proxy_warning: 'Simulated 45 attendance marks from single IP address 192.168.1.100 flagged for biometric review.',
      promotion_notice: 'Promotion scanner simulated audit: 24 students ready for Semester 4 rollover.',
      fee_reminder: 'Tuition fee installment due in 7 days for Semester 3 cohort.',
    };

    const testAlert = await Alert.create({
      tenantId,
      title: titleMap[type] || 'Automated System Test Notification',
      message: messageMap[type] || 'This is an automated system notification simulation for validation.',
      type: type === 'proxy_warning' ? 'system' : type,
      priority: severity,
      isActive: true,
      targetRoles: ['admin'],
      expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      metadata: {
        isTestSimulation: true,
        studentName: 'Sample Student',
        rollNo: 'TEST-101',
        section: 'A',
        streakLength: 3,
        triggeredBy: req.user.name,
        triggeredAt: new Date(),
        resolved: false,
      },
    });

    publishAlertCreated(tenantId, testAlert, null);

    return res.status(201).json({
      success: true,
      message: 'Test automated notification generated and published to your campus stream',
      data: testAlert,
    });
  } catch (error) {
    logger.error('Error triggering test automated alert', { error: error.message });
    return res.status(500).json({ success: false, message: 'Failed to test-trigger alert' });
  }
};

module.exports = {
  createAlert,
  getAlerts,
  updateAlert,
  deleteAlert,
  getAlertStats,
  markAlertAsRead,
  markAllAlertsAsRead,
  getAutomatedAlerts,
  resolveAlert,
  testTriggerAutomatedAlert,
};