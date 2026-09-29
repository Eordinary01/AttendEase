// src/component/SuperAdmin/PlanManager.jsx
// Redesigned with Academic Precision System (redesign/DESIGN.md)
// Enterprise Subscription Tiers, Module Entitlements, and Capacity Quotas
import React, { useState, useEffect } from "react";
import {
  Package,
  Plus,
  Edit,
  Trash2,
  Check,
  AlertCircle,
  Save,
  Crown,
  Sparkles,
  CheckCircle2,
  Layers,
  Users,
  HardDrive,
  RefreshCw,
  X,
} from "lucide-react";
import api from "../../utils/api";
import EmptyState from "../common/ui/EmptyState";
import Modal from "../common/ui/Modal";

const MODULE_KEYS = [
  { key: "attendance", label: "Attendance Engine" },
  { key: "timetable", label: "Timetable & Schedules" },
  { key: "customRoles", label: "Custom RBAC Roles" },
  { key: "examManagement", label: "Examinations & Seating" },
  { key: "financeManagement", label: "Fees & Ledger" },
  { key: "libraryManagement", label: "Library Catalog" },
  { key: "hrManagement", label: "HR & Staff Leaves" },
  { key: "parentPortal", label: "Parent & Guardian Portal" },
  { key: "analytics", label: "Institutional Analytics" },
  { key: "apiAccess", label: "REST API Gateway" },
  { key: "customBranding", label: "Custom Domain & Branding" },
  { key: "dataExport", label: "Automated Data Exports" },
  { key: "bulkOperations", label: "Bulk Student Imports" },
  { key: "whiteLabel", label: "Full White-labeling" },
  { key: "prioritySupport", label: "Priority Helpdesk SLA" },
  { key: "dedicatedSupport", label: "Dedicated Account Director" },
];

