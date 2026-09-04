import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Network,
  Plus,
  Pencil,
  Trash2,
  Save,
  GraduationCap,
  Layers,
  ChevronRight,
  Check,
  AlertCircle,
  TrendingUp,
  UserCheck,
  Calendar,
} from "lucide-react";
import api from "../../utils/api";
import Modal from "../common/ui/Modal";
import Button from "../common/ui/Button";
import Card from "../common/ui/Card";
import Badge from "../common/ui/Badge";
import DashboardHeader from "../common/ui/DashboardHeader";
import Input, { Select } from "../common/ui/Input";
import EmptyState from "../common/ui/EmptyState";
import Skeleton from "../common/ui/Skeleton";
import BulkImportModal from "../common/ui/BulkImportModal";

const emptyBranch = () => ({ name: "", code: "", durationYears: 3, totalSemesters: 6, feeAmount: "" });
const emptyCourseForm = () => ({
  name: "",
  code: "",
  description: "",
  durationYears: 3,
  semestersPerYear: 2,
  branches: [emptyBranch()],
  feeStructure: { enabled: false, totalFee: "", description: "" },
});

const BULK_COURSES_EXAMPLE = [
  {
    name: "Bachelor of Technology",
    code: "BTECH",
    description: "Four-year engineering program",
    durationYears: 4,
    semestersPerYear: 2,
    totalFee: 120000,
    branches: '[{"name":"Computer Science","code":"CSE","durationYears":4,"totalSemesters":8,"feeAmount":120000},{"name":"Civil Engineering","code":"CIVIL","durationYears":4,"totalSemesters":8,"feeAmount":90000}]',
  },
  {
    name: "Bachelor of Medicine & Surgery",
    code: "MBBS",
    description: "Medical program",
    durationYears: 5,
    semestersPerYear: 2,
    totalFee: 250000,
    branches: '[{"name":"MBBS","code":"GEN","durationYears":5,"totalSemesters":10,"feeAmount":250000}]',
  },
];

const BULK_COURSES_COLUMNS = [
  { key: "name", required: true, description: "Program / course name", example: "Course {{i}}" },
  { key: "code", required: true, description: "Unique course code (auto-uppercased)", example: "CRS{{i}}" },
  { key: "description", required: false, description: "Short course description", example: "Bulk-imported course {{i}}" },
  { key: "durationYears", required: false, description: "Default duration in years (used when a branch omits its own)", example: 3 },
  { key: "semestersPerYear", required: false, description: "Fixed to 2 semesters per academic year", example: 2 },
  { key: "totalFee", required: false, description: "Default base course fee (INR)", example: 120000 },
  { key: "branches", required: false, description: 'Optional JSON array of branches: [{"name","code","durationYears","totalSemesters","feeAmount"}]', example: '[{"name":"CSE","code":"CSE","durationYears":4,"totalSemesters":8,"feeAmount":120000}]' },
  { key: "isActive", required: false, description: "true or false (default true)", example: true },
];

