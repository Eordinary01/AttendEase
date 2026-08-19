// src/components/TeacherDashboard.jsx
import React, { useEffect, useState, useCallback, Fragment, useMemo } from "react";
import api from "../../utils/api";
import { logError } from "../../utils/logger";
import { Tab } from "@headlessui/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  Filter,
  Check,
  X,
  File,
  Calendar,
  AlertTriangle,
  Users,
  AlertCircle,
  Search,
  Download,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  Image,
  Archive,
  RefreshCw,
  Send,
  Activity,
  Ticket,
  BookOpen,
  Trash2,
  Megaphone,
  ShieldCheck,
  UserCog,
  Layers,
  MapPin,
} from "lucide-react";
import { useTheme } from "../../contexts/ThemeContexts";
import PageHeader from "../common/ui/PageHeader";
import Card from "../common/ui/Card";
import StatCard from "../common/ui/StatCard";
import Badge from "../common/ui/Badge";
import Button from "../common/ui/Button";
import EmptyState from "../common/ui/EmptyState";
import Modal from "../common/ui/Modal";
import { Input, Select, Textarea } from "../common/ui/Input";

// ─── Helpers ────────────────────────────────────────────────────────────────

function hexToRgbStr(hex = "#6366f1") {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r} ${g} ${b}`;
}

const PRIORITIES = [
  { value: "normal", label: "Normal", tone: "neutral" },
  { value: "low",    label: "Low",    tone: "neutral" },
  { value: "high",   label: "High",   tone: "warning" },
  { value: "urgent", label: "Urgent", tone: "danger" },
];

const TICKET_STATUS_TONE = {
  verified: "success",
  rejected: "danger",
  "needs-more-info": "warning",
  pending: "info",
};

// ─── Custom-role duty labels ────────────────────────────────────────────────

const PERMISSION_DUTIES = [
  { key: "attendance:write", label: "Mark / manage attendance", group: "Attendance" },
  { key: "attendance:read", label: "View attendance records", group: "Attendance" },
  { key: "attendance:report", label: "Generate attendance reports", group: "Attendance" },
  { key: "subjects:write", label: "Create & manage subjects", group: "Subjects" },
  { key: "subjects:read", label: "View subjects", group: "Subjects" },
  { key: "timetable:write", label: "Edit class timetable", group: "Timetable" },
  { key: "timetable:read", label: "View timetable", group: "Timetable" },
  { key: "exam:create", label: "Create exams", group: "Exams" },
  { key: "exam:grade", label: "Grade exams", group: "Exams" },
  { key: "exam:read", label: "View exams", group: "Exams" },
  { key: "fee:collect", label: "Collect fees", group: "Fees" },
  { key: "fee:waive", label: "Waive fees", group: "Fees" },
  { key: "fee:read", label: "View fees", group: "Fees" },
  { key: "students:write", label: "Manage student profiles", group: "Students" },
  { key: "students:read", label: "View student records", group: "Students" },
  { key: "reports:view", label: "View attendance reports", group: "Reports" },
  { key: "reports:export", label: "Export reports (CSV)", group: "Reports" },
  { key: "alerts:create", label: "Broadcast announcements", group: "Communication" },
  { key: "tickets:verify", label: "Verify absence proofs", group: "Communication" },
];

const dutyFor = (p) =>
  PERMISSION_DUTIES.find((d) => d.key === p) || {
    key: p,
    label: p
      .split(":")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" "),
    group: "Other",
  };

// ─── Main Component ─────────────────────────────────────────────────────────

export default function TeacherDashboard() {
  const { colors } = useTheme();

  const primary = colors?.primary || "#7c3aed";
  const secondary = colors?.secondary || primary;

  const cssVars = {
    "--theme-primary": primary,
    "--theme-secondary": secondary,
    "--theme-primary-rgb": hexToRgbStr(primary),
  };

  const [tickets, setTickets] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [responseMessage, setResponseMessage] = useState("");
  const [isSuccessToast, setIsSuccessToast] = useState(true);
  const [filterSection, setFilterSection] = useState("");
  const [filterRollNo, setFilterRollNo] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  
  const [alertForm, setAlertForm] = useState({
    message: "",
    title: "",
    priority: "normal",
    type: "announcement",
    targetRole: "student",
    targetSections: [],
  });

  const [token, setToken] = useState(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [verificationStats, setVerificationStats] = useState(null);
  const [myRoles, setMyRoles] = useState([]);
  const [myAssignments, setMyAssignments] = useState([]);
  const [myDuties, setMyDuties] = useState([]);

  const POLLING_INTERVAL = 30000;
  const currentUserId = localStorage.getItem("userId");

  // ── auth ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    if (storedToken) setToken(storedToken);
  }, []);

  // ── data fetching ──────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      const uid = localStorage.getItem("userId");
      const [ticketsRes, statsRes, alertsRes, rolesRes, assignmentsRes, dutyRes] = await Promise.all([
        api.get(`/tickets/teacher/pending`),
        api.get(`/tickets/teacher/stats`),
        api.get(`/alerts`),
        api.get(`/roles/my-roles`),
        uid ? api.get(`/subjects/teacher/${uid}/assignments`) : Promise.resolve({ data: {} }),
        api.get("/exams/my-duty").catch(() => ({ data: { data: [] } })),
      ]);
      setTickets(Array.isArray(ticketsRes.data?.tickets) ? ticketsRes.data.tickets : []);
      setVerificationStats(statsRes.data?.stats ?? null);
      setAlerts(Array.isArray(alertsRes.data?.data) ? alertsRes.data.data : []);
      setMyRoles(Array.isArray(rolesRes.data?.data?.roles) ? rolesRes.data.data.roles : []);
      setMyAssignments(Array.isArray(assignmentsRes.data?.subjects) ? assignmentsRes.data.subjects : []);
      setMyDuties(Array.isArray(dutyRes.data?.data) ? dutyRes.data.data : []);
    } catch (error) {
      if (error.response?.status === 401) localStorage.removeItem("token");
      logError("Fetch Teacher Data", error);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetchData();
    const id = setInterval(fetchData, POLLING_INTERVAL);
    return () => clearInterval(id);
  }, [token, fetchData]);

  // ── actions ────────────────────────────────────────────────────────────────

  const showToast = (msg, success = true) => {
    setResponseMessage(msg);
    setIsSuccessToast(success);
    setTimeout(() => setResponseMessage(""), 5000);
  };

  const handleVerify = async (ticketId, verificationStatus, verificationRemarks = "") => {
    try {
      const res = await api.put(
        `/tickets/${ticketId}/verify`,
        { verificationStatus, verificationRemarks }
      );
      showToast(res.data.message);
      setTickets((prev) =>
        prev.map((t) =>
          (t.id || t._id) === ticketId
            ? {
                ...t,
                verificationStatus,
                status:
                  verificationStatus === "verified"
                    ? "verified"
                    : verificationStatus === "rejected"
                    ? "rejected"
                    : "under-review",
              }
            : t
        )
      );
      fetchData(); // refresh stats
    } catch (err) {
      showToast(err.response?.data?.message || "Error verifying ticket", false);
    }
  };

  const handleMarkAttendance = async (ticketId) => {
    try {
      const res = await api.post(
        `/tickets/${ticketId}/mark-attendance`,
        {}
      );
      showToast(res.data.message);
      setTickets((prev) =>
        prev.map((t) =>
          (t.id || t._id) === ticketId ? { ...t, attendanceMarked: true, status: "attendance-updated" } : t
        )
      );
      fetchData(); // refresh stats
    } catch (err) {
      showToast(err.response?.data?.message || "Error marking attendance", false);
    }
  };

  const handleCreateAlert = async (e) => {
    e.preventDefault();
    if (!alertForm.message.trim()) return;
    if (alertForm.targetSections.length === 0) {
      showToast("Select at least one section to send the announcement to", false);
      return;
    }
    try {
      setIsLoading(true);
      const res = await api.post(
        `/alerts`,
        {
          message: alertForm.message,
          title: alertForm.title || "Class Announcement",
          priority: alertForm.priority,
          type: alertForm.type,
          targetRoles: ["student"],
          targetSections: alertForm.targetSections,
        }
      );
      showToast(res.data.message);
      setAlertForm({ message: "", title: "", priority: "normal", type: "announcement", targetRole: "student", targetSections: [] });
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || "Error creating alert", false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAlert = async (alertId) => {
    if (!window.confirm("Are you sure you want to delete this alert?")) return;
    try {
      setIsLoading(true);
      const res = await api.delete(`/alerts/${alertId}`);
      showToast(res.data.message || "Alert deleted successfully");
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to delete alert", false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileClick = async (ticketId, file) => {
    try {
      setIsLoading(true);
      const fileId = file.id || file._id;
      const res = await api.get(`/tickets/${ticketId}/files/${fileId}`, {
        responseType: "blob",
      });
      const fileType = res.headers["content-type"];
      const url = URL.createObjectURL(res.data);
      if (fileType.startsWith("image/")) {
        setFileContent({ type: "image", content: url });
      } else if (fileType === "application/pdf") {
        setFileContent({ type: "pdf", content: url });
      } else {
        setFileContent({ type: "download", content: url, fileName: file.originalName || file.filename });
      }
      setSelectedFile({ ticketId, file });
    } catch {
      setFileContent({ type: "error", content: "Error loading file preview" });
    } finally {
      setIsLoading(false);
    }
  };

  // ── derived data ──────────────────────────────────────────────────────────

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        ticket.reasonDescription?.toLowerCase().includes(q) ||
        ticket.student?.rollNo?.toLowerCase().includes(q) ||
        ticket.student?.name?.toLowerCase().includes(q);
      return (
        matchesSearch &&
        (filterSection ? ticket.student?.section === filterSection : true) &&
        (filterRollNo ? ticket.student?.rollNo?.includes(filterRollNo) : true) &&
        (filterStatus ? ticket.verificationStatus === filterStatus : true)
      );
    });
  }, [tickets, searchQuery, filterSection, filterRollNo, filterStatus]);

  const stats = verificationStats || {
    totalTickets: 0,
    pendingTickets: 0,
    verifiedTickets: 0,
    rejectedTickets: 0,
    needsMoreInfoTickets: 0,
    attendanceMarkedCount: 0,
  };

  const sectionsList = useMemo(() => {
    return [...new Set(tickets.map((t) => t.student?.section).filter(Boolean))];
  }, [tickets]);

  const teacherSections = useMemo(() => {
    return [...new Set(myAssignments.map((a) => a.section).filter(Boolean))].sort();
  }, [myAssignments]);

  const toggleAlertSection = (sec) => {
    setAlertForm(f => ({
      ...f,
      targetSections: f.targetSections.includes(sec)
        ? f.targetSections.filter(s => s !== sec)
        : [...f.targetSections, sec],
    }));
  };

  const roleDuties = useMemo(() => {
    const duties = myRoles.flatMap((r) => r.permissions || []).map(dutyFor);
    const unique = [...new Map(duties.map((d) => [d.key, d])).values()];
    return unique.reduce((acc, d) => {
      (acc[d.group] = acc[d.group] || []).push(d);
      return acc;
    }, {});
  }, [myRoles]);

  const roleDutyCount = useMemo(() => Object.values(roleDuties).flat().length, [roleDuties]);

  return (
    <div className="space-y-6" style={cssVars}>
      <PageHeader
        icon={BookOpen}
        title="Teacher Dashboard"
        subtitle="Verify student absence proof documentation and broadcast important class announcements."
        actions={
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={fetchData} loading={isLoading} leftIcon={RefreshCw}>
              Refresh
            </Button>
            <Badge tone="success" dot>Live Monitoring</Badge>
          </div>
        }
      />

      {/* Custom Role & Duties */}
      {myRoles.length > 0 && (
        <Card padding="lg" className="relative overflow-hidden">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Role identity */}
            <div className="lg:w-72 shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-ink-faint">Your Role</span>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-sm"
                  style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
                >
                  <UserCog className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-ink leading-tight">
                    {myRoles.map((r) => r.name).join(" + ")}
                  </h3>
                  <Badge tone="info" dot>Custom role</Badge>
                </div>
              </div>
              {myRoles[0]?.description && (
                <p className="mt-3 text-sm text-ink-soft leading-relaxed">{myRoles[0].description}</p>
              )}
              <div className="mt-4 flex items-center gap-2 text-xs text-ink-faint font-semibold">
                <Layers className="w-4 h-4" />
                {roleDutyCount} duties assigned
              </div>
            </div>

            {/* Duties */}
            <div className="flex-1 border-t lg:border-t-0 lg:border-l border-line lg:pl-6 pt-4 lg:pt-0">
              <p className="text-xs font-bold uppercase tracking-wider text-ink-faint mb-3">
                Duties &amp; Responsibilities
              </p>
              {roleDutyCount === 0 ? (
                <p className="text-sm text-ink-faint">No specific duties assigned yet.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-4">
                  {Object.entries(roleDuties).map(([group, list]) => (
                    <div key={group}>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-1.5">{group}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {list.map((d) => (
                          <span
                            key={d.key}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary-soft text-primary-dark text-xs font-semibold"
                          >
                            <Check className="w-3 h-3" /> {d.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Assigned classes */}
          <div className="mt-6 pt-5 border-t border-line">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-faint mb-3 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-primary" /> Assigned Classes
            </p>
            {myAssignments.length === 0 ? (
              <p className="text-sm text-ink-faint">No subjects assigned yet. Contact your administrator.</p>
            ) : (
              <div className="flex flex-wrap gap-2.5">
                {myAssignments.map((a) => (
                  <div
                    key={a.assignmentId || a.subject?.id || `${a.section}-${a.subject?.subjectCode}`}
                    className="px-3.5 py-2.5 rounded-xl bg-background border border-line min-w-[180px]"
                  >
                    <p className="text-sm font-bold text-ink flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-primary" />
                      {a.subject?.subjectName || "Unknown Subject"}
                    </p>
                    <p className="text-xs text-ink-faint mt-1">
                      Section {a.section} · Sem {a.subject?.semester || "—"} · {a.stats?.totalStudents ?? 0} students
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard label="Total Proofs" value={stats.totalTickets} tone="primary" icon={Ticket} />
        <StatCard label="Needs More Info" value={stats.needsMoreInfoTickets} tone="warning" icon={AlertCircle} />
        <StatCard label="Attendance Synced" value={stats.attendanceMarkedCount} tone="success" icon={CheckCircle} />
      </div>

      {/* Exam Duties */}
      {myDuties.length > 0 && (
        <Card padding="md">
          <h3 className="text-sm font-bold text-ink mb-3 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Exam Duties ({myDuties.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {myDuties.map((exam) => (
              <div key={exam._id} className="p-3 rounded-xl bg-primary-soft/50 border border-primary/10">
                <p className="text-xs font-bold text-primary-dark truncate">{exam.title}</p>
                <p className="text-xs text-ink-soft mt-0.5">{exam.subjectId?.subjectName || "—"}</p>
                <div className="flex flex-wrap gap-2 mt-1 text-[10px] text-ink-faint">
                  <span className="flex items-center gap-0.5"><Calendar className="w-3 h-3" />{new Date(exam.date).toLocaleDateString()}</span>
                  <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{exam.startTime} - {exam.endTime}</span>
                  <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{exam.room || "—"}</span>
                </div>
                <p className="text-[10px] text-ink-faint mt-1">Shift {exam.shift} · Sec {exam.section}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Verification Breakdown */}
      <Card padding="md">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="warning">{stats.pendingTickets} Pending</Badge>
          <Badge tone="success">{stats.verifiedTickets} Verified</Badge>
          <Badge tone="danger">{stats.rejectedTickets} Rejected</Badge>
        </div>
        <div className="mt-4">
          <div className="w-full bg-line rounded-full h-1.5 mb-1.5">
            <div
              className="h-1.5 rounded-full bg-primary transition-all duration-300"
              style={{ width: `${stats.verifiedTickets > 0 ? (stats.attendanceMarkedCount / stats.verifiedTickets) * 100 : 0}%` }}
            />
          </div>
          <p className="text-xs text-ink-soft">
            {stats.verifiedTickets > 0 ? Math.round((stats.attendanceMarkedCount / stats.verifiedTickets) * 100) : 0}% of verified proofs updated in roll lists.
          </p>
        </div>
      </Card>

      {/* Tab Controls */}
      <Tab.Group>
        <Tab.List className="flex space-x-2 bg-surface p-1.5 rounded-2xl border border-line shadow-sm w-full md:w-80">
          {["Absence Proofs", "Alerts Manager"].map((tabName) => (
            <Tab key={tabName} as={Fragment}>
              {({ selected }) => (
                <button
                  className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition outline-none ${
                    selected ? "text-white shadow-sm" : "text-ink-soft hover:bg-background"
                  }`}
                  style={selected ? { background: `linear-gradient(135deg, ${primary}, ${secondary})` } : {}}
                >
                  {tabName}
                </button>
              )}
            </Tab>
          ))}
        </Tab.List>

        <Tab.Panels className="mt-4">
          {/* Panel 1: Absence Proofs List */}
          <Tab.Panel className="space-y-4">
            {/* Filter controls */}
            <Card padding="md">
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                {/* Search */}
                <div className="relative w-full md:w-80">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by student, roll number, reason..."
                    className="w-full pl-10 pr-4 py-2 border border-line rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none transition bg-surface text-ink placeholder:text-ink-faint"
                  />
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint">
                    <Search className="w-4 h-4" />
                  </div>
                </div>

                {/* Select filters */}
                <div className="flex flex-wrap gap-3 items-center w-full md:w-auto">
                  <select
                    value={filterSection}
                    onChange={(e) => setFilterSection(e.target.value)}
                    className="px-3 py-1.5 border border-line rounded-xl text-sm text-ink-soft bg-surface hover:bg-background transition outline-none"
                  >
                    <option value="">All Sections</option>
                    {sectionsList.map(s => <option key={s} value={s}>Section {s}</option>)}
                  </select>

                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-3 py-1.5 border border-line rounded-xl text-sm text-ink-soft bg-surface hover:bg-background transition outline-none"
                  >
                    <option value="">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="verified">Verified</option>
                    <option value="rejected">Rejected</option>
                    <option value="needs-more-info">Needs More Info</option>
                  </select>

                  {(filterSection || filterStatus || searchQuery) && (
                    <button
                      onClick={() => { setFilterSection(""); setFilterStatus(""); setSearchQuery(""); }}
                      className="text-xs text-ink-faint hover:text-red-500 font-bold transition flex items-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" /> Clear Filters
                    </button>
                  )}
                </div>
              </div>
            </Card>

            {/* Tickets List */}
            <div className="space-y-4">
              {filteredTickets.length === 0 ? (
                <EmptyState
                  icon={Ticket}
                  title="No absence proofs found"
                  description="No student absence proof requests match your filters."
                />
              ) : (
                filteredTickets.map((ticket, index) => (
                  <motion.div
                    key={ticket.id || ticket._id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card padding="lg" className="hover:shadow-cardhover">
                      <div className="flex flex-col lg:flex-row justify-between items-start gap-4">
                        <div className="flex-1 space-y-3">
                          {/* Top row */}
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <Badge tone={TICKET_STATUS_TONE[ticket.verificationStatus] || "neutral"}>
                              {ticket.verificationStatus}
                            </Badge>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-background text-ink-soft capitalize">
                              Reason: {ticket.reason || "Not specified"}
                            </span>
                          </div>

                          {/* Student Info */}
                          <div>
                            <h3 className="text-lg font-bold text-ink">{ticket.student?.name || "Unknown Student"}</h3>
                            <div className="flex flex-wrap items-center gap-4 text-xs text-ink-soft mt-1">
                              <span>Roll Number: <strong className="text-ink">{ticket.student?.rollNo || "N/A"}</strong></span>
                              <span>Section: <strong className="text-ink">{ticket.student?.section || "N/A"}</strong></span>
                              <span>Email: <strong className="text-ink">{ticket.student?.email || "N/A"}</strong></span>
                              <span>Absent Date: <strong className="text-ink">{new Date(ticket.absentDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</strong></span>
                            </div>
                          </div>

                          {/* Description box */}
                          <div className="p-3 bg-background rounded-xl text-sm text-ink-soft leading-relaxed border border-line whitespace-pre-wrap">
                            {ticket.reasonDescription || "No detailed description provided."}
                          </div>

                          {/* Documents Preview list */}
                          {ticket.documentsCount > 0 && (
                            <div className="space-y-2">
                              <p className="text-xs font-bold text-ink-faint uppercase tracking-wider">Attachments ({ticket.documentsCount})</p>
                              <div className="flex flex-wrap gap-2">
                                {ticket.documents?.map((doc, idx) => (
                                  <button
                                    key={doc.id || idx}
                                    onClick={() => handleFileClick(ticket.id || ticket._id, doc)}
                                    className="inline-flex items-center gap-2 px-3 py-1.5 border border-line bg-background rounded-xl hover:bg-line/60 transition text-xs font-semibold text-ink-soft"
                                  >
                                    <FileIcon file={doc} />
                                    <span className="max-w-[150px] truncate">{doc.originalName || `Proof Document ${idx + 1}`}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Actions block */}
                        <div className="flex flex-wrap lg:flex-col items-stretch gap-2.5 w-full lg:w-44 border-t lg:border-t-0 lg:border-l border-line pt-4 lg:pt-0 lg:pl-4 self-stretch justify-center">
                          {ticket.verificationStatus === "pending" || ticket.verificationStatus === "needs-more-info" ? (
                            <>
                              <Button
                                variant="primary"
                                size="sm"
                                className="flex-1"
                                leftIcon={Check}
                                onClick={() => handleVerify(ticket.id || ticket._id, "verified")}
                              >
                                Approve Proof
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                className="flex-1"
                                leftIcon={X}
                                onClick={() => handleVerify(ticket.id || ticket._id, "rejected")}
                              >
                                Reject Proof
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                leftIcon={AlertCircle}
                                onClick={() => {
                                  const rem = window.prompt("Enter remarks / instructions for student:");
                                  if (rem !== null) handleVerify(ticket.id || ticket._id, "needs-more-info", rem);
                                }}
                              >
                                Ask More Info
                              </Button>
                            </>
                          ) : ticket.verificationStatus === "verified" && !ticket.attendanceMarked ? (
                            <Button
                              variant="primary"
                              size="sm"
                              className="w-full"
                              leftIcon={CheckCircle}
                              style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
                              onClick={() => handleMarkAttendance(ticket.id || ticket._id)}
                            >
                              Mark Present
                            </Button>
                          ) : (
                            <div className="w-full flex justify-center">
                              <Badge tone={ticket.attendanceMarked ? "success" : "neutral"}>
                                {ticket.attendanceMarked ? "Attendance Updated" : "Processed"}
                              </Badge>
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))
              )}
            </div>
          </Tab.Panel>

          {/* Panel 2: Alerts Broadcast Hub */}
          <Tab.Panel className="grid lg:grid-cols-5 gap-6 items-start">
            {/* Alert Creation Form */}
            <Card className="lg:col-span-2 space-y-4">
              <div>
                <h3 className="text-lg font-bold text-ink flex items-center gap-1.5">
                  <Megaphone className="w-5 h-5 text-primary" />
                  Create Announcement
                </h3>
                <p className="text-xs text-ink-faint mt-0.5">Send a real-time notification to your classes.</p>
              </div>

              <form onSubmit={handleCreateAlert} className="space-y-3.5">
                <Input
                  label="Subject / Title"
                  value={alertForm.title}
                  onChange={e => setAlertForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Extra Class Announcement"
                  required
                />

                <div className="grid grid-cols-2 gap-3">
                  <Select
                    label="Type"
                    value={alertForm.type}
                    onChange={e => setAlertForm(f => ({ ...f, type: e.target.value }))}
                  >
                    <option value="announcement">Announcement (7 days)</option>
                    <option value="short_term">Short-term Alert (6 hours)</option>
                  </Select>
                  <Select
                    label="Priority"
                    value={alertForm.priority}
                    onChange={e => setAlertForm(f => ({ ...f, priority: e.target.value }))}
                  >
                    <option value="normal">Normal</option>
                    <option value="low">Low</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Select
                    label="Target Audience"
                    value={alertForm.targetRole}
                    onChange={e => setAlertForm(f => ({ ...f, targetRole: e.target.value }))}
                    disabled
                  >
                    <option value="student">Students Only</option>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Send to sections</label>
                  {teacherSections.length === 0 ? (
                    <p className="text-xs text-red-500">No sections assigned. Contact admin to assign subjects.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {teacherSections.map((sec) => (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => toggleAlertSection(sec)}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                            alertForm.targetSections.includes(sec)
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-line text-ink-soft hover:bg-surface"
                          }`}
                        >
                          {alertForm.targetSections.includes(sec) ? "✓ " : ""}Section {sec}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <Textarea
                  label="Message Content"
                  rows={4}
                  value={alertForm.message}
                  onChange={e => setAlertForm(f => ({ ...f, message: e.target.value }))}
                  placeholder="Type details of your announcement..."
                  required
                  maxLength={1000}
                />

                <Button
                  type="submit"
                  disabled={isLoading || !alertForm.message.trim()}
                  className="w-full"
                  loading={isLoading}
                  leftIcon={Send}
                  style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
                >
                  Send Announcement
                </Button>
              </form>
            </Card>

            {/* Alert Logs Timeline */}
            <Card className="lg:col-span-3 space-y-4">
              <div>
                <h3 className="text-lg font-bold text-ink">Announcement Log</h3>
                <p className="text-xs text-ink-faint mt-0.5">Logs of active alerts posted within your institution.</p>
              </div>

              <div className="space-y-3.5 max-h-[500px] overflow-y-auto pr-1">
                {alerts.length === 0 ? (
                  <div className="text-center py-12 text-ink-faint text-sm">
                    No active announcements.
                  </div>
                ) : (
                  alerts.map((alert) => {
                    const priorityStyle = PRIORITIES.find(p => p.value === alert.priority) || PRIORITIES[0];
                    const isOwner = alert.createdBy?.id === currentUserId || alert.createdBy === currentUserId;

                    return (
                      <div key={alert.id || alert._id} className="p-4 bg-background rounded-xl border border-line flex items-start justify-between gap-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-ink text-sm">{alert.title}</h4>
                            <Badge tone={alert.type === "short_term" ? "warning" : "info"} className="capitalize">
                              {alert.type === "short_term" ? "Short-term" : "Announcement"}
                            </Badge>
                            <Badge tone={priorityStyle.tone}>{priorityStyle.label}</Badge>
                          </div>
                          <p className="text-xs text-ink-soft leading-relaxed">{alert.message}</p>
                          <div className="text-[10px] text-ink-faint font-medium">
                            Posted: {new Date(alert.createdAt).toLocaleString()} · By {alert.createdBy?.name || "System"} ({alert.createdBy?.role || "Admin"})
                          </div>
                        </div>
                        {isOwner && (
                          <button
                            onClick={() => handleDeleteAlert(alert.id || alert._id)}
                            className="p-1 hover:bg-red-50 text-ink-faint hover:text-red-500 rounded transition flex-shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          </Tab.Panel>
        </Tab.Panels>
      </Tab.Group>

      {/* Toast Notification */}
      <AnimatePresence>
        {responseMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className={`fixed bottom-6 right-6 px-5 py-3 rounded-xl shadow-pop border-l-4 max-w-sm z-50 flex items-center gap-3 bg-surface ${
              isSuccessToast ? "border-emerald-500 text-emerald-700" : "border-red-500 text-red-700"
            }`}
          >
            {isSuccessToast ? <CheckCircle className="w-5 h-5 text-emerald-500" /> : <AlertTriangle className="w-5 h-5 text-red-500" />}
            <p className="text-xs font-semibold">{responseMessage}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Document Preview Modal */}
      <Modal
        isOpen={!!selectedFile}
        onClose={() => { setSelectedFile(null); setFileContent(null); }}
        title={selectedFile?.file?.originalName || selectedFile?.file?.filename || "Verification Proof Document"}
        size="xl"
      >
        <FilePreview fileContent={fileContent} primary={primary} />
      </Modal>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function FileIcon({ file }) {
  const name = file?.originalName || file?.filename || "";
  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf": return <FileText className="w-4 h-4 text-red-500" />;
    case "jpg": case "jpeg": case "png": case "gif": return <Image className="w-4 h-4 text-sky-500" />;
    case "zip": case "rar": return <Archive className="w-4 h-4 text-amber-500" />;
    default: return <File className="w-4 h-4 text-ink-faint" />;
  }
}

function FilePreview({ fileContent, primary }) {
  if (!fileContent) return null;
  switch (fileContent.type) {
    case "image":
      return (
        <div className="flex justify-center p-2 bg-background rounded-2xl border border-line">
          <img src={fileContent.content} alt="Verification upload" className="max-w-full max-h-[60vh] object-contain rounded-xl shadow-inner" />
        </div>
      );
    case "pdf":
      return <iframe src={fileContent.content} title="Verification Document PDF Viewer" className="w-full h-[60vh] rounded-2xl border border-line" />;
    case "download":
      return (
        <div className="text-center p-8">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-background border border-line">
            <Download className="w-8 h-8 text-ink-soft" />
          </div>
          <p className="text-ink-soft mb-4 font-semibold text-sm">Preview not supported in browser for this file type.</p>
          <a
            href={fileContent.content}
            download={fileContent.fileName}
            className="inline-flex items-center px-6 py-2.5 text-white text-sm font-bold rounded-xl shadow-sm hover:opacity-90 transition"
            style={{ backgroundColor: primary }}
          >
            <Download className="w-4 h-4 mr-2" />
            Download File
          </a>
        </div>
      );
    case "error":
      return (
        <div className="text-center p-8">
          <div className="w-16 h-16 bg-red-50 border border-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <p className="text-red-500 text-sm font-semibold">{fileContent.content}</p>
        </div>
      );
    default:
      return <p className="text-center text-ink-faint p-8 text-sm">Unsupported file format</p>;
  }
}
