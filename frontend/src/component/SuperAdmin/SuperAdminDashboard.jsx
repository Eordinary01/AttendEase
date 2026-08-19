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
  CheckCircle,
  XCircle,
  MoreVertical,
  Filter,
  Loader2,
} from "lucide-react";
import Button from "../common/ui/Button";
import Card from "../common/ui/Card";
import StatCard from "../common/ui/StatCard";
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
    await Promise.all([fetchPlatformStats(), fetchTenants(), fetchLeads(), fetchLeadStats()]);
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
        fetchLeadStats(); // Refresh stats
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
        return "danger";
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

  const getLeadStatusTone = (status) => {
    switch (status) {
      case "new":
        return "warning";
      case "contacted":
        return "primary";
      case "converted":
        return "success";
      case "closed":
        return "neutral";
      default:
        return "neutral";
    }
  };

  const getLeadTypeIcon = (type) => {
    return type === "demo" ? <Globe className="w-4 h-4" /> : <Mail className="w-4 h-4" />;
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
      subtitle: `${platformStats.tenants.active} active`,
    },
    {
      title: "Total Students",
      value: platformStats.users.students,
      icon: Users,
      tone: "secondary",
      subtitle: "Across all tenants",
    },
    {
      title: "Total Teachers",
      value: platformStats.users.teachers,
      icon: UserCog,
      tone: "success",
      subtitle: `${platformStats.users.admins} admins`,
    },
    {
      title: "Total Subjects",
      value: platformStats.content.subjects,
      icon: BookOpen,
      tone: "warning",
      subtitle: `${platformStats.content.attendanceRecords} attendance records`,
    },
  ];

  const quickActions = [
    {
      title: "All Tenants",
      description: "View & manage all institutions",
      icon: <Building2 className="w-6 h-6" />,
      path: "/super-admin/tenants",
      stats: `${platformStats.tenants.total} total`,
    },
    {
      title: "Platform Stats",
      description: "Detailed analytics & metrics",
      icon: <TrendingUp className="w-6 h-6" />,
      path: "/super-admin/tenants",
      stats: "Live data",
    },
  ];

  // Loading Skeleton
  if (loading && !refreshing) {
    return (
      <div className="space-y-8">
        <div className="h-32 bg-surface rounded-2xl shadow-card border border-line p-6 flex flex-col justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-line via-background to-line animate-pulse"></div>
          <div className="h-6 w-32 bg-line rounded-md animate-pulse mb-3 relative z-10"></div>
          <div className="h-8 w-64 bg-line rounded-md animate-pulse relative z-10"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-surface rounded-2xl p-6 shadow-card border border-line">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-background rounded-xl animate-pulse"></div>
                <div className="w-10 h-4 bg-background rounded-md animate-pulse"></div>
              </div>
              <div className="h-4 w-24 bg-background rounded mb-3 animate-pulse"></div>
              <div className="h-8 w-32 bg-line rounded animate-pulse mb-2"></div>
              <div className="h-3 w-40 bg-background rounded animate-pulse"></div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="bg-surface rounded-2xl p-6 shadow-card border border-line flex flex-col">
              <div className="flex justify-between mb-4">
                <div className="w-12 h-12 bg-background rounded-xl animate-pulse"></div>
                <div className="w-6 h-6 bg-background rounded-full animate-pulse"></div>
              </div>
              <div className="h-5 w-32 bg-line rounded mb-2 animate-pulse"></div>
              <div className="h-4 w-48 bg-background rounded animate-pulse"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error UI
  if (error) {
    return (
      <div className="flex items-center justify-center p-6 min-h-[60vh]">
        <div className="bg-surface rounded-2xl shadow-pop p-8 max-w-md w-full text-center border border-line">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-ink mb-2">Access Denied</h2>
          <p className="text-ink-soft mb-6">{error}</p>
          <Button
            onClick={() => navigate("/login")}
            variant="primary"
          >
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="rounded-3xl p-8 text-white relative overflow-hidden shadow-pop bg-gradient-to-br from-primary-dark via-secondary-dark to-primary-dark"
      >
        <div className="absolute inset-0"></div>
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-white opacity-5 blur-3xl"></div>

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-white bg-white/10 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/20">
                Super Admin
              </span>
            </div>
            <h1 className="text-3xl font-extrabold mb-2 tracking-tight text-white">
              Welcome back, {userName || "Super Admin"}
            </h1>
            <p className="text-white/80 font-medium">
              Platform-wide management dashboard
            </p>
          </div>
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            loading={refreshing}
            variant="ghost"
            leftIcon={RefreshCw}
            className="bg-white/10 hover:bg-white/20 border border-white/20 text-white"
          >
            Refresh Data
          </Button>
        </div>
      </motion.div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-bold text-ink mb-6 flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {quickActions.map((action, index) => (
            <QuickActionCard
              key={index}
              {...action}
              onClick={() => navigate(action.path)}
            />
          ))}
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column — Recent Tenants */}
        <div className="lg:col-span-2 space-y-6">
          <Card padding="lg">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                <div className="p-2 bg-primary-soft rounded-lg">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                Recent Tenants
              </h3>
              <Button
                onClick={() => navigate("/super-admin/tenants")}
                variant="subtle"
                size="sm"
                rightIcon={ChevronRight}
              >
                View All
              </Button>
            </div>

            {recentTenants.length > 0 ? (
              <motion.div
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: { opacity: 0 },
                  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
                }}
                className="space-y-3"
              >
                {recentTenants.map((tenant) => (
                  <motion.div
                    variants={{
                      hidden: { opacity: 0, x: -20 },
                      visible: { opacity: 1, x: 0 }
                    }}
                    key={tenant._id}
                    onClick={() =>
                      navigate(`/super-admin/tenants/${tenant._id}`)
                    }
                    className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-background border border-transparent hover:border-line rounded-xl transition-all cursor-pointer shadow-sm hover:shadow-cardhover"
                  >
                    <div className="flex items-center gap-4 mb-3 sm:mb-0">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-sm"
                        style={{
                          backgroundColor: tenant.branding?.primaryColor || "#6366f1",
                        }}
                      >
                        {tenant.name?.[0] || "T"}
                      </div>
                      <div>
                        <p className="font-bold text-ink group-hover:text-primary transition-colors">
                          {tenant.name}
                        </p>
                        <p className="text-sm text-ink-soft font-medium">
                          {tenant.subdomain} •{" "}
                          <span className="text-ink-faint">
                            {tenant.stats?.totalStudents || 0} students, {tenant.stats?.totalTeachers || 0} teachers
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge tone={getStatusTone(tenant.subscription?.status)} dot>
                        {tenant.subscription?.status || "trial"}
                      </Badge>
                      <Badge tone={getPlanTone(tenant.subscription?.plan)}>
                        {tenant.subscription?.plan || "free"}
                      </Badge>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-surface border border-line group-hover:border-primary-surface group-hover:bg-primary-soft transition-colors ml-2 hidden sm:flex">
                        <ChevronRight className="w-4 h-4 text-ink-faint group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <EmptyState
                title="No tenants yet"
                description="No tenants registered yet."
                icon={Building2}
              />
            )}
          </Card>
        </div>

        {/* Right Column — Additional Stats */}
        <div className="space-y-6">
          {/* Users Breakdown */}
          <Card padding="lg">
            <h3 className="text-lg font-bold text-ink mb-6 flex items-center gap-2">
              <div className="p-2 bg-primary-soft rounded-lg">
                <Users className="w-5 h-5 text-primary" />
              </div>
              User Breakdown
            </h3>

            <div className="h-64 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Students', value: platformStats.users.students || 0, color: '#3b82f6' },
                      { name: 'Teachers', value: platformStats.users.teachers || 0, color: '#10b981' },
                      { name: 'Admins', value: platformStats.users.admins || 0, color: '#f59e0b' }
                    ].filter(item => item.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {
                      [
                        { name: 'Students', value: platformStats.users.students || 0, color: '#3b82f6' },
                        { name: 'Teachers', value: platformStats.users.teachers || 0, color: '#10b981' },
                        { name: 'Admins', value: platformStats.users.admins || 0, color: '#f59e0b' }
                      ].filter(item => item.value > 0).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))
                    }
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px -2px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ fontWeight: 'bold' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-3">
              {[
                { label: "Students", value: platformStats.users.students, color: "#3b82f6" },
                { label: "Teachers", value: platformStats.users.teachers, color: "#10b981" },
                { label: "Admins", value: platformStats.users.admins, color: "#f59e0b" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: item.color }} />
                    <span className="text-ink-soft font-medium">{item.label}</span>
                  </div>
                  <span className="font-bold text-ink">
                    {item.value.toLocaleString()}
                  </span>
                </div>
              ))}
              <div className="pt-4 mt-2 border-t border-line">
                <div className="flex justify-between text-sm">
                  <span className="text-ink font-bold">Total Platform Users</span>
                  <span className="text-primary font-black">
                    {platformStats.users.total.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* Content Stats */}
          <Card padding="lg">
            <h3 className="text-lg font-bold text-ink mb-4 flex items-center gap-2">
              <div className="p-2 bg-primary-soft rounded-lg">
                <ClipboardCheck className="w-5 h-5 text-primary" />
              </div>
              Content & Activity
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-4 bg-background rounded-xl hover:bg-line/50 transition-colors">
                <div className="flex items-center gap-3">
                  <BookOpen className="w-5 h-5 text-primary" />
                  <span className="text-ink-soft font-medium text-sm">Subjects</span>
                </div>
                <span className="font-bold text-ink">
                  {platformStats.content.subjects.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center p-4 bg-background rounded-xl hover:bg-line/50 transition-colors">
                <div className="flex items-center gap-3">
                  <ClipboardCheck className="w-5 h-5 text-emerald-500" />
                  <span className="text-ink-soft font-medium text-sm">Attendance Records</span>
                </div>
                <span className="font-bold text-ink">
                  {platformStats.content.attendanceRecords.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center p-4 bg-background rounded-xl hover:bg-line/50 transition-colors">
                <div className="flex items-center gap-3">
                  <Ticket className="w-5 h-5 text-amber-500" />
                  <span className="text-ink-soft font-medium text-sm">Support Tickets</span>
                </div>
                <span className="font-bold text-ink">
                  {platformStats.content.tickets.toLocaleString()}
                </span>
              </div>
            </div>
          </Card>

          {/* Tenant Status Overview */}
          <Card padding="lg">
            <h3 className="text-lg font-bold text-ink mb-4 flex items-center gap-2">
              <div className="p-2 bg-primary-soft rounded-lg">
                <Eye className="w-5 h-5 text-primary" />
              </div>
              Tenant Status
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3">
                <span className="text-ink-soft font-medium text-sm flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
                  Active
                </span>
                <span className="font-bold text-emerald-600">
                  {platformStats.tenants.active}
                </span>
              </div>
              <div className="flex justify-between items-center p-3">
                <span className="text-ink-soft font-medium text-sm flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"></span>
                  Inactive / Suspended
                </span>
                <span className="font-bold text-red-600">
                  {platformStats.tenants.total - platformStats.tenants.active}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Leads Management Section */}
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-ink flex items-center gap-2">
              <div className="p-2 bg-purple-soft rounded-lg">
                <MessageSquare className="w-5 h-5 text-purple-600" />
              </div>
              Leads Management
            </h2>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
                <input
                  type="text"
                  placeholder="Search leads..."
                  value={leadsFilters.search}
                  onChange={(e) => setLeadsFilters({ ...leadsFilters, search: e.target.value, page: 1 })}
                  className="pl-10 pr-10 py-2 w-64 border border-line rounded-lg bg-surface focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                />
              </div>
              <select
                value={leadsFilters.type}
                onChange={(e) => setLeadsFilters({ ...leadsFilters, type: e.target.value, page: 1 })}
                className="px-4 py-2 border border-line rounded-lg bg-surface focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
              >
                <option value="">All Types</option>
                <option value="contact">Contact</option>
                <option value="demo">Demo</option>
              </select>
              <select
                value={leadsFilters.status}
                onChange={(e) => setLeadsFilters({ ...leadsFilters, status: e.target.value, page: 1 })}
                className="px-4 py-2 border border-line rounded-lg bg-surface focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
              >
                <option value="">All Status</option>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="converted">Converted</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>

          {/* Lead Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <StatCard
              label="Total Leads"
              value={leadStats.total}
              icon={MessageSquare}
              tone="primary"
              subtitle="All time"
            />
            <StatCard
              label="Contact Requests"
              value={leadStats.byType?.contact || 0}
              icon={Mail}
              tone="secondary"
              subtitle="Contact form"
            />
            <StatCard
              label="Demo Requests"
              value={leadStats.byType?.demo || 0}
              icon={Globe}
              tone="warning"
              subtitle="Demo requests"
            />
            <StatCard
              label="New Leads"
              value={leadStats.byStatus?.new || 0}
              icon={AlertCircle}
              tone="warning"
              subtitle="Need attention"
            />
          </div>

          {/* Leads Table */}
          <Card padding="lg">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-ink-soft border-b border-line">
                    <th className="pb-3 font-semibold text-ink">Lead</th>
                    <th className="pb-3 font-semibold text-ink">Type</th>
                    <th className="pb-3 font-semibold text-ink">Institution</th>
                    <th className="pb-3 font-semibold text-ink">Contact</th>
                    <th className="pb-3 font-semibold text-ink">Status</th>
                    <th className="pb-3 font-semibold text-ink">Date</th>
                    <th className="pb-3 font-semibold text-ink text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {leadsLoading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                      </td>
                    </tr>
                  ) : leads.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-ink-soft">
                        No leads found
                      </td>
                    </tr>
                  ) : (
                    leads.map((lead) => (
                      <tr key={lead._id} className="hover:bg-background/50 transition-colors">
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-purple-soft flex items-center justify-center text-purple-600">
                              {getLeadTypeIcon(lead.type)}
                            </div>
                            <div>
                              <p className="font-semibold text-ink">{lead.name}</p>
                              <p className="text-xs text-ink-soft">{lead.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4">
                          <Badge tone={lead.type === "demo" ? "secondary" : "primary"} size="sm">
                            {getLeadTypeIcon(lead.type)}
                            {lead.type === "demo" ? "Demo" : "Contact"}
                          </Badge>
                        </td>
                        <td className="py-4">
                          <p className="font-medium text-ink">{lead.institutionName}</p>
                          {lead.studentCount && (
                            <p className="text-xs text-ink-soft">{lead.studentCount} students</p>
                          )}
                        </td>
                        <td className="py-4">
                          {lead.phone && <p className="text-sm text-ink-soft flex items-center gap-1"><Phone className="w-3 h-3" /> {lead.phone}</p>}
                        </td>
                        <td className="py-4">
                          <select
                            value={lead.status}
                            onChange={(e) => handleLeadStatusChange(lead._id, e.target.value)}
                            disabled={leadsLoading}
                            className="px-2 py-1 text-xs rounded-full border border-line bg-surface focus:ring-2 focus:ring-primary focus:border-transparent cursor-pointer"
                          >
                            <option value="new">New</option>
                            <option value="contacted">Contacted</option>
                            <option value="converted">Converted</option>
                            <option value="closed">Closed</option>
                          </select>
                        </td>
                        <td className="py-4 text-sm text-ink-soft">
                          {new Date(lead.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-4 text-right">
                          <button
                            onClick={() => handleLeadDelete(lead._id)}
                            disabled={leadsLoading}
                            className="p-2 text-ink-soft hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete lead"
                          >
                            <XCircle className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-line">
                <p className="text-sm text-ink-soft">
                  Page {leadsPage} of {leadStats.total > 0 ? Math.ceil(leadStats.total / 20) : 1}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="subtle"
                    size="sm"
                    onClick={() => setLeadsPage((p) => Math.max(1, p - 1))}
                    disabled={leadsLoading || leadsPage <= 1}
                    leftIcon={ChevronRight}
                    className="transform rotate-180"
                  >
                    Previous
                  </Button>
                  <Button
                    variant="subtle"
                    size="sm"
                    onClick={() => setLeadsPage((p) => p + 1)}
                    disabled={leadsLoading || leadsPage * 20 >= leadStats.total}
                    rightIcon={ChevronRight}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* System Audit Logs Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-8"
        >
          <Card className="p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-ink flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  Compliance & Security Audit Logs
                </h2>
                <p className="text-sm text-ink-soft">
                  Real-time system mutations and security events
                </p>
              </div>
              <Button
                variant="subtle"
                size="sm"
                onClick={fetchAuditLogs}
                leftIcon={RefreshCw}
                disabled={auditLogsLoading}
              >
                Refresh Logs
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-line bg-background/50 text-xs font-semibold text-ink-soft uppercase tracking-wider">
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Actor / Role</th>
                    <th className="py-3 px-4">Resource</th>
                    <th className="py-3 px-4">Request ID & IP</th>
                    <th className="py-3 px-4">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-sm">
                  {auditLogsLoading ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-ink-soft">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                        Loading audit logs...
                      </td>
                    </tr>
                  ) : !Array.isArray(auditLogs) || auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-ink-soft">
                        No audit log entries recorded yet.
                      </td>
                    </tr>
                  ) : (
                    (Array.isArray(auditLogs) ? auditLogs : []).map((log) => (
                      <tr key={log._id} className="hover:bg-background/50 transition-colors">
                        <td className="py-3 px-4 font-semibold text-ink">
                          {log.action}
                        </td>
                        <td className="py-3 px-4 text-ink-soft">
                          <span className="font-medium text-ink">{log.userName || "System"}</span>
                          <span className="ml-2 text-xs px-2 py-0.5 rounded bg-primary-soft text-primary font-bold">{log.actorRole || "N/A"}</span>
                        </td>
                        <td className="py-3 px-4 text-ink-soft">
                          {log.resourceType || "N/A"}
                        </td>
                        <td className="py-3 px-4 text-xs font-mono text-ink-soft">
                          <div>IP: {log.ip || "N/A"}</div>
                          <div className="text-ink-faint truncate max-w-[150px]">{log.requestId || ""}</div>
                        </td>
                        <td className="py-3 px-4 text-xs text-ink-soft whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>

  );
};

// ===== Quick Action Card Component =====
const QuickActionCard = ({
  title,
  description,
  icon,
  stats,
  onClick,
}) => {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
      }}
      whileHover={{ y: -5, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="bg-surface rounded-2xl shadow-card border border-line p-6 transition-all duration-300 cursor-pointer group hover:border-primary-surface hover:shadow-cardhover"
    >
      <div className="flex items-start justify-between mb-6">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-sm bg-primary-soft text-primary"
        >
          {icon}
        </div>
        <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center group-hover:bg-primary-soft transition-colors duration-300">
          <ChevronRight className="w-5 h-5 text-ink-faint group-hover:text-primary transition-colors" />
        </div>
      </div>
      <h3 className="text-lg font-bold text-ink mb-2 group-hover:text-primary transition-colors">{title}</h3>
      <p className="text-sm text-ink-soft mb-4 leading-relaxed">{description}</p>
      <div className="inline-block px-3 py-1 bg-background rounded-lg text-xs font-semibold text-ink-soft group-hover:bg-primary-soft group-hover:text-primary-dark transition-colors">
        {stats}
      </div>
    </motion.div>
  );
};

export default SuperAdminDashboard;
