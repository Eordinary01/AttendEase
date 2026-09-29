// src/component/SuperAdmin/SuperAdminMonitoring.jsx
// Redesigned with Academic Precision System (redesign/DESIGN.md)
// Real-time Platform Monitoring, Cluster Latency Telemetry, and Cryptographic Log Streaming
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import { formatDateTime } from "../../utils/dateUtils";
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
  Cpu,
  ShieldCheck,
  Filter,
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
import EmptyState from "../common/ui/EmptyState";

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
      if (res.data?.success) {
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
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);

      const res = await api.get(`/admin/super/logs?${params.toString()}`);
      if (res.data?.success) {
        setLogs(res.data.data.logs || []);
        setPagination((prev) => ({
          ...prev,
          total: res.data.data.total || 0,
          page: res.data.data.page || page,
          pages: res.data.data.pages || 1,
        }));
      }
    } catch (err) {
      logError("Fetch Activity Logs", err);
    } finally {
      setLoadingLogs(false);
    }
  }, [filters, pagination.limit]);

  const fetchTenants = useCallback(async () => {
    try {
      const res = await api.get("/admin/super/logs/tenants");
      if (res.data?.success) {
        setTenants(res.data.data || []);
      }
    } catch (err) {
      logError("Fetch Log Tenants", err);
    }
  }, []);

  const pollFeed = useCallback(async () => {
    if (!live) return;
    try {
      const res = await api.get(`/admin/super/logs/feed?since=${lastSeen.current}&limit=20`);
      const rawList = Array.isArray(res.data?.data)
        ? res.data.data
        : (res.data?.data?.logs || res.data?.logs || []);
      if (res.data?.success && Array.isArray(rawList)) {
        const fresh = rawList.filter((item) => !feedSeen.current.has(item._id));
        if (fresh.length > 0) {
          fresh.forEach((i) => feedSeen.current.add(i._id));
          lastSeen.current = res.data.now || Date.now();
          setFeed((prev) => [...fresh, ...prev].slice(0, 50));
        }
      }
    } catch (err) {
      // feed poll quiet failure
    }
  }, [live]);

  useEffect(() => {
    fetchStats();
    fetchLogs(1);
    fetchTenants();
  }, [fetchStats, fetchLogs, fetchTenants]);

  useEffect(() => {
    if (!live) return;
    const interval = setInterval(pollFeed, 5000);
    return () => clearInterval(interval);
  }, [live, pollFeed]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchStats();
      fetchLogs(pagination.page);
    }, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchStats, fetchLogs, pagination.page]);

  const handleRefresh = () => {
    fetchStats();
    fetchLogs(pagination.page);
    fetchTenants();
  };

  const handleApplyFilters = () => {
    fetchLogs(1);
  };

  const handleClearFilters = () => {
    setFilters({
      tenantId: "",
      method: "",
      statusGroup: "",
      endpoint: "",
      description: "",
      from: "",
      to: "",
    });
  };

  const changeFilter = (key, val) => {
    setFilters((prev) => ({ ...prev, [key]: val }));
  };

  const chartData = useMemo(() => stats?.series || [], [stats]);

  const statsCards = [
    {
      label: "Total Requests (24h)",
      value: stats ? stats.total.toLocaleString() : "—",
      icon: Activity,
      style: "text-primary bg-primary-soft border-primary-surface",
      subtitle: "Aggregate cluster calls",
    },
    {
      label: "Error Rate (4xx/5xx)",
      value: stats ? `${stats.errorRate}%` : "0%",
      icon: AlertCircle,
      style: "text-rose-600 bg-rose-50 border-rose-100",
      subtitle: stats ? `${stats.errors} failed requests` : "0 failures",
    },
    {
      label: "Mean Response Time",
      value: stats ? `${stats.avgResponseTime} ms` : "—",
      icon: Zap,
      style: "text-emerald-600 bg-emerald-50 border-emerald-100",
      subtitle: stats ? `Peak ${stats.maxResponseTime} ms` : "Normal bounds",
    },
    {
      label: "Active Campuses",
      value: stats ? stats.activeTenants.toLocaleString() : "—",
      icon: Building2,
      style: "text-purple-600 bg-purple-50 border-purple-100",
      subtitle: "Last 30 minutes active",
    },
    {
      label: "Concurrent Identities",
      value: stats ? stats.activeUsers.toLocaleString() : "—",
      icon: Users,
      style: "text-amber-600 bg-amber-50 border-amber-100",
      subtitle: "Authenticated sessions",
    },
    {
      label: "Real-time Stream",
      value: `${feed.length} events`,
      icon: Radio,
      style: "text-primary bg-primary-soft border-primary-surface",
      subtitle: live ? "WebSocket/Poll Active" : "Stream Suspended",
    },
  ];

  return (
    <div className="space-y-6 font-sans antialiased text-slate-900">
      {/* 1. Header Strip */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Real-time System Monitoring & Telemetry
            </h1>
          </div>
          <p className="text-sm text-slate-500 max-w-2xl leading-relaxed">
            Multi-tenant network telemetry, HTTP gateway metrics, and cryptographic event logs.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setLive((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
              live
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-white text-slate-600 border-slate-200"
            }`}
          >
            <span className="relative flex h-2 w-2">
              {live && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${live ? "bg-emerald-500" : "bg-slate-400"}`} />
            </span>
            <span>{live ? "LIVE STREAM" : "PAUSED"}</span>
          </button>

          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-xs transition-all active:scale-[0.98]"
          >
            <RefreshCw className="w-3.5 h-3.5 text-primary" />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setAutoRefresh((prev) => !prev)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition ${
              autoRefresh
                ? "bg-primary-soft text-primary-dark border-primary-surface"
                : "bg-white text-slate-600 border-slate-200"
            }`}
          >
            Auto-Sync: {autoRefresh ? "ON (15s)" : "OFF"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-rose-700 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Top Metric Cards (6 across) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {statsCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">
                    {card.label}
                  </span>
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center border ${card.style}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                </div>
                <p className="text-xl font-black text-slate-900 tabular-nums">{card.value}</p>
              </div>
              <span className="text-[10px] text-slate-400 font-medium mt-2 pt-2 border-t border-slate-100 block truncate">
                {card.subtitle}
              </span>
            </div>
          );
        })}
      </div>

      {/* 3. Real-time Chart + Live Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Activity Area Chart (8-col) */}
        <div className="lg:col-span-8 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">Cluster Request Volume — 24 Hours</h3>
              <p className="text-xs text-slate-500 mt-0.5">Aggregate HTTP telemetry across all tenant schemas</p>
            </div>
            <span className="text-xs font-mono font-bold text-primary-dark bg-primary-soft px-2.5 py-1 rounded-lg border border-primary-surface">
              {stats?.total?.toLocaleString() || 0} Total Calls
            </span>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="monitoringGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4338ca" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#4338ca" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={{ stroke: "#e2e8f0" }}
                  interval={Math.ceil(chartData.length / 12) || 1}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <RechartsTooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    fontSize: "11px",
                    boxShadow: "0 4px 15px rgba(0,0,0,0.06)",
                    backgroundColor: "#ffffff",
                  }}
                  labelFormatter={(label) => `Time: ${label}`}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#4338ca"
                  strokeWidth={2}
                  fill="url(#monitoringGradient)"
                  name="Requests"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Live Streaming Feed (4-col) */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className={`w-4 h-4 ${live ? "text-emerald-600 animate-pulse" : "text-slate-400"}`} />
              <h3 className="text-sm font-bold text-slate-900">Live Gateway Feed</h3>
            </div>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                live ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200"
              }`}
            >
              {live ? "Streaming" : "Paused"}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[300px] p-3 space-y-2">
            {feed.length === 0 && !loadingStats && (
              <p className="text-xs text-slate-400 text-center py-8">Waiting for gateway activity...</p>
            )}
            {feed.map((item) => (
              <div
                key={item._id}
                className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition-colors text-xs flex items-start gap-2.5"
              >
                <span
                  className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                    item.statusCode >= 400
                      ? "bg-rose-500"
                      : item.statusCode >= 300
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900 truncate">{item.description}</p>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                    <span className="font-semibold text-primary">{item.tenantName}</span>
                    {item.userName && ` • ${item.userName}`}
                  </p>
                  <div className="flex items-center gap-2 mt-1 font-mono text-[10px] text-slate-400">
                    <span className="font-bold text-slate-700">{prettyMethod(item.method)}</span>
                    <span>•</span>
                    <span>{item.statusCode}</span>
                    <span>•</span>
                    <span>{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Filterable Activity Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        {/* Table Header & Search Controls */}
        <div className="p-5 border-b border-slate-100 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">Historical Gateway Audit Logs</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Detailed request ledger with duration benchmarks and origin addresses ({pagination.total.toLocaleString()} records)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleClearFilters}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-xl transition inline-flex items-center gap-1"
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>Clear Filters</span>
              </button>
              <button
                onClick={handleApplyFilters}
                className="px-4 py-1.5 bg-primary hover:bg-primary-dark text-white text-xs font-semibold rounded-xl shadow-xs transition inline-flex items-center gap-1"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Filter Logs</span>
              </button>
            </div>
          </div>

          {/* Filter Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <select
              value={filters.tenantId}
              onChange={(e) => changeFilter("tenantId", e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-700 font-medium"
            >
              <option value="">All Campuses / Tenants</option>
              {tenants.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name}
                </option>
              ))}
            </select>

            <select
              value={filters.method}
              onChange={(e) => changeFilter("method", e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-700 font-medium"
            >
              <option value="">All HTTP Methods</option>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
              <option value="DELETE">DELETE</option>
            </select>

            <select
              value={filters.statusGroup}
              onChange={(e) => changeFilter("statusGroup", e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-700 font-medium"
            >
              <option value="">All Status Codes</option>
              <option value="2xx">2xx Success</option>
              <option value="3xx">3xx Redirection</option>
              <option value="4xx">4xx Client Error</option>
              <option value="5xx">5xx Server Error</option>
            </select>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Endpoint pattern (e.g. /attendance)..."
                value={filters.endpoint}
                onChange={(e) => changeFilter("endpoint", e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white text-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Logs Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-5">Timestamp</th>
                <th className="py-3 px-4">Campus Tenant</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4">Endpoint & Action</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Latency</th>
                <th className="py-3 px-5 text-right">Origin IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingLogs ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    Loading gateway activity...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No log records match current filter criteria.
                  </td>
                </tr>
              ) : (
                logs.map((row) => (
                  <tr key={row._id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-5 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                      {formatDistanceToNow(new Date(row.createdAt), { addSuffix: true })}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 truncate max-w-[150px]">
                      {row.tenantName}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-800">{row.userName}</span>
                      <span className="text-slate-400 text-[10px] block font-mono">({row.userRole})</span>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-primary-dark">
                      {prettyMethod(row.method)}
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      <p className="font-medium text-slate-900 truncate">{row.description}</p>
                      <p className="text-[11px] font-mono text-slate-400 truncate">{row.endpoint}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                          row.statusCode >= 500
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : row.statusCode >= 400
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        }`}
                      >
                        {row.statusCode}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-700">
                      {row.responseTime != null ? `${row.responseTime} ms` : "—"}
                    </td>
                    <td className="py-3 px-5 text-right font-mono text-slate-400 text-[11px]">
                      {row.ipAddress || "127.0.0.1"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing Page {pagination.page} of {pagination.pages} ({pagination.total.toLocaleString()} logs)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => fetchLogs(pagination.page - 1)}
              disabled={pagination.page <= 1 || loadingLogs}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-semibold rounded-xl transition"
            >
              Previous
            </button>
            <button
              onClick={() => fetchLogs(pagination.page + 1)}
              disabled={pagination.page >= pagination.pages || loadingLogs}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-semibold rounded-xl transition"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminMonitoring;
