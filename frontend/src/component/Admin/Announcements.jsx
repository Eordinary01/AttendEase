import React, { useState, useEffect, useCallback } from "react";
import { Bell, Plus, Trash2, Megaphone, Clock, Filter, Users } from "lucide-react";
import api from "../../utils/api";
import { useToast } from "../../contexts/ToastContext";
import Card from "../common/ui/Card";
import Button from "../common/ui/Button";
import Badge from "../common/ui/Badge";
import PageHeader from "../common/ui/PageHeader";
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
      toastSuccess(formData.type === "short_term" ? "Short-term alert created (expires in 6 hours)" : "Announcement created (expires in 7 days)");
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
    return "default";
  };

  const getTypeTone = (t) => (t === "short_term" ? "warning" : "info");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Announcements"
        subtitle="Manage announcements and alerts for your institution"
        icon={Megaphone}
        actions={
          <div className="flex items-center gap-3">
            <Select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="w-40">
              <option value="all">All Types</option>
              <option value="announcement">Announcements</option>
              <option value="short_term">Short-term Alerts</option>
            </Select>
            <Select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="w-36">
              <option value="all">All Priority</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </Select>
            <Button onClick={() => setShowForm(true)} leftIcon={Plus}>
              New Announcement
            </Button>
          </div>
        }
      />

      {/* Info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card padding="md" className="border-l-4 border-l-info">
          <div className="flex items-center gap-2 mb-1">
            <Megaphone className="w-4 h-4 text-info" />
            <h3 className="text-sm font-bold text-ink">Announcements</h3>
          </div>
          <p className="text-xs text-ink-soft">Lasts {ANNOUNCEMENT_DAYS} days. Visible to all users in the organization.</p>
        </Card>
        <Card padding="md" className="border-l-4 border-l-warning">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-warning" />
            <h3 className="text-sm font-bold text-ink">Short-term Alerts</h3>
          </div>
          <p className="text-xs text-ink-soft">Lasts {SHORT_TERM_HOURS} hours. For quick, time-sensitive information.</p>
        </Card>
      </div>

      {/* Announcements list */}
      {announcements.length === 0 ? (
        <EmptyState
          title="No Announcements"
          description="Create your first announcement to notify users"
          icon={Bell}
          action={<Button onClick={() => setShowForm(true)} leftIcon={Plus}>New Announcement</Button>}
        />
      ) : (
        <div className="space-y-3">
          {announcements.map((alert) => (
            <Card key={alert.id} padding="md" className={isExpired(alert) ? "opacity-50" : ""}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge tone={getTypeTone(alert.type)} className="capitalize">
                      {alert.type === "short_term" ? "Short-term" : "Announcement"}
                    </Badge>
                    <Badge tone={getPriorityTone(alert.priority)} className="capitalize">
                      {alert.priority}
                    </Badge>
                    {isExpired(alert) && <Badge tone="default">Expired</Badge>}
                    {alert.expiryDate && !isExpired(alert) && (
                      <span className="text-[10px] text-ink-faint flex items-center gap-0.5">
                        <Clock className="w-3 h-3" />{getTimeLeft(alert)}
                      </span>
                    )}
                  </div>
                  <h4 className="font-semibold text-ink text-sm">{alert.title}</h4>
                  <p className="text-sm text-ink-soft mt-0.5 line-clamp-2">{alert.message}</p>
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-ink-faint">
                    <span>{new Date(alert.createdAt).toLocaleDateString()}</span>
                    {alert.createdBy && <span>by {alert.createdBy.name}</span>}
                    <span className="flex items-center gap-0.5">
                      <Users className="w-3 h-3" />
                      {(alert.targetRoles || []).join(", ")}
                    </span>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(alert.id)} className="text-red-500 hover:text-red-700 flex-shrink-0">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Form Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Create Announcement" size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select label="Type *" value={formData.type} onChange={(e) => setFormData((p) => ({ ...p, type: e.target.value }))}>
            <option value="announcement">Announcement (7 days)</option>
            <option value="short_term">Short-term Alert (6 hours)</option>
          </Select>
          <Input label="Title *" value={formData.title} onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))} placeholder="Announcement title" required />
          <Select label="Priority" value={formData.priority} onChange={(e) => setFormData((p) => ({ ...p, priority: e.target.value }))}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </Select>
          <div>
            <label className="block text-xs font-semibold text-ink mb-1">Visible to</label>
            <div className="flex flex-wrap gap-2">
              {["student", "teacher", "admin"].map((role) => (
                <label key={role} className="flex items-center gap-1.5 text-sm text-ink cursor-pointer">
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
          <Textarea label="Message *" value={formData.message} onChange={(e) => setFormData((p) => ({ ...p, message: e.target.value }))} rows={4} placeholder="Write your announcement..." required />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" leftIcon={Plus}>Publish</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Announcements;
