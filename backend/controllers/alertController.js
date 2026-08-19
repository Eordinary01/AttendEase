// controllers/alertController.js
const Alert = require('../models/Alert');
const User = require('../models/User');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

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
 * This requires a UserAlertRead model to track which users have read which alerts
 */
const markAlertAsRead = async (req, res) => {
  try {
    const { alertId } = req.params;
    const userId = req.user._id;

    // You would need a UserAlertRead model for this
    // For now, just return success
    // await UserAlertRead.findOneAndUpdate(
    //   { alertId, userId },
    //   { readAt: new Date() },
    //   { upsert: true }
    // );

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

module.exports = {
  createAlert,
  getAlerts,
  updateAlert,
  deleteAlert,
  getAlertStats,
  markAlertAsRead
};