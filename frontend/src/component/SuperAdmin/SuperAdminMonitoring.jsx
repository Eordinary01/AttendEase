// src/component/SuperAdmin/SuperAdminMonitoring.jsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { formatDistanceToNow, format } from "date-fns";
import {
  Activity,
  RefreshCw,
  Radio,
  AlertCircle,
  Clock,
  Users,
  Building2,
  Search,
  Eraser,
  Zap,
  Globe,
  Server,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from "recharts";
import api from "../../utils/api";
import { logError } from "../../utils/logger";
import PageHeader from "../common/ui/PageHeader";
import StatCard from "../common/ui/StatCard";
import Card from "../common/ui/Card";
import Badge from "../common/ui/Badge";
import Button from "../common/ui/Button";
import Table from "../common/ui/Table";
import { Input, Select } from "../common/ui/Input";
import EmptyState from "../common/ui/EmptyState";

const methodTone = {
  GET: "success",
  POST: "primary",
  PUT: "warning",
  PATCH: "info",
  DELETE: "danger",
  ACTION: "secondary",
};

const statusTone = (code) => {
  if (!code) return "neutral";
  if (code >= 500) return "danger";
  if (code >= 400) return "warning";
  if (code >= 300) return "info";
  return "success";
};

const prettyMethod = (m) => (m === "ACTION" ? "EVENT" : m);

const SuperAdminMonitoring = () => {
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 50, pages: 1 });
  const [tenants, setTenants] = useState([]);
  const [feed, setFeed] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [error, setError] = useState(null);
  const [live, setLive] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const [filters, setFilters] = useState({
    tenantId: "",
    method: "",
    statusGroup: "",
    endpoint: "",
    description: "",
    from: "",
    to: "",
  });

  const lastSeen = useRef(Date.now());
  const feedSeen = useRef(new Set());

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get("/admin/super/logs/stats?hours=24");
      if (res.data.success) {
        setStats(res.data.data);
        setError(null);
      }
    } catch (err) {
      logError("Fetch Activity Stats", err);
      setError("Failed to load activity stats. Check that the backend is running.");
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const fetchLogs = useCallback(async (page = 1) => {
    setLoadingLogs(true);
    try {
      const params = new URLSearchParams({ page, limit: pagination.limit });
      if (filters.tenantId) params.set("tenantId", filters.tenantId);
      if (filters.method) params.set("method", filters.method);
      if (filters.statusGroup) params.set("statusGroup", filters.statusGroup);
      if (filters.endpoint) params.set("endpoint", filters.endpoint);
      if (filters.description) params.set("description", filters.description);
      if (filters.from) params.set("from", new Date(filters.from).toISOString());
      if (filters.to) params.set("to", new Date(filters.to).toISOString());

      const res = await api.get(`/admin/super/logs?${params.toString()}`);
      if (res.data.success) {
        setLogs(res.data.data.logs);
        setPagination(res.data.data.pagination);
        setError(null);
      }
    } catch (err) {
      logError("Fetch Logs", err);
      setError("Failed to load activity logs.");
    } finally {
      setLoadingLogs(false);
    }
  }, [filters, pagination.limit]);

  const fetchTenants = useCallback(async () => {
    try {
      const res = await api.get("/admin/super/logs/tenants");
      if (res.data.success) setTenants(res.data.data);
    } catch (err) {
      logError("Fetch Log Tenants", err);
    }
  }, []);

  const fetchFeed = useCallback(async (since) => {
    try {
      const res = await api.get(`/admin/super/logs/recent?since=${since != null ? since : lastSeen.current}`);
      if (res.data.success && Array.isArray(res.data.data.logs)) {
        lastSeen.current = res.data.data.now || Date.now();
        const fresh = res.data.data.logs.filter((l) => !feedSeen.current.has(l._id));
        fresh.forEach((l) => feedSeen.current.add(l._id));
        if (fresh.length > 0) {
          setFeed((prev) => [...fresh, ...prev].slice(0, 60));
        }
      }
    } catch (err) {
      /* ignore transient polling errors */
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchStats();
    fetchLogs(1);
    fetchTenants();
    fetchFeed(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live feed polling
  useEffect(() => {
    if (!live) return undefined;
    const interval = setInterval(fetchFeed, 5000);
    return () => clearInterval(interval);
  }, [live, fetchFeed]);

  // Auto-refresh stats + logs
  useEffect(() => {
    if (!autoRefresh) return undefined;
    const interval = setInterval(() => {
      fetchStats();
      fetchLogs(pagination.page);
    }, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchStats, fetchLogs, pagination.page]);

  const handleRefresh = () => {
    fetchStats();
    fetchLogs(pagination.page);
    fetchFeed();
  };

  const handleApplyFilters = () => {
    lastSeen.current = Date.now();
    feedSeen.current = new Set();
    setFeed([]);
    fetchLogs(1);
    fetchFeed(0);
  };

  const handleClearFilters = () => {
    setFilters({ tenantId: "", method: "", statusGroup: "", endpoint: "", description: "", from: "", to: "" });
    lastSeen.current = Date.now();
    feedSeen.current = new Set();
    setFeed([]);
    setTimeout(() => fetchLogs(1), 0);
    fetchFeed(0);
  };

  const changeFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  const columns = useMemo(
    () => [
      {
        header: "Time",
        cell: (row) => (
          <div>
            <p className="font-semibold text-ink">{format(new Date(row.createdAt), "h:mm:ss a")}</p>
            <p className="text-xs text-ink-faint">{formatDistanceToNow(new Date(row.createdAt), { addSuffix: true })}</p>
          </div>
        ),
      },
      {
        header: "Tenant",
        cell: (row) =>
          row.tenantId ? (
            <div>
              <p className="font-semibold text-ink">{row.tenantName}</p>
              <p className="text-xs text-ink-faint">{row.tenantSubdomain}</p>
            </div>
          ) : (
            <Badge tone="secondary">Platform</Badge>
          ),
      },
      {
        header: "User",
        cell: (row) =>
          row.userId ? (
            <div>
              <p className="font-semibold text-ink">{row.userName}</p>
              <p className="text-xs text-ink-faint capitalize">{row.userRole}</p>
            </div>
          ) : (
            <span className="text-ink-faint">Anonymous</span>
          ),
      },
      {
        header: "Method",
        cell: (row) => <Badge tone={methodTone[row.method] || "neutral"}>{prettyMethod(row.method)}</Badge>,
      },
      {
        header: "Activity",
        cell: (row) => (
          <div className="max-w-[260px]">
            <p className="font-semibold text-ink truncate" title={row.description}>
              {row.description}
            </p>
            <p className="text-xs text-ink-faint truncate" title={row.endpoint}>
              {row.endpoint}
            </p>
          </div>
        ),
      },
      {
        header: "Status",
        cell: (row) => <Badge tone={statusTone(row.statusCode)}>{row.statusCode}</Badge>,
      },
      {
        header: "Duration",
        cell: (row) => <span className="text-ink-soft tabular-nums">{row.responseTime != null ? `${row.responseTime}ms` : "—"}</span>,
      },
      {
        header: "IP",
        cell: (row) => <span className="text-ink-faint text-xs">{row.ipAddress || "—"}</span>,
      },
    ],
    []
  );

  const chartData = useMemo(() => stats?.series || [], [stats]);

  const methods = useMemo(() => {
    if (!stats?.methods) return [];
    return Object.entries(stats.methods)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [stats]);

  const statusData = useMemo(() => {
    if (!stats?.status) return [];
    const order = ["2xx", "3xx", "4xx", "5xx"];
    const colors = { "2xx": "bg-emerald-500", "3xx": "bg-sky-500", "4xx": "bg-amber-500", "5xx": "bg-red-500" };
    const total = order.reduce((sum, k) => sum + (stats.status[k] || 0), 0) || 1;
    return order.map((k) => ({ key: k, count: stats.status[k] || 0, pct: ((stats.status[k] || 0) / total) * 100, color: colors[k] }));
  }, [stats]);

  const maxMethod = Math.max(1, ...methods.map((m) => m.count));
  const maxEndpoint = Math.max(1, ...(stats?.topEndpoints || []).map((e) => e.count));
  const maxTenant = Math.max(1, ...(stats?.topTenants || []).map((t) => t.count));

  const statsCards = [
    {
      label: "Requests (24h)",
      value: stats ? stats.total.toLocaleString() : "—",
      icon: Activity,
      tone: "primary",
      subtitle: "Total API activity",
    },
    {
      label: "Errors (4xx/5xx)",
      value: stats ? stats.errors.toLocaleString() : "—",
      icon: AlertCircle,
      tone: "danger",
      subtitle: stats ? `${stats.errorRate}% error rate` : "",
    },
    {
      label: "Avg Response",
      value: stats ? `${stats.avgResponseTime}ms` : "—",
      icon: Zap,
      tone: "success",
      subtitle: stats ? `max ${stats.maxResponseTime}ms` : "",
    },
    {
      label: "Active Tenants",
      value: stats ? stats.activeTenants.toLocaleString() : "—",
      icon: Building2,
      tone: "secondary",
      subtitle: "Active in last 30 min",
    },
    {
      label: "Active Users",
      value: stats ? stats.activeUsers.toLocaleString() : "—",
      icon: Users,
      tone: "warning",
      subtitle: "Users in last 30 min",
    },
    {
      label: "Live Feed",
      value: feed.length,
      icon: Radio,
      tone: "info",
      subtitle: live ? "Streaming live" : "Paused",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Monitoring Dashboard"
        subtitle="Real-time activity across all tenants — every request, event and error."
        icon={Activity}
        actions={
          <>
            <button
              onClick={() => setLive((prev) => !prev)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                live
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-surface text-ink-soft border-line"
              }`}
            >
              <span className="relative flex h-2.5 w-2.5">
                {live && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                )}
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${live ? "bg-emerald-500" : "bg-ink-faint"}`} />
              </span>
              {live ? "LIVE" : "PAUSED"}
            </button>
            <Button variant="outline" leftIcon={RefreshCw} onClick={handleRefresh}>
              Refresh
            </Button>
            <Button
              variant={autoRefresh ? "subtle" : "outline"}
              onClick={() => setAutoRefresh((prev) => !prev)}
            >
              Auto-refresh {autoRefresh ? "ON" : "OFF"}
            </Button>
          </>
        }
      />

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 text-sm font-medium">
          {error}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        {statsCards.map((card, idx) => (
          <StatCard key={idx} label={card.label} value={card.value} icon={card.icon} tone={card.tone} subtitle={card.subtitle} />
        ))}
      </div>

      {/* Chart + Live feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card padding="lg" className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-ink flex items-center gap-2">
              <div className="p-2 bg-primary-soft rounded-lg">
                <Server className="w-5 h-5 text-primary" />
              </div>
              Activity — Last 24 Hours
            </h3>
            <Badge tone="primary">{stats?.total?.toLocaleString() || 0} requests</Badge>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line, #e5e7eb)" vertical={false} />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 11, fill: "var(--color-ink-faint, #9ca3af)" }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--color-line, #e5e7eb)" }}
                  interval={Math.ceil(chartData.length / 12) || 1}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--color-ink-faint, #9ca3af)" }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <RechartsTooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid var(--color-line, #e5e7eb)", boxShadow: "0 4px 20px -2px rgb(0 0 0 / 0.1)" }}
                  labelFormatter={(label) => `Hour ${label}`}
                />
                <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} fill="url(#activityGradient)" name="Requests" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Live feed */}
        <Card padding="none" className="overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-line">
            <h3 className="text-lg font-bold text-ink flex items-center gap-2">
              <div className={`p-2 rounded-lg ${live ? "bg-emerald-50" : "bg-background"}`}>
                <Radio className={`w-5 h-5 ${live ? "text-emerald-600" : "text-ink-faint"}`} />
              </div>
              Live Activity
            </h3>
            <Badge tone={live ? "success" : "neutral"} dot>
              {live ? "Streaming" : "Paused"}
            </Badge>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[340px] px-4 py-3 space-y-2">
            {feed.length === 0 && !loadingStats && (
              <EmptyState
                title="No activity yet"
                description="Live events will appear here as tenants use the platform."
                icon={Activity}
              />
            )}
            {feed.map((item) => (
              <div
                key={item._id}
                className="group flex items-start gap-3 p-3 rounded-xl border border-line/60 bg-background/50 hover:bg-background transition-colors"
              >
                <span
                  className={`mt-0.5 shrink-0 w-2 h-2 rounded-full ${
                    item.statusCode >= 400 ? "bg-red-500" : item.statusCode >= 300 ? "bg-amber-500" : "bg-emerald-500"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink truncate">{item.description}</p>
                  <p className="text-xs text-ink-faint truncate mt-0.5">
                    <span className="font-medium">{item.tenantName}</span>
                    {item.userName !== "Anonymous" && (
                      <>
                        {" · "}
                        {item.userName}
                      </>
                    )}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge tone={methodTone[item.method] || "neutral"}>{prettyMethod(item.method)}</Badge>
                    <span className="text-[11px] text-ink-faint">
                      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
                <Badge tone={statusTone(item.statusCode)}>{item.statusCode}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Logs table */}
      <Card padding="none" className="overflow-hidden">
        <div className="px-5 py-4 border-b border-line">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
            <h3 className="text-lg font-bold text-ink flex items-center gap-2">
              <div className="p-2 bg-primary-soft rounded-lg">
                <Activity className="w-5 h-5 text-primary" />
              </div>
              Activity Logs
              <Badge tone="neutral">{pagination.total.toLocaleString()} total</Badge>
            </h3>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" leftIcon={RefreshCw} onClick={() => fetchLogs(pagination.page)}>
                Reload
              </Button>
              <Button variant="ghost" size="sm" leftIcon={Eraser} onClick={handleClearFilters}>
                Clear
              </Button>
              <Button size="sm" leftIcon={Search} onClick={handleApplyFilters}>
                Apply
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <Select label="Tenant" value={filters.tenantId} onChange={(e) => changeFilter("tenantId", e.target.value)}>
              <option value="">All tenants</option>
              <option value="platform">Platform (super admin)</option>
              {tenants.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name} — {t.activityCount} reqs
                </option>
              ))}
            </Select>
            <Select label="Method" value={filters.method} onChange={(e) => changeFilter("method", e.target.value)}>
              <option value="">All methods</option>
              {["GET", "POST", "PUT", "PATCH", "DELETE", "ACTION"].map((m) => (
                <option key={m} value={m}>
                  {prettyMethod(m)}
                </option>
              ))}
            </Select>
            <Select label="Status" value={filters.statusGroup} onChange={(e) => changeFilter("statusGroup", e.target.value)}>
              <option value="">All statuses</option>
              <option value="success">Success (2xx/3xx)</option>
              <option value="error">Errors (4xx/5xx)</option>
            </Select>
            <Input
              label="Endpoint"
              placeholder="e.g. /attendance, /fees"
              value={filters.endpoint}
              onChange={(e) => changeFilter("endpoint", e.target.value)}
            />
            <Input
              label="Search activity"
              placeholder="e.g. Login, teacher, fee"
              value={filters.description}
              onChange={(e) => changeFilter("description", e.target.value)}
              className="md:col-span-2 xl:col-span-2"
            />
            <Input label="From" type="date" value={filters.from} onChange={(e) => changeFilter("from", e.target.value)} />
            <Input label="To" type="date" value={filters.to} onChange={(e) => changeFilter("to", e.target.value)} />
          </div>
        </div>

        <Table
          columns={columns}
          data={logs}
          loading={loadingLogs}
          rowKey="_id"
          pagination={pagination}
          onPageChange={(page) => fetchLogs(page)}
          emptyTitle="No activity found"
          emptyMessage="Try adjusting your filters or waiting for more activity."
        />
      </Card>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Methods */}
        <Card padding="lg">
          <h3 className="text-lg font-bold text-ink mb-4 flex items-center gap-2">
            <div className="p-2 bg-primary-soft rounded-lg">
              <Activity className="w-5 h-5 text-primary" />
            </div>
            Request Methods
          </h3>
          <div className="space-y-3">
            {methods.length === 0 && <p className="text-sm text-ink-faint">No data yet.</p>}
            {methods.map((m) => (
              <div key={m.name} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-ink-soft">{prettyMethod(m.name)}</span>
                  <span className="font-bold text-ink">{m.count.toLocaleString()}</span>
                </div>
                <div className="h-2 rounded-full bg-background overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      m.name === "GET"
                        ? "bg-emerald-500"
                        : m.name === "POST"
                        ? "bg-primary"
                        : m.name === "PUT"
                        ? "bg-amber-500"
                        : m.name === "DELETE"
                        ? "bg-red-500"
                        : m.name === "ACTION"
                        ? "bg-secondary"
                        : "bg-sky-500"
                    }`}
                    style={{ width: `${(m.count / maxMethod) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Top tenants */}
        <Card padding="lg">
          <h3 className="text-lg font-bold text-ink mb-4 flex items-center gap-2">
            <div className="p-2 bg-primary-soft rounded-lg">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            Top Tenants (24h)
          </h3>
          <div className="space-y-3">
            {(stats?.topTenants || []).length === 0 && <p className="text-sm text-ink-faint">No tenant activity yet.</p>}
            {(stats?.topTenants || []).map((t, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-ink truncate pr-2">{t.name}</span>
                  <span className="font-bold text-ink">{t.count.toLocaleString()}</span>
                </div>
                <div className="h-2 rounded-full bg-background overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-primary to-secondary" style={{ width: `${(t.count / maxTenant) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Status + endpoints */}
        <Card padding="lg">
          <h3 className="text-lg font-bold text-ink mb-4 flex items-center gap-2">
            <div className="p-2 bg-primary-soft rounded-lg">
              <Globe className="w-5 h-5 text-primary" />
            </div>
            Response Status
          </h3>
          <div className="space-y-2 mb-5">
            {statusData.map((s) => (
              <div key={s.key} className="flex items-center justify-between text-sm">
                <span className="font-semibold text-ink-soft flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
                  {s.key}
                </span>
                <span className="font-bold text-ink">
                  {s.count.toLocaleString()} <span className="text-xs text-ink-faint font-medium">({s.pct.toFixed(1)}%)</span>
                </span>
              </div>
            ))}
          </div>

          <h4 className="text-sm font-bold text-ink mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-ink-faint" />
            Most Hit Endpoints
          </h4>
          <div className="space-y-2">
            {(stats?.topEndpoints || []).length === 0 && <p className="text-sm text-ink-faint">No data yet.</p>}
            {(stats?.topEndpoints || []).slice(0, 5).map((e, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-sm gap-3">
                  <span className="font-medium text-ink-soft truncate" title={e.endpoint}>
                    {e.endpoint}
                  </span>
                  <span className="font-bold text-ink shrink-0">{e.count}</span>
                </div>
                <div className="h-1.5 rounded-full bg-background overflow-hidden">
                  <div className="h-full rounded-full bg-sky-500" style={{ width: `${(e.count / maxEndpoint) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <p className="text-xs text-ink-faint flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5" />
        Logs are retained for 24 hours and auto-deleted. Refresh rate: live feed 5s, stats 15s.
      </p>
    </div>
  );
};

export default SuperAdminMonitoring;
