// src/components/Admin/ManageSubjects.jsx
import React, { useState, useEffect, useMemo } from "react";
import {
  Users,
  BookOpen,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Eye,
  Check,
  X,
  Calendar,
  Award,
  Code,
  Layers,
  ChevronDown,
  Download,
  Upload,
  Building2,
  AlertCircle,
  Loader2,
  GraduationCap
} from "lucide-react";
import { motion } from "framer-motion";
import Card from "../common/ui/Card";
import Modal from "../common/ui/Modal";
import Button from "../common/ui/Button";
import Badge from "../common/ui/Badge";
import Input, { Select, Textarea } from "../common/ui/Input";
import EmptyState from "../common/ui/EmptyState";
import PageHeader from "../common/ui/PageHeader";
import SubjectCard from "../Subjects/SubjectsCard";
import PricingModal from "../common/PricingModal";
import { useUpgradeModal } from "../../utils/billing";
import api from "../../utils/api";
import { logError } from "../../utils/logger";
import { isBranchMatch } from "../../utils/branchHelper";
import { useTheme } from '../../contexts/ThemeContexts';
import { useToast } from '../../contexts/ToastContext';

import BulkImportModal from "../common/ui/BulkImportModal";
import Pagination from "../common/ui/Pagination";

const BULK_SUBJECTS_EXAMPLE = `[
  {
    "subjectCode": "CS101",
    "subjectName": "Computer Science Fundamentals",
    "semester": "1",
    "credits": 4,
    "description": "Introduction to programming and CS concepts",
    "courseCode": "BTECH"
  },
  {
    "subjectCode": "MATH201",
    "subjectName": "Discrete Mathematics",
    "semester": "2",
    "credits": 3,
    "description": "Mathematical structures for computer science",
    "courseCode": "BTECH",
    "isActive": true
  }
]`;

const BULK_SUBJECTS_COLUMNS = [
  { key: "subjectCode", label: "Subject Code", required: true, description: "Unique short code, e.g. CS101", example: "CS101" },
  { key: "subjectName", label: "Subject Name", required: true, description: "Full subject title", example: "Computer Science Fundamentals" },
  { key: "semester", label: "Semester", required: true, description: "Semester / term number", example: 1 },
  { key: "credits", label: "Credits", required: false, description: "Number of credits (default 4)", example: 4 },
  { key: "description", label: "Description", required: false, description: "Short subject summary", example: "Introduction to programming" },
  { key: "courseCode", label: "Course Code", required: false, description: "Must match a course created in Academic Structure (e.g. BTECH)", example: "BTECH" },
  { key: "courseId", label: "Course Id", required: false, description: "Course _id from Academic Structure", example: "" },
  { key: "branch", label: "Branch", required: false, description: "Branch / stream name", example: "CSE" },
  { key: "isActive", label: "Is Active", required: false, description: "true or false (default true)", example: true },
];

