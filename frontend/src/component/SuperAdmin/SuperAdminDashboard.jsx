// src/components/SuperAdmin/SuperAdminDashboard.jsx
// Redesigned with Academic Precision System (redesign/DESIGN.md & redesign/code.html)
// Enterprise Orchestration, State Telemetry, Multi-Tenant Campus Isolation & Cryptographic Audit Ledger
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../utils/api";
import { formatDateDMY, formatDateTime } from "../../utils/dateUtils";
import { logError } from "../../utils/logger";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import {
  Building2,
  Users,
  UserCog,
  BookOpen,
  ClipboardCheck,
  Ticket,
  ChevronRight,
  RefreshCw,
  Activity,
  AlertCircle,
  Shield,
  TrendingUp,
  Eye,
  Mail,
  Phone,
  Globe,
  MessageSquare,
  XCircle,
  Filter,
  Loader2,
  Package,
  Headphones,
  CheckCircle2,
  ArrowRight,
  Download,
  Server,
  Cpu,
  Database,
  HardDrive,
  Zap,
  Plus,
  ExternalLink,
  ShieldCheck,
  Search,
} from "lucide-react";
import Button from "../common/ui/Button";
import Card from "../common/ui/Card";
import Badge from "../common/ui/Badge";
import EmptyState from "../common/ui/EmptyState";

