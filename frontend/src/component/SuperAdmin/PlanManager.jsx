import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Package, Plus, Edit, Trash2, Check, AlertCircle, Save, Crown, Sparkles, CheckCircle2 } from "lucide-react";
import api from "../../utils/api";
import Button from "../common/ui/Button";
import Card from "../common/ui/Card";
import Modal from "../common/ui/Modal";
import Badge from "../common/ui/Badge";
import Input, { Textarea } from "../common/ui/Input";
import EmptyState from "../common/ui/EmptyState";
import DashboardHeader from "../common/ui/DashboardHeader";

const MODULE_KEYS = [
  "attendance", "timetable", "customRoles", "examManagement", "financeManagement", "libraryManagement",
  "hrManagement", "parentPortal", "analytics", "apiAccess", "customBranding",
  "dataExport", "bulkOperations", "whiteLabel", "prioritySupport", "dedicatedSupport",
];

const PlanManager = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [formData, setFormData] = useState({
    name: "", code: "", description: "", monthly: 0, yearly: 0, currency: "INR",
    maxStudents: 50, maxTeachers: 5, maxAdmins: 1, maxStorageMB: 100, sortOrder: 0,
    isPopular: false, modules: {},
  });

  useEffect(() => { fetchPlans(); }, []);

  useEffect(() => {
    if (error || success) {
      const t = setTimeout(() => { setError(null); setSuccess(null); }, 4000);
      return () => clearTimeout(t);
    }
  }, [error, success]);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const res = await api.get('/billing/plans');
      setPlans(res.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch plans");
    } finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditingPlan(null);
    setFormData({
      name: "", code: "", description: "", monthly: 0, yearly: 0, currency: "INR",
      maxStudents: 50, maxTeachers: 5, maxAdmins: 1, maxStorageMB: 100, sortOrder: 0,
      isPopular: false, modules: {},
    });
    setShowForm(true);
  };

  const openEdit = (plan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name, code: plan.code, description: plan.description || "",
      monthly: plan.pricing?.monthly || 0, yearly: plan.pricing?.yearly || 0,
      currency: plan.pricing?.currency || "INR",
      maxStudents: plan.limits?.maxStudents || 50, maxTeachers: plan.limits?.maxTeachers || 5,
      maxAdmins: plan.limits?.maxAdmins || 1, maxStorageMB: plan.limits?.maxStorageMB || 100,
      sortOrder: plan.sortOrder || 0, isPopular: plan.isPopular || false,
      modules: plan.modules || {},
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.code) { setError("Name and code are required"); return; }
    try {
      const payload = {
        name: formData.name, code: formData.code, description: formData.description,
        pricing: { monthly: parseFloat(formData.monthly), yearly: parseFloat(formData.yearly), currency: formData.currency },
        limits: { maxStudents: parseInt(formData.maxStudents), maxTeachers: parseInt(formData.maxTeachers), maxAdmins: parseInt(formData.maxAdmins), maxStorageMB: parseInt(formData.maxStorageMB) },
        modules: formData.modules, sortOrder: parseInt(formData.sortOrder), isPopular: formData.isPopular,
      };

      if (editingPlan) {
        await api.put(`/admin/plans/${editingPlan._id}`, payload);
        setSuccess("Plan updated successfully");
      } else {
        await api.post('/admin/plans', payload);
        setSuccess("Plan created successfully");
      }
      setShowForm(false);
      fetchPlans();
    } catch (err) { setError(err.response?.data?.message || "Failed to save plan"); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Deactivate this plan?")) return;
    try {
      await api.delete(`/admin/plans/${id}`);
      setSuccess("Plan deactivated successfully");
      fetchPlans();
    } catch (err) { setError(err.response?.data?.message || "Failed to delete plan"); }
  };

  const toggleModule = (key) => {
    setFormData(prev => ({
      ...prev,
      modules: { ...prev.modules, [key]: !prev.modules[key] },
    }));
  };

  const formatCurrency = (amount, currency = "INR") => {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, minimumFractionDigits: 0 }).format(amount || 0);
  };

  return (
    <div className="space-y-6">
      <DashboardHeader
        greeting="Subscription Tier Management"
        meta="Configure institution pricing tiers, user quotas, storage limits & feature entitlement modules"
        actions={
          <Button onClick={openCreate} size="sm" variant="primary" leftIcon={Plus}>
            Create New Plan
          </Button>
        }
      />

      {success && (
        <div className="rounded-xl p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-80 bg-surface rounded-2xl border border-line/50 p-6 animate-pulse" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <EmptyState
          title="No subscription plans found"
          description="Create your first pricing tier to begin onboarding institutions."
          icon={Package}
          action={<Button onClick={openCreate} size="sm" leftIcon={Plus}>Create Plan</Button>}
        />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.filter(p => p.isActive !== false).map(plan => (
            <div
              key={plan._id}
              className={`bg-surface rounded-2xl border transition shadow-sm overflow-hidden flex flex-col justify-between ${
                plan.isPopular ? "border-primary/50 ring-1 ring-primary/20" : "border-line/50"
              }`}
            >
              <div className="p-6 border-b border-line/50 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-ink">{plan.name}</h3>
                    <span className="text-[11px] text-ink-faint uppercase font-mono font-bold">{plan.code}</span>
                  </div>
                  {plan.isPopular && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
                      <Crown className="w-3 h-3" /> Popular
                    </span>
                  )}
                </div>

                {plan.description && (
                  <p className="text-xs text-ink-soft leading-relaxed">{plan.description}</p>
                )}

                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-ink">{formatCurrency(plan.pricing?.monthly, plan.pricing?.currency)}</span>
                    <span className="text-xs font-medium text-ink-soft">/ month</span>
                  </div>
                  <p className="text-[11px] text-ink-faint mt-0.5">{formatCurrency(plan.pricing?.yearly, plan.pricing?.currency)} billed annually</p>
                </div>
              </div>

              <div className="p-6 space-y-5 flex-1 flex flex-col justify-between">
                <div className="space-y-4">
                  <div>
                    <p className="text-[11px] text-ink-faint uppercase font-bold tracking-wider mb-2">Resource Limits</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded-xl bg-background border border-line/50">
                        <span className="text-ink-faint text-[10px] uppercase font-semibold">Students</span>
                        <p className="font-bold text-ink mt-0.5">{plan.limits?.maxStudents?.toLocaleString() || "Unlimited"}</p>
                      </div>
                      <div className="p-2 rounded-xl bg-background border border-line/50">
                        <span className="text-ink-faint text-[10px] uppercase font-semibold">Faculty</span>
                        <p className="font-bold text-ink mt-0.5">{plan.limits?.maxTeachers?.toLocaleString() || "Unlimited"}</p>
                      </div>
                      <div className="p-2 rounded-xl bg-background border border-line/50">
                        <span className="text-ink-faint text-[10px] uppercase font-semibold">Admins</span>
                        <p className="font-bold text-ink mt-0.5">{plan.limits?.maxAdmins || 1}</p>
                      </div>
                      <div className="p-2 rounded-xl bg-background border border-line/50">
                        <span className="text-ink-faint text-[10px] uppercase font-semibold">Storage</span>
                        <p className="font-bold text-ink mt-0.5">{plan.limits?.maxStorageMB >= 1024 ? `${plan.limits.maxStorageMB / 1024} GB` : `${plan.limits?.maxStorageMB || 100} MB`}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] text-ink-faint uppercase font-bold tracking-wider mb-2">Enabled Modules</p>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {MODULE_KEYS.filter(k => plan.modules?.[k]).sort().map(k => (
                        <div key={k} className="flex items-center gap-2 text-xs text-ink-soft">
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{k.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase()).trim()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-4 border-t border-line/50">
                  <Button onClick={() => openEdit(plan)} variant="subtle" size="sm" leftIcon={Edit} className="flex-1">
                    Edit Plan
                  </Button>
                  <Button onClick={() => handleDelete(plan._id)} variant="dangerSubtle" size="sm">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Plan Form Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingPlan ? "Edit Plan Configuration" : "Create Subscription Plan"} size="xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid md:grid-cols-2 gap-3.5">
            <div>
              <Input label="Plan Name *" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} required placeholder="e.g., Enterprise Campus" />
            </div>
            <div>
              <Input label="Plan Code *" value={formData.code} onChange={e => setFormData(p => ({ ...p, code: e.target.value }))} required placeholder="e.g. enterprise" disabled={!!editingPlan} />
            </div>
            <div className="md:col-span-2">
              <Textarea label="Plan Description" value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} rows={2} className="resize-none" placeholder="Target audience and bundle overview..." />
            </div>
            <div>
              <Input label="Monthly Price (INR)" type="number" value={formData.monthly} onChange={e => setFormData(p => ({ ...p, monthly: e.target.value }))} min="0" />
            </div>
            <div>
              <Input label="Yearly Price (INR)" type="number" value={formData.yearly} onChange={e => setFormData(p => ({ ...p, yearly: e.target.value }))} min="0" />
            </div>
            <div>
              <Input label="Max Students Limit" type="number" value={formData.maxStudents} onChange={e => setFormData(p => ({ ...p, maxStudents: e.target.value }))} min="1" />
            </div>
            <div>
              <Input label="Max Teachers Limit" type="number" value={formData.maxTeachers} onChange={e => setFormData(p => ({ ...p, maxTeachers: e.target.value }))} min="1" />
            </div>
            <div>
              <Input label="Max Admins Limit" type="number" value={formData.maxAdmins} onChange={e => setFormData(p => ({ ...p, maxAdmins: e.target.value }))} min="1" />
            </div>
            <div>
              <Input label="Storage Allocation (MB)" type="number" value={formData.maxStorageMB} onChange={e => setFormData(p => ({ ...p, maxStorageMB: e.target.value }))} min="1" />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-ink">
                <input type="checkbox" checked={formData.isPopular} onChange={e => setFormData(p => ({ ...p, isPopular: e.target.checked }))} className="rounded border-line/50 text-primary focus:ring-primary" />
                <span>Feature as Popular Tier</span>
              </label>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-ink-soft uppercase tracking-wider mb-2.5">Entitlement Modules</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {MODULE_KEYS.map(key => (
                <label key={key} className="flex items-center gap-2 p-2.5 hover:bg-background rounded-xl cursor-pointer border border-line/50 transition">
                  <input type="checkbox" checked={!!formData.modules[key]} onChange={() => toggleModule(key)} className="rounded border-line/50 text-primary focus:ring-primary" />
                  <span className="text-xs font-medium text-ink">{key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase()).trim()}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-line/50">
            <Button type="button" variant="subtle" size="sm" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" variant="primary" leftIcon={Save}>
              {editingPlan ? "Save Changes" : "Create Plan"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default PlanManager;