const ManageSubjects = () => {
  const { colors } = useTheme();
  const { success: toastSuccess, error: toastError } = useToast();
  const [subjects, setSubjects] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCourse, setFilterCourse] = useState("");
  const [filterBranch, setFilterBranch] = useState("");
  const [filterSemester, setFilterSemester] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);
  const [tenantInfo, setTenantInfo] = useState(null);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'

  const { modalProps, openUpgradeForError } = useUpgradeModal();

  const [formData, setFormData] = useState({
    subjectCode: "",
    subjectName: "",
    semester: "",
    description: "",
    credits: "4",
    courseCode: "",
    courseId: "",
    branch: "",
  });

  const [courses, setCourses] = useState([]);



  // Theme colors
  const themeColors = {
    primary: colors?.primary || '#6366f1',
    secondary: colors?.secondary || '#8b5cf6',
    light: colors?.primary ? `${colors.primary}20` : '#eef2ff',
  };

  useEffect(() => {
    fetchTenantInfo();
    fetchSubjects();
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const res = await api.get("/academic/courses");
      setCourses(res.data?.data || []);
    } catch (err) {
      /* courses may not be configured — ignore */
    }
  };


  // Clear messages after 5 seconds
  useEffect(() => {
    if (error || successMessage) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccessMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, successMessage]);

  const fetchTenantInfo = async () => {
    try {
      const response = await api.get('/auth/tenant-info');
      if (response.data.success) {
        setTenantInfo(response.data.data?.tenant);
      }
    } catch (error) {
      logError("Fetch Tenant Info", error);
    }
  };

  const fetchSubjects = async () => {
    try {
      setLoading(true);
      let subjectsList = [];
      try {
        const response = await api.get('/admin/subjects');
        subjectsList = response.data.data || [];
      } catch (err) {
        // Teachers with subjects:write don't have admin access — use their subject view.
        const fallback = await api.get('/subjects/all');
        subjectsList = (fallback.data?.allActiveSubjects || []).map(s => ({
          _id: s.id,
          subjectCode: s.subjectCode,
          subjectName: s.subjectName,
          semester: s.semester,
          isActive: true,
        }));
      }
      setSubjects(subjectsList);
    } catch (error) {
      logError("Fetch Subjects", error);
      if (!openUpgradeForError(error)) {
        setError(error.response?.data?.message || "Failed to fetch subjects");
      }
    } finally {
      setLoading(false);
    }
  };

  const availableSemesters = useMemo(() => {
    const semSet = new Set();
    const scopedSubjects = subjects.filter(s => {
      if (filterCourse && String(s.courseCode || "").toUpperCase() !== filterCourse.toUpperCase() && String(s.courseId || "") !== filterCourse) return false;
      if (filterBranch && !isBranchMatch(s.branch, filterBranch, courses, { excludeUnassigned: true })) return false;
      return true;
    });

    scopedSubjects.forEach((s) => {
      if (s.semester) {
        semSet.add(String(s.semester).trim());
      }
    });

    const courseObj = filterCourse
      ? courses.find(c => String(c.code || "").toUpperCase() === filterCourse.toUpperCase() || String(c._id) === filterCourse)
      : null;
    const courseList = courseObj ? [courseObj] : courses;
    courseList.forEach((c) => {
      let maxSemForCourse = (c.durationYears || 4) * (c.semestersPerYear || 2);
      if (Array.isArray(c.branches)) {
        c.branches.forEach((b) => {
          if (b.totalSemesters) maxSemForCourse = Math.max(maxSemForCourse, b.totalSemesters);
        });
      }
      for (let i = 1; i <= maxSemForCourse; i++) {
        semSet.add(String(i));
      }
    });

    if (semSet.size === 0) {
      for (let i = 1; i <= 8; i++) {
        semSet.add(String(i));
      }
    }

    return Array.from(semSet).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ""), 10);
      const numB = parseInt(b.replace(/\D/g, ""), 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });
  }, [subjects, courses, filterCourse, filterBranch]);

  const availableCourseCodes = useMemo(() => {
    const codes = new Set();
    courses.forEach((c) => {
      if (c.code) codes.add(c.code);
    });
    subjects.forEach((s) => {
      if (s.courseCode) codes.add(s.courseCode);
    });
    return Array.from(codes).sort();
  }, [courses, subjects]);

  const availableYears = useMemo(() => {
    const years = new Set();
    const scopedSubjects = subjects.filter(s => {
      if (filterCourse && String(s.courseCode || "").toUpperCase() !== filterCourse.toUpperCase() && String(s.courseId || "") !== filterCourse) return false;
      if (filterBranch && !isBranchMatch(s.branch, filterBranch, courses, { excludeUnassigned: true })) return false;
      return true;
    });

    scopedSubjects.forEach((s) => {
      const semNum = parseInt(String(s.semester || "").replace(/\D/g, ""), 10);
      const year = s.year || (!isNaN(semNum) && semNum > 0 ? Math.ceil(semNum / 2) : null);
      if (year) years.add(year);
    });

    const courseObj = filterCourse
      ? courses.find(c => String(c.code || "").toUpperCase() === filterCourse.toUpperCase() || String(c._id) === filterCourse)
      : null;
    const courseList = courseObj ? [courseObj] : courses;
    courseList.forEach((c) => {
      let maxYears = c.durationYears || 4;
      if (Array.isArray(c.branches)) {
        c.branches.forEach((b) => {
          if (b.durationYears) maxYears = Math.max(maxYears, b.durationYears);
          if (b.totalSemesters) maxYears = Math.max(maxYears, Math.ceil(b.totalSemesters / 2));
        });
      }
      for (let i = 1; i <= maxYears; i++) {
        years.add(i);
      }
    });

    if (years.size === 0) {
      for (let i = 1; i <= 4; i++) {
        years.add(i);
      }
    }

    return Array.from(years).sort((a, b) => a - b);
  }, [subjects, courses, filterCourse, filterBranch]);

  const subjectBranches = useMemo(() => {
    if (!formData.courseId) return [];
    const selectedCourseObj = courses.find(c => String(c._id) === String(formData.courseId));
    if (!selectedCourseObj || !Array.isArray(selectedCourseObj.branches)) return [];
    return selectedCourseObj.branches.filter(b => b.isActive !== false);
  }, [formData.courseId, courses]);

  const availableBranches = useMemo(() => {
    const set = new Set();
    const courseObj = filterCourse
      ? courses.find(c => String(c.code || "").toUpperCase() === filterCourse.toUpperCase() || String(c._id) === filterCourse)
      : null;
    if (courseObj && Array.isArray(courseObj.branches)) {
      courseObj.branches.filter(b => b.isActive !== false).forEach(b => b.code && set.add(b.code));
    } else {
      subjects.forEach(s => s.branch && set.add(s.branch));
      courses.forEach(c => Array.isArray(c.branches) && c.branches.forEach(b => b.code && set.add(b.code)));
    }
    return Array.from(set).sort();
  }, [subjects, courses, filterCourse]);

  const handleCourseChange = (cid) => {
    const selectedCourseObj = courses.find(c => String(c._id) === String(cid));
    const activeBranches = selectedCourseObj?.branches?.filter(b => b.isActive !== false) || [];
    setFormData(prev => ({
      ...prev,
      courseId: cid,
      courseCode: selectedCourseObj ? selectedCourseObj.code : "",
      branch: activeBranches.length > 0 ? activeBranches[0].code : "",
    }));
  };

  const filteredSubjects = useMemo(() => {
    let filtered = [...subjects];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(s =>
        s.subjectName?.toLowerCase().includes(term) ||
        s.subjectCode?.toLowerCase().includes(term) ||
        s.courseCode?.toLowerCase().includes(term) ||
        s.branch?.toLowerCase().includes(term) ||
        String(s.semester || "")?.toLowerCase().includes(term)
      );
    }

    if (filterCourse) {
      filtered = filtered.filter(s =>
        String(s.courseCode || "").toUpperCase() === filterCourse.toUpperCase() ||
        String(s.courseId || "") === filterCourse
      );
    }

    if (filterBranch) {
      filtered = filtered.filter(s => isBranchMatch(s.branch, filterBranch, courses, { excludeUnassigned: true }));
    }

    if (filterSemester) {
      filtered = filtered.filter(s => String(s.semester) === String(filterSemester));
    }

    if (filterYear) {
      filtered = filtered.filter(s => {
        const semNum = parseInt(String(s.semester || "").replace(/\D/g, ""), 10);
        const year = s.year || (!isNaN(semNum) && semNum > 0 ? Math.ceil(semNum / 2) : null);
        return Number(year) === Number(filterYear);
      });
    }

    return filtered;
  }, [subjects, courses, searchTerm, filterCourse, filterBranch, filterSemester, filterYear]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, filterCourse, filterBranch, filterSemester, filterYear]);

  useEffect(() => {
    if (filterBranch && availableBranches.length > 0 && !availableBranches.includes(filterBranch)) {
      setFilterBranch("");
    }
  }, [filterCourse, filterBranch, availableBranches]);

  useEffect(() => {
    if (filterSemester && availableSemesters.length > 0 && !availableSemesters.includes(filterSemester)) {
      setFilterSemester("");
    }
    if (filterYear && availableYears.length > 0 && !availableYears.includes(Number(filterYear))) {
      setFilterYear("");
    }
  }, [filterCourse, filterBranch, filterSemester, filterYear, availableSemesters, availableYears]);

  const paginationInfo = useMemo(() => ({
    page,
    limit: pageSize,
    total: filteredSubjects.length,
    pages: Math.ceil(filteredSubjects.length / pageSize) || 1
  }), [page, pageSize, filteredSubjects.length]);

  const paginatedSubjects = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredSubjects.slice(start, start + pageSize);
  }, [filteredSubjects, page, pageSize]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.subjectCode || !formData.subjectName || !formData.semester) {
      const msg = "Please fill all required fields";
      setError(msg);
      toastError(msg);
      return;
    }

    const tempId = Date.now();
    const optimisticSubject = {
      _id: tempId,
      ...formData,
      optimistic: true,
      createdAt: new Date().toISOString(),
      isActive: true,
    };

    setSubjects(prev => [optimisticSubject, ...prev]);
    setShowForm(false);
    setSubmitting(true);
    setError(null);

    try {
      const response = await api.post('/subjects/create', formData);

      if (response.data.success) {
        // Replace optimistic with real data
        const newSubject = response.data.subject;
        setSubjects(prev =>
          prev.map(s =>
            s._id === tempId ? { ...newSubject, optimistic: false } : s
          )
        );
        const msg = "Subject created successfully!";
        setSuccessMessage(msg);
        toastSuccess(msg);

        // Reset form
        setFormData({
          subjectCode: "",
          subjectName: "",
          semester: "",
          description: "",
          credits: "4",
          courseCode: "",
          courseId: "",
          branch: "",
        });
      }
    } catch (err) {
      setSubjects(prev => prev.filter(s => s._id !== tempId));
      if (!openUpgradeForError(err)) {
        const msg = err.response?.data?.message || "Failed to create subject";
        setError(msg);
        toastError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (subjectId) => {
    if (!window.confirm("Are you sure you want to delete this subject?")) return;

    try {
      const response = await api.delete(`/subjects/${subjectId}`);

      if (response.data.success) {
        setSubjects(prev => prev.filter(s => s._id !== subjectId));
        const msg = "Subject deleted successfully!";
        setSuccessMessage(msg);
        toastSuccess(msg);
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to delete subject";
      setError(msg);
      toastError(msg);
      setTimeout(() => setError(null), 3000);
    }
  };

  const viewSubjectDetails = (subject) => {
    setSelectedSubject(subject);
    setShowDetails(true);
  };

  const getTeacherCount = (subject) => {
    return subject.assignments?.length || 0;
  };

  // Export subjects as CSV
  const exportSubjects = () => {
    const headers = ['Subject Code', 'Subject Name', 'Semester', 'Credits', 'Course Code', 'Status', 'Teachers'];
    const rows = filteredSubjects.map(s => [
      s.subjectCode,
      s.subjectName,
      s.semester,
      s.credits || 0,
      s.courseCode || '',
      s.isActive ? 'Active' : 'Inactive',
      getTeacherCount(s)
    ]);

    const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subjects_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manage Subjects"
        subtitle={`${filteredSubjects.length} subject${filteredSubjects.length !== 1 ? 's' : ''} found`}
        icon={BookOpen}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {tenantInfo && (
              <span
                className="px-3 py-1.5 rounded-full text-sm flex items-center gap-1 text-white"
                style={{ backgroundColor: themeColors.primary }}
              >
                <Building2 className="w-3 h-3" />
                {tenantInfo.name}
              </span>
            )}
            {/* View Toggle */}
            <div className="flex bg-surface rounded-lg shadow-sm p-1 border border-line">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded transition ${viewMode === 'grid'
                  ? 'text-white'
                  : 'text-ink-soft hover:bg-background'
                  }`}
                style={viewMode === 'grid' ? { backgroundColor: themeColors.primary } : {}}
                aria-label="Grid view"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded transition ${viewMode === 'list'
                  ? 'text-white'
                  : 'text-ink-soft hover:bg-background'
                  }`}
                style={viewMode === 'list' ? { backgroundColor: themeColors.primary } : {}}
                aria-label="List view"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
            <Button
              variant="outline"
              leftIcon={Upload}
              onClick={() => setShowBulkModal(true)}
            >
              Bulk Operations
            </Button>
            <Button
              variant="outline"
              leftIcon={Download}
              onClick={exportSubjects}
            >
              Export
            </Button>
            <Button
              leftIcon={Plus}
              onClick={() => setShowForm(true)}
              style={{
                background: `linear-gradient(135deg, ${themeColors.primary}, ${themeColors.secondary})`
              }}
            >
              Add Subject
            </Button>
          </div>
        }
      />

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-600 flex items-center gap-2">
          <Check className="w-5 h-5 flex-shrink-0" />
          {successMessage}
        </div>
      )}

      {/* Filters */}
      <Card>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-ink-faint" />
            <input
              type="text"
              placeholder="Search by name, code or course..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-line bg-surface text-ink placeholder:text-ink-faint rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm"
            />
          </div>

          <div className="relative">
            <GraduationCap className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-ink-faint" />
            <select
              value={filterCourse}
              onChange={(e) => setFilterCourse(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary appearance-none text-sm"
            >
              <option value="">All Courses</option>
              {availableCourseCodes.map(code => (
                <option key={code} value={code}>Course: {code}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-ink-faint" />
            <select
              value={filterBranch}
              onChange={(e) => setFilterBranch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary appearance-none text-sm"
            >
              <option value="">All Branches</option>
              {availableBranches.map(b => {
                let branchName = "";
                for (const c of courses) {
                  if (Array.isArray(c.branches)) {
                    const found = c.branches.find(bc => bc.code === b);
                    if (found) { branchName = found.name; break; }
                  }
                }
                return <option key={b} value={b}>{b}{branchName ? ` — ${branchName}` : ""}</option>;
              })}
            </select>
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-ink-faint" />
            <select
              value={filterSemester}
              onChange={(e) => setFilterSemester(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary appearance-none text-sm"
            >
              <option value="">All Semesters</option>
              {availableSemesters.map(s => (
                <option key={s} value={s}>Semester {s}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary appearance-none text-sm"
            >
              <option value="">All Years</option>
              {availableYears.map(y => (
                <option key={y} value={y}>Year {y}</option>
              ))}
            </select>
            {(searchTerm || filterCourse || filterBranch || filterSemester || filterYear) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchTerm("");
                  setFilterCourse("");
                  setFilterBranch("");
                  setFilterSemester("");
                  setFilterYear("");
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Subjects Grid/List */}
      {loading ? (
        <div className="grid md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <div className="h-6 bg-background rounded w-3/4 mb-4 animate-pulse"></div>
              <div className="h-4 bg-background rounded w-1/2 mb-2 animate-pulse"></div>
              <div className="h-4 bg-background rounded w-full mb-4 animate-pulse"></div>
              <div className="h-8 bg-background rounded w-1/3 animate-pulse"></div>
            </Card>
          ))}
        </div>
      ) : filteredSubjects.length === 0 ? (
        <EmptyState
          title="No Subjects Found"
          description={searchTerm || filterSemester
            ? "Try adjusting your filters"
            : "Get started by adding your first subject"}
          icon={BookOpen}
        />
      ) : (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
          }}
          className={viewMode === 'grid' ? 'grid md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}
        >
          {paginatedSubjects.map((subject, index) => (
            <motion.div
              key={subject._id}
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 }
              }}
            >
              <SubjectCard
                subject={subject}
                role="admin"
                viewMode={viewMode}
              />
            </motion.div>
          ))}
        </motion.div>
      )}

      <Pagination pagination={paginationInfo} onPageChange={setPage} />

      {/* Add Subject Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          setError(null);
        }}
        title="Add New Subject"
        size="lg"
        error={error}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <Select
              label="Course (optional)"
              name="courseId"
              value={formData.courseId}
              onChange={(e) => handleCourseChange(e.target.value)}
            >
              <option value="">No course / generic</option>
              {courses.map((c) => (
                <option key={c._id} value={c._id}>{c.name} ({c.code})</option>
              ))}
            </Select>
            <Input
              label="Course Code"
              name="courseCode"
              value={formData.courseCode}
              onChange={handleInputChange}
              placeholder="e.g. BTECH"
              disabled={Boolean(formData.courseId)}
              hint={formData.courseId ? "Auto-filled from selected course (disabled)" : "Optional course identifier"}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Input
              label="Subject Code *"
              name="subjectCode"
              value={formData.subjectCode}
              onChange={handleInputChange}
              placeholder="CS-101"
              hint="Must be unique within your institution"
              required
            />
            <Input
              label="Subject Name *"
              name="subjectName"
              value={formData.subjectName}
              onChange={handleInputChange}
              placeholder="Data Structures"
              hint="Must be unique within your institution"
              required
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Input
              label="Semester *"
              name="semester"
              type="number"
              value={formData.semester}
              onChange={handleInputChange}
              placeholder="1"
              required
            />
            <Input
              label="Credits"
              name="credits"
              type="number"
              value={formData.credits}
              onChange={handleInputChange}
              placeholder="4"
              min="0"
              max="10"
            />
          </div>

          <div>
            <Select
              label="Branch / Stream (optional)"
              name="branch"
              value={formData.branch}
              onChange={handleInputChange}
              disabled={!formData.courseId || subjectBranches.length === 0}
            >
              <option value="">
                {!formData.courseId ? "Select a course first" : subjectBranches.length === 0 ? "No branches defined" : "No specific branch"}
              </option>
              {subjectBranches.map((b, i) => (
                <option key={b._id || b.code + i} value={b.code}>{b.code} — {b.name}</option>
              ))}
            </Select>
          </div>

          <Textarea
            label="Description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            rows="3"
            placeholder="Subject description..."
          />

          <div
            className="p-4 rounded-lg"
            style={{
              backgroundColor: `${themeColors.primary}10`,
              border: `1px solid ${themeColors.primary}20`
            }}
          >
            <p className="text-sm flex items-center gap-2" style={{ color: themeColors.primary }}>
              <Layers className="w-4 h-4" />
              Note: Subject will be available to all teachers and students in your institution
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowForm(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={submitting}
              style={{ backgroundColor: themeColors.primary }}
            >
              Create Subject
            </Button>
          </div>
        </form>
      </Modal>

      {/* Subject Details Modal */}
      <Modal
        isOpen={showDetails}
        onClose={() => setShowDetails(false)}
        title="Subject Details"
        size="lg"
      >
        {selectedSubject && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${themeColors.primary}20`, color: themeColors.primary }}
              >
                <BookOpen className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-ink">{selectedSubject.subjectName}</h2>
                <p className="text-ink-soft">{selectedSubject.subjectCode}</p>
                {selectedSubject.courseCode && (
                  <p className="text-sm text-ink-faint">Course: {selectedSubject.courseCode}</p>
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="p-4 bg-background rounded-lg">
                <p className="text-sm text-ink-soft mb-1">Semester</p>
                <p className="font-medium text-ink">{selectedSubject.semester}</p>
              </div>
              <div className="p-4 bg-background rounded-lg">
                <p className="text-sm text-ink-soft mb-1">Credits</p>
                <p className="font-medium text-ink">{selectedSubject.credits || 'N/A'}</p>
              </div>
              <div className="p-4 bg-background rounded-lg">
                <p className="text-sm text-ink-soft mb-1">Status</p>
                <Badge tone={selectedSubject.isActive ? 'success' : 'danger'}>
                  {selectedSubject.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>

            {/* Teacher Assignments */}
            {selectedSubject.assignments && selectedSubject.assignments.length > 0 && (
              <div className="p-4 bg-background rounded-lg">
                <p className="text-sm font-medium text-ink-soft mb-3">Assigned Teachers</p>
                <div className="space-y-2">
                  {selectedSubject.assignments.map((assignment, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-surface rounded-lg border border-line">
                      <div>
                        <p className="font-medium text-ink">{assignment.teacherName}</p>
                        <p className="text-xs text-ink-soft">Assigned: {new Date(assignment.assignedDate).toLocaleDateString()}</p>
                      </div>
                      <span
                        className="px-2 py-1 rounded text-xs"
                        style={{
                          backgroundColor: `${themeColors.primary}20`,
                          color: themeColors.primary
                        }}
                      >
                        Section {assignment.section}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedSubject.description && (
              <div className="p-4 bg-background rounded-lg">
                <p className="text-sm text-ink-soft mb-2">Description</p>
                <p className="text-ink">{selectedSubject.description}</p>
              </div>
            )}

            <div className="p-4 bg-background rounded-lg">
              <p className="text-sm text-ink-soft mb-2">Additional Information</p>
              <div className="grid md:grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-ink-soft">Created:</span>{' '}
                  <span className="text-ink">{new Date(selectedSubject.createdAt).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-ink-soft">Created By:</span>{' '}
                  <span className="text-ink">{selectedSubject.createdBy?.name || 'System'}</span>
                </div>
                {selectedSubject.updatedAt && (
                  <div>
                    <span className="text-ink-soft">Last Updated:</span>{' '}
                    <span className="text-ink">{new Date(selectedSubject.updatedAt).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <BulkImportModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        endpoint="/admin/bulk-subjects"
        bodyKey="subjects"
        itemLabel="subjects"
        example={BULK_SUBJECTS_EXAMPLE}
        columns={BULK_SUBJECTS_COLUMNS}
        exportData={subjects}
        onImported={() => {
          setShowBulkModal(false);
          fetchSubjects();
        }}
      />

      {/* Pricing / Upgrade Modal */}
      <PricingModal
        {...modalProps}
        currentPlanCode={tenantInfo?.subscription?.plan}
      />
    </div>
  );
};

export default ManageSubjects;
