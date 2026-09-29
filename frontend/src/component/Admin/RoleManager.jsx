import React, { useState, useEffect } from "react";
import { Shield, Plus, X, Check, AlertCircle, Edit, Trash2, Save, Lock } from "lucide-react";
import api from "../../utils/api";
import Modal from "../common/ui/Modal";
import Button from "../common/ui/Button";
import Card from "../common/ui/Card";
import Badge from "../common/ui/Badge";
import EmptyState from "../common/ui/EmptyState";
import DashboardHeader from "../common/ui/DashboardHeader";
import Input, { Textarea } from "../common/ui/Input";
import Skeleton from "../common/ui/Skeleton";

const PERMISSION_GROUPS = [
  {
    label: "Attendance",
    permissions: [
      { key: "attendance:read", label: "View Attendance" },
      { key: "attendance:write", label: "Mark Attendance" },
      { key: "attendance:report", label: "Attendance Reports" },
    ],
  },
  {
    label: "Exams",
    permissions: [
      { key: "exam:read", label: "View Exams & Results" },
      { key: "exam:create", label: "Create & Schedule Exams" },
      { key: "exam:grade", label: "Grade Exams" },
      { key: "exam:publish", label: "Publish Results" },
      { key: "exam:update", label: "Edit Exams" },
      { key: "exam:delete", label: "Delete Exams" },
    ],
  },
  {
    label: "Fees",
    permissions: [
      { key: "fee:read", label: "View Fee Records" },
      { key: "fee:collect", label: "Collect Fees" },
      { key: "fee:waive", label: "Waive/Discount Fees" },
    ],
  },
  {
    label: "Students",
    permissions: [
      { key: "students:read", label: "View Student Profiles" },
      { key: "students:write", label: "Edit Student Profiles" },
    ],
  },
  {
    label: "Timetable",
    permissions: [
      { key: "timetable:read", label: "View Timetable" },
      { key: "timetable:write", label: "Manage Timetable" },
    ],
  },
  {
    label: "Subjects",
    permissions: [
      { key: "subjects:read", label: "View Subjects" },
      { key: "subjects:write", label: "Create/Edit Subjects" },
    ],
  },
  {
    label: "Reports",
    permissions: [
      { key: "reports:view", label: "View Reports" },
      { key: "reports:export", label: "Export Data" },
    ],
  },
  {
    label: "Alerts & Tickets",
    permissions: [
      { key: "alerts:create", label: "Create Announcements" },
      { key: "alerts:manage", label: "Manage All Alerts" },
      { key: "tickets:verify", label: "Verify Absence Tickets" },
    ],
  },
  {
    label: "Settings",
    permissions: [
      { key: "settings:read", label: "View Settings" },
      { key: "settings:write", label: "Edit Settings" },
    ],
  },
];