const PlanManager = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    monthly: 0,
    yearly: 0,
    currency: "INR",
    maxStudents: 50,
    maxTeachers: 5,
    maxAdmins: 1,
    maxStorageMB: 100,
    sortOrder: 0,
    isPopular: false,
    modules: {},
  });

  useEffect(() => {
    fetchPlans();
  }, []);

  useEffect(() => {
    if (error || success) {
      const t = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, 4000);
      return () => clearTimeout(t);
    }
  }, [error, success]);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const res = await api.get("/billing/plans");
      setPlans(res.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch plans");
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingPlan(null);
    setFormData({
      name: "",
      code: "",
      description: "",
      monthly: 0,
      yearly: 0,
      currency: "INR",
      maxStudents: 50,
      maxTeachers: 5,
      maxAdmins: 1,
      maxStorageMB: 100,
      sortOrder: 0,
      isPopular: false,
      modules: {},
    });
    setShowForm(true);
  };

  const openEdit = (plan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      code: plan.code,
      description: plan.description || "",
      monthly: plan.pricing?.monthly || 0,
      yearly: plan.pricing?.yearly || 0,
      currency: plan.pricing?.currency || "INR",
      maxStudents: plan.limits?.maxStudents || 50,
      maxTeachers: plan.limits?.maxTeachers || 5,
      maxAdmins: plan.limits?.maxAdmins || 1,
      maxStorageMB: plan.limits?.maxStorageMB || 100,
      sortOrder: plan.sortOrder || 0,
      isPopular: plan.isPopular || false,
      modules: plan.modules || {},
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.code) {
      setError("Plan Name and Unique Code are required");
      return;
    }
    try {
      const payload = {
        name: formData.name,
        code: formData.code,
        description: formData.description,
        pricing: {
          monthly: parseFloat(formData.monthly),
          yearly: parseFloat(formData.yearly),
          currency: formData.currency,
        },
        limits: {
          maxStudents: parseInt(formData.maxStudents),
          maxTeachers: parseInt(formData.maxTeachers),
          maxAdmins: parseInt(formData.maxAdmins),
          maxStorageMB: parseInt(formData.maxStorageMB),
        },
        modules: formData.modules,
        sortOrder: parseInt(formData.sortOrder),
        isPopular: formData.isPopular,
      };

      if (editingPlan) {
        await api.put(`/admin/plans/${editingPlan._id}`, payload);
        setSuccess("Plan tier updated successfully");
      } else {
        await api.post("/admin/plans", payload);
        setSuccess("New plan tier provisioned successfully");
      }
      setShowForm(false);
      fetchPlans();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save plan");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Deactivate this subscription plan tier?")) return;
    try {
      await api.delete(`/admin/plans/${id}`);
      setSuccess("Plan deactivated successfully");
      fetchPlans();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete plan");
    }
  };

  const toggleModule = (key) => {
    setFormData((prev) => ({
      ...prev,
      modules: { ...prev.modules, [key]: !prev.modules[key] },
    }));
  };

  const formatCurrency = (amount, currency = "INR") => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  return (
    <div className="space-y-6 font-sans antialiased text-slate-900">
      {/* 1. Header Strip */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Subscription Tiers & Licensing Plans
            </h1>
          </div>
          <p className="text-sm text-slate-500 max-w-2xl leading-relaxed">
            Configure institutional pricing tiers, user quotas, storage caps, and feature module entitlements.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchPlans}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-xs transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5 text-primary" />
            <span>Refresh</span>
          </button>

          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-semibold shadow-sm transition-all hover:shadow hover:-translate-y-0.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create New Plan</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {success && (
        <div className="rounded-xl p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Plans Grid */}
      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-80 bg-white rounded-2xl border border-slate-200/80 p-6 animate-pulse" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <EmptyState
          title="No subscription plans configured"
          description="Create your initial pricing tiers to begin onboarding institution campuses."
          icon={Package}
        />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans
            .filter((p) => p.isActive !== false)
            .map((plan) => (
              <div
                key={plan._id}
                className={`bg-white rounded-2xl border shadow-sm transition-all flex flex-col justify-between relative p-6 group ${
                  plan.isPopular
                    ? "border-primary/80 ring-2 ring-primary/10 hover:shadow-md"
                    : "border-slate-200/90 hover:border-slate-300 hover:shadow-md"
                }`}
              >
                {/* Popular Ribbon */}
                {plan.isPopular && (
                  <div className="absolute -top-3 right-6 bg-primary text-white text-[10px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    <span>Recommended</span>
                  </div>
                )}

                <div>
                  {/* Title & Code */}
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-primary transition-colors">
                      {plan.name}
                    </h3>
                    <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      {plan.code}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 mb-4 min-h-[32px] leading-relaxed">
                    {plan.description || "Comprehensive campus operations package."}
                  </p>

                  {/* Pricing Display */}
                  <div className="pb-4 mb-4 border-b border-slate-100">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-slate-900 tabular-nums font-sans">
                        {formatCurrency(plan.pricing?.monthly, plan.pricing?.currency)}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">/ month</span>
                    </div>
                    {plan.pricing?.yearly > 0 && (
                      <span className="text-[11px] text-slate-500 font-mono mt-0.5 block">
                        or {formatCurrency(plan.pricing?.yearly, plan.pricing?.currency)} billed annually
                      </span>
                    )}
                  </div>

                  {/* Quota Highlights */}
                  <div className="grid grid-cols-2 gap-2 text-xs mb-5">
                    <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Students</span>
                      <span className="font-mono font-bold text-slate-900">
                        {plan.limits?.maxStudents?.toLocaleString() || "Unlimited"}
                      </span>
                    </div>
                    <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Faculty</span>
                      <span className="font-mono font-bold text-slate-900">
                        {plan.limits?.maxTeachers?.toLocaleString() || "Unlimited"}
                      </span>
                    </div>
                    <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Admins</span>
                      <span className="font-mono font-bold text-slate-900">
                        {plan.limits?.maxAdmins?.toLocaleString() || "1"}
                      </span>
                    </div>
                    <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Vault Storage</span>
                      <span className="font-mono font-bold text-slate-900">
                        {plan.limits?.maxStorageMB ? `${plan.limits.maxStorageMB} MB` : "Shared"}
                      </span>
                    </div>
                  </div>

                  {/* Entitlement Modules */}
                  <div className="space-y-1.5 text-xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                      Included Capabilities
                    </span>
                    {MODULE_KEYS.filter((m) => plan.modules?.[m.key]).slice(0, 6).map((m) => (
                      <div key={m.key} className="flex items-center gap-2 text-slate-700">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate">{m.label}</span>
                      </div>
                    ))}
                    {Object.values(plan.modules || {}).filter(Boolean).length > 6 && (
                      <span className="text-[11px] text-primary font-semibold block pt-1">
                        + {Object.values(plan.modules || {}).filter(Boolean).length - 6} more modules
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="flex items-center justify-between pt-4 mt-6 border-t border-slate-100">
                  <button
                    onClick={() => openEdit(plan)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-primary hover:bg-slate-50 rounded-xl transition"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Edit Tier</span>
                  </button>

                  <button
                    onClick={() => handleDelete(plan._id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    title="Deactivate Tier"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* 3. Create / Edit Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editingPlan ? `Edit Tier: ${editingPlan.name}` : "Create New Subscription Plan"}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Plan Name *</label>
              <input
                type="text"
                placeholder="e.g. University Enterprise"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 text-slate-900"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Plan Code *</label>
              <input
                type="text"
                placeholder="e.g. enterprise_v2"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 font-mono text-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Description</label>
            <textarea
              rows={2}
              placeholder="Short description of this tier's target institution profile..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 text-slate-900"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Monthly Rate (INR)</label>
              <input
                type="number"
                min="0"
                value={formData.monthly}
                onChange={(e) => setFormData({ ...formData, monthly: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 outline-none"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Yearly Rate (INR)</label>
              <input
                type="number"
                min="0"
                value={formData.yearly}
                onChange={(e) => setFormData({ ...formData, yearly: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 outline-none"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Display Sort Order</label>
              <input
                type="number"
                value={formData.sortOrder}
                onChange={(e) => setFormData({ ...formData, sortOrder: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Max Students</label>
              <input
                type="number"
                value={formData.maxStudents}
                onChange={(e) => setFormData({ ...formData, maxStudents: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 outline-none"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Max Faculty</label>
              <input
                type="number"
                value={formData.maxTeachers}
                onChange={(e) => setFormData({ ...formData, maxTeachers: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 outline-none"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Max Admins</label>
              <input
                type="number"
                value={formData.maxAdmins}
                onChange={(e) => setFormData({ ...formData, maxAdmins: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 outline-none"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Storage (MB)</label>
              <input
                type="number"
                value={formData.maxStorageMB}
                onChange={(e) => setFormData({ ...formData, maxStorageMB: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isPopular"
              checked={formData.isPopular}
              onChange={(e) => setFormData({ ...formData, isPopular: e.target.checked })}
              className="w-4 h-4 rounded text-primary border-slate-300 focus:ring-primary/20 accent-primary"
            />
            <label htmlFor="isPopular" className="text-xs font-semibold text-slate-700">
              Highlight as "Recommended / Most Popular" Tier
            </label>
          </div>

          {/* Module Entitlements Matrix */}
          <div className="pt-2 border-t border-slate-100">
            <span className="block font-bold text-slate-700 mb-2">Module Entitlements</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
              {MODULE_KEYS.map((m) => {
                const active = !!formData.modules[m.key];
                return (
                  <button
                    type="button"
                    key={m.key}
                    onClick={() => toggleModule(m.key)}
                    className={`flex items-center justify-between p-2 rounded-lg border text-left transition ${
                      active
                        ? "bg-primary-soft border-primary-surface text-primary-dark"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <span className="text-xs font-medium truncate">{m.label}</span>
                    <span
                      className={`w-4 h-4 rounded flex items-center justify-center text-[10px] ${
                        active ? "bg-primary text-white" : "border border-slate-300"
                      }`}
                    >
                      {active && <Check className="w-3 h-3" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-primary hover:bg-primary-dark text-white font-semibold rounded-xl shadow-sm transition text-xs"
            >
              {editingPlan ? "Update Tier" : "Create Plan Tier"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default PlanManager;
