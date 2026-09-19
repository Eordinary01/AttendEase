import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api from '../utils/api';
import eventSourceManager from '../utils/eventSourceManager';
import { useToast } from './ToastContext';
import {
  playNotificationChime,
  isNotificationSoundEnabled,
  setNotificationSoundEnabled,
} from '../utils/notificationSound';

const NotificationContext = createContext({
  alerts: [],
  unreadCount: 0,
  connectionStatus: 'disconnected',
  isLive: false,
  loading: false,
  soundEnabled: true,
  toggleSound: () => {},
  refreshAlerts: async () => {},
  markAsRead: async () => {},
  markAllAsRead: async () => {},
});

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children, isAuthenticated, role }) => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [soundEnabled, setSoundEnabledState] = useState(() => isNotificationSoundEnabled());
  const toast = useToast();
  const pollingTimerRef = useRef(null);

  const toggleSound = useCallback(() => {
    setSoundEnabledState((prev) => {
      const next = !prev;
      setNotificationSoundEnabled(next);
      if (next) {
        playNotificationChime();
      }
      return next;
    });
  }, []);

  // Fetch alerts from API
  const fetchAlerts = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setLoading(true);
      const res = await api.get('/alerts');
      const list = Array.isArray(res.data?.data)
        ? res.data.data
        : Array.isArray(res.data?.alerts)
        ? res.data.alerts
        : [];
      setAlerts(list);
    } catch {
      // Non-critical background failure
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Mark single alert as read
  const markAsRead = useCallback(async (alertId) => {
    try {
      await api.post(`/alerts/${alertId}/read`);
    } catch {
      // ignore
    }
    setAlerts((prev) =>
      prev.map((a) =>
        (a._id || a.id) === alertId ? { ...a, isRead: true } : a
      )
    );
  }, []);

  // Mark all alerts as read
  const markAllAsRead = useCallback(async () => {
    try {
      await api.post('/alerts/mark-all-read');
    } catch {
      // ignore
    }
    setAlerts((prev) => prev.map((a) => ({ ...a, isRead: true })));
  }, []);

  // 1. Initial alerts fetch on auth change
  useEffect(() => {
    if (isAuthenticated) {
      fetchAlerts();
    } else {
      setAlerts([]);
    }
  }, [isAuthenticated, fetchAlerts]);

  const currentUserId = typeof window !== 'undefined' ? (localStorage.getItem('userId') || '') : '';
  const currentRole = role || (typeof window !== 'undefined' ? (localStorage.getItem('role') || '') : '');
  const currentSection = typeof window !== 'undefined' ? (localStorage.getItem('userSection') || '') : '';
  const currentCourse = typeof window !== 'undefined' ? (localStorage.getItem('userCourse') || '') : '';
  const currentBranch = typeof window !== 'undefined' ? (localStorage.getItem('userBranch') || '') : '';
  const currentSubject = typeof window !== 'undefined' ? (localStorage.getItem('userSubject') || '') : '';

  // 2. Manage SSE Connection & Listeners
  useEffect(() => {
    if (!isAuthenticated) {
      eventSourceManager.disconnect();
      return;
    }

    // Defensive target relevance check on incoming real-time alerts
    const isAlertRelevant = (payload) => {
      if (!payload) return false;
      // 1. Sender exclusion: do not show live push for user's own action
      //    For alert.created, the actor is createdBy.
      //    For alert.updated, the actor is updatedBy.
      const senderId =
        (currentUserId && payload.eventName === 'alert.updated' && payload.updatedBy)
          ? payload.updatedBy
          : payload.createdBy;
      if (currentUserId && senderId && String(senderId) === String(currentUserId)) {
        return false;
      }
      // 2. Role targeting
      if (Array.isArray(payload.targetRoles) && payload.targetRoles.length > 0) {
        if (currentRole && !payload.targetRoles.includes(currentRole)) {
          return false;
        }
      }
      // 3. User targeting
      if (Array.isArray(payload.targetUsers) && payload.targetUsers.length > 0) {
        if (currentUserId && !payload.targetUsers.some((u) => String(u) === String(currentUserId))) {
          return false;
        }
      }
      // 4. Student academic section targeting
      if (currentRole === 'student' && Array.isArray(payload.targetSections) && payload.targetSections.length > 0) {
        if (currentSection && !payload.targetSections.some((s) => String(s).trim().toUpperCase() === currentSection.trim().toUpperCase())) {
          return false;
        }
      }
      // 5. Student academic course targeting
      if (currentRole === 'student' && Array.isArray(payload.targetCourseIds) && payload.targetCourseIds.length > 0) {
        if (currentCourse && !payload.targetCourseIds.some((c) => String(c) === String(currentCourse))) {
          return false;
        }
      }
      // 6. Student academic branch targeting
      if (currentRole === 'student' && Array.isArray(payload.targetBranches) && payload.targetBranches.length > 0) {
        if (currentBranch) {
          const branchCodeMap = {
            CSE: ['CSE', 'CS', 'COMPUTER SCIENCE', 'COMPUTER SCIENCE & ENGINEERING'],
            'COMPUTER SCIENCE': ['CSE', 'CS', 'COMPUTER SCIENCE', 'COMPUTER SCIENCE & ENGINEERING'],
            CHEM: ['CHEM', 'CHEMISTRY'],
            CHEMISTRY: ['CHEM', 'CHEMISTRY'],
            ME: ['ME', 'MECHANICAL', 'MECHANICAL ENGINEERING'],
            ECE: ['ECE', 'ELECTRONICS'],
            CIVIL: ['CIVIL', 'CIVIL ENGINEERING'],
          };
          const validBranches = branchCodeMap[currentBranch] || [currentBranch];
          if (!payload.targetBranches.some((b) => validBranches.includes(String(b).trim().toUpperCase()))) {
            return false;
          }
        }
      }
      // 7. Student subject targeting
      if (currentRole === 'student' && Array.isArray(payload.targetSubjectIds) && payload.targetSubjectIds.length > 0) {
        if (currentSubject && !payload.targetSubjectIds.some((s) => String(s) === String(currentSubject))) {
          return false;
        }
      }
      return true;
    };

    // Subscribe to connection status changes
    const unsubStatus = eventSourceManager.onStatusChange((status) => {
      setConnectionStatus(status);
      // Catch up on missed alerts when stream connects or restores from offline
      if (status === 'connected') {
        fetchAlerts();
      }
    });

    // Start SSE stream
    eventSourceManager.connect();

    // Handlers for real-time alert events
    const unsubAlertCreated = eventSourceManager.on('alert.created', (payload) => {
      if (!isAlertRelevant(payload)) {
        return;
      }

      setAlerts((prev) => {
        const id = payload.id || payload._id;
        if (prev.some((a) => (a._id || a.id) === id)) {
          return prev;
        }
        return [{ ...payload, isRead: false }, ...prev];
      });

      // Play audio chime
      playNotificationChime();

      // Show live toast notification
      if (toast) {
        const isUrgent = payload.priority === 'urgent' || payload.type === 'absence_escalation';
        const message = payload.title ? `${payload.title}: ${payload.message}` : payload.message;
        if (isUrgent && toast.error) {
          toast.error(message);
        } else if (payload.priority === 'high' && toast.warning) {
          toast.warning(message);
        } else if (toast.info) {
          toast.info(message);
        }
      }
    });

    const unsubAlertUpdated = eventSourceManager.on('alert.updated', (payload) => {
      if (!isAlertRelevant(payload)) {
        return;
      }
      setAlerts((prev) =>
        prev.map((a) => {
          const id = a._id || a.id;
          const targetId = payload.id || payload._id;
          return id === targetId ? { ...a, ...payload } : a;
        })
      );
    });

    const unsubAlertExpired = eventSourceManager.on('alert.expired', (payload) => {
      const targetId = payload.id || payload._id;
      setAlerts((prev) => prev.filter((a) => (a._id || a.id) !== targetId));
    });

    const unsubBroadcast = eventSourceManager.on('broadcast.announcement', (payload) => {
      playNotificationChime();
      if (toast && toast.warning) {
        toast.warning(`Announcement: ${payload.message || payload.title}`);
      }
      fetchAlerts();
    });

    const unsubLeaveSubmitted = eventSourceManager.on('leave.submitted', (payload) => {
      playNotificationChime();
      if (toast?.info) {
        toast.info(`Leave Request Submitted: A student applied for leave`);
      }
    });

    const unsubLeaveApproved = eventSourceManager.on('leave.approved', () => {
      playNotificationChime();
      if (toast?.success) {
        toast.success(`Leave Approved: Attendance has been reconciled.`);
      }
    });

    const unsubLeaveRejected = eventSourceManager.on('leave.rejected', () => {
      playNotificationChime();
      if (toast?.warning) {
        toast.warning(`Leave Request Rejected.`);
      }
    });

    const unsubTicketCreated = eventSourceManager.on('ticket.created', (payload) => {
      playNotificationChime();
      if (toast?.info) {
        toast.info(`New Ticket: ${payload.reason || payload.subject || 'Ticket submitted'}`);
      }
    });

    const unsubTicketStatus = eventSourceManager.on('ticket.status_changed', (payload) => {
      playNotificationChime();
      if (toast?.info) {
        toast.info(`Ticket Updated: Status is now ${payload.status || 'changed'}`);
      }
    });

    const unsubExamResults = eventSourceManager.on('exam.results_published', (payload) => {
      playNotificationChime();
      if (toast?.success) {
        toast.success(`Exam Results Published: ${payload.title || payload.subjectName || 'Results released'}`);
      }
    });

    const unsubExamSeating = eventSourceManager.on('exam.seating_ready', (payload) => {
      playNotificationChime();
      if (toast?.info) {
        toast.info(`Exam Seating Ready: Allocations generated for ${payload.date || 'exam'}`);
      }
    });

    const unsubRiskCritical = eventSourceManager.on('risk.critical', (payload) => {
      playNotificationChime();
      if (toast?.error) {
        toast.error(`Critical Attendance Warning: Streak of ${payload.streakLength || 3} absences recorded`);
      }
      fetchAlerts();
    });

    return () => {
      unsubStatus();
      unsubAlertCreated();
      unsubAlertUpdated();
      unsubAlertExpired();
      unsubBroadcast();
      unsubLeaveSubmitted();
      unsubLeaveApproved();
      unsubLeaveRejected();
      unsubTicketCreated();
      unsubTicketStatus();
      unsubExamResults();
      unsubExamSeating();
      unsubRiskCritical();
      eventSourceManager.disconnect();
    };
  }, [isAuthenticated, fetchAlerts, toast]);

  // 3. Polling Fallback: Only active if connection is NOT connected (or fallback requested)
  useEffect(() => {
    if (!isAuthenticated) return;

    const isPollingNeeded =
      connectionStatus === 'fallback_polling' ||
      connectionStatus === 'failed' ||
      process.env.REACT_APP_ENABLE_SSE === 'false';

    if (isPollingNeeded) {
      if (!pollingTimerRef.current) {
        pollingTimerRef.current = setInterval(fetchAlerts, 60000);
      }
    } else {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    }

    return () => {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    };
  }, [isAuthenticated, connectionStatus, fetchAlerts]);

  const unreadAlerts = alerts.filter((a) => !a.isRead);

  const value = {
    alerts,
    unreadAlerts,
    unreadCount: unreadAlerts.length,
    connectionStatus,
    isLive: connectionStatus === 'connected',
    loading,
    soundEnabled,
    toggleSound,
    refreshAlerts: fetchAlerts,
    markAsRead,
    markAllAsRead,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationContext;
