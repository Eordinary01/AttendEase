import React, { useState, useEffect, useCallback } from "react";
import { Bell, Plus, Trash2, Megaphone, Clock, Filter, Users } from "lucide-react";
import api from "../../utils/api";
import { useToast } from "../../contexts/ToastContext";
import Card from "../common/ui/Card";
import Button from "../common/ui/Button";
import Badge from "../common/ui/Badge";
import DashboardHeader from "../common/ui/DashboardHeader";
import EmptyState from "../common/ui/EmptyState";
import Modal from "../common/ui/Modal";
import { Input, Select, Textarea } from "../common/ui/Input";

const SHORT_TERM_HOURS = 6;
const ANNOUNCEMENT_DAYS = 7;

const Announcements = () => {
  const { success: toastSuccess, error: toastError } = useToast();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");

  const [formData, setFormData] = useState({
    title: "",
    message: "",
    type: "announcement",
    priority: "normal",
    targetRoles: ["student", "teacher", "admin"],
  });

  const fetchAnnouncements = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterType !== "all") params.set("type", filterType);
      if (filterPriority !== "all") params.set("priority", filterPriority);
      params.set("includeExpired", "true");

      const res = await api.get(`/alerts?${params.toString()}`);
      const data = Array.isArray(res.data?.data) ? res.data.data : [];
      setAnnouncements(data);
    } catch (err) {
      toastError("Failed to load announcements");
    } finally {
      setLoading(false);
    }
  }, [filterType, filterPriority, toastError]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.message.trim()) {
      toastError("Title and message are required");
      return;
    }
    try {
      await api.post("/alerts", {
        title: formData.title.trim(),
        message: formData.message.trim(),
        type: formData.type,
        priority: formData.priority,
        targetRoles: formData.targetRoles,
      });
      toastSuccess(formData.type === "short_term" ? "Short-term alert published (expires in 6 hours)" : "Campus broadcast published (active for 7 days)");
      setShowForm(false);
      setFormData({ title: "", message: "", type: "announcement", priority: "normal", targetRoles: ["student", "teacher", "admin"] });
      fetchAnnouncements();
    } catch (err) {
      toastError(err.response?.data?.message || "Failed to create announcement");
    }
  };

  const handleDelete = async (alertId) => {
    if (!window.confirm("Delete this announcement?")) return;
    try {
      await api.delete(`/alerts/${alertId}`);
      toastSuccess("Announcement deleted");
      fetchAnnouncements();
    } catch (err) {
      toastError("Failed to delete announcement");
    }
  };

  const isExpired = (alert) => {
    if (!alert.expiryDate) return false;
    return new Date(alert.expiryDate) < new Date();
  };

  const getTimeLeft = (alert) => {
    if (!alert.expiryDate) return null;
    const diff = new Date(alert.expiryDate) - new Date();
    if (diff <= 0) return "Expired";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d left`;
    return `${hours}h left`;
  };

  const getPriorityTone = (p) => {
    if (p === "urgent") return "danger";
    if (p === "high") return "warning";
    if (p === "low") return "info";
    return "neutral";
  };

  const getTypeTone = (t) => (t === "short_term" ? "warning" : "primary");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-12 h-12 border-3 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DashboardHeader
        greeting="Campus Broadcasts & Alerts"
        meta={`Publish announcements, critical flashes, and institutional notifications (${announcements.length} active records)`}
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowForm(true)}
            leftIcon={Plus}
          >
            New Broadcast
          </Button>
        }
      />

      {/* Info Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <Card padding="md" bordered className="bg-primary/5 border-primary/20">
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Megaphone className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-ink uppercase tracking-wider">Campus Broadcasts</h3>
          </div>
          <p className="text-xs text-ink-soft">Retained for {ANNOUNCEMENT_DAYS} days. Distributed across enrolled faculty, students, and parent portals.</p>
        </Card>
        <Card padding="md" bordered className="bg-amber-500/5 border-amber-500/20">
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-ink uppercase tracking-wider">Flash Priority Alerts</h3>
          </div>
          <p className="text-xs text-ink-soft">Active for {SHORT_TERM_HOURS} hours. Used for emergency advisories, schedule shifts, and urgent updates.</p>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <Card padding="md" bordered>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-line/50 bg-background text-ink outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
              <option value="all">All Broadcast Types</option>
              <option value="announcement">Announcements</option>
              <option value="short_term">Short-term Alerts</option>
            </select>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-line/50 bg-background text-ink outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
          </div>

          <span className="text-xs text-ink-soft font-semibold">{announcements.length} records published</span>
        </div>
      </Card>

      {/* Announcements list */}
      {announcements.length === 0 ? (
        <EmptyState
          title="No Broadcasts Found"
          description="Create your first announcement to notify users across your campus."
          icon={Bell}
          action={<Button variant="primary" size="sm" onClick={() => setShowForm(true)} leftIcon={Plus}>New Broadcast</Button>}
        />
      ) : (
        <div className="space-y-3">
          {announcements.map((alert) => (
            <Card key={alert.id} padding="md" bordered className={`transition hover:border-primary/30 ${isExpired(alert) ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <Badge tone={getTypeTone(alert.type)} size="sm" className="capitalize">
                      {alert.type === "short_term" ? "Flash Alert" : "Announcement"}
                    </Badge>
                    <Badge tone={getPriorityTone(alert.priority)} size="sm" className="capitalize">
                      {alert.priority}
                    </Badge>
                    {isExpired(alert) && <Badge tone="neutral" size="sm">Expired</Badge>}
                    {alert.expiryDate && !isExpired(alert) && (
                      <span className="text-[11px] text-ink-faint flex items-center gap-1 font-semibold">
                        <Clock className="w-3 h-3 text-primary" />{getTimeLeft(alert)}
                      </span>
                    )}
                  </div>
                  <h4 className="font-bold text-ink text-sm">{alert.title}</h4>
                  <p className="text-xs text-ink-soft mt-1 leading-relaxed">{alert.message}</p>
                  <div className="flex items-center gap-3 mt-2.5 text-[11px] text-ink-faint font-medium">
                    <span>{new Date(alert.createdAt).toLocaleDateString()}</span>
                    {alert.createdBy && <span>• by {alert.createdBy.name}</span>}
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3 text-primary" />
                      Audience: {(alert.targetRoles || []).join(", ")}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => handleDelete(alert.id)} 
                  className="p-1.5 text-ink-faint hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition cursor-pointer shrink-0"
                  title="Delete announcement"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Form Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Create Campus Broadcast" size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select label="Broadcast Category *" value={formData.type} onChange={(e) => setFormData((p) => ({ ...p, type: e.target.value }))}>
            <option value="announcement">Standard Announcement (7 days retention)</option>
            <option value="short_term">Short-term Emergency Alert (6 hours retention)</option>
          </Select>
          <Input label="Subject Title *" value={formData.title} onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))} placeholder="e.g. Campus Holiday Notice, Exam Schedule Published" required />
          <Select label="Broadcast Priority" value={formData.priority} onChange={(e) => setFormData((p) => ({ ...p, priority: e.target.value }))}>
            <option value="low">Low Priority</option>
            <option value="normal">Normal Priority</option>
            <option value="high">High Priority</option>
            <option value="urgent">Urgent / Critical</option>
          </Select>
          <div>
            <label className="block text-xs font-bold text-ink mb-1.5 uppercase tracking-wider">Target Recipient Roles</label>
            <div className="flex flex-wrap gap-3">
              {["student", "teacher", "admin"].map((role) => (
                <label key={role} className="flex items-center gap-2 text-xs font-semibold text-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.targetRoles.includes(role)}
                    onChange={(e) => {
                      setFormData((p) => ({
                        ...p,
                        targetRoles: e.target.checked
                          ? [...p.targetRoles, role]
                          : p.targetRoles.filter((r) => r !== role),
                      }));
                    }}
                    className="rounded border-line"
                  />
                  <span className="capitalize">{role}s</span>
                </label>
              ))}
            </div>
          </div>
          <Textarea label="Broadcast Message Body *" value={formData.message} onChange={(e) => setFormData((p) => ({ ...p, message: e.target.value }))} rows={4} placeholder="Compose your official communication..." required className="resize-none" />

          <div className="flex justify-end gap-2.5 pt-3 border-t border-line/50">
            <Button type="button" variant="subtle" size="sm" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Publish Broadcast
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Announcements;
