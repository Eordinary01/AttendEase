import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Users, Plus, Edit, Search, AlertCircle, Check, Save, GraduationCap } from "lucide-react";
import api from "../../utils/api";
import Modal from "../common/ui/Modal";
import Button from "../common/ui/Button";
import Card from "../common/ui/Card";
import Badge from "../common/ui/Badge";
import PageHeader from "../common/ui/PageHeader";
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
  const [limit] = useState(10);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });

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
      if (!selectedSection) {
        setSections([...new Set(data.map(s => s.section).filter(Boolean))].sort());
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load students");
    } finally {
      setLoading(false);
    }
  }, [page, limit, selectedSection, search]);

  useEffect(() => {
    setPage(1);
  }, [selectedSection, search]);

  useEffect(() => { fetchStudents(); fetchCourses(); }, [fetchStudents, fetchCourses]);

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
        setSuccess("Student updated");
      } else {
        await api.post('/students', formData);
        setSuccess("Student created");
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
    if (pct === undefined || pct === null) return <Badge tone="neutral">—</Badge>;
    const tone = pct >= 75 ? "success" : pct >= 60 ? "warning" : "danger";
    return <Badge tone={tone}>{pct}%</Badge>;
  };

  const columns = [
    { header: "Name", cell: (s) => <span className="font-medium text-ink">{s.name}</span> },
    { header: "Roll No", cell: (s) => <span className="text-ink-soft">{s.rollNo}</span> },
    { header: "Section", cell: (s) => <span className="text-ink-soft">Section {s.section}</span> },
    { header: "Course / Branch", cell: (s) => (
      <span className="text-ink-soft">
        {s.courseName ? s.courseName : "—"}{s.branch ? ` / ${s.branch}` : ""}
      </span>
    ) },
    { header: "Sem", cell: (s) => s.semester ? <Badge tone="primary">Sem {s.semester}</Badge> : <Badge tone="neutral">—</Badge> },
    { header: "Adm Year", cell: (s) => <span className="text-ink-soft">{s.admissionYear || "—"}</span> },
    { header: "Attendance", cell: attendanceBadge },
    ...(canWrite ? [{ header: "", cell: (s) => (
      <Button variant="subtle" size="sm" onClick={() => openEdit(s)} leftIcon={Edit} title="Edit" />
    ) }] : []),
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <PageHeader
        title="Students"
        subtitle="Manage student profiles and view attendance"
        icon={GraduationCap}
        actions={canWrite ? <Button onClick={openCreate} leftIcon={Plus}>Add Student</Button> : null}
      />



      <Card>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-ink-faint" />
            <input
              type="text"
              placeholder="Search by name, roll no or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-line bg-surface text-ink placeholder:text-ink-faint rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            className="w-full px-4 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary appearance-none"
          >
            <option value="">All Sections</option>
            {sections.map(s => <option key={s} value={s}>Section {s}</option>)}
          </select>
        </div>
      </Card>

      {loading ? (
        <Card padding="lg"><Skeleton rows={5} /></Card>
      ) : students.length === 0 ? (
        <EmptyState
          title="No Students Found"
          description="No students match your filters"
          icon={Users}
          action={canWrite ? <Button onClick={openCreate} leftIcon={Plus}>Add Student</Button> : null}
        />
      ) : (
        <Card padding="none" className="overflow-hidden">
          <Table columns={columns} data={students} rowKey="id" pagination={pagination} onPageChange={setPage} />
        </Card>
      )}

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editing ? "Edit Student" : "Add Student"} size="lg" error={error}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Input label="Full Name *" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} required />
            <Input label="Email *" type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} required />
            <Input label="Roll No *" value={formData.rollNo} onChange={e => setFormData(p => ({ ...p, rollNo: e.target.value }))} required />
            <Input label="Section *" value={formData.section} onChange={e => setFormData(p => ({ ...p, section: e.target.value.toUpperCase() }))} required />
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <Select label="Course" value={formData.courseId} onChange={e => handleCourseChange(e.target.value)}>
                <option value="">Select course (optional)</option>
                {courses.map(c => <option key={c._id} value={c._id}>{c.name} ({c.code})</option>)}
              </Select>
            </div>
            <div className="md:col-span-1">
              <Select label="Branch / Stream" value={formData.branch} onChange={e => setFormData(p => ({ ...p, branch: e.target.value }))} disabled={!formData.courseId || branchOptions.length === 0}>
                <option value="">
                  {!formData.courseId ? "Select a course first" : branchOptions.length === 0 ? "No branches defined" : "Select branch (optional)"}
                </option>
                {branchOptions.map((b, i) => (
                  <option key={b._id || b.name + i} value={b.name}>{b.name}{b.totalSemesters ? ` (${b.durationYears} yrs / ${b.totalSemesters} sem)` : ""}</option>
                ))}
              </Select>
            </div>
            <div className="md:col-span-1">
              <Input label="Admission Year" type="number" min="2000" max="2100" value={formData.admissionYear} onChange={e => setFormData(p => ({ ...p, admissionYear: e.target.value }))} />
            </div>
          </div>

          <div className="grid md:grid-cols-4 gap-4">
            <div>
              <Input label="Starting Semester" type="number" min="1" value={formData.semester} onChange={e => setFormData(p => ({ ...p, semester: e.target.value }))} hint="Auto-increments per term" />
            </div>
            <Input label="Phone" value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} />
            <Input label="Parent Name" value={formData.parentName} onChange={e => setFormData(p => ({ ...p, parentName: e.target.value }))} />
            <Input label="Parent Phone" value={formData.parentPhone} onChange={e => setFormData(p => ({ ...p, parentPhone: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" loading={submitting} leftIcon={Save}>{editing ? "Update" : "Create"}</Button>
          </div>
        </form>
      </Modal>
    </motion.div>
  );
};

export default StudentsManager;
