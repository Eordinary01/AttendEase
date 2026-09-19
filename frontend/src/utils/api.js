import axios from "axios";
import { isDemoActive, clearDemoSession, addSimulatedItem, mergeWithSimulated } from "./demoSandbox";

export function getApiBaseUrl() {
  let url = process.env.REACT_APP_API_URL || "http://localhost:8011/api";
  if (typeof window !== "undefined" && window.location) {
    if (window.location.hostname === "localhost" && url.includes("127.0.0.1")) {
      url = url.replace("127.0.0.1", "localhost");
    } else if (window.location.hostname === "127.0.0.1" && url.includes("localhost")) {
      url = url.replace("localhost", "127.0.0.1");
    }
  }
  return url;
}

const API_URL = getApiBaseUrl();

export function getCookie(name) {
  if (typeof document === "undefined") return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop().split(";").shift() || null;
  }
  return null;
}

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

/**
 * Dual-Mode Authentication Architecture:
 * 1. Bearer Token (Header-First): The frontend stores `token` in localStorage and attaches
 *    `Authorization: Bearer <token>` on all outgoing API calls. This preserves compatibility
 *    with mobile clients and existing role/state logic across 30+ components.
 * 2. httpOnly Cookies + XSRF Token: The backend concurrently sets secure, httpOnly cookies
 *    (accessToken, refreshToken) and a readable XSRF-TOKEN cookie. For state-changing mutations,
 *    `X-XSRF-TOKEN` is transmitted via custom header to safeguard cookie-authenticated requests.
 */
api.interceptors.request.use((config) => {
  // Prevent duplicate /api/api/ if baseURL already contains /api
  if (config.url && config.url.startsWith('/api/') && (API_URL || '').endsWith('/api')) {
    config.url = config.url.replace(/^\/api/, '');
  }

  const method = (config.method || "").toLowerCase();
  if (["post", "put", "patch", "delete"].includes(method)) {
    const xsrf = getCookie("XSRF-TOKEN");
    if (xsrf) {
      config.headers["X-XSRF-TOKEN"] = xsrf;
    }
  }

  // Phase 10: In demo mode, suppress Authorization header (strictly cookie-based auth)
  const token = localStorage.getItem("token");
  if (token && !isDemoActive()) {
    config.headers.Authorization = `Bearer ${token}`;
  } else if (isDemoActive() && config.headers) {
    delete config.headers.Authorization;
  }

  // Demo Sandbox Interception (UI responds, database stays pristine)
  if (isDemoActive()) {
    const url = config.url || '';
    if (['post', 'put', 'patch', 'delete'].includes(method)) {
      if (url.includes('/billing') || url.includes('/tenant/plan') || url.includes('/tenant/delete')) {
        config.adapter = async () => {
          const error = new Error('This action is disabled in Demo Mode.');
          error.response = {
            status: 403,
            data: { success: false, message: 'Billing and plan modifications are disabled in the Demo Sandbox.' },
          };
          throw error;
        };
        return config;
      }

      let parsedBody = {};
      try {
        parsedBody = typeof config.data === 'string' ? JSON.parse(config.data) : (config.data || {});
      } catch {
        parsedBody = {};
      }

      if (url.includes('/leaves')) {
        const newItem = addSimulatedItem('leaves', {
          ...parsedBody,
          status: 'Pending',
          appliedOn: new Date().toISOString(),
        });
        config.adapter = async () => ({
          data: { success: true, message: 'Leave application submitted successfully (Demo Sandbox)', data: newItem },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        });
        return config;
      }

      if (url.includes('/tickets')) {
        const newItem = addSimulatedItem('tickets', {
          ...parsedBody,
          status: 'Open',
          ticketId: `DEMO-${Math.floor(1000 + Math.random() * 9000)}`,
        });
        config.adapter = async () => ({
          data: { success: true, message: 'Support ticket submitted successfully (Demo Sandbox)', data: newItem },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        });
        return config;
      }

      if (url.includes('/alerts')) {
        const newItem = addSimulatedItem('alerts', {
          ...parsedBody,
          priority: parsedBody.priority || 'medium',
        });
        config.adapter = async () => ({
          data: { success: true, message: 'Announcement created successfully (Demo Sandbox)', alert: newItem },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        });
        return config;
      }

      if (url.includes('/attendance')) {
        config.adapter = async () => ({
          data: { success: true, message: 'Attendance marked successfully (Demo Sandbox - Database preserved)', recordCount: 1 },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        });
        return config;
      }
    }
  }

  return config;
});

const upgradeHandlers = [];
const authHandlers = [];

export const onUpgradeError = (handler) => {
  upgradeHandlers.push(handler);
  return () => {
    const idx = upgradeHandlers.indexOf(handler);
    if (idx !== -1) upgradeHandlers.splice(idx, 1);
  };
};

export const onAuthError = (handler) => {
  authHandlers.push(handler);
  return () => {
    const idx = authHandlers.indexOf(handler);
    if (idx !== -1) authHandlers.splice(idx, 1);
  };
};

