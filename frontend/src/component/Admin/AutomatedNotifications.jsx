import React, { useState, useEffect, useCallback } from "react";
import {
  Bell,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Sparkles,
  Filter,
  Search,
  Sliders,
  Settings2,
  RefreshCw,
  AlertCircle,
  Eye,
  Check,
  RotateCcw,
  Users,
  Mail,
  FileText,
  Save,
  CheckCheck,
  ChevronRight,
  Info,
} from "lucide-react";
import api from "../../utils/api";
import { useToast } from "../../contexts/ToastContext";
import Card from "../common/ui/Card";
import Button from "../common/ui/Button";
import Badge from "../common/ui/Badge";
import DashboardHeader from "../common/ui/DashboardHeader";
import EmptyState from "../common/ui/EmptyState";
import Modal from "../common/ui/Modal";
import StatCard from "../common/ui/StatCard";
import UniversalSpinner from "../common/ui/UniversalSpinner";
import Pagination from "../common/ui/Pagination";

const AutomatedNotifications = () => {
  const { success: toastSuccess, error: toastError } = useToast();

  // Active view tab: 'ledger' | 'rules'
  const [activeTab, setActiveTab] = useState("ledger");

  // Ledger state
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    unresolved: 0,
    absenceEscalations: 0,
    systemProxyAlerts: 0,
  });
  const [loadingLedger, setLoadingLedger] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterSeverity, setFilterSeverity] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal inspection
  const [inspectAlert, setInspectAlert] = useState(null);
  const [resolvingId, setResolvingId] = useState(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [resolvingModalAlert, setResolvingModalAlert] = useState(null);

  // Settings / Rules state
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [testingTrigger, setTestingTrigger] = useState(false);
  const [settings, setSettings] = useState({
    enableAbsenceEscalations: true,
    consecutiveAbsenceStreak: 3,
    enableLowAttendanceWarning: true,
    lowAttendanceThreshold: 75,
    enableParentEmailNotifications: true,
    enableAdminEscalations: true,
    enableProxyAlerts: true,
    proxyThresholdCount: 40,
    enablePromotionScannerAlerts: true,
    enableFeeDueReminders: true,
    enableExamScheduleAlerts: true,
  });

  // Fetch automated alerts ledger
  const fetchLedger = useCallback(async () => {
    try {
      setLoadingLedger(true);
      const params = new URLSearchParams();
      params.set("page", page);
      params.set("limit", "12");
      if (filterCategory !== "all") params.set("category", filterCategory);
      if (filterSeverity !== "all") params.set("severity", filterSeverity);
      if (filterStatus !== "all") params.set("resolved", filterStatus === "resolved" ? "true" : "false");
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      const res = await api.get(`/alerts/automated?${params.toString()}`);
      if (res.data?.success) {
        setAlerts(res.data.data?.alerts || []);
        setStats(
          res.data.data?.stats || {
            total: 0,
            unresolved: 0,
            absenceEscalations: 0,
            systemProxyAlerts: 0,
          }
        );
        setTotalPages(res.data.data?.pagination?.totalPages || 1);
      }
    } catch (err) {
      toastError(err.response?.data?.message || "Failed to fetch automated notifications ledger");
    } finally {
      setLoadingLedger(false);
    }
  }, [page, filterCategory, filterSeverity, filterStatus, searchQuery, toastError]);

  // Fetch tenant automation configuration
  const fetchTenantSettings = useCallback(async () => {
    try {
      setLoadingSettings(true);
      const res = await api.get("/tenant/info");
      const tenantSettings = res.data?.data?.tenant?.settings?.automatedNotifications;
      if (tenantSettings) {
        setSettings((prev) => ({
          ...prev,
          ...tenantSettings,
        }));
      }
    } catch (err) {
      toastError("Failed to load tenant automation settings");
    } finally {
      setLoadingSettings(false);
    }
  }, [toastError]);

  useEffect(() => {
    if (activeTab === "ledger") {
      fetchLedger();
    } else {
      fetchTenantSettings();
    }
  }, [activeTab, fetchLedger, fetchTenantSettings]);

  // Handle Mark Resolved
  const handleResolve = async (alertId, note = "") => {
    try {
      setResolvingId(alertId);
      const res = await api.patch(`/alerts/${alertId}/resolve`, { note });
      if (res.data?.success) {
        toastSuccess("Alert marked as resolved");
        setResolvingModalAlert(null);
        setResolutionNote("");
        fetchLedger();
      }
    } catch (err) {
      toastError(err.response?.data?.message || "Failed to resolve alert");
    } finally {
      setResolvingId(null);
    }
  };

  // Handle Test Simulation
  const handleTestTrigger = async () => {
    try {
      setTestingTrigger(true);
      const res = await api.post("/alerts/automated/test-trigger", {
        type: "absence_escalation",
        severity: "urgent",
      });
      if (res.data?.success) {
        toastSuccess("Simulated automated notification broadcasted to your campus stream!");
        if (activeTab === "ledger") {
          fetchLedger();
        }
      }
    } catch (err) {
      toastError(err.response?.data?.message || "Failed to run simulation");
    } finally {
      setTestingTrigger(false);
    }
  };

  // Save Automation Rules
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      setSavingSettings(true);
      const res = await api.put("/tenant/settings", {
        settings: {
          automatedNotifications: settings,
        },
      });
      if (res.data?.success) {
        toastSuccess("Automation rules & policy thresholds saved successfully");
      }
    } catch (err) {
      toastError(err.response?.data?.message || "Failed to save automation settings");
    } finally {
      setSavingSettings(false);
    }
  };

  // Helpers
  const getSeverityTone = (priority) => {
    if (priority === "urgent") return "danger";
    if (priority === "high") return "warning";
    if (priority === "normal") return "primary";
    return "neutral";
  };

  const getCategoryIcon = (type) => {
    if (type === "absence_escalation") return AlertTriangle;
    if (type === "system") return ShieldAlert;
    return Bell;
  };

  return (
    <div className="space-y-6">
      {/* Dashboard Header */}
      <DashboardHeader
        greeting="Automated Notifications Hub"
        meta="Monitor campus escalation triggers, review security events, and customize institutional automation policies."
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestTrigger}
              disabled={testingTrigger}
              leftIcon={Sparkles}
            >
              {testingTrigger ? "Simulating..." : "Test Trigger"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchLedger}
              disabled={loadingLedger}
              leftIcon={RefreshCw}
            >
              Refresh
            </Button>
          </div>
        }
      />

      {/* Telemetry KPI Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Automated Events"
          value={stats.total}
          icon={Bell}
          tone="primary"
          subtitle="System triggered alerts"
        />
        <StatCard
          label="Action Required"
          value={stats.unresolved}
          icon={AlertTriangle}
          tone={stats.unresolved > 0 ? "danger" : "neutral"}
          highlight={stats.unresolved > 0}
          subtitle="Pending intervention"
        />
        <StatCard
          label="Absence Streaks"
          value={stats.absenceEscalations}
          icon={Users}
          tone="warning"
          subtitle="Multi-tier student warnings"
        />
        <StatCard
          label="Proxy & Integrity"
          value={stats.systemProxyAlerts}
          icon={ShieldAlert}
          tone="info"
          subtitle="IP & session anomalies"
        />
      </div>

      {/* View Switcher Tabs */}
      <div className="border-b border-line flex items-center gap-8">
        <button
          type="button"
          onClick={() => setActiveTab("ledger")}
          className={`pb-3 text-sm font-bold transition-all relative flex items-center gap-2 ${activeTab === "ledger"
            ? "text-primary border-b-2 border-primary"
            : "text-ink-soft hover:text-ink"
            }`}
        >
          <Clock className="w-4 h-4" />
          <span>Live Alert Ledger</span>
          {stats.unresolved > 0 && (
            <Badge tone="danger" size="sm" pulse>
              {stats.unresolved}
            </Badge>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("rules")}
          className={`pb-3 text-sm font-bold transition-all relative flex items-center gap-2 ${activeTab === "rules"
            ? "text-primary border-b-2 border-primary"
            : "text-ink-soft hover:text-ink"
            }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Automation Rules & Policies</span>
        </button>
      </div>

      {/* TAB 1: LIVE ALERT QUEUE & AUDIT LEDGER */}
      {activeTab === "ledger" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <Card padding="md" bordered>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Search */}
                <div className="relative min-w-[220px]">
                  <Search className="w-3.5 h-3.5 text-ink-faint absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search student, roll, section..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-line/50 bg-background text-ink placeholder:text-ink-faint outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {/* Category filter */}
                <select
                  value={filterCategory}
                  onChange={(e) => {
                    setFilterCategory(e.target.value);
                    setPage(1);
                  }}
                  className="px-3 py-1.5 text-xs rounded-xl border border-line/50 bg-background text-ink outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                >
                  <option value="all">All Notification Types</option>
                  <option value="absence_escalation">Absence Escalations</option>
                  <option value="attendance_warning">Attendance Warnings</option>
                  <option value="system">Proxy & Integrity Alerts</option>
                </select>

                {/* Severity filter */}
                <select
                  value={filterSeverity}
                  onChange={(e) => {
                    setFilterSeverity(e.target.value);
                    setPage(1);
                  }}
                  className="px-3 py-1.5 text-xs rounded-xl border border-line/50 bg-background text-ink outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                >
                  <option value="all">All Severities</option>
                  <option value="urgent">Urgent / Critical</option>
                  <option value="high">High Priority</option>
                  <option value="normal">Normal</option>
                </select>

                {/* Status filter */}
                <select
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value);
                    setPage(1);
                  }}
                  className="px-3 py-1.5 text-xs rounded-xl border border-line/50 bg-background text-ink outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="unresolved">Action Required (Unresolved)</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-soft font-semibold">
                  Showing {alerts.length} records
                </span>
              </div>
            </div>
          </Card>

          {/* Alert Cards Feed */}
          {loadingLedger ? (
            <div className="flex items-center justify-center py-20">
              <UniversalSpinner size="lg" label="Loading automated notification ledger..." />
            </div>
          ) : alerts.length === 0 ? (
            <EmptyState
              title="No Automated Alerts Found"
              description={
                searchQuery || filterCategory !== "all" || filterStatus !== "all"
                  ? "No alerts match your active filter criteria. Try resetting filters."
                  : "All automated systems are running smoothly with no pending attendance or proxy warnings."
              }
              icon={CheckCircle2}
              action={
                <Button variant="outline" size="sm" onClick={handleTestTrigger} leftIcon={Sparkles}>
                  Simulate Trigger
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => {
                const id = alert._id || alert.id;
                const isResolved = Boolean(alert.metadata?.resolved);
                const IconComponent = getCategoryIcon(alert.type);
                const meta = alert.metadata || {};

                return (
                  <Card
                    key={id}
                    padding="md"
                    bordered
                    className={`transition-all ${isResolved
                      ? "opacity-80 hover:opacity-100 bg-surface"
                      : alert.priority === "urgent"
                        ? "border-rose-300 bg-rose-50/20 dark:bg-rose-950/10 hover:border-rose-400"
                        : "border-line hover:border-primary/40 bg-surface"
                      }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      {/* Left: Icon & Core Details */}
                      <div className="flex items-start gap-3.5 min-w-0 flex-1">
                        <div
                          className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center shadow-xs ${isResolved
                            ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30"
                            : alert.priority === "urgent"
                              ? "bg-rose-100 text-rose-600 dark:bg-rose-900/30"
                              : alert.priority === "high"
                                ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30"
                                : "bg-primary-soft text-primary"
                            }`}
                        >
                          <IconComponent className="w-5 h-5" />
                        </div>

                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm font-bold text-ink">
                              {alert.title}
                            </h4>

                            <Badge tone={getSeverityTone(alert.priority)} size="sm">
                              {alert.priority?.toUpperCase()}
                            </Badge>

                            <Badge
                              tone={isResolved ? "success" : "warning"}
                              size="sm"
                              dot={!isResolved}
                            >
                              {isResolved ? "Resolved" : "Action Required"}
                            </Badge>

                            {meta.tier && (
                              <Badge tone="neutral" size="sm">
                                Tier {meta.tier} Escalation
                              </Badge>
                            )}

                            {meta.isTestSimulation && (
                              <Badge tone="info" size="sm">
                                Simulation
                              </Badge>
                            )}
                          </div>

                          <p className="text-xs text-ink-soft leading-relaxed">
                            {alert.message}
                          </p>

                          {/* Metadata chips */}
                          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-ink-faint">
                            {meta.studentName && (
                              <span className="inline-flex items-center gap-1 bg-background px-2 py-0.5 rounded-md border border-line/60">
                                <Users className="w-3 h-3 text-primary" />
                                <strong className="text-ink">{meta.studentName}</strong>
                                {meta.rollNo && ` (${meta.rollNo})`}
                              </span>
                            )}

                            {meta.section && (
                              <span className="inline-flex items-center gap-1 bg-background px-2 py-0.5 rounded-md border border-line/60">
                                <span>Sec:</span>
                                <strong className="text-ink">{meta.section}</strong>
                              </span>
                            )}

                            {meta.streakLength && (
                              <span className="inline-flex items-center gap-1 bg-background px-2 py-0.5 rounded-md border border-line/60">
                                <span>Streak:</span>
                                <strong className="text-rose-600 font-bold">{meta.streakLength} Missed</strong>
                              </span>
                            )}

                            {meta.sameIpCount && (
                              <span className="inline-flex items-center gap-1 bg-background px-2 py-0.5 rounded-md border border-line/60">
                                <ShieldAlert className="w-3 h-3 text-amber-500" />
                                <span>Concentration:</span>
                                <strong className="text-amber-600 font-bold">{meta.sameIpCount} Marks</strong>
                              </span>
                            )}

                            {alert.createdAt && (
                              <span className="inline-flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(alert.createdAt).toLocaleString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            )}
                          </div>

                          {/* Resolution Audit Trail */}
                          {isResolved && (
                            <div className="mt-2 p-2 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-[11px] text-emerald-800 dark:text-emerald-300">
                              <span>
                                ✓ Resolved by <strong>{meta.resolvedBy || "Campus Admin"}</strong> on{" "}
                                {new Date(meta.resolvedAt || alert.updatedAt).toLocaleDateString()}
                                {meta.resolutionNote && ` — "${meta.resolutionNote}"`}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-end gap-2 shrink-0 pt-2 sm:pt-0">
                        {!isResolved ? (
                          <Button
                            variant="primary"
                            size="xs"
                            onClick={() => setResolvingModalAlert(alert)}
                            leftIcon={Check}
                          >
                            Mark Resolved
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => handleResolve(id, "Reopened by admin")}
                            leftIcon={RotateCcw}
                          >
                            Reopen
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setInspectAlert(alert)}
                          leftIcon={Eye}
                        >
                          Audit Details
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="pt-2">
                  <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    onPageChange={(p) => setPage(p)}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: AUTOMATION RULES & POLICY THRESHOLDS */}
      {activeTab === "rules" && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          {loadingSettings ? (
            <div className="flex items-center justify-center py-20">
              <UniversalSpinner size="lg" label="Loading automation configuration..." />
            </div>
          ) : (
            <>
              {/* Policy Category 1: Consecutive Absence Early Warning */}
              <Card padding="lg" bordered>
                <div className="space-y-5">
                  <div className="flex items-start justify-between gap-4 pb-4 border-b border-line">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-primary" />
                        <h3 className="text-sm font-bold text-ink uppercase tracking-wider">
                          Consecutive Absence Early Warning Escalation
                        </h3>
                      </div>
                      <p className="text-xs text-ink-soft">
                        Automatically scans post-attendance submissions to catch compounding student absenteeism before examinations.
                      </p>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={settings.enableAbsenceEscalations}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            enableAbsenceEscalations: e.target.checked,
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>

                  {settings.enableAbsenceEscalations && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-ink">
                          Consecutive Absence Streak Threshold
                        </label>
                        <div className="flex items-center gap-3">
                          <input
                            type="number"
                            min="1"
                            max="15"
                            value={settings.consecutiveAbsenceStreak}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                consecutiveAbsenceStreak: parseInt(e.target.value) || 3,
                              })
                            }
                            className="w-24 px-3 py-2 text-sm rounded-xl border border-line bg-background text-ink outline-none focus:ring-2 focus:ring-primary/20"
                          />
                          <span className="text-xs text-ink-soft">
                            consecutive scheduled class absences trigger tier 1 alert
                          </span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="block text-xs font-bold text-ink">
                          Escalation Delivery Channels
                        </label>

                        <div className="space-y-2">
                          <label className="flex items-center gap-2.5 cursor-pointer text-xs text-ink">
                            <input
                              type="checkbox"
                              checked={settings.enableParentEmailNotifications}
                              onChange={(e) =>
                                setSettings({
                                  ...settings,
                                  enableParentEmailNotifications: e.target.checked,
                                })
                              }
                              className="rounded text-primary focus:ring-primary/30"
                            />
                            <span>
                              <strong>Tier 2: Parent Email Dispatch</strong> (Sends formal notification to registered parent address)
                            </span>
                          </label>

                          <label className="flex items-center gap-2.5 cursor-pointer text-xs text-ink">
                            <input
                              type="checkbox"
                              checked={settings.enableAdminEscalations}
                              onChange={(e) =>
                                setSettings({
                                  ...settings,
                                  enableAdminEscalations: e.target.checked,
                                })
                              }
                              className="rounded text-primary focus:ring-primary/30"
                            />
                            <span>
                              <strong>Tier 3: Administrative Flag</strong> (Flags streak to Dean and Campus Admin queue)
                            </span>
                          </label>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              {/* Policy Category 2: Defaulter Threshold Warning */}
              <Card padding="lg" bordered>
                <div className="space-y-5">
                  <div className="flex items-start justify-between gap-4 pb-4 border-b border-line">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                        <h3 className="text-sm font-bold text-ink uppercase tracking-wider">
                          Attendance Defaulter Warning Scanner
                        </h3>
                      </div>
                      <p className="text-xs text-ink-soft">
                        Warns students when overall percentage falls below institutional examination eligibility cutoff.
                      </p>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={settings.enableLowAttendanceWarning}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            enableLowAttendanceWarning: e.target.checked,
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>

                  {settings.enableLowAttendanceWarning && (
                    <div className="space-y-2 pt-2">
                      <label className="block text-xs font-bold text-ink">
                        Defaulter Cutoff Threshold (%)
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min="50"
                          max="95"
                          value={settings.lowAttendanceThreshold}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              lowAttendanceThreshold: parseInt(e.target.value) || 75,
                            })
                          }
                          className="w-24 px-3 py-2 text-sm rounded-xl border border-line bg-background text-ink outline-none focus:ring-2 focus:ring-primary/20"
                        />
                        <span className="text-xs text-ink-soft">
                          % minimum attendance required (statutory university requirement is typically 75%)
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              {/* Policy Category 3: Proxy & Security Detection */}
              <Card padding="lg" bordered>
                <div className="space-y-5">
                  <div className="flex items-start justify-between gap-4 pb-4 border-b border-line">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="w-5 h-5 text-rose-500" />
                        <h3 className="text-sm font-bold text-ink uppercase tracking-wider">
                          Proxy & Concurrent IP Safeguard
                        </h3>
                      </div>
                      <p className="text-xs text-ink-soft">
                        Flags excessive attendance marks submitted from a single IP address during QR and self-check-in windows.
                      </p>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={settings.enableProxyAlerts}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            enableProxyAlerts: e.target.checked,
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>

                  {settings.enableProxyAlerts && (
                    <div className="space-y-2 pt-2">
                      <label className="block text-xs font-bold text-ink">
                        Single-IP Mark Threshold Count
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min="10"
                          max="200"
                          value={settings.proxyThresholdCount}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              proxyThresholdCount: parseInt(e.target.value) || 40,
                            })
                          }
                          className="w-24 px-3 py-2 text-sm rounded-xl border border-line bg-background text-ink outline-none focus:ring-2 focus:ring-primary/20"
                        />
                        <span className="text-xs text-ink-soft">
                          submissions from same IP within a single session before an admin proxy alert is generated
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              {/* Policy Category 4: Lifecycle Automated Scanners */}
              <Card padding="lg" bordered>
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-line">
                    <Sparkles className="w-5 h-5 text-primary" />
                    <h3 className="text-sm font-bold text-ink uppercase tracking-wider">
                      Campus Lifecycle Automated Dispatches
                    </h3>
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-center justify-between p-3 rounded-xl border border-line/60 bg-background cursor-pointer">
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-ink">Semester Promotion Scanner Notifications</p>
                        <p className="text-[11px] text-ink-faint">
                          Alert students and faculty when end-of-term promotion dry-runs or executions finish.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.enablePromotionScannerAlerts}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            enablePromotionScannerAlerts: e.target.checked,
                          })
                        }
                        className="rounded text-primary focus:ring-primary/30 w-4 h-4"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 rounded-xl border border-line/60 bg-background cursor-pointer">
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-ink">Fee Due Date Reminders</p>
                        <p className="text-[11px] text-ink-faint">
                          Automatically notify students and parents 7 days and 2 days before semester fee payment deadlines.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.enableFeeDueReminders}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            enableFeeDueReminders: e.target.checked,
                          })
                        }
                        className="rounded text-primary focus:ring-primary/30 w-4 h-4"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 rounded-xl border border-line/60 bg-background cursor-pointer">
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-ink">Exam Schedule & Hall Ticket Alerts</p>
                        <p className="text-[11px] text-ink-faint">
                          Notify students as soon as admit cards and seating grids are published by exam cell.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.enableExamScheduleAlerts}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            enableExamScheduleAlerts: e.target.checked,
                          })
                        }
                        className="rounded text-primary focus:ring-primary/30 w-4 h-4"
                      />
                    </label>
                  </div>
                </div>
              </Card>

              {/* Action Bar */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={savingSettings}
                  leftIcon={Save}
                >
                  {savingSettings ? "Saving Changes..." : "Save Automation Policies"}
                </Button>
              </div>
            </>
          )}
        </form>
      )}

      {/* RESOLUTION ACTION MODAL */}
      {resolvingModalAlert && (
        <Modal
          isOpen={!!resolvingModalAlert}
          onClose={() => setResolvingModalAlert(null)}
          title="Acknowledge & Resolve Escalation"
        >
          <div className="space-y-4">
            <div className="p-3 bg-background rounded-xl border border-line space-y-1">
              <div className="flex items-center gap-2">
                <Badge tone={getSeverityTone(resolvingModalAlert.priority)} size="sm">
                  {resolvingModalAlert.priority?.toUpperCase()}
                </Badge>
                <span className="text-xs font-bold text-ink">{resolvingModalAlert.title}</span>
              </div>
              <p className="text-xs text-ink-soft">{resolvingModalAlert.message}</p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-ink">
                Resolution Note / Action Taken (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Student met with academic counselor; medical certificate verified; parent contacted."
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-line bg-background text-ink placeholder:text-ink-faint outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setResolvingModalAlert(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={resolvingId === resolvingModalAlert._id}
                onClick={() => handleResolve(resolvingModalAlert._id, resolutionNote)}
                leftIcon={Check}
              >
                {resolvingId === resolvingModalAlert._id ? "Resolving..." : "Confirm Resolution"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* AUDIT INSPECTION MODAL */}
      {inspectAlert && (
        <Modal
          isOpen={!!inspectAlert}
          onClose={() => setInspectAlert(null)}
          title="Audit Ledger Inspection"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-line">
              <div className="flex items-center gap-2">
                <Badge tone={getSeverityTone(inspectAlert.priority)} size="md">
                  {inspectAlert.priority?.toUpperCase()}
                </Badge>
                <Badge tone={inspectAlert.metadata?.resolved ? "success" : "warning"} size="md">
                  {inspectAlert.metadata?.resolved ? "Resolved" : "Pending Action"}
                </Badge>
              </div>
              <span className="text-xs text-ink-faint">
                ID: {inspectAlert._id}
              </span>
            </div>

            <div className="space-y-1">
              <h4 className="text-sm font-bold text-ink">{inspectAlert.title}</h4>
              <p className="text-xs text-ink-soft leading-relaxed">{inspectAlert.message}</p>
            </div>

            <div className="p-3 bg-background rounded-xl border border-line space-y-2 text-xs">
              <p className="font-bold text-ink uppercase tracking-wider text-[10px]">Technical Metadata</p>
              <div className="grid grid-cols-2 gap-2 text-ink-soft">
                <div>
                  <span className="text-ink-faint">Type:</span> {inspectAlert.type}
                </div>
                <div>
                  <span className="text-ink-faint">Tenant Scoped:</span> {String(inspectAlert.tenantId || "Global")}
                </div>
                <div>
                  <span className="text-ink-faint">Target Roles:</span> {(inspectAlert.targetRoles || []).join(", ") || "All"}
                </div>
                <div>
                  <span className="text-ink-faint">Triggered At:</span> {new Date(inspectAlert.createdAt).toLocaleString()}
                </div>
              </div>

              {inspectAlert.metadata && (
                <div className="pt-2 border-t border-line/60">
                  <span className="text-ink-faint text-[10px] block mb-1">Payload Dump:</span>
                  <pre className="p-2 rounded bg-surface border border-line text-[10px] text-ink overflow-x-auto font-mono">
                    {JSON.stringify(inspectAlert.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setInspectAlert(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AutomatedNotifications;
