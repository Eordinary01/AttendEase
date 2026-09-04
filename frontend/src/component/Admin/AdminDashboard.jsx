// src/component/Admin/AdminDashboard.jsx (Revamped Admin Workspace — Bento Grid)
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Users,
  BookOpen,
  GraduationCap,
  Upload,
  UserPlus,
  BookMarked,
  Grid,
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
  DollarSign,
  CalendarDays,
} from "lucide-react";

import api from "../../utils/api";
import { logError } from "../../utils/logger";
import { useTheme } from "../../contexts/ThemeContexts";
import DashboardHeader from "../common/ui/DashboardHeader";
import StatValue from "../common/ui/StatValue";
import Button from "../common/ui/Button";
import Card from "../common/ui/Card";
import Modal from "../common/ui/Modal";
import Table from "../common/ui/Table";
import Badge from "../common/ui/Badge";
import EmptyState from "../common/ui/EmptyState";
import Skeleton from "../common/ui/Skeleton";
import { formatDateDMY } from "../../utils/dateUtils";

export default function AdminDashboard({ role, userId, userName, userEmail }) {
  const navigate = useNavigate();
  const { colors } = useTheme();
  const themeColors = {
    primary: colors?.primary || "#1d4ed8",
    secondary: colors?.secondary || "#4f46e5",
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

  const fetchTenantInfo = useCallback(async () => {
    try {
      const response = await api.get("/auth/tenant-info");
      if (response.data.success) {
        setTenantInfo(response.data.data?.tenant);
      }
    } catch (error) {
      logError("Fetch Tenant Info", error);
    }
  }, []);

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
      const response = await api.get("/admin/enrollments?limit=2000");
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
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchAllStats, fetchTenantInfo, fetchSubscriptionInfo, fetchEnrollments, fetchCalendar]);

  useEffect(() => {
    const userRole = localStorage.getItem("role");
    if (userRole !== "admin") {
      setError("Admin access required");
      setLoading(false);
      return;
    }
    if (!localStorage.getItem("token")) {
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
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div
            className="w-10 h-10 border-3 border-t-transparent rounded-full animate-spin mx-auto"
            style={{
              borderColor: `${themeColors.primary}30`,
              borderTopColor: themeColors.primary,
            }}
          />
          <p className="text-xs font-semibold text-ink-soft tracking-wider uppercase">
            Loading Institution Workspace...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-ink">{error}</h2>
        <Button variant="primary" size="sm" onClick={() => navigate("/login")}>
          Return to Login
        </Button>
      </div>
    );
  }

  const adminName = userName || localStorage.getItem("userName") || "Administrator";
  const tenantName = (typeof tenantInfo?.name === "string" ? tenantInfo.name : "Institution");
  const subdomain = (typeof tenantInfo?.subdomain === "string" ? tenantInfo.subdomain : "portal");
  const totalStudents = Number(stats.totalStudents || stats.totalEnrollments || students.length) || 0;
  const registered = Number(enrollmentStats.byStatus.registered || (totalStudents - stats.pendingRegistrations)) || 0;
  const pendingRegistrations = Number(stats.pendingRegistrations || enrollmentStats.byStatus.pending || 0);
  
  const plan =
    typeof subscription?.subscription?.planName === "string"
      ? subscription.subscription.planName
      : typeof subscription?.plan === "object" && subscription?.plan !== null
      ? subscription.plan.name || subscription.plan.code || "Professional"
      : typeof subscription?.plan === "string"
      ? subscription.plan
      : "Professional";

  const subStatus =
    typeof subscription?.subscription?.status === "string"
      ? subscription.subscription.status
      : typeof subscription?.status === "string"
      ? subscription.status
      : "active";

  return (
    <div className="min-h-screen bg-background text-ink pb-12">
      {/* Shared Dashboard Header Strip */}
      <DashboardHeader
        greeting={`Welcome, ${adminName}`}
        meta={`${tenantName} • ${subdomain}.attendease.com`}
        highlightAction={
          subStatus !== "active" ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate("/admin/subscription")}
              leftIcon={CreditCard}
            >
              Manage Subscription
            </Button>
          ) : undefined
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadAll(true)}
            loading={refreshing}
            leftIcon={RefreshCw}
          >
            Sync
          </Button>
        }
      />

      {/* Main Container */}
      <div className="max-w-[1440px] mx-auto px-6 pt-6 space-y-6">
        {/* ── Row 1: Primary Metrics Bento (5-Column) ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          {/* Total Students — 2 cols, the page's priority */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:col-span-2 rounded-2xl bg-surface border border-line/70 p-5 shadow-sm space-y-3"
          >
            <StatValue
              value={totalStudents.toLocaleString()}
              label="Total Enrolled Students"
              subtitle={`${registered.toLocaleString()} registered / active`}
              progress={totalStudents > 0 ? (registered / totalStudents) * 100 : 0}
              progressColor="primary"
              variant="hero"
              accent
            />
            {pendingRegistrations > 0 && (
              <div className="flex items-center justify-between text-xs pt-1 border-t border-line/40">
                <span className="text-amber-600 font-semibold">
                  {pendingRegistrations} pending biometric registration
                </span>
                <button
                  onClick={() => {
                    setStudentFilter("pending");
                    setShowStudentsModal(true);
                  }}
                  className="text-primary font-bold hover:underline"
                >
                  Inspect →
                </button>
              </div>
            )}
          </motion.div>

          {/* Total Teachers — 1 col */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-2xl bg-surface border border-line/50 p-5 space-y-2 flex flex-col justify-center"
          >
            <StatValue
              value={stats.totalTeachers.toLocaleString()}
              label="Active Teachers"
              subtitle="Teaching faculty"
              variant="compact"
            />
          </motion.div>

          {/* Total Subjects — 1 col */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl bg-surface border border-line/50 p-5 space-y-2 flex flex-col justify-center"
          >
            <StatValue
              value={stats.totalSubjects.toLocaleString()}
              label="Active Courses"
              subtitle={`${stats.activeSubjects} in curriculum`}
              variant="compact"
            />
          </motion.div>

          {/* Pending Registrations — 1 col */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            onClick={() => {
              setStudentFilter("pending");
              setShowStudentsModal(true);
            }}
            className={`rounded-2xl p-5 space-y-2 flex flex-col justify-center cursor-pointer transition ${
              pendingRegistrations > 0
                ? "border border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50"
                : "border border-line/50 bg-surface"
            }`}
          >
            <StatValue
              value={pendingRegistrations.toLocaleString()}
              label="Pending Actions"
              subtitle="Awaiting face enrollment"
              variant="compact"
              status={
                pendingRegistrations > 0
                  ? { text: "Action Needed", tone: "warning" }
                  : undefined
              }
            />
          </motion.div>
        </div>

        {/* ── Row 2: Roster Snapshot [2/3] + Action Panel [1/3] ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Roster Snapshot (2/3 width) */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-2 rounded-2xl bg-surface border border-line/50 p-5 space-y-4 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-ink">Roster Snapshot</h3>
                  <p className="text-xs text-ink-soft">
                    Instant preview of student mappings and face biometric statuses
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setStudentFilter("all");
                    setShowStudentsModal(true);
                  }}
                  className="text-xs font-bold"
                >
                  View Full Roster ({totalStudents}) →
                </Button>
              </div>

              {/* Search & Section Filter Bar */}
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <div className="relative w-full sm:flex-1">
                  <Search className="w-3.5 h-3.5 text-ink-faint absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by name, roll, section..."
                    value={snapshotSearch}
                    onChange={(e) => setSnapshotSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-background border border-line/50 text-xs focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>

                {Object.keys(enrollmentStats.bySection).length > 0 && (
                  <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
                    <button
                      type="button"
                      onClick={() => setDashboardSectionFilter("all")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition shrink-0 ${
                        dashboardSectionFilter === "all"
                          ? "bg-primary text-white"
                          : "bg-background border border-line/50 text-ink-soft hover:text-ink"
                      }`}
                    >
                      All Sec
                    </button>
                    {Object.keys(enrollmentStats.bySection)
                      .sort()
                      .map((sec) => (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => setDashboardSectionFilter(sec)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition shrink-0 ${
                            dashboardSectionFilter === sec
                              ? "bg-primary text-white"
                              : "bg-background border border-line/50 text-ink-soft hover:text-ink"
                          }`}
                        >
                          Sec {sec} ({enrollmentStats.bySection[sec]})
                        </button>
                      ))}
                  </div>
                )}
              </div>

              {/* Roster List */}
              {snapshotFilteredStudents.length === 0 ? (
                <EmptyState
                  icon={<Users className="w-6 h-6 text-primary" />}
                  title="No students match the criteria"
                  description="Try adjusting your search or section filter."
                  className="py-8"
                />
              ) : (
                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {snapshotFilteredStudents.slice(0, 10).map((student) => {
                    const hasFace =
                      student.faceRegistered ||
                      student.isFaceRegistered ||
                      (student.faceDescriptor && student.faceDescriptor.length > 0);

                    return (
                      <div
                        key={student._id}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-line/50 hover:border-primary/40 transition gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold bg-primary/10 text-primary shrink-0">
                            {student.firstName?.[0] || student.name?.[0] || "S"}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-ink truncate">
                              {student.fullName || student.name || "Student"}
                            </p>
                            <p className="text-[11px] text-ink-soft truncate">
                              {student.rollNo || student.enrollmentNumber || "Roll N/A"} • Sec {student.section || "A"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Badge
                            tone={student.isRegistered ? "success" : "warning"}
                            size="sm"
                          >
                            {student.isRegistered ? "Registered" : "Pending"}
                          </Badge>
                          {hasFace ? (
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                              Face ✓
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                              Face ✕
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {snapshotFilteredStudents.length > 10 && (
              <p className="text-[11px] text-ink-faint pt-2 border-t border-line/40 text-center">
                Showing 10 of {snapshotFilteredStudents.length} records. Click "View Full Roster" to view all.
              </p>
            )}
          </motion.div>

          {/* Action Panel (1/3 width) */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="space-y-3"
          >
            {[
              {
                label: "Upload Enrollments",
                desc: "Bulk CSV student roster import",
                stat: `${pendingRegistrations} pending face setup`,
                icon: Upload,
                path: "/admin/upload-enrollments",
              },
              {
                label: "Manage Teachers",
                desc: `${stats.totalTeachers} active faculty members`,
                stat: "Staff roster & mapping",
                icon: UserCog,
                path: "/admin/manage-teachers",
              },
              {
                label: "Manage Subjects",
                desc: `${stats.totalSubjects} curriculum courses`,
                stat: "Semester schedules",
                icon: BookMarked,
                path: "/admin/manage-subjects",
              },
              {
                label: "Academic Calendar",
                desc: "Holidays, exams & university events",
                stat: "Year schedule",
                icon: CalendarDays,
                path: "/admin/calendar",
              },
            ].map((action, idx) => {
              const Icon = action.icon;
              return (
                <div
                  key={idx}
                  onClick={() => navigate(action.path)}
                  className="rounded-2xl bg-surface border border-line/50 p-4 hover:border-primary/40 transition cursor-pointer space-y-1.5"
                >
                  <div className="flex items-start justify-between">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <ChevronRight className="w-4 h-4 text-ink-faint" />
                  </div>
                  <h4 className="text-xs font-bold text-ink pt-1">{action.label}</h4>
                  <p className="text-[11px] text-ink-soft">{action.desc}</p>
                  <p className="text-[10px] font-bold text-ink-faint uppercase tracking-wider pt-0.5">
                    {action.stat}
                  </p>
                </div>
              );
            })}
          </motion.div>
        </div>

        {/* ── Row 3: 2-Card Row (Academic Calendar [1/2] + Subscription [1/2]) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 1. Academic Calendar & Events Snapshot */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-2xl bg-surface border border-line/50 p-5 space-y-3 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-primary" /> Academic Calendar & Schedule
                </h3>
                <span className="text-[11px] font-semibold text-ink-faint">
                  {holidays.length} Events
                </span>
              </div>

              {holidays.length === 0 ? (
                <EmptyState
                  icon={<CalendarDays className="w-6 h-6 text-primary" />}
                  title="No holidays or events configured"
                  description="Add institution holidays, exams, and semester schedules."
                  className="py-6"
                />
              ) : (
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {holidays.slice(0, 5).map((h, idx) => {
                    const dateObj = new Date(h.date || h.startDate);
                    const monthStr = dateObj.toLocaleDateString("en-US", { month: "short" });
                    const dayNum = dateObj.toLocaleDateString("en-US", { day: "2-digit" });
                    const dayName = dateObj.toLocaleDateString("en-US", { weekday: "short" });

                    return (
                      <div
                        key={h._id || idx}
                        className="p-2.5 rounded-xl bg-background border border-line/50 flex items-center gap-3 text-xs hover:border-primary/40 transition"
                      >
                        <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex flex-col items-center justify-center font-bold shrink-0">
                          <span className="text-[8px] uppercase leading-none">{monthStr}</span>
                          <span className="text-xs font-black leading-tight">{dayNum}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-ink truncate">{h.title}</p>
                          <div className="flex items-center gap-1.5 text-[10px] text-ink-soft mt-0.5">
                            <span>{dayName}</span>
                            <span>•</span>
                            <span className="capitalize font-semibold text-primary">{h.type || "Holiday"}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/admin/calendar")}
              className="w-full text-xs mt-2"
            >
              + Manage Academic Calendar →
            </Button>
          </motion.div>

          {/* 2. Subscription Card */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="rounded-2xl bg-surface border border-line/50 p-5 space-y-3 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-primary" /> Subscription & Tier
              </h3>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center p-3 rounded-xl bg-background border border-line/50">
                  <div>
                    <p className="font-bold text-ink capitalize">{plan}</p>
                    <p className="text-[11px] text-ink-soft">Tier allocation</p>
                  </div>
                  <Badge tone={subStatus === "active" ? "success" : "warning"} size="sm">
                    {subStatus}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2.5 rounded-xl bg-background border border-line/50">
                    <span className="text-ink-soft block">Active Students</span>
                    <span className="font-bold text-ink text-xs">{totalStudents}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-background border border-line/50">
                    <span className="text-ink-soft block">Faculty Seats</span>
                    <span className="font-bold text-ink text-xs">{stats.totalTeachers}</span>
                  </div>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/admin/subscription")}
              className="w-full text-xs mt-2"
            >
              Manage Subscription & Invoices →
            </Button>
          </motion.div>
        </div>
      </div>

      {/* ── Full Student Modal ── */}
      <Modal
        isOpen={showStudentsModal}
        onClose={() => setShowStudentsModal(false)}
        size="2xl"
        title={
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-primary" />
            <span>Institution Student Directory</span>
            <Badge tone="primary" size="sm">
              {filteredStudents.length} Students
            </Badge>
          </div>
        }
      >
        {/* Modal Filters & Search */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between mb-4">
          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="Search by name, roll, section..."
              className="w-full pl-9 pr-3 py-2 border border-line bg-surface text-ink placeholder:text-ink-faint rounded-xl text-xs focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all font-medium"
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint">
              <Search className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Section Filter Dropdown */}
            {Object.keys(enrollmentStats.bySection).length > 0 && (
              <div className="flex items-center gap-1.5">
                <select
                  value={selectedSectionFilter}
                  onChange={(e) => setSelectedSectionFilter(e.target.value)}
                  className="px-3 py-1.5 bg-surface border border-line rounded-xl text-xs font-bold text-ink focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="all">All Sections</option>
                  {Object.keys(enrollmentStats.bySection)
                    .sort()
                    .map((sec) => (
                      <option key={sec} value={sec}>
                        Section {sec} ({enrollmentStats.bySection[sec]})
                      </option>
                    ))}
                </select>
                {selectedSectionFilter !== "all" && (
                  <button
                    type="button"
                    onClick={() => setSelectedSectionFilter("all")}
                    className="px-2 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-xs font-bold transition"
                  >
                    ✕ Clear
                  </button>
                )}
              </div>
            )}

            {/* Filter Tabs */}
            <div className="flex gap-1 bg-surface-alt p-1 rounded-xl border border-line shadow-sm">
              {[
                { id: "all", label: `All (${students.length})` },
                {
                  id: "registered",
                  label: `Registered (${students.filter((s) => s.isRegistered).length})`,
                },
                {
                  id: "pending",
                  label: `Pending (${students.filter((s) => !s.isRegistered).length})`,
                },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStudentFilter(tab.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    studentFilter === tab.id
                      ? "bg-primary text-white shadow-sm"
                      : "text-ink-soft hover:bg-surface hover:text-ink"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Student Table */}
        <div className="max-h-[52vh] overflow-y-auto pr-1">
          {loadingStudents ? (
            <div className="py-12 text-center text-ink-soft space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-primary" />
              <p className="text-xs font-semibold">Loading student enrollment records...</p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <EmptyState
              title="No students found"
              description="No enrolled students match your search or filter criteria."
              icon={Users}
            />
          ) : (
            <Table
              columns={[
                {
                  header: "Student Name",
                  cell: (row) => (
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0"
                        style={{
                          backgroundColor: `${themeColors.primary}20`,
                          color: themeColors.primary,
                        }}
                      >
                        {row.firstName?.[0] || row.name?.[0] || "S"}
                      </div>
                      <div>
                        <p className="font-bold text-ink text-xs">
                          {row.fullName || `${row.firstName || ""} ${row.lastName || ""}`.trim() || row.name}
                        </p>
                        <p className="text-[11px] text-ink-soft">{row.email || "No Email"}</p>
                      </div>
                    </div>
                  ),
                },
                {
                  header: "Enrollment / Roll No",
                  cell: (row) => (
                    <span className="font-mono text-xs font-semibold text-ink bg-surface-alt px-2 py-0.5 rounded-lg border border-line">
                      {row.enrollmentNumber || row.rollNo || "N/A"}
                    </span>
                  ),
                },
                {
                  header: "Section",
                  cell: (row) => (
                    <span className="font-bold text-xs text-ink px-2.5 py-1 bg-surface-alt border border-line rounded-lg">
                      Section {row.section || "A"}
                    </span>
                  ),
                },
                {
                  header: "Face Biometrics",
                  cell: (row) => {
                    const hasFace =
                      row.faceRegistered ||
                      row.isFaceRegistered ||
                      (row.faceDescriptor && row.faceDescriptor.length > 0);
                    return hasFace ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        <CheckCircle className="w-3 h-3" /> Face Enrolled
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        <Clock className="w-3 h-3" /> Needs Face
                      </span>
                    );
                  },
                },
                {
                  header: "Registration Status",
                  cell: (row) =>
                    row.isRegistered ? (
                      <Badge tone="success" dot>
                        <CheckCircle className="w-3 h-3 mr-1" /> Registered
                      </Badge>
                    ) : (
                      <Badge tone="warning" dot>
                        <Clock className="w-3 h-3 mr-1" /> Pending
                      </Badge>
                    ),
                },
              ]}
              data={filteredStudents}
              rowKey="_id"
            />
          )}
        </div>
      </Modal>
    </div>
  );
}
