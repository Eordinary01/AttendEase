import React, { useState, useEffect, useCallback } from "react";
import { BarChart3, Download, AlertCircle, Check, CalendarRange } from "lucide-react";
import api from "../../utils/api";
import Card from "../common/ui/Card";
import Badge from "../common/ui/Badge";
import DashboardHeader from "../common/ui/DashboardHeader";
import EmptyState from "../common/ui/EmptyState";
import Table from "../common/ui/Table";
import Button from "../common/ui/Button";
import Skeleton from "../common/ui/Skeleton";
import StatCard from "../common/ui/StatCard";
import { usePermissions } from "../../contexts/PermissionsContext";
import AttendanceHistory from "../AttendanceHistory";

const ReportsManager = () => {
  const { can } = usePermissions();
  const canExport = can("reports:export");
  const [data, setData] = useState(null);
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [filters, setFilters] = useState({ section: "", fromDate: "", toDate: "", subjectId: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [exporting, setExporting] = useState(false);

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.section) params.set("section", filters.section);
      if (filters.fromDate) params.set("fromDate", filters.fromDate);
      if (filters.toDate) params.set("toDate", filters.toDate);
      if (filters.subjectId) params.set("subjectId", filters.subjectId);
      const qs = params.toString();
      const res = await api.get(`/reports/attendance${qs ? `?${qs}` : ""}`);
      setData(res.data.data);
      setSections([...new Set((res.data.data?.rows || []).map(r => r.section).filter(Boolean))].sort());
      setSubjects((res.data.data?.subjects || []).map(s => ({ _id: s._id, subjectName: s.subjectName, subjectCode: s.subjectCode })));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [filters.section, filters.fromDate, filters.toDate, filters.subjectId]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  useEffect(() => {
    if (error || success) {
      const t = setTimeout(() => { setError(null); setSuccess(null); }, 4000);
      return () => clearTimeout(t);
    }
  }, [error, success]);

  const handleExport = async () => {
    if (!canExport) {
      setError("You do not have permission to export reports (reports:export required).");
      return;
    }
    try {
      setExporting(true);
      const params = new URLSearchParams();
      if (filters.section) params.set("section", filters.section);
      if (filters.fromDate) params.set("fromDate", filters.fromDate);
      if (filters.toDate) params.set("toDate", filters.toDate);
      if (filters.subjectId) params.set("subjectId", filters.subjectId);
      const qs = params.toString();
      const res = await api.get(`/reports/attendance/export${qs ? `?${qs}` : ""}`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = `attendance-report-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setSuccess("Report exported successfully");
    } catch (err) {
      setError("Export failed. Check permission.");
    } finally {
      setExporting(false);
    }
  };

  const statusBadge = (status) => {
    const map = { good: "success", warning: "warning", critical: "danger", "no-data": "neutral" };
    const label = { good: "Good", warning: "Warning", critical: "Critical", "no-data": "No Data" };
    return <Badge tone={map[status]} size="sm">{label[status]}</Badge>;
  };

  const columns = [
    { header: "Student Name", cell: (r) => <span className="font-bold text-xs text-ink">{r.name}</span> },
    { header: "Roll No", cell: (r) => <span className="text-xs font-mono text-ink-soft">{r.rollNo}</span> },
    { header: "Section", cell: (r) => <Badge tone="primary" size="sm">Sec {r.section}</Badge> },
    { header: "Attendance Ratio", cell: (r) => <span className="text-xs font-semibold text-ink-soft">{r.presentCount} / {r.totalClasses} classes</span> },
    { header: "Compliance", cell: (r) => (
      <div className="flex items-center gap-2">
        <div className="w-20 h-1.5 bg-line/60 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${r.percentage >= 75 ? "bg-emerald-500" : r.percentage >= 60 ? "bg-amber-500" : r.percentage > 0 ? "bg-rose-500" : "bg-ink-faint"}`} style={{ width: `${Math.min(100, r.percentage)}%` }} />
        </div>
        <span className="text-xs font-bold text-ink">{r.percentage}%</span>
      </div>
    ) },
    { header: "Risk Status", cell: (r) => statusBadge(r.status) },
  ];

  return (
    <div className="space-y-6">
      <DashboardHeader
        greeting="Attendance Analytics & Compliance Reports"
        meta="Track student engagement metrics, aggregate attendance trends, and export compliance registries"
        actions={
          canExport ? (
            <Button
              variant="subtle"
              size="sm"
              onClick={handleExport}
              loading={exporting}
              leftIcon={Download}
            >
              Export CSV Registry
            </Button>
          ) : null
        }
      />

      {error && <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-600 text-xs font-semibold">{error}</div>}
      {success && <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 text-xs font-semibold">{success}</div>}

      {/* Filter Toolbar Card */}
      <Card padding="md" bordered>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-ink-soft uppercase tracking-wider mb-1">Section</label>
            <select 
              value={filters.section} 
              onChange={e => setFilters(p => ({ ...p, section: e.target.value }))} 
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-line/50 bg-background text-ink outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
              <option value="">All Sections</option>
              {sections.map(s => <option key={s} value={s}>Section {s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-ink-soft uppercase tracking-wider mb-1">Subject</label>
            <select 
              value={filters.subjectId} 
              onChange={e => setFilters(p => ({ ...p, subjectId: e.target.value }))} 
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-line/50 bg-background text-ink outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
              <option value="">All Subjects</option>
              {subjects.map(s => <option key={s._id} value={s._id}>{s.subjectName} ({s.subjectCode})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-ink-soft uppercase tracking-wider mb-1">From Date</label>
            <input 
              type="date" 
              value={filters.fromDate} 
              onChange={e => setFilters(p => ({ ...p, fromDate: e.target.value }))} 
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-line/50 bg-background text-ink outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer" 
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-ink-soft uppercase tracking-wider mb-1">To Date</label>
            <input 
              type="date" 
              value={filters.toDate} 
              onChange={e => setFilters(p => ({ ...p, toDate: e.target.value }))} 
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-line/50 bg-background text-ink outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer" 
            />
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          {[...Array(4)].map((_, i) => <Card key={i} padding="lg" bordered><Skeleton rows={2} /></Card>)}
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <StatCard label="Total Students" value={data.summary.totalStudents} tone="primary" />
            <StatCard label="Average Attendance" value={`${data.summary.averageAttendance}%`} tone="info" />
            <StatCard label="Total Classes Logged" value={data.summary.totalClasses} tone="secondary" />
            <StatCard label="Critical Attendance (<60%)" value={data.summary.criticalCount} tone={data.summary.criticalCount > 0 ? "danger" : "success"} />
          </div>

          {data.rows.length === 0 ? (
            <EmptyState title="No Report Records" description="No attendance records match the chosen filter range." icon={CalendarRange} />
          ) : (
            <Card padding="none" bordered className="overflow-hidden">
              <Table columns={columns} data={data.rows} rowKey="id" />
            </Card>
          )}
        </>
      ) : null}

      <div className="pt-6 border-t border-line/50">
        <AttendanceHistory role="admin" showStudentSelector />
      </div>
    </div>
  );
};

export default ReportsManager;
