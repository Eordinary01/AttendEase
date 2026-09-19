import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Edit2,
  Search,
  Filter,
  RefreshCw,
  Clock,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  List,
  Grid,
  Tag,
  Info,
  Layers,
} from "lucide-react";
import api from "../../utils/api";
import { getDateBadgeParts, formatDateReadable, formatDateDMY, getLocalTodayStr, toLocalDateStr } from "../../utils/dateUtils";
import { useTheme } from "../../contexts/ThemeContexts";
import Card from "../common/ui/Card";
import Button from "../common/ui/Button";
import Badge from "../common/ui/Badge";
import Modal from "../common/ui/Modal";
import EmptyState from "../common/ui/EmptyState";
import { Input, Select, Textarea } from "../common/ui/Input";
import UniversalSpinner from "../common/ui/UniversalSpinner";
import DashboardHeader from "../common/ui/DashboardHeader";

const TYPE_CONFIG = {
  holiday: {
    label: "Holiday",
    tone: "success",
    bgClass: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    dotClass: "bg-emerald-500",
    pillClass: "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  },
  exam: {
    label: "Examination",
    tone: "warning",
    bgClass: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    dotClass: "bg-amber-500",
    pillClass: "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  },
  event: {
    label: "Event",
    tone: "info",
    bgClass: "bg-sky-500/10 text-sky-600 border-sky-500/20",
    dotClass: "bg-sky-500",
    pillClass: "bg-sky-100 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800",
  },
  deadline: {
    label: "Deadline",
    tone: "danger",
    bgClass: "bg-rose-500/10 text-rose-600 border-rose-500/20",
    dotClass: "bg-rose-500",
    pillClass: "bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800",
  },
  meeting: {
    label: "Meeting",
    tone: "neutral",
    bgClass: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    dotClass: "bg-purple-500",
    pillClass: "bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800",
  },
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function AcademicCalendar({ role }) {
  const { colors } = useTheme();
  const primary = colors?.primary || "#1d4ed8";

  // Determine user role
  const userRole = useMemo(() => {
    if (role) return role;
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      return u.role || "";
    } catch {
      return "";
    }
  }, [role]);

  const isAdmin = userRole === "admin" || userRole === "super_admin";

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [viewMode, setViewMode] = useState("grid"); // 'grid' | 'agenda'

  // Monthly Grid Navigation
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [viewingEvent, setViewingEvent] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State for Admin Create/Edit
  const [form, setForm] = useState({
    title: "",
    date: getLocalTodayStr(),
    startDate: getLocalTodayStr(),
    endDate: getLocalTodayStr(),
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
      console.error("Failed to load academic calendar:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Handle Month Navigation
  const handlePrevMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDay(now);
  };

  // Filtered Events
  const filteredEvents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return events.filter((e) => {
      const matchesSearch =
        !q ||
        e.title?.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q);
      const matchesType =
        typeFilter === "all" ||
        (e.type || "holiday").toLowerCase() === typeFilter.toLowerCase();
      return matchesSearch && matchesType;
    });
  }, [events, searchQuery, typeFilter]);

  // Next Upcoming Event for Spotlight
  const nextUpcomingEvent = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcoming = events
      .filter((e) => {
        const d = new Date(e.startDate || e.date);
        return !isNaN(d.getTime()) && d >= today;
      })
      .sort((a, b) => new Date(a.startDate || a.date) - new Date(b.startDate || b.date));

    return upcoming[0] || null;
  }, [events]);

  // Calendar Grid Calculations
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days = [];

    // Previous month filler days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, daysInPrevMonth - i),
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }

    // Next month filler days (fill up to 35 or 42 grid cells)
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }

    return days;
  }, [currentDate]);

  // Helper: Get events occurring on a specific date
  const getEventsForDate = useCallback(
    (targetDate) => {
      if (!targetDate) return [];
      const targetTime = new Date(
        targetDate.getFullYear(),
        targetDate.getMonth(),
        targetDate.getDate()
      ).getTime();

      return filteredEvents.filter((e) => {
        const start = new Date(e.startDate || e.date);
        const startTime = new Date(
          start.getFullYear(),
          start.getMonth(),
          start.getDate()
        ).getTime();

        const end = e.endDate ? new Date(e.endDate) : start;
        const endTime = new Date(
          end.getFullYear(),
          end.getMonth(),
          end.getDate()
        ).getTime();

        return targetTime >= startTime && targetTime <= endTime;
      });
    },
    [filteredEvents]
  );

  // Selected Day Events
  const selectedDayEvents = useMemo(() => {
    return getEventsForDate(selectedDay);
  }, [getEventsForDate, selectedDay]);

  // Relative Date Tag (e.g. "Today", "Tomorrow", "In 5 days", "Passed")
  const getRelativeCountdown = (dateInput) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const d = new Date(dateInput);
    d.setHours(0, 0, 0, 0);

    const diffDays = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return { label: "Today", tone: "success", highlight: true };
    if (diffDays === 1) return { label: "Tomorrow", tone: "info", highlight: true };
    if (diffDays > 1 && diffDays <= 7) return { label: `In ${diffDays} days`, tone: "info", highlight: false };
    if (diffDays > 7) return { label: `In ${diffDays} days`, tone: "neutral", highlight: false };
    return { label: "Passed", tone: "neutral", highlight: false };
  };

  // Admin Actions
  const handleOpenAddModal = (initialDate = null) => {
    setEditingEvent(null);
    const dateStr = initialDate
      ? toLocalDateStr(initialDate)
      : getLocalTodayStr();

    setForm({
      title: "",
      date: dateStr,
      startDate: dateStr,
      endDate: dateStr,
      type: "holiday",
      description: "",
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (event, e) => {
    if (e) e.stopPropagation();
    setEditingEvent(event);
    setForm({
      title: event.title || "",
      date: event.date
        ? toLocalDateStr(new Date(event.date))
        : getLocalTodayStr(),
      startDate: event.startDate
        ? toLocalDateStr(new Date(event.startDate))
        : getLocalTodayStr(),
      endDate: event.endDate
        ? toLocalDateStr(new Date(event.endDate))
        : getLocalTodayStr(),
      type: event.type || "holiday",
      description: event.description || "",
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm("Are you sure you want to remove this academic calendar event?")) return;
    try {
      await api.delete(`/calendar/${id}`);
      fetchEvents();
      if (viewingEvent?._id === id) setViewingEvent(null);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete event");
    }
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
      alert(err.response?.data?.message || "Failed to save calendar event");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <DashboardHeader
        greeting="Academic Calendar & Schedules"
        meta={`Institutional schedule, gazetted holidays, examination milestones, and academic deadlines (${events.length} events scheduled)`}
        actions={
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center p-1 bg-surface-alt rounded-xl border border-line">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  viewMode === "grid"
                    ? "bg-surface text-ink shadow-2xs"
                    : "text-ink-soft hover:text-ink"
                }`}
                title="Monthly Grid View"
              >
                <Grid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Grid</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("agenda")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  viewMode === "agenda"
                    ? "bg-surface text-ink shadow-2xs"
                    : "text-ink-soft hover:text-ink"
                }`}
                title="Agenda Schedule View"
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Agenda</span>
              </button>
            </div>

            <Button variant="subtle" size="sm" onClick={fetchEvents} leftIcon={RefreshCw}>
              <span className="hidden sm:inline">Refresh</span>
            </Button>

            {isAdmin && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleOpenAddModal(selectedDay)}
                leftIcon={Plus}
              >
                Add Event
              </Button>
            )}
          </div>
        }
      />

      {/* Spotlight Banner: Nearest Upcoming Event */}
      {nextUpcomingEvent && (
        <div className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-r from-primary/10 via-indigo-500/10 to-purple-500/10 border border-primary/20 shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary shrink-0">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-primary">
                    Next Academic Milestone
                  </span>
                  {(() => {
                    const cd = getRelativeCountdown(nextUpcomingEvent.startDate || nextUpcomingEvent.date);
                    return (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          cd.highlight
                            ? "bg-primary text-white animate-pulse"
                            : "bg-surface text-ink-soft border border-line"
                        }`}
                      >
                        {cd.label}
                      </span>
                    );
                  })()}
                </div>
                <h3 className="text-base font-black text-ink mt-0.5">
                  {nextUpcomingEvent.title}
                </h3>
                <p className="text-xs text-ink-soft line-clamp-1 mt-0.5">
                  {nextUpcomingEvent.description || "Marked on the official institutional calendar."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-end sm:self-center">
              <div className="text-right hidden md:block">
                <p className="text-xs font-bold text-ink">
                  {formatDateReadable(nextUpcomingEvent.startDate || nextUpcomingEvent.date, true)}
                </p>
                {nextUpcomingEvent.endDate &&
                  new Date(nextUpcomingEvent.endDate).getTime() !==
                    new Date(nextUpcomingEvent.startDate || nextUpcomingEvent.date).getTime() && (
                    <p className="text-[11px] text-ink-soft">
                      until {formatDateReadable(nextUpcomingEvent.endDate, false)}
                    </p>
                  )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setViewingEvent(nextUpcomingEvent);
                  const targetD = new Date(nextUpcomingEvent.startDate || nextUpcomingEvent.date);
                  setCurrentDate(targetD);
                  setSelectedDay(targetD);
                }}
              >
                View Details
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <Card padding="md" bordered>
        <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
          {/* Type Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full lg:w-auto pb-1 lg:pb-0">
            {["all", "holiday", "exam", "event", "deadline", "meeting"].map((type) => {
              const isActive = typeFilter === type;
              const cfg = TYPE_CONFIG[type] || {};
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setTypeFilter(type)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition whitespace-nowrap cursor-pointer ${
                    isActive
                      ? "bg-primary text-white shadow-2xs"
                      : "bg-surface-raised hover:bg-surface-hover text-ink-soft"
                  }`}
                >
                  {type === "all" ? "All Events" : cfg.label || type}
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="relative w-full lg:w-72">
            <Search className="w-4 h-4 text-ink-faint absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search holidays, exams, schedules..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-background border border-line rounded-xl text-ink outline-none focus:ring-2 focus:ring-primary/30"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Main Content Area */}
      {loading ? (
        <UniversalSpinner label="Loading academic calendar..." />
      ) : viewMode === "grid" ? (
        /* ================= GRID VIEW ================= */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 7-Day Monthly Calendar Grid (Span 2 cols on desktop) */}
          <div className="lg:col-span-2 space-y-4">
            <Card padding="md" bordered>
              {/* Month Navigation Bar */}
              <div className="flex items-center justify-between pb-3 border-b border-line/60">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-black text-ink">
                    {currentDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
                  </h2>
                  <Button variant="subtle" size="xs" onClick={handleToday}>
                    Today
                  </Button>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="p-1.5 rounded-lg border border-line hover:bg-background text-ink-soft hover:text-ink transition cursor-pointer"
                    title="Previous Month"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="p-1.5 rounded-lg border border-line hover:bg-background text-ink-soft hover:text-ink transition cursor-pointer"
                    title="Next Month"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Day of Week Headers */}
              <div className="grid grid-cols-7 gap-1 pt-3 pb-1 text-center">
                {WEEKDAYS.map((day) => (
                  <div key={day} className="text-[11px] font-bold text-ink-faint uppercase tracking-wider">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid Cells */}
              <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                {calendarDays.map((cell, idx) => {
                  const dayDate = cell.date;
                  const dayNum = dayDate.getDate();
                  const isToday =
                    new Date().toDateString() === dayDate.toDateString();
                  const isSelected =
                    selectedDay && selectedDay.toDateString() === dayDate.toDateString();
                  const dayEvents = getEventsForDate(dayDate);

                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedDay(dayDate)}
                      className={`min-h-[82px] sm:min-h-[96px] p-1.5 rounded-xl border transition flex flex-col justify-between cursor-pointer ${
                        isSelected
                          ? "ring-2 ring-primary border-primary bg-primary/5"
                          : isToday
                          ? "border-primary/40 bg-surface-alt/70"
                          : cell.isCurrentMonth
                          ? "border-line/60 bg-surface hover:bg-surface-hover"
                          : "border-line/30 bg-surface-alt/30 opacity-40 hover:opacity-75"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-bold leading-none ${
                            isToday
                              ? "w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px]"
                              : isSelected
                              ? "text-primary font-black"
                              : "text-ink"
                          }`}
                        >
                          {dayNum}
                        </span>
                        {dayEvents.length > 0 && (
                          <span className="text-[9px] font-extrabold px-1 py-0.2 rounded-full bg-primary/10 text-primary">
                            {dayEvents.length}
                          </span>
                        )}
                      </div>

                      {/* Event chips */}
                      <div className="space-y-1 mt-1 overflow-hidden">
                        {dayEvents.slice(0, 2).map((ev) => {
                          const cfg = TYPE_CONFIG[ev.type?.toLowerCase()] || TYPE_CONFIG.holiday;
                          return (
                            <div
                              key={ev._id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewingEvent(ev);
                              }}
                              className={`text-[9px] font-semibold px-1 py-0.5 rounded truncate border ${cfg.pillClass}`}
                              title={ev.title}
                            >
                              {ev.title}
                            </div>
                          );
                        })}
                        {dayEvents.length > 2 && (
                          <div className="text-[9px] font-bold text-ink-faint px-1">
                            +{dayEvents.length - 2} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Selected Date Details Panel (1 col on desktop) */}
          <div className="space-y-4">
            <Card padding="md" bordered className="sticky top-6">
              <div className="flex items-center justify-between pb-3 border-b border-line/60">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">
                    Selected Date
                  </span>
                  <h3 className="text-sm font-black text-ink">
                    {selectedDay.toLocaleDateString("en-IN", {
                      weekday: "short",
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </h3>
                </div>
                {isAdmin && (
                  <Button
                    variant="subtle"
                    size="xs"
                    leftIcon={Plus}
                    onClick={() => handleOpenAddModal(selectedDay)}
                  >
                    Add Here
                  </Button>
                )}
              </div>

              {selectedDayEvents.length === 0 ? (
                <div className="py-8 text-center space-y-2">
                  <CalendarDays className="w-8 h-8 text-ink-faint mx-auto opacity-40" />
                  <p className="text-xs font-semibold text-ink-soft">
                    No academic events or holidays on this date.
                  </p>
                  {isAdmin && (
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => handleOpenAddModal(selectedDay)}
                      leftIcon={Plus}
                    >
                      Schedule Event
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-2.5 pt-3 max-h-[500px] overflow-y-auto">
                  {selectedDayEvents.map((ev) => {
                    const cfg = TYPE_CONFIG[ev.type?.toLowerCase()] || TYPE_CONFIG.holiday;
                    return (
                      <div
                        key={ev._id}
                        onClick={() => setViewingEvent(ev)}
                        className="p-3 rounded-xl bg-surface-alt border border-line/70 hover:border-primary/50 transition cursor-pointer space-y-1.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xs font-black text-ink line-clamp-2">
                            {ev.title}
                          </h4>
                          <span
                            className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md shrink-0 border ${cfg.bgClass}`}
                          >
                            {cfg.label}
                          </span>
                        </div>
                        {ev.description && (
                          <p className="text-[11px] text-ink-soft line-clamp-2 leading-relaxed">
                            {ev.description}
                          </p>
                        )}
                        <div className="flex items-center justify-between pt-1 border-t border-line/40 text-[10px] text-ink-faint">
                          <span>
                            {formatDateDMY(ev.startDate || ev.date)}
                            {ev.endDate && ev.endDate !== (ev.startDate || ev.date)
                              ? ` → ${formatDateDMY(ev.endDate)}`
                              : ""}
                          </span>
                          {isAdmin && (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => handleOpenEditModal(ev, e)}
                                className="text-ink-soft hover:text-primary p-0.5"
                                title="Edit"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleDelete(ev._id, e)}
                                className="text-rose-500 hover:text-rose-700 p-0.5"
                                title="Delete"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </div>
      ) : (
        /* ================= AGENDA / LIST VIEW ================= */
        <Card padding="none" className="overflow-hidden" bordered>
          {filteredEvents.length === 0 ? (
            <div className="p-12">
              <EmptyState
                icon={CalendarIcon}
                title="No events found"
                description="No academic events match your active search or type filter."
                action={
                  isAdmin ? (
                    <Button variant="primary" size="sm" onClick={() => handleOpenAddModal()} leftIcon={Plus}>
                      Create First Event
                    </Button>
                  ) : null
                }
              />
            </div>
          ) : (
            <div className="divide-y divide-line/60">
              {filteredEvents.map((e) => {
                const { month: monthStr, day: dayNum, weekday } = getDateBadgeParts(
                  e.date || e.startDate
                );
                const cfg = TYPE_CONFIG[e.type?.toLowerCase()] || TYPE_CONFIG.holiday;
                const cd = getRelativeCountdown(e.startDate || e.date);

                return (
                  <div
                    key={e._id}
                    onClick={() => setViewingEvent(e)}
                    className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-background/60 transition cursor-pointer"
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      {/* Date Badge */}
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex flex-col items-center justify-center text-primary shrink-0">
                        <span className="text-[10px] font-bold uppercase leading-none">{monthStr}</span>
                        <span className="text-base font-black leading-tight">{dayNum}</span>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-ink text-sm truncate">{e.title}</h4>
                          <span
                            className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${cfg.bgClass}`}
                          >
                            {cfg.label}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                              cd.highlight
                                ? "bg-primary/15 text-primary"
                                : "text-ink-faint bg-surface border border-line"
                            }`}
                          >
                            {cd.label}
                          </span>
                        </div>

                        {e.description && (
                          <p className="text-xs text-ink-soft mt-1 leading-relaxed line-clamp-2">
                            {e.description}
                          </p>
                        )}

                        <div className="flex items-center gap-3 text-[11px] text-ink-faint mt-1">
                          <span>{weekday}, {formatDateDMY(e.date || e.startDate)}</span>
                          {e.endDate &&
                            new Date(e.endDate).getTime() !==
                              new Date(e.date || e.startDate).getTime() && (
                              <span>until {formatDateDMY(e.endDate)}</span>
                            )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <Button
                        variant="subtle"
                        size="xs"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setViewingEvent(e);
                        }}
                      >
                        Details
                      </Button>

                      {isAdmin && (
                        <>
                          <button
                            type="button"
                            onClick={(ev) => handleOpenEditModal(e, ev)}
                            className="p-1.5 rounded-lg border border-line bg-surface hover:bg-background text-ink-soft hover:text-primary transition cursor-pointer"
                            title="Edit event"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(ev) => handleDelete(e._id, ev)}
                            className="p-1.5 rounded-lg border border-line bg-surface hover:bg-rose-500/10 text-ink-soft hover:text-rose-600 transition cursor-pointer"
                            title="Delete event"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* Event Details Modal */}
      <Modal
        isOpen={!!viewingEvent}
        onClose={() => setViewingEvent(null)}
        title={viewingEvent?.title || "Academic Event Details"}
        size="md"
      >
        {viewingEvent && (
          <div className="space-y-4 pt-1">
            <div className="flex items-center gap-2 flex-wrap">
              {(() => {
                const cfg = TYPE_CONFIG[viewingEvent.type?.toLowerCase()] || TYPE_CONFIG.holiday;
                return (
                  <span className={`text-xs font-extrabold uppercase px-2.5 py-1 rounded-lg border ${cfg.bgClass}`}>
                    {cfg.label}
                  </span>
                );
              })()}
              {(() => {
                const cd = getRelativeCountdown(viewingEvent.startDate || viewingEvent.date);
                return (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-surface-alt border border-line text-ink">
                    {cd.label}
                  </span>
                );
              })()}
            </div>

            <div className="p-4 bg-surface-alt/60 rounded-xl border border-line/60 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-ink">
                <Clock className="w-4 h-4 text-primary" />
                <span>
                  From: {formatDateReadable(viewingEvent.startDate || viewingEvent.date, true)}
                </span>
              </div>
              {viewingEvent.endDate &&
                new Date(viewingEvent.endDate).getTime() !==
                  new Date(viewingEvent.startDate || viewingEvent.date).getTime() && (
                  <div className="flex items-center gap-2 text-xs font-semibold text-ink">
                    <Clock className="w-4 h-4 text-primary" />
                    <span>To: {formatDateReadable(viewingEvent.endDate, true)}</span>
                  </div>
                )}
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">
                Description / Notice
              </span>
              <p className="text-xs text-ink mt-1 leading-relaxed bg-surface p-3.5 rounded-xl border border-line/50 whitespace-pre-wrap">
                {viewingEvent.description || "No further detailed description provided for this academic event."}
              </p>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-line/50">
              {isAdmin ? (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={Edit2}
                    onClick={() => {
                      const ev = viewingEvent;
                      setViewingEvent(null);
                      handleOpenEditModal(ev);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-rose-500 hover:text-rose-700"
                    leftIcon={Trash2}
                    onClick={(e) => handleDelete(viewingEvent._id, e)}
                  >
                    Delete
                  </Button>
                </div>
              ) : (
                <div />
              )}
              <Button variant="primary" size="sm" onClick={() => setViewingEvent(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Create / Edit Modal (Admins only) */}
      {isAdmin && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingEvent ? "Edit Academic Event" : "Add Calendar Event / Holiday"}
          size="md"
        >
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <Input
              label="Event / Holiday Title *"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Mid-Term Examination Start, Diwali Break"
              required
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Start Date *"
                type="date"
                value={form.startDate}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    startDate: e.target.value,
                    date: e.target.value,
                    endDate: f.endDate < e.target.value ? e.target.value : f.endDate,
                  }))
                }
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
              <option value="exam">Examination / Evaluation Period</option>
              <option value="event">Academic Event / Orientation / Fest</option>
              <option value="deadline">Academic Deadline / Grade Submission</option>
              <option value="meeting">Faculty / Department Meeting</option>
            </Select>

            <Textarea
              label="Description / Circular Notes (Optional)"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Provide circular details, timing, or instructions for students and faculty..."
              rows={3}
            />

            <div className="flex justify-end gap-2 pt-3 border-t border-line/50">
              <Button variant="outline" size="sm" type="button" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" loading={submitting}>
                {editingEvent ? "Update Event" : "Publish Event"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
