// src/components/SuperAdmin/TenantList.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../utils/api";
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
} from "lucide-react";
import Button from "../common/ui/Button";
import Card from "../common/ui/Card";
import Modal from "../common/ui/Modal";
import Badge from "../common/ui/Badge";
import Input from "../common/ui/Input";
import EmptyState from "../common/ui/EmptyState";
import PageHeader from "../common/ui/PageHeader";

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
      <div className="space-y-6">
        <div className="h-32 bg-surface rounded-3xl shadow-card border border-line p-8 flex flex-col justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-line via-background to-line animate-pulse"></div>
        </div>
        <div className="h-16 w-full bg-surface rounded-2xl shadow-card animate-pulse border border-line"></div>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-surface rounded-2xl p-5 shadow-card border border-line flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-background rounded-xl animate-pulse"></div>
                <div className="space-y-3">
                  <div className="h-4 w-48 bg-line rounded animate-pulse"></div>
                  <div className="h-3 w-64 bg-background rounded animate-pulse"></div>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="h-8 w-20 bg-background rounded-full animate-pulse"></div>
                <div className="h-8 w-32 bg-background rounded-lg animate-pulse"></div>
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
        <div className="bg-surface rounded-2xl shadow-pop p-8 max-w-md w-full text-center border border-line">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-ink mb-2">Error</h2>
          <p className="text-ink-soft mb-6">{error}</p>
          <Button
            onClick={fetchTenants}
            variant="primary"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="All Tenants"
        subtitle={`Showing ${filteredTenants.length} of ${tenants.length} institutions`}
        icon={Building2}
        actions={
          <Button
            onClick={fetchTenants}
            variant="outline"
            leftIcon={RefreshCw}
          >
            Refresh
          </Button>
        }
      />

      {/* Search & Filters */}
      <Card padding="md">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-faint group-focus-within:text-primary transition-colors" />
            <Input
              type="text"
              placeholder="Search by name, subdomain, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 pr-10"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 bg-line rounded-full text-ink-soft hover:text-ink hover:bg-line transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Plan Filter */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none z-10">
                <Filter className="w-4 h-4 text-ink-faint" />
              </div>
              <select
                value={filterPlan}
                onChange={(e) => setFilterPlan(e.target.value)}
                className="w-full sm:w-auto pl-10 pr-10 py-2.5 bg-surface border border-line rounded-xl text-sm font-medium text-ink focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none cursor-pointer"
              >
                <option value="all">All Plans</option>
                {uniquePlans.map((plan) => (
                  <option key={plan} value={plan}>
                    {plan.charAt(0).toUpperCase() + plan.slice(1)}
                  </option>
                ))}
              </select>
              <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 9l-7 7-7-7" /></svg>
            </div>

            {/* Status Filter */}
            <div className="relative">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full sm:w-auto pl-4 pr-10 py-2.5 bg-surface border border-line rounded-xl text-sm font-medium text-ink focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none cursor-pointer"
              >
                <option value="all">All Statuses</option>
                {uniqueStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
              <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>
        </div>
      </Card>

      {/* Tenant List */}
      {filteredTenants.length > 0 ? (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
          }}
          className="space-y-4"
        >
          {filteredTenants.map((tenant) => (
            <motion.div
              variants={{
                hidden: { opacity: 0, x: -20 },
                visible: { opacity: 1, x: 0 }
              }}
              whileHover={{ y: -2, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)" }}
              key={tenant._id}
              className="bg-surface rounded-2xl border border-line p-5 transition-all group"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                {/* Left — Tenant Info */}
                <div
                  className="flex items-center gap-5 flex-1 cursor-pointer"
                  onClick={() => navigate(`/super-admin/tenants/${tenant._id}`)}
                >
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0 shadow-sm"
                    style={{
                      backgroundColor:
                        tenant.branding?.primaryColor || "#6366f1",
                    }}
                  >
                    {tenant.name?.[0] || "T"}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 flex-wrap mb-1">
                      <p className="font-bold text-lg text-ink truncate group-hover:text-primary transition-colors">
                        {tenant.name}
                      </p>
                      <Badge tone={getPlanTone(tenant.subscription?.plan || "free")}>
                        {tenant.subscription?.plan || "free"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-ink-soft font-medium flex-wrap">
                      <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-line"></span>{tenant.subdomain}</span>
                      <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-line"></span>{tenant.contact?.email}</span>
                      <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-line"></span>Joined {new Date(tenant.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {/* Right — Stats & Status & Actions */}
                <div className="flex items-center gap-6 flex-shrink-0">
                  {/* User Counts */}
                  <div className="hidden md:flex items-center gap-5 text-sm font-semibold text-ink-soft">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-primary-soft rounded-lg" title="Students">
                      <Users className="w-4 h-4 text-primary" />
                      <span>{tenant.stats?.totalStudents || 0}</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-lg" title="Teachers">
                      <Users className="w-4 h-4 text-emerald-600" />
                      <span>{tenant.stats?.totalTeachers || 0}</span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="scale-90 sm:scale-100">
                    <Badge tone={getStatusTone(tenant.subscription?.status)} dot>
                      {tenant.subscription?.status || "trial"}
                    </Badge>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 border-l border-line pl-6">
                    <button
                      onClick={() =>
                        navigate(`/super-admin/tenants/${tenant._id}`)
                      }
                      className="p-2 text-ink-faint hover:text-primary hover:bg-primary-soft rounded-xl transition-colors"
                      title="View Details"
                    >
                      <Eye className="w-5 h-5" />
                    </button>

                    {tenant.subscription?.status === "active" ||
                      tenant.subscription?.status === "trial" ? (
                      <button
                        onClick={() =>
                          setConfirmModal({
                            type: "suspend",
                            tenantId: tenant._id,
                            tenantName: tenant.name,
                          })
                        }
                        disabled={actionLoading === tenant._id}
                        className="p-2 text-ink-faint hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-colors"
                        title="Suspend Tenant"
                      >
                        <Ban className="w-5 h-5" />
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
                        className="p-2 text-ink-faint hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors"
                        title="Activate Tenant"
                      >
                        <CheckCircle className="w-5 h-5" />
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
                      className="p-2 text-ink-faint hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                      title="Delete Tenant"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <EmptyState
          title="No tenants found"
          description={
            searchQuery || filterPlan !== "all" || filterStatus !== "all"
              ? "Try adjusting your search or filters to find what you're looking for."
              : "No institutions have registered yet."
          }
          icon={Building2}
        />
      )}

      {/* Confirmation Modal */}
      <Modal
        isOpen={!!confirmModal}
        onClose={() => setConfirmModal(null)}
        title={
          confirmModal?.type === "delete"
            ? "Delete Tenant"
            : confirmModal?.type === "suspend"
              ? "Suspend Tenant"
              : "Activate Tenant"
        }
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmModal(null)}>
              Cancel
            </Button>
            <Button
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
              loading={actionLoading}
              variant={confirmModal?.type === "delete" ? "danger" : "primary"}
              className={
                confirmModal?.type === "suspend"
                  ? "!bg-amber-500 hover:!bg-amber-600"
                  : confirmModal?.type === "activate"
                    ? "!bg-emerald-600 hover:!bg-emerald-700"
                    : ""
              }
            >
              {actionLoading
                ? "Processing..."
                : confirmModal?.type === "delete"
                  ? "Delete Permanently"
                  : confirmModal?.type === "suspend"
                    ? "Suspend"
                    : "Activate"}
            </Button>
          </>
        }
      >
        <p className="text-ink-soft">
          {confirmModal?.type === "delete"
            ? `Are you sure you want to delete "${confirmModal?.tenantName}"? This will permanently remove the tenant and ALL associated data (users, subjects, attendance, tickets). This action cannot be undone.`
            : confirmModal?.type === "suspend"
              ? `Are you sure you want to suspend "${confirmModal?.tenantName}"? The tenant and all its users will lose access to the platform.`
              : `Are you sure you want to activate "${confirmModal?.tenantName}"? The tenant and its users will regain access to the platform.`}
        </p>
      </Modal>
    </div>
  );
};

export default TenantList;
