import React, { useState, useEffect, useCallback } from "react";
import { Megaphone, Clock, Trash2, CheckSquare, Square } from "lucide-react";
import api from "../../utils/api";
import { useToast } from "../../contexts/ToastContext";
import Card from "../common/ui/Card";
import Button from "../common/ui/Button";
import Badge from "../common/ui/Badge";
import PageHeader from "../common/ui/PageHeader";
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
        icon={Megaphone}
        title="Announcements"
        subtitle="Send announcements to students in your assigned sections"
        actions={
          <Button leftIcon={Megaphone} onClick={() => setShowForm(true)}>
            New Announcement
          </Button>
        }
      />

      {announcements.length === 0 ? (
        <Card>
          <EmptyState
            icon={Megaphone}
            title="No Announcements Yet"
            description="Create your first announcement for your students."
            action={<Button leftIcon={Megaphone} onClick={() => setShowForm(true)}>New Announcement</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <Card key={a._id} className={`p-4 ${isExpired(a) ? "opacity-50" : ""}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-semibold text-ink">{a.title || "Announcement"}</h3>
                    <Badge variant={getTypeTone(a.type)}>{a.type === "short_term" ? "Short-term" : "Announcement"}</Badge>
                    <Badge variant={getPriorityTone(a.priority)}>{a.priority}</Badge>
                    {isExpired(a) && <Badge variant="danger">Expired</Badge>}
                  </div>
                  <p className="text-sm text-ink-soft whitespace-pre-wrap">{a.message}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-ink-faint flex-wrap">
                    {a.createdBy?.name && (
                      <span className="font-semibold text-primary">
                        By {a.createdBy.name} ({a.createdBy.role})
                      </span>
                    )}
                    {a.targetSections?.length > 0 && (
                      <span>Sections: {a.targetSections.join(", ")}</span>
                    )}
                    {a.targetRoles?.length > 0 && (
                      <span>To: {a.targetRoles.join(", ")}</span>
                    )}
                    {a.expiryDate && (
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {getTimeLeft(a)}
                      </span>
                    )}
                    <span>{new Date(a.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(a._id)}
                  className="p-1.5 rounded-lg hover:bg-red-500/10 text-ink-faint hover:text-red-500 transition-colors"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="New Announcement" size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            label="Type"
            value={formData.type}
            onChange={(e) => setFormData((p) => ({ ...p, type: e.target.value }))}
            options={[
              { value: "announcement", label: "Announcement (7 days)" },
              { value: "short_term", label: "Short-term Alert (6 hours)" },
            ]}
          />
          <Input
            label="Title"
            value={formData.title}
            onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
            required
            placeholder="e.g. Exam Schedule Update"
          />
          <Select
            label="Priority"
            value={formData.priority}
            onChange={(e) => setFormData((p) => ({ ...p, priority: e.target.value }))}
            options={[
              { value: "low", label: "Low" },
              { value: "normal", label: "Normal" },
              { value: "high", label: "High" },
              { value: "urgent", label: "Urgent" },
            ]}
          />
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Send to sections</label>
            <p className="text-xs text-ink-faint mb-2">Select which of your assigned sections should receive this announcement</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={toggleAllSections}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-sm hover:bg-surface transition-colors"
              >
                {selectedSections.length === assignedSections.length ? (
                  <CheckSquare size={14} className="text-primary" />
                ) : (
                  <Square size={14} className="text-ink-faint" />
                )}
                All
              </button>
              {assignedSections.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => toggleSection(sec)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                    selectedSections.includes(sec)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-line text-ink-soft hover:bg-surface"
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
              <p className="text-xs text-red-500 mt-1">No sections assigned. Contact your admin to assign subjects.</p>
            )}
          </div>
          <Textarea
            label="Message"
            value={formData.message}
            onChange={(e) => setFormData((p) => ({ ...p, message: e.target.value }))}
            required
            rows={4}
            placeholder="Write your announcement here..."
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button type="submit">Send Announcement</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default TeacherAlerts;