api.interceptors.response.use(
  (response) => {
    const method = (response.config?.method || "").toLowerCase();
    const url = response.config?.url || '';

    // Merge simulated sandbox records into GET responses when in Demo mode
    if (isDemoActive() && method === 'get' && response.data) {
      if (url.includes('/leaves') && Array.isArray(response.data?.data)) {
        response.data.data = mergeWithSimulated('leaves', response.data.data);
      } else if (url.includes('/tickets') && Array.isArray(response.data?.data)) {
        response.data.data = mergeWithSimulated('tickets', response.data.data);
      } else if (url.includes('/alerts')) {
        if (Array.isArray(response.data?.alerts)) {
          response.data.alerts = mergeWithSimulated('alerts', response.data.alerts);
        } else if (Array.isArray(response.data?.data)) {
          response.data.data = mergeWithSimulated('alerts', response.data.data);
        }
      }
    }

    if (["post", "put", "patch", "delete"].includes(method) && response.data?.message) {
      if (typeof window !== "undefined" && window.notifyToast) {
        window.notifyToast(response.data.message, "success", 4000);
      }
    }
    return response;
  },
  async (error) => {
    const originalRequest = error?.config;
    const status = error?.response?.status;
    const data = error?.response?.data;

    let displayMessage = data?.message;

    // Transform generic "Validation failed" or "Validation error" into specific field descriptions
    if ((displayMessage === "Validation failed" || displayMessage === "Validation error" || !displayMessage) && data?.errors) {
      if (Array.isArray(data.errors) && data.errors.length > 0) {
        const fieldMsgs = data.errors.map(e => e.message || e.msg || (e.field ? `${e.field} is required` : "")).filter(Boolean);
        if (fieldMsgs.length > 0) {
          displayMessage = fieldMsgs.length === 1 ? fieldMsgs[0] : `Please fill in the required field(s): ${fieldMsgs.join("; ")}`;
        }
      } else if (typeof data.errors === "object") {
        const fieldMsgs = Object.values(data.errors).map(e => e.message || (e.path ? `${e.path} is required` : "")).filter(Boolean);
        if (fieldMsgs.length > 0) {
          displayMessage = fieldMsgs.length === 1 ? fieldMsgs[0] : `Please fill in the required field(s): ${fieldMsgs.join("; ")}`;
        }
      }
    }

    const isAuthError =
      status === 401 ||
      data?.code === "TOKEN_EXPIRED" ||
      data?.code === "TOKEN_INVALID" ||
      data?.code === "INVALID_TENANT_SESSION" ||
      data?.message === "Token expired";

    if (displayMessage && !data?.upgradeRequired && !isAuthError) {
      if (typeof window !== "undefined" && window.notifyToast) {
        window.notifyToast(displayMessage, "error", 6000);
      }
    }

    if (isAuthError) {
      // In Demo Mode: clean up demo session immediately and exit to landing page.
      // NEVER attempt refresh token and NEVER redirect to /login or /login/demo!
      if (isDemoActive()) {
        clearDemoSession();
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("role");
        localStorage.removeItem("userId");
        localStorage.removeItem("userName");
        localStorage.removeItem("userEmail");
        localStorage.removeItem("tenantSubdomain");
        localStorage.removeItem("tenantName");
        localStorage.removeItem("studentName");
        authHandlers.forEach((fn) => fn());
        window.dispatchEvent(new CustomEvent("attendease:auth-changed"));
        if (typeof window !== "undefined" && window.location && window.location.pathname !== "/") {
          window.location.href = "/";
        }
        return Promise.reject(error);
      }

      if (!originalRequest._retry && !originalRequest.url?.includes('/auth/refresh')) {
        originalRequest._retry = true;

        try {
          // Refresh token is maintained as an httpOnly cookie and sent automatically with withCredentials: true
          const refreshRes = await axios.post(
            `${API_URL}/auth/refresh`,
            {},
            { withCredentials: true }
          );

          if (refreshRes.data?.success) {
            if (refreshRes.data.token) {
              localStorage.setItem("token", refreshRes.data.token);
              originalRequest.headers = originalRequest.headers || {};
              originalRequest.headers.Authorization = `Bearer ${refreshRes.data.token}`;
            }
            localStorage.removeItem("refreshToken");
            return api(originalRequest);
          }
        } catch (refreshErr) {
          // Refresh failed -> clear session
        }

        const role = localStorage.getItem("role");
        const subdomain = localStorage.getItem("tenantSubdomain");
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("role");
        localStorage.removeItem("userId");
        localStorage.removeItem("userName");
        localStorage.removeItem("userEmail");
        localStorage.removeItem("tenantSubdomain");
        localStorage.removeItem("tenantName");
        localStorage.removeItem("studentName");
        authHandlers.forEach((fn) => fn());
        window.dispatchEvent(new CustomEvent("attendease:auth-changed"));
        
        // Avoid infinite page reloads if already on a login page
        if (!window.location.pathname.startsWith('/login')) {
          const destination =
            role === "super_admin"
              ? "/login"
              : (subdomain && subdomain !== "demo")
                ? `/login/${subdomain}`
                : "/";
          window.location.href = destination;
        }
      }
    }

    if (data?.upgradeRequired === true || data?.subscriptionStatus === "expired") {
      upgradeHandlers.forEach((fn) => fn(data));
    }
    return Promise.reject(error);
  }
);

export default api;
