import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Package, Plus, Edit, Trash2, Check, AlertCircle, Save, Crown } from "lucide-react";
import api from "../../utils/api";
import Button from "../common/ui/Button";
import Card from "../common/ui/Card";
import Modal from "../common/ui/Modal";
import Badge from "../common/ui/Badge";
import Input, { Textarea } from "../common/ui/Input";
import EmptyState from "../common/ui/EmptyState";
import PageHeader from "../common/ui/PageHeader";

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
        setSuccess("Plan updated");
      } else {
        await api.post('/admin/plans', payload);
        setSuccess("Plan created");
      }
      setShowForm(false);
      fetchPlans();
    } catch (err) { setError(err.response?.data?.message || "Failed to save plan"); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Deactivate this plan?")) return;
    try {
      await api.delete(`/admin/plans/${id}`);
      setSuccess("Plan deactivated");
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
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, minimumFractionDigits: 0 }).format(amount);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <PageHeader
        title="Plan Management"
        subtitle="Create and manage subscription plans"
        icon={Package}
        actions={
          <Button onClick={openCreate} leftIcon={Plus}>
            Create Plan
          </Button>
        }
      />



      {loading ? (
        <div className="text-center py-12 text-ink-soft">Loading...</div>
      ) : plans.length === 0 ? (
        <EmptyState
          title="No plans found"
          description="No plans have been created yet."
          icon={Package}
        />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.filter(p => p.isActive !== false).map(plan => (
            <Card key={plan._id} padding="none" className="overflow-hidden">
              <div className="p-6 border-b border-line">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-lg font-bold text-ink">{plan.name}</h3>
                    <p className="text-xs text-ink-faint uppercase font-mono">{plan.code}</p>
                  </div>
                  {plan.isPopular && <Badge tone="warning"><Crown className="w-3 h-3" /> Popular</Badge>}
                </div>
                {plan.description && <p className="text-sm text-ink-soft">{plan.description}</p>}
                <div className="mt-4">
                  <p className="text-2xl font-bold text-ink">{formatCurrency(plan.pricing?.monthly, plan.pricing?.currency)}<span className="text-sm font-normal text-ink-soft">/mo</span></p>
                  <p className="text-sm text-ink-soft">{formatCurrency(plan.pricing?.yearly, plan.pricing?.currency)}/year</p>
                </div>
              </div>
              <div className="p-6">
                <div className="space-y-2 mb-4">
                  <p className="text-xs text-ink-faint uppercase font-semibold">Limits</p>
                  <p className="text-sm text-ink-soft">Up to {plan.limits?.maxStudents} students</p>
                  <p className="text-sm text-ink-soft">Up to {plan.limits?.maxTeachers} teachers</p>
                  <p className="text-sm text-ink-soft">Up to {plan.limits?.maxAdmins} admins</p>
                </div>
                <div className="space-y-1.5 mb-4">
                  <p className="text-xs text-ink-faint uppercase font-semibold">Modules</p>
                  {MODULE_KEYS.filter(k => plan.modules?.[k]).sort().map(k => (
                    <div key={k} className="flex items-center gap-1.5 text-sm text-ink-soft">
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      {k.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase()).trim()}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button onClick={() => openEdit(plan)} variant="outline" size="sm" leftIcon={Edit} className="flex-1">
                    Edit
                  </Button>
                  <Button onClick={() => handleDelete(plan._id)} variant="dangerSubtle" size="sm">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingPlan ? "Edit Plan" : "Create Plan"} size="xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Input label="Name *" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} required />
            </div>
            <div>
              <Input label="Code *" value={formData.code} onChange={e => setFormData(p => ({ ...p, code: e.target.value }))} required placeholder="e.g. pro" disabled={!!editingPlan} />
            </div>
            <div className="md:col-span-2">
              <Textarea label="Description" value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} rows={2} className="resize-none" />
            </div>
            <div>
              <Input label="Monthly Price" type="number" value={formData.monthly} onChange={e => setFormData(p => ({ ...p, monthly: e.target.value }))} min="0" />
            </div>
            <div>
              <Input label="Yearly Price" type="number" value={formData.yearly} onChange={e => setFormData(p => ({ ...p, yearly: e.target.value }))} min="0" />
            </div>
            <div>
              <Input label="Max Students" type="number" value={formData.maxStudents} onChange={e => setFormData(p => ({ ...p, maxStudents: e.target.value }))} min="1" />
            </div>
            <div>
              <Input label="Max Teachers" type="number" value={formData.maxTeachers} onChange={e => setFormData(p => ({ ...p, maxTeachers: e.target.value }))} min="1" />
            </div>
            <div>
              <Input label="Max Admins" type="number" value={formData.maxAdmins} onChange={e => setFormData(p => ({ ...p, maxAdmins: e.target.value }))} min="1" />
            </div>
            <div>
              <Input label="Storage (MB)" type="number" value={formData.maxStorageMB} onChange={e => setFormData(p => ({ ...p, maxStorageMB: e.target.value }))} min="1" />
            </div>
            <div>
              <Input label="Sort Order" type="number" value={formData.sortOrder} onChange={e => setFormData(p => ({ ...p, sortOrder: e.target.value }))} />
            </div>
            <div className="flex items-center gap-3 mt-6">
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={formData.isPopular} onChange={e => setFormData(p => ({ ...p, isPopular: e.target.checked }))} className="sr-only peer" />
                <div className="w-11 h-6 bg-line peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                <span className="ml-3 text-sm font-medium text-ink">Mark as Popular</span>
              </label>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-ink mb-3">Module Toggles</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {MODULE_KEYS.map(key => (
                <label key={key} className="flex items-center gap-2 p-2 hover:bg-background rounded-lg cursor-pointer border border-transparent hover:border-line">
                  <input type="checkbox" checked={!!formData.modules[key]} onChange={() => toggleModule(key)} className="rounded border-line text-primary focus:ring-primary" />
                  <span className="text-sm text-ink-soft">{key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase()).trim()}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-line">
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button type="submit" leftIcon={Save}>
              {editingPlan ? "Update Plan" : "Create Plan"}
            </Button>
          </div>
        </form>
      </Modal>
    </motion.div>
  );
};

export default PlanManager;
