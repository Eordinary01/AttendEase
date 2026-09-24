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
    <div className="space-y-6">
      <DashboardHeader
        greeting="Granular Role-Based Access Control"
        meta={`Design delegation profiles, assigning scoped capabilities and authority modules to faculty (${roles.length} roles defined)`}
        actions={
          <Button variant="primary" size="sm" leftIcon={Plus} onClick={openCreate}>
            Create Role
          </Button>
        }
      />

      {error && <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-600 text-xs font-semibold">{error}</div>}
      {success && <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 text-xs font-semibold">{success}</div>}

      {loading ? (
        <Card padding="lg" bordered>
          <Skeleton rows={4} />
        </Card>
      ) : roles.length === 0 ? (
        <EmptyState
          title="No Custom Roles Defined"
          description="Create custom security roles like 'Department Head' or 'Exam Coordinator' and assign permissions."
          icon={Shield}
          action={<Button variant="primary" size="sm" onClick={openCreate} leftIcon={Plus}>Create First Role</Button>}
        />
      ) : (
        <div className="grid gap-3.5">
          {roles.map(role => (
            <Card key={role._id} padding="md" bordered className="transition hover:border-primary/30">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <Shield className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-bold text-ink">{role.name}</h3>
                  </div>
                  {role.description && <p className="text-xs text-ink-soft mt-1 ml-9">{role.description}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => openEdit(role)} 
                    className="p-1.5 text-ink-soft hover:text-primary hover:bg-primary/10 rounded-lg transition cursor-pointer" 
                    title="Edit Role"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDelete(role._id)} 
                    className="p-1.5 text-ink-soft hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition cursor-pointer" 
                    title="Delete Role"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {role.permissions?.length > 0 && (
                <div className="mt-3.5 pt-3 border-t border-line/50 flex flex-wrap gap-1.5">
                  {role.permissions.map(p => {
                    const group = PERMISSION_GROUPS.find(g => g.permissions.some(pp => pp.key === p));
                    const perm = group?.permissions.find(pp => pp.key === p);
                    return (
                      <span key={p} className="px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-md text-[11px] font-medium font-mono">
                        {perm?.label || p}
                      </span>
                    );
                  })}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingRole ? "Edit Role Profile" : "Create Security Role"} size="lg" error={error}>
        <form onSubmit={handleSubmit} className="space-y-4">
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
            <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-2">Assigned Permissions Matrix</label>
            <div className="grid md:grid-cols-2 gap-3">
              {PERMISSION_GROUPS.map(group => (
                <div key={group.label} className="p-3 bg-background rounded-xl border border-line/50">
                  <p className="text-[11px] font-bold text-ink uppercase tracking-wider mb-2">{group.label}</p>
                  <div className="space-y-1.5">
                    {group.permissions.map(perm => (
                      <label key={perm.key} className="flex items-center gap-2 cursor-pointer text-xs font-medium text-ink-soft hover:text-ink">
                        <input type="checkbox" checked={formData.permissions.includes(perm.key)} onChange={() => togglePermission(perm.key)} className="rounded border-line/60 text-primary focus:ring-primary/30" />
                        <span>{perm.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2.5 pt-3 border-t border-line/50">
            <Button type="button" variant="subtle" size="sm" onClick={() => setShowForm(false)}>
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
