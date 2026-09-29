// src/components/SuperAdmin/TenantList.jsx
// Redesigned with Academic Precision System (redesign/DESIGN.md)
// Multi-Tenant Campus Isolation, Schema State, and Directory Orchestration
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../utils/api";
import { formatDateDMY } from "../../utils/dateUtils";
import { logError } from "../../utils/logger";
import { motion } from "framer-motion";
import {
  Building2,
  Search,
  RefreshCw,
  Eye,
  Ban,
  CheckCircle,
  Trash2,
  AlertCircle,
  Filter,
  Users,
  X,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
  Plus,
} from "lucide-react";
import Button from "../common/ui/Button";
import Modal from "../common/ui/Modal";
import EmptyState from "../common/ui/EmptyState";

const TenantList = () => {
  const navigate = useNavigate();

  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPlan, setFilterPlan] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [actionLoading, setActionLoading] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null); // { type, tenantId, tenantName }

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/admin/super/tenants`);
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

  const handleSuspendTenant = async (tenantId) => {
    try {
      setActionLoading(tenantId);
      const response = await api.post(
        `/admin/super/tenants/${tenantId}/suspend`,
        {}
      );
      if (response.data.success) {
        setTenants((prev) =>
          prev.map((t) =>
            t._id === tenantId
              ? { ...t, subscription: { ...t.subscription, status: "suspended" } }
              : t
          )
        );
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to suspend tenant");
    } finally {
      setActionLoading(null);
      setConfirmModal(null);
    }
  };

  const handleActivateTenant = async (tenantId) => {
    try {
      setActionLoading(tenantId);
      const response = await api.post(
        `/admin/super/tenants/${tenantId}/activate`,
        {}
      );
      if (response.data.success) {
        setTenants((prev) =>
          prev.map((t) =>
            t._id === tenantId
              ? { ...t, subscription: { ...t.subscription, status: "active" } }
              : t
          )
        );
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to activate tenant");
    } finally {
      setActionLoading(null);
      setConfirmModal(null);
    }
  };

  const handleDeleteTenant = async (tenantId) => {
    try {
      setActionLoading(tenantId);
      const response = await api.delete(
        `/admin/super/tenants/${tenantId}`
      );
      if (response.data.success) {
        setTenants((prev) => prev.filter((t) => t._id !== tenantId));
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete tenant");
    } finally {
      setActionLoading(null);
      setConfirmModal(null);
    }
  };

  // Filter tenants
  const filteredTenants = tenants.filter((tenant) => {
    const matchesSearch =
      !searchQuery ||
      tenant.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant.subdomain?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant.contact?.email?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesPlan =
      filterPlan === "all" || tenant.subscription?.plan === filterPlan;
    const matchesStatus =
      filterStatus === "all" || tenant.subscription?.status === filterStatus;

    return matchesSearch && matchesPlan && matchesStatus;
  });

  const uniquePlans = [...new Set(tenants.map((t) => t.subscription?.plan).filter(Boolean))];
  const uniqueStatuses = [...new Set(tenants.map((t) => t.subscription?.status).filter(Boolean))];

  // Loading Skeleton
  if (loading) {
    return (
      <div className="space-y-6 font-sans antialiased">
        <div className="h-20 bg-white rounded-2xl border border-slate-200/80 p-6 flex items-center animate-pulse" />
        <div className="h-16 w-full bg-white rounded-2xl border border-slate-200/80 animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl p-5 border border-slate-200/80 flex items-center justify-between animate-pulse"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-100 rounded-xl"></div>
                <div className="space-y-2">
                  <div className="h-4 w-40 bg-slate-100 rounded"></div>
                  <div className="h-3 w-56 bg-slate-100 rounded"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-6 min-h-[60vh]">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-8 max-w-md w-full text-center shadow-sm">
          <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-200">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Failed to Load Tenants</h2>
          <p className="text-xs text-slate-500 mb-6">{error}</p>
          <button
            onClick={fetchTenants}
            className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-semibold shadow-xs transition-all"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans antialiased text-slate-900">
      {/* 1. Header Strip */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Institution Tenant Directory
            </h1>
          </div>
          <p className="text-sm text-slate-500 max-w-2xl leading-relaxed">
            Managing {filteredTenants.length} of {tenants.length} isolated campus database schemas and domain mappings.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="inline-flex items-center gap-2 bg-slate-100/90 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-mono text-slate-600">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="text-emerald-700 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {tenants.filter((t) => t.subscription?.status === "active").length} Active Schemas
            </span>
          </div>

          <button
            onClick={fetchTenants}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-xs transition-all active:scale-[0.98]"
          >
            <RefreshCw className="w-3.5 h-3.5 text-primary" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 2. Search & Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          {/* Search Input */}
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by institution name, subdomain, or administrator email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-9 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-slate-900"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Plan Filter */}
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <select
                value={filterPlan}
                onChange={(e) => setFilterPlan(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none cursor-pointer focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="all">All Plans</option>
                {uniquePlans.map((plan) => (
                  <option key={plan} value={plan}>
                    {plan.charAt(0).toUpperCase() + plan.slice(1)} Tier
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="relative">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none cursor-pointer focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="all">All Statuses</option>
                {uniqueStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Tenant List Items */}
      {filteredTenants.length > 0 ? (
        <div className="space-y-3">
          {filteredTenants.map((tenant) => {
            const plan = tenant.subscription?.plan || "free";
            const status = tenant.subscription?.status || "trial";

            return (
              <div
                key={tenant._id}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:border-primary/40 hover:shadow-md transition-all p-5 group"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                  {/* Left — Tenant Branding & Identity */}
                  <div
                    className="flex items-center gap-4 flex-1 cursor-pointer"
                    onClick={() => navigate(`/super-admin/tenants/${tenant._id}`)}
                  >
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0 shadow-xs"
                      style={{
                        backgroundColor: tenant.branding?.primaryColor || "#4338ca",
                      }}
                    >
                      {tenant.name?.[0]?.toUpperCase() || "T"}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap mb-1">
                        <p className="font-bold text-base text-slate-900 group-hover:text-primary transition-colors">
                          {tenant.name}
                        </p>
                        <span
                          className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider font-mono ${
                            plan === "enterprise"
                              ? "bg-primary-soft text-primary-dark border border-primary-surface"
                              : plan === "professional"
                              ? "bg-secondary-soft text-secondary-dark border border-secondary-surface"
                              : "bg-slate-100 text-slate-700 border border-slate-200"
                          }`}
                        >
                          {plan}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 font-mono flex-wrap">
                        <span className="text-primary font-semibold">
                          {tenant.subdomain ? `${tenant.subdomain}.attendease.com` : "Domain unassigned"}
                        </span>
                        <span>•</span>
                        <span>{tenant.contact?.email || "No contact email"}</span>
                        <span>•</span>
                        <span>Joined {formatDateDMY(tenant.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right — Stats, Status Badge & Action Buttons */}
                  <div className="flex items-center gap-5 flex-shrink-0 justify-between lg:justify-end border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100">
                    {/* User Roster Counts */}
                    <div className="hidden sm:flex items-center gap-4 text-xs font-semibold text-slate-600">
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg" title="Enrolled Students">
                        <Users className="w-3.5 h-3.5 text-primary" />
                        <span className="tabular-nums font-mono">{tenant.stats?.totalStudents || 0} Students</span>
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg" title="Active Faculty">
                        <Users className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="tabular-nums font-mono">{tenant.stats?.totalTeachers || 0} Faculty</span>
                      </div>
                    </div>

                    {/* Status Pill with Pulsing Dot */}
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${
                        status === "active"
                          ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                          : status === "trial"
                          ? "text-amber-700 bg-amber-50 border-amber-200"
                          : "text-rose-700 bg-rose-50 border-rose-200"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          status === "active"
                            ? "bg-emerald-500 animate-pulse"
                            : status === "trial"
                            ? "bg-amber-500"
                            : "bg-rose-500"
                        }`}
                      />
                      <span className="capitalize">{status}</span>
                    </span>

                    {/* Actions Toolbar */}
                    <div className="flex items-center gap-1.5 border-l border-slate-200 pl-4">
                      <button
                        onClick={() => navigate(`/super-admin/tenants/${tenant._id}`)}
                        className="p-2 text-slate-500 hover:text-primary hover:bg-primary-soft rounded-xl transition-colors"
                        title="View Tenant Console"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {status === "active" || status === "trial" ? (
                        <button
                          onClick={() =>
                            setConfirmModal({
                              type: "suspend",
                              tenantId: tenant._id,
                              tenantName: tenant.name,
                            })
                          }
                          disabled={actionLoading === tenant._id}
                          className="p-2 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-colors"
                          title="Suspend Tenant Schema"
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() =>
                            setConfirmModal({
                              type: "activate",
                              tenantId: tenant._id,
                              tenantName: tenant.name,
                            })
                          }
                          disabled={actionLoading === tenant._id}
                          className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors"
                          title="Activate Tenant Schema"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        onClick={() =>
                          setConfirmModal({
                            type: "delete",
                            tenantId: tenant._id,
                            tenantName: tenant.name,
                          })
                        }
                        disabled={actionLoading === tenant._id}
                        className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                        title="Delete Tenant Database"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No institution tenants found"
          description={
            searchQuery || filterPlan !== "all" || filterStatus !== "all"
              ? "Try adjusting your search query or filter tags to locate the institution."
              : "No institution campuses are currently provisioned."
          }
          icon={Building2}
        />
      )}

      {/* Confirmation Action Modal */}
      <Modal
        isOpen={!!confirmModal}
        onClose={() => setConfirmModal(null)}
        title={
          confirmModal?.type === "delete"
            ? "Delete Tenant Instance"
            : confirmModal?.type === "suspend"
            ? "Suspend Tenant Schema"
            : "Activate Tenant Schema"
        }
        size="sm"
        footer={
          <div className="flex justify-end gap-2.5">
            <button
              onClick={() => setConfirmModal(null)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (!confirmModal) return;
                if (confirmModal.type === "delete") {
                  handleDeleteTenant(confirmModal.tenantId);
                } else if (confirmModal.type === "suspend") {
                  handleSuspendTenant(confirmModal.tenantId);
                } else {
                  handleActivateTenant(confirmModal.tenantId);
                }
              }}
              disabled={actionLoading}
              className={`px-4 py-2 text-xs font-semibold rounded-xl text-white transition ${
                confirmModal?.type === "delete"
                  ? "bg-rose-600 hover:bg-rose-700 shadow-sm"
                  : confirmModal?.type === "suspend"
                  ? "bg-amber-600 hover:bg-amber-700 shadow-sm"
                  : "bg-emerald-600 hover:bg-emerald-700 shadow-sm"
              }`}
            >
              {actionLoading
                ? "Processing…"
                : confirmModal?.type === "delete"
                ? "Delete Permanently"
                : confirmModal?.type === "suspend"
                ? "Suspend Access"
                : "Activate Access"}
            </button>
          </div>
        }
      >
        <p className="text-xs text-slate-600 leading-relaxed">
          {confirmModal?.type === "delete"
            ? `Are you sure you want to permanently delete "${confirmModal?.tenantName}"? This will drop the database schema and permanently remove ALL associated student records, academic timetables, and audit history. This action cannot be undone.`
            : confirmModal?.type === "suspend"
            ? `Are you sure you want to suspend "${confirmModal?.tenantName}"? The institution's domain, faculty logins, and API access will immediately be blocked.`
            : `Are you sure you want to restore active access for "${confirmModal?.tenantName}"? All portals and scheduled tasks will resume.`}
        </p>
      </Modal>
    </div>
  );
};

export default TenantList;
