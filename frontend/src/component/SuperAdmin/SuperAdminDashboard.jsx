// src/components/SuperAdmin/SuperAdminDashboard.jsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
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
  Eye,
  Mail,
  Phone,
  Globe,
  MessageSquare,
  Package,
  Headphones,
  Clock,
  CheckCircle,
} from "lucide-react";
import Button from "../common/ui/Button";
import Badge from "../common/ui/Badge";
import Panel from "../common/ui/Panel";
import Table from "../common/ui/Table";
import StatTile from "../common/ui/StatTile";
import ErrorState from "../common/ui/ErrorState";

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
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);

  const fetchAuditLogs = async () => {
    setAuditLogsLoading(true);
    try {
      const response = await api.get("/admin/audit-logs?limit=10");
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
      if (response.data.success) {
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
      if (response.data.success) {
        setTenants(response.data.data || []);
      }
    } catch (err) {
      logError("Fetch Tenants", err);
      setError(err.response?.data?.message || "Failed to load tenants");
    } finally {
      setLoading(false);
    }
  };

  const fetchLeads = async () => {
    try {
      const response = await api.get(`/admin/super/leads?limit=5`);
      if (response.data.success) {
        setLeads(response.data.data || []);
      }
    } catch (err) {
      logError("Fetch Leads", err);
    }
  };

  const fetchLeadStats = async () => {
    try {
      const response = await api.get("/admin/super/leads/stats");
      if (response.data.success) {
        setLeadStats(response.data.data || { total: 0, byType: {}, byStatus: {}, recent: [] });
      }
    } catch (err) {
      logError("Fetch Lead Stats", err);
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

  const getStatusTone = (status) => {
    switch (status) {
      case "active":
        return "success";
      case "trial":
        return "warning";
      case "suspended":
      case "expired":
        return "error";
      default:
        return "neutral";
    }
  };

  const getPlanTone = (plan) => {
    switch (plan) {
      case "free":
        return "neutral";
      case "basic":
        return "primary";
      case "professional":
        return "secondary";
      case "enterprise":
        return "success";
      default:
        return "neutral";
    }
  };

  const recentTenants = useMemo(() => {
    return [...tenants]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 6);
  }, [tenants]);

  const quickActions = [
    {
      title: "Institution Tenants",
      description: "Manage campuses, subdomains, quotas & subscriptions",
      icon: Building2,
      path: "/super-admin/tenants",
      badge: `${platformStats.tenants.total} Total`,
    },
    {
      title: "Inbound Inquiries",
      description: "Enterprise leads, demo bookings & campus contact logs",
      icon: MessageSquare,
      path: "/super-admin/leads",
      badge: `${leadStats.total || 0} Inquiries`,
    },
    {
      title: "Subscription Plans",
      description: "Configure billing tiers, student quotas & feature entitlements",
      icon: Package,
      path: "/super-admin/plans",
      badge: "Commercial",
    },
    {
      title: "Audit & Monitoring",
      description: "Real-time security telemetry, audit logs & system health",
      icon: Shield,
      path: "/super-admin/monitoring",
      badge: "Real-time",
    },
  ];

  const tenantColumns = [
    {
      header: "Institution & Campus",
      cell: (row) => (
        <div>
          <div className="font-semibold text-ink flex items-center gap-2">
            <span>{row.name}</span>
          </div>
          <div className="text-[11px] font-mono tnum text-ink-muted">
            {row.subdomain}.attendease.com
          </div>
        </div>
      ),
    },
    {
      header: "Subscription Plan",
      align: "center",
      cell: (row) => (
        <Badge tone={getPlanTone(row.subscription?.plan)}>
          {(row.subscription?.plan || "free").toUpperCase()}
        </Badge>
      ),
    },
    {
      header: "Status",
      align: "center",
      cell: (row) => (
        <Badge tone={getStatusTone(row.subscription?.status)} dot>
          {(row.subscription?.status || "trial").toUpperCase()}
        </Badge>
      ),
    },
    {
      header: "Provisioned",
      align: "right",
      cell: (row) => (
        <span className="font-mono tnum text-[11px] text-ink-muted whitespace-nowrap">
          {formatDateDMY(row.createdAt)}
        </span>
      ),
    },
    {
      header: "Action",
      align: "right",
      cell: (row) => (
        <Button
          variant="outline"
          size="xs"
          onClick={() => navigate(`/super-admin/tenants/${row._id}`)}
          rightIcon={ChevronRight}
        >
          View
        </Button>
      ),
    },
  ];

  const auditColumns = [
    {
      header: "Action Event",
      cell: (row) => (
        <span className="font-mono tnum font-semibold text-ink text-xs">
          {row.action || "MUTATION"}
        </span>
      ),
    },
    {
      header: "Actor",
      cell: (row) => (
        <div>
          <div className="font-medium text-ink">{row.userName || "System"}</div>
          <div className="text-[10px] uppercase tracking-wider text-ink-muted font-bold">
            {row.actorRole || "system"}
          </div>
        </div>
      ),
    },
    {
      header: "Resource",
      cell: (row) => (
        <span className="font-mono tnum text-[11px] text-ink-muted">
          {row.resourceType || "—"}
        </span>
      ),
    },
    {
      header: "IP Address",
      cell: (row) => (
        <span className="font-mono tnum text-[11px] text-ink-muted">
          {row.ip || "127.0.0.1"}
        </span>
      ),
    },
    {
      header: "Timestamp",
      align: "right",
      cell: (row) => (
        <span className="font-mono tnum text-[11px] text-ink-muted whitespace-nowrap">
          {formatDateTime(row.createdAt)}
        </span>
      ),
    },
  ];

  if (error) {
    return (
      <div className="max-w-lg mx-auto py-12">
        <ErrorState
          title="Access Restricted"
          message={error}
          onRetry={() => navigate("/login")}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-line">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-ink">
              Super Admin Platform Console
            </h1>
            <Badge tone="primary">Tier 0 Platform Authority</Badge>
          </div>
          <p className="text-xs text-ink-muted mt-1">
            Global multi-tenant governance, provisioning, enterprise pipeline, and telemetry
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            loading={refreshing}
            leftIcon={RefreshCw}
          >
            Sync Telemetry
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate("/super-admin/tenants")}
            leftIcon={Building2}
          >
            Manage Tenants
          </Button>
        </div>
      </div>

      {/* Key Metric Ledger Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StatTile
          label="Provisioned Campuses"
          value={loading ? "..." : platformStats.tenants.total.toLocaleString()}
          subtitle={`${platformStats.tenants.active} active tenant institutions`}
          icon={Building2}
        />
        <StatTile
          label="Total Enrolled Students"
          value={loading ? "..." : platformStats.users.students.toLocaleString()}
          subtitle="Across all campus deployments"
          icon={Users}
        />
        <StatTile
          label="Faculty & Administrative Staff"
          value={loading ? "..." : platformStats.users.teachers.toLocaleString()}
          subtitle={`${platformStats.users.admins} campus tenant admins`}
          icon={UserCog}
        />
        <StatTile
          label="Curriculum Modules & Records"
          value={loading ? "..." : platformStats.content.subjects.toLocaleString()}
          subtitle={`${platformStats.content.attendanceRecords.toLocaleString()} verified attendance logs`}
          icon={BookOpen}
        />
      </div>

      {/* Platform Navigation Cards */}
      <div>
        <div className="text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-2.5 flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-primary" />
          <span>Platform Core Modules</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {quickActions.map((action, idx) => {
            const IconComponent = action.icon;
            return (
              <div
                key={idx}
                onClick={() => navigate(action.path)}
                className="bg-surface border border-line rounded-panel p-4 hover:border-primary/40 cursor-pointer transition shadow-xs flex flex-col justify-between group focus:outline-none focus:ring-1 focus:ring-primary"
                tabIndex={0}
                role="button"
                onKeyDown={(e) => e.key === "Enter" && navigate(action.path)}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 rounded bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-surface transition-colors">
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <Badge tone="primary">{action.badge}</Badge>
                  </div>
                  <h3 className="text-sm font-bold text-ink group-hover:text-primary transition-colors">
                    {action.title}
                  </h3>
                  <p className="text-xs text-ink-muted mt-1 line-clamp-2">
                    {action.description}
                  </p>
                </div>
                <div className="flex items-center text-xs font-semibold text-primary gap-1 pt-3 border-t border-line mt-3">
                  <span>Open Console</span>
                  <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 cols): Recent Tenants & Audit Ledger */}
        <div className="lg:col-span-8 space-y-6">
          <Panel
            title="Institutional Tenants Roster"
            subtitle="Latest campus instances provisioned on AttendEase"
            tools={
              <Button
                variant="outline"
                size="xs"
                onClick={() => navigate("/super-admin/tenants")}
                rightIcon={ChevronRight}
              >
                View All ({tenants.length})
              </Button>
            }
          >
            <Table
              columns={tenantColumns}
              data={recentTenants}
              keyField="_id"
              loading={loading}
              emptyMessage="No institutional tenants provisioned yet."
            />
          </Panel>

          <Panel
            title="System Audit & Security Ledger"
            subtitle="Real-time administrative mutations, auth actions, and platform telemetry"
            tools={
              <Button
                variant="outline"
                size="xs"
                onClick={fetchAuditLogs}
                loading={auditLogsLoading}
                leftIcon={RefreshCw}
              >
                Refresh
              </Button>
            }
          >
            <Table
              columns={auditColumns}
              data={auditLogs}
              keyField="_id"
              loading={auditLogsLoading}
              emptyMessage="No system audit logs recorded."
            />
          </Panel>
        </div>

        {/* Right Column (4 cols): User Distribution & Leads Summary */}
        <div className="lg:col-span-4 space-y-6">
          {/* User Distribution */}
          <Panel
            title="Global Population"
            subtitle="Distribution of accounts across all tenant institutions"
          >
            <div className="h-44 mb-3">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: "Students", value: platformStats.users.students || 0, color: "rgb(var(--color-primary))" },
                      { name: "Faculty", value: platformStats.users.teachers || 0, color: "rgb(var(--color-secondary))" },
                      { name: "Tenant Admins", value: platformStats.users.admins || 0, color: "#D97706" },
                    ].filter((item) => item.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={68}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {[
                      { color: "rgb(var(--color-primary))" },
                      { color: "rgb(var(--color-secondary))" },
                      { color: "#D97706" },
                    ].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgb(var(--color-surface, 255 255 255))",
                      border: "1px solid rgb(var(--color-line, 229 231 235))",
                      borderRadius: "4px",
                      fontSize: "11px",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2 pt-2 border-t border-line">
              {[
                { label: "Students", value: platformStats.users.students, color: "rgb(var(--color-primary))" },
                { label: "Faculty", value: platformStats.users.teachers, color: "rgb(var(--color-secondary))" },
                { label: "Tenant Admins", value: platformStats.users.admins, color: "#D97706" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: item.color }} />
                    <span className="text-ink-muted">{item.label}</span>
                  </div>
                  <span className="font-mono tnum font-semibold text-ink">
                    {item.value.toLocaleString()}
                  </span>
                </div>
              ))}
              <div className="pt-2 border-t border-line flex justify-between text-xs font-bold">
                <span className="text-ink">Total Platform Users</span>
                <span className="font-mono tnum text-primary">
                  {platformStats.users.total.toLocaleString()}
                </span>
              </div>
            </div>
          </Panel>

          {/* Inbound Inquiries Card */}
          <Panel
            title="Inbound Pipeline"
            subtitle="Campus leads & enterprise demo bookings"
            tools={
              <Button
                variant="outline"
                size="xs"
                onClick={() => navigate("/super-admin/leads")}
                rightIcon={ChevronRight}
              >
                Ledger
              </Button>
            }
          >
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 bg-background border border-line rounded">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                    Total Leads
                  </span>
                  <p className="text-base font-bold font-mono tnum text-ink mt-0.5">
                    {leadStats.total || 0}
                  </p>
                </div>
                <div className="p-2.5 bg-background border border-line rounded">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                    Awaiting Contact
                  </span>
                  <p className="text-base font-bold font-mono tnum text-warning mt-0.5">
                    {leadStats.byStatus?.new || 0}
                  </p>
                </div>
              </div>

              <div className="p-2.5 bg-background border border-line rounded flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-secondary" />
                  <span className="text-ink-muted">Demo Inquiries</span>
                </div>
                <span className="font-mono tnum font-bold text-ink">
                  {leadStats.byType?.demo || 0}
                </span>
              </div>

              <div className="p-2.5 bg-background border border-line rounded flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-primary" />
                  <span className="text-ink-muted">Direct Messages</span>
                </div>
                <span className="font-mono tnum font-bold text-ink">
                  {leadStats.byType?.contact || 0}
                </span>
              </div>

              <Button
                variant="primary"
                size="sm"
                fullWidth
                onClick={() => navigate("/super-admin/leads")}
                leftIcon={MessageSquare}
              >
                Review Admissions Pipeline
              </Button>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
