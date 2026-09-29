// src/components/SuperAdmin/TenantDetails.jsx
// Redesigned with Academic Precision System (redesign/DESIGN.md)
// Enterprise Tenant State, Quota Controls, Cryptographic Schemas & Ledger Adjustments
import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../utils/api";
import { formatDateDMY } from "../../utils/dateUtils";
import { logError } from "../../utils/logger";
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
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import Modal from "../common/ui/Modal";

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
      const response = await api.get(`/admin/super/tenants/${tenantId}`);
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
      const response = await api.get(`/billing/admin/tenants/${tenantId}/transactions`);
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

      const response = await api.put(`/admin/super/tenants/${tenantId}/subscription`, body);
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
      const response = await api.post(`/billing/admin/tenants/${tenantId}/adjust`, {
        amount: parseFloat(adjustmentForm.amount),
        reason: adjustmentForm.reason,
        type: adjustmentForm.type,
      });
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

  const tabs = [
    { id: "overview", label: "Campus Overview", icon: <Building2 className="w-3.5 h-3.5" /> },
    { id: "subscription", label: "Subscription Tier", icon: <CreditCard className="w-3.5 h-3.5" /> },
    { id: "billing", label: "Billing & Ledger", icon: <Receipt className="w-3.5 h-3.5" /> },
  ];

  if (loading) {
    return (
      <div className="space-y-6 font-sans antialiased">
        <div className="h-20 bg-white rounded-2xl border border-slate-200/80 p-6 animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-white rounded-2xl border border-slate-200/80 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-6 min-h-[60vh] font-sans">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-8 max-w-md w-full text-center shadow-sm">
          <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-200">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Error Loading Campus Details</h2>
          <p className="text-xs text-slate-500 mb-6">{error}</p>
          <div className="flex justify-center gap-2.5">
            <button
              onClick={() => navigate("/super-admin/tenants")}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
            >
              Back to Directory
            </button>
            <button
              onClick={fetchTenantDetails}
              className="px-4 py-2 bg-primary hover:bg-primary-dark text-white text-xs font-semibold rounded-xl transition"
            >
              Retry Connection
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!tenant) return null;

  const status = tenant.subscription?.status || "trial";
  const plan = tenant.subscription?.plan || "free";

  return (
    <div className="space-y-6 font-sans antialiased text-slate-900">
      {/* 1. Header Strip */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-1">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/super-admin/tenants")}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition shadow-xs"
            title="Back to Directory"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {tenant.name}
              </h1>
              <span
                className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider font-mono ${
                  plan === "enterprise"
                    ? "bg-primary-soft text-primary-dark border border-primary-surface"
                    : plan === "professional"
                    ? "bg-purple-50 text-purple-700 border border-purple-200"
                    : "bg-slate-100 text-slate-700 border border-slate-200"
                }`}
              >
                {plan}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full border ${
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
            </div>
            <p className="text-xs text-slate-500 font-mono mt-1">
              {tenant.subdomain ? `${tenant.subdomain}.attendease.com` : "Domain unassigned"} • Provisioned {formatDateDMY(tenant.createdAt)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchTenantDetails}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-xs transition-all active:scale-[0.98]"
          >
            <RefreshCw className="w-3.5 h-3.5 text-primary" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 2. Navigation Tabs */}
      <div className="inline-flex items-center gap-1.5 p-1 bg-slate-100 border border-slate-200 rounded-xl">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === tab.id
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* 3. Tab Contents */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Top 4 Capacity Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">Students</span>
                <GraduationCap className="w-4 h-4 text-primary" />
              </div>
              <p className="text-2xl font-black text-slate-900 tabular-nums">
                {(tenant.stats?.totalStudents || 0).toLocaleString()}
              </p>
              <span className="text-[11px] text-slate-400 font-medium mt-1 block">Enrolled Roster</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">Faculty</span>
                <Users className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-black text-slate-900 tabular-nums">
                {(tenant.stats?.totalTeachers || 0).toLocaleString()}
              </p>
              <span className="text-[11px] text-slate-400 font-medium mt-1 block">Active Teachers</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">Campus Admins</span>
                <UserCog className="w-4 h-4 text-purple-600" />
              </div>
              <p className="text-2xl font-black text-slate-900 tabular-nums">
                {(tenant.stats?.totalAdmins || 0).toLocaleString()}
              </p>
              <span className="text-[11px] text-slate-400 font-medium mt-1 block">Role Administrators</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">Subjects</span>
                <BookOpen className="w-4 h-4 text-amber-600" />
              </div>
              <p className="text-2xl font-black text-slate-900 tabular-nums">
                {(tenant.stats?.totalSubjects || 0).toLocaleString()}
              </p>
              <span className="text-[11px] text-slate-400 font-medium mt-1 block">Active Courses</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Contact Information */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-3">
                Institutional Contact Records
              </h3>
              <div className="space-y-3 text-xs">
                <InfoRow icon={<Mail className="w-4 h-4 text-slate-400" />} label="Email Address" value={tenant.contact?.email || "—"} />
                <InfoRow icon={<Phone className="w-4 h-4 text-slate-400" />} label="Phone Contact" value={tenant.contact?.phone || "—"} />
                <InfoRow icon={<MapPin className="w-4 h-4 text-slate-400" />} label="Street Address" value={tenant.contact?.address || "—"} />
                <InfoRow icon={<Globe className="w-4 h-4 text-slate-400" />} label="City / State" value={`${tenant.contact?.city || "—"}, ${tenant.contact?.state || "—"}`} />
                <InfoRow icon={<Globe className="w-4 h-4 text-slate-400" />} label="Jurisdiction" value={tenant.contact?.country || "—"} />
              </div>
            </div>

            {/* Subscription Summary */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-3">
                Licensing & Agreement
              </h3>
              <div className="space-y-3 text-xs">
                <InfoRow label="Subscription Plan" value={<span className="font-bold text-primary-dark uppercase font-mono">{plan}</span>} />
                <InfoRow label="Agreement Status" value={<span className="font-bold capitalize">{status}</span>} />
                <InfoRow label="Billing Cadence" value={<span className="capitalize">{tenant.subscription?.billingCycle || "monthly"}</span>} />
                <InfoRow icon={<Calendar className="w-4 h-4 text-slate-400" />} label="Provisioned On" value={formatDateDMY(tenant.subscription?.startDate)} />
                {status === "trial" && (
                  <InfoRow icon={<Calendar className="w-4 h-4 text-amber-500" />} label="Trial Expiration" value={formatDateDMY(tenant.subscription?.trialEndsAt)} />
                )}
              </div>
            </div>

            {/* Campus Identity & Branding */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-3">
                Campus Identity & Domain
              </h3>
              <div className="flex items-center gap-5">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-xs shrink-0"
                  style={{ backgroundColor: tenant.branding?.primaryColor || "#4338ca" }}
                >
                  {tenant.name?.[0]?.toUpperCase() || "T"}
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded-md border border-slate-300" style={{ backgroundColor: tenant.branding?.primaryColor || "#4338ca" }} />
                    <span className="text-slate-600 font-mono">Primary: <span className="font-bold text-slate-900">{tenant.branding?.primaryColor || "#4338ca"}</span></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded-md border border-slate-300" style={{ backgroundColor: tenant.branding?.secondaryColor || "#059669" }} />
                    <span className="text-slate-600 font-mono">Secondary: <span className="font-bold text-slate-900">{tenant.branding?.secondaryColor || "#059669"}</span></span>
                  </div>
                </div>
              </div>
            </div>

            {/* Resource Limits Utilization */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-3">
                Resource Utilization Quotas
              </h3>
              <div className="space-y-3">
                <LimitBar label="Student Seats" current={tenant.stats?.totalStudents || 0} max={tenant.limits?.maxStudents || 50} />
                <LimitBar label="Faculty Seats" current={tenant.stats?.totalTeachers || 0} max={tenant.limits?.maxTeachers || 5} />
                <LimitBar label="Admin Accounts" current={tenant.stats?.totalAdmins || 0} max={tenant.limits?.maxAdmins || 1} />
                <LimitBar label="Active Subjects" current={tenant.stats?.totalSubjects || 0} max={tenant.limits?.maxSubjects || 100} />
              </div>
            </div>
          </div>

          {/* Administrative Actions */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Administrative Actions</h3>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setActiveTab("subscription")}
                className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-semibold shadow-sm transition"
              >
                Manage Subscription Tier
              </button>

              {status !== "suspended" ? (
                <button
                  onClick={() => setConfirmModal({ type: "suspend" })}
                  className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-xs font-semibold transition"
                >
                  Suspend Campus Schema
                </button>
              ) : (
                <button
                  onClick={() => setConfirmModal({ type: "activate" })}
                  className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold transition"
                >
                  Activate Campus Schema
                </button>
              )}

              <button
                onClick={() => setConfirmModal({ type: "delete" })}
                className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold transition"
              >
                Delete Instance Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== SUBSCRIPTION TAB ===== */}
      {activeTab === "subscription" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm max-w-xl space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900">Configure Subscription Agreement</h3>
            <p className="text-xs text-slate-500 mt-0.5">Adjust license tier, billing frequency, and account operational state</p>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">Plan Tier</label>
              <select
                value={subscriptionForm.plan}
                onChange={(e) => setSubscriptionForm({ ...subscriptionForm, plan: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="">— Select Plan —</option>
                <option value="free">Free Tier</option>
                <option value="basic">Basic Tier</option>
                <option value="professional">Professional Tier</option>
                <option value="enterprise">Enterprise Tier</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5">Operational Status</label>
              <select
                value={subscriptionForm.status}
                onChange={(e) => setSubscriptionForm({ ...subscriptionForm, status: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="">— Select Status —</option>
                <option value="active">Active (Production Access)</option>
                <option value="trial">Trial (Sandbox Timeframe)</option>
                <option value="suspended">Suspended (Access Gated)</option>
                <option value="expired">Expired (Requires Renewal)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5">Billing Cadence</label>
              <select
                value={subscriptionForm.billingCycle}
                onChange={(e) => setSubscriptionForm({ ...subscriptionForm, billingCycle: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="">— Select Cadence —</option>
                <option value="monthly">Monthly Invoicing</option>
                <option value="yearly">Yearly Invoicing</option>
              </select>
            </div>

            <div className="pt-2">
              <button
                onClick={handleUpdateSubscription}
                disabled={actionLoading === "subscription"}
                className="px-5 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>{actionLoading === "subscription" ? "Updating Agreement…" : "Save Subscription Changes"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== BILLING TAB ===== */}
      {activeTab === "billing" && (
        <div className="space-y-6">
          {/* Manual Adjustment Form */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm max-w-xl space-y-4">
            <div className="pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Manual Ledger Adjustment</h3>
              <p className="text-xs text-slate-500 mt-0.5">Apply financial credit or invoice debit adjustment</p>
            </div>

            <form onSubmit={handleAdjustBilling} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">Adjustment Type</label>
                  <select
                    value={adjustmentForm.type}
                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, type: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="credit">Credit Balance (+)</option>
                    <option value="debit">Debit Charge (-)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">Amount (INR)</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={adjustmentForm.amount}
                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, amount: e.target.value })}
                    placeholder="0.00"
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Ledger Reason / Remarks</label>
                <input
                  type="text"
                  value={adjustmentForm.reason}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, reason: e.target.value })}
                  placeholder="e.g. Contractual concession, statutory waiver, offline cheque settlement..."
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <button
                type="submit"
                disabled={actionLoading === "adjust"}
                className="px-5 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>{actionLoading === "adjust" ? "Applying Entry…" : "Commit Ledger Entry"}</span>
              </button>
            </form>
          </div>

          {/* Transactions Table */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Transaction History</h3>
              <p className="text-xs text-slate-500 mt-0.5">Billing statements, invoices, and manual adjustments</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-5">Invoice Reference</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Agreement Plan</th>
                    <th className="py-3 px-5 text-right">Transaction Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.length > 0 ? (
                    transactions.map((tx) => (
                      <tr key={tx._id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-5 font-mono font-semibold text-slate-900">
                          {tx.invoiceNumber || "—"}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900 tabular-nums">
                          ₹{(tx.amount || 0).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              tx.status === "paid"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : tx.status === "pending"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}
                          >
                            {tx.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 capitalize">
                          {tx.plan || "—"}
                        </td>
                        <td className="py-3.5 px-5 text-right text-slate-500 font-mono">
                          {formatDateDMY(tx.paidAt || tx.createdAt)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        No financial transactions recorded for this institution.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <Modal
        isOpen={!!confirmModal}
        onClose={() => setConfirmModal(null)}
        title={
          confirmModal?.type === "delete"
            ? "Delete Campus Instance"
            : confirmModal?.type === "suspend"
            ? "Suspend Campus Schema"
            : "Activate Campus Schema"
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
                if (confirmModal.type === "delete") handleDelete();
                else if (confirmModal.type === "suspend") handleSuspend();
                else handleActivate();
              }}
              disabled={actionLoading}
              className={`px-4 py-2 text-xs font-semibold rounded-xl text-white transition ${
                confirmModal?.type === "delete"
                  ? "bg-rose-600 hover:bg-rose-700"
                  : confirmModal?.type === "suspend"
                  ? "bg-amber-600 hover:bg-amber-700"
                  : "bg-emerald-600 hover:bg-emerald-700"
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
            ? `Are you sure you want to permanently delete "${tenant.name}"? This will drop the database partition and permanently remove ALL associated student records, academic timetables, and audit history. This action cannot be undone.`
            : confirmModal?.type === "suspend"
            ? `Are you sure you want to suspend "${tenant.name}"? All users and APIs for this campus will immediately be blocked.`
            : `Are you sure you want to restore active access for "${tenant.name}"? All portals and scheduled tasks will resume.`}
        </p>
      </Modal>
    </div>
  );
};

// Sub-components
const InfoRow = ({ icon, label, value }) => (
  <div className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
    <span className="flex items-center gap-2 text-slate-500 font-medium">
      {icon}
      <span>{label}</span>
    </span>
    <span className="font-semibold text-slate-900">{value}</span>
  </div>
);

const LimitBar = ({ label, current, max }) => {
  const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0;
  const isOver = current >= max;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-slate-600 font-medium">{label}</span>
        <span className={`font-mono font-bold ${isOver ? "text-rose-600" : "text-slate-900"}`}>
          {current} <span className="text-slate-400 font-normal">/ {max}</span>
        </span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${isOver ? "bg-rose-500" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

export default TenantDetails;
