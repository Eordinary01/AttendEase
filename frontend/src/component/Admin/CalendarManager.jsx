import React, { useState, useEffect, useCallback } from "react";
import {
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  Edit2,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Tag,
  BookOpen,
} from "lucide-react";
import api from "../../utils/api";
import { useTheme } from "../../contexts/ThemeContexts";
import Card from "../common/ui/Card";
import Button from "../common/ui/Button";
import Badge from "../common/ui/Badge";
import Modal from "../common/ui/Modal";
import EmptyState from "../common/ui/EmptyState";
import { Input, Select, Textarea } from "../common/ui/Input";

import DashboardHeader from "../common/ui/DashboardHeader";

const TYPE_TONES = {
  holiday: "success",
  exam: "warning",
  event: "info",
  deadline: "danger",
  meeting: "neutral",
};

export default function CalendarManager() {
  const { colors } = useTheme();
  const primary = colors?.primary || "#1d4ed8";

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    title: "",
    date: new Date().toISOString().split("T")[0],
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
    type: "holiday",
    description: "",
  });

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/calendar");
      const list = res.data?.data || [];
      setEvents(Array.isArray(list) ? list : []);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to load calendar events");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleOpenAddModal = () => {
    setEditingEvent(null);
    setForm({
      title: "",
      date: new Date().toISOString().split("T")[0],
      startDate: new Date().toISOString().split("T")[0],
      endDate: new Date().toISOString().split("T")[0],
      type: "holiday",
      description: "",
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (event) => {
    setEditingEvent(event);
    setForm({
      title: event.title || "",
      date: event.date ? new Date(event.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
      startDate: event.startDate ? new Date(event.startDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
      endDate: event.endDate ? new Date(event.endDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
      type: event.type || "holiday",
      description: event.description || "",
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    try {
      setSubmitting(true);
      if (editingEvent) {
        await api.put(`/calendar/${editingEvent._id}`, form);
      } else {
        await api.post("/calendar", form);
      }
      setIsModalOpen(false);
      fetchEvents();
    } catch (err) {
      alert(err.response?.data?.message || "Error saving calendar event");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to remove this academic calendar event?")) return;
    try {
      await api.delete(`/calendar/${id}`);
      fetchEvents();
    } catch (err) {
      alert(err.response?.data?.message || "Error deleting calendar event");
    }
  };

  const filteredEvents = events.filter((e) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || e.title?.toLowerCase().includes(q) || e.description?.toLowerCase().includes(q);
    const matchesType = typeFilter === "all" || (e.type || "holiday").toLowerCase() === typeFilter.toLowerCase();
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      <DashboardHeader
        greeting="Academic Calendar & Gazetted Events"
        meta={`Institutional schedule, gazetted holidays, examinations, and term milestones (${events.length} events scheduled)`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="subtle" size="sm" onClick={fetchEvents} leftIcon={RefreshCw}>
              Refresh
            </Button>
            <Button variant="primary" size="sm" onClick={handleOpenAddModal} leftIcon={Plus}>
              Add Event / Holiday
            </Button>
          </div>
        }
      />

      {/* Filter Bar */}
      <Card padding="md" bordered>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {["all", "holiday", "exam", "event", "deadline"].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setTypeFilter(type)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition cursor-pointer ${
                  typeFilter === type
                    ? "bg-primary text-white shadow-xs"
                    : "bg-surface-raised hover:bg-surface-hover text-ink-soft"
                }`}
              >
                {type === "all" ? "All Events" : type}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-ink-faint absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search events & holidays..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-background border border-line rounded-xl text-ink outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>
      </Card>

      {/* Events Table / List */}
      <Card padding="none" className="overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-ink-faint">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading academic calendar...
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="p-12">
            <EmptyState
              icon={CalendarIcon}
              title="No events found"
              description="No calendar events match your current search or filter."
              action={
                <Button variant="primary" size="sm" onClick={handleOpenAddModal} leftIcon={Plus}>
                  Create First Event
                </Button>
              }
            />
          </div>
        ) : (
          <div className="divide-y divide-line/60">
            {filteredEvents.map((e) => {
              const dateObj = new Date(e.date || e.startDate);
              const monthStr = dateObj.toLocaleDateString("en-US", { month: "short" });
              const dayNum = dateObj.toLocaleDateString("en-US", { day: "2-digit" });
              const yearNum = dateObj.getFullYear();
              const tone = TYPE_TONES[e.type?.toLowerCase()] || "neutral";

              return (
                <div
                  key={e._id}
                  className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-background/60 transition"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    {/* Date Tag */}
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex flex-col items-center justify-center text-primary shrink-0">
                      <span className="text-[10px] font-bold uppercase leading-none">{monthStr}</span>
                      <span className="text-base font-extrabold leading-tight">{dayNum}</span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-ink text-sm truncate">{e.title}</h4>
                        <Badge tone={tone} size="sm" className="capitalize">
                          {e.type || "Holiday"}
                        </Badge>
                      </div>
                      <p className="text-xs text-ink-soft mt-0.5 leading-relaxed line-clamp-2">
                        {e.description || "No specific description provided."}
                      </p>
                      <div className="flex items-center gap-3 text-[11px] text-ink-faint mt-1">
                        <span>Date: {dateObj.toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}</span>
                        {e.endDate && new Date(e.endDate).getTime() !== dateObj.getTime() && (
                          <span>to {new Date(e.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(e)}
                      className="p-1.5 rounded-lg border border-line bg-surface hover:bg-background text-ink-soft hover:text-primary transition cursor-pointer"
                      title="Edit event"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(e._id)}
                      className="p-1.5 rounded-lg border border-line bg-surface hover:bg-red-50 text-ink-soft hover:text-red-600 transition cursor-pointer"
                      title="Delete event"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingEvent ? "Edit Academic Event" : "Add Calendar Event / Holiday"}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Event / Holiday Title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Mid-Term Examination Start"
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Start Date"
              type="date"
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value, date: e.target.value }))}
              required
            />
            <Input
              label="End Date"
              type="date"
              value={form.endDate}
              onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
            />
          </div>

          <Select
            label="Event Type"
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
          >
            <option value="holiday">Gazetted / Institutional Holiday</option>
            <option value="exam">Examination / Evaluation</option>
            <option value="event">Academic Event / Orientation</option>
            <option value="deadline">Academic Deadline / Grade Submission</option>
            <option value="meeting">Faculty / Department Meeting</option>
          </Select>

          <Textarea
            label="Description (Optional)"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Additional instructions or event details..."
            rows={3}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={submitting}>
              {editingEvent ? "Update Event" : "Publish Event"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
