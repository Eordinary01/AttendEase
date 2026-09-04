import React, { useState, useEffect, useCallback } from "react";
import { Users, Plus, Edit, Search, AlertCircle, Check, Save, GraduationCap } from "lucide-react";
import api from "../../utils/api";
import Modal from "../common/ui/Modal";
import Button from "../common/ui/Button";
import Card from "../common/ui/Card";
import Badge from "../common/ui/Badge";
import DashboardHeader from "../common/ui/DashboardHeader";
import EmptyState from "../common/ui/EmptyState";
import Table from "../common/ui/Table";
import Input, { Select } from "../common/ui/Input";
import Skeleton from "../common/ui/Skeleton";
import { usePermissions } from "../../contexts/PermissionsContext";

const StudentsManager = () => {
  const { can } = usePermissions();
  const canWrite = can("students:write");
  const [students, setStudents] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState("");
  const [courses, setCourses] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "", email: "", rollNo: "", section: "", phone: "", parentName: "", parentPhone: "",
    courseId: "", branch: "", semester: 1, admissionYear: new Date().getFullYear(),
  });

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, pages: 1 });

  const fetchSections = useCallback(async () => {
    try {
      const res = await api.get("/admin/active-sections");
      const secList = res.data?.data || res.data?.sections || [];
      if (Array.isArray(secList) && secList.length > 0) {
        setSections(secList.sort());
      }
    } catch (err) {
      // Fallback
    }
  }, []);

  const fetchCourses = useCallback(async () => {
    try {
      const res = await api.get("/academic/courses");
      setCourses(res.data?.data || []);
    } catch (err) {
      // Course structure may be empty/not configured — ignore silently
    }
  }, []);

  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (selectedSection) params.set("section", selectedSection);
      if (search) params.set("search", search);
      const res = await api.get(`/attendance/admin/students?${params}`);
      const data = res.data.data || [];
      setStudents(data);
      if (res.data.pagination) {
        setPagination(res.data.pagination);
      }
      if (sections.length === 0) {
        setSections(prev => {
          const combined = new Set([...prev, ...data.map(s => s.section).filter(Boolean)]);
          return Array.from(combined).sort();
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load students");
    } finally {
      setLoading(false);
    }
  }, [page, limit, selectedSection, search, sections.length]);

  useEffect(() => {
    setPage(1);
  }, [selectedSection, search]);

  useEffect(() => {
    fetchStudents();
    fetchCourses();
    fetchSections();
  }, [fetchStudents, fetchCourses, fetchSections]);

  useEffect(() => {
    if (error || success) {
      const t = setTimeout(() => { setError(null); setSuccess(null); }, 4000);
      return () => clearTimeout(t);
    }
  }, [error, success]);

  const openCreate = () => {
    setEditing(null);
    setFormData({ name: "", email: "", rollNo: "", section: selectedSection, phone: "", parentName: "", parentPhone: "", courseId: "", branch: "", semester: 1, admissionYear: new Date().getFullYear() });
    setShowForm(true);
  };

  const openEdit = (s) => {
    setEditing(s);
    setFormData({
      name: s.name, email: s.email, rollNo: s.rollNo, section: s.section, phone: s.phone || "",
      parentName: s.parentName || "", parentPhone: s.parentPhone || "",
      courseId: s.courseId || "", branch: s.branch || "", semester: s.semester || 1,
      admissionYear: s.admissionYear || new Date().getFullYear(),
    });
    setShowForm(true);
  };

  const selectedCourse = courses.find((c) => String(c._id) === String(formData.courseId));
  const branchOptions = selectedCourse?.branches?.filter((b) => b.isActive !== false) || [];

  const handleCourseChange = (courseId) => {
    setFormData((p) => ({ ...p, courseId, branch: "" }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.rollNo || !formData.section) {
      setError("Fill all required fields"); return;
    }
    try {
      setSubmitting(true);
      if (editing) {
        await api.put(`/students/${editing.id}`, formData);
        setSuccess("Student updated successfully");
      } else {
        await api.post('/students', formData);
        setSuccess("Student enrolled successfully");
      }
      setShowForm(false);
      fetchStudents();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save student");
    } finally {
      setSubmitting(false);
    }
  };

  const attendanceBadge = (s) => {
    const pct = s.attendance?.percentage;
    if (pct === undefined || pct === null) return <Badge tone="neutral" size="sm">—</Badge>;
    const tone = pct >= 75 ? "success" : pct >= 60 ? "warning" : "danger";
    return <Badge tone={tone} size="sm">{pct}%</Badge>;
  };

  const columns = [
    { 
      header: "Student Name", 
      cell: (s) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary font-bold text-xs flex items-center justify-center">
            {s.name?.charAt(0)?.toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-ink text-xs">{s.name}</p>
            <p className="text-[11px] text-ink-soft">{s.email}</p>
          </div>
        </div>
      )
    },
    { header: "Roll No", cell: (s) => <span className="font-mono text-xs font-bold text-ink">{s.rollNo}</span> },
    { 
      header: "Section", 
      cell: (s) => (
        <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-primary/10 text-primary border border-primary/20">
          Section {s.section}
        </span>
      ) 
    },
    { 
      header: "Course / Branch", 
      cell: (s) => (
        <span className="text-xs text-ink-soft font-medium">
          {(s.courseName || s.courseId?.name || s.courseId?.code || "—")}{s.branch ? ` / ${s.branch}` : ""}
        </span>
      ) 
    },
    { header: "Semester", cell: (s) => s.semester ? <Badge tone="primary" size="sm">Sem {s.semester}</Badge> : <Badge tone="neutral" size="sm">—</Badge> },
    { header: "Batch", cell: (s) => <span className="text-xs text-ink-soft font-medium">{s.admissionYear || "—"}</span> },
    { header: "Attendance", cell: attendanceBadge },
    ...(canWrite ? [{ 
      header: "", 
      cell: (s) => (
        <button
          onClick={() => openEdit(s)}
          className="p-1.5 hover:bg-background rounded-lg text-ink-soft hover:text-primary transition cursor-pointer"
          title="Edit student"
        >
          <Edit className="w-3.5 h-3.5" />
        </button>
      ) 
    }] : []),
  ];

  return (
    <div className="space-y-6">
      <DashboardHeader
        greeting="Student Directory & Enrollment"
        meta={`Managing ${pagination.total || students.length} student profiles and attendance telemetry`}
        actions={
          canWrite ? (
            <Button
              variant="primary"
              size="sm"
              onClick={openCreate}
              leftIcon={Plus}
            >
              Enroll Student
            </Button>
          ) : null
        }
      />

      {error && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-600 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 text-xs font-medium flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Filter Toolbar */}
      <Card padding="md" bordered>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto flex-1">
            <div className="relative flex-1 sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-faint" />
              <input
                type="text"
                placeholder="Search by student name, roll no, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-line/50 bg-background text-ink outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div className="relative w-full sm:w-48">
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-line/50 bg-background text-ink outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
              >
                <option value="">All Sections</option>
                {sections.map(s => <option key={s} value={s}>Section {s}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-center">
            <div className="flex items-center gap-1.5 text-xs text-ink-soft">
              <span className="font-medium">Rows:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="px-2 py-1 text-xs rounded-lg border border-line/50 bg-background text-ink outline-none cursor-pointer focus:ring-1 focus:ring-primary"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={500}>500</option>
              </select>
            </div>
            <span className="text-xs text-ink-soft font-semibold">{pagination.total || students.length} students found</span>
          </div>
        </div>
      </Card>

      {loading ? (
        <Card padding="lg" bordered><Skeleton rows={6} /></Card>
      ) : students.length === 0 ? (
        <EmptyState
          title="No Students Found"
          description="No students matching your search criteria."
          icon={Users}
          action={canWrite ? <Button variant="primary" size="sm" onClick={openCreate} leftIcon={Plus}>Enroll Student</Button> : null}
        />
      ) : (
        <Card padding="none" bordered className="overflow-hidden">
          <Table columns={columns} data={students} rowKey="id" pagination={pagination} onPageChange={setPage} />
        </Card>
      )}

      {/* Student Form Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editing ? "Edit Student Profile" : "Enroll New Student"} size="lg" error={error}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-3.5">
            <Input label="Full Name *" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} required placeholder="e.g. Alex Johnson" />
            <Input label="Student Email *" type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} required placeholder="alex@campus.edu" />
            <Input label="Roll Number *" value={formData.rollNo} onChange={e => setFormData(p => ({ ...p, rollNo: e.target.value }))} required placeholder="e.g. CS2026-042" />
            <Input label="Section *" value={formData.section} onChange={e => setFormData(p => ({ ...p, section: e.target.value.toUpperCase() }))} required placeholder="A" />
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <Select label="Course" value={formData.courseId} onChange={e => handleCourseChange(e.target.value)}>
                <option value="">Select course (optional)</option>
                {courses.map(c => <option key={c._id} value={c._id}>{c.name} ({c.code})</option>)}
              </Select>
            </div>
            <div>
              <Select label="Branch / Stream" value={formData.branch} onChange={e => setFormData(p => ({ ...p, branch: e.target.value }))} disabled={!formData.courseId || branchOptions.length === 0}>
                <option value="">
                  {!formData.courseId ? "Select course first" : branchOptions.length === 0 ? "No branches" : "Select branch"}
                </option>
                {branchOptions.map((b, i) => (
                  <option key={b._id || b.name + i} value={b.name}>{b.name}{b.totalSemesters ? ` (${b.durationYears}y / ${b.totalSemesters}s)` : ""}</option>
                ))}
              </Select>
            </div>
            <div>
              <Input label="Admission Year" type="number" min="2000" max="2100" value={formData.admissionYear} onChange={e => setFormData(p => ({ ...p, admissionYear: e.target.value }))} />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3.5 pt-2 border-t border-line/50">
            <Input label="Phone Number" value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} placeholder="+91 9876543210" />
            <Input label="Parent / Guardian Name" value={formData.parentName} onChange={e => setFormData(p => ({ ...p, parentName: e.target.value }))} placeholder="Parent name" />
            <Input label="Parent Phone" value={formData.parentPhone} onChange={e => setFormData(p => ({ ...p, parentPhone: e.target.value }))} placeholder="Parent contact" />
            <Input label="Current Semester" type="number" min="1" max="16" value={formData.semester} onChange={e => setFormData(p => ({ ...p, semester: parseInt(e.target.value, 10) || 1 }))} />
          </div>

          <div className="flex justify-end pt-3 gap-2.5 border-t border-line/50">
            <Button type="button" variant="subtle" size="sm" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={submitting}>
              {editing ? "Update Profile" : "Save Enrollment"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default StudentsManager;
