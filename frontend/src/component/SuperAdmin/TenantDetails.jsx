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

import DashboardHeader from "../common/ui/DashboardHeader";

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
    { id: "overview", label: "Overview", icon: <Building2 className="w-3.5 h-3.5" /> },
    { id: "subscription", label: "Subscription", icon: <CreditCard className="w-3.5 h-3.5" /> },
    { id: "billing", label: "Billing", icon: <Receipt className="w-3.5 h-3.5" /> },
  ];

  const transactionColumns = [
    { header: "Invoice #", cell: (row) => <span className="font-mono text-xs text-ink-soft">{row.invoiceNumber || "—"}</span> },
    { header: "Amount", cell: (row) => <span className="font-semibold text-ink">₹{row.amount?.toLocaleString() || 0}</span> },
    {
      header: "Status",
      cell: (row) => (
        <Badge tone={getTxStatusTone(row.status)} size="sm">{row.status}</Badge>
      ),
    },
    { header: "Plan", cell: (row) => <span className="capitalize text-ink-soft text-xs">{row.plan || "—"}</span> },
    {
      header: "Date",
      cell: (row) => (
        <span className="text-ink-faint text-xs">
          {row.paidAt ? new Date(row.paidAt).toLocaleDateString() : row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "—"}
        </span>
      ),
    },
  ];

  // Loading Skeleton
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-20 bg-surface rounded-2xl border border-line/50 p-5 animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-surface rounded-2xl border border-line/50 animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-6 min-h-[60vh]">
        <div className="bg-surface rounded-2xl border border-line/50 p-8 max-w-md w-full text-center shadow-sm">
          <div className="w-14 h-14 bg-rose-500/10 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-500/20">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-ink mb-1">Error Loading Institution</h2>
          <p className="text-xs text-ink-soft mb-6">{error}</p>
          <div className="flex justify-center gap-2.5">
            <Button variant="subtle" size="sm" onClick={() => navigate("/super-admin/tenants")}>
              Back to Directory
            </Button>
            <Button size="sm" variant="primary" onClick={fetchTenantDetails}>
              Retry Connection
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!tenant) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <DashboardHeader
        greeting={tenant.name}
        meta={`${tenant.subdomain}.attendease.com • Joined ${new Date(tenant.createdAt).toLocaleDateString()}`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              onClick={() => navigate("/super-admin/tenants")}
              variant="subtle"
              size="sm"
              leftIcon={ArrowLeft}
            >
              Back
            </Button>
            <Button
              onClick={fetchTenantDetails}
              variant="subtle"
              size="sm"
              leftIcon={RefreshCw}
            >
              Refresh
            </Button>
          </div>
        }
      />

      {/* Segmented Navigation Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-surface border border-line/50 rounded-2xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
              activeTab === tab.id
                ? "bg-primary text-white shadow-xs"
                : "text-ink-soft hover:text-ink hover:bg-background"
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {/* ===== OVERVIEW TAB ===== */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={GraduationCap} label="Students" value={(tenant.stats?.totalStudents || 0).toLocaleString()} tone="secondary" />
              <StatCard icon={Users} label="Faculty" value={(tenant.stats?.totalTeachers || 0).toLocaleString()} tone="success" />
              <StatCard icon={UserCog} label="Admins" value={(tenant.stats?.totalAdmins || 0).toLocaleString()} tone="warning" />
              <StatCard icon={BookOpen} label="Subjects" value={(tenant.stats?.totalSubjects || 0).toLocaleString()} tone="primary" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Contact Info */}
              <Card padding="md" bordered>
                <h3 className="text-xs font-bold text-ink-soft uppercase tracking-wider mb-4">Contact Information</h3>
                <div className="space-y-3 text-xs">
                  <InfoRow icon={<Mail className="w-3.5 h-3.5" />} label="Email" value={tenant.contact?.email} />
                  <InfoRow icon={<Phone className="w-3.5 h-3.5" />} label="Phone" value={tenant.contact?.phone || "—"} />
                  <InfoRow icon={<MapPin className="w-3.5 h-3.5" />} label="Address" value={tenant.contact?.address || "—"} />
                  <div className="flex gap-4">
                    <InfoRow icon={<MapPin className="w-3.5 h-3.5" />} label="City" value={tenant.contact?.city || "—"} />
                    <InfoRow icon={<MapPin className="w-3.5 h-3.5" />} label="State" value={tenant.contact?.state || "—"} />
                  </div>
                  <InfoRow icon={<Globe className="w-3.5 h-3.5" />} label="Country" value={tenant.contact?.country || "—"} />
                </div>
              </Card>

              {/* Subscription Summary */}
              <Card padding="md" bordered>
                <h3 className="text-xs font-bold text-ink-soft uppercase tracking-wider mb-4">Subscription Plan</h3>
                <div className="space-y-3 text-xs">
                  <InfoRow label="Tier" value={tenant.subscription?.plan?.toUpperCase() || "FREE"} />
                  <InfoRow label="Status" value={<Badge tone={getStatusTone(tenant.subscription?.status)} size="sm">{tenant.subscription?.status}</Badge>} />
                  <InfoRow label="Billing Cycle" value={tenant.subscription?.billingCycle || "monthly"} />
                  <InfoRow
                    icon={<Calendar className="w-3.5 h-3.5" />}
                    label="Start Date"
                    value={tenant.subscription?.startDate ? new Date(tenant.subscription.startDate).toLocaleDateString() : "—"}
                  />
                  {tenant.subscription?.status === "trial" && (
                    <InfoRow
                      icon={<Calendar className="w-3.5 h-3.5" />}
                      label="Trial Ends"
                      value={tenant.subscription?.trialEndsAt ? new Date(tenant.subscription.trialEndsAt).toLocaleDateString() : "—"}
                    />
                  )}
                </div>
              </Card>

              {/* Branding */}
              <Card padding="md" bordered>
                <h3 className="text-xs font-bold text-ink-soft uppercase tracking-wider mb-4">Campus Identity & Branding</h3>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-xs shrink-0"
                    style={{ backgroundColor: tenant.branding?.primaryColor || "#7c3aed" }}
                  >
                    {tenant.name?.[0] || "T"}
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full border border-line/50" style={{ backgroundColor: tenant.branding?.primaryColor || "#7c3aed" }} />
                      <span className="text-ink-soft">Primary: <code className="font-bold text-ink">{tenant.branding?.primaryColor || "#7c3aed"}</code></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full border border-line/50" style={{ backgroundColor: tenant.branding?.secondaryColor || "#06b6d4" }} />
                      <span className="text-ink-soft">Secondary: <code className="font-bold text-ink">{tenant.branding?.secondaryColor || "#06b6d4"}</code></span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Limits */}
              <Card padding="md" bordered>
                <h3 className="text-xs font-bold text-ink-soft uppercase tracking-wider mb-4">Resource Utilization</h3>
                <div className="space-y-3">
                  <LimitBar label="Students" current={tenant.stats?.totalStudents || 0} max={tenant.limits?.maxStudents || 50} />
                  <LimitBar label="Faculty" current={tenant.stats?.totalTeachers || 0} max={tenant.limits?.maxTeachers || 5} />
                  <LimitBar label="Admins" current={tenant.stats?.totalAdmins || 0} max={tenant.limits?.maxAdmins || 1} />
                  <LimitBar label="Subjects" current={tenant.stats?.totalSubjects || 0} max={tenant.limits?.maxSubjects || 100} />
                </div>
              </Card>
            </div>

            {/* Actions */}
            <Card padding="md" bordered>
              <h3 className="text-xs font-bold text-ink-soft uppercase tracking-wider mb-3">Administrative Controls</h3>
              <div className="flex flex-wrap gap-2.5">
                <Button
                  onClick={() => setActiveTab("subscription")}
                  variant="primary"
                  size="sm"
                  leftIcon={CreditCard}
                >
                  Manage Subscription
                </Button>
                {tenant.subscription?.status !== "suspended" ? (
                  <Button
                    onClick={() => setConfirmModal({ type: "suspend" })}
                    variant="subtle"
                    size="sm"
                    leftIcon={Ban}
                    className="text-amber-600 hover:bg-amber-500/10"
                  >
                    Suspend Tenant
                  </Button>
                ) : (
                  <Button
                    onClick={() => setConfirmModal({ type: "activate" })}
                    variant="subtle"
                    size="sm"
                    leftIcon={CheckCircle}
                    className="text-emerald-600 hover:bg-emerald-500/10"
                  >
                    Activate Tenant
                  </Button>
                )}
                <Button
                  onClick={() => setConfirmModal({ type: "delete" })}
                  variant="dangerSubtle"
                  size="sm"
                  leftIcon={Trash2}
                >
                  Delete Tenant
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* ===== SUBSCRIPTION TAB ===== */}
        {activeTab === "subscription" && (
          <Card padding="md" bordered className="max-w-lg">
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-line/50">
              <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink">Update Subscription Tier</h3>
                <p className="text-xs text-ink-soft">Adjust plan, billing cycle and activation status</p>
              </div>
            </div>

            <div className="space-y-3.5">
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

              <div className="pt-2">
                <Button
                  onClick={handleUpdateSubscription}
                  disabled={actionLoading === "subscription" || (!subscriptionForm.plan && !subscriptionForm.status && !subscriptionForm.billingCycle)}
                  loading={actionLoading === "subscription"}
                  variant="primary"
                  size="sm"
                  leftIcon={Save}
                >
                  {actionLoading === "subscription" ? "Updating..." : "Save Subscription Changes"}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* ===== BILLING TAB ===== */}
        {activeTab === "billing" && (
          <div className="space-y-6">
            {/* Adjustment Form */}
            <Card padding="md" bordered className="max-w-lg">
              <div className="flex items-center gap-2 pb-3 mb-4 border-b border-line/50">
                <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink">Manual Billing Adjustment</h3>
                  <p className="text-xs text-ink-soft">Apply manual credit or debit ledger adjustment</p>
                </div>
              </div>

              <form onSubmit={handleAdjustBilling} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <Select
                    label="Type"
                    value={adjustmentForm.type}
                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, type: e.target.value })}
                  >
                    <option value="credit">Credit (+)</option>
                    <option value="debit">Debit (-)</option>
                  </Select>
                  <Input
                    label="Amount (INR)"
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
                  label="Adjustment Reason"
                  type="text"
                  value={adjustmentForm.reason}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, reason: e.target.value })}
                  placeholder="e.g. Promotional discount, dispute resolution..."
                  required
                />
                <Button
                  type="submit"
                  disabled={actionLoading === "adjust"}
                  loading={actionLoading === "adjust"}
                  variant="primary"
                  size="sm"
                  leftIcon={Plus}
                >
                  {actionLoading === "adjust" ? "Applying..." : "Apply Adjustment"}
                </Button>
              </form>
            </Card>

            {/* Transaction History */}
            <Card padding="md" bordered>
              <div className="flex items-center gap-2 pb-3 mb-4 border-b border-line/50">
                <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink">Transaction History</h3>
                  <p className="text-xs text-ink-soft">Billing invoices, adjustments and payment receipts</p>
                </div>
              </div>

              <Table
                columns={transactionColumns}
                data={transactions}
                rowKey="_id"
                emptyTitle="No transactions recorded"
                emptyMessage="No billing records have been generated for this institution."
              />
            </Card>
          </div>
        )}
      </div>

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
