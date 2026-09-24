import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import {
  isDemoActive,
  getDemoSession,
  saveDemoSession,
  clearDemoSession,
} from '../utils/demoSandbox';

const DemoContext = createContext(null);

export const DemoProvider = ({ children }) => {
  const [isDemo, setIsDemo] = useState(false);
  const [demoRole, setDemoRole] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [slotsStatus, setSlotsStatus] = useState({});
  const [loading, setLoading] = useState(false);

  // Restore active demo session from sessionStorage on mount/refresh
  useEffect(() => {
    if (isDemoActive()) {
      const session = getDemoSession();
      if (session && session.expiresAt > Date.now()) {
        setIsDemo(true);
        setDemoRole(session.role);
        setSessionId(session.sessionId);
        setExpiresAt(session.expiresAt);
        setRemainingSeconds(Math.max(0, Math.round((session.expiresAt - Date.now()) / 1000)));
      } else {
        clearDemoSession();
      }
    }
  }, []);

  // Countdown timer for active demo session
  useEffect(() => {
    if (!isDemo || !expiresAt) return;

    const timer = setInterval(() => {
      const diff = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
      setRemainingSeconds(diff);

      if (diff <= 0) {
        clearInterval(timer);
        endDemo(true);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isDemo, expiresAt]);

  // Fetch slot availability across all 4 roles
  const fetchSlotStatus = useCallback(async () => {
    try {
      const res = await api.get('/demo/status');
      if (res.data?.success && res.data?.slots) {
        setSlotsStatus(res.data.slots);
      }
    } catch {
      // Ignore network errors on polling
    }
  }, []);

  // Claim a role and enter Demo Mode
  const claimDemoRole = async (role) => {
    setLoading(true);
    try {
      let visitorSessionId = sessionStorage.getItem('demo_visitor_session_id');
      if (!visitorSessionId) {
        visitorSessionId = 'sess_' + Math.random().toString(36).substring(2, 11) + Date.now();
        sessionStorage.setItem('demo_visitor_session_id', visitorSessionId);
      }

      const res = await api.post('/demo/claim', {
        role,
        sessionId: visitorSessionId,
      });

      if (res.data?.success) {
        const data = res.data;
        const sessionPayload = {
          isDemo: true,
          role: data.role,
          sessionId: data.sessionId,
          expiresAt: data.expiresAt,
          durationSeconds: data.durationSeconds,
          user: data.user,
        };

        // 1. Save demo sandbox context
        saveDemoSession(sessionPayload);

        // 2. Set client UI context in localStorage (NO TOKENS OR SECRETS STORED - Phase 10)
        localStorage.removeItem('token');
        localStorage.setItem('role', data.role);
        localStorage.setItem('userId', `demo-${data.role}`);
        localStorage.setItem('userName', data.user.name);
        localStorage.setItem('userEmail', `${data.role}.demo@attendease.internal`);
        localStorage.setItem('tenantSubdomain', data.user.tenantSubdomain || 'demo');
        localStorage.setItem('tenantName', data.user.tenantName || 'AttendEase Demo Academy');
        if (data.role === 'parent' && data.user.studentName) {
          localStorage.setItem('studentName', data.user.studentName);
        }

        // Notify app components that auth state changed
        window.dispatchEvent(new CustomEvent('attendease:auth-changed'));

        // Update local React state
        setIsDemo(true);
        setDemoRole(data.role);
        setSessionId(data.sessionId);
        setExpiresAt(data.expiresAt);
        setRemainingSeconds(data.durationSeconds);
        setIsModalOpen(false);

        if (typeof window !== 'undefined' && window.notifyToast) {
          window.notifyToast(`Welcome to the ${data.role.toUpperCase()} Demo Sandbox!`, 'success', 5000);
        }

        // Navigate directly to dashboard
        const destination = data.role === 'parent' ? '/parent/dashboard' : '/dashboard';
        window.location.href = destination;
        return { success: true };
      }
      return { success: false, message: res.data?.message || 'Failed to claim demo slot' };
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Error claiming demo slot';
      if (typeof window !== 'undefined' && window.notifyToast) {
        window.notifyToast(msg, 'error', 6000);
      }
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  // End demo session and clean up
  const endDemo = async (isExpired = false) => {
    const session = getDemoSession();
    const currentRole = demoRole || session?.role;
    const currentSessionId = sessionId || session?.sessionId;

    // Release slot on backend
    if (currentRole && currentSessionId) {
      api.post('/demo/release', {
        role: currentRole,
        sessionId: currentSessionId,
      }).catch(() => {});
    }

    // Wipe demo state & client auth credentials
    clearDemoSession();
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('tenantId');
    localStorage.removeItem('tenantSubdomain');
    localStorage.removeItem('tenantName');
    localStorage.removeItem('studentName');
    window.dispatchEvent(new CustomEvent('attendease:auth-changed'));

    setIsDemo(false);
    setDemoRole(null);
    setSessionId(null);
    setExpiresAt(null);
    setRemainingSeconds(0);

    if (isExpired && typeof window !== 'undefined' && window.notifyToast) {
      window.notifyToast('Your 15-minute demo sandbox session has expired.', 'info', 6000);
    }

    window.location.href = '/';
  };

  const openRoleModal = () => {
    fetchSlotStatus();
    setIsModalOpen(true);
  };

  const closeRoleModal = () => setIsModalOpen(false);

  return (
    <DemoContext.Provider
      value={{
        isDemo,
        demoRole,
        sessionId,
        expiresAt,
        remainingSeconds,
        isModalOpen,
        slotsStatus,
        loading,
        claimDemoRole,
        endDemo,
        openRoleModal,
        closeRoleModal,
        fetchSlotStatus,
      }}
    >
      {children}
    </DemoContext.Provider>
  );
};

export const useDemo = () => {
  const context = useContext(DemoContext);
  if (!context) {
    throw new Error('useDemo must be used within a DemoProvider');
  }
  return context;
};

export default DemoContext;
