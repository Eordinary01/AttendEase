// src/components/StudentDashboard.jsx
import React, { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Ticket,
  GraduationCap,
  Bell,
  User,
  TrendingUp,
  BookOpen,
  Award,
  AlertCircle,
  CheckCircle,
  XCircle,
  ChevronRight,
  Download,
  Eye,
  ClipboardCheck,
} from "lucide-react";
import AttendanceHistory from "../AttendanceHistory";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Tab } from "@headlessui/react";
import { Fragment } from "react";
import api from "../../utils/api";
import { useTheme } from "../../contexts/ThemeContexts";
import Button from "../common/ui/Button";
import Card from "../common/ui/Card";
import Modal from "../common/ui/Modal";
import Badge from "../common/ui/Badge";
import Table from "../common/ui/Table";
import EmptyState from "../common/ui/EmptyState";
import StatCard from "../common/ui/StatCard";

// ─── helpers ────────────────────────────────────────────────────────────────

/** Hex → "R G B" string, used to build rgba() values from a CSS variable. */
function hexToRgbStr(hex = "#6366f1") {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r} ${g} ${b}`;
}



export default function StudentDashboard({ userId, userName, userEmail }) {
  const { colors } = useTheme();

  const primary = colors?.primary || "#6366f1";
  const secondary = colors?.secondary || primary;

  const cssVars = {
    "--theme-primary": primary,
    "--theme-secondary": secondary,
    "--theme-primary-rgb": hexToRgbStr(primary),
  };

  const [tickets, setTickets] = useState([]);
  const [attendanceData, setAttendanceData] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState(null);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [activeTab, setActiveTab] = useState(0);

  const API_URL = process.env.REACT_APP_API_URL;
  const token = localStorage.getItem("token");

  // ── data fetching ──────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!token) {
      setError("No authentication token found");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [ticketsRes, attendanceRes, announcementsRes] = await Promise.allSettled([
        api.get('/tickets/student'),
        api.get('/attendance/records'),
        api.get('/alerts'),
      ]);

      if (ticketsRes.status === "fulfilled") {
        const tData = ticketsRes.value.data;
        setTickets(Array.isArray(tData) ? tData : (tData?.data || []));
      } else {
        setTickets([]);
      }

      if (attendanceRes.status === "fulfilled") {
        setAttendanceData(attendanceRes.value.data);
        setError(null);
      } else {
        const msg = attendanceRes.reason?.response?.data?.message || "Failed to load attendance records";
        setError(msg);
      }

      if (announcementsRes.status === "fulfilled") {
        const aData = announcementsRes.value.data;
        const list = Array.isArray(aData) ? aData : (aData?.data || aData?.alerts || []);
        setAnnouncements(Array.isArray(list) ? list : []);
      } else {
        setAnnouncements([]);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [token, API_URL]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── file preview ───────────────────────────────────────────────────────────

  const handleFilePreview = async (ticketId, fileName) => {
    try {
      const response = await fetch(`${API_URL}/tickets/${ticketId}/file`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch file");
      const blob = await response.blob();
      const fileType = response.headers.get("content-type");
      const url = URL.createObjectURL(blob);
      if (fileType.startsWith("image/")) {
        setFileContent({ type: "image", content: url });
      } else if (fileType === "application/pdf") {
        setFileContent({ type: "pdf", content: url });
      } else {
        setFileContent({ type: "download", content: url, fileName });
      }
      setSelectedFile({ ticketId, fileName });
    } catch {
      setFileContent({ type: "error", content: "Error loading file" });
    }
  };

  // ── derived data ───────────────────────────────────────────────────────────

  const stats = attendanceData?.stats || {
    totalClasses: 0,
    presentCount: 0,
    absentCount: 0,
    leaveCount: 0,
    attendancePercentage: "0",
    bySubject: [],
  };

  const studentInfo = attendanceData?.student || {
    name: userName,
    rollNo: "N/A",
    section: "N/A",
    courseName: "",
    branch: "",
    semester: null,
    admissionYear: null,
  };

  const pieData = [
    { name: "Present", value: stats.presentCount, color: "#10b981" },
    { name: "Absent", value: stats.absentCount, color: "#ef4444" },
    { name: "Leave", value: stats.leaveCount, color: "#f59e0b" },
  ].filter((item) => item.value > 0);

  // ── loading / error states ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div
            className="w-16 h-16 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4"
            style={{ borderColor: `${primary}40`, borderTopColor: primary }}
          />
          <p className="text-ink-soft">Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <Card padding="xl" className="max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-ink mb-2">Error</h2>
          <p className="text-ink-soft mb-6">{error}</p>
          <Button onClick={fetchData} variant="primary">Try Again</Button>
        </Card>
      </div>
    );
  }

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    // cssVars injected here — all descendants read var(--theme-primary) freely
    <div className="space-y-6" style={cssVars}>
      {/* Welcome Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-6 text-white"
        style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">
              Welcome back, {studentInfo.name || userName}!
            </h1>
            <p className="text-white/80">Track your academic progress here</p>
          </div>
          <div className="mt-4 md:mt-0 flex flex-wrap gap-2 md:gap-3 text-xs md:text-sm">
            {studentInfo.rollNo && studentInfo.rollNo !== "N/A" && (
              <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-lg">
                <User className="w-4 h-4 text-white/90" />
                <span className="font-medium">{studentInfo.rollNo}</span>
              </div>
            )}
            {studentInfo.courseName && (
              <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-lg">
                <BookOpen className="w-4 h-4 text-white/90" />
                <span className="font-medium">{studentInfo.courseName}</span>
              </div>
            )}
            {studentInfo.branch && (
              <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-lg">
                <Award className="w-4 h-4 text-white/90" />
                <span className="font-medium">{studentInfo.branch}</span>
              </div>
            )}
            {studentInfo.semester && (
              <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-lg">
                <GraduationCap className="w-4 h-4 text-white/90" />
                <span className="font-medium">Sem {studentInfo.semester}</span>
              </div>
            )}
            {studentInfo.section && studentInfo.section !== "N/A" && (
              <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-lg">
                <GraduationCap className="w-4 h-4 text-white/90" />
                <span className="font-medium">Sec {studentInfo.section}</span>
              </div>
            )}
            {studentInfo.admissionYear && (
              <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-lg">
                <span className="font-medium">Batch {studentInfo.admissionYear}</span>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Stat Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        <StatCard label="Total Classes" value={stats.totalClasses} icon={BookOpen} tone="primary" />
        <StatCard label="Classes Attended" value={stats.presentCount} icon={CheckCircle} tone="success" />
        <StatCard label="Classes Missed" value={stats.absentCount + stats.leaveCount} icon={XCircle} tone="danger" />
        <StatCard label="Attendance" value={`${stats.attendancePercentage}%`} icon={TrendingUp} tone="warning" />
      </motion.div>

      {/* Announcements */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-6 h-6 theme-text" />
          <h2 className="text-xl font-semibold text-ink">Announcements</h2>
          <span className="theme-bg text-white text-xs px-2 py-1 rounded-full">
            {announcements.length}
          </span>
        </div>

        {announcements.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No announcements at the moment"
            description="Check back later for updates."
          />
        ) : (
          <div className="grid gap-4">
            {announcements.map((announcement, idx) => (
              <motion.div
                key={announcement._id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card
                  padding="md"
                  hoverable
                  className="theme-border-l"
                  onClick={() => setSelectedAnnouncement(announcement)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <AlertCircle className="w-5 h-5 theme-text" />
                        <span className="text-xs text-ink-faint">
                          {new Date(announcement.createdAt).toLocaleDateString("en-US", {
                            year: "numeric", month: "long", day: "numeric",
                          })}
                        </span>
                        {announcement.createdBy?.name && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                            By {announcement.createdBy.name} ({announcement.createdBy.role === "teacher" ? "Teacher" : "Admin"})
                          </span>
                        )}
                      </div>
                      {announcement.title && <h4 className="font-semibold text-ink mb-1">{announcement.title}</h4>}
                      <p className="text-ink line-clamp-2">{announcement.message}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-ink-faint flex-shrink-0 ml-4" />
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Tab.Group selectedIndex={activeTab} onChange={setActiveTab}>
          <Tab.List className="flex space-x-2 bg-surface rounded-xl p-1 shadow-card border border-line mb-6">
            {[
              { label: "Subject-wise Attendance", icon: <Award className="w-5 h-5" /> },
              { label: "Attendance Log", icon: <ClipboardCheck className="w-5 h-5" /> },
              { label: "Analytics", icon: <TrendingUp className="w-5 h-5" /> },
              { label: `My Tickets (${tickets.length})`, icon: <Ticket className="w-5 h-5" /> },
            ].map(({ label, icon }, i) => (
              <Tab key={label} as={Fragment}>
                {({ selected }) => (
                  <button
                    className={`flex-1 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                      selected
                        ? "text-white shadow-md"
                        : "text-ink-soft hover:bg-background"
                    }`}
                    style={selected ? { backgroundColor: primary } : {}}
                  >
                    {icon}
                    <span>{label}</span>
                  </button>
                )}
              </Tab>
            ))}
          </Tab.List>

          <Tab.Panels>
            {/* ── Tab 1: Subject-wise Attendance ── */}
            <Tab.Panel>
              <Card>
                {stats.bySubject.length === 0 ? (
                  <EmptyState
                    icon={BookOpen}
                    title="No attendance records found"
                    description="Your attendance by subject will appear here once recorded."
                  />
                ) : (
                  <Table
                    columns={[
                      { header: "Subject", accessor: "subjectName" },
                      { header: "Subject Code", accessor: "subjectCode" },
                      { header: "Attended / Total", cell: (row) => `${row.present} / ${row.total}` },
                      {
                        header: "Attendance %",
                        cell: (row) => {
                          const pct = parseFloat(row.attendancePercentage);
                          const barColor = pct >= 75 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : "bg-red-500";
                          const textColor = pct >= 75 ? "text-emerald-600" : pct >= 60 ? "text-amber-600" : "text-red-600";
                          return (
                            <div className="flex items-center gap-3 min-w-[150px]">
                              <div className="flex-1 bg-line rounded-full h-2">
                                <div className={`h-2 rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                              </div>
                              <span className={`text-sm font-medium ${textColor}`}>
                                {row.attendancePercentage}%
                              </span>
                            </div>
                          );
                        },
                      },
                    ]}
                    data={stats.bySubject}
                    rowKey="subjectCode"
                  />
                )}
              </Card>
            </Tab.Panel>

            {/* ── Tab 2: Full Attendance History Log ── */}
            <Tab.Panel>
              <AttendanceHistory role="student" />
            </Tab.Panel>

            {/* ── Tab 2: Analytics ── */}
            <Tab.Panel>
              <Card>
                {stats.bySubject.length === 0 ? (
                  <EmptyState
                    icon={TrendingUp}
                    title="No data available for analytics"
                    description="Charts will appear here once attendance is recorded."
                  />
                ) : (
                  <div className="grid lg:grid-cols-2 gap-8">
                    <div>
                      <h3 className="text-lg font-semibold text-ink mb-4">Subject-wise Attendance</h3>
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={stats.bySubject.map((s) => ({
                              name: s.subjectCode,
                              attendance: parseFloat(s.attendancePercentage),
                            }))}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis domain={[0, 100]} />
                            <Tooltip formatter={(v) => [`${v}%`, "Attendance"]} />
                            <Legend />
                            <Line type="monotone" dataKey="attendance" stroke={primary} strokeWidth={2} name="Attendance %" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {pieData.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-ink mb-4">Attendance Distribution</h3>
                        <div className="h-80">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={pieData}
                                cx="50%" cy="50%"
                                innerRadius={60} outerRadius={100}
                                paddingAngle={5} dataKey="value"
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                              >
                                {pieData.map((entry, i) => (
                                  <Cell key={i} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </Tab.Panel>

            {/* ── Tab 3: Tickets ── */}
            <Tab.Panel>
              <Card>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold text-ink">My Tickets</h2>
                  <Button
                    onClick={() => (window.location.href = "/tickets")}
                    variant="primary"
                    size="sm"
                  >
                    + New Ticket
                  </Button>
                </div>

                {tickets.length === 0 ? (
                  <EmptyState
                    icon={Ticket}
                    title="No tickets submitted yet"
                    description="Create a support ticket whenever you need help."
                  />
                ) : (
                  <div className="space-y-4">
                    {tickets.map((ticket) => (
                      <TicketCard
                        key={ticket._id}
                        ticket={ticket}
                        primary={primary}
                        onPreview={handleFilePreview}
                      />
                    ))}
                  </div>
                )}
              </Card>
            </Tab.Panel>
          </Tab.Panels>
        </Tab.Group>
      </motion.div>

      {/* Announcement Modal */}
      <Modal
        isOpen={!!selectedAnnouncement}
        onClose={() => setSelectedAnnouncement(null)}
        title={selectedAnnouncement?.title || "Announcement"}
        subtitle={
          selectedAnnouncement?.createdAt
            ? `${new Date(selectedAnnouncement.createdAt).toLocaleString()}${
                selectedAnnouncement?.createdBy?.name
                  ? ` • Posted by ${selectedAnnouncement.createdBy.name} (${selectedAnnouncement.createdBy.role === "teacher" ? "Teacher" : "Admin"})`
                  : ""
              }`
            : undefined
        }
      >
        {selectedAnnouncement?.createdBy?.name && (
          <div className="mb-4 p-3 bg-surface rounded-xl border border-line flex items-center justify-between text-xs">
            <span className="text-ink-faint font-medium">Sent By</span>
            <span className="font-semibold text-ink">
              {selectedAnnouncement.createdBy.name} ({selectedAnnouncement.createdBy.role === "teacher" ? "Teacher" : "Admin"})
            </span>
          </div>
        )}
        <p className="text-ink leading-relaxed whitespace-pre-wrap">{selectedAnnouncement?.message}</p>
      </Modal>

      {/* File Preview Modal */}
      <Modal
        isOpen={!!selectedFile}
        onClose={() => { setSelectedFile(null); setFileContent(null); }}
        title={selectedFile?.fileName ?? "File Preview"}
        size="lg"
      >
        {fileContent?.type === "image" && (
          <img src={fileContent.content} alt="Preview" className="max-w-full h-auto rounded-lg" />
        )}
        {fileContent?.type === "pdf" && (
          <iframe src={fileContent.content} title="PDF Viewer" className="w-full h-96 rounded-lg" />
        )}
        {fileContent?.type === "download" && (
          <div className="text-center py-8">
            <p className="text-ink-soft mb-4">This file type cannot be previewed</p>
            <a
              href={fileContent.content}
              download={fileContent.fileName}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
            >
              <Download className="w-4 h-4" />
              Download File
            </a>
          </div>
        )}
        {fileContent?.type === "error" && (
          <p className="text-red-500 text-center py-4">{fileContent.content}</p>
        )}
      </Modal>

      {/* Global styles for utility classes that read CSS variables */}
      <style>{`
        .theme-text  { color: var(--theme-primary); }
        .theme-bg    { background-color: var(--theme-primary); }
        .theme-border-l { border-left: 4px solid var(--theme-primary); }
      `}</style>
    </div>
  );
}

// ─── sub-components ──────────────────────────────────────────────────────────

function TicketCard({ ticket, primary, onPreview }) {
  const statusTone = {
    approved: "success",
    rejected: "danger",
  };
  const tone = statusTone[ticket.status] ?? "warning";

  return (
    <Card padding="md">
      <div className="flex justify-between items-start mb-3">
        <div>
          <p className="text-xs text-ink-faint mb-1">Ticket #{ticket._id?.slice(-8)}</p>
          <p className="font-medium text-ink">{ticket.section || "General Inquiry"}</p>
        </div>
        <Badge tone={tone}>{ticket.status || "pending"}</Badge>
      </div>

      <p className="text-ink-soft mb-3">{ticket.document}</p>

      {ticket.response && (
        <div className="bg-primary-soft border border-primary-surface rounded-lg p-3 mb-3">
          <p className="text-xs font-medium text-primary-dark mb-1">Response:</p>
          <p className="text-sm text-ink">{ticket.response}</p>
        </div>
      )}

      {ticket.file && (
        <Button
          variant="ghost"
          size="sm"
          leftIcon={Eye}
          onClick={() => onPreview(ticket._id, ticket.file)}
        >
          View Attachment
        </Button>
      )}
    </Card>
  );
}
