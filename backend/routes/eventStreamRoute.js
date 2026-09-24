const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const sseManager = require('../utils/sseManager');
const logger = require('../utils/logger');

/**
 * GET /api/events/stream
 *
 * Real-time Server-Sent Events endpoint.
 * Requires valid JWT (Bearer header or httpOnly accessToken cookie).
 *
 * Query Parameters:
 * - `events`: Comma-separated list of event names to subscribe to (optional).
 *             If omitted, the user receives all events permitted by their role.
 */
router.get('/stream', authenticateToken, (req, res) => {
  try {
    const requestedEvents = req.query.events
      ? req.query.events.split(',').map(e => e.trim()).filter(Boolean)
      : [];

    const subscription = sseManager.subscribe(req, res, requestedEvents);
    if (!subscription) {
      // 429 response handled within sseManager
      return;
    }

    logger.info('SSE client connected to stream', {
      userId: req.user._id,
      role: req.user.role,
      tenantId: req.user.tenantId,
      sessionId: subscription.sessionId,
      filterCount: requestedEvents.length,
    });
  } catch (err) {
    logger.error('Error establishing SSE connection', {
      userId: req.user?._id,
      error: err.message,
    });

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Failed to establish event stream connection',
      });
    }
  }
});

/**
 * GET /api/events/stats
 * Real-time connection statistics (Admin only)
 */
router.get('/stats', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Admin role required',
    });
  }

  const stats = sseManager.getStats();
  return res.json({
    success: true,
    data: stats,
  });
});

module.exports = router;
