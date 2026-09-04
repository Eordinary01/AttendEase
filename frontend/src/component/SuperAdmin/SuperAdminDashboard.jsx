// src/components/SuperAdmin/SuperAdminDashboard.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../utils/api";
import { logError } from "../../utils/logger";
import { motion } from "framer-motion";
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
} from "lucide-react";
import Button from "../common/ui/Button";
import Card from "../common/ui/Card";
import StatCard from "../common/ui/StatCard";
import Badge from "../common/ui/Badge";
import EmptyState from "../common/ui/EmptyState";
import DashboardHeader from "../common/ui/DashboardHeader";

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

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchPlatformStats(), fetchTenants(), fetchLeads(), fetchLeadStats(), fetchAuditLogs()]);
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
      if (response.data.success) {
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
      if (response.data.success) {
        setLeadStats(response.data.data || { total: 0, byType: {}, byStatus: {}, recent: [] });
      }
    } catch (err) {
      logError("Fetch Lead Stats", err);
    }
  };

  const handleLeadStatusChange = async (leadId, newStatus) => {
    try {
      const response = await api.patch(`/admin/super/leads/${leadId}`, { status: newStatus });
      if (response.data.success) {
        setLeads(leads.map((l) => (l._id === leadId ? { ...l, status: newStatus } : l)));
        fetchLeadStats();
      }
    } catch (err) {
      logError("Update Lead Status", err);
    }
  };

  const handleLeadDelete = async (leadId) => {
    if (!window.confirm("Delete this lead? This action cannot be undone.")) return;
    try {
      const response = await api.delete(`/admin/super/leads/${leadId}`);
      if (response.data.success) {
        setLeads(leads.filter((l) => l._id !== leadId));
        fetchLeadStats();
      }
    } catch (err) {
      logError("Delete Lead", err);
    }
  };

  const getStatusTone = (status) => {
    switch (status) {
      case "active":
        return "success";
      case "trial":
        return "warning";
      case "suspended":
      case "expired":
        return "danger";
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

  const getLeadTypeIcon = (type) => {
    return type === "demo" ? <Globe className="w-3.5 h-3.5" /> : <Mail className="w-3.5 h-3.5" />;
  };

  const recentTenants = useMemo(() => {
    return [...tenants]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);
  }, [tenants]);

  const statsCards = [
    {
      title: "Total Tenants",
      value: platformStats.tenants.total,
      icon: Building2,
      tone: "primary",
      subtitle: `${platformStats.tenants.active} active institutions`,
    },
    {
      title: "Total Students",
      value: platformStats.users.students,
      icon: Users,
      tone: "secondary",
      subtitle: "Across all campuses",
    },
    {
      title: "Total Faculty",
      value: platformStats.users.teachers,
      icon: UserCog,
      tone: "success",
      subtitle: `${platformStats.users.admins} tenant admins`,
    },
    {
      title: "Total Subjects",
      value: platformStats.content.subjects,
      icon: BookOpen,
      tone: "warning",
      subtitle: `${platformStats.content.attendanceRecords} attendance logs`,
    },
  ];

  const quickActions = [
    {
      title: "Institution Tenants",
      description: "Manage campuses, domains & plan tiers",
      icon: Building2,
      path: "/super-admin/tenants",
      badge: `${platformStats.tenants.total} Total`,
    },
    {
      title: "System Monitoring",
      description: "Live request feed, latency & audit logs",
      icon: Activity,
      path: "/super-admin/monitoring",
      badge: "Real-time",
    },
    {
      title: "Subscription Plans",
      description: "Pricing tiers, quotas & module access",
      icon: Package,
      path: "/super-admin/plans",
      badge: "Billing",
    },
    {
      title: "Support Helpdesk",
      description: "Resolve tickets, bugs & tenant inquiries",
      icon: Headphones,
      path: "/super-admin/support",
      badge: `${platformStats.content.tickets} Tickets`,
    },
  ];

  // Loading Skeleton
  if (loading && !refreshing) {
    return (
      <div className="space-y-6">
        <div className="h-20 bg-surface rounded-2xl border border-line/50 p-5 flex items-center animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-surface rounded-2xl border border-line/50 p-5 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Error UI
  if (error) {
    return (
      <div className="flex items-center justify-center p-6 min-h-[60vh]">
        <div className="bg-surface rounded-2xl border border-line/50 p-8 max-w-md w-full text-center shadow-sm">
          <div className="w-14 h-14 bg-rose-500/10 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-500/20">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-ink mb-1">Access Restricted</h2>
          <p className="text-xs text-ink-soft mb-6">{error}</p>
          <Button onClick={() => navigate("/login")} variant="primary" size="sm">
            Return to Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dashboard Header */}
      <DashboardHeader
        greeting={`Super Admin Platform Console`}
        meta={`Master operations, tenant multi-tenancy & global campus orchestration`}
        actions={
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            loading={refreshing}
            variant="subtle"
            size="sm"
            leftIcon={RefreshCw}
          >
            Refresh
          </Button>
        }
      />

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((card, index) => (
          <StatCard
            key={index}
            label={card.title}
            value={card.value.toLocaleString()}
            icon={card.icon}
            tone={card.tone}
            subtitle={card.subtitle}
          />
        ))}
      </div>

      {/* Quick Actions Bento Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-soft flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-primary" />
            <span>Platform Modules</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action, index) => {
            const IconComponent = action.icon;
            return (
              <div
                key={index}
                onClick={() => navigate(action.path)}
                className="bg-surface border border-line/50 hover:border-primary/40 rounded-2xl p-5 cursor-pointer transition shadow-sm flex flex-col justify-between space-y-4 group"
              >
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                    <IconComponent className="w-5 h-5" />
                  </div>
                  <Badge tone="primary" size="sm">
                    {action.badge}
                  </Badge>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-ink group-hover:text-primary transition-colors">
                    {action.title}
                  </h3>
                  <p className="text-xs text-ink-soft mt-1 leading-relaxed">
                    {action.description}
                  </p>
                </div>

                <div className="flex items-center text-xs font-bold text-primary gap-1 pt-1">
                  <span>Open Console</span>
                  <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Two Column Section: Recent Tenants & Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column — Recent Tenants */}
        <div className="lg:col-span-8 space-y-6">
          <Card padding="md" bordered>
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-line/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink">Recent Tenants</h3>
                  <p className="text-xs text-ink-soft">Latest institutions provisioned on AttendEase</p>
                </div>
              </div>
              <Button
                onClick={() => navigate("/super-admin/tenants")}
                variant="subtle"
                size="sm"
                rightIcon={ChevronRight}
              >
                View All ({tenants.length})
              </Button>
            </div>

            {recentTenants.length > 0 ? (
              <div className="space-y-2.5">
                {recentTenants.map((tenant) => (
                  <div
                    key={tenant._id}
                    onClick={() => navigate(`/super-admin/tenants/${tenant._id}`)}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-background border border-line/50 hover:border-primary/40 rounded-xl transition cursor-pointer gap-3 group"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-xs shrink-0"
                        style={{
                          backgroundColor: tenant.branding?.primaryColor || "#7c3aed",
                        }}
                      >
                        {tenant.name?.[0] || "T"}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-ink group-hover:text-primary transition-colors">
                          {tenant.name}
                        </p>
                        <p className="text-[11px] text-ink-soft font-mono mt-0.5">
                          {tenant.subdomain}.attendease.com
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:self-center">
                      <Badge tone={getStatusTone(tenant.subscription?.status)} size="sm">
                        {tenant.subscription?.status || "trial"}
                      </Badge>
                      <Badge tone={getPlanTone(tenant.subscription?.plan)} size="sm">
                        {tenant.subscription?.plan || "free"}
                      </Badge>
                      <ChevronRight className="w-4 h-4 text-ink-faint group-hover:text-primary transition-colors hidden sm:block ml-1" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No tenants registered"
                description="When new institutions sign up, they will be listed here."
                icon={Building2}
              />
            )}
          </Card>

          {/* System Audit Logs Section */}
          <Card padding="md" bordered>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 mb-4 border-b border-line/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink">System Audit Ledger</h3>
                  <p className="text-xs text-ink-soft">Real-time security events & administrative mutations</p>
                </div>
              </div>
              <Button
                variant="subtle"
                size="sm"
                onClick={fetchAuditLogs}
                leftIcon={RefreshCw}
                disabled={auditLogsLoading}
              >
                Refresh
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-line/50 text-[11px] font-bold text-ink-soft uppercase tracking-wider">
                    <th className="pb-2.5 pr-4">Action</th>
                    <th className="pb-2.5 px-4">Actor</th>
                    <th className="pb-2.5 px-4">Resource</th>
                    <th className="pb-2.5 px-4">IP Address</th>
                    <th className="pb-2.5 pl-4 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/50 text-xs">
                  {auditLogsLoading ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-ink-soft">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary mb-2" />
                        <span>Loading audit ledger...</span>
                      </td>
                    </tr>
                  ) : !Array.isArray(auditLogs) || auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-ink-soft">
                        No audit records found.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log._id} className="hover:bg-background/50 transition-colors">
                        <td className="py-3 pr-4 font-bold text-ink">
                          {log.action}
                        </td>
                        <td className="py-3 px-4 text-ink-soft">
                          <span className="font-semibold text-ink">{log.userName || "System"}</span>
                          <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold">
                            {log.actorRole || "system"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-ink-soft font-mono text-[11px]">
                          {log.resourceType || "N/A"}
                        </td>
                        <td className="py-3 px-4 text-ink-faint font-mono text-[11px]">
                          {log.ip || "127.0.0.1"}
                        </td>
                        <td className="py-3 pl-4 text-right text-ink-soft whitespace-nowrap text-[11px]">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Right Column — User Breakdown & Content Metrics */}
        <div className="lg:col-span-4 space-y-6">
          {/* Users Breakdown */}
          <Card padding="md" bordered>
            <div className="flex items-center gap-2 pb-3 mb-3 border-b border-line/50">
              <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Users className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-xs font-bold text-ink uppercase tracking-wider">User Distribution</h3>
            </div>

            <div className="h-48 mb-3">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Students', value: platformStats.users.students || 0, color: '#3b82f6' },
                      { name: 'Faculty', value: platformStats.users.teachers || 0, color: '#10b981' },
                      { name: 'Admins', value: platformStats.users.admins || 0, color: '#f59e0b' }
                    ].filter(item => item.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {[
                      { color: '#3b82f6' },
                      { color: '#10b981' },
                      { color: '#f59e0b' }
                    ].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: '1px solid var(--color-line, #e2e8f0)', fontSize: '11px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2 pt-1 border-t border-line/50">
              {[
                { label: "Students", value: platformStats.users.students, color: "#3b82f6" },
                { label: "Faculty", value: platformStats.users.teachers, color: "#10b981" },
                { label: "Tenant Admins", value: platformStats.users.admins, color: "#f59e0b" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-ink-soft">{item.label}</span>
                  </div>
                  <span className="font-bold text-ink">{item.value.toLocaleString()}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-line/50 flex justify-between text-xs font-bold">
                <span className="text-ink">Total Platform Users</span>
                <span className="text-primary">{platformStats.users.total.toLocaleString()}</span>
              </div>
            </div>
          </Card>

          {/* Content & Activity */}
          <Card padding="md" bordered>
            <div className="flex items-center gap-2 pb-3 mb-3 border-b border-line/50">
              <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <ClipboardCheck className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-xs font-bold text-ink uppercase tracking-wider">System Activity</h3>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center p-3 bg-background rounded-xl border border-line/50">
                <div className="flex items-center gap-2.5">
                  <BookOpen className="w-4 h-4 text-primary" />
                  <span className="text-xs font-medium text-ink">Total Courses</span>
                </div>
                <span className="text-xs font-bold text-ink">{platformStats.content.subjects.toLocaleString()}</span>
              </div>

              <div className="flex justify-between items-center p-3 bg-background rounded-xl border border-line/50">
                <div className="flex items-center gap-2.5">
                  <ClipboardCheck className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-medium text-ink">Attendance Logs</span>
                </div>
                <span className="text-xs font-bold text-ink">{platformStats.content.attendanceRecords.toLocaleString()}</span>
              </div>

              <div className="flex justify-between items-center p-3 bg-background rounded-xl border border-line/50">
                <div className="flex items-center gap-2.5">
                  <Ticket className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-medium text-ink">Support Tickets</span>
                </div>
                <span className="text-xs font-bold text-ink">{platformStats.content.tickets.toLocaleString()}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Leads Management Section */}
      <Card padding="md" bordered>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 mb-4 border-b border-line/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-ink">Inbound Leads & Demo Inquiries</h2>
              <p className="text-xs text-ink-soft">Prospects from landing page and enterprise contact inquiries</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-56">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-faint" />
              <input
                type="text"
                placeholder="Search leads..."
                value={leadsFilters.search}
                onChange={(e) => setLeadsFilters({ ...leadsFilters, search: e.target.value, page: 1 })}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-line/50 bg-background text-ink outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            <select
              value={leadsFilters.type}
              onChange={(e) => setLeadsFilters({ ...leadsFilters, type: e.target.value, page: 1 })}
              className="px-2.5 py-1.5 text-xs rounded-xl border border-line/50 bg-background text-ink outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All Types</option>
              <option value="contact">Contact</option>
              <option value="demo">Demo</option>
            </select>

            <select
              value={leadsFilters.status}
              onChange={(e) => setLeadsFilters({ ...leadsFilters, status: e.target.value, page: 1 })}
              className="px-2.5 py-1.5 text-xs rounded-xl border border-line/50 bg-background text-ink outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All Status</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="converted">Converted</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>

        {/* Lead Stats Mini Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="p-3 bg-background rounded-xl border border-line/50">
            <span className="text-[11px] font-bold text-ink-soft uppercase">Total Inquiries</span>
            <p className="text-lg font-black text-ink mt-0.5">{leadStats.total}</p>
          </div>
          <div className="p-3 bg-background rounded-xl border border-line/50">
            <span className="text-[11px] font-bold text-ink-soft uppercase">Contact Forms</span>
            <p className="text-lg font-black text-primary mt-0.5">{leadStats.byType?.contact || 0}</p>
          </div>
          <div className="p-3 bg-background rounded-xl border border-line/50">
            <span className="text-[11px] font-bold text-ink-soft uppercase">Demo Bookings</span>
            <p className="text-lg font-black text-secondary mt-0.5">{leadStats.byType?.demo || 0}</p>
          </div>
          <div className="p-3 bg-background rounded-xl border border-line/50">
            <span className="text-[11px] font-bold text-ink-soft uppercase">Awaiting Contact</span>
            <p className="text-lg font-black text-amber-600 mt-0.5">{leadStats.byStatus?.new || 0}</p>
          </div>
        </div>

        {/* Leads Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-line/50 text-[11px] font-bold text-ink-soft uppercase tracking-wider">
                <th className="pb-2.5 pr-4">Prospect</th>
                <th className="pb-2.5 px-4">Type</th>
                <th className="pb-2.5 px-4">Institution</th>
                <th className="pb-2.5 px-4">Contact</th>
                <th className="pb-2.5 px-4">Status</th>
                <th className="pb-2.5 px-4">Date</th>
                <th className="pb-2.5 pl-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/50 text-xs">
              {leadsLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-ink-soft">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" />
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-ink-soft">
                    No lead inquiries found.
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead._id} className="hover:bg-background/50 transition-colors">
                    <td className="py-3 pr-4">
                      <div>
                        <p className="font-bold text-ink">{lead.name}</p>
                        <p className="text-[11px] text-ink-soft">{lead.email}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge tone={lead.type === "demo" ? "secondary" : "primary"} size="sm">
                        {lead.type === "demo" ? "Demo" : "Contact"}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-ink">{lead.institutionName || "—"}</p>
                      {lead.studentCount && (
                        <p className="text-[11px] text-ink-faint">{lead.studentCount} students</p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-ink-soft text-[11px]">
                      {lead.phone || "—"}
                    </td>
                    <td className="py-3 px-4">
                      <select
                        value={lead.status}
                        onChange={(e) => handleLeadStatusChange(lead._id, e.target.value)}
                        disabled={leadsLoading}
                        className="px-2 py-1 text-[11px] font-bold rounded-lg border border-line/50 bg-surface text-ink outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                      >
                        <option value="new">New</option>
                        <option value="contacted">Contacted</option>
                        <option value="converted">Converted</option>
                        <option value="closed">Closed</option>
                      </select>
                    </td>
                    <td className="py-3 px-4 text-ink-soft text-[11px] whitespace-nowrap">
                      {new Date(lead.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 pl-4 text-right">
                      <button
                        onClick={() => handleLeadDelete(lead._id)}
                        disabled={leadsLoading}
                        className="p-1 text-ink-faint hover:text-rose-600 transition cursor-pointer"
                        title="Delete lead"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-line/50 text-xs text-ink-soft">
            <span>
              Page {leadsPage} of {leadStats.total > 0 ? Math.ceil(leadStats.total / 20) : 1}
            </span>
            <div className="flex gap-2">
              <Button
                variant="subtle"
                size="sm"
                onClick={() => setLeadsPage((p) => Math.max(1, p - 1))}
                disabled={leadsLoading || leadsPage <= 1}
              >
                Previous
              </Button>
              <Button
                variant="subtle"
                size="sm"
                onClick={() => setLeadsPage((p) => p + 1)}
                disabled={leadsLoading || leadsPage * 20 >= leadStats.total}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default SuperAdminDashboard;
