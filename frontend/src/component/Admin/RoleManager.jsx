import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Shield, Plus, X, Check, AlertCircle, Edit, Trash2, Save } from "lucide-react";
import api from "../../utils/api";
import Modal from "../common/ui/Modal";
import Button from "../common/ui/Button";
import Card from "../common/ui/Card";
import EmptyState from "../common/ui/EmptyState";
import PageHeader from "../common/ui/PageHeader";
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
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <PageHeader
        title="Custom Roles"
        subtitle="Create and manage roles to assign additional responsibilities to teachers"
        icon={Shield}
        actions={
          <Button leftIcon={Plus} onClick={openCreate}>
            Create Role
          </Button>
        }
      />

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700"><AlertCircle className="w-5 h-5" />{error}</div>}
      {success && <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700"><Check className="w-5 h-5" />{success}</div>}

      {loading ? (
        <Card>
          <Skeleton rows={4} />
        </Card>
      ) : roles.length === 0 ? (
        <EmptyState
          title="No Custom Roles Yet"
          description="Create roles like 'Section Head' or 'Exam Coordinator' and assign them to teachers."
          icon={Shield}
          action={<Button onClick={openCreate}>Create Your First Role</Button>}
        />
      ) : (
        <div className="grid gap-4">
          {roles.map(role => (
            <Card key={role._id}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-ink">{role.name}</h3>
                  {role.description && <p className="text-sm text-ink-soft mt-1">{role.description}</p>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(role)} className="p-2 hover:bg-background rounded-lg transition" title="Edit">
                    <Edit className="w-4 h-4 text-primary" />
                  </button>
                  <button onClick={() => handleDelete(role._id)} className="p-2 hover:bg-background rounded-lg transition" title="Delete">
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              </div>
              {role.permissions?.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {role.permissions.map(p => {
                    const group = PERMISSION_GROUPS.find(g => g.permissions.some(pp => pp.key === p));
                    const perm = group?.permissions.find(pp => pp.key === p);
                    return (
                      <span key={p} className="px-2.5 py-1 bg-primary-soft text-primary-dark rounded-lg text-xs font-medium">
                        {perm?.label || p}
                      </span>
                    );
                  })}
                </div>
              )}
              {role.assignedSections?.length > 0 && (
                <div className="mt-3 flex items-center gap-2 text-sm text-ink-soft">
                  <span className="font-medium">Sections:</span>
                  {role.assignedSections.map(s => <span key={s} className="px-2 py-0.5 bg-background rounded text-xs">{s}</span>)}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingRole ? "Edit Role" : "Create Role"} size="lg" error={error}>
        <form onSubmit={handleSubmit} className="space-y-6">
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
            <label className="block text-sm font-semibold text-ink mb-3">Permissions</label>
            <div className="grid md:grid-cols-2 gap-4">
              {PERMISSION_GROUPS.map(group => (
                <div key={group.label} className="p-4 bg-background rounded-xl border border-line">
                  <p className="text-xs font-bold text-ink-faint uppercase tracking-wider mb-2">{group.label}</p>
                  <div className="space-y-2">
                    {group.permissions.map(perm => (
                      <label key={perm.key} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={formData.permissions.includes(perm.key)} onChange={() => togglePermission(perm.key)} className="rounded border-line text-primary focus:ring-primary/50" />
                        <span className="text-sm text-ink-soft">{perm.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button type="submit" leftIcon={Save}>
              {editingRole ? "Update Role" : "Create Role"}
            </Button>
          </div>
        </form>
      </Modal>
    </motion.div>
  );
};

export default RoleManager;
