// src/component/teacherDashboard/index.jsx (Revamped Teacher Workspace — Bento Grid)
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Calendar,
  Ticket,
  RefreshCw,
  FileText,
  Download,
  Search,
  ChevronRight,
  Layers,
  Camera,
  ClipboardCheck,
  BookOpen,
  CalendarDays,
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

function hexToRgbStr(hex = "#6366f1") {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r} ${g} ${b}`;
}

export default function TeacherDashboard({ userId, userName, userEmail }) {
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
  const [tickets, setTickets] = useState([]);
  const [myAssignments, setMyAssignments] = useState([]);
  const [teacherTimetable, setTeacherTimetable] = useState([]);
  const [holidays, setHolidays] = useState([]);

  // Modals
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState(null);

  // Ticket filtering
  const [ticketSearch, setTicketSearch] = useState("");
  const [filterSection, setFilterSection] = useState("");

  // ── Fetch All Data ─────────────────────────────────────────────────────────
  const fetchData = useCallback(async (isSilent = false) => {
    if (!token) return;
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const uid = localStorage.getItem("userId");
      const [ticketsRes, assignmentsRes, calRes, ttRes] =
        await Promise.allSettled([
          api.get(`/tickets/teacher/pending`),
          uid ? api.get(`/subjects/teacher/${uid}/assignments`) : Promise.resolve({ data: {} }),
          api.get("/calendar").catch(() => ({ data: { data: [] } })),
          api.get("/timetable/teacher").catch(() => ({ data: { data: [] } })),
        ]);

      if (ticketsRes.status === "fulfilled") {
        setTickets(Array.isArray(ticketsRes.value.data?.tickets) ? ticketsRes.value.data.tickets : []);
      }
      if (assignmentsRes.status === "fulfilled") {
        setMyAssignments(
          Array.isArray(assignmentsRes.value.data?.subjects) ? assignmentsRes.value.data.subjects : []
        );
      }
      if (calRes.status === "fulfilled") {
        const cList = calRes.value.data?.data || calRes.value.data || [];
        setHolidays(Array.isArray(cList) ? cList : []);
      }
      if (ttRes.status === "fulfilled") {
        const tList = ttRes.value.data?.data || ttRes.value.data?.timetable || ttRes.value.data || [];
        setTeacherTimetable(Array.isArray(tList) ? tList : []);
      }
    } catch (err) {
      logError("Teacher Bento Workspace fetch", err);
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
    return teacherTimetable.filter((item) => {
      const d = item.day || item.dayOfWeek || "";
      return d.toLowerCase() === currentDayName.toLowerCase();
    });
  }, [teacherTimetable, currentDayName]);

  const teacherSections = useMemo(() => {
    return [...new Set(myAssignments.map((a) => a.section).filter(Boolean))].sort();
  }, [myAssignments]);

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      const q = ticketSearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        ticket.reasonDescription?.toLowerCase().includes(q) ||
        ticket.student?.rollNo?.toLowerCase().includes(q) ||
        ticket.student?.name?.toLowerCase().includes(q) ||
        ticket.subject?.subjectName?.toLowerCase().includes(q) ||
        ticket.subject?.subjectCode?.toLowerCase().includes(q);

      const matchesSection = !filterSection || ticket.student?.section === filterSection;

      return matchesSearch && matchesSection;
    });
  }, [tickets, ticketSearch, filterSection]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleVerify = async (ticketId, verificationStatus, verificationRemarks = "") => {
    try {
      await api.put(`/tickets/${ticketId}/verify`, {
        verificationStatus,
        verificationRemarks,
      });
      fetchData(true);
    } catch (err) {
      alert(err.response?.data?.message || "Error verifying proof");
    }
  };

  const handleMarkAttendance = async (ticketId) => {
    try {
      await api.post(`/tickets/${ticketId}/mark-attendance`, {});
      fetchData(true);
    } catch (err) {
      alert(err.response?.data?.message || "Error updating attendance");
    }
  };

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
            Loading Faculty Workspace...
          </p>
        </div>
      </div>
    );
  }

  const teacherName = userName || localStorage.getItem("userName") || "Professor";
  const subjectCodes = myAssignments.map((a) => a.subjectCode || a.code).filter(Boolean).slice(0, 3).join(", ");
  const metaText = subjectCodes ? `Assigned Courses: ${subjectCodes} • ${myAssignments.length} Teaching Batches` : "Faculty Department of Engineering & Technology";

  return (
    <div style={cssVars} className="min-h-screen bg-background text-ink pb-12">
      {/* Shared Dashboard Header Strip */}
      <DashboardHeader
        greeting={`Good ${timeOfDay}, ${teacherName}`}
        meta={metaText}
        highlightAction={
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate("/face-attendance")}
            leftIcon={Camera}
          >
            Start Face Attendance
          </Button>
        }
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/attendance")}
              leftIcon={ClipboardCheck}
            >
              Mark Manual
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchData(true)}
              loading={refreshing}
              leftIcon={RefreshCw}
            >
              Sync
            </Button>
          </>
        }
      />

      {/* Main Container */}
      <div className="max-w-[1440px] mx-auto px-6 pt-6 space-y-6">
        {/* ── Row 1: Primary Bento (Today's Classes [2/3] + Attendance Status [1/3]) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Today's Classes List — 2/3 width, the page's priority */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-2 rounded-2xl bg-surface border border-line/70 p-5 shadow-sm space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-ink">
                  Today's Classes — {currentDayName}
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-600 border border-sky-500/20">
                  {todaySchedule.length} Scheduled
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/face-attendance")}
                leftIcon={Camera}
              >
                Launch Roll Call
              </Button>
            </div>

            {todaySchedule.length === 0 ? (
              <EmptyState
                icon={<Calendar className="w-6 h-6 text-primary" />}
                title="No lectures scheduled today"
                description="No assigned periods found for your profile today."
                className="py-8"
              />
            ) : (
              <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                {todaySchedule.map((slot, idx) => (
                  <div
                    key={slot._id || slot.id || idx}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-background border border-line/50 hover:border-primary/40 transition gap-3"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span className="font-mono text-xs font-semibold text-ink-faint shrink-0">
                        {slot.time || `${slot.startTime || "09:00"} - ${slot.endTime || "10:00"}`}
                      </span>
                      <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary font-mono font-bold flex items-center justify-center text-xs shrink-0">
                        {slot.section || "A"}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-primary">
                            {slot.subjectCode || slot.code || "COURSE"}
                          </span>
                          <span className="text-[11px] font-bold text-ink-faint">
                            • Room {slot.room || "101"}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-ink truncate">
                          {slot.subjectName || slot.name || "Subject Lecture"}
                        </h4>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate("/attendance")}
                        leftIcon={ClipboardCheck}
                      >
                        Mark
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => navigate("/face-attendance")}
                        leftIcon={Camera}
                      >
                        Face Session
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Attendance Status Card — 1/3 width */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="lg:col-span-1 rounded-2xl bg-surface border border-line/50 p-5 space-y-4 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                  Attendance Progress
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                  Today
                </span>
              </div>

              <StatValue
                value={`${todaySchedule.length > 0 ? "Active" : "Clear"}`}
                label="Daily Class Pulse"
                subtitle={`${todaySchedule.length} lecture slots scheduled`}
                progress={todaySchedule.length > 0 ? 100 : 0}
                progressColor="primary"
                variant="compact"
              />

              <div className="pt-2 border-t border-line/50 space-y-1.5 text-xs text-ink-soft">
                <div className="flex justify-between">
                  <span>Assigned Batches:</span>
                  <strong className="text-ink">{myAssignments.length}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Active Sections:</span>
                  <strong className="text-ink">{teacherSections.join(", ") || "All"}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Pending Leave Proofs:</span>
                  <strong className="text-amber-600 font-bold">{tickets.length}</strong>
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/attendance")}
              className="w-full justify-center text-xs"
            >
              Open Manual Attendance Roster →
            </Button>
          </motion.div>
        </div>

        {/* ── Row 2: Subject Quick View (Full-Width Medium Card) ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl bg-surface border border-line/50 p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-ink">My Teaching Subjects</h3>
            <span className="text-xs text-ink-soft">
              {myAssignments.length} course assignments
            </span>
          </div>

          {myAssignments.length === 0 ? (
            <EmptyState
              icon={<BookOpen className="w-6 h-6 text-primary" />}
              title="No subjects assigned yet"
              description="Subjects will appear once assigned by the administrator."
              className="py-8"
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
              {myAssignments.map((sub, idx) => {
                const subCode = sub.subjectCode || sub.subject?.subjectCode || sub.code || "COURSE";
                const subName = sub.subjectName || sub.subject?.subjectName || sub.name || "Subject Name";
                const courseCode = sub.courseCode || sub.subject?.courseCode || sub.course || "";
                const branch = sub.branch || sub.subject?.branch || "";
                const sem = sub.semester || sub.subject?.semester || 1;
                const sec = sub.section || "A";
                const studentCount = sub.stats?.totalStudents;

                return (
                  <div
                    key={sub.assignmentId || sub._id || sub.id || idx}
                    className="p-4 rounded-xl bg-background border border-line/60 hover:border-primary/50 hover:shadow-sm transition-all flex flex-col justify-between space-y-3 group"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] font-mono font-bold text-primary truncate">
                          {subCode}
                        </span>
                        {courseCode && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 shrink-0">
                            {courseCode}{branch ? ` · ${branch}` : ""}
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-ink leading-snug line-clamp-2" title={subName}>
                        {subName}
                      </h4>
                    </div>

                    <div className="pt-2 border-t border-line/40 flex items-center justify-between text-[11px] text-ink-soft">
                      <span className="font-semibold text-ink">
                        Sec {sec} · Sem {sem}
                      </span>
                      {typeof studentCount === "number" && (
                        <span className="text-[10px] text-ink-faint">
                          {studentCount} {studentCount === 1 ? "student" : "students"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* ── Row 3: 3-Card Row (Absence Proofs [1/3] + Academic Calendar [1/3] + Faculty Quick Links [1/3]) ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* 1. Absence Proofs Queue Card */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-2xl bg-surface border border-line/50 p-5 space-y-3 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                  <Ticket className="w-4 h-4 text-primary" /> Absence Proofs
                </h3>
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    filteredTickets.length > 0
                      ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                      : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                  }`}
                >
                  {filteredTickets.length > 0 ? `${filteredTickets.length} Pending` : "All Clear"}
                </span>
              </div>

              {/* Search & Filter Strip */}
              {tickets.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-ink-faint absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search student or roll no..."
                      value={ticketSearch}
                      onChange={(e) => setTicketSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-background border border-line/50 text-xs focus:ring-1 focus:ring-primary outline-none"
                    />
                  </div>
                  {teacherSections.length > 0 && (
                    <select
                      value={filterSection}
                      onChange={(e) => setFilterSection(e.target.value)}
                      className="px-2.5 py-1.5 rounded-xl bg-background border border-line/50 text-xs text-ink outline-none"
                    >
                      <option value="">All Sec</option>
                      {teacherSections.map((s) => (
                        <option key={s} value={s}>
                          Sec {s}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {filteredTickets.length === 0 ? (
                <EmptyState
                  icon={<Ticket className="w-6 h-6 text-primary" />}
                  title="No absence proofs in review"
                  description="Student leave applications and medical documents will appear here."
                  className="py-8"
                />
              ) : (
                <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                  {filteredTickets.map((t, idx) => (
                    <div
                      key={t._id || t.id || idx}
                      className="p-3.5 rounded-xl bg-background border border-line/50 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-ink">
                            {t.student?.name || "Student"}
                          </span>
                          <span className="text-[10px] text-ink-soft">
                            ({t.student?.rollNo || "Roll N/A"} • Sec {t.student?.section || "A"})
                          </span>
                        </div>
                        <Badge tone="warning" size="sm">
                          Pending Review
                        </Badge>
                      </div>

                      <p className="text-[11px] text-ink-soft line-clamp-2">
                        <strong>Reason:</strong> {t.reasonDescription || "Medical / Leave reason"}
                      </p>

                      <div className="flex items-center justify-between pt-1 border-t border-line/40">
                        {t.proofDocuments && t.proofDocuments.length > 0 ? (
                          <button
                            onClick={() => handleFileClick(t._id || t.id, t.proofDocuments[0])}
                            className="text-primary font-bold hover:underline inline-flex items-center gap-1 text-[11px]"
                          >
                            <FileText className="w-3 h-3" />
                            View Attached Proof
                          </button>
                        ) : (
                          <span className="text-[10px] text-ink-faint">No file attached</span>
                        )}

                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleVerify(t._id || t.id, "rejected", "Proof not accepted")}
                            className="text-[10px] py-1 px-2.5 h-auto"
                          >
                            Reject
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleVerify(t._id || t.id, "approved", "Approved by faculty")}
                            className="text-[10px] py-1 px-2.5 h-auto"
                          >
                            Approve
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>

          {/* 2. Academic Calendar & Events Card */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
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

          {/* 3. Quick Links & Faculty Panels Card */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="rounded-2xl bg-surface border border-line/50 p-5 space-y-3 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary" /> Faculty Quick Links
                </h3>
                <span className="text-[11px] font-semibold text-ink-faint">
                  Tools & Duty Panels
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  {
                    title: "Face Attendance",
                    desc: "AI Facial Verification session",
                    icon: Camera,
                    path: "/face-attendance",
                  },
                  {
                    title: "Manual Roll Call",
                    desc: "Interactive attendance grid",
                    icon: ClipboardCheck,
                    path: "/attendance",
                  },
                  {
                    title: "Faculty Timetable",
                    desc: "View weekly schedule",
                    icon: Calendar,
                    path: "/timetable",
                  },
                  {
                    title: "Academic Calendar",
                    desc: `${holidays.length} upcoming events`,
                    icon: CalendarDays,
                    path: "/calendar",
                  },
                ].map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={idx}
                      onClick={() => navigate(item.path)}
                      className="p-3.5 rounded-xl bg-background border border-line/50 hover:border-primary/40 transition cursor-pointer space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-ink-faint" />
                      </div>
                      <h4 className="text-xs font-bold text-ink pt-1">{item.title}</h4>
                      <p className="text-[11px] text-ink-soft">{item.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Document Preview Modal */}
      <Modal
        isOpen={!!selectedFile}
        onClose={() => {
          setSelectedFile(null);
          setFileContent(null);
        }}
        title="Attached Absence Document"
        size="xl"
      >
        {fileContent?.type === "image" && (
          <div className="flex justify-center p-2 bg-background rounded-2xl border border-line">
            <img
              src={fileContent.content}
              alt="Proof"
              className="max-w-full max-h-[70vh] object-contain rounded-xl"
            />
          </div>
        )}
        {fileContent?.type === "pdf" && (
          <iframe
            src={fileContent.content}
            title="PDF Proof"
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
