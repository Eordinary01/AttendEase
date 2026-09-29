// src/component/Admin/AdminDashboard.jsx
// Redesigned with Academic Precision System (redesign/DESIGN.md & redesign/code.html)
// Institutional Administration, Academic Roster Telemetry, and Statutory Compliance
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  BookOpen,
  GraduationCap,
  Upload,
  UserPlus,
  BookMarked,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Activity,
  ChevronRight,
  Layers,
  UserCog,
  RefreshCw,
  Building2,
  CreditCard,
  AlertTriangle,
  Search,
  CalendarDays,
  ShieldCheck,
  Fingerprint,
  School,
  ArrowRight,
  MoreVertical,
  Verified,
  Sparkles,
  ChevronLeft,
  X,
  FileText,
  Lock,
} from "lucide-react";

import api from "../../utils/api";
import { logError } from "../../utils/logger";
import { useTheme } from "../../contexts/ThemeContexts";
import { getDateBadgeParts, formatDateDMY } from "../../utils/dateUtils";
import Modal from "../common/ui/Modal";
import Table from "../common/ui/Table";
import Badge from "../common/ui/Badge";
import EmptyState from "../common/ui/EmptyState";
import UniversalSpinner from "../common/ui/UniversalSpinner";

export default function AdminDashboard({ role, userId, userName, userEmail }) {
  const navigate = useNavigate();
  const { colors, applyThemeColors, refreshTheme, toRgbTriplet, adjustColor } = useTheme();

  const safeToRgb = (hex) => {
    if (toRgbTriplet) {
      const res = toRgbTriplet(hex);
      if (res) return res;
    }
    if (!hex) return "99 102 241";
    const clean = hex.replace('#', '').trim();
    if (clean.length !== 6) return "99 102 241";
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `${r} ${g} ${b}`;
  };

  const safeAdjust = (hex, pct) => {
    if (adjustColor) return adjustColor(hex, pct);
    return hex;
  };

  const [stats, setStats] = useState({
    totalTeachers: 0,
    totalSubjects: 0,
    totalEnrollments: 0,
    totalStudents: 0,
    activeSubjects: 0,
    pendingRegistrations: 0,
    totalSections: 0,
    recentActivities: [],
  });

  const [students, setStudents] = useState([]);
  const [showStudentsModal, setShowStudentsModal] = useState(false);
  const [studentFilter, setStudentFilter] = useState("all"); // all | registered | pending
  const [studentSearch, setStudentSearch] = useState("");
  const [snapshotSearch, setSnapshotSearch] = useState("");
  const [selectedSectionFilter, setSelectedSectionFilter] = useState("all");
  const [dashboardSectionFilter, setDashboardSectionFilter] = useState("all");

  const [snapshotPage, setSnapshotPage] = useState(1);
  const snapshotPerPage = 5;

  const [tenantInfo, setTenantInfo] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [enrollmentStats, setEnrollmentStats] = useState({
    bySection: {},
    byStatus: { registered: 0, pending: 0 },
    recentEnrollments: [],
  });

  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const [atRiskSummary, setAtRiskSummary] = useState({ warningCount: 0, criticalCount: 0, impossibleCount: 0 });

  const fetchTenantInfo = useCallback(async () => {
    try {
      const response = await api.get("/tenant/info");
      if (response.data?.success && response.data?.data?.tenant) {
        const tenant = response.data.data.tenant;
        setTenantInfo(tenant);
        if (tenant.branding && (tenant.branding.primaryColor || tenant.branding.primary)) {
          applyThemeColors({
            primary: tenant.branding.primaryColor || tenant.branding.primary,
            secondary: tenant.branding.secondaryColor || tenant.branding.secondary,
            accent: tenant.branding.accentColor || tenant.branding.accent,
            background: tenant.branding.backgroundColor,
            text: tenant.branding.textColor,
          });
        }
      }
    } catch (error) {
      logError("Fetch Tenant Info", error);
    }
  }, [applyThemeColors]);

  const fetchSubscriptionInfo = useCallback(async () => {
    try {
      const response = await api.get("/billing/subscription");
      if (response.data.success) {
        setSubscription(response.data.data);
      }
    } catch (error) {
      logError("Fetch Subscription Info", error);
    }
  }, []);

  const fetchCalendar = useCallback(async () => {
    try {
      const response = await api.get("/calendar");
      if (response.data.success) {
        setHolidays(response.data.data || []);
      }
    } catch (error) {
      logError("Fetch Calendar", error);
    }
  }, []);

  const fetchAllStats = useCallback(async () => {
    try {
      const response = await api.get("/admin/dashboard-stats");
      if (response.data.success) {
        const d = response.data.data;
        setStats({
          totalTeachers: d.totalTeachers || 0,
          totalSubjects: d.totalSubjects || 0,
          totalEnrollments: d.totalEnrollments || 0,
          totalStudents: d.totalStudents || d.totalEnrollments || 0,
          activeSubjects: d.activeSubjects || d.totalSubjects || 0,
          pendingRegistrations: d.pendingRegistrations || 0,
          totalSections: d.totalSections || 0,
          recentActivities: [],
        });
        setEnrollmentStats({
          bySection: d.bySection || {},
          byStatus: d.byStatus || { registered: 0, pending: 0 },
          recentEnrollments: Array.isArray(d.recentEnrollments) ? d.recentEnrollments : [],
        });
        if (Array.isArray(d.calendar) && d.calendar.length > 0) {
          setHolidays(d.calendar);
        }
      }
    } catch (error) {
      logError("Fetch Admin Dashboard Stats", error);
    }
  }, []);

  const fetchEnrollments = useCallback(async () => {
    try {
      setLoadingStudents(true);
      const response = await api.get("/admin/enrollments?limit=100");
      if (response.data.success) {
        const data = response.data.data;
        const list = Array.isArray(data?.enrollments)
          ? data.enrollments
          : Array.isArray(data?.allStudents)
            ? data.allStudents
            : Array.isArray(data)
              ? data
              : [];
        setStudents(list);
      }
    } catch (error) {
      logError("Fetch Enrollments", error);
    } finally {
      setLoadingStudents(false);
    }
  }, []);

  const fetchRiskSummary = useCallback(async () => {
    try {
      const res = await api.get("/reports/attendance");
      if (res.data?.success && res.data?.data?.summary) {
        setAtRiskSummary({
          warningCount: res.data.data.summary.warningCount || 0,
          criticalCount: res.data.data.summary.criticalCount || 0,
          impossibleCount: res.data.data.summary.impossibleCount || 0,
        });
      }
    } catch (e) {
      // Non-critical background fetch
    }
  }, []);

  const loadAll = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      await Promise.allSettled([
        fetchAllStats(),
        fetchTenantInfo(),
        fetchSubscriptionInfo(),
        fetchEnrollments(),
        fetchCalendar(),
        fetchRiskSummary(),
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchAllStats, fetchTenantInfo, fetchSubscriptionInfo, fetchEnrollments, fetchCalendar, fetchRiskSummary]);

  useEffect(() => {
    const userRole = localStorage.getItem("role");
    if (userRole !== "admin") {
      setError("Admin access required");
      setLoading(false);
      return;
    }
    if (!localStorage.getItem("token") && !localStorage.getItem("userId")) {
      setError("Please login again");
      setLoading(false);
      return;
    }
    loadAll();
  }, [loadAll]);

  // Filtered students for Roster Snapshot
  const snapshotFilteredStudents = useMemo(() => {
    let list = students.length > 0 ? students : enrollmentStats.recentEnrollments;
    if (dashboardSectionFilter !== "all") {
      list = list.filter((s) => s.section === dashboardSectionFilter);
    }
    if (snapshotSearch.trim()) {
      const q = snapshotSearch.toLowerCase().trim();
      list = list.filter(
        (s) =>
          (s.fullName || s.name || "").toLowerCase().includes(q) ||
          (s.rollNo || s.enrollmentNumber || "").toLowerCase().includes(q) ||
          (s.section || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [students, enrollmentStats.recentEnrollments, dashboardSectionFilter, snapshotSearch]);

  const totalSnapshotPages = Math.max(1, Math.ceil(snapshotFilteredStudents.length / snapshotPerPage));
  const paginatedSnapshotStudents = useMemo(() => {
    const start = (snapshotPage - 1) * snapshotPerPage;
    return snapshotFilteredStudents.slice(start, start + snapshotPerPage);
  }, [snapshotFilteredStudents, snapshotPage, snapshotPerPage]);

  // Filtered students for Modal
  const filteredStudents = useMemo(() => {
    let list = students;
    if (selectedSectionFilter !== "all") {
      list = list.filter((s) => s.section === selectedSectionFilter);
    }
    if (studentFilter === "registered") {
      list = list.filter((s) => s.isRegistered);
    } else if (studentFilter === "pending") {
      list = list.filter((s) => !s.isRegistered);
    }
    if (studentSearch.trim()) {
      const q = studentSearch.toLowerCase().trim();
      list = list.filter(
        (s) =>
          (s.fullName || s.name || "").toLowerCase().includes(q) ||
          (s.rollNo || s.enrollmentNumber || "").toLowerCase().includes(q) ||
          (s.section || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [students, selectedSectionFilter, studentFilter, studentSearch]);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center font-sans">
        <UniversalSpinner size="lg" label="Loading Academic Management Console..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4 font-sans">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto shadow-xs">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">{error}</h2>
        <p className="text-xs text-slate-500">Authentication session invalid or privileges restricted.</p>
        <button
          onClick={() => navigate("/login")}
          className="px-5 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-semibold shadow-xs transition"
        >
          Return to Institutional Login
        </button>
      </div>
    );
  }

  const adminName = userName || localStorage.getItem("userName") || "Administrator";
  const tenantName = tenantInfo?.branding?.institutionName || tenantInfo?.name || "Academic Institution";
  const subdomain = tenantInfo?.subdomain || "portal";
  const ugcCode = tenantInfo?.collegeMetadata?.ugcCode || tenantInfo?.code || `${subdomain.toUpperCase()}-CAMPUS`;
  const totalStudents = Number(stats.totalStudents || stats.totalEnrollments || students.length) || 0;
  const registered = Number(enrollmentStats.byStatus.registered || (totalStudents - stats.pendingRegistrations)) || 0;
  const pendingRegistrations = Number(stats.pendingRegistrations || enrollmentStats.byStatus.pending || 0);
  const registeredPct = totalStudents > 0 ? ((registered / totalStudents) * 100).toFixed(1) : "0.0";

  const facultyStudentRatio = stats.totalTeachers > 0 ? (totalStudents / stats.totalTeachers).toFixed(0) : "—";

  const plan =
    typeof subscription?.subscription?.planName === "string"
      ? subscription.subscription.planName
      : typeof subscription?.plan === "object" && subscription?.plan !== null
        ? subscription.plan.name || subscription.plan.code || "Standard Tier"
        : typeof subscription?.plan === "string"
          ? subscription.plan
          : "Standard Tier";

  const subStatus =
    typeof subscription?.subscription?.status === "string"
      ? subscription.subscription.status
      : typeof subscription?.status === "string"
        ? subscription.status
        : "active";

  const studentSeatQuota = tenantInfo?.limits?.maxStudents || subscription?.plan?.limits?.maxStudents || null;
  const facultySeatQuota = tenantInfo?.limits?.maxTeachers || subscription?.plan?.limits?.maxTeachers || null;
  const studentSeatPct = studentSeatQuota ? Math.min(100, Math.round((totalStudents / studentSeatQuota) * 100)) : 100;
  const facultySeatPct = facultySeatQuota ? Math.min(100, Math.round((stats.totalTeachers / facultySeatQuota) * 100)) : 100;

  const primaryHex = colors?.primary || colors?.primaryColor || tenantInfo?.branding?.primaryColor || "#4f46e5";
  const secondaryHex = colors?.secondary || colors?.secondaryColor || tenantInfo?.branding?.secondaryColor || "#8b5cf6";

  const atRiskTotal = (atRiskSummary.criticalCount || 0) + (atRiskSummary.warningCount || 0);

  return (
    <div
      style={{
        "--color-primary": safeToRgb(primaryHex),
        "--color-primary-light": safeToRgb(safeAdjust(primaryHex, 20)),
        "--color-primary-dark": safeToRgb(safeAdjust(primaryHex, -15)),
        "--color-primary-soft": safeToRgb(safeAdjust(primaryHex, 90)),
        "--color-primary-surface": safeToRgb(safeAdjust(primaryHex, 80)),
        "--color-secondary": safeToRgb(secondaryHex),
        "--color-secondary-light": safeToRgb(safeAdjust(secondaryHex, 20)),
        "--color-secondary-dark": safeToRgb(safeAdjust(secondaryHex, -15)),
        "--color-secondary-soft": safeToRgb(safeAdjust(secondaryHex, 90)),
        "--color-secondary-surface": safeToRgb(safeAdjust(secondaryHex, 80)),
        "--theme-primary": primaryHex,
        "--theme-secondary": secondaryHex,
      }}
      className="space-y-6 font-sans antialiased text-slate-800"
    >
      {/* ── Section 1: Institutional Context & Welcome Strip ── */}
      <section className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-sans">
              Welcome, {adminName}
            </h1>
            <span className="bg-slate-100 text-slate-600 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-slate-200/80">
              Institutional Administrator
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
            {tenantInfo?.branding?.logo ? (
              <img src={tenantInfo.branding.logo} alt="Logo" className="w-4 h-4 rounded object-contain shrink-0" />
            ) : (
              <School className="w-4 h-4 text-primary shrink-0" />
            )}
            <span className="font-bold text-slate-900">{tenantName}</span>
            <span className="text-slate-300">•</span>
            <span className="font-mono text-primary font-semibold">{subdomain}.attendease.com</span>
            <span className="text-slate-300">•</span>
            <span className="font-mono text-slate-500">Institutional Code: {ugcCode}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="uppercase tracking-wider font-bold">{plan}</span>
            <span className="text-emerald-500">|</span>
            <span className="capitalize">{subStatus}</span>
          </div>

          <button
            onClick={() => loadAll(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-xs transition-all active:scale-[0.98]"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-primary ${refreshing ? "animate-spin" : ""}`} />
            <span>Sync Telemetry</span>
          </button>
        </div>
      </section>

      {/* ── Section 2: Row 1: Primary Academic Metrics Bento (5 Cards) ── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Students */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between space-y-3 hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono">
              Total Students
            </span>
            <div className="w-8 h-8 rounded-lg bg-primary-soft border border-primary/20 flex items-center justify-center text-primary">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-slate-900 tracking-tight leading-none tabular-nums font-sans">
              {totalStudents.toLocaleString()}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {registered.toLocaleString()} registered ({registeredPct}%)
            </div>
          </div>
          <div className="space-y-1.5 pt-1">
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-primary h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, Number(registeredPct)))}%` }}
              />
            </div>
            {pendingRegistrations > 0 ? (
              <button
                onClick={() => {
                  setStudentFilter("pending");
                  setShowStudentsModal(true);
                }}
                className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary-dark font-semibold transition-colors"
              >
                <span>{pendingRegistrations} pending biometrics</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            ) : (
              <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> 100% Rosters Synced
              </span>
            )}
          </div>
        </div>

        {/* Active Teachers */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between space-y-3 hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono">
              Active Teachers
            </span>
            <div className="w-8 h-8 rounded-lg bg-secondary-soft border border-secondary/20 flex items-center justify-center text-secondary-dark">
              <UserCog className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-slate-900 tracking-tight leading-none tabular-nums font-sans">
              {stats.totalTeachers.toLocaleString()}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {stats.totalTeachers > 0 ? "Faculty rosters active" : "No faculty assigned"}
            </div>
          </div>
          <div className="pt-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200">
              <Activity className="w-3.5 h-3.5 text-secondary-dark" />
              <span>1:{facultyStudentRatio} Faculty-Student Ratio</span>
            </div>
          </div>
        </div>

        {/* Active Courses */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between space-y-3 hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono">
              Active Courses
            </span>
            <div className="w-8 h-8 rounded-lg bg-primary-soft border border-primary/20 flex items-center justify-center text-primary-dark">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-slate-900 tracking-tight leading-none tabular-nums font-sans">
              {stats.totalSubjects.toLocaleString()}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Approved academic curriculum
            </div>
          </div>
          <div className="pt-1 flex items-center gap-1.5 text-slate-700 font-mono text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>{stats.totalSections || stats.activeSubjects || Object.keys(enrollmentStats.bySection).length || 0} lecture & lab sections</span>
          </div>
        </div>

        {/* Pending Biometrics */}
        <div
          onClick={() => {
            setStudentFilter("pending");
            setShowStudentsModal(true);
          }}
          className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between space-y-3 cursor-pointer hover:border-amber-400 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono">
              Pending Biometrics
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 group-hover:bg-amber-100 transition-colors">
              <Fingerprint className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-amber-600 tracking-tight leading-none tabular-nums font-sans">
              {pendingRegistrations.toLocaleString()}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Awaiting 3D Face Enrollment
            </div>
          </div>
          <div className="pt-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span>{pendingRegistrations > 0 ? "Action Required" : "All Enrolled"}</span>
            </span>
          </div>
        </div>

        {/* At-Risk (<75% statutory) */}
        <div
          onClick={() => navigate("/reports")}
          className={`bg-white rounded-2xl p-5 border shadow-sm flex flex-col justify-between space-y-3 cursor-pointer transition-all group ${
            atRiskTotal > 0
              ? "border-slate-200/90 hover:border-rose-400 hover:shadow-md"
              : "border-slate-200/90 hover:border-emerald-400 hover:shadow-md"
          }`}
        >
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono">
              At-Risk (&lt;75%)
            </span>
            <div
              className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${
                atRiskTotal > 0
                  ? "bg-rose-50 border-rose-100 text-rose-600 group-hover:bg-rose-100"
                  : "bg-emerald-50 border-emerald-100 text-emerald-600 group-hover:bg-emerald-100"
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div
              className={`text-3xl font-black tracking-tight leading-none tabular-nums font-sans ${
                atRiskTotal > 0 ? "text-rose-600" : "text-emerald-600"
              }`}
            >
              {atRiskTotal}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {atRiskTotal > 0 ? "UGC statutory threshold alerts" : "All cohorts statutory compliant"}
            </div>
          </div>
          <div className="pt-1 flex items-center justify-between text-slate-500 text-[11px] font-medium font-mono">
            <span className="text-rose-600 font-bold">{atRiskSummary.criticalCount || 0} Critical</span>
            <span>•</span>
            <span className="text-amber-600 font-bold">{atRiskSummary.warningCount || 0} Warning</span>
            <span>•</span>
            <span>{atRiskSummary.impossibleCount || 0} Ineligible</span>
          </div>
        </div>
      </section>

      {/* ── Section 3: Row 2: Roster Snapshot (2/3) + Admin Operations (1/3) ── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Roster Snapshot (2/3 width) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 shadow-sm flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 font-sans">Roster Snapshot</h3>
                <span className="text-xs font-mono font-semibold bg-primary-soft text-primary-dark px-2 py-0.5 rounded-md border border-primary/20">
                  Active Cohorts
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Instant preview of student mappings and face biometric statuses
              </p>
            </div>
            <button
              onClick={() => {
                setStudentFilter("all");
                setShowStudentsModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-xl text-xs font-semibold transition"
            >
              <span>View Full Roster ({totalStudents.toLocaleString()})</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Controls & Filter Bar */}
          <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center gap-3">
            <div className="relative w-full sm:flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by student name, roll number, section..."
                value={snapshotSearch}
                onChange={(e) => {
                  setSnapshotSearch(e.target.value);
                  setSnapshotPage(1);
                }}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition"
              />
            </div>

            {/* Section tabs */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              <button
                onClick={() => {
                  setDashboardSectionFilter("all");
                  setSnapshotPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap ${dashboardSectionFilter === "all"
                    ? "bg-primary text-white shadow-xs"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
              >
                All Sec
              </button>
              {["A", "B", "C", "D"].map((sec) => {
                const count = enrollmentStats.bySection[sec] ?? students.filter((s) => s.section === sec).length;
                return (
                  <button
                    key={sec}
                    onClick={() => {
                      setDashboardSectionFilter(sec);
                      setSnapshotPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap ${dashboardSectionFilter === sec
                        ? "bg-primary text-white shadow-xs"
                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                  >
                    Sec {sec} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-5 font-semibold">Student Identity</th>
                  <th className="py-2.5 px-4 font-semibold">Roll & Section</th>
                  <th className="py-2.5 px-4 font-semibold">Enrollment</th>
                  <th className="py-2.5 px-4 font-semibold">Biometric Status</th>
                  <th className="py-2.5 px-5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedSnapshotStudents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No students match the current criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedSnapshotStudents.map((student, idx) => {
                    const hasFace =
                      Boolean(student.faceRegistered) ||
                      Boolean(student.isFaceRegistered) ||
                      (Array.isArray(student.faceDescriptor) && student.faceDescriptor.length > 0) ||
                      Boolean(student.userId?.faceRegistered) ||
                      Boolean(student.userId?.isFaceRegistered);

                    const displayName =
                      student.fullName ||
                      `${student.firstName || ""} ${student.lastName || ""}`.trim() ||
                      student.name ||
                      "Student";
                    const displayEmail = student.email || student.userId?.email || "No email on record";
                    const displayRoll = student.rollNo || student.enrollmentNumber || "—";
                    const displaySection = student.section || "A";
                    const displaySemester = student.semester ? `(Sem ${student.semester})` : "";
                    const initials = (displayName[0] || "S").toUpperCase();

                    return (
                      <tr key={student._id || idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary-soft border border-primary/20 text-primary-dark text-xs flex items-center justify-center font-bold shrink-0">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 truncate">
                                {displayName}
                              </p>
                              <p className="text-[11px] text-slate-500 truncate">
                                {displayEmail}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-mono text-xs font-bold text-slate-800">
                            {displayRoll}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Section {displaySection} {displaySemester}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                              student.isRegistered !== false
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                student.isRegistered !== false ? "bg-emerald-500" : "bg-amber-500"
                              }`}
                            />
                            <span>{student.isRegistered !== false ? "Registered" : "Pending"}</span>
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          {hasFace ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary-soft text-primary-dark border border-primary/20 text-[11px] font-semibold">
                              <Verified className="w-3 h-3 text-emerald-600" />
                              <span>Face Enrolled</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-semibold">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>Needs Face</span>
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-5 text-right">
                          <button
                            onClick={() => {
                              setStudentFilter("all");
                              setStudentSearch(student.rollNo || student.fullName || "");
                              setShowStudentsModal(true);
                            }}
                            className="w-7 h-7 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-primary inline-flex items-center justify-center transition-colors"
                            title="Inspect Student Record"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Pagination Footer */}
          <div className="p-3.5 bg-slate-50/70 px-5 flex items-center justify-between border-t border-slate-100 text-xs text-slate-500 font-mono">
            <span>
              Showing <span className="font-bold text-slate-900">{paginatedSnapshotStudents.length}</span> of{" "}
              <span className="font-bold text-slate-900">{snapshotFilteredStudents.length}</span> active student records
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSnapshotPage((p) => Math.max(1, p - 1))}
                disabled={snapshotPage <= 1}
                className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-bold text-slate-800">
                {snapshotPage} / {totalSnapshotPages}
              </span>
              <button
                onClick={() => setSnapshotPage((p) => Math.min(totalSnapshotPages, p + 1))}
                disabled={snapshotPage >= totalSnapshotPages}
                className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Administrative Operations (1/3 width) */}
        <div className="space-y-3 flex flex-col justify-between">
          <div className="pb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
              Administrative Operations
            </span>
            <h3 className="text-base font-bold text-slate-900 font-sans mt-0.5">Core Actions</h3>
          </div>

          {/* Action 1: Upload Enrollments */}
          <div
            onClick={() => navigate("/admin/upload-enrollments")}
            className="group bg-white hover:bg-slate-50/80 rounded-2xl p-4 border border-slate-200/90 shadow-sm flex items-start gap-3.5 transition-all cursor-pointer hover:border-primary/40 hover:shadow-md"
          >
            <div className="w-10 h-10 rounded-xl bg-primary-soft border border-primary/20 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white shrink-0 transition-colors">
              <Upload className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 group-hover:text-primary transition-colors">
                  Upload Enrollments
                </h4>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Bulk CSV student roster import</p>
              <div className="mt-2 inline-flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span>{pendingRegistrations} pending face setup</span>
              </div>
            </div>
          </div>

          {/* Action 2: Manage Teachers */}
          <div
            onClick={() => navigate("/admin/manage-teachers")}
            className="group bg-white hover:bg-slate-50/80 rounded-2xl p-4 border border-slate-200/90 shadow-sm flex items-start gap-3.5 transition-all cursor-pointer hover:border-primary/40 hover:shadow-md"
          >
            <div className="w-10 h-10 rounded-xl bg-secondary-soft border border-secondary/20 flex items-center justify-center text-secondary-dark group-hover:bg-secondary group-hover:text-white shrink-0 transition-colors">
              <UserCog className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 group-hover:text-secondary-dark transition-colors">
                  Manage Teachers
                </h4>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{stats.totalTeachers} active faculty members</p>
              <div className="mt-2 text-[11px] text-slate-500">
                Staff roster, academic workload mapping
              </div>
            </div>
          </div>

          {/* Action 3: Manage Subjects */}
          <div
            onClick={() => navigate("/admin/manage-subjects")}
            className="group bg-white hover:bg-slate-50/80 rounded-2xl p-4 border border-slate-200/90 shadow-sm flex items-start gap-3.5 transition-all cursor-pointer hover:border-primary/40 hover:shadow-md"
          >
            <div className="w-10 h-10 rounded-xl bg-primary-soft border border-primary/20 flex items-center justify-center text-primary-dark group-hover:bg-primary group-hover:text-white shrink-0 transition-colors">
              <BookMarked className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 group-hover:text-primary transition-colors">
                  Manage Subjects
                </h4>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{stats.totalSubjects} curriculum courses</p>
              <div className="mt-2 text-[11px] text-slate-500">
                Semester lecture & lab schedules
              </div>
            </div>
          </div>

          {/* Action 4: Real-time Attendance Monitor */}
          <div
            onClick={() => navigate("/live-attendance")}
            className="group bg-white hover:bg-slate-50/80 rounded-2xl p-4 border border-slate-200/90 shadow-sm flex items-start gap-3.5 transition-all cursor-pointer hover:border-primary/40 hover:shadow-md"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white shrink-0 transition-colors">
              <Activity className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                  Live Attendance Feed
                </h4>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Telemetry & biometric stream</p>
              <div className="mt-2 text-[11px] text-slate-500">
                Active Sem Schedule
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 4: Row 3: Dual Grid (Academic Calendar [1/2] + Subscription Tier [1/2]) ── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Academic Calendar & Milestones (1/2 width) */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 font-sans">
                  Academic Calendar & Deadlines
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Approved university statutory milestones</p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-mono text-xs font-bold border border-slate-200">
                {holidays.length} Scheduled Events
              </span>
            </div>

            {/* Milestones list */}
            <div className="space-y-3 pt-3">
              {holidays.length > 0 ? (
                holidays.slice(0, 4).map((event, idx) => {
                  const { month: m, day: d } = getDateBadgeParts(event.date || event.startDate);

                  return (
                    <div
                      key={idx}
                      className="flex items-start gap-4 p-3 rounded-xl border border-slate-100 hover:bg-slate-50/80 transition-colors"
                    >
                      <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold uppercase text-primary font-mono leading-none">
                          {m || "CAL"}
                        </span>
                        <span className="text-base font-black text-slate-900 leading-tight mt-0.5">
                          {d || "--"}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-bold text-xs text-slate-900 truncate">
                            {event.title || event.name || "Academic Milestone"}
                          </h4>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${
                              event.type === "Examination" || event.type === "exam"
                                ? "bg-purple-50 text-purple-700 border-purple-200"
                                : event.type === "Statutory Holiday" || event.type === "holiday"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-slate-100 text-slate-700 border-slate-200"
                            }`}
                          >
                            {event.type || "Event"}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 truncate">
                          {event.desc || event.description || "Campus academic timeline event."}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center border border-dashed border-slate-200 rounded-xl">
                  <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-600">No scheduled academic events</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Publish statutory milestones from the calendar</p>
                </div>
              )}
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={() => navigate("/admin/calendar")}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-primary-dark font-semibold text-xs rounded-xl transition inline-flex items-center gap-1.5"
            >
              <span>Manage Academic Calendar</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Subscription & Institutional Tier (1/2 width) */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 font-sans">
                  Institutional Tier & Capacity
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">AttendEase Cloud Dedicated SLA Instance</p>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                <Verified className="w-3.5 h-3.5" />
                <span>Enterprise SLA Active</span>
              </span>
            </div>

            <div className="mt-4 p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">{tenantName} {plan}</span>
                <span className="font-mono text-xs text-primary font-bold">
                  {subscription?.subscription?.billingCycle === "monthly"
                    ? "Monthly License"
                    : subscription?.subscription?.billingCycle === "annual"
                    ? "Annual License"
                    : "Institutional Tier"}
                </span>
              </div>

              {/* Student Seats Allocation */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Student Seat Allocation</span>
                  <span className="font-mono font-bold text-slate-900">
                    {studentSeatQuota
                      ? `${totalStudents.toLocaleString()} / ${studentSeatQuota.toLocaleString()} (${studentSeatPct}%)`
                      : `${totalStudents.toLocaleString()} Active (Flexible Quota)`}
                  </span>
                </div>
                <div className="w-full bg-slate-200/80 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-primary h-full rounded-full transition-all duration-500"
                    style={{ width: `${studentSeatPct}%` }}
                  />
                </div>
              </div>

              {/* Faculty Seats Allocation */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Faculty Seat Allocation</span>
                  <span className="font-mono font-bold text-slate-900">
                    {facultySeatQuota
                      ? `${stats.totalTeachers} / ${facultySeatQuota} (${facultySeatPct}%)`
                      : `${stats.totalTeachers} Active (Flexible Quota)`}
                  </span>
                </div>
                <div className="w-full bg-slate-200/80 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-secondary h-full rounded-full transition-all duration-500"
                    style={{ width: `${facultySeatPct}%` }}
                  />
                </div>
              </div>

              {/* Attributes Mini Grid */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-xl bg-white border border-slate-200/70 shadow-xs">
                  <div className="text-[11px] text-slate-500 font-medium">Biometric Engine</div>
                  <div className="font-bold text-slate-900 text-xs mt-0.5">
                    {tenantInfo?.settings?.facialRecognition?.enabled !== false ? "Face Verification Active" : "Disabled"}
                  </div>
                  <div className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Cosine: {tenantInfo?.settings?.facialRecognition?.threshold || "0.6"}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white border border-slate-200/70 shadow-xs">
                  <div className="text-[11px] text-slate-500 font-medium">Partition Isolation</div>
                  <div className="font-bold text-slate-900 text-xs mt-0.5 truncate">{subdomain}.attendease.com</div>
                  <div className="text-[10px] text-primary font-bold flex items-center gap-1 mt-1 font-mono">
                    <Lock className="w-3 h-3" />
                    <span>RLS Multi-Tenant</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-slate-500 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-slate-700 font-semibold">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>Status: <strong>{subStatus === "active" ? "Active License" : subStatus.toUpperCase()}</strong></span>
              </span>
              <span>
                {subscription?.subscription?.currentPeriodEnd
                  ? `Renews: ${new Date(subscription.subscription.currentPeriodEnd).toLocaleDateString()}`
                  : subscription?.currentPeriodEnd
                  ? `Renews: ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                  : "Continuous License"}
              </span>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={() => navigate("/admin/settings")}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-primary-dark font-semibold text-xs rounded-xl transition inline-flex items-center gap-1.5"
            >
              <span>Manage Subscription & Invoices</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* ── Section 5: Full Student Directory Modal ── */}
      <Modal
        isOpen={showStudentsModal}
        onClose={() => setShowStudentsModal(false)}
        size="2xl"
        title={
          <div className="flex items-center gap-2.5">
            <GraduationCap className="w-5 h-5 text-primary" />
            <span className="font-bold text-slate-900">Institution Student Directory</span>
            <span className="text-xs font-mono font-bold bg-primary-soft text-primary-dark px-2 py-0.5 rounded-md border border-primary/20">
              {filteredStudents.length} Students
            </span>
          </div>
        }
      >
        <div className="space-y-4 text-xs font-sans">
          {/* Search & Tabs */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between pb-2 border-b border-slate-100">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Search by student name, roll number, section..."
                className="w-full pl-8 pr-3 py-2 border border-slate-200 bg-slate-50 text-slate-900 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="flex items-center gap-2">
              {/* Section Select */}
              {Object.keys(enrollmentStats.bySection).length > 0 && (
                <select
                  value={selectedSectionFilter}
                  onChange={(e) => setSelectedSectionFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
                >
                  <option value="all">All Sections</option>
                  {Object.keys(enrollmentStats.bySection).sort().map((sec) => (
                    <option key={sec} value={sec}>
                      Section {sec} ({enrollmentStats.bySection[sec]})
                    </option>
                  ))}
                </select>
              )}

              {/* Status Filter Tabs */}
              <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200">
                {[
                  { id: "all", label: `All (${students.length})` },
                  { id: "registered", label: `Registered (${students.filter((s) => s.isRegistered).length})` },
                  { id: "pending", label: `Pending (${students.filter((s) => !s.isRegistered).length})` },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setStudentFilter(tab.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${studentFilter === tab.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                      }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="max-h-[52vh] overflow-y-auto">
            {loadingStudents ? (
              <div className="py-12 flex justify-center">
                <UniversalSpinner label="Loading student enrollment records..." />
              </div>
            ) : filteredStudents.length === 0 ? (
              <EmptyState
                title="No students found"
                description="No enrolled students match your search or filter criteria."
                icon={Users}
              />
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="py-2.5 px-4">Student Name</th>
                    <th className="py-2.5 px-4">Roll Number</th>
                    <th className="py-2.5 px-4">Section</th>
                    <th className="py-2.5 px-4">Biometric Status</th>
                    <th className="py-2.5 px-4 text-right">Registration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.map((row) => {
                    const hasFace =
                      row.faceRegistered ||
                      row.isFaceRegistered ||
                      (row.faceDescriptor && row.faceDescriptor.length > 0);

                    return (
                      <tr key={row._id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-primary-soft border border-primary/20 text-primary-dark text-xs flex items-center justify-center font-bold shrink-0">
                              {row.firstName?.[0] || row.name?.[0] || "S"}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 text-xs">
                                {row.fullName || `${row.firstName || ""} ${row.lastName || ""}`.trim() || row.name}
                              </p>
                              <p className="text-[11px] text-slate-500">{row.email || "No Email"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-800">
                          {row.enrollmentNumber || row.rollNo || "N/A"}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-700">
                          Section {row.section || "A"}
                        </td>
                        <td className="py-3 px-4">
                          {hasFace ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold">
                              <CheckCircle className="w-3 h-3 text-emerald-600" /> Face Enrolled
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-semibold">
                              <Clock className="w-3 h-3 text-amber-600" /> Needs Face
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${row.isRegistered
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                              }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${row.isRegistered ? "bg-emerald-500" : "bg-amber-500"}`} />
                            <span>{row.isRegistered ? "Registered" : "Pending"}</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