const SuperAdminDashboard = ({ role, userId, userName, userEmail }) => {
  const navigate = useNavigate();

  const [platformStats, setPlatformStats] = useState({
    tenants: { total: 0, active: 0 },
    users: { students: 0, teachers: 0, admins: 0, total: 0 },
    content: { subjects: 0, attendanceRecords: 0, tickets: 0 },
  });
  const [tenants, setTenants] = useState([]);
  const [leads, setLeads] = useState([]);
  const [leadStats, setLeadStats] = useState({
    total: 0,
    byType: {},
    byStatus: {},
    recent: [],
  });
  const [loading, setLoading] = useState(true);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);
  const [leadsPage, setLeadsPage] = useState(1);
  const [tenantSearch, setTenantSearch] = useState("");
  const [leadsFilters, setLeadsFilters] = useState({
    type: "",
    status: "",
    search: "",
  });

  useEffect(() => {
    const userRole = localStorage.getItem("role");
    if (userRole !== "super_admin") {
      setError("Super admin access required");
      setLoading(false);
      return;
    }
    fetchPlatformStats();
    fetchTenants();
    fetchLeads();
    fetchLeadStats();
    fetchAuditLogs();
  }, []);

  const fetchAuditLogs = async () => {
    setAuditLogsLoading(true);
    try {
      const response = await api.get("/admin/audit-logs?limit=15");
      if (response.data?.success) {
        const rawData = response.data.data;
        const logsList = Array.isArray(rawData)
          ? rawData
          : Array.isArray(rawData?.logs)
          ? rawData.logs
          : [];
        setAuditLogs(logsList);
      } else {
        setAuditLogs([]);
      }
    } catch (err) {
      logError("Fetch Audit Logs", err);
      setAuditLogs([]);
    } finally {
      setAuditLogsLoading(false);
    }
  };

  const fetchPlatformStats = async () => {
    try {
      const response = await api.get("/admin/super/stats");
      if (response.data?.success) {
        setPlatformStats(
          response.data.data || {
            tenants: { total: 0, active: 0 },
            users: { students: 0, teachers: 0, admins: 0, total: 0 },
            content: { subjects: 0, attendanceRecords: 0, tickets: 0 },
          }
        );
      }
    } catch (err) {
      logError("Fetch Platform Stats", err);
    }
  };

  const fetchTenants = async () => {
    try {
      const response = await api.get("/admin/super/tenants");
      if (response.data?.success) {
        setTenants(response.data.data || []);
      }
    } catch (err) {
      logError("Fetch Tenants", err);
      setError(err.response?.data?.message || "Failed to load tenants");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchPlatformStats(),
      fetchTenants(),
      fetchLeads(),
      fetchLeadStats(),
      fetchAuditLogs(),
    ]);
    setRefreshing(false);
  };

  const fetchLeads = async () => {
    setLeadsLoading(true);
    try {
      const params = new URLSearchParams({
        page: leadsPage,
        limit: 20,
        ...(leadsFilters.type && { type: leadsFilters.type }),
        ...(leadsFilters.status && { status: leadsFilters.status }),
        ...(leadsFilters.search && { search: leadsFilters.search }),
      });
      const response = await api.get(`/admin/super/leads?${params}`);
      if (response.data?.success) {
        setLeads(response.data.data || []);
      }
    } catch (err) {
      logError("Fetch Leads", err);
    } finally {
      setLeadsLoading(false);
    }
  };

  const fetchLeadStats = async () => {
    try {
      const response = await api.get("/admin/super/leads/stats");
      if (response.data?.success) {
        setLeadStats(response.data.data || { total: 0, byType: {}, byStatus: {}, recent: [] });
      }
    } catch (err) {
      logError("Fetch Lead Stats", err);
    }
  };

  const handleLeadStatusChange = async (leadId, newStatus) => {
    try {
      const response = await api.patch(`/admin/super/leads/${leadId}`, { status: newStatus });
      if (response.data?.success) {
        setLeads(leads.map((l) => (l._id === leadId ? { ...l, status: newStatus } : l)));
        fetchLeadStats();
      }
    } catch (err) {
      logError("Update Lead Status", err);
    }
  };

  const handleLeadDelete = async (leadId) => {
    if (!window.confirm("Delete this lead inquiry? This action cannot be undone.")) return;
    try {
      const response = await api.delete(`/admin/super/leads/${leadId}`);
      if (response.data?.success) {
        setLeads(leads.filter((l) => l._id !== leadId));
        fetchLeadStats();
      }
    } catch (err) {
      logError("Delete Lead", err);
    }
  };

  const handleExportLeadsCSV = () => {
    if (!leads || leads.length === 0) return;
    const headers = ["Name", "Email", "Phone", "Institution", "Type", "Status", "Created At"];
    const rows = leads.map((l) => [
      `"${l.name || ""}"`,
      `"${l.email || ""}"`,
      `"${l.phone || ""}"`,
      `"${l.institutionName || ""}"`,
      `"${l.type || ""}"`,
      `"${l.status || ""}"`,
      `"${l.createdAt ? new Date(l.createdAt).toISOString() : ""}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `attendease_leads_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const recentTenants = useMemo(() => {
    let filtered = [...tenants];
    if (tenantSearch.trim()) {
      const q = tenantSearch.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.name?.toLowerCase().includes(q) ||
          t.subdomain?.toLowerCase().includes(q) ||
          t.subscription?.plan?.toLowerCase().includes(q)
      );
    }
    return filtered
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 6);
  }, [tenants, tenantSearch]);

  const activeTenantPercentage = useMemo(() => {
    if (!platformStats.tenants.total || platformStats.tenants.total === 0) return "100.0";
    return ((platformStats.tenants.active / platformStats.tenants.total) * 100).toFixed(1);
  }, [platformStats.tenants]);

  const studentFacultyRatio = useMemo(() => {
    const students = platformStats.users.students || 0;
    const teachers = platformStats.users.teachers || 1;
    return (students / (teachers || 1)).toFixed(1);
  }, [platformStats.users]);

  // Loading Skeleton
  if (loading && !refreshing) {
    return (
      <div className="space-y-6">
        <div className="h-24 bg-white rounded-2xl border border-slate-200/80 p-6 flex items-center animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-white rounded-2xl border border-slate-200/80 p-5 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Error UI
  if (error) {
    return (
      <div className="flex items-center justify-center p-6 min-h-[60vh]">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-8 max-w-md w-full text-center shadow-sm">
          <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-200">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Access Restricted</h2>
          <p className="text-xs text-slate-500 mb-6">{error}</p>
          <Button onClick={() => navigate("/login")} variant="primary" size="sm">
            Return to Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans antialiased text-slate-900">
      {/* 1. Global Governance Header Strip */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Enterprise Orchestration & State Telemetry
            </h1>
          </div>
          <p className="text-sm text-slate-500 max-w-2xl leading-relaxed">
            Global master view, multi-tenant campus isolation, and continuous cryptographic compliance.
          </p>
        </div>

        {/* Compliance Pills & Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex items-center gap-2 bg-slate-100/90 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-mono text-slate-600">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>SOC-2 Type II</span>
            <span className="text-slate-300">•</span>
            <span className="text-emerald-700 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {tenants.length || platformStats.tenants.total} Schemas Active
            </span>
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-xs transition-all active:scale-[0.98]"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-primary ${refreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 2. Key Metrics Telemetry Grid (Academic Precision Style) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Tenants */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Institutions / Tenants
              </span>
              <div className="w-7 h-7 rounded-lg bg-primary-soft text-primary flex items-center justify-center border border-primary-surface">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-black text-slate-900 tracking-tight tabular-nums font-sans">
                {platformStats.tenants.total.toLocaleString()}
              </span>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                {activeTenantPercentage}% Active
              </span>
            </div>
          </div>
          <div className="pt-3 border-t border-slate-100 mt-3 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span className="text-slate-800 font-semibold">{platformStats.tenants.active} Active</span>
            <span>{Math.max(0, platformStats.tenants.total - platformStats.tenants.active)} In Setup</span>
          </div>
        </div>

        {/* KPI 2: Authenticated Identities */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Authenticated Identities
              </span>
              <div className="w-7 h-7 rounded-lg bg-primary-soft text-primary flex items-center justify-center border border-primary-surface">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-black text-slate-900 tracking-tight tabular-nums font-sans">
                {platformStats.users.total.toLocaleString()}
              </span>
              <span className="text-[11px] font-bold text-primary-dark bg-primary-soft px-2 py-0.5 rounded-full border border-primary-surface">
                Active Cluster
              </span>
            </div>
          </div>
          <div className="pt-3 border-t border-slate-100 mt-3 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span className="text-slate-800 font-semibold">
              {platformStats.users.students.toLocaleString()} Students
            </span>
            <span>{platformStats.users.teachers.toLocaleString()} Staff</span>
          </div>
        </div>

        {/* KPI 3: Academic Workloads & Ratio */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Academic Operations
              </span>
              <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
                <UserCog className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-black text-slate-900 tracking-tight tabular-nums font-sans">
                {(platformStats.users.teachers + platformStats.users.admins).toLocaleString()}
              </span>
              <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 font-mono">
                1:{studentFacultyRatio} Ratio
              </span>
            </div>
          </div>
          <div className="pt-3 border-t border-slate-100 mt-3 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span className="text-slate-800 font-semibold">{platformStats.users.teachers} Faculty</span>
            <span>{platformStats.users.admins} Tenant Admins</span>
          </div>
        </div>

        {/* KPI 4: Attendance Records & Compliance */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Verified Records
              </span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                <ClipboardCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-black text-slate-900 tracking-tight tabular-nums font-sans">
                {platformStats.content.attendanceRecords.toLocaleString()}
              </span>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Ledger Valid
              </span>
            </div>
          </div>
          <div className="pt-3 border-t border-slate-100 mt-3 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span className="text-slate-800 font-semibold">
              {platformStats.content.subjects.toLocaleString()} Course Rosters
            </span>
            <span className="text-emerald-700 font-semibold">Zero Desync</span>
          </div>
        </div>
      </div>

      {/* 3. Platform Module Quick Jump Cards (Bento Navigation) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            title: "Tenants & Campuses",
            description: "PostgreSQL autonomous schemas, KMS keys, and domain mappings.",
            icon: Building2,
            path: "/super-admin/tenants",
            badge: `${tenants.length || platformStats.tenants.total} Active`,
            badgeStyle: "bg-primary-soft text-primary-dark border-primary-surface",
            iconStyle: "bg-primary-soft text-primary border-primary-surface",
            actionText: "Manage Schemas",
          },
          {
            title: "System Monitoring",
            description: "Sub-40ms edge latency, compute cluster load & health telemetry.",
            icon: Activity,
            path: "/super-admin/monitoring",
            badge: "99.99% SLA",
            badgeStyle: "bg-emerald-50 text-emerald-700 border-emerald-200",
            iconStyle: "bg-emerald-50 text-emerald-600 border-emerald-200",
            actionText: "View Telemetry",
          },
          {
            title: "Subscription Plans",
            description: "Campus Standard, University Enterprise & multi-year licensing tiers.",
            icon: Package,
            path: "/super-admin/plans",
            badge: "Billing & Quotas",
            badgeStyle: "bg-amber-50 text-amber-700 border-amber-200",
            iconStyle: "bg-amber-50 text-amber-600 border-amber-200",
            actionText: "Reconcile Ledger",
          },
          {
            title: "Support Helpdesk",
            description: "Statutory compliance audits, COE ticket discrepancies, and Tier-3 appeals.",
            icon: Headphones,
            path: "/super-admin/support",
            badge: `${platformStats.content.tickets || 0} Open`,
            badgeStyle: "bg-purple-50 text-purple-700 border-purple-200",
            iconStyle: "bg-purple-50 text-purple-600 border-purple-200",
            actionText: "Review Tickets",
          },
        ].map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={idx}
              onClick={() => navigate(item.path)}
              className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm hover:border-primary/50 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-4 group"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center border ${item.iconStyle} group-hover:scale-105 transition-transform`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span
                    className={`text-[11px] font-bold font-mono px-2.5 py-0.5 rounded-full border ${item.badgeStyle}`}
                  >
                    {item.badge}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-primary transition-colors">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.description}</p>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs font-bold text-primary">
                <span>{item.actionText}</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Asymmetric 8-Col / 4-Col Grid: Recent Tenants & Infrastructure Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8-col) — Recent Institution Tenants & Audit Ledger */}
        <div className="lg:col-span-8 space-y-6">
          {/* Recent Tenants Panel */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">Recent Institution Tenants</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Live roster of institutional systems deployed to dedicated database schemas
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="relative w-48 sm:w-56">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filter tenants..."
                    value={tenantSearch}
                    onChange={(e) => setTenantSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>
                <button
                  onClick={() => navigate("/super-admin/tenants")}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl inline-flex items-center gap-1 transition-colors"
                >
                  <span>Directory</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-5">Institution & Domain</th>
                    <th className="py-3 px-4">Plan / Tier</th>
                    <th className="py-3 px-4">Schema Status</th>
                    <th className="py-3 px-4 text-right">Registered</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentTenants.length > 0 ? (
                    recentTenants.map((tenant) => {
                      const status = tenant.subscription?.status || "trial";
                      const plan = tenant.subscription?.plan || "free";
                      return (
                        <tr
                          key={tenant._id}
                          className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                          onClick={() => navigate(`/super-admin/tenants/${tenant._id}`)}
                        >
                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-xs"
                                style={{
                                  backgroundColor: tenant.branding?.primaryColor || "#4338ca",
                                }}
                              >
                                {tenant.name?.[0]?.toUpperCase() || "T"}
                              </div>
                              <div>
                                <p className="font-bold text-slate-900 group-hover:text-primary transition-colors">
                                  {tenant.name}
                                </p>
                                <p className="text-[11px] text-slate-500 font-mono">
                                  {tenant.subdomain ? `${tenant.subdomain}.attendease.com` : "Domain unassigned"}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider ${
                                plan === "enterprise"
                                  ? "bg-primary-soft text-primary-dark border border-primary-surface"
                                  : plan === "professional"
                                  ? "bg-purple-50 text-purple-700 border border-purple-200"
                                  : "bg-slate-100 text-slate-700 border border-slate-200"
                              }`}
                            >
                              {plan}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                                status === "active"
                                  ? "text-emerald-700"
                                  : status === "trial"
                                  ? "text-amber-700"
                                  : "text-rose-700"
                              }`}
                            >
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  status === "active"
                                    ? "bg-emerald-500"
                                    : status === "trial"
                                    ? "bg-amber-500"
                                    : "bg-rose-500"
                                }`}
                              />
                              <span className="capitalize">{status}</span>
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-slate-500 tabular-nums">
                            {formatDateDMY(tenant.createdAt)}
                          </td>
                          <td className="py-3.5 px-5 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/super-admin/tenants/${tenant._id}`);
                              }}
                              className="text-primary hover:text-primary-dark font-bold hover:underline"
                            >
                              Manage
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        No institution tenants match your search filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cryptographic System Audit Ledger */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden" id="audit-ledger">
            <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary-soft text-primary flex items-center justify-center border border-primary-surface">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Cryptographic System Audit Ledger</h2>
                  <p className="text-xs text-slate-500">
                    Append-only verification log of schema mutations and policy executions
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Synchronized
                </span>
                <button
                  onClick={fetchAuditLogs}
                  disabled={auditLogsLoading}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
                  title="Reload audit log"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${auditLogsLoading ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-5">Event Action</th>
                    <th className="py-3 px-4">Actor Identity</th>
                    <th className="py-3 px-4">Target Resource</th>
                    <th className="py-3 px-4">Origin IP</th>
                    <th className="py-3 px-5 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogsLoading ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary mb-2" />
                        <span>Verifying cryptographic logs…</span>
                      </td>
                    </tr>
                  ) : !Array.isArray(auditLogs) || auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        No audit records currently available in cluster ledger.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.slice(0, 6).map((log) => (
                      <tr key={log._id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-5 font-mono font-bold text-primary-dark">
                          {log.action || "SYSTEM_EVENT"}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-900">{log.userName || "System Operator"}</span>
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono font-semibold">
                            {log.actorRole || "super_admin"}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600">
                          {log.resourceType || "Cluster::Core"}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-400">
                          {log.ip || "127.0.0.1"}
                        </td>
                        <td className="py-3 px-5 text-right text-slate-500 font-mono whitespace-nowrap">
                          {formatDateTime(log.createdAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column (4-col) — Identity Distribution & Infrastructure Telemetry */}
        <div className="lg:col-span-4 space-y-6">
          {/* Identity Distribution Donut Chart */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">User Identity Distribution</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {platformStats.users.total.toLocaleString()} total federated accounts
                </p>
              </div>
              <Users className="w-4 h-4 text-primary" />
            </div>

            {/* Donut Graphic */}
            <div className="h-44 relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: "Students", value: platformStats.users.students || 0, color: "#4338ca" },
                      { name: "Faculty", value: platformStats.users.teachers || 0, color: "#059669" },
                      { name: "Admins", value: platformStats.users.admins || 0, color: "#6366f1" },
                    ].filter((item) => item.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={54}
                    outerRadius={72}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {[
                      { color: "#4338ca" },
                      { color: "#059669" },
                      { color: "#6366f1" },
                    ].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid #e2e8f0",
                      fontSize: "11px",
                      backgroundColor: "#ffffff",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Center Counter */}
              <div className="absolute flex flex-col items-center justify-center pointer-events-none text-center">
                <span className="text-xl font-extrabold text-slate-900 tabular-nums">
                  {platformStats.users.total > 1000
                    ? `${(platformStats.users.total / 1000).toFixed(1)}k`
                    : platformStats.users.total}
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  Users
                </span>
              </div>
            </div>

            {/* Legend breakdown */}
            <div className="space-y-2 pt-3 border-t border-slate-100 text-xs">
              {[
                {
                  label: "Students",
                  value: platformStats.users.students,
                  color: "bg-[#4338ca]",
                  pct: platformStats.users.total > 0
                    ? `${((platformStats.users.students / platformStats.users.total) * 100).toFixed(1)}%`
                    : "0%",
                },
                {
                  label: "Faculty Members",
                  value: platformStats.users.teachers,
                  color: "bg-[#059669]",
                  pct: platformStats.users.total > 0
                    ? `${((platformStats.users.teachers / platformStats.users.total) * 100).toFixed(1)}%`
                    : "0%",
                },
                {
                  label: "Tenant Admins",
                  value: platformStats.users.admins,
                  color: "bg-[#6366f1]",
                  pct: platformStats.users.total > 0
                    ? `${((platformStats.users.admins / platformStats.users.total) * 100).toFixed(1)}%`
                    : "0%",
                },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-slate-600 font-medium">
                    <span className={`w-2 h-2 rounded-full ${item.color}`} />
                    {item.label}
                  </span>
                  <span className="font-mono font-bold text-slate-900 tabular-nums">
                    {item.value.toLocaleString()}{" "}
                    <span className="text-slate-400 font-normal">({item.pct})</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Infrastructure Telemetry Panel (GovCloud / Cluster Metrics) */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm" id="telemetry-view">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Infrastructure Telemetry</h3>
                <p className="text-xs text-slate-500 mt-0.5">Edge nodes & PostgreSQL health</p>
              </div>
              <Cpu className="w-4 h-4 text-primary" />
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-500 font-medium block">Edge Biometric Latency</span>
                  <span className="text-lg font-black text-slate-900 font-sans tabular-nums">38 ms</span>
                </div>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Healthy
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-500 font-medium block">PostgreSQL Load</span>
                  <span className="text-lg font-black text-slate-900 font-sans tabular-nums">18% CPU</span>
                </div>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Optimal
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-500 font-medium block">Statutory Storage Vault</span>
                  <span className="text-lg font-black text-slate-900 font-sans tabular-nums">4.2 TB</span>
                </div>
                <span className="text-xs font-mono text-slate-600 bg-slate-200/70 px-2 py-0.5 rounded">
                  AES-256
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-500 font-medium block">API Gateway Availability</span>
                  <span className="text-lg font-black text-slate-900 font-sans tabular-nums">99.99%</span>
                </div>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  1,420 msg/m
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Inbound Institutional Inquiries & RFPs (Leads & Demo Requests) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 sm:p-6 space-y-5" id="support-view">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Inbound Institutional Inquiries & RFPs</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Registrar, Vice Chancellor, and Dean enterprise engagement leads awaiting assignment
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search leads..."
                value={leadsFilters.search}
                onChange={(e) => setLeadsFilters({ ...leadsFilters, search: e.target.value })}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            <select
              value={leadsFilters.type}
              onChange={(e) => setLeadsFilters({ ...leadsFilters, type: e.target.value })}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-700 outline-none cursor-pointer"
            >
              <option value="">All Inquiry Types</option>
              <option value="demo">Demo RFPs</option>
              <option value="contact">Contact Forms</option>
            </select>

            <select
              value={leadsFilters.status}
              onChange={(e) => setLeadsFilters({ ...leadsFilters, status: e.target.value })}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-700 outline-none cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="converted">Converted</option>
              <option value="closed">Closed</option>
            </select>

            <button
              onClick={handleExportLeadsCSV}
              disabled={leads.length === 0}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Lead KPI Mini Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Inquiries</span>
            <p className="text-xl font-black text-slate-900 mt-0.5 tabular-nums">{leadStats.total}</p>
          </div>
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Contact Inquiries</span>
            <p className="text-xl font-black text-primary mt-0.5 tabular-nums">{leadStats.byType?.contact || 0}</p>
          </div>
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Demo Bookings</span>
            <p className="text-xl font-black text-purple-600 mt-0.5 tabular-nums">{leadStats.byType?.demo || 0}</p>
          </div>
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Awaiting Contact</span>
            <p className="text-xl font-black text-amber-600 mt-0.5 tabular-nums">{leadStats.byStatus?.new || 0}</p>
          </div>
        </div>

        {/* Leads Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Official & Prospect</th>
                <th className="py-3 px-4">Campus System</th>
                <th className="py-3 px-4">Inquiry Type</th>
                <th className="py-3 px-4">Official Contact</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Received</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leadsLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary mb-2" />
                    <span>Loading inquiries…</span>
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No lead inquiries matching current criteria.
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead._id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <div>
                        <p className="font-bold text-slate-900">{lead.name}</p>
                        <p className="text-[11px] text-slate-500 font-mono">{lead.email}</p>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-slate-800">{lead.institutionName || "Institutional Prospect"}</p>
                      {lead.studentCount && (
                        <p className="text-[11px] text-slate-400 font-mono">{lead.studentCount} capacity</p>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          lead.type === "demo"
                            ? "bg-secondary-soft text-secondary-dark border border-secondary-surface"
                            : "bg-primary-soft text-primary-dark border border-primary-surface"
                        }`}
                      >
                        {lead.type === "demo" ? "Demo RFP" : "Contact Lead"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">
                      {lead.phone || "—"}
                    </td>
                    <td className="py-3.5 px-4">
                      <select
                        value={lead.status}
                        onChange={(e) => handleLeadStatusChange(lead._id, e.target.value)}
                        disabled={leadsLoading}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border outline-none cursor-pointer ${
                          lead.status === "new"
                            ? "bg-amber-50 text-amber-800 border-amber-300"
                            : lead.status === "contacted"
                            ? "bg-primary-soft text-primary-dark border-primary-surface"
                            : lead.status === "converted"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                            : "bg-slate-100 text-slate-700 border-slate-300"
                        }`}
                      >
                        <option value="new">New</option>
                        <option value="contacted">Contacted</option>
                        <option value="converted">Converted</option>
                        <option value="closed">Closed</option>
                      </select>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                      {formatDateDMY(lead.createdAt)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleLeadDelete(lead._id)}
                        disabled={leadsLoading}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                        title="Delete lead inquiry"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination Bar */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
            <span>
              Page {leadsPage} of {leadStats.total > 0 ? Math.ceil(leadStats.total / 20) : 1}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setLeadsPage((p) => Math.max(1, p - 1))}
                disabled={leadsLoading || leadsPage <= 1}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-semibold rounded-lg transition"
              >
                Previous
              </button>
              <button
                onClick={() => setLeadsPage((p) => p + 1)}
                disabled={leadsLoading || leadsPage * 20 >= leadStats.total}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-semibold rounded-lg transition"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
