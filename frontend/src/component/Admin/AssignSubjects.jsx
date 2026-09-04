// src/components/Admin/AssignSubjects.jsx
import React, { useState, useEffect, useMemo } from "react";
import {
  Grid,
  Search,
  Filter,
  BookOpen,
  Users,
  Award,
  Plus,
  Trash2,
  Edit,
  X,
  Check,
  AlertCircle,
  RefreshCw,
  Calendar,
  UserCheck,
  BookMarked,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  Layers,
  ChevronRight,
  ChevronLeft,
  Building2,
  Loader2,
  GraduationCap
} from "lucide-react";
import { motion } from "framer-motion";
import Card from "../common/ui/Card";
import Modal from "../common/ui/Modal";
import Button from "../common/ui/Button";
import StatCard from "../common/ui/StatCard";
import { isBranchMatch, isBranchInList } from "../../utils/branchHelper";
import EmptyState from "../common/ui/EmptyState";
import DashboardHeader from "../common/ui/DashboardHeader";
import { Select } from "../common/ui/Input";
import api from "../../utils/api";
import { logError } from "../../utils/logger";
import { useTheme } from '../../contexts/ThemeContexts';
import Pagination from "../common/ui/Pagination";
import { useToast } from "../../contexts/ToastContext";

const AssignSubjects = () => {
  const { colors } = useTheme();
  const { success: toastSuccess, error: toastError } = useToast();
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [filteredGroups, setFilteredGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [courses, setCourses] = useState([]);
  const [filterCourse, setFilterCourse] = useState("");
  const [filterBranch, setFilterBranch] = useState("");
  const [filterTeacher, setFilterTeacher] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterSemester, setFilterSemester] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [selectedSectionFilter, setSelectedSectionFilter] = useState([]);
  const [showSectionDropdown, setShowSectionDropdown] = useState(false);
  const [availableSections, setAvailableSections] = useState([]);
  const [sortBy, setSortBy] = useState("teacher");
  const [sortOrder, setSortOrder] = useState("asc");
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [tenantInfo, setTenantInfo] = useState(null);
  const [stats, setStats] = useState({
    totalTeachers: 0,
    totalSubjects: 0,
    totalAssignments: 0,
    totalSections: 0,
    teachersWithAssignments: 0,
    totalGroups: 0
  });

  const [sectionInput, setSectionInput] = useState("");
  const [selectedSections, setSelectedSections] = useState([]);

  const [modalCourseFilter, setModalCourseFilter] = useState("");
  const [modalBranchFilter, setModalBranchFilter] = useState("");
  const [modalSemesterFilter, setModalSemesterFilter] = useState("");
  const [activeSectionsList, setActiveSectionsList] = useState([]);

  const [formData, setFormData] = useState({
    teacherId: "",
    subjectId: "",
  });

  const themeColors = {
    primary: colors?.primary || '#7c3aed',
    secondary: colors?.secondary || '#06b6d4',
  };

  useEffect(() => {
    fetchTenantInfo();
    fetchData();
  }, []);

  useEffect(() => {
    const sections = new Set();
    assignments.forEach(a => {
      if (a.section) sections.add(String(a.section).trim());
      if (Array.isArray(a.sections)) {
        a.sections.forEach(s => s && sections.add(String(s).trim()));
      }
    });
    setAvailableSections(Array.from(sections).sort());
  }, [assignments]);

  useEffect(() => {
    filterAndSortGroups();
  }, [searchTerm, filterCourse, filterBranch, filterTeacher, filterSubject, filterSemester, filterYear, selectedSectionFilter, sortBy, sortOrder, assignments, courses]);

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

  // Group assignments by teacher-subject combination
  const groupedAssignments = useMemo(() => {
    const groups = new Map();

    assignments.forEach(assignment => {
      const key = `${assignment.teacher?._id}-${assignment.subject?._id}`;

      if (!groups.has(key)) {
        groups.set(key, {
          id: key,
          teacher: assignment.teacher,
          subject: assignment.subject,
          sections: new Set(),
          assignments: [],
          firstAssignedDate: assignment.assignedDate,
          lastAssignedDate: assignment.assignedDate,
          totalStudentsUpdated: 0
        });
      }

      const group = groups.get(key);
      group.sections.add(assignment.section);
      group.assignments.push(assignment);

      if (new Date(assignment.assignedDate) < new Date(group.firstAssignedDate)) {
        group.firstAssignedDate = assignment.assignedDate;
      }
      if (new Date(assignment.assignedDate) > new Date(group.lastAssignedDate)) {
        group.lastAssignedDate = assignment.assignedDate;
      }

      group.totalStudentsUpdated += assignment.studentsUpdated || 0;
    });

    return Array.from(groups.values()).map(group => ({
      ...group,
      sections: Array.from(group.sections).sort(),
      assignments: group.assignments.sort((a, b) =>
        new Date(b.assignedDate) - new Date(a.assignedDate)
      )
    }));
  }, [assignments]);

  const availableCourseCodes = useMemo(() => {
    const codes = new Set();
    courses.forEach(c => {
      if (c.code) codes.add(c.code);
    });
    subjects.forEach(s => {
      if (s.courseCode) codes.add(s.courseCode);
    });
    assignments.forEach(a => {
      if (a.subject?.courseCode) codes.add(a.subject.courseCode);
    });
    return Array.from(codes).sort();
  }, [courses, subjects, assignments]);

  // Main toolbar available branches - filtered by selected filterCourse
  const availableBranches = useMemo(() => {
    const branchSet = new Set();
    courses.forEach(c => {
      if (filterCourse) {
        const matches = String(c.code || "").toUpperCase() === filterCourse.toUpperCase() ||
          String(c._id || "") === filterCourse ||
          String(c.name || "").toUpperCase() === filterCourse.toUpperCase();
        if (!matches) return;
      }
      if (Array.isArray(c.branches)) {
        c.branches.forEach(b => {
          const code = String(b?.code || "").trim();
          if (code) branchSet.add(code);
        });
      }
    });
    subjects.forEach(s => {
      if (filterCourse) {
        const cCode = String(s.courseCode || "").toUpperCase();
        const cId = String(s.courseId || "");
        if (cCode !== filterCourse.toUpperCase() && cId !== filterCourse) return;
      }
      if (s.branch) branchSet.add(String(s.branch).trim());
    });
    assignments.forEach(a => {
      if (filterCourse) {
        const cCode = String(a.subject?.courseCode || "").toUpperCase();
        const cId = String(a.subject?.courseId || "");
        if (cCode !== filterCourse.toUpperCase() && cId !== filterCourse) return;
      }
      if (a.subject?.branch) branchSet.add(String(a.subject.branch).trim());
    });
    return Array.from(branchSet).sort();
  }, [courses, subjects, assignments, filterCourse]);

  // Main toolbar available semesters - filtered by selected filterCourse & filterBranch
  const availableSemesters = useMemo(() => {
    const semSet = new Set();
    subjects.forEach(s => {
      if (filterCourse) {
        const cCode = String(s.courseCode || "").toUpperCase();
        const cId = String(s.courseId || "");
        if (cCode !== filterCourse.toUpperCase() && cId !== filterCourse) return;
      }
      if (filterBranch) {
        if (!isBranchMatch(s.branch, filterBranch, courses, { excludeUnassigned: true })) return;
      }
      if (s.semester) semSet.add(String(s.semester).trim());
    });
    assignments.forEach(a => {
      if (filterCourse) {
        const cCode = String(a.subject?.courseCode || "").toUpperCase();
        const cId = String(a.subject?.courseId || "");
        if (cCode !== filterCourse.toUpperCase() && cId !== filterCourse) return;
      }
      if (filterBranch) {
        if (!isBranchMatch(a.subject?.branch, filterBranch, courses, { excludeUnassigned: true })) return;
      }
      if (a.subject?.semester) semSet.add(String(a.subject.semester).trim());
    });
    return Array.from(semSet).sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });
  }, [subjects, assignments, courses, filterCourse, filterBranch]);

  const availableYears = useMemo(() => {
    const yearSet = new Set();
    availableSemesters.forEach(sem => {
      const num = parseInt(sem, 10);
      if (!isNaN(num) && num > 0) {
        yearSet.add(Math.ceil(num / 2));
      }
    });
    if (yearSet.size === 0) return [1, 2, 3, 4];
    return Array.from(yearSet).sort((a, b) => a - b);
  }, [availableSemesters]);

  // Auto-reset main toolbar branch & semester if no longer present in available options
  useEffect(() => {
    if (filterBranch && !isBranchInList(filterBranch, availableBranches, courses)) {
      setFilterBranch("");
    }
  }, [filterCourse, availableBranches, filterBranch, courses]);

  useEffect(() => {
    if (filterSemester && !availableSemesters.includes(filterSemester)) {
      setFilterSemester("");
    }
  }, [filterCourse, filterBranch, availableSemesters, filterSemester]);

  // Modal available branches - filtered by modalCourseFilter
  const modalAvailableBranches = useMemo(() => {
    const branchSet = new Set();
    courses.forEach(c => {
      if (modalCourseFilter) {
        const matches = String(c.code || "").toUpperCase() === modalCourseFilter.toUpperCase() ||
          String(c._id || "") === modalCourseFilter ||
          String(c.name || "").toUpperCase() === modalCourseFilter.toUpperCase();
        if (!matches) return;
      }
      if (Array.isArray(c.branches)) {
        c.branches.forEach(b => {
          const code = String(b?.code || "").trim();
          if (code) branchSet.add(code);
        });
      }
    });
    subjects.forEach(s => {
      if (modalCourseFilter) {
        const cCode = String(s.courseCode || "").toUpperCase();
        const cId = String(s.courseId || "");
        if (cCode !== modalCourseFilter.toUpperCase() && cId !== modalCourseFilter) return;
      }
      if (s.branch) branchSet.add(String(s.branch).trim());
    });
    return Array.from(branchSet).sort();
  }, [courses, subjects, modalCourseFilter]);

  // Modal available semesters - filtered by modalCourseFilter & modalBranchFilter
  const modalAvailableSemesters = useMemo(() => {
    const semSet = new Set();
    subjects.forEach(s => {
      if (modalCourseFilter) {
        const cCode = String(s.courseCode || "").toUpperCase();
        const cId = String(s.courseId || "");
        if (cCode !== modalCourseFilter.toUpperCase() && cId !== modalCourseFilter) return;
      }
      if (modalBranchFilter) {
        if (!isBranchMatch(s.branch, modalBranchFilter, courses)) return;
      }
      if (s.semester) semSet.add(String(s.semester).trim());
    });
    return Array.from(semSet).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ""), 10);
      const numB = parseInt(b.replace(/\D/g, ""), 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });
  }, [subjects, modalCourseFilter, modalBranchFilter, courses]);

  // Auto-reset modal branch & semester if no longer present in available options
  useEffect(() => {
    if (modalBranchFilter && !isBranchInList(modalBranchFilter, modalAvailableBranches, courses)) {
      setModalBranchFilter("");
    }
  }, [modalCourseFilter, modalAvailableBranches, modalBranchFilter, courses]);

  useEffect(() => {
    if (modalSemesterFilter && !modalAvailableSemesters.includes(modalSemesterFilter)) {
      setModalSemesterFilter("");
    }
  }, [modalCourseFilter, modalBranchFilter, modalAvailableSemesters, modalSemesterFilter]);

  const filteredModalSubjects = useMemo(() => {
    return subjects.filter((s) => {
      if (modalCourseFilter) {
        const cCode = String(s.courseCode || "").toUpperCase();
        const cId = String(s.courseId || "");
        if (cCode !== modalCourseFilter.toUpperCase() && cId !== modalCourseFilter) {
          return false;
        }
      }
      if (modalBranchFilter) {
        if (!isBranchMatch(s.branch, modalBranchFilter, courses)) {
          return false;
        }
      }
      if (modalSemesterFilter) {
        if (String(s.semester || "") !== String(modalSemesterFilter)) {
          return false;
        }
      }
      return true;
    });
  }, [subjects, modalCourseFilter, modalBranchFilter, modalSemesterFilter, courses]);

  const existingSubjectAssignments = useMemo(() => {
    if (!formData.subjectId) return {};
    const map = {};
    assignments.forEach(a => {
      const subId = a.subject?._id || a.subjectId;
      if (String(subId) === String(formData.subjectId)) {
        if (a.section && a.teacher?.name) {
          map[String(a.section).trim().toUpperCase()] = {
            teacherId: String(a.teacher._id),
            teacherName: a.teacher.name
          };
        }
      }
    });
    return map;
  }, [assignments, formData.subjectId]);

  const filterAndSortGroups = () => {
    let filtered = [...groupedAssignments];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(g =>
        g.teacher?.name?.toLowerCase().includes(term) ||
        g.teacher?.email?.toLowerCase().includes(term) ||
        g.subject?.subjectName?.toLowerCase().includes(term) ||
        g.subject?.subjectCode?.toLowerCase().includes(term) ||
        g.sections.some(s => s.toLowerCase().includes(term))
      );
    }

    if (filterCourse) {
      filtered = filtered.filter(g =>
        String(g.subject?.courseCode || "").toUpperCase() === filterCourse.toUpperCase() ||
        String(g.subject?.courseId || "") === filterCourse
      );
    }

    if (filterBranch) {
      filtered = filtered.filter(g =>
        isBranchMatch(g.subject?.branch, filterBranch, courses, { excludeUnassigned: true })
      );
    }

    if (filterTeacher) {
      filtered = filtered.filter(g => g.teacher?._id === filterTeacher);
    }

    if (filterSubject) {
      filtered = filtered.filter(g => g.subject?._id === filterSubject);
    }

    if (filterSemester) {
      filtered = filtered.filter(g => String(g.subject?.semester || "") === String(filterSemester));
    }

    if (filterYear) {
      filtered = filtered.filter(g => {
        const semNum = parseInt(String(g.subject?.semester || "").replace(/\D/g, ""), 10);
        const year = g.subject?.year || (!isNaN(semNum) && semNum > 0 ? Math.ceil(semNum / 2) : null);
        return Number(year) === Number(filterYear);
      });
    }

    if (selectedSectionFilter.length > 0) {
      filtered = filtered.filter(g =>
        selectedSectionFilter.some(section => g.sections.includes(section))
      );
    }

    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case "teacher":
          comparison = (a.teacher?.name || "").localeCompare(b.teacher?.name || "");
          break;
        case "subject":
          comparison = (a.subject?.subjectName || "").localeCompare(b.subject?.subjectName || "");
          break;
        case "sections":
          comparison = a.sections.length - b.sections.length;
          break;
        case "date":
        default:
          comparison = new Date(b.lastAssignedDate) - new Date(a.lastAssignedDate);
          break;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    setFilteredGroups(filtered);
    setStats(prev => ({ ...prev, totalGroups: filtered.length }));
  };

  useEffect(() => {
    setPage(1);
  }, [searchTerm, filterCourse, filterTeacher, filterSubject, filterSemester, filterYear, selectedSectionFilter]);

  const paginationInfo = useMemo(() => ({
    page,
    limit: pageSize,
    total: filteredGroups.length,
    pages: Math.ceil(filteredGroups.length / pageSize) || 1
  }), [page, pageSize, filteredGroups.length]);

  const paginatedGroups = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredGroups.slice(start, start + pageSize);
  }, [filteredGroups, page, pageSize]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [teachersRes, subjectsRes, assignmentsRes, coursesRes, activeSecRes] = await Promise.all([
        api.get('/admin/teachers').catch(() => ({ data: {} })),
        api.get('/admin/subjects').catch(() => ({ data: {} })),
        api.get('/admin/assignments').catch(() => ({ data: {} })),
        api.get('/academic/courses').catch(() => ({ data: {} })),
        api.get('/admin/active-sections').catch(() => ({ data: {} })),
      ]);

      const teachersList = Array.isArray(teachersRes.data?.data) ? teachersRes.data.data : (Array.isArray(teachersRes.data) ? teachersRes.data : []);
      const subjectsList = Array.isArray(subjectsRes.data?.data) ? subjectsRes.data.data : (Array.isArray(subjectsRes.data) ? subjectsRes.data : []);
      const assignmentsList = Array.isArray(assignmentsRes.data?.data) ? assignmentsRes.data.data : (Array.isArray(assignmentsRes.data) ? assignmentsRes.data : []);
      const coursesList = Array.isArray(coursesRes.data?.data) ? coursesRes.data.data : (Array.isArray(coursesRes.data) ? coursesRes.data : []);
      const activeSecList = Array.isArray(activeSecRes.data?.data) ? activeSecRes.data.data : [];

      setTeachers(teachersList);
      setSubjects(subjectsList);
      setAssignments(assignmentsList);
      setCourses(coursesList);
      setActiveSectionsList(activeSecList);

      setStats({
        totalTeachers: teachersList.length,
        totalSubjects: subjectsList.length,
        totalAssignments: assignmentsList.length,
        totalSections: [...new Set(assignmentsList.flatMap(a => a.section ? [a.section] : (a.sections || [])))].length,
        teachersWithAssignments: new Set(assignmentsList.map(a => a.teacher?._id)).size,
        totalGroups: 0
      });

    } catch (error) {
      logError("Load Data", error);
      setError(error.response?.data?.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleSectionFilter = (section) => {
    setSelectedSectionFilter(prev =>
      prev.includes(section)
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  const clearSectionFilters = () => {
    setSelectedSectionFilter([]);
  };

  const handleAddSection = () => {
    if (!sectionInput.trim()) return;

    const input = sectionInput.trim().toUpperCase();
    if (input.includes(',')) {
      const multipleSections = input.split(',').map(s => s.trim()).filter(s => s);
      const newSections = multipleSections.filter(s => !selectedSections.includes(s));
      setSelectedSections([...selectedSections, ...newSections]);
    } else {
      if (!selectedSections.includes(input)) {
        setSelectedSections([...selectedSections, input]);
      }
    }
    setSectionInput("");
  };

  const handleRemoveSection = (sectionToRemove) => {
    setSelectedSections(selectedSections.filter(s => s !== sectionToRemove));
  };

  const handleSectionKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddSection();
    }
  };

  const toggleGroupExpand = (groupId) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  const handleViewDetails = (group) => {
    setSelectedGroup(group);
    setShowDetailsModal(true);
  };

  const handleEdit = (group) => {
    setEditingGroup(group);
    setFormData({
      teacherId: group.teacher?._id || "",
      subjectId: group.subject?._id || "",
    });
    const secs = Array.isArray(group.sections)
      ? group.sections
      : Array.from(group.sections || []);
    setSelectedSections(secs);
    setShowForm(true);
  };

  const handleDelete = async (assignmentId) => {
    if (!window.confirm("Are you sure you want to delete this assignment?")) return;

    try {
      const res = await api.delete(`/admin/assignments/${assignmentId}`);

      if (res.data.success) {
        setAssignments(prev => prev.filter(a => a._id !== assignmentId));
        const msg = "Assignment deleted successfully!";
        setSuccessMessage(msg);
        toastSuccess(msg);
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to delete assignment";
      setError(msg);
      toastError(msg);
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.teacherId || !formData.subjectId || selectedSections.length === 0) {
      const msg = "Please select a teacher, subject, and add at least one section";
      setError(msg);
      toastError(msg);
      return;
    }

    const teacher = teachers.find(t => t._id === formData.teacherId);
    const subject = subjects.find(s => s._id === formData.subjectId);
    const isEditing = !!editingGroup;
    const currentEditingGroup = editingGroup;

    const tempId = "temp-" + Date.now();
    const optimisticAssignments = selectedSections.map(section => ({
      _id: `${tempId}-${section}`,
      teacher,
      subject,
      section,
      sections: [section],
      optimistic: true,
      assignedDate: new Date().toISOString(),
      studentsUpdated: 0
    }));

    setAssignments(prev => [...optimisticAssignments, ...prev]);
    setShowForm(false);
    setEditingGroup(null);
    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    const submittedSections = [...selectedSections];
    const submittedTeacherId = formData.teacherId;
    const submittedSubjectId = formData.subjectId;
    setSelectedSections([]);
    setSectionInput("");
    setFormData({ teacherId: "", subjectId: "" });

    try {
      let response;
      if (isEditing) {
        response = await api.put('/admin/assign-subject', {
          teacherId: submittedTeacherId,
          subjectId: submittedSubjectId,
          sections: submittedSections,
          oldTeacherId: currentEditingGroup?.teacher?._id,
          oldSubjectId: currentEditingGroup?.subject?._id,
        });
      } else {
        response = await api.post('/admin/assign-subject', {
          teacherId: submittedTeacherId,
          subjectId: submittedSubjectId,
          sections: submittedSections
        });
      }

      if (response.data.success) {
        setAssignments(prev => prev.filter(a => !a._id.startsWith(tempId)));
        await fetchData();
        const msg = isEditing
          ? `✅ Assignment updated successfully! ${response.data.data?.studentsUpdated || 0} students updated.`
          : `✅ Subject assigned successfully! ${response.data.data?.studentsUpdated || 0} students updated.`;
        setSuccessMessage(msg);
        toastSuccess(msg);
        setTimeout(() => setSuccessMessage(null), 5000);
      }
    } catch (err) {
      setAssignments(prev => prev.filter(a => !a._id.startsWith(tempId)));
      const msg = err.response?.data?.message || (isEditing ? "Failed to update assignment" : "Failed to assign subject");
      setError(msg);
      toastError(msg);
      setTimeout(() => setError(null), 5000);
    } finally {
      setSubmitting(false);
    }
  };

  const getUniqueTeachers = () => {
    const uniqueTeachers = new Map();
    groupedAssignments.forEach(g => {
      if (g.teacher?._id && !uniqueTeachers.has(g.teacher._id)) {
        uniqueTeachers.set(g.teacher._id, g.teacher);
      }
    });
    return Array.from(uniqueTeachers.values());
  };

  const getUniqueSubjects = () => {
    const uniqueSubjects = new Map();
    groupedAssignments.forEach(g => {
      if (g.subject?._id && !uniqueSubjects.has(g.subject._id)) {
        uniqueSubjects.set(g.subject._id, g.subject);
      }
    });
    return Array.from(uniqueSubjects.values());
  };

  const handleCloseModal = () => {
    setShowForm(false);
    setEditingGroup(null);
    setFormData({ teacherId: "", subjectId: "" });
    setSelectedSections([]);
    setSectionInput("");
    setModalCourseFilter("");
    setModalBranchFilter("");
    setModalSemesterFilter("");
    setError(null);
  };

  const refreshData = () => {
    fetchData();
  };

  const exportAssignments = () => {
    const exportData = {
      groups: groupedAssignments,
      totalGroups: groupedAssignments.length,
      totalAssignments: assignments.length,
      exportDate: new Date().toISOString(),
      tenant: tenantInfo
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `assignments_${tenantInfo?.subdomain || 'all'}_${new Date().toISOString().split('T')[0]}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <div className="space-y-6">
      <DashboardHeader
        greeting="Faculty-Subject Allocation Matrix"
        meta={`Allocating courses, subjects and teaching sections for ${tenantInfo?.name || "your campus"}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="subtle"
              size="sm"
              leftIcon={Download}
              onClick={exportAssignments}
            >
              Export
            </Button>
            <Button
              variant="subtle"
              size="sm"
              leftIcon={RefreshCw}
              onClick={refreshData}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={Plus}
              onClick={() => setShowForm(true)}
            >
              New Allocation
            </Button>
          </div>
        }
      />

      {/* Messages */}
      {error && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-600 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 text-xs font-medium flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Stats Bento Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <StatCard label="Faculty" value={stats.totalTeachers} icon={Users} tone="primary" />
        <StatCard label="Subjects" value={stats.totalSubjects} icon={BookOpen} tone="secondary" />
        <StatCard label="Assignments" value={stats.totalAssignments} icon={Grid} tone="info" />
        <StatCard label="Group Pairs" value={stats.totalGroups} icon={Layers} tone="warning" />
        <StatCard label="Sections" value={stats.totalSections} icon={Award} tone="primary" />
        <StatCard label="Active Faculty" value={stats.teachersWithAssignments} icon={UserCheck} tone="success" />
      </div>

      {/* Filters and Sorting */}
      <Card>
        <div className="space-y-4">
          {/* Top Row: Search & Dropdown Filters */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-ink-faint" />
              <input
                type="text"
                placeholder="Search teacher, subject, section..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-line bg-surface text-ink placeholder:text-ink-faint rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm"
              />
            </div>

            {/* Course Filter */}
            <div className="relative">
              <GraduationCap className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-ink-faint pointer-events-none" />
              <select
                value={filterCourse}
                onChange={(e) => setFilterCourse(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary appearance-none text-sm cursor-pointer"
              >
                <option value="">All Courses</option>
                {availableCourseCodes.map(code => (
                  <option key={code} value={code}>Course: {code}</option>
                ))}
              </select>
            </div>

            {/* Branch Filter */}
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-ink-faint pointer-events-none" />
              <select
                value={filterBranch}
                onChange={(e) => setFilterBranch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary appearance-none text-sm cursor-pointer"
              >
                <option value="">All Branches</option>
                {availableBranches.map(branch => {
                  let branchName = "";
                  for (const c of courses) {
                    if (Array.isArray(c.branches)) {
                      const found = c.branches.find(bc => bc.code === branch);
                      if (found) { branchName = found.name; break; }
                    }
                  }
                  return <option key={branch} value={branch}>{branch}{branchName ? ` — ${branchName}` : ""}</option>;
                })}
              </select>
            </div>

            {/* Teacher Filter */}
            <div className="relative">
              <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-ink-faint pointer-events-none" />
              <select
                value={filterTeacher}
                onChange={(e) => setFilterTeacher(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary appearance-none text-sm cursor-pointer"
              >
                <option value="">All Teachers</option>
                {getUniqueTeachers().map(t => (
                  <option key={t._id} value={t._id}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* Subject Filter */}
            <div className="relative">
              <BookOpen className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-ink-faint pointer-events-none" />
              <select
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary appearance-none text-sm cursor-pointer"
              >
                <option value="">All Subjects</option>
                {getUniqueSubjects().map(s => (
                  <option key={s._id} value={s._id}>{s.subjectName} ({s.subjectCode})</option>
                ))}
              </select>
            </div>

            {/* Semester Filter */}
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-ink-faint pointer-events-none" />
              <select
                value={filterSemester}
                onChange={(e) => setFilterSemester(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary appearance-none text-sm cursor-pointer"
              >
                <option value="">All Semesters</option>
                {availableSemesters.map(s => (
                  <option key={s} value={s}>Semester {s}</option>
                ))}
              </select>
            </div>

            {/* Year Filter */}
            <div className="relative">
              <Layers className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-ink-faint pointer-events-none" />
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary appearance-none text-sm cursor-pointer"
              >
                <option value="">All Years</option>
                {availableYears.map(y => (
                  <option key={y} value={y}>Year {y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Bottom Row: Section Filter & Sort & Clear Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-line/60">
            <div className="flex flex-wrap items-center gap-2">
              {/* Section Multi-Select Dropdown Toggle */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowSectionDropdown(prev => !prev)}
                  className="px-3 py-1.5 border border-line bg-surface hover:bg-background text-ink text-sm rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Award className="w-4 h-4 text-ink-faint" />
                  <span>
                    {selectedSectionFilter.length === 0
                      ? "Filter Sections..."
                      : `Sections (${selectedSectionFilter.length})`}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-ink-faint ml-1" />
                </button>

                {showSectionDropdown && (
                  <div className="absolute left-0 z-20 mt-1 w-56 bg-surface border border-line rounded-xl shadow-pop p-2 space-y-1">
                    <div className="px-2 py-1 text-xs font-semibold text-ink-faint uppercase">
                      Select Sections
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {availableSections.map(section => (
                        <label
                          key={section}
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-background rounded-lg cursor-pointer text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={selectedSectionFilter.includes(section)}
                            onChange={() => toggleSectionFilter(section)}
                            className="rounded focus:ring-primary/50"
                            style={{ accentColor: themeColors.primary }}
                          />
                          <span>Section {section}</span>
                        </label>
                      ))}
                    </div>
                    {selectedSectionFilter.length > 0 && (
                      <div className="pt-2 border-t border-line flex justify-between items-center">
                        <button
                          onClick={clearSectionFilters}
                          className="text-xs text-red-600 hover:underline font-medium px-2 py-1"
                        >
                          Clear Sections
                        </button>
                        <button
                          onClick={() => setShowSectionDropdown(false)}
                          className="text-xs text-primary hover:underline font-medium px-2 py-1"
                        >
                          Done
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Selected Section Badges */}
              {selectedSectionFilter.map(section => (
                <span
                  key={section}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border"
                  style={{
                    backgroundColor: `${themeColors.primary}15`,
                    color: themeColors.primary,
                    borderColor: `${themeColors.primary}30`
                  }}
                >
                  Sec {section}
                  <button
                    onClick={() => toggleSectionFilter(section)}
                    className="hover:text-red-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>

            {/* Right: Sort controls & Clear All */}
            <div className="flex items-center gap-2 ml-auto">
              <div className="flex items-center gap-1 text-sm bg-surface border border-line rounded-lg p-0.5">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-transparent border-none text-ink text-sm px-2 py-1 focus:ring-0 cursor-pointer"
                >
                  <option value="teacher">Sort by Teacher</option>
                  <option value="subject">Sort by Subject</option>
                  <option value="sections">Sort by Sections</option>
                  <option value="date">Sort by Date</option>
                </select>
                <button
                  type="button"
                  onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                  className="p-1.5 hover:bg-background rounded-md transition-colors"
                  title={`Sort ${sortOrder === "asc" ? "Descending" : "Ascending"}`}
                >
                  {sortOrder === "asc" ? (
                    <ChevronUp className="w-4 h-4" style={{ color: themeColors.primary }} />
                  ) : (
                    <ChevronDown className="w-4 h-4" style={{ color: themeColors.primary }} />
                  )}
                </button>
              </div>

              {(searchTerm || filterCourse || filterBranch || filterTeacher || filterSubject || filterSemester || filterYear || selectedSectionFilter.length > 0) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchTerm("");
                    setFilterCourse("");
                    setFilterBranch("");
                    setFilterTeacher("");
                    setFilterSubject("");
                    setFilterSemester("");
                    setFilterYear("");
                    setSelectedSectionFilter([]);
                  }}
                >
                  Clear All
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Groups List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-background rounded-full animate-pulse"></div>
                <div className="flex-1">
                  <div className="h-5 bg-background rounded w-1/4 mb-2"></div>
                  <div className="h-4 bg-background rounded w-1/3"></div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : filteredGroups.length === 0 ? (
        <EmptyState
          title="No Assignments Found"
          description={searchTerm || filterTeacher || filterSubject || selectedSectionFilter.length > 0
            ? "Try adjusting your filters"
            : "Create your first subject assignment"}
          icon={Grid}
        />
      ) : (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
          }}
          className="space-y-4"
        >
          {paginatedGroups.map((group) => (
            <motion.div
              key={group.id}
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 }
              }}
            >
              <Card className="overflow-hidden">
                <div
                  className="p-6 border-b"
                  style={{
                    background: `linear-gradient(135deg, ${themeColors.lighter}, #ffffff)`,
                    borderColor: `${themeColors.primary}20`
                  }}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div
                        className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{
                          backgroundColor: `${themeColors.primary}20`,
                          color: themeColors.primary
                        }}
                      >
                        <span className="font-bold text-xl">
                          {group.teacher?.name?.charAt(0)?.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                          <h3 className="font-bold text-xl text-ink">
                            {group.teacher?.name}
                          </h3>
                          <span className="px-3 py-1 bg-background text-ink-soft rounded-full text-sm border border-line">
                            {group.teacher?.email}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 mb-3">
                          <span className="text-lg font-semibold" style={{ color: themeColors.primary }}>
                            {group.subject?.subjectName}
                          </span>
                          <span
                            className="px-3 py-0.5 rounded-full text-xs font-semibold"
                            style={{
                              backgroundColor: `${themeColors.primary}20`,
                              color: themeColors.primary
                            }}
                          >
                            {group.subject?.subjectCode}
                          </span>
                          {group.subject?.courseCode && (
                            <span
                              className="px-2.5 py-0.5 rounded-md text-xs font-semibold uppercase"
                              style={{
                                backgroundColor: `${themeColors.secondary}20`,
                                color: themeColors.secondary,
                              }}
                            >
                              {group.subject.courseCode}
                            </span>
                          )}
                          {group.subject?.semester && (() => {
                            const semNum = parseInt(String(group.subject.semester).replace(/\D/g, ""), 10);
                            const year = group.subject.year || (!isNaN(semNum) && semNum > 0 ? Math.ceil(semNum / 2) : null);
                            return (
                              <span className="text-sm text-ink-soft font-medium">
                                Sem {group.subject.semester}{year ? ` (Yr ${year})` : ""}
                              </span>
                            );
                          })()}
                        </div>

                        <div className="flex flex-wrap items-center gap-4">
                          <div className="flex flex-wrap gap-2">
                            {group.sections.map(section => (
                              <span
                                key={section}
                                className="px-4 py-1.5 rounded-full text-sm font-medium border"
                                style={{
                                  backgroundColor: `${themeColors.primary}20`,
                                  color: themeColors.primary,
                                  borderColor: `${themeColors.primary}30`
                                }}
                              >
                                Section {section}
                              </span>
                            ))}
                          </div>

                          <div className="flex items-center gap-3 text-sm text-ink-soft">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" style={{ color: themeColors.primary }} />
                              {new Date(group.lastAssignedDate).toLocaleDateString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="w-4 h-4" style={{ color: themeColors.primary }} />
                              {group.totalStudentsUpdated} students
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 md:flex-col md:items-end">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleViewDetails(group)}
                          className="p-2 rounded-lg transition hover:bg-opacity-20"
                          style={{ color: themeColors.primary }}
                          title="View details"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleEdit(group)}
                          className="p-2 rounded-lg transition hover:bg-opacity-20"
                          style={{ color: themeColors.primary }}
                          title="Edit assignment"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => toggleGroupExpand(group.id)}
                          className="p-2 text-ink-soft hover:bg-background rounded-lg transition"
                          title={expandedGroups.has(group.id) ? "Show less" : "Show all assignments"}
                        >
                          {expandedGroups.has(group.id) ? (
                            <ChevronUp className="w-5 h-5" />
                          ) : (
                            <ChevronDown className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                      <span className="text-xs text-ink-faint">
                        {group.assignments.length} assignment{group.assignments.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </div>

                {expandedGroups.has(group.id) && (
                  <div className="p-4 bg-background space-y-3">
                    <h4 className="text-sm font-medium text-ink-soft mb-2 flex items-center gap-2">
                      <Calendar className="w-4 h-4" style={{ color: themeColors.primary }} />
                      Assignment History
                    </h4>
                    {group.assignments.map((assignment, index) => (
                      <div
                        key={assignment._id}
                        className="bg-surface rounded-lg p-4 flex items-center justify-between hover:shadow-card transition"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center"
                            style={{
                              backgroundColor: `${themeColors.primary}20`,
                              color: themeColors.primary
                            }}
                          >
                            <span className="font-medium">
                              {index + 1}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-ink">
                              Section {assignment.section}
                            </p>
                            <p className="text-xs text-ink-soft">
                              Assigned: {new Date(assignment.assignedDate).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {assignment.studentsUpdated > 0 && (
                            <span className="text-xs text-green-600 flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              {assignment.studentsUpdated} students
                            </span>
                          )}
                          <button
                            onClick={() => handleDelete(assignment._id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded transition"
                            title="Delete this assignment"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      <Pagination pagination={paginationInfo} onPageChange={setPage} />

      {/* New / Edit Assignment Modal */}
      <Modal
        isOpen={showForm}
        onClose={handleCloseModal}
        title={editingGroup ? "Update Subject Assignment" : "Create New Assignment"}
        size="lg"
        error={error}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          <Select
            label="Select Teacher *"
            name="teacherId"
            value={formData.teacherId}
            onChange={handleInputChange}
            required
          >
            <option value="">Choose a teacher...</option>
            {teachers.map(t => (
              <option key={t._id} value={t._id}>
                {t.name} - {t.email}
              </option>
            ))}
          </Select>

          {/* Quick Subject Filter Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-surface border border-line rounded-xl">
            <div>
              <label className="block text-xs font-semibold text-ink-soft mb-1 flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5" /> Course / Program
              </label>
              <select
                value={modalCourseFilter}
                onChange={(e) => {
                  setModalCourseFilter(e.target.value);
                  setFormData(prev => ({ ...prev, subjectId: "" }));
                }}
                className="w-full px-3 py-1.5 text-xs border border-line bg-background text-ink rounded-lg focus:ring-2 focus:ring-primary/30"
              >
                <option value="">All Courses ({availableCourseCodes.length})</option>
                {availableCourseCodes.map(code => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-soft mb-1 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" /> Branch / Stream
              </label>
              <select
                value={modalBranchFilter}
                onChange={(e) => {
                  setModalBranchFilter(e.target.value);
                  setFormData(prev => ({ ...prev, subjectId: "" }));
                }}
                className="w-full px-3 py-1.5 text-xs border border-line bg-background text-ink rounded-lg focus:ring-2 focus:ring-primary/30 font-medium"
              >
                <option value="">
                  {modalCourseFilter ? `Branches in ${modalCourseFilter} (${modalAvailableBranches.length})` : `All Branches (${modalAvailableBranches.length})`}
                </option>
                {modalAvailableBranches.map(branch => {
                  let branchName = "";
                  for (const c of courses) {
                    if (Array.isArray(c.branches)) {
                      const found = c.branches.find(bc => bc.code === branch);
                      if (found) { branchName = found.name; break; }
                    }
                  }
                  return <option key={branch} value={branch}>{branch}{branchName ? ` — ${branchName}` : ""}</option>;
                })}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-soft mb-1 flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5" /> Semester
              </label>
              <select
                value={modalSemesterFilter}
                onChange={(e) => {
                  setModalSemesterFilter(e.target.value);
                  setFormData(prev => ({ ...prev, subjectId: "" }));
                }}
                className="w-full px-3 py-1.5 text-xs border border-line bg-background text-ink rounded-lg focus:ring-2 focus:ring-primary/30 font-medium"
              >
                <option value="">
                  {modalCourseFilter ? `Semesters in ${modalCourseFilter}` : "All Semesters"}
                </option>
                {modalAvailableSemesters.map(sem => (
                  <option key={sem} value={sem}>Semester {sem}</option>
                ))}
              </select>
            </div>
          </div>

          <Select
            label={`Select Subject * (${filteredModalSubjects.length} available)`}
            name="subjectId"
            value={formData.subjectId}
            onChange={handleInputChange}
            required
          >
            <option value="">Choose a subject...</option>
            {filteredModalSubjects.map(s => (
              <option key={s._id} value={s._id}>
                {s.subjectCode} - {s.subjectName} ({s.courseCode ? `${s.courseCode} • ` : ""}Sem {s.semester})
              </option>
            ))}
          </Select>

          {formData.subjectId && (() => {
            const selectedSub = subjects.find(s => String(s._id) === String(formData.subjectId));
            if (!selectedSub) return null;
            const semNum = parseInt(String(selectedSub.semester || "").replace(/\D/g, ""), 10);
            const year = selectedSub.year || (!isNaN(semNum) && semNum > 0 ? Math.ceil(semNum / 2) : null);
            return (
              <div
                className="p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-sm"
                style={{
                  backgroundColor: themeColors.lighter,
                  borderColor: `${themeColors.primary}30`
                }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <GraduationCap className="w-4 h-4" style={{ color: themeColors.primary }} />
                  <span className="font-semibold" style={{ color: themeColors.primary }}>
                    Course: {selectedSub.courseCode || "Generic"}
                  </span>
                  {selectedSub.branch && (
                    <span className="px-2 py-0.5 rounded text-xs bg-surface border border-line text-ink-soft">
                      Branch: {selectedSub.branch}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-ink-soft text-xs">
                  <span>Semester {selectedSub.semester}{year ? ` (Yr ${year})` : ""}</span>
                  <span>•</span>
                  <span>{selectedSub.credits || 0} Credits</span>
                </div>
              </div>
            );
          })()}

          <div>
            <label className="block text-sm font-semibold text-ink mb-1.5">
              Add Sections <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-ink-faint mb-3">
              Enter section names or click on active student sections below
            </p>

            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={sectionInput}
                onChange={(e) => setSectionInput(e.target.value)}
                onKeyPress={handleSectionKeyPress}
                placeholder="Enter section name..."
                className="flex-1 px-3 py-2 border border-line bg-surface text-ink placeholder:text-ink-faint rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
              <Button
                type="button"
                onClick={handleAddSection}
                style={{ backgroundColor: themeColors.primary }}
              >
                Add
              </Button>
            </div>

            {/* Quick 1-Click Active Sections */}
            {activeSectionsList.length > 0 && (
              <div className="mb-3 p-2.5 rounded-lg bg-surface border border-line">
                <p className="text-xs text-ink-soft mb-2 font-medium flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-primary" /> Active Student Sections (Click to add/remove):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {activeSectionsList.map(sec => {
                    const isSelected = selectedSections.includes(sec);
                    const secKey = String(sec).trim().toUpperCase();
                    const existingAss = existingSubjectAssignments[secKey];
                    const isOtherTeacher = existingAss && existingAss.teacherId !== formData.teacherId;
                    const isSameTeacher = existingAss && existingAss.teacherId === formData.teacherId;

                    return (
                      <button
                        type="button"
                        key={sec}
                        disabled={isOtherTeacher}
                        onClick={() => {
                          if (isOtherTeacher) {
                            toastError(`Section ${sec} is already assigned to ${existingAss.teacherName}`);
                            return;
                          }
                          if (isSelected) {
                            handleRemoveSection(sec);
                          } else {
                            setSelectedSections([...selectedSections, sec]);
                          }
                        }}
                        title={
                          isOtherTeacher
                            ? `Already assigned to ${existingAss.teacherName}`
                            : isSameTeacher
                            ? `Already assigned to selected teacher`
                            : `Click to select Section ${sec}`
                        }
                        className={`text-xs px-2.5 py-1 rounded-md border font-medium transition ${
                          isOtherTeacher
                            ? "bg-amber-50 border-amber-300 text-amber-800 cursor-not-allowed opacity-80"
                            : isSelected
                            ? "bg-primary text-white border-primary shadow-xs"
                            : "bg-background border-line text-ink hover:border-primary"
                        }`}
                      >
                        {isOtherTeacher
                          ? `🔒 Sec ${sec} (${existingAss.teacherName})`
                          : isSelected
                          ? `✓ Section ${sec}`
                          : `+ Section ${sec}`}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedSections.length > 0 && (
              <div className="mb-3">
                <label className="block text-sm font-semibold text-ink mb-1.5">
                  Selected Sections:
                </label>
                <div className="flex flex-wrap gap-2">
                  {selectedSections.map(section => (
                    <span
                      key={section}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm"
                      style={{
                        backgroundColor: `${themeColors.primary}20`,
                        color: themeColors.primary
                      }}
                    >
                      {section}
                      <button
                        type="button"
                        onClick={() => handleRemoveSection(section)}
                        className="hover:text-primary-dark"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedSections.length === 0 && (
              <p className="text-sm text-amber-600 mt-2">
                ⚠️ Please add at least one section
              </p>
            )}

            {selectedSections.length > 0 && (
              <p className="text-sm text-green-600 mt-2">
                ✓ {selectedSections.length} section(s) selected
              </p>
            )}
          </div>

          <div
            className="p-4 rounded-lg"
            style={{
              backgroundColor: `${themeColors.primary}10`,
              border: `1px solid ${themeColors.primary}20`
            }}
          >
            <p className="text-sm flex items-center gap-2" style={{ color: themeColors.primary }}>
              <BookMarked className="w-4 h-4" />
              Note: Subject will be assigned to the selected teacher for all chosen sections
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseModal}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!formData.teacherId || !formData.subjectId || selectedSections.length === 0 || submitting}
              loading={submitting}
              style={{ backgroundColor: themeColors.primary }}
            >
              {submitting
                ? (editingGroup ? "Updating Assignment..." : "Assigning Subject...")
                : (editingGroup ? "Update Assignment" : "Create Assignment")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Group Details Modal */}
      <Modal isOpen={showDetailsModal} onClose={() => setShowDetailsModal(false)} title="Assignment Group Details" size="lg">
        {selectedGroup && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{
                  backgroundColor: `${themeColors.primary}20`,
                  color: themeColors.primary
                }}
              >
                <span className="text-2xl font-semibold">
                  {selectedGroup.teacher?.name?.charAt(0)?.toUpperCase()}
                </span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-ink">{selectedGroup.teacher?.name}</h2>
                <p className="text-ink-soft">{selectedGroup.teacher?.email}</p>
                <p className="text-sm text-ink-faint">Roll No: {selectedGroup.teacher?.rollNo || 'N/A'}</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 bg-background rounded-lg">
                <p className="text-sm text-ink-soft mb-1">Subject</p>
                <p className="font-medium text-ink">{selectedGroup.subject?.subjectName}</p>
                <p className="text-sm text-ink-soft">Code: {selectedGroup.subject?.subjectCode}</p>
                {selectedGroup.subject?.semester && (
                  <p className="text-sm text-ink-soft">Semester: {selectedGroup.subject.semester}</p>
                )}
                {selectedGroup.subject?.credits > 0 && (
                  <p className="text-sm text-ink-soft">Credits: {selectedGroup.subject.credits}</p>
                )}
              </div>
              <div className="p-4 bg-background rounded-lg">
                <p className="text-sm text-ink-soft mb-1">Assigned Sections</p>
                <div className="flex flex-wrap gap-2">
                  {selectedGroup.sections.map(section => (
                    <span
                      key={section}
                      className="px-3 py-1 rounded-full text-sm"
                      style={{
                        backgroundColor: `${themeColors.primary}20`,
                        color: themeColors.primary
                      }}
                    >
                      Section {section}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-ink-soft mt-2">
                  Total: {selectedGroup.sections.length} sections
                </p>
              </div>
            </div>

            <div className="p-4 bg-background rounded-lg">
              <p className="text-sm text-ink-soft mb-2">Assignment Statistics</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-ink-faint">Total Assignments</p>
                  <p className="text-xl font-bold text-ink">{selectedGroup.assignments.length}</p>
                </div>
                <div>
                  <p className="text-xs text-ink-faint">Students Updated</p>
                  <p className="text-xl font-bold text-green-600">{selectedGroup.totalStudentsUpdated}</p>
                </div>
                <div>
                  <p className="text-xs text-ink-faint">First Assigned</p>
                  <p className="text-sm font-medium text-ink">
                    {new Date(selectedGroup.firstAssignedDate).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-ink-faint">Last Assigned</p>
                  <p className="text-sm font-medium text-ink">
                    {new Date(selectedGroup.lastAssignedDate).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-background rounded-lg">
              <p className="text-sm text-ink-soft mb-3">Assignment History</p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {selectedGroup.assignments.map((assignment, idx) => (
                  <div key={assignment._id} className="flex items-center justify-between p-3 bg-surface rounded-lg border border-line">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-ink-faint">#{idx + 1}</span>
                      <span className="text-sm font-medium" style={{ color: themeColors.primary }}>Section {assignment.section}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-ink-faint">
                        {new Date(assignment.assignedDate).toLocaleString()}
                      </span>
                      {assignment.studentsUpdated > 0 && (
                        <span className="text-xs text-green-600">
                          {assignment.studentsUpdated} students
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AssignSubjects;