const AcademicStructure = () => {
  const [courses, setCourses] = useState([]);
  const [structure, setStructure] = useState({ semestersPerYear: 2, autoPromote: true, academicStartMonth: 5 });
  const [summary, setSummary] = useState({ courses: 0, students: 0, studentBySemester: {} });
  const [preview, setPreview] = useState({ eligible: [], skipped: [], eligibleCount: 0, skippedCount: 0, graduatingCount: 0 });
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showModal, setShowModal] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [form, setForm] = useState(emptyCourseForm());
  const [saving, setSaving] = useState(false);

  const flash = (type, msg) => {
    if (type === "error") setError(msg); else setSuccess(msg);
    setTimeout(() => { if (type === "error") setError(null); else setSuccess(null); }, 4000);
  };

  const loadAll = useCallback(async () => {
    try {
      const [coursesRes, structureRes, previewRes] = await Promise.allSettled([
        api.get("/academic/courses"),
        api.get("/academic/structure"),
        api.get("/academic/promotion-preview"),
      ]);
      if (coursesRes.status === "fulfilled") setCourses(coursesRes.value.data?.data || []);
      if (structureRes.status === "fulfilled") setStructure(structureRes.value.data?.data?.structure || { semestersPerYear: 2, autoPromote: true, academicStartMonth: 5 });
      if (structureRes.status === "fulfilled") setSummary(structureRes.value.data?.data?.summary || { courses: 0, students: 0, studentBySemester: {} });
      if (previewRes.status === "fulfilled") setPreview(previewRes.value.data?.data || { eligible: [], skipped: [], eligibleCount: 0, skippedCount: 0, graduatingCount: 0 });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load academic structure");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const loadPreview = async () => {
    setPreviewLoading(true);
    try {
      const res = await api.get("/academic/promotion-preview");
      setPreview(res.data?.data || preview);
      setSelectedIds(new Set());
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load promotion preview");
    } finally {
      setPreviewLoading(false);
    }
  };

  const openCreate = () => {
    setEditingCourse(null);
    setForm(emptyCourseForm());
    setShowModal(true);
  };

  const openEdit = (course) => {
    setEditingCourse(course);
    setForm({
      name: course.name,
      code: course.code,
      description: course.description || "",
      durationYears: course.durationYears || 3,
      semestersPerYear: 2,
      branches: (course.branches && course.branches.length ? course.branches : [emptyBranch()]).map((b) => ({
        name: b.name,
        code: b.code || "",
        durationYears: b.durationYears || 3,
        totalSemesters: b.totalSemesters || 6,
        feeAmount: b.feeStructure?.totalFee || b.feeAmount || "",
      })),
      feeStructure: {
        enabled: course.feeStructure?.enabled || false,
        totalFee: course.feeStructure?.totalFee || "",
        description: course.feeStructure?.description || "",
      },
    });
    setShowModal(true);
  };

  const updateBranch = (idx, key, value) => {
    setForm((f) => {
      const branches = f.branches.map((b, i) => (i === idx ? { ...b, [key]: value } : b));
      return { ...f, branches };
    });
  };

  const addBranch = () => setForm((f) => ({ ...f, branches: [...f.branches, emptyBranch()] }));
  const removeBranch = (idx) => setForm((f) => ({ ...f, branches: f.branches.filter((_, i) => i !== idx) }));

  const saveCourse = async (e) => {
    e.preventDefault();
    if (!form.name || !form.code) {
      flash("error", "Course name and code are required");
      return;
    }
    const branches = form.branches
      .filter((b) => b.name && b.name.trim())
      .map((b) => ({
        name: b.name.trim(),
        code: (b.code || "").trim(),
        durationYears: parseInt(b.durationYears, 10) || 3,
        totalSemesters: parseInt(b.totalSemesters, 10) || 6,
        feeAmount: parseFloat(b.feeAmount) || 0,
        feeStructure: parseFloat(b.feeAmount) > 0 ? {
          enabled: true,
          totalFee: parseFloat(b.feeAmount) || 0,
          description: `Branch tuition fee for ${b.name.trim()}`
        } : undefined,
      }));
    const feeStructure = {
      enabled: !!form.feeStructure.enabled,
      totalFee: parseFloat(form.feeStructure.totalFee) || 0,
      description: form.feeStructure.description || "",
    };
    setSaving(true);
    try {
      if (editingCourse) {
        await api.put(`/academic/courses/${editingCourse._id}`, { ...form, name: form.name.trim(), code: form.code.trim().toUpperCase(), branches, feeStructure });
        flash("success", "Course updated");
      } else {
        await api.post("/academic/courses", { ...form, name: form.name.trim(), code: form.code.trim().toUpperCase(), branches, feeStructure });
        flash("success", "Course created");
      }
      setShowModal(false);
      loadAll();
    } catch (err) {
      flash("error", err.response?.data?.message || "Failed to save course");
    } finally {
      setSaving(false);
    }
  };

  const deleteCourse = async (course) => {
    if (!window.confirm(`Delete course "${course.name}"? This action cannot be undone.`)) return;
    try {
      await api.delete(`/academic/courses/${course._id}`);
      flash("success", "Course deleted successfully");
      loadAll();
    } catch (err) {
      const data = err.response?.data;
      if (data?.canForce) {
        const confirmForce = window.confirm(
          `Course "${course.name}" is linked to ${data.linkedStudents || 0} student(s) and ${data.linkedSubjects || 0} subject(s).\n\nDo you want to unassign these records and force delete this course?`
        );
        if (confirmForce) {
          try {
            await api.delete(`/academic/courses/${course._id}?force=true`);
            flash("success", "Course deleted and linked records unassigned");
            loadAll();
            return;
          } catch (forceErr) {
            flash("error", forceErr.response?.data?.message || "Failed to force delete course");
            return;
          }
        }
      }
      flash("error", data?.message || "Failed to delete course");
    }
  };

  const saveStructure = async () => {
    try {
      const res = await api.put("/academic/structure", {
        semestersPerYear: structure.semestersPerYear,
        autoPromote: structure.autoPromote,
        academicStartMonth: structure.academicStartMonth,
      });
      setStructure(res.data?.data?.structure || structure);
      flash("success", "Semester rules updated");
      loadAll();
    } catch (err) {
      flash("error", err.response?.data?.message || "Failed to update semester rules");
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => (prev.size === preview.eligible.length ? new Set() : new Set(preview.eligible.map((s) => s._id))));
  };

  const promote = async () => {
    if (preview.eligibleCount === 0) return;
    const studentIds = selectedIds.size > 0 ? Array.from(selectedIds) : undefined;
    const scope = studentIds ? "selected" : "all";
    if (!window.confirm(`Promote ${scope === "all" ? `${preview.eligibleCount} student(s)` : `${selectedIds.size} selected student(s)`} to the next semester?`)) return;
    setPromoting(true);
    try {
      const res = await api.post("/academic/promote", { studentIds });
      flash("success", res.data?.message || "Promotion complete");
      await Promise.all([loadAll(), loadPreview()]);
    } catch (err) {
      flash("error", err.response?.data?.message || "Failed to promote students");
    } finally {
      setPromoting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <DashboardHeader greeting="Curricular Architecture & Promotion Engine" meta="Courses, branches & semester management" />
        <Card padding="lg" bordered><Skeleton rows={6} /></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DashboardHeader
        greeting="Curricular Architecture & Promotion Engine"
        meta={`Degree programs, branch streams, semester boundaries, and auto-increment terms (${courses.length} courses registered)`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="subtle" size="sm" onClick={() => setShowBulkImport(true)} leftIcon={Layers}>Bulk Import</Button>
            <Button variant="primary" size="sm" onClick={openCreate} leftIcon={Plus}>Add Program</Button>
          </div>
        }
      />

      {error && <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2 text-rose-600 text-xs font-semibold"><AlertCircle className="w-4 h-4" />{error}</div>}
      {success && <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-emerald-600 text-xs font-semibold"><Check className="w-4 h-4" />{success}</div>}

      {/* Semester rules */}
      <Card title="Semester Rules" icon={GraduationCap}>
        <p className="text-sm text-ink-soft mb-4">
          By default one academic year equals <b>2 semesters</b>. You can switch to an annual (1 semester per year) system — this is available from the <b>Basic plan</b> upward.
        </p>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm font-semibold text-ink mb-1.5">Semesters per year</p>
            <Select value={structure.semestersPerYear} onChange={(e) => setStructure((s) => ({ ...s, semestersPerYear: Number(e.target.value) }))}>
              <option value={2}>2 (half-yearly terms)</option>
              <option value={1}>1 (annual term)</option>
            </Select>
          </div>
          <div>
            <p className="text-sm font-semibold text-ink mb-1.5">Academic start month</p>
            <Select value={structure.academicStartMonth} onChange={(e) => setStructure((s) => ({ ...s, academicStartMonth: Number(e.target.value) }))}>
              {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((m, i) => (
                <option key={m} value={i}>{m}</option>
              ))}
            </Select>
          </div>
          <div>
            <p className="text-sm font-semibold text-ink mb-1.5">Auto promote</p>
            <label className="flex items-center gap-2 cursor-pointer mt-2.5">
              <input type="checkbox" checked={structure.autoPromote} onChange={(e) => setStructure((s) => ({ ...s, autoPromote: e.target.checked }))} className="w-4 h-4 accent-primary" />
              <span className="text-sm text-ink-soft">Automatically compute eligibility based on admission year</span>
            </label>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={saveStructure} leftIcon={Save}>Save Rules</Button>
        </div>
        {Object.keys(summary.studentBySemester || {}).length > 0 && (
          <div className="mt-5 pt-4 border-t border-line">
            <p className="text-sm font-semibold text-ink mb-2">Students by semester</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(summary.studentBySemester).sort((a, b) => Number(a[0]) - Number(b[0])).map(([sem, count]) => (
                <Badge key={sem} tone="neutral">Sem {sem}: {count}</Badge>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Semester Timeline Preview */}
      <Card title="Semester Timeline" icon={Calendar}>
        <p className="text-sm text-ink-soft mb-4">
          {structure.semestersPerYear === 2
            ? <>Odd semesters start in <b>{["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][structure.academicStartMonth]}</b>, even semesters start 6 months later.</>
            : <>One semester per year, starting in <b>{["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][structure.academicStartMonth]}</b>.</>
          }
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(() => {
            const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
            const semPerYear = structure.semestersPerYear;
            const startMonth = structure.academicStartMonth;
            const monthsPerSem = 12 / semPerYear;
            const now = new Date();
            const currentMonth = now.getMonth();
            const items = [];
            // Show first 8 semesters or however many the max course has
            const maxSems = Math.max(8, ...courses.map(c => (c.durationYears || 3) * (c.semestersPerYear || 2)));
            for (let sem = 1; sem <= maxSems; sem++) {
              const semIdx = sem - 1;
              const offsetInYear = semIdx % semPerYear;
              const yearOffset = Math.floor(semIdx / semPerYear);
              const semStartMonth = (startMonth + offsetInYear * monthsPerSem) % 12;
              const semStartYear = now.getFullYear() + Math.floor((startMonth + offsetInYear * monthsPerSem) / 12) + yearOffset;
              const semEndMonth = (semStartMonth + monthsPerSem - 1) % 12;
              const isCurrentSem = currentMonth >= semStartMonth && currentMonth <= semEndMonth && now.getFullYear() === semStartYear;
              items.push(
                <div key={sem} className={`p-3 rounded-xl border text-sm ${isCurrentSem ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-line bg-background/40'}`}>
                  <p className={`font-semibold ${isCurrentSem ? 'text-primary' : 'text-ink'}`}>Sem {sem}</p>
                  <p className="text-xs text-ink-faint">{months[semStartMonth]} {semStartYear} – {months[semEndMonth]} {semEndMonth < semStartMonth ? semEndMonth + 12 === 11 && semStartMonth === 0 ? semStartYear : semStartYear + 1 : semStartYear}</p>
                </div>
              );
            }
            return items;
          })()}
        </div>
      </Card>

      {/* Courses */}
      <Card title="Courses & Branches" icon={Layers} titleRight={<Badge tone="primary">{courses.length} course(s)</Badge>}>
        {courses.length === 0 ? (
          <EmptyState
            title="No Courses Defined"
            description="Add programs like BTech, MBBS, BA, LLB — each with its branches and semester counts."
            icon={Network}
            action={<Button onClick={openCreate} leftIcon={Plus}>Add Course</Button>}
          />
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {courses.map((course) => {
              const totalBranches = (course.branches || []).filter((b) => b.isActive !== false).length;
              return (
                <div key={course._id} className="border border-line rounded-xl p-4 bg-background/40">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-ink">{course.name}</h3>
                        <Badge tone="neutral">{course.code}</Badge>
                      </div>
                      <p className="text-xs text-ink-faint mt-1">
                        {course.durationYears} yrs • {course.semestersPerYear} sem/yr{totalBranches > 0 ? ` • ${totalBranches} branch(es)` : ""}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => openEdit(course)} className="p-2 text-ink-soft hover:text-primary hover:bg-primary-soft rounded-lg transition-colors" title="Edit">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteCourse(course)} className="p-2 text-ink-soft hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete Course">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {totalBranches > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {course.branches.filter((b) => b.isActive !== false).map((b) => (
                        <div key={b._id || b.name} className="flex items-center gap-2 text-sm text-ink-soft bg-surface border border-line rounded-lg px-3 py-2">
                          <ChevronRight className="w-3.5 h-3.5 text-ink-faint" />
                          <span className="font-medium text-ink">{b.name}</span>
                          {b.code && <Badge tone="neutral">{b.code}</Badge>}
                          <span className="ml-auto text-xs text-ink-faint">{b.durationYears} yrs = {b.totalSemesters} sem</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Promotion */}
      <Card
        title="Semester Promotion"
        icon={TrendingUp}
        titleRight={<Badge tone="info">Auto-increment</Badge>}
        actions={
          preview.eligibleCount > 0 && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={toggleSelectAll}>
                {selectedIds.size === preview.eligible.length ? "Deselect All" : "Select All"}
              </Button>
              <Button size="sm" leftIcon={UserCheck} loading={promoting} onClick={promote}>
                Promote {selectedIds.size > 0 ? `${selectedIds.size} selected` : "All Eligible"}
              </Button>
            </div>
          )
        }
      >
        <p className="text-sm text-ink-soft mb-4">
          Students advance one semester per term, computed from their admission year and your semester rules. Students at their program&apos;s final semester are automatically graduated instead.
        </p>

        {previewLoading ? (
          <Skeleton rows={3} />
        ) : preview.eligibleCount === 0 && preview.skippedCount === 0 ? (
          <p className="text-sm text-ink-soft">No students yet — add students with an admission year to enable auto-increment.</p>
        ) : (
          <>
            {preview.eligibleCount > 0 && (
              <div className="mb-4 overflow-hidden border border-line rounded-xl">
                <table className="w-full text-sm">
                  <thead className="bg-background/70 text-left text-xs uppercase tracking-wider text-ink-faint">
                    <tr>
                      <th className="px-3 py-2 w-10"></th>
                      <th className="px-3 py-2">Student</th>
                      <th className="px-3 py-2">Roll No</th>
                      <th className="px-3 py-2">Section</th>
                      <th className="px-3 py-2">Course / Branch</th>
                      <th className="px-3 py-2">Semester</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {preview.eligible.map((s) => (
                      <tr key={s._id} className="bg-surface">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(s._id)}
                            onChange={() => toggleSelect(s._id)}
                            className="w-4 h-4 accent-primary"
                          />
                        </td>
                        <td className="px-3 py-2 font-medium text-ink">{s.name}</td>
                        <td className="px-3 py-2 text-ink-soft">{s.rollNo}</td>
                        <td className="px-3 py-2 text-ink-soft">Section {s.section}</td>
                        <td className="px-3 py-2 text-ink-soft">
                          {s.courseName || "—"}{s.branch ? ` / ${s.branch}` : ""}
                        </td>
                        <td className="px-3 py-2 text-ink-soft">
                          <span className="font-semibold text-ink">{s.semester}</span>
                          <ChevronRight className="inline w-3.5 h-3.5 mx-1 text-ink-faint" />
                          <span className="font-semibold text-primary">{s.nextSemester}</span>
                        </td>
                        <td className="px-3 py-2">
                          {s.willGraduate ? <Badge tone="success">Graduating</Badge> : <Badge tone="info">Promoting</Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {preview.skippedCount > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer text-ink-soft font-medium">
                  {preview.skippedCount} student(s) not due ({preview.graduatingCount} graduating at cap)
                </summary>
                <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                  {preview.skipped.map((s) => (
                    <p key={s._id} className="text-xs text-ink-soft">
                      • <span className="text-ink font-medium">{s.name}</span> ({s.rollNo}) — Sem {s.semester} — {s.reason}
                    </p>
                  ))}
                </div>
              </details>
            )}
          </>
        )}
      </Card>

      {/* Course modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingCourse ? "Edit Course" : "Add Course"}
        subtitle="Define the program and its branch term structures"
        size="lg"
        error={error}
      >
        <form onSubmit={saveCourse} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Input label="Course Name *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Bachelor of Technology" required />
            <Input label="Course Code *" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="BTECH" required />
            <Input label="Default Duration (years)" type="number" min="1" value={form.durationYears} onChange={(e) => setForm((f) => ({ ...f, durationYears: e.target.value }))} />
            <Input label="Semesters per Year" value="2 (Fixed per Academic Rules)" disabled readOnly className="bg-background cursor-not-allowed opacity-75" />
          </div>
          <Input label="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional program description" />

          <div className="border border-line rounded-xl p-4 bg-background/40">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-ink">Course Default Fee Structure</p>
                <p className="text-xs text-ink-faint">Base tuition fees for this program (can be overridden per branch below)</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={form.feeStructure.enabled} onChange={(e) => setForm((f) => ({ ...f, feeStructure: { ...f.feeStructure, enabled: e.target.checked } }))} className="sr-only peer" />
                <div className="w-9 h-5 bg-line rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
              </label>
            </div>
            {form.feeStructure.enabled && (
              <div className="grid md:grid-cols-2 gap-4">
                <Input label="Default Course Fee (INR)" type="number" min="0" step="0.01" value={form.feeStructure.totalFee} onChange={(e) => setForm((f) => ({ ...f, feeStructure: { ...f.feeStructure, totalFee: e.target.value } }))} placeholder="e.g. 120000" required />
                <div className="md:col-span-2">
                  <Input label="Fee Description" value={form.feeStructure.description} onChange={(e) => setForm((f) => ({ ...f, feeStructure: { ...f.feeStructure, description: e.target.value } }))} placeholder="e.g. Base tuition fee for program" />
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-ink">Branches & Branch-Specific Fees</p>
              <Button type="button" variant="outline" size="sm" onClick={addBranch} leftIcon={Plus}>Add Branch</Button>
            </div>
            {form.branches.map((b, idx) => (
              <div key={idx} className="grid grid-cols-2 md:grid-cols-12 gap-3 mb-3 items-end p-3 border border-line rounded-xl bg-background/40">
                <div className="md:col-span-3">
                  <Input label="Branch name" value={b.name} onChange={(e) => updateBranch(idx, "name", e.target.value)} placeholder="Computer Science" />
                </div>
                <div className="md:col-span-2">
                  <Input label="Code" value={b.code} onChange={(e) => updateBranch(idx, "code", e.target.value.toUpperCase())} placeholder="CSE" />
                </div>
                <div className="md:col-span-2">
                  <Input label="Years" type="number" min="1" value={b.durationYears} onChange={(e) => updateBranch(idx, "durationYears", e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <Input label="Total Sem" type="number" min="1" value={b.totalSemesters} onChange={(e) => updateBranch(idx, "totalSemesters", e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <Input label="Branch Fee (INR)" type="number" min="0" value={b.feeAmount || ""} onChange={(e) => updateBranch(idx, "feeAmount", e.target.value)} placeholder="Branch fee" hint="Overrides base fee" />
                </div>
                <div className="md:col-span-1 flex justify-end pb-1">
                  <button type="button" onClick={() => removeBranch(idx)} className="p-2 text-ink-faint hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Remove branch">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            <p className="text-xs text-ink-faint">Example: BTech → CSE (4 yrs / 8 sem), ECE (4 yrs / 8 sem); MBBS → 5.5 yrs / 11 sem; BA → 3 yrs / 6 sem.</p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={saving} leftIcon={Save}>{editingCourse ? "Update Course" : "Create Course"}</Button>
          </div>
        </form>
      </Modal>

      {/* Bulk import courses */}
      <BulkImportModal
        isOpen={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        endpoint="/academic/courses/bulk"
        bodyKey="courses"
        itemLabel="courses"
        example={BULK_COURSES_EXAMPLE}
        columns={BULK_COURSES_COLUMNS}
        exportData={courses.map((c) => ({
          name: c.name,
          code: c.code,
          description: c.description || "",
          durationYears: c.durationYears,
          semestersPerYear: 2,
          totalFee: c.feeStructure?.totalFee || 0,
          branches: JSON.stringify((c.branches || []).filter((b) => b.isActive !== false).map((b) => ({
            name: b.name,
            code: b.code,
            durationYears: b.durationYears,
            totalSemesters: b.totalSemesters,
            feeAmount: b.feeStructure?.totalFee || b.feeAmount || 0,
          }))),
        }))}
        onImported={() => {
          setShowBulkImport(false);
          loadAll();
        }}
      />
    </div>
  );
};

export default AcademicStructure;
