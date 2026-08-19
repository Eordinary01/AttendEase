import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL;

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
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

    if (isAuthError && !originalRequest._retry && !originalRequest.url?.includes('/auth/refresh')) {
      originalRequest._retry = true;
      const storedRefreshToken = localStorage.getItem("refreshToken");

      if (storedRefreshToken) {
        try {
          const refreshRes = await axios.post(`${API_URL}/auth/refresh`, {
            refreshToken: storedRefreshToken,
          });

          if (refreshRes.data?.success && refreshRes.data?.token) {
            localStorage.setItem("token", refreshRes.data.token);
            if (refreshRes.data.refreshToken) {
              localStorage.setItem("refreshToken", refreshRes.data.refreshToken);
            }
            originalRequest.headers.Authorization = `Bearer ${refreshRes.data.token}`;
            return api(originalRequest);
          }
        } catch (refreshErr) {
          // Refresh failed -> clear session
        }
      }

      const role = localStorage.getItem("role");
      const subdomain = localStorage.getItem("tenantSubdomain");
      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("role");
      localStorage.removeItem("userId");
      localStorage.removeItem("userName");
      localStorage.removeItem("userEmail");
      authHandlers.forEach((fn) => fn());
      window.dispatchEvent(new CustomEvent("attendease:auth-changed"));
      
      // Avoid infinite page reloads if already on a login page
      if (!window.location.pathname.startsWith('/login')) {
        const destination =
          role === "super_admin" || role === "admin"
            ? "/login"
            : subdomain
            ? `/login/${subdomain}`
            : "/login";
        window.location.href = destination;
      }
    }

    if (data?.upgradeRequired === true || data?.subscriptionStatus === "expired") {
      upgradeHandlers.forEach((fn) => fn(data));
    }
    return Promise.reject(error);
  }
);

export default api;
