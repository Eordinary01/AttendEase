import React, { useState, useEffect, useCallback } from "react";
import { Megaphone, Clock, Trash2, CheckSquare, Square, Plus } from "lucide-react";
import api from "../../utils/api";
import { useToast } from "../../contexts/ToastContext";
import Card from "../common/ui/Card";
import Button from "../common/ui/Button";
import Badge from "../common/ui/Badge";
import DashboardHeader from "../common/ui/DashboardHeader";
import EmptyState from "../common/ui/EmptyState";
import Modal from "../common/ui/Modal";
import { Input, Select, Textarea } from "../common/ui/Input";

const TeacherAlerts = () => {
  const { success: toastSuccess, error: toastError } = useToast();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [assignedSubjectList, setAssignedSubjectList] = useState([]);
  const [assignedSections, setAssignedSections] = useState([]);
  const [selectedSections, setSelectedSections] = useState([]);

  const [formData, setFormData] = useState({
    title: "",
    message: "",
    type: "announcement",
    priority: "normal",
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [alertsRes, profileRes] = await Promise.all([
          api.get("/alerts?includeExpired=true"),
          api.get("/users/profile"),
        ]);
        const data = Array.isArray(alertsRes.data?.data) ? alertsRes.data.data : [];
        setAnnouncements(data);

        const user = profileRes.data?.user || profileRes.data?.data || profileRes.data;
        const subjects = user?.assignedSubjects || [];
        setAssignedSubjectList(subjects);
        const sections = [...new Set(subjects.map((s) => s.section).filter(Boolean))].sort();
        setAssignedSections(sections);
      } catch (err) {
        toastError("Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [toastError]);

  const toggleSection = (sec) => {
    setSelectedSections((prev) =>
      prev.includes(sec) ? prev.filter((s) => s !== sec) : [...prev, sec]
    );
  };

  const toggleAllSections = () => {
    setSelectedSections((prev) =>
      prev.length === assignedSections.length ? [] : [...assignedSections]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.message.trim()) {
      toastError("Title and message are required");
      return;
    }
    if (selectedSections.length === 0) {
      toastError("Select at least one section to send the announcement to");
      return;
    }

    const matchingSubjects = assignedSubjectList.filter(s => selectedSections.includes(s.section));
    const targetCourseIds = [...new Set(matchingSubjects.map(s => s.subjectId?.courseId || s.courseId).filter(Boolean))];
    const targetBranches = [...new Set(matchingSubjects.map(s => s.subjectId?.branch || s.branch).filter(Boolean))];
    const targetSubjectIds = [...new Set(matchingSubjects.map(s => s.subjectId?._id || s.subjectId).filter(Boolean))];

    try {
      await api.post("/alerts", {
        title: formData.title.trim(),
        message: formData.message.trim(),
        type: formData.type,
        priority: formData.priority,
        targetRoles: ["student"],
        targetSections: selectedSections,
        targetCourseIds,
        targetBranches,
        targetSubjectIds,
      });
      toastSuccess(
        formData.type === "short_term"
          ? "Short-term alert sent to students (expires in 6 hours)"
          : "Announcement sent to students (expires in 7 days)"
      );
      setShowForm(false);
      setFormData({ title: "", message: "", type: "announcement", priority: "normal" });
      setSelectedSections([]);
      const res = await api.get("/alerts?includeExpired=true");
      setAnnouncements(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      toastError(err.response?.data?.message || "Failed to create announcement");
    }
  };

  const handleDelete = async (alertId) => {
    if (!window.confirm("Delete this announcement?")) return;
    try {
      await api.delete(`/alerts/${alertId}`);
      toastSuccess("Announcement deleted");
      const res = await api.get("/alerts?includeExpired=true");
      setAnnouncements(Array.isArray(res.data?.data) ? res.data.data : []);
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
        greeting="Classroom Broadcasts & Section Notices"
        meta={`Publish announcements and schedule notices to students in your assigned teaching sections (${announcements.length} broadcasts active)`}
        actions={
          <Button variant="primary" size="sm" leftIcon={Plus} onClick={() => setShowForm(true)}>
            New Announcement
          </Button>
        }
      />

      {announcements.length === 0 ? (
        <Card padding="lg" bordered>
          <EmptyState
            icon={Megaphone}
            title="No Announcements Yet"
            description="Create your first announcement for your students across assigned sections."
            action={<Button variant="primary" size="sm" leftIcon={Plus} onClick={() => setShowForm(true)}>New Announcement</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <Card key={a._id} padding="md" bordered className={`transition hover:border-primary/30 ${isExpired(a) ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <Badge tone={getTypeTone(a.type)} size="sm">{a.type === "short_term" ? "Flash Alert" : "Announcement"}</Badge>
                    <Badge tone={getPriorityTone(a.priority)} size="sm" className="capitalize">{a.priority}</Badge>
                    {isExpired(a) && <Badge tone="neutral" size="sm">Expired</Badge>}
                  </div>
                  <h3 className="font-bold text-sm text-ink">{a.title || "Announcement"}</h3>
                  <p className="text-xs text-ink-soft mt-1 whitespace-pre-wrap leading-relaxed">{a.message}</p>
                  <div className="flex items-center gap-3 mt-2.5 text-[11px] text-ink-faint flex-wrap font-medium">
                    {a.createdBy?.name && (
                      <span className="font-semibold text-primary">
                        By {a.createdBy.name} ({a.createdBy.role})
                      </span>
                    )}
                    {a.targetSections?.length > 0 && (
                      <span>Sections: {a.targetSections.join(", ")}</span>
                    )}
                    {a.expiryDate && (
                      <span className="flex items-center gap-1">
                        <Clock size={12} className="text-primary" />
                        {getTimeLeft(a)}
                      </span>
                    )}
                    <span>{new Date(a.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(a._id)}
                  className="p-1.5 rounded-lg text-ink-faint hover:text-rose-600 hover:bg-rose-500/10 transition cursor-pointer"
                  title="Delete Announcement"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="New Classroom Announcement" size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            label="Announcement Type"
            value={formData.type}
            onChange={(e) => setFormData((p) => ({ ...p, type: e.target.value }))}
          >
            <option value="announcement">Standard Announcement (7 days)</option>
            <option value="short_term">Short-term Flash Alert (6 hours)</option>
          </Select>
          <Input
            label="Subject Title"
            value={formData.title}
            onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
            required
            placeholder="e.g. Test Schedule Next Week, Lab Class Venue"
          />
          <Select
            label="Priority Level"
            value={formData.priority}
            onChange={(e) => setFormData((p) => ({ ...p, priority: e.target.value }))}
          >
            <option value="low">Low Priority</option>
            <option value="normal">Normal Priority</option>
            <option value="high">High Priority</option>
            <option value="urgent">Urgent / Critical</option>
          </Select>
          <div>
            <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1">Target Sections</label>
            <p className="text-[11px] text-ink-soft mb-2">Select which of your assigned sections should receive this announcement</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={toggleAllSections}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-line/60 text-xs font-semibold hover:bg-surface transition cursor-pointer"
              >
                {selectedSections.length === assignedSections.length ? (
                  <CheckSquare size={14} className="text-primary" />
                ) : (
                  <Square size={14} className="text-ink-faint" />
                )}
                All Assigned
              </button>
              {assignedSections.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => toggleSection(sec)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                    selectedSections.includes(sec)
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-line/60 text-ink-soft hover:bg-surface"
                  }`}
                >
                  {selectedSections.includes(sec) ? (
                    <CheckSquare size={14} className="text-primary" />
                  ) : (
                    <Square size={14} className="text-ink-faint" />
                  )}
                  Section {sec}
                </button>
              ))}
            </div>
            {assignedSections.length === 0 && (
              <p className="text-xs text-rose-500 mt-1">No sections currently assigned to your profile.</p>
            )}
          </div>
          <Textarea
            label="Announcement Message"
            value={formData.message}
            onChange={(e) => setFormData((p) => ({ ...p, message: e.target.value }))}
            required
            rows={4}
            placeholder="Compose your message to students..."
          />
          <div className="flex justify-end gap-2.5 pt-3 border-t border-line/50">
            <Button variant="subtle" size="sm" type="button" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">Publish Announcement</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default TeacherAlerts;
