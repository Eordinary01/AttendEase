// src/component/Dashboard/index.jsx (Revamped Student Workspace — Bento Grid)
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Calendar,
  CalendarDays,
  Clock,
  Ticket,
  Plus,
  RefreshCw,
  FileText,
  Eye,
  Download,
  Megaphone,
  CheckCircle2,
  AlertCircle,
  BookOpen,
} from "lucide-react";

import api from "../../utils/api";
import { logError } from "../../utils/logger";
import { useTheme } from "../../contexts/ThemeContexts";
import DashboardHeader from "../common/ui/DashboardHeader";
import StatValue from "../common/ui/StatValue";
import Button from "../common/ui/Button";
import Badge from "../common/ui/Badge";
import EmptyState from "../common/ui/EmptyState";
import Modal from "../common/ui/Modal";
import { Input, Select, Textarea } from "../common/ui/Input";

function hexToRgbStr(hex = "#6366f1") {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r} ${g} ${b}`;
}

export default function StudentDashboard({ userId, userName, userEmail }) {
  const { colors } = useTheme();
  const primary = colors?.primary || "#1d4ed8";
  const secondary = colors?.secondary || "#4f46e5";

  const cssVars = {
    "--theme-primary": primary,
    "--theme-secondary": secondary,
    "--theme-primary-rgb": hexToRgbStr(primary),
  };

  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  // ── States ─────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data states
  const [profile, setProfile] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [subjectStats, setSubjectStats] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [enrolledSubjects, setEnrolledSubjects] = useState([]);

  // Modals
  const [isProofModalOpen, setIsProofModalOpen] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState(null);

  // Ticket creation form
  const [ticketForm, setTicketForm] = useState({
    subjectId: "",
    reasonDescription: "",
    absenceDate: new Date().toISOString().split("T")[0],
    files: [],
  });
  const [submittingTicket, setSubmittingTicket] = useState(false);

  // ── Fetch All Data ─────────────────────────────────────────────────────────
  const fetchData = useCallback(async (isSilent = false) => {
    if (!token) return;
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const [profRes, attRes, tickRes, alertRes, calRes, subRes] =
        await Promise.allSettled([
          api.get("/users/profile"),
          api.get("/attendance/student/stats").catch(() => api.get("/attendance/stats")),
          api.get("/tickets/student").catch(() => api.get("/tickets/my-tickets")),
          api.get("/alerts"),
          api.get("/calendar").catch(() => ({ data: { data: [] } })),
          api.get("/subjects/student/enrolled").catch(() => api.get("/subjects/all")),
        ]);

      let userSec = "A";
      if (profRes.status === "fulfilled") {
        const u = profRes.value.data?.user || profRes.value.data?.data || profRes.value.data;
        setProfile(u);
        if (u?.section) userSec = u.section;
      }

      if (attRes.status === "fulfilled") {
        const d = attRes.value.data?.data || attRes.value.data || {};
        setAttendance(d.overall || d.overallStats || d);
        const statsList =
          d.subjectWiseStats ||
          d.bySubject ||
          d.subjectStats ||
          [];
        setSubjectStats(Array.isArray(statsList) ? statsList : []);
      }

      if (tickRes.status === "fulfilled") {
        const tData = tickRes.value.data;
        setTickets(
          Array.isArray(tData?.tickets)
            ? tData.tickets
            : Array.isArray(tData?.data)
            ? tData.data
            : Array.isArray(tData)
            ? tData
            : []
        );
      }

      if (alertRes.status === "fulfilled") {
        const aList = alertRes.value.data?.data || alertRes.value.data || [];
        setAlerts(Array.isArray(aList) ? aList : []);
      }

      if (calRes.status === "fulfilled") {
        const cList = calRes.value.data?.data || calRes.value.data || [];
        setHolidays(Array.isArray(cList) ? cList : []);
      }

      if (subRes.status === "fulfilled") {
        const sList =
          subRes.value.data?.subjects ||
          subRes.value.data?.data?.subjects ||
          subRes.value.data?.data ||
          subRes.value.data ||
          [];
        setEnrolledSubjects(Array.isArray(sList) ? sList : []);
      }

      // Fetch timetable for today's schedule
      try {
        const ttRes = await api.get(`/timetable/section/${userSec}`);
        const ttList = ttRes.data?.data || ttRes.data?.timetable || ttRes.data || [];
        setTimetable(Array.isArray(ttList) ? ttList : []);
      } catch {
        setTimetable([]);
      }
    } catch (err) {
      logError("Student Dashboard fetch", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Derived Data ───────────────────────────────────────────────────────────
  const currentDayName = useMemo(() => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return days[new Date().getDay()];
  }, []);

  const timeOfDay = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "morning";
    if (hour < 17) return "afternoon";
    return "evening";
  }, []);

  const todaySchedule = useMemo(() => {
    return timetable.filter((item) => {
      const d = item.day || item.dayOfWeek || "";
      return d.toLowerCase() === currentDayName.toLowerCase();
    });
  }, [timetable, currentDayName]);

  const totalClasses = attendance?.totalClasses ?? attendance?.total ?? 0;
  const attendedClasses = attendance?.attendedClasses ?? attendance?.presentCount ?? attendance?.present ?? attendance?.attendedCount ?? 0;
  const absentClasses = attendance?.absentClasses ?? attendance?.absentCount ?? attendance?.absent ?? Math.max(0, totalClasses - attendedClasses);

  const overallPercent = useMemo(() => {
    if (totalClasses > 0) {
      return Math.round((attendedClasses / totalClasses) * 1000) / 10;
    }
    const p =
      attendance?.overallPercentage ??
      attendance?.percentage ??
      attendance?.compliancePercentage ??
      attendance?.attendancePercentage;
    if (typeof p === "number" && p > 0) return Math.round(p * 10) / 10;
    return null;
  }, [attendance, totalClasses, attendedClasses]);

  const displaySubjects = useMemo(() => {
    if (enrolledSubjects && enrolledSubjects.length > 0) {
      return enrolledSubjects.map((sub) => {
        const subId = String(sub._id || sub.id || "");
        const subCode = String(sub.subjectCode || "").toUpperCase();

        const stat = subjectStats.find(
          (s) =>
            (s.subjectId && String(s.subjectId) === subId) ||
            (s._id && String(s._id) === subId) ||
            (s.subjectCode && String(s.subjectCode).toUpperCase() === subCode)
        );

        const present = stat ? (stat.presentClasses ?? stat.presentCount ?? stat.attendedClasses ?? 0) : 0;
        const total = stat ? (stat.totalClasses ?? stat.total ?? 0) : 0;
        const absent = stat ? (stat.absentClasses ?? stat.absentCount ?? Math.max(0, total - present)) : 0;
        const hasAttendance = total > 0;

        const pct = hasAttendance
          ? (typeof stat?.percentage === "number"
              ? Math.round(stat.percentage * 10) / 10
              : Math.round((present / total) * 1000) / 10)
          : null;

        return {
          id: subId || subCode,
          subjectCode: sub.subjectCode || stat?.subjectCode || "SUB",
          subjectName: sub.subjectName || stat?.subjectName || "Course Subject",
          percentage: pct,
          present,
          total,
          absent,
          hasAttendance,
        };
      });
    }

    if (subjectStats && subjectStats.length > 0) {
      return subjectStats.map((sub, idx) => {
        const present = sub.presentClasses ?? sub.presentCount ?? sub.attendedClasses ?? 0;
        const total = sub.totalClasses ?? sub.total ?? 0;
        const absent = sub.absentClasses ?? sub.absentCount ?? Math.max(0, total - present);
        const hasAttendance = total > 0;
        const pct = hasAttendance
          ? (typeof sub.percentage === "number"
              ? Math.round(sub.percentage * 10) / 10
              : Math.round((present / total) * 1000) / 10)
          : null;

        return {
          id: sub.subjectId || sub._id || idx,
          subjectCode: sub.subjectCode || "SUB",
          subjectName: sub.subjectName || "Subject Name",
          percentage: pct,
          present,
          total,
          absent,
          hasAttendance,
        };
      });
    }

    return [];
  }, [enrolledSubjects, subjectStats]);

  const activeSubjectsCount = useMemo(() => {
    return displaySubjects.filter((s) => s.hasAttendance).length;
  }, [displaySubjects]);

  const safeSubjectsCount = useMemo(() => {
    return displaySubjects.filter((s) => s.hasAttendance && s.percentage >= 75).length;
  }, [displaySubjects]);

  const pendingTicketsCount = useMemo(() => {
    return tickets.filter((t) => (t.verificationStatus || t.status) === "pending").length;
  }, [tickets]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleFileClick = async (ticketId, file) => {
    try {
      const fileId = file.id || file._id;
      const res = await api.get(`/tickets/${ticketId}/files/${fileId}`, {
        responseType: "blob",
      });
      const fileType = res.headers["content-type"] || "";
      const url = URL.createObjectURL(res.data);
      if (fileType.startsWith("image/")) {
        setFileContent({ type: "image", content: url });
      } else if (fileType === "application/pdf") {
        setFileContent({ type: "pdf", content: url });
      } else {
        setFileContent({
          type: "download",
          content: url,
          fileName: file.originalName || file.filename || "document",
        });
      }
      setSelectedFile({ ticketId, file });
    } catch {
      setFileContent({ type: "error", content: "Error loading proof preview." });
    }
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!ticketForm.subjectId || !ticketForm.reasonDescription.trim()) {
      alert("Please select a subject and describe the reason.");
      return;
    }

    try {
      setSubmittingTicket(true);
      const formData = new FormData();
      formData.append("subjectId", ticketForm.subjectId);
      formData.append("reasonDescription", ticketForm.reasonDescription);
      formData.append("absenceDate", ticketForm.absenceDate);
      if (ticketForm.files && ticketForm.files.length > 0) {
        for (let i = 0; i < ticketForm.files.length; i++) {
          formData.append("files", ticketForm.files[i]);
        }
      }

      await api.post("/tickets", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setIsProofModalOpen(false);
      setTicketForm({
        subjectId: "",
        reasonDescription: "",
        absenceDate: new Date().toISOString().split("T")[0],
        files: [],
      });
      fetchData(true);
    } catch (err) {
      alert(err.response?.data?.message || "Error submitting absence proof.");
    } finally {
      setSubmittingTicket(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div
            className="w-10 h-10 border-3 border-t-transparent rounded-full animate-spin mx-auto"
            style={{ borderColor: `${primary}30`, borderTopColor: primary }}
          />
          <p className="text-xs font-semibold text-ink-soft tracking-wider uppercase">
            Loading Workspace...
          </p>
        </div>
      </div>
    );
  }

  const studentName = profile?.name || userName || localStorage.getItem("userName") || "Student";
  const firstName = studentName.split(" ")[0];
  const branch = profile?.branch || profile?.course || "CSE";
  const section = profile?.section || "A";
  const semester = profile?.semester || 1;
  const rollNo = profile?.rollNo || "N/A";

  return (
    <div style={cssVars} className="min-h-screen bg-background text-ink pb-12">
      {/* Shared Dashboard Header Strip */}
      <DashboardHeader
        greeting={`Good ${timeOfDay}, ${firstName}`}
        meta={`${branch} • Section ${section} • Semester ${semester} • Roll: ${rollNo}`}
        highlightAction={
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsProofModalOpen(true)}
            leftIcon={Plus}
          >
            Submit Leave Proof
          </Button>
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(true)}
            loading={refreshing}
            leftIcon={RefreshCw}
          >
            Sync
          </Button>
        }
      />

      {/* Main Container */}
      <div className="max-w-[1440px] mx-auto px-6 pt-6 space-y-6">
        {/* ── Row 1: Primary Bento (Attendance Hero [2/3] + Today's Schedule [1/3]) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Attendance Hero Card — 2/3 width, the page's priority */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-2 rounded-2xl bg-surface border border-line/70 p-5 shadow-sm space-y-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                Attendance Compliance
              </span>
              <Badge
                tone={
                  overallPercent === null
                    ? "primary"
                    : overallPercent >= 75
                    ? "success"
                    : "danger"
                }
                size="sm"
              >
                {overallPercent === null
                  ? "Enrolled"
                  : overallPercent >= 75
                  ? "Good Standing"
                  : "Shortage Warning"}
              </Badge>
            </div>

            <StatValue
              value={overallPercent !== null ? `${overallPercent}%` : "--"}
              subtitle="/ 75% minimum required"
              progress={overallPercent ?? 0}
              progressColor={
                overallPercent === null
                  ? "primary"
                  : overallPercent >= 75
                  ? "green"
                  : "red"
              }
              variant="hero"
              accent
            />

            <div className="flex items-center justify-between text-xs text-ink-soft pt-3 border-t border-line/50">
              <span>
                Attended: <strong className="text-ink font-bold">{attendedClasses}</strong> classes
              </span>
              <span>
                Absent: <strong className="text-ink font-bold">{absentClasses}</strong> classes
              </span>
              <span>
                Total: <strong className="text-ink font-bold">{totalClasses}</strong> classes
              </span>
            </div>
          </motion.div>

          {/* Today's Schedule — 1/3 width */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="lg:col-span-1 rounded-2xl bg-surface border border-line/50 p-5 space-y-3 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                  Today — {currentDayName}
                </span>
                <span className="text-xs font-semibold text-primary">
                  {todaySchedule.length} classes
                </span>
              </div>

              {todaySchedule.length === 0 ? (
                <EmptyState
                  icon={<Clock className="w-5 h-5 text-ink-faint" />}
                  title="No classes scheduled today"
                  description="Enjoy your day off or review upcoming lectures."
                  className="py-4"
                />
              ) : (
                <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                  {todaySchedule.map((slot, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-background border border-line/50 flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0">
                        <span className="font-mono font-bold text-primary block truncate">
                          {slot.subjectCode || slot.subject?.subjectCode || "COURSE"}
                        </span>
                        <span className="text-[11px] text-ink-soft truncate block">
                          {slot.room ? `Room ${slot.room}` : "Main Hall"}
                        </span>
                      </div>
                      <span className="shrink-0 text-[11px] font-semibold text-ink font-mono">
                        {slot.time || `${slot.startTime || "09:00"} - ${slot.endTime || "10:00"}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => navigate("/timetable")}
              className="text-xs text-primary font-semibold hover:underline text-left pt-2 border-t border-line/40 flex items-center justify-between"
            >
              <span>View full weekly timetable</span>
              <span>→</span>
            </button>
          </motion.div>
        </div>

        {/* ── Row 2: Subject Breakdown (Full-Width Medium Card) ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl bg-surface border border-line/50 p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-ink">Course-wise Attendance</h3>
            <button
              onClick={() => navigate("/student/subjects")}
              className="text-xs text-primary font-bold hover:underline flex items-center gap-1"
            >
              <span>View All Subjects ({displaySubjects.length})</span>
              <span>→</span>
            </button>
          </div>

          {displaySubjects.length === 0 ? (
            <EmptyState
              icon={<BookOpen className="w-6 h-6 text-primary" />}
              title="No enrolled subjects found"
              description="Your semester courses and attendance will populate here once enrolled."
              className="py-8"
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {displaySubjects.slice(0, 4).map((sub) => {
                const isSafe = sub.hasAttendance ? sub.percentage >= 75 : true;

                return (
                  <div
                    key={sub.id}
                    className="p-4 rounded-xl bg-background border border-line/50 space-y-2 hover:border-primary/40 transition"
                  >
                    <span className="text-[10px] font-mono font-bold text-primary block">
                      {sub.subjectCode}
                    </span>
                    <h4 className="text-xs font-bold text-ink truncate" title={sub.subjectName}>
                      {sub.subjectName}
                    </h4>
                    <StatValue
                      value={sub.hasAttendance ? `${sub.percentage}%` : "--"}
                      progress={sub.hasAttendance ? sub.percentage : 0}
                      progressColor={!sub.hasAttendance ? "primary" : isSafe ? "green" : "red"}
                      variant="compact"
                    />
                    <div className="flex items-center justify-between text-[11px] text-ink-soft pt-1">
                      <span>
                        {sub.hasAttendance ? `${sub.present}/${sub.total} attended` : "No sessions held"}
                      </span>
                      {sub.hasAttendance ? (
                        <span className={sub.absent > 3 ? "text-rose-600 font-semibold" : ""}>
                          {sub.absent} absent
                        </span>
                      ) : (
                        <span className="text-ink-faint">Upcoming</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {displaySubjects.length > 0 && (
            <div className="flex items-center justify-between pt-2 border-t border-line/40 text-xs text-ink-soft flex-wrap gap-2">
              <p>
                {activeSubjectsCount > 0 ? (
                  <>
                    <strong>{safeSubjectsCount}</strong> of <strong>{activeSubjectsCount}</strong> active {activeSubjectsCount === 1 ? "course is" : "courses are"} in compliance (≥ 75% attendance).
                  </>
                ) : (
                  <>
                    <strong>{displaySubjects.length}</strong> enrolled {displaySubjects.length === 1 ? "subject" : "subjects"} registered for this semester.
                  </>
                )}
              </p>
              <button
                onClick={() => navigate("/attendance-history")}
                className="text-primary font-bold hover:underline shrink-0 flex items-center gap-1 ml-auto"
              >
                <span>View full attendance breakdown</span>
                <span>→</span>
              </button>
            </div>
          )}
        </motion.div>

        {/* ── Row 3: 3-Card Row (Academic Calendar [1/3] + Notices [1/3] + Leave Proofs [1/3]) ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* 1. Academic Calendar & Holidays */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-2xl bg-surface border border-line/50 p-5 space-y-3 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-primary" /> Academic Calendar
                </h3>
                <span className="text-[11px] font-semibold text-ink-faint">
                  {holidays.length} Events
                </span>
              </div>

              {holidays.length === 0 ? (
                <EmptyState
                  icon={<CalendarDays className="w-6 h-6 text-primary" />}
                  title="No upcoming events"
                  description="University calendar schedule will appear here."
                  className="py-8"
                />
              ) : (
                <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                  {holidays.slice(0, 5).map((h, idx) => {
                    const dateObj = new Date(h.date || h.startDate);
                    const monthStr = dateObj.toLocaleDateString("en-US", { month: "short" });
                    const dayNum = dateObj.toLocaleDateString("en-US", { day: "2-digit" });
                    const dayName = dateObj.toLocaleDateString("en-US", { weekday: "short" });

                    return (
                      <div
                        key={h._id || idx}
                        className="p-2.5 rounded-xl bg-background border border-line/50 flex items-center gap-3 hover:border-primary/40 transition"
                      >
                        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex flex-col items-center justify-center text-primary shrink-0">
                          <span className="text-[9px] font-bold uppercase leading-none">{monthStr}</span>
                          <span className="text-xs font-black leading-tight">{dayNum}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-ink truncate">{h.title}</h4>
                          <div className="flex items-center gap-1.5 text-[10px] text-ink-soft mt-0.5">
                            <span>{dayName}</span>
                            <span>•</span>
                            <span className="capitalize font-semibold text-primary">{h.type || "Holiday"}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {holidays.length > 5 && (
              <button
                onClick={() => navigate("/calendar")}
                className="text-xs text-primary font-semibold hover:underline text-left pt-2 border-t border-line/40"
              >
                View full academic schedule →
              </button>
            )}
          </motion.div>

          {/* 2. Notices & Circulars Card */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl bg-surface border border-line/50 p-5 space-y-3 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-primary" /> Notices & Circulars
                </h3>
                <span className="text-[11px] font-semibold text-ink-faint">
                  {alerts.length} Published
                </span>
              </div>

              {alerts.length === 0 ? (
                <EmptyState
                  icon={<Megaphone className="w-6 h-6 text-primary" />}
                  title="No active announcements"
                  description="Institution notices and circulars will be broadcast here."
                  className="py-8"
                />
              ) : (
                <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                  {alerts.slice(0, 4).map((a, idx) => (
                    <div
                      key={a._id || idx}
                      onClick={() => setSelectedNotice(a)}
                      className="p-3 rounded-xl bg-background border border-line/50 hover:border-primary/40 transition cursor-pointer space-y-1"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="text-xs font-bold text-ink truncate">
                          {a.title || "Institution Notice"}
                        </h4>
                        <span className="text-[10px] text-ink-faint shrink-0">
                          {a.createdAt
                            ? new Date(a.createdAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })
                            : "Recent"}
                        </span>
                      </div>
                      <p className="text-[11px] text-ink-soft line-clamp-2 leading-relaxed">
                        {a.message}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {alerts.length > 4 && (
              <button
                onClick={() => setSelectedNotice(alerts[0])}
                className="text-xs text-primary font-semibold hover:underline text-left pt-2 border-t border-line/40"
              >
                View all {alerts.length} notices →
              </button>
            )}
          </motion.div>

          {/* 3. Absence Proofs Card */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="rounded-2xl bg-surface border border-line/50 p-5 space-y-3 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                  <Ticket className="w-4 h-4 text-primary" /> Absence Proofs
                </h3>
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    pendingTicketsCount > 0
                      ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                      : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                  }`}
                >
                  {pendingTicketsCount > 0 ? `${pendingTicketsCount} In Review` : "All Verified"}
                </span>
              </div>

              {tickets.length === 0 ? (
                <EmptyState
                  icon={<Ticket className="w-6 h-6 text-primary" />}
                  title="No absence proof tickets raised"
                  description="Submit medical certificates or duty leaves to maintain attendance compliance."
                  action={{
                    label: "+ New Proof",
                    onClick: () => setIsProofModalOpen(true),
                  }}
                  className="py-8"
                />
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {tickets.map((t, idx) => {
                    const status = t.verificationStatus || t.status || "pending";
                    const tone =
                      status === "approved" || status === "verified"
                        ? "success"
                        : status === "rejected"
                        ? "danger"
                        : "warning";

                    return (
                      <div
                        key={t._id || t.id || idx}
                        className="p-3 rounded-xl bg-background border border-line/50 space-y-1.5 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-ink-faint font-bold">
                            #{t._id ? t._id.slice(-6).toUpperCase() : `TICK-${idx + 1}`}
                          </span>
                          <Badge tone={tone} size="sm" className="capitalize">
                            {status}
                          </Badge>
                        </div>
                        <p className="text-ink font-semibold truncate">
                          {t.subject?.subjectName || t.subject?.subjectCode || t.reasonDescription || "Leave Request"}
                        </p>
                        <div className="flex items-center justify-between text-[11px] text-ink-soft">
                          <span>
                            {t.absentDate
                              ? new Date(t.absentDate).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                              : "Date specified"}
                          </span>
                          {t.proofDocuments && t.proofDocuments.length > 0 && (
                            <button
                              onClick={() => handleFileClick(t._id || t.id, t.proofDocuments[0])}
                              className="text-primary font-bold hover:underline inline-flex items-center gap-1"
                            >
                              <FileText className="w-3 h-3" />
                              View Doc
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {tickets.length > 0 && (
              <button
                onClick={() => setIsProofModalOpen(true)}
                className="w-full text-xs font-semibold text-ink hover:text-primary border border-line/50 rounded-xl py-2 transition hover:bg-background"
              >
                + Submit Another Proof
              </button>
            )}
          </motion.div>
        </div>
      </div>

      {/* ── Proof Request Submission Modal ── */}
      <Modal
        isOpen={isProofModalOpen}
        onClose={() => setIsProofModalOpen(false)}
        title="Submit Absence / Medical Proof"
        size="lg"
      >
        <form onSubmit={handleCreateTicket} className="space-y-4">
          <Select
            label="Subject / Course"
            value={ticketForm.subjectId}
            onChange={(e) => setTicketForm((f) => ({ ...f, subjectId: e.target.value }))}
            required
          >
            <option value="">-- Choose Subject --</option>
            {enrolledSubjects.map((s) => (
              <option key={s.id || s._id} value={s.id || s._id}>
                {s.subjectName} ({s.subjectCode})
              </option>
            ))}
          </Select>

          <Input
            label="Absence Date"
            type="date"
            value={ticketForm.absenceDate}
            onChange={(e) => setTicketForm((f) => ({ ...f, absenceDate: e.target.value }))}
            required
          />

          <Textarea
            label="Reason for Absence"
            value={ticketForm.reasonDescription}
            onChange={(e) => setTicketForm((f) => ({ ...f, reasonDescription: e.target.value }))}
            placeholder="Explain the reason (e.g. Medical emergency, University sports event, etc.)"
            rows={3}
            required
          />

          <div>
            <label className="text-xs font-semibold text-ink-soft block mb-1.5">
              Attach Supporting Documents (Doctor's Note, Certificates)
            </label>
            <input
              type="file"
              multiple
              onChange={(e) => setTicketForm((f) => ({ ...f, files: Array.from(e.target.files) }))}
              className="w-full text-xs text-ink file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsProofModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={submittingTicket}>
              Submit to Faculty
            </Button>
          </div>
        </form>
      </Modal>

      {/* Notice Inspection Modal */}
      <Modal
        isOpen={!!selectedNotice}
        onClose={() => setSelectedNotice(null)}
        title={selectedNotice?.title || "Notice Details"}
      >
        <div className="space-y-3">
          <p className="text-xs text-ink-faint">
            Published on{" "}
            {selectedNotice?.createdAt ? new Date(selectedNotice.createdAt).toLocaleString() : ""}
          </p>
          <div className="p-4 bg-background rounded-2xl border border-line text-xs text-ink leading-relaxed whitespace-pre-wrap">
            {selectedNotice?.message}
          </div>
        </div>
      </Modal>

      {/* Document Preview Modal */}
      <Modal
        isOpen={!!selectedFile}
        onClose={() => {
          setSelectedFile(null);
          setFileContent(null);
        }}
        title="Document Preview"
        size="xl"
      >
        {fileContent?.type === "image" && (
          <div className="flex justify-center p-2 bg-background rounded-2xl border border-line">
            <img
              src={fileContent.content}
              alt="Preview"
              className="max-w-full max-h-[70vh] object-contain rounded-xl"
            />
          </div>
        )}
        {fileContent?.type === "pdf" && (
          <iframe
            src={fileContent.content}
            title="PDF Viewer"
            className="w-full h-[70vh] rounded-2xl border border-line"
          />
        )}
        {fileContent?.type === "download" && (
          <div className="text-center py-10">
            <Download className="w-8 h-8 text-primary mx-auto mb-3" />
            <p className="text-xs font-semibold text-ink mb-4">
              Preview not supported directly in browser.
            </p>
            <a
              href={fileContent.content}
              download={fileContent.fileName}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:opacity-90 transition"
            >
              <Download className="w-3.5 h-3.5" />
              Download Document
            </a>
          </div>
        )}
        {fileContent?.type === "error" && (
          <div className="p-6 text-center text-red-500 text-xs">
            <p>{fileContent.content}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
