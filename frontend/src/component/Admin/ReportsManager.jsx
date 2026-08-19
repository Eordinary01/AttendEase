import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { BarChart3, Download, AlertCircle, Check, CalendarRange } from "lucide-react";
import api from "../../utils/api";
import Card from "../common/ui/Card";
import Badge from "../common/ui/Badge";
import PageHeader from "../common/ui/PageHeader";
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
      setSuccess("Report exported");
    } catch (err) {
      setError("Export failed. Check permission.");
    } finally {
      setExporting(false);
    }
  };

  const statusBadge = (status) => {
    const map = { good: "success", warning: "warning", critical: "danger", "no-data": "neutral" };
    const label = { good: "Good", warning: "Warning", critical: "Critical", "no-data": "No Data" };
    return <Badge tone={map[status]}>{label[status]}</Badge>;
  };

  const columns = [
    { header: "Name", cell: (r) => <span className="font-medium text-ink">{r.name}</span> },
    { header: "Roll No", cell: (r) => <span className="text-ink-soft">{r.rollNo}</span> },
    { header: "Section", cell: (r) => <span className="text-ink-soft">Section {r.section}</span> },
    { header: "Present", cell: (r) => <span className="text-ink-soft">{r.presentCount}/{r.totalClasses}</span> },
    { header: "Percentage", cell: (r) => (
      <div className="flex items-center gap-2">
        <div className="w-24 h-2 bg-background rounded-full overflow-hidden">
          <div className={`h-full ${r.percentage >= 75 ? "bg-green-500" : r.percentage >= 60 ? "bg-amber-500" : r.percentage > 0 ? "bg-red-500" : "bg-gray-300"}`} style={{ width: `${Math.min(100, r.percentage)}%` }} />
        </div>
        <span className="text-sm font-semibold text-ink">{r.percentage}%</span>
      </div>
    ) },
    { header: "Status", cell: (r) => statusBadge(r.status) },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <PageHeader
        title="Attendance Reports"
        subtitle="Analyze attendance trends and export data"
        icon={BarChart3}
        actions={canExport ? <Button onClick={handleExport} loading={exporting} leftIcon={Download}>Export CSV</Button> : null}
      />



      <Card>
        <div className="grid md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-ink-faint uppercase mb-1.5">Section</label>
            <select value={filters.section} onChange={e => setFilters(p => ({ ...p, section: e.target.value }))} className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary appearance-none">
              <option value="">All Sections</option>
              {sections.map(s => <option key={s} value={s}>Section {s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-faint uppercase mb-1.5">Subject</label>
            <select value={filters.subjectId} onChange={e => setFilters(p => ({ ...p, subjectId: e.target.value }))} className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary appearance-none">
              <option value="">All Subjects</option>
              {subjects.map(s => <option key={s._id} value={s._id}>{s.subjectName} ({s.subjectCode})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-faint uppercase mb-1.5">From</label>
            <input type="date" value={filters.fromDate} onChange={e => setFilters(p => ({ ...p, fromDate: e.target.value }))} className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-faint uppercase mb-1.5">To</label>
            <input type="date" value={filters.toDate} onChange={e => setFilters(p => ({ ...p, toDate: e.target.value }))} className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary" />
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Card key={i} padding="lg"><Skeleton rows={2} /></Card>)}
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Students" value={data.summary.totalStudents} />
            <StatCard label="Avg Attendance" value={`${data.summary.averageAttendance}%`} />
            <StatCard label="Total Classes" value={data.summary.totalClasses} tone="primary" />
            <StatCard label="Critical (<60%)" value={data.summary.criticalCount} tone={data.summary.criticalCount > 0 ? "danger" : "success"} />
          </div>

          {data.rows.length === 0 ? (
            <EmptyState title="No Report Data" description="No attendance records match these filters" icon={CalendarRange} />
          ) : (
            <Card padding="none" className="overflow-hidden">
              <Table columns={columns} data={data.rows} rowKey="id" />
            </Card>
          )}
        </>
      ) : null}

      <div className="pt-6 border-t border-line">
        <AttendanceHistory role="admin" showStudentSelector />
      </div>
    </motion.div>
  );
};

export default ReportsManager;
