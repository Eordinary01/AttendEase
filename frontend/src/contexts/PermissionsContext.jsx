import React, { createContext, useContext, useEffect, useMemo, useCallback, useState } from "react";
import api from "../utils/api";

// Baseline permissions every role gets by default, matching the backend's
// role-based access. Custom role permissions (from /api/roles/my-permissions)
// are added on top of these for teachers.
const BASELINE_PERMISSIONS = {
  teacher: [
    "attendance:read",
    "attendance:write",
    "attendance:report",
    "subjects:read",
    "timetable:read",
    "exam:read",
  ],
  student: [
    "attendance:read",
    "attendance:report",
    "subjects:read",
    "timetable:read",
    "exam:read",
    "fee:read",
  ],
  parent: ["attendance:read", "subjects:read", "timetable:read", "exam:read", "fee:read"],
};

const PermissionsContext = createContext({
  role: null,
  permissions: [],
  customPermissions: [],
  can: () => false,
  hasAny: () => false,
  loading: true,
});

export const PermissionsProvider = ({ role, children }) => {
  const [customPermissions, setCustomPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchCustomPermissions = useCallback(async () => {
    const token = localStorage.getItem("token");
    // Platform and tenant admins are implicitly allowed everything. Unauthenticated users skip API calls.
    if (!token || !role || role === "super_admin" || role === "admin") {
      setCustomPermissions([]);
      setLoading(false);
      return;
    }
    try {
      const res = await api.get("/roles/my-permissions");
      const perms = res.data?.data?.permissions;
      setCustomPermissions(perms === "all" ? "all" : Array.isArray(perms) ? perms : []);
    } catch (err) {
      setCustomPermissions([]);
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    setLoading(true);
    fetchCustomPermissions();
  }, [fetchCustomPermissions]);

  // Re-fetch when auth changes (login / logout / 401).
  useEffect(() => {
    const handler = () => fetchCustomPermissions();
    window.addEventListener("attendease:auth-changed", handler);
    return () => window.removeEventListener("attendease:auth-changed", handler);
  }, [fetchCustomPermissions]);

  const effectivePermissions = useMemo(() => {
    if (role === "super_admin" || role === "admin" || customPermissions === "all" || (Array.isArray(customPermissions) && customPermissions.includes("*"))) return "all";
    const base = BASELINE_PERMISSIONS[role] || [];
    return [...new Set([...base, ...(Array.isArray(customPermissions) ? customPermissions : [])])];
  }, [role, customPermissions]);

  const can = useCallback(
    (permission) => {
      if (effectivePermissions === "all") return true;
      return Array.isArray(effectivePermissions) && effectivePermissions.includes(permission);
    },
    [effectivePermissions]
  );

  const hasAny = useCallback((...permissions) => permissions.some(can), [can]);

  const value = useMemo(
    () => ({ role, permissions: effectivePermissions, customPermissions, can, hasAny, loading }),
    [role, effectivePermissions, customPermissions, can, hasAny, loading]
  );

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
};

export const usePermissions = () => useContext(PermissionsContext);