const RoleManager = () => {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [formData, setFormData] = useState({ name: "", description: "", permissions: [] });

  useEffect(() => { fetchRoles(); }, []);

  useEffect(() => {
    if (error || success) {
      const t = setTimeout(() => { setError(null); setSuccess(null); }, 4000);
      return () => clearTimeout(t);
    }
  }, [error, success]);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const res = await api.get('/roles');
      setRoles(res.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch roles");
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingRole(null);
    setFormData({ name: "", description: "", permissions: [] });
    setShowForm(true);
  };

  const openEdit = (role) => {
    setEditingRole(role);
    setFormData({ name: role.name, description: role.description || "", permissions: [...(role.permissions || [])] });
    setShowForm(true);
  };

  const togglePermission = (key) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(key)
        ? prev.permissions.filter(p => p !== key)
        : [...prev.permissions, key],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) { setError("Role name is required"); return; }
    try {
      if (editingRole) {
        await api.put(`/roles/${editingRole._id}`, formData);
        setSuccess("Role updated successfully");
      } else {
        await api.post('/roles', formData);
        setSuccess("Role created successfully");
      }
      setShowForm(false);
      fetchRoles();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save role");
    }
  };

  const handleDelete = async (roleId) => {
    if (!window.confirm("Delete this role? It will be removed from all teachers assigned to it.")) return;
    try {
      await api.delete(`/roles/${roleId}`);
      setSuccess("Role deleted successfully");
      fetchRoles();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete role");
    }
  };

  return (
    <div className="space-y-6 font-sans antialiased text-slate-800">
      <DashboardHeader
        greeting="Granular Role-Based Access Control"
        badge={`${roles.length} Roles Defined`}
        meta="Design delegation profiles, assigning scoped capabilities and authority modules to faculty"
        actions={
          <Button variant="primary" size="sm" leftIcon={Plus} onClick={openCreate}>
            Create Role
          </Button>
        }
      />

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-semibold shadow-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-700 text-xs font-semibold shadow-xs flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm">
          <Skeleton rows={5} />
        </div>
      ) : roles.length === 0 ? (
        <EmptyState
          title="No Custom Roles Defined"
          description="Create custom security roles like 'Department Head' or 'Exam Coordinator' and assign permissions."
          icon={Shield}
          action={<Button variant="primary" size="sm" onClick={openCreate} leftIcon={Plus}>Create First Role</Button>}
        />
      ) : (
        <div className="grid gap-4">
          {roles.map(role => (
            <div
              key={role._id}
              className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm transition-all hover:border-primary/40"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-primary-soft text-primary border border-primary-surface flex items-center justify-center shrink-0 shadow-xs">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-slate-900 leading-tight">{role.name}</h3>
                    {role.description && (
                      <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">{role.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button 
                    onClick={() => openEdit(role)} 
                    className="p-2 text-slate-400 hover:text-primary hover:bg-primary-soft rounded-xl transition-all shadow-xs border border-slate-200/60 bg-white" 
                    title="Edit Role"
                    aria-label={`Edit ${role.name}`}
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDelete(role._id)} 
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all shadow-xs border border-slate-200/60 bg-white" 
                    title="Delete Role"
                    aria-label={`Delete ${role.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {role.permissions?.length > 0 && (
                <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-wrap gap-1.5">
                  {role.permissions.map(p => {
                    const group = PERMISSION_GROUPS.find(g => g.permissions.some(pp => pp.key === p));
                    const perm = group?.permissions.find(pp => pp.key === p);
                    return (
                      <span
                        key={p}
                        className="px-2.5 py-1 bg-slate-50 text-slate-700 border border-slate-200/90 rounded-lg text-[11px] font-semibold font-mono tracking-tight"
                      >
                        {perm?.label || p}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingRole ? "Edit Role Profile" : "Create Security Role"} size="lg" error={error}>
        <form onSubmit={handleSubmit} className="space-y-4 font-sans">
          <Input
            label="Role Name *"
            value={formData.name}
            onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
            placeholder="e.g. Section Head, Exam Coordinator"
            required
          />
          <Textarea
            label="Description"
            value={formData.description}
            onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
            rows={2}
            placeholder="What responsibilities does this role have?"
          />
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Assigned Permissions Matrix</label>
            <div className="grid md:grid-cols-2 gap-3">
              {PERMISSION_GROUPS.map(group => (
                <div key={group.label} className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200/80">
                  <p className="text-[11px] font-bold text-slate-800 uppercase tracking-wider mb-2.5 pb-1 border-b border-slate-200/60">{group.label}</p>
                  <div className="space-y-2">
                    {group.permissions.map(perm => (
                      <label key={perm.key} className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors">
                        <input
                          type="checkbox"
                          checked={formData.permissions.includes(perm.key)}
                          onChange={() => togglePermission(perm.key)}
                          className="rounded border-slate-300 text-primary focus:ring-primary/20"
                        />
                        <span>{perm.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" leftIcon={Save}>
              {editingRole ? "Update Role" : "Save Role"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default RoleManager;
