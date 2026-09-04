import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ClipboardCheck,
  Calendar,
  Filter,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  User,
  BookOpen,
  RefreshCw,
  Search,
  Eye,
  Users,
  Building2,
} from "lucide-react";
import api from "../../utils/api";
import Card from "../common/ui/Card";
import Badge from "../common/ui/Badge";
import Button from "../common/ui/Button";
import DashboardHeader from "../common/ui/DashboardHeader";
import EmptyState from "../common/ui/EmptyState";
import Table from "../common/ui/Table";
import StatCard from "../common/ui/StatCard";
import Modal from "../common/ui/Modal";

const AttendanceHistory = ({
  role: roleProp = null,
  studentId = "",
  showStudentSelector = false,
}) => {
  const userRole = roleProp || localStorage.getItem("role") || "student";
  const isStaff = userRole === "admin" || userRole === "teacher" || userRole === "super_admin";
  const [viewMode, setViewMode] = useState(isStaff ? "sessions" : "detailed");

  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState({
    totalClasses: 0,
    presentCount: 0,
    absentCount: 0,
    leaveCount: 0,
    percentage: 0,
  });
  const [subjects, setSubjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(studentId);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Roster Modal state
  const [activeSession, setActiveSession] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch options (subjects & students if admin)
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const subRes = await api.get("/subjects/all");
        const subData = subRes.data;
        const subList = Array.isArray(subData)
          ? subData
          : Array.isArray(subData?.data)
          ? subData.data
          : Array.isArray(subData?.subjects)
          ? subData.subjects
          : Array.isArray(subData?.allActiveSubjects)
          ? subData.allActiveSubjects
          : [];

        const normalizedSubList = subList.map((item) => {
          const s = item.subject || item;
          return {
            id: s._id || s.id || item._id || item.id,
            name: s.subjectName || s.name || item.subjectName || item.name || "Subject",
            code: s.subjectCode || s.code || item.subjectCode || item.code || "",
          };
        }).filter((s) => s.id);

        setSubjects(normalizedSubList);

        if (showStudentSelector || isStaff) {
          const stuRes = await api.get("/users/students?limit=2000");
          const stuData = stuRes.data;
          const stuList = Array.isArray(stuData)
            ? stuData
            : Array.isArray(stuData?.data)
            ? stuData.data
            : Array.isArray(stuData?.students)
            ? stuData.students
            : [];
          setStudents(stuList);
        }
      } catch (err) {
        console.error("Failed to load options", err);
        setSubjects([]);
        setStudents([]);
      }
    };
    fetchOptions();
  }, [userRole, showStudentSelector, isStaff]);

  // Fetch Attendance History
  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", page);
      params.set("limit", isStaff && viewMode === "sessions" ? 1000 : 50);
      if (selectedStudent) params.set("studentId", selectedStudent);
      if (selectedSubject) params.set("subjectId", selectedSubject);
      if (selectedStatus) params.set("status", selectedStatus);
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);

      const res = await api.get(`/attendance/history?${params.toString()}`);
      if (res.data?.success) {
        setRecords(res.data.data || []);
        setStats(res.data.stats || {});
        setPagination(res.data.pagination || { totalPages: 1, total: 0 });
      }
    } catch (err) {
      console.error("Failed to fetch attendance history", err);
    } finally {
      setLoading(false);
    }
  }, [page, selectedStudent, selectedSubject, selectedStatus, fromDate, toDate, isStaff, viewMode]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Group records by Class Session for Admin/Teacher Session View
  const groupedSessions = useMemo(() => {
    if (!Array.isArray(records) || records.length === 0) return [];

    const map = new Map();
    records.forEach((r) => {
      // Group by subject + section + date — this ensures all students in the same class are in one row
      const dateKey = new Date(r.date).toISOString().slice(0, 10);
      const key = `${r.subject?.id || 'sub'}-${r.section || 'A'}-${dateKey}`;
      if (!map.has(key)) {
        map.set(key, {
          sessionId: key,
          date: r.date,
          day: r.day || "Monday",
          startTime: r.startTime || "09:00 AM",
          endTime: r.endTime || "10:00 AM",
          room: r.room || "LH-101",
          section: r.section || "A",
          subject: r.subject || { name: "Subject", code: "" },
          teacher: r.teacher || { name: "Teacher" },
          presentCount: 0,
          absentCount: 0,
          leaveCount: 0,
          students: [],
        });
      }

      const session = map.get(key);
      if (r.status === "present") session.presentCount++;
      else if (r.status === "absent") session.absentCount++;
      else if (r.status === "leave") session.leaveCount++;

      session.students.push({
        id: r.id,
        name: r.student?.name || r.studentName || "Student",
        rollNo: r.student?.rollNo || r.rollNo || "N/A",
        email: r.student?.email || "",
        status: r.status,
        remarks: r.remarks,
      });
    });

    return Array.from(map.values());
  }, [records]);

  const handleExportCSV = () => {
    if (records.length === 0) return;
    setExporting(true);
    try {
      const headers = ["Date", "Day", "Time", "Room", "Student Name", "Roll No", "Subject Code", "Subject Name", "Teacher", "Status", "Remarks"];
      const rows = records.map((r) => [
        new Date(r.date).toLocaleDateString(),
        r.day || "",
        `${r.startTime || ""} - ${r.endTime || ""}`,
        r.room || "",
        `"${r.student?.name || ""}"`,
        `"${r.student?.rollNo || ""}"`,
        r.subject?.code || "",
        `"${r.subject?.name || ""}"`,
        `"${r.teacher?.name || ""}"`,
        r.status || "",
        `"${r.remarks || ""}"`,
      ]);

      const csvContent =
        "data:text/csv;charset=utf-8," +
        [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `attendance_history_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      setExporting(false);
    }
  };

  const statusBadge = (status) => {
    switch (status) {
      case "present":
        return <Badge tone="success">Present</Badge>;
      case "absent":
        return <Badge tone="danger">Absent</Badge>;
      case "leave":
        return <Badge tone="warning">On Leave</Badge>;
      default:
        return <Badge tone="neutral">{status}</Badge>;
    }
  };

  const detailedColumns = [
    {
      header: "Date & Session",
      cell: (r) => (
        <div>
          <div className="font-semibold text-ink">
            {new Date(r.date).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </div>
          <div className="text-xs text-ink-soft flex items-center gap-1 mt-0.5">
            <Clock className="w-3 h-3 text-ink-faint" />
            {r.startTime} – {r.endTime} | {r.room}
          </div>
        </div>
      ),
    },
    ...(isStaff || showStudentSelector
      ? [
          {
            header: "Student",
            cell: (r) => (
              <div>
                <div className="font-semibold text-ink">{r.student?.name || "Student"}</div>
                <div className="text-xs text-ink-soft">Roll: {r.student?.rollNo || "N/A"}</div>
              </div>
            ),
          },
        ]
      : []),
    {
      header: "Subject & Section",
      cell: (r) => (
        <div>
          <div className="font-medium text-ink flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-primary" />
            {r.subject?.name || "Subject"}
          </div>
          <div className="text-xs text-ink-faint flex items-center gap-2 mt-0.5">
            <span className="font-mono">{r.subject?.code}</span>
            <span className="px-1.5 py-0.2 rounded bg-primary-soft text-primary font-bold">Sec {r.section}</span>
          </div>
        </div>
      ),
    },
    {
      header: "Teacher",
      cell: (r) => (
        <div className="text-sm text-ink-soft flex items-center gap-1">
          <User className="w-3.5 h-3.5 text-ink-faint" />
          {r.teacher?.name || "N/A"}
        </div>
      ),
    },
    {
      header: "Status",
      cell: (r) => statusBadge(r.status),
    },
    {
      header: "Remarks",
      cell: (r) => (
        <span className="text-xs text-ink-faint italic">{r.remarks || "—"}</span>
      ),
    },
  ];

  const sessionColumns = [
    {
      header: "Class Session",
      cell: (s) => (
        <div>
          <div className="font-semibold text-ink flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            {s.subject?.name}
          </div>
          <div className="text-xs text-ink-soft flex items-center gap-2 mt-0.5">
            <span className="font-mono font-bold text-primary">{s.subject?.code}</span>
            <span className="px-1.5 py-0.5 rounded bg-primary-soft text-primary font-bold text-[10px]">Sec {s.section}</span>
          </div>
        </div>
      ),
    },
    {
      header: "Date & Room",
      cell: (s) => (
        <div>
          <div className="font-medium text-ink">
            {new Date(s.date).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })} ({s.day})
          </div>
          <div className="text-xs text-ink-soft flex items-center gap-1.5 mt-0.5">
            <Clock className="w-3 h-3 text-ink-faint" />
            {s.startTime} – {s.endTime} | <Building2 className="w-3 h-3 text-ink-faint ml-1" /> {s.room}
          </div>
        </div>
      ),
    },
    {
      header: "Teacher",
      cell: (s) => (
        <div className="text-sm text-ink-soft flex items-center gap-1.5 font-medium">
          <User className="w-3.5 h-3.5 text-ink-faint" />
          {s.teacher?.name || "N/A"}
        </div>
      ),
    },
    {
      header: "Total Strength",
      cell: (s) => {
        const total = s.presentCount + s.absentCount + s.leaveCount;
        return (
          <div className="font-bold text-ink flex items-center gap-1">
            <Users className="w-4 h-4 text-primary" />
            {total} Students
          </div>
        );
      },
    },
    {
      header: "Present",
      cell: (s) => (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold text-emerald-700 bg-emerald-100/80">
          {s.presentCount} Present
        </span>
      ),
    },
    {
      header: "Absent",
      cell: (s) => (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold text-red-700 bg-red-100/80">
          {s.absentCount} Absent
        </span>
      ),
    },
    {
      header: "Leave",
      cell: (s) => (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold text-amber-700 bg-amber-100/80">
          {s.leaveCount} Leave
        </span>
      ),
    },
    {
      header: "Action",
      cell: (s) => (
        <Button
          size="xs"
          variant="subtle"
          leftIcon={Eye}
          onClick={() => {
            setActiveSession(s);
            setIsModalOpen(true);
          }}
        >
          View Roster
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <DashboardHeader
        greeting="Attendance History & Audit Registry"
        meta="Comprehensive logs of classroom attendance sessions, roll records, and aggregate performance"
        actions={
          <div className="flex gap-2">
            <Button variant="subtle" size="sm" onClick={fetchHistory} leftIcon={RefreshCw} loading={loading}>
              Refresh
            </Button>
            <Button variant="primary" size="sm" onClick={handleExportCSV} leftIcon={Download} disabled={records.length === 0 || exporting}>
              Export CSV
            </Button>
          </div>
        }
      />

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <StatCard
          label="Total Classes"
          value={stats.totalClasses}
          icon={Calendar}
          tone="primary"
        />
        <StatCard
          label="Present Attendance"
          value={`${stats.presentCount} (${stats.percentage || 0}%)`}
          icon={CheckCircle2}
          tone="success"
        />
        <StatCard
          label="Absent Recorded"
          value={stats.absentCount}
          icon={XCircle}
          tone="danger"
        />
        <StatCard
          label="Approved Leave"
          value={stats.leaveCount}
          icon={Clock}
          tone="warning"
        />
      </div>

      {/* View Mode Toggle for Admin / Teacher */}
      {isStaff && (
        <div className="flex items-center justify-between bg-surface p-2 rounded-xl border border-line">
          <div className="text-xs font-semibold text-ink-soft px-2">
            Display Mode:
          </div>
          <div className="flex gap-1 bg-background p-1 rounded-lg">
            <button
              onClick={() => setViewMode("sessions")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                viewMode === "sessions"
                  ? "bg-surface text-primary shadow-sm"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Class Sessions View
            </button>
            <button
              onClick={() => setViewMode("detailed")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                viewMode === "detailed"
                  ? "bg-surface text-primary shadow-sm"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              <User className="w-3.5 h-3.5" />
              Detailed Student Logs
            </button>
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <Card className="p-4">
        <div className="grid sm:grid-cols-2 md:grid-cols-5 gap-3">
          {(showStudentSelector || isStaff) && (
            <div>
              <label className="block text-xs font-semibold text-ink-faint uppercase mb-1">Student</label>
              <select
                value={selectedStudent}
                onChange={(e) => { setSelectedStudent(e.target.value); setPage(1); }}
                className="w-full text-sm px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-primary/30"
              >
                <option value="">All Students</option>
                {Array.isArray(students) && students.map((s) => (
                  <option key={s._id} value={s._id}>{s.name} ({s.rollNo || s.section})</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-ink-faint uppercase mb-1">Subject</label>
            <select
              value={selectedSubject}
              onChange={(e) => { setSelectedSubject(e.target.value); setPage(1); }}
              className="w-full text-sm px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-primary/30"
            >
              <option value="">All Subjects</option>
              {Array.isArray(subjects) && subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}{sub.code ? ` (${sub.code})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-faint uppercase mb-1">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => { setSelectedStatus(e.target.value); setPage(1); }}
              className="w-full text-sm px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-primary/30"
            >
              <option value="">All Statuses</option>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="leave">On Leave</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-faint uppercase mb-1">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
              className="w-full text-sm px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-faint uppercase mb-1">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setPage(1); }}
              className="w-full text-sm px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>
      </Card>

      {/* Attendance History Table */}
      <Card>
        {loading ? (
          <div className="py-16 text-center text-ink-soft">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-primary" />
            Loading attendance records...
          </div>
        ) : !Array.isArray(records) || records.length === 0 ? (
          <EmptyState
            title="No Attendance Records Found"
            description="No matching attendance entries recorded for the selected filter criteria."
            icon={ClipboardCheck}
          />
        ) : isStaff && viewMode === "sessions" ? (
          <div>
            <Table columns={sessionColumns} data={groupedSessions} />
          </div>
        ) : (
          <div>
            <Table columns={detailedColumns} data={records} />

            {/* Pagination Controls */}
            <div className="flex items-center justify-between p-4 border-t border-line">
              <span className="text-sm text-ink-soft">
                Showing Page {page} of {pagination.totalPages} ({pagination.total} records)
              </span>
              <div className="flex gap-2">
                <Button
                  variant="subtle"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  leftIcon={ChevronLeft}
                >
                  Previous
                </Button>
                <Button
                  variant="subtle"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={page >= pagination.totalPages}
                  rightIcon={ChevronRight}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Class Student Roster Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setActiveSession(null);
        }}
        title={`Class Roster — ${activeSession?.subject?.name || "Session"}`}
        subtitle={`${activeSession?.subject?.code} | Section ${activeSession?.section} | ${new Date(activeSession?.date || Date.now()).toLocaleDateString()} (${activeSession?.startTime} - ${activeSession?.endTime})`}
        size="lg"
      >
        {activeSession && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 p-3 bg-background rounded-xl text-center border border-line">
              <div>
                <div className="text-xs text-ink-soft">Present</div>
                <div className="text-lg font-bold text-emerald-600">{activeSession.presentCount}</div>
              </div>
              <div>
                <div className="text-xs text-ink-soft">Absent</div>
                <div className="text-lg font-bold text-red-600">{activeSession.absentCount}</div>
              </div>
              <div>
                <div className="text-xs text-ink-soft">On Leave</div>
                <div className="text-lg font-bold text-amber-600">{activeSession.leaveCount}</div>
              </div>
            </div>

            <div className="border border-line rounded-xl overflow-hidden max-h-[350px] overflow-y-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-background text-xs text-ink-soft uppercase border-b border-line sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">Roll No</th>
                    <th className="py-2.5 px-3">Student Name</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {activeSession.students.map((stu) => (
                    <tr key={stu.id} className="hover:bg-background/50 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-xs font-bold text-primary">{stu.rollNo}</td>
                      <td className="py-2.5 px-3 font-semibold text-ink">{stu.name}</td>
                      <td className="py-2.5 px-3">{statusBadge(stu.status)}</td>
                      <td className="py-2.5 px-3 text-xs text-ink-faint italic">{stu.remarks || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AttendanceHistory;
