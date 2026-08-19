// src/components/SuperAdmin/TenantDetails.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../utils/api";
import { logError } from "../../utils/logger";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Building2,
  Users,
  UserCog,
  GraduationCap,
  BookOpen,
  Mail,
  Phone,
  MapPin,
  Globe,
  Calendar,
  CreditCard,
  RefreshCw,
  Ban,
  CheckCircle,
  Trash2,
  Save,
  AlertCircle,
  Receipt,
  Plus,
} from "lucide-react";
import Button from "../common/ui/Button";
import Card from "../common/ui/Card";
import Modal from "../common/ui/Modal";
import Badge from "../common/ui/Badge";
import StatCard from "../common/ui/StatCard";
import Table from "../common/ui/Table";
import Input, { Select } from "../common/ui/Input";

const TenantDetails = () => {
  const { tenantId } = useParams();
  const navigate = useNavigate();

  const [tenant, setTenant] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [actionLoading, setActionLoading] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [subscriptionForm, setSubscriptionForm] = useState({
    plan: "",
    status: "",
    billingCycle: "",
  });
  const [adjustmentForm, setAdjustmentForm] = useState({
    amount: "",
    reason: "",
    type: "credit",
  });

  useEffect(() => {
    fetchTenantDetails();
    fetchTransactions();
  }, [tenantId]);

  const fetchTenantDetails = async () => {
    try {
      setLoading(true);
      const response = await api.get(
        `/admin/super/tenants/${tenantId}`
      );
      if (response.data.success) {
        const data = response.data.data;
        setTenant(data);
        setSubscriptionForm({
          plan: data?.subscription?.plan || "",
          status: data?.subscription?.status || "",
          billingCycle: data?.subscription?.billingCycle || "",
        });
      }
    } catch (err) {
      logError("Fetch Tenant Details", err);
      setError(err.response?.data?.message || "Failed to load tenant details");
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      const response = await api.get(
        `/billing/admin/tenants/${tenantId}/transactions`
      );
      if (response.data.success) {
        setTransactions(response.data.data || []);
      }
    } catch (err) {
      logError("Fetch Transactions", err);
    }
  };

  const handleUpdateSubscription = async () => {
    try {
      setActionLoading("subscription");
      const body = {};
      if (subscriptionForm.plan) body.plan = subscriptionForm.plan;
      if (subscriptionForm.status) body.status = subscriptionForm.status;
      if (subscriptionForm.billingCycle) body.billingCycle = subscriptionForm.billingCycle;

      const response = await api.put(
        `/admin/super/tenants/${tenantId}/subscription`,
        body
      );
      if (response.data.success) {
        setTenant(response.data.data);
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update subscription");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSuspend = async () => {
    try {
      setActionLoading("suspend");
      await api.post(`/admin/super/tenants/${tenantId}/suspend`, {});
      setTenant((prev) => ({
        ...prev,
        subscription: { ...prev.subscription, status: "suspended" },
      }));
    } catch (err) {
      alert(err.response?.data?.message || "Failed to suspend tenant");
    } finally {
      setActionLoading(null);
      setConfirmModal(null);
    }
  };

  const handleActivate = async () => {
    try {
      setActionLoading("activate");
      await api.post(`/admin/super/tenants/${tenantId}/activate`, {});
      setTenant((prev) => ({
        ...prev,
        subscription: { ...prev.subscription, status: "active" },
      }));
    } catch (err) {
      alert(err.response?.data?.message || "Failed to activate tenant");
    } finally {
      setActionLoading(null);
      setConfirmModal(null);
    }
  };

  const handleDelete = async () => {
    try {
      setActionLoading("delete");
      await api.delete(`/admin/super/tenants/${tenantId}`);
      navigate("/super-admin/tenants");
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete tenant");
    } finally {
      setActionLoading(null);
      setConfirmModal(null);
    }
  };

  const handleAdjustBilling = async (e) => {
    e.preventDefault();
    try {
      setActionLoading("adjust");
      const response = await api.post(
        `/billing/admin/tenants/${tenantId}/adjust`,
        {
          amount: parseFloat(adjustmentForm.amount),
          reason: adjustmentForm.reason,
          type: adjustmentForm.type,
        }
      );
      if (response.data.success) {
        setAdjustmentForm({ amount: "", reason: "", type: "credit" });
        fetchTransactions();
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to apply billing adjustment");
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusTone = (status) => {
    const tones = {
      active: "success",
      trial: "warning",
      suspended: "danger",
      expired: "danger",
    };
    return tones[status] || "neutral";
  };

  const getPlanTone = (plan) => {
    const tones = {
      free: "neutral",
      basic: "primary",
      professional: "secondary",
      enterprise: "success",
    };
    return tones[plan] || "neutral";
  };

  const getTxStatusTone = (status) => {
    switch (status) {
      case "paid":
        return "success";
      case "pending":
        return "warning";
      case "failed":
        return "danger";
      default:
        return "neutral";
    }
  };

  const tabs = [
    { id: "overview", label: "Overview", icon: <Building2 className="w-4 h-4" /> },
    { id: "subscription", label: "Subscription", icon: <CreditCard className="w-4 h-4" /> },
    { id: "billing", label: "Billing", icon: <Receipt className="w-4 h-4" /> },
  ];

  const transactionColumns = [
    { header: "Invoice #", cell: (row) => <span className="font-mono text-xs text-ink-soft">{row.invoiceNumber || "—"}</span> },
    { header: "Amount", cell: (row) => <span className="font-semibold text-ink">₹{row.amount?.toLocaleString() || 0}</span> },
    {
      header: "Status",
      cell: (row) => (
        <Badge tone={getTxStatusTone(row.status)}>{row.status}</Badge>
      ),
    },
    { header: "Plan", cell: (row) => <span className="capitalize text-ink-soft">{row.plan || "—"}</span> },
    {
      header: "Date",
      cell: (row) => (
        <span className="text-ink-faint">
          {row.paidAt ? new Date(row.paidAt).toLocaleDateString() : row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "—"}
        </span>
      ),
    },
  ];

  // Loading Skeleton
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-10 h-10 bg-line rounded-lg animate-pulse"></div>
          <div className="h-8 w-64 bg-line rounded-lg animate-pulse"></div>
        </div>
        <div className="h-16 w-full bg-surface rounded-t-2xl shadow-card animate-pulse border border-line"></div>
        <div className="h-96 bg-surface rounded-b-2xl rounded-tr-2xl shadow-card animate-pulse border border-line p-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-background rounded-2xl animate-pulse"></div>)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-48 bg-background rounded-2xl animate-pulse"></div>
            <div className="h-48 bg-background rounded-2xl animate-pulse"></div>
          </div>
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
          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={() => navigate("/super-admin/tenants")}>
              Back to Tenants
            </Button>
            <Button onClick={fetchTenantDetails}>
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!tenant) return null;

  return (
    <div className="space-y-6">
      {/* Back Button & Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface p-6 rounded-3xl shadow-card border border-line"
      >
        <div className="flex items-center gap-4 flex-1">
          <Button
            onClick={() => navigate("/super-admin/tenants")}
            variant="outline"
            className="px-2.5 py-2.5"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0 shadow-sm"
                style={{ backgroundColor: tenant.branding?.primaryColor || "#6366f1" }}>
                {tenant.name?.[0] || "T"}
              </div>
              <h1 className="text-2xl font-extrabold text-ink truncate tracking-tight">{tenant.name}</h1>
              <Badge tone={getStatusTone(tenant.subscription?.status)} dot>
                {tenant.subscription?.status}
              </Badge>
              <Badge tone={getPlanTone(tenant.subscription?.plan)}>
                {tenant.subscription?.plan}
              </Badge>
            </div>
            <p className="text-ink-soft mt-1 flex items-center gap-2 font-medium text-sm ml-14">
              <Globe className="w-4 h-4 text-ink-faint" />
              {tenant.subdomain} • Joined {new Date(tenant.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <Button
          onClick={fetchTenantDetails}
          variant="outline"
          leftIcon={RefreshCw}
        >
          Refresh
        </Button>
      </motion.div>

      {/* Tabs */}
      <div className="flex border-b border-line mb-6 bg-surface rounded-t-xl px-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition -mb-px ${activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-ink-soft hover:text-ink"
              }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <Card padding="lg" className="rounded-b-xl rounded-tr-xl">
        {/* ===== OVERVIEW TAB ===== */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={GraduationCap} label="Students" value={(tenant.stats?.totalStudents || 0).toLocaleString()} tone="secondary" />
              <StatCard icon={Users} label="Teachers" value={(tenant.stats?.totalTeachers || 0).toLocaleString()} tone="success" />
              <StatCard icon={UserCog} label="Admins" value={(tenant.stats?.totalAdmins || 0).toLocaleString()} tone="warning" />
              <StatCard icon={BookOpen} label="Subjects" value={(tenant.stats?.totalSubjects || 0).toLocaleString()} tone="primary" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Contact Info */}
              <div className="border border-line rounded-xl p-5 bg-background">
                <h3 className="text-sm font-semibold text-ink-faint uppercase tracking-wider mb-4">Contact Information</h3>
                <div className="space-y-3">
                  <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={tenant.contact?.email} />
                  <InfoRow icon={<Phone className="w-4 h-4" />} label="Phone" value={tenant.contact?.phone || "—"} />
                  <InfoRow icon={<MapPin className="w-4 h-4" />} label="Address" value={tenant.contact?.address || "—"} />
                  <div className="flex gap-4">
                    <InfoRow icon={<MapPin className="w-4 h-4" />} label="City" value={tenant.contact?.city || "—"} />
                    <InfoRow icon={<MapPin className="w-4 h-4" />} label="State" value={tenant.contact?.state || "—"} />
                  </div>
                  <InfoRow icon={<Globe className="w-4 h-4" />} label="Country" value={tenant.contact?.country || "—"} />
                </div>
              </div>

              {/* Subscription Summary */}
              <div className="border border-line rounded-xl p-5 bg-background">
                <h3 className="text-sm font-semibold text-ink-faint uppercase tracking-wider mb-4">Subscription</h3>
                <div className="space-y-3">
                  <InfoRow label="Plan" value={tenant.subscription?.plan?.toUpperCase() || "FREE"} />
                  <InfoRow label="Status" value={<span className="capitalize">{tenant.subscription?.status}</span>} />
                  <InfoRow label="Billing Cycle" value={tenant.subscription?.billingCycle || "monthly"} />
                  <InfoRow
                    icon={<Calendar className="w-4 h-4" />}
                    label="Start Date"
                    value={tenant.subscription?.startDate ? new Date(tenant.subscription.startDate).toLocaleDateString() : "—"}
                  />
                  {tenant.subscription?.status === "trial" && (
                    <InfoRow
                      icon={<Calendar className="w-4 h-4" />}
                      label="Trial Ends"
                      value={tenant.subscription?.trialEndsAt ? new Date(tenant.subscription.trialEndsAt).toLocaleDateString() : "—"}
                    />
                  )}
                </div>
              </div>

              {/* Branding */}
              <div className="border border-line rounded-xl p-5 bg-background">
                <h3 className="text-sm font-semibold text-ink-faint uppercase tracking-wider mb-4">Branding</h3>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl flex items-center justify-center text-white text-2xl font-bold"
                    style={{ backgroundColor: tenant.branding?.primaryColor || "#6366f1" }}
                  >
                    {tenant.name?.[0] || "T"}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full border-2 border-line" style={{ backgroundColor: tenant.branding?.primaryColor || "#6366f1" }} />
                      <span className="text-sm text-ink-soft">Primary: {tenant.branding?.primaryColor || "#6366f1"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full border-2 border-line" style={{ backgroundColor: tenant.branding?.secondaryColor || "#8b5cf6" }} />
                      <span className="text-sm text-ink-soft">Secondary: {tenant.branding?.secondaryColor || "#8b5cf6"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Limits */}
              <div className="border border-line rounded-xl p-5 bg-background">
                <h3 className="text-sm font-semibold text-ink-faint uppercase tracking-wider mb-4">Limits</h3>
                <div className="space-y-3">
                  <LimitBar label="Students" current={tenant.stats?.totalStudents || 0} max={tenant.limits?.maxStudents || 50} />
                  <LimitBar label="Teachers" current={tenant.stats?.totalTeachers || 0} max={tenant.limits?.maxTeachers || 5} />
                  <LimitBar label="Admins" current={tenant.stats?.totalAdmins || 0} max={tenant.limits?.maxAdmins || 1} />
                  <LimitBar label="Subjects" current={tenant.stats?.totalSubjects || 0} max={tenant.limits?.maxSubjects || 100} />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="border-t border-line pt-6">
              <h3 className="text-sm font-semibold text-ink-faint uppercase tracking-wider mb-4">Actions</h3>
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => setActiveTab("subscription")}
                  variant="primary"
                  leftIcon={CreditCard}
                >
                  Manage Subscription
                </Button>
                {tenant.subscription?.status !== "suspended" ? (
                  <Button
                    onClick={() => setConfirmModal({ type: "suspend" })}
                    variant="primary"
                    leftIcon={Ban}
                    className="!bg-amber-500 hover:!bg-amber-600"
                  >
                    Suspend Tenant
                  </Button>
                ) : (
                  <Button
                    onClick={() => setConfirmModal({ type: "activate" })}
                    variant="primary"
                    leftIcon={CheckCircle}
                    className="!bg-emerald-600 hover:!bg-emerald-700"
                  >
                    Activate Tenant
                  </Button>
                )}
                <Button
                  onClick={() => setConfirmModal({ type: "delete" })}
                  variant="danger"
                  leftIcon={Trash2}
                >
                  Delete Tenant
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ===== SUBSCRIPTION TAB ===== */}
        {activeTab === "subscription" && (
          <div className="max-w-lg space-y-6">
            <h3 className="text-lg font-semibold text-ink flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              Update Subscription
            </h3>
            <p className="text-ink-soft text-sm">
              Change the subscription plan, status, or billing cycle for this tenant.
            </p>

            <div className="space-y-4">
              <Select
                label="Plan"
                value={subscriptionForm.plan}
                onChange={(e) => setSubscriptionForm({ ...subscriptionForm, plan: e.target.value })}
              >
                <option value="">— Select Plan —</option>
                <option value="free">Free</option>
                <option value="basic">Basic</option>
                <option value="professional">Professional</option>
                <option value="enterprise">Enterprise</option>
              </Select>

              <Select
                label="Status"
                value={subscriptionForm.status}
                onChange={(e) => setSubscriptionForm({ ...subscriptionForm, status: e.target.value })}
              >
                <option value="">— Select Status —</option>
                <option value="active">Active</option>
                <option value="trial">Trial</option>
                <option value="suspended">Suspended</option>
                <option value="expired">Expired</option>
              </Select>

              <Select
                label="Billing Cycle"
                value={subscriptionForm.billingCycle}
                onChange={(e) => setSubscriptionForm({ ...subscriptionForm, billingCycle: e.target.value })}
              >
                <option value="">— Select Cycle —</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </Select>

              <Button
                onClick={handleUpdateSubscription}
                disabled={actionLoading === "subscription" || (!subscriptionForm.plan && !subscriptionForm.status && !subscriptionForm.billingCycle)}
                loading={actionLoading === "subscription"}
                leftIcon={Save}
              >
                {actionLoading === "subscription" ? "Updating..." : "Update Subscription"}
              </Button>
            </div>
          </div>
        )}

        {/* ===== BILLING TAB ===== */}
        {activeTab === "billing" && (
          <div className="space-y-6">
            {/* Adjustment Form */}
            <div className="max-w-lg border border-line rounded-xl p-5 bg-background">
              <h3 className="text-lg font-semibold text-ink mb-1 flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" />
                Billing Adjustment
              </h3>
              <p className="text-ink-soft text-sm mb-4">
                Apply a credit or debit to this tenant's billing account.
              </p>
              <form onSubmit={handleAdjustBilling} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Select
                    label="Type"
                    value={adjustmentForm.type}
                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, type: e.target.value })}
                  >
                    <option value="credit">Credit</option>
                    <option value="debit">Debit</option>
                  </Select>
                  <Input
                    label="Amount (₹)"
                    type="number"
                    min="1"
                    step="0.01"
                    value={adjustmentForm.amount}
                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, amount: e.target.value })}
                    placeholder="0.00"
                    required
                  />
                </div>
                <Input
                  label="Reason"
                  type="text"
                  value={adjustmentForm.reason}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, reason: e.target.value })}
                  placeholder="Reason for adjustment..."
                  required
                />
                <Button
                  type="submit"
                  disabled={actionLoading === "adjust"}
                  loading={actionLoading === "adjust"}
                  leftIcon={Plus}
                >
                  {actionLoading === "adjust" ? "Applying..." : "Apply Adjustment"}
                </Button>
              </form>
            </div>

            {/* Transaction History */}
            <div>
              <h3 className="text-lg font-semibold text-ink mb-4 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-primary" />
                Transaction History
              </h3>
              <Table
                columns={transactionColumns}
                data={transactions}
                rowKey="_id"
                emptyTitle="No transactions found"
                emptyMessage="No transactions found for this tenant."
              />
            </div>
          </div>
        )}
      </Card>

      {/* Confirmation Modal */}
      <Modal
        isOpen={!!confirmModal}
        onClose={() => setConfirmModal(null)}
        title={confirmModal?.type === "delete" ? "Delete Tenant" : confirmModal?.type === "suspend" ? "Suspend Tenant" : "Activate Tenant"}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmModal(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!confirmModal) return;
                if (confirmModal.type === "delete") handleDelete();
                else if (confirmModal.type === "suspend") handleSuspend();
                else handleActivate();
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
              {actionLoading ? "Processing..." : confirmModal?.type === "delete" ? "Delete Permanently" : confirmModal?.type === "suspend" ? "Suspend" : "Activate"}
            </Button>
          </>
        }
      >
        <p className="text-ink-soft">
          {confirmModal?.type === "delete"
            ? `Are you sure you want to permanently delete "${tenant.name}"? This will remove ALL data including users, subjects, attendance records, and tickets. This cannot be undone.`
            : confirmModal?.type === "suspend"
              ? `Are you sure you want to suspend "${tenant.name}"? All users of this tenant will lose access.`
              : `Are you sure you want to activate "${tenant.name}"? All users will regain access.`}
        </p>
      </Modal>
    </div>
  );
};

// ===== Sub-components =====

const InfoRow = ({ icon, label, value }) => (
  <div className="flex items-center gap-3">
    {icon && <div className="text-ink-faint">{icon}</div>}
    <span className="text-sm text-ink-soft min-w-[80px]">{label}</span>
    <span className="text-sm text-ink font-medium">{value}</span>
  </div>
);

const LimitBar = ({ label, current, max }) => {
  const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0;
  const isOver = current >= max;
  return (
    <div className="group">
      <div className="flex justify-between text-sm mb-2">
        <span className="text-ink-soft font-medium">{label}</span>
        <span className={`font-bold ${isOver ? "text-red-600" : "text-ink"}`}>
          {current} <span className="text-ink-faint font-medium">/ {max}</span>
        </span>
      </div>
      <div className="w-full bg-line rounded-full h-2.5 overflow-hidden shadow-inner">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={`h-full rounded-full ${isOver ? "bg-red-500" : "bg-primary"}`}
        />
      </div>
    </div>
  );
};

export default TenantDetails;
