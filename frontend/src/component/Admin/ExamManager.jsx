import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { FileText, Plus, Edit, Trash2, Eye, ClipboardList, Clock, Filter, Settings, GraduationCap, AlertCircle, Shield, Building2, Grid } from "lucide-react";
import { Link } from "react-router-dom";
import api from "../../utils/api";
import { logError } from "../../utils/logger";
import Modal from "../common/ui/Modal";
import Button from "../common/ui/Button";
import Card from "../common/ui/Card";
import Badge from "../common/ui/Badge";
import DashboardHeader from "../common/ui/DashboardHeader";
import EmptyState from "../common/ui/EmptyState";
import Table from "../common/ui/Table";
import Input, { Select, Textarea } from "../common/ui/Input";
import { usePermissions } from "../../contexts/PermissionsContext";
import BulkImportModal from "../common/ui/BulkImportModal";
import { useToast } from "../../contexts/ToastContext";
import { formatDateDMY, formatDateTime, formatDateReadable } from "../../utils/dateUtils";

const BULK_EXAMPLE = `[
  {
    "courseCode": "BCOM",
    "subjectId": "<subject _id>",
    "subjectName": "Financial Accounting",
    "section": "A",
    "title": "Midterm",
    "type": "midterm",
    "shift": "I",
    "date": "2026-08-15",
    "maxMarks": 100,
    "room": "Hall A"
  }
]`;

const BULK_EXAMS_COLUMNS = [
  { key: "courseCode", label: "Course Code", required: true, description: "Code of the course, e.g. BCOM", example: "BCOM" },
  { key: "semester", label: "Semester", required: false, description: "Semester number (1-12)", example: 1 },
  { key: "subjectId", label: "Subject ID", required: true, description: "MongoDB _id of the subject", example: "667fa9a9..." },
  { key: "section", label: "Section", required: true, description: "Class section, e.g. A, B", example: "A" },
  { key: "title", label: "Title", required: true, description: "Exam title", example: "Midterm" },
  { key: "shift", label: "Shift", required: true, description: "I | II | III | IV", example: "I" },
  { key: "date", label: "Date", required: true, description: "YYYY-MM-DD", example: "2026-08-15" },
  { key: "maxMarks", label: "Max Marks", required: true, description: "Positive number", example: 100 },
  { key: "examTypeCode", label: "Exam Type Code", required: false, description: "Code from Exam Config, e.g. midterm", example: "midterm" },
  { key: "examPeriodId", label: "Exam Period Name", required: false, description: "Name of the exam period", example: "Mid-Sem 1" },
  { key: "subjectName", label: "Subject Name", required: false, description: "Display name", example: "Mathematics" },
  { key: "subjectCode", label: "Subject Code", required: false, description: "Short code", example: "MATH101" },
  { key: "startTime", label: "Start Time", required: false, description: "HH:MM 24-hour (defaults from shift)", example: "09:00" },
  { key: "endTime", label: "End Time", required: false, description: "HH:MM 24-hour (defaults from shift)", example: "10:15" },
  { key: "passingMarks", label: "Passing Marks", required: false, description: "Defaults 40% of maxMarks", example: 40 },
  { key: "room", label: "Exam Hall Code (Room)", required: true, description: "Registered Exam Hall Code (e.g. HALL-101)", example: "HALL-101" },
  { key: "description", label: "Description", required: false, description: "Notes", example: "Open book" },
  { key: "isBacklog", label: "Supplementary (Backlog)", required: false, description: "true/false — marks this as a supplementary/backlog exam", example: "false" },
  { key: "isActive", label: "Is Active", required: false, description: "true or false (default true)", example: true },
];

const ExamManager = () => {
  const { can, role } = usePermissions();
  const { success: toastSuccess, error: toastError } = useToast();
  const canCreateExam = can("exam:create");
  const canPublish = can("exam:publish");
  const isAdmin = role === "admin";

  const [exams, setExams] = useState([]);
  const [courses, setCourses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [teacherAssignments, setTeacherAssignments] = useState({});
  const [shifts, setShifts] = useState([]);
  const [examTypes, setExamTypes] = useState([]);
  const [examPeriods, setExamPeriods] = useState([]);
  const [examHalls, setExamHalls] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingExam, setEditingExam] = useState(null);
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedSemester, setSelectedSemester] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [examDetail, setExamDetail] = useState(null);
  const [showPeriodForm, setShowPeriodForm] = useState(false);
  const [newPeriod, setNewPeriod] = useState({ name: "", startDate: "", endDate: "", examTypeCode: "" });

  const [formData, setFormData] = useState({
    courseId: "", branch: "", semester: "", subjectId: "", title: "", type: "", shift: "I",
    section: "", date: "", startTime: "", endTime: "",
    maxMarks: 100, room: "", description: "", duration: "",
    examPeriodId: "", invigilators: [], isBacklog: false,
  });

  useEffect(() => { fetchInitial(); }, []);

  useEffect(() => {
    fetchExams(selectedSection, selectedSemester, selectedCourse, selectedBranch);
  }, [selectedCourse, selectedBranch, selectedSemester, selectedSection]);

  useEffect(() => {
    if (error || success) {
      const t = setTimeout(() => { setError(null); setSuccess(null); }, 4000);
      return () => clearTimeout(t);
    }
  }, [error, success]);

  const fetchInitial = async () => {
    try {
      let subjectList = [];
      let assignmentsMap = {};

      const [coursesRes, structRes, periodsRes, hallsRes, studentsRes] = await Promise.all([
        api.get("/academic/courses").catch(() => ({ data: {} })),
        api.get("/exams/structure").catch(() => ({ data: {} })),
        api.get("/exams/periods").catch(() => ({ data: { data: [] } })),
        api.get("/exams/seating/halls?isActive=true").catch(() => ({ data: { data: [] } })),
        api.get("/users/students?limit=2000").catch(() => ({ data: { data: [] } })),
      ]);

      const cList = Array.isArray(coursesRes.data?.data) ? coursesRes.data.data
        : (Array.isArray(coursesRes.data) ? coursesRes.data : []);
      setCourses(cList);

      const struct = structRes.data?.data || {};
      setShifts(struct.shifts || []);
      setExamTypes((struct.examTypes || []).filter((t) => t.isActive !== false));
      setExamPeriods(periodsRes.data?.data || []);
      setExamHalls(hallsRes.data?.data || []);
      const stdList = Array.isArray(studentsRes.data?.data) ? studentsRes.data.data : (Array.isArray(studentsRes.data) ? studentsRes.data : []);
      setStudents(stdList);

      // Fetch subjects + teachers to derive sections from assignments
      try {
        const [subjectsRes, teachersRes] = await Promise.all([
          api.get("/admin/subjects").catch(() => ({ data: { data: [] } })),
          api.get("/admin/teachers").catch(() => ({ data: { data: [] } })),
        ]);
        subjectList = subjectsRes.data.data || [];

        // Build assignmentsMap: subjectId → Set of sections
        const teacherList = Array.isArray(teachersRes.data?.data) ? teachersRes.data.data : [];
        setTeachers(teacherList);
        teacherList.forEach((teacher) => {
          const abs = teacher.assignmentsBySection || {};
          Object.entries(abs).forEach(([section, assignments]) => {
            if (!Array.isArray(assignments)) return;
            assignments.forEach((a) => {
              const subId = a.subjectId?._id || a.subjectId || "";
              if (subId) {
                if (!assignmentsMap[String(subId)]) assignmentsMap[String(subId)] = new Set();
                assignmentsMap[String(subId)].add(section);
              }
            });
          });
        });
      } catch (err) {
        // Fallback for teachers
        try {
          const fallback = await api.get("/subjects/all");
          const all = fallback.data?.allActiveSubjects || [];
          const assigned = fallback.data?.assignedSubjects?.subjects || [];
          subjectList = all.map((s) => ({
            _id: s.id, subjectCode: s.subjectCode, subjectName: s.subjectName,
            semester: s.semester, courseId: s.courseId, branch: s.branch,
          }));
          // Build from assigned subjects
          assigned.forEach((a) => {
            const subId = a.subject?.id || a.subjectId || "";
            if (subId && a.section) {
              if (!assignmentsMap[String(subId)]) assignmentsMap[String(subId)] = new Set();
              assignmentsMap[String(subId)].add(a.section);
            }
          });
        } catch (e2) {
          logError("Fetch fallback subjects", e2);
        }
      }

      setSubjects(subjectList);
      setTeacherAssignments(assignmentsMap);
    } catch (err) {
      logError("Fetch Initial Data", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchExams = async (sec = selectedSection, sem = selectedSemester, crs = selectedCourse, br = selectedBranch) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (sec) params.append("section", sec);
      if (sem) params.append("semester", sem);
      if (crs) params.append("courseId", crs);
      if (br) params.append("branch", br);
      const q = params.toString() ? `?${params.toString()}` : "";
      const res = await api.get(`/exams${q}`);
      setExams(res.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch exams");
    } finally {
      setLoading(false);
    }
  };

  // Branches available for the selected course in modal
  const availableBranches = useMemo(() => {
    if (!formData.courseId) return [];
    const courseObj = courses.find((c) => String(c._id) === String(formData.courseId));
    const map = new Map();
    if (courseObj?.branches && Array.isArray(courseObj.branches)) {
      courseObj.branches.filter((b) => b.isActive !== false).forEach((b) => {
        map.set(b.name, b.code ? `${b.name} (${b.code})` : b.name);
      });
    }
    subjects.forEach((s) => {
      if (String(s.courseId) === String(formData.courseId) && s.branch) {
        if (!map.has(s.branch)) map.set(s.branch, s.branch);
      }
    });
    return Array.from(map.entries()).map(([name, label]) => ({ name, label }));
  }, [courses, subjects, formData.courseId]);

  // Branches for top filter bar
  const filterBranches = useMemo(() => {
    const map = new Map();
    if (selectedCourse) {
      const courseObj = courses.find((c) => String(c._id) === String(selectedCourse));
      if (courseObj?.branches && Array.isArray(courseObj.branches)) {
        courseObj.branches.filter((b) => b.isActive !== false).forEach((b) => {
          map.set(b.name, b.code ? `${b.name} (${b.code})` : b.name);
        });
      }
      subjects.forEach((s) => {
        if (String(s.courseId) === String(selectedCourse) && s.branch) {
          if (!map.has(s.branch)) map.set(s.branch, s.branch);
        }
      });
    } else {
      courses.forEach((c) => {
        (c.branches || []).filter((b) => b.isActive !== false).forEach((b) => {
          map.set(b.name, b.code ? `${b.name} (${b.code})` : b.name);
        });
      });
      subjects.forEach((s) => {
        if (s.branch && !map.has(s.branch)) map.set(s.branch, s.branch);
      });
    }
    return Array.from(map.entries()).map(([name, label]) => ({ name, label }));
  }, [courses, subjects, selectedCourse]);

  // Semesters available for the selected course & branch
  const availableSemesters = useMemo(() => {
    if (!formData.courseId) return [];
    const set = new Set();
    subjects.forEach((s) => {
      if (String(s.courseId) === String(formData.courseId)) {
        if (!formData.branch || !s.branch || String(s.branch).toUpperCase() === String(formData.branch).toUpperCase()) {
          if (s.semester) set.add(String(s.semester));
        }
      }
    });
    const courseObj = courses.find((c) => String(c._id) === String(formData.courseId));
    if (courseObj) {
      let totalSems = courseObj.durationYears ? courseObj.durationYears * (courseObj.semestersPerYear || 2) : 8;
      if (formData.branch && courseObj.branches) {
        const br = courseObj.branches.find(b => b.name === formData.branch || b.code === formData.branch);
        if (br?.totalSemesters) totalSems = br.totalSemesters;
      }
      for (let i = 1; i <= totalSems; i++) {
        set.add(String(i));
      }
    }
    return [...set].sort((a, b) => parseInt(a) - parseInt(b));
  }, [subjects, courses, formData.courseId, formData.branch]);

  // Semesters for top filter bar
  const filterSemesters = useMemo(() => {
    const set = new Set();
    if (selectedCourse) {
      subjects.forEach((s) => {
        if (String(s.courseId) === String(selectedCourse)) {
          if (!selectedBranch || !s.branch || String(s.branch).toUpperCase() === String(selectedBranch).toUpperCase()) {
            if (s.semester) set.add(String(s.semester));
          }
        }
      });
      const courseObj = courses.find((c) => String(c._id) === String(selectedCourse));
      if (courseObj) {
        const totalSems = courseObj.durationYears ? courseObj.durationYears * (courseObj.semestersPerYear || 2) : 8;
        for (let i = 1; i <= totalSems; i++) set.add(String(i));
      }
    } else {
      subjects.forEach((s) => { if (s.semester) set.add(String(s.semester)); });
      exams.forEach((e) => { if (e.semester) set.add(String(e.semester)); });
      if (set.size === 0) [1, 2, 3, 4, 5, 6, 7, 8].forEach((i) => set.add(String(i)));
    }
    return [...set].sort((a, b) => parseInt(a) - parseInt(b));
  }, [subjects, courses, exams, selectedCourse, selectedBranch]);

  // Subjects filtered by selected course, branch AND semester
  const filteredSubjects = useMemo(() => {
    if (!formData.courseId) return subjects;
    let list = subjects.filter((s) => String(s.courseId) === String(formData.courseId));

    if (formData.branch) {
      const targetBranchUpper = String(formData.branch).trim().toUpperCase();
      list = list.filter((s) => {
        if (!s.branch) return true; // generic/common subjects for the course
        const sBranchUpper = String(s.branch).trim().toUpperCase();
        return sBranchUpper === targetBranchUpper || sBranchUpper.includes(targetBranchUpper) || targetBranchUpper.includes(sBranchUpper);
      });
    }

    if (formData.semester) {
      const targetSemNum = parseInt(String(formData.semester).replace(/\D/g, ""), 10);
      list = list.filter((s) => {
        const sSemNum = parseInt(String(s.semester || "").replace(/\D/g, ""), 10);
        return String(s.semester) === String(formData.semester) || (targetSemNum > 0 && sSemNum === targetSemNum);
      });
    }
    return list;
  }, [subjects, formData.courseId, formData.branch, formData.semester]);

  // Sections for the selected subject (from teacher assignments + fallback sections)
  const filteredSections = useMemo(() => {
    const set = new Set();
    if (formData.subjectId && teacherAssignments[String(formData.subjectId)]) {
      teacherAssignments[String(formData.subjectId)].forEach((s) => set.add(s));
    }
    ["A", "B", "C", "D"].forEach((s) => set.add(s));
    return [...set].sort();
  }, [teacherAssignments, formData.subjectId]);

  // All sections across all subjects (for the grid filter)
  const allSections = useMemo(() => {
    const set = new Set();
    Object.values(teacherAssignments).forEach((secSet) => {
      if (secSet) secSet.forEach((s) => set.add(s));
    });
    return [...set].sort();
  }, [teacherAssignments]);

  // Grid: exams by date+shift
  const examsByDateShift = useMemo(() => {
    const map = {};
    exams.forEach((exam) => {
      const d = exam.date?.split("T")[0] || exam.date;
      const s = exam.shift || "I";
      const key = `${d}__${s}`;
      if (!map[key]) map[key] = [];
      map[key].push(exam);
    });
    return map;
  }, [exams]);

  const dateColumns = useMemo(() => {
    if (selectedDate) return [selectedDate];
    if (exams.length === 0) {
      const today = new Date();
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        return d.toISOString().split("T")[0];
      });
    }
    const dates = [...new Set(exams.map((e) => (e.date || "").split("T")[0]))].sort();
    return dates.slice(0, 14);
  }, [exams, selectedDate]);

  const shiftNames = useMemo(() => {
    const fromExams = [...new Set(exams.map((e) => e.shift).filter(Boolean))];
    const fromConfig = shifts.map((s) => s.name);
    const merged = [...new Set([...fromConfig, ...fromExams])];
    return merged.length > 0 ? merged : ["I", "II", "III", "IV"];
  }, [exams, shifts]);

  // Class strength calculation for formData's selected cohort
  const classStrength = useMemo(() => {
    if (!formData.section) return 0;
    const matching = students.filter((s) => {
      const sSec = String(s.section || "").trim().toUpperCase();
      const targetSec = String(formData.section || "").trim().toUpperCase();
      if (sSec !== targetSec) return false;

      if (formData.courseId) {
        const sCourseId = String(s.courseId?._id || s.courseId || "");
        if (sCourseId && sCourseId !== String(formData.courseId)) return false;
      }

      if (formData.branch) {
        const sBranch = String(s.branch || "").trim().toUpperCase();
        const targetBranch = String(formData.branch || "").trim().toUpperCase();
        if (sBranch && targetBranch && sBranch !== targetBranch && !sBranch.includes(targetBranch) && !targetBranch.includes(sBranch)) {
          return false;
        }
      }

      if (formData.semester) {
        const sSem = parseInt(String(s.semester || "").replace(/\D/g, ""), 10);
        const targetSem = parseInt(String(formData.semester || "").replace(/\D/g, ""), 10);
        if (!isNaN(sSem) && !isNaN(targetSem) && sSem !== targetSem) return false;
      }
      return true;
    });
    return matching.length;
  }, [students, formData.section, formData.courseId, formData.branch, formData.semester]);

  const selectedHall = useMemo(() => {
    if (!formData.room) return null;
    return examHalls.find((h) => h.hallCode === formData.room || String(h._id) === String(formData.room));
  }, [examHalls, formData.room]);

  const isCapacityDeficit = useMemo(() => {
    if (!selectedHall || classStrength === 0) return false;
    return classStrength > (selectedHall.capacity || 0);
  }, [selectedHall, classStrength]);

  // Active / non-expired exam periods (endDate >= today)
  const activeExamPeriods = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    return examPeriods.filter((p) => {
      if (p.isExpired === true) return false;
      const endStr = (p.endDate || "").split("T")[0];
      return !endStr || endStr >= todayStr;
    });
  }, [examPeriods]);

  const handleCourseChange = (courseId) => {
    setFormData((p) => ({
      ...p,
      courseId,
      branch: "",
      semester: "",
      subjectId: "",
      section: "",
    }));
  };

  const handleBranchChange = (branch) => {
    setFormData((p) => ({
      ...p,
      branch,
      semester: "",
      subjectId: "",
      section: "",
    }));
  };

  const handleSemesterChange = (semester) => {
    setFormData((p) => ({
      ...p,
      semester,
      subjectId: "",
      section: "",
    }));
  };

  const openCreate = (date, shift) => {
    setEditingExam(null);
    const shiftDef = shifts.find((s) => s.name === shift);
    const defaultType = examTypes.find((t) => t.code === examTypes[0]?.code);
    const defaultHall = examHalls[0]?.hallCode || "";
    setFormData({
      courseId: selectedCourse || "",
      branch: selectedBranch || "",
      semester: selectedSemester || "",
      subjectId: "", title: "", type: examTypes[0]?.code || "",
      shift: shift || "I", section: selectedSection, date: date || "",
      startTime: shiftDef?.startTime || "", endTime: shiftDef?.endTime || "",
      maxMarks: defaultType?.defaultMaxMarks != null ? defaultType.defaultMaxMarks : 100,
      duration: defaultType?.defaultDuration != null ? defaultType.defaultDuration : "",
      room: defaultHall, description: "", examPeriodId: "", invigilators: [], isBacklog: false,
    });
    setShowForm(true);
  };

  const openEdit = (exam) => {
    setEditingExam(exam);
    setFormData({
      courseId: exam.courseId?._id || exam.courseId || "",
      branch: exam.branch || exam.subjectId?.branch || "",
      semester: exam.semester != null ? String(exam.semester) : (exam.subjectId?.semester ? String(exam.subjectId.semester) : ""),
      subjectId: exam.subjectId?._id || exam.subjectId || "",
      title: exam.title || "",
      type: exam.examTypeCode || exam.type || "",
      shift: exam.shift || "I",
      section: exam.section || "",
      date: exam.date?.split("T")[0] || "",
      startTime: exam.startTime || "",
      endTime: exam.endTime || "",
      maxMarks: exam.maxMarks || 100,
      room: exam.room || "",
      description: exam.description || "",
      duration: exam.duration || "",
      examPeriodId: exam.examPeriodId?._id || exam.examPeriodId || "",
      invigilators: (exam.invigilators || []).map((i) => i._id || i),
      isBacklog: Boolean(exam.isBacklog),
    });
    setShowForm(true);
  };

  // Auto-fill max marks + duration when exam type changes
  const handleTypeChange = (code) => {
    const typeDef = examTypes.find((t) => t.code === code);
    setFormData((p) => ({
      ...p,
      type: code,
      maxMarks: typeDef?.defaultMaxMarks != null ? typeDef.defaultMaxMarks : p.maxMarks,
      duration: typeDef?.defaultDuration != null ? typeDef.defaultDuration : p.duration,
    }));
  };

  // When subject changes, auto-populate section if only one option & auto-populate semester/branch if empty
  const handleSubjectChange = (subjectId) => {
    const secs = teacherAssignments[String(subjectId)] || [];
    const secArr = [...secs];
    const sub = subjects.find((s) => String(s._id) === String(subjectId));
    setFormData((p) => ({
      ...p,
      subjectId,
      branch: p.branch || sub?.branch || "",
      semester: p.semester || (sub?.semester ? String(sub.semester) : ""),
      section: secArr.length === 1 ? secArr[0] : "",
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.courseId || !formData.semester || !formData.subjectId || !formData.title || !formData.section || !formData.date || !formData.shift || !formData.room || (!formData.isBacklog && !formData.examPeriodId)) {
      setError("Fill all required fields (Course, Semester, Subject, Section, Period, Date, Shift, Exam Hall)");
      return;
    }
    if (examHalls.length === 0) {
      setError("Cannot create exam: No active Examination Halls found. Please register an exam hall first.");
      return;
    }
    if (activeExamPeriods.length === 0 && !formData.isBacklog) {
      setError("Cannot create exam: All configured Exam Periods have ended (expired). Please configure an active/upcoming Exam Period first.");
      return;
    }
    if (isCapacityDeficit) {
      setError(`Capacity Deficit: Section ${formData.section} has ${classStrength} students, exceeding ${selectedHall?.hallCode} capacity (${selectedHall?.capacity} seats).`);
      return;
    }
    try {
      const subject = filteredSubjects.find((s) => s._id === formData.subjectId) || subjects.find((s) => s._id === formData.subjectId);
      const payload = {
        ...formData,
        semester: formData.semester ? parseInt(formData.semester) : undefined,
        subjectName: subject?.subjectName || "",
        subjectCode: subject?.subjectCode || "",
        invigilators: (formData.invigilators || []).filter(Boolean),
      };
      if (payload.duration !== "" && payload.duration != null && !Number.isNaN(parseInt(payload.duration))) {
        payload.duration = parseInt(payload.duration);
      } else {
        delete payload.duration;
      }
      if (editingExam) {
        await api.put(`/exams/${editingExam._id}`, payload);
        toastSuccess("Exam updated");
      } else {
        await api.post("/exams", payload);
        toastSuccess("Exam created");
      }
      setShowForm(false);
      fetchExams(selectedSection, selectedSemester);
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to save";
      setError(msg);
      toastError(msg);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this exam? All results will be removed.")) return;
    try {
      await api.delete(`/exams/${id}`);
      toastSuccess("Exam deleted");
      fetchExams(selectedSection);
    } catch (err) {
      toastError(err.response?.data?.message || "Failed to delete");
    }
  };

  const viewDetail = async (id) => {
    try {
      const res = await api.get(`/exams/${id}`);
      setExamDetail(res.data.data);
    } catch (err) {
      setError("Failed to load exam details");
    }
  };

  const handlePublish = async (exam) => {
    if (!window.confirm("Publish results for this exam? Students and parents will be able to see them.")) return;
    try {
      await api.post(`/exams/${exam._id}/publish`);
      toastSuccess("Results published");
      if (examDetail?.exam?._id === exam._id) viewDetail(exam._id);
      fetchExams(selectedSection);
    } catch (err) {
      toastError(err.response?.data?.message || "Failed to publish results");
    }
  };

  const handleUnpublish = async (exam) => {
    if (!window.confirm("Unpublish results for this exam? Students and parents will no longer see them.")) return;
    try {
      await api.post(`/exams/${exam._id}/unpublish`);
      toastSuccess("Results unpublished");
      if (examDetail?.exam?._id === exam._id) viewDetail(exam._id);
      fetchExams(selectedSection);
    } catch (err) {
      toastError(err.response?.data?.message || "Failed to unpublish results");
    }
  };

  const handleCreatePeriod = async () => {
    if (!newPeriod.name || !newPeriod.startDate || !newPeriod.endDate) {
      toastError("Period name, start and end dates are required");
      return;
    }
    try {
      const updated = [...examPeriods, newPeriod];
      await api.put("/exams/periods", { examPeriods: updated });
      setExamPeriods(updated);
      setShowPeriodForm(false);
      setNewPeriod({ name: "", startDate: "", endDate: "", examTypeCode: "" });
      toastSuccess("Exam period created");
    } catch (err) {
      toastError(err.response?.data?.message || "Failed to create period");
    }
  };

  const getStatusTone = (status) => {
    if (status === "scheduled") return "info";
    if (status === "completed") return "success";
    if (status === "cancelled") return "danger";
    return "warning";
  };

  const detailColumns = [
    { header: "Student", cell: (r) => <span className="font-medium">{r.studentId?.name}</span> },
    { header: "Roll No", cell: (r) => <span className="text-ink-soft">{r.studentId?.rollNo}</span> },
    { header: "Marks", cell: (r) => (r.status === "graded" ? `${r.marksObtained}/${r.maxMarks}` : "—") },
    { header: "Grade", cell: (r) => <span className="font-semibold">{r.grade || "—"}</span> },
    { header: "Status", cell: (r) => <Badge tone={r.status === "graded" ? "success" : "warning"}>{r.status}</Badge> },
  ];

  const formatDateHeader = (dateStr) => {
    return formatDateReadable(dateStr, true);
  };

  const isToday = (dateStr) => {
    const today = new Date().toISOString().split("T")[0];
    return dateStr === today;
  };

  const getCourseCode = (exam) => {
    if (exam.courseCode) return exam.courseCode;
    const course = courses.find((c) => String(c._id) === String(exam.courseId));
    return course?.code || "";
  };

  if (loading && exams.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-16 h-16 border-4 border-primary-soft border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DashboardHeader
        greeting="Institutional Examination Center"
        meta={`Central examination scheduling, shift assignments, seating manifests, and result grading (${exams.length} exams registered)`}
        actions={
          canCreateExam ? (
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="subtle" size="sm" leftIcon={ClipboardList} onClick={() => setShowBulk(true)}>
                Bulk Import
              </Button>
              {isAdmin && (
                <>
                  <Button leftIcon={Building2} variant="subtle" size="sm" asChild>
                    <Link to="/admin/exams/halls">Exam Halls</Link>
                  </Button>
                  <Button leftIcon={Grid} variant="subtle" size="sm" asChild>
                    <Link to="/admin/exams/seating">Seating Engine</Link>
                  </Button>
                  <Button leftIcon={Settings} variant="subtle" size="sm" asChild>
                    <Link to="/admin/exam-structure">Exam Config</Link>
                  </Button>
                </>
              )}
              <Button variant="primary" size="sm" onClick={() => openCreate(dateColumns[0] || "", "I")} leftIcon={Plus}>
                Create Exam
              </Button>
            </div>
          ) : null
        }
      />

      {/* Filter Toolbar */}
      <Card padding="md" bordered>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-ink-soft uppercase tracking-wider mb-1">Course</label>
            <select
              value={selectedCourse}
              onChange={(e) => { setSelectedCourse(e.target.value); setSelectedBranch(""); setSelectedSemester(""); setSelectedSection(""); }}
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-line/50 bg-background text-ink outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
              <option value="">All Courses</option>
              {courses.map((c) => <option key={c._id} value={c._id}>{c.name} ({c.code})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-ink-soft uppercase tracking-wider mb-1">Branch</label>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-line/50 bg-background text-ink outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
              <option value="">All Branches</option>
              {filterBranches.map((b) => <option key={b.name} value={b.name}>{b.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-ink-soft uppercase tracking-wider mb-1">Semester</label>
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-line/50 bg-background text-ink outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
              <option value="">All Semesters</option>
              {filterSemesters.map((s) => <option key={s} value={s}>Semester {s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-ink-soft uppercase tracking-wider mb-1">Section</label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-line/50 bg-background text-ink outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
              <option value="">All Sections</option>
              {allSections.map((s) => <option key={s} value={s}>Section {s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-ink-soft uppercase tracking-wider mb-1">Exam Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-line/50 bg-background text-ink outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            />
          </div>
        </div>
      </Card>

      {/* No periods warning */}
      {canCreateExam && examPeriods.length === 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-semibold">No Exam Periods configured</p>
            {isAdmin ? (
              <p className="text-xs mt-0.5">You must create an exam period before scheduling exams. Go to <Link to="/admin/exam-structure" className="underline font-bold">Exam Config</Link> to set one up.</p>
            ) : (
              <p className="text-xs mt-0.5">No exam periods have been configured yet. Please ask your admin to set them up.</p>
            )}
          </div>
        </div>
      )}

      {/* Date x Shift Grid */}
      {exams.length === 0 && !loading ? (
        <EmptyState
          title="No Exams Scheduled"
          description="No exams match your current filters"
          icon={FileText}
          action={canCreateExam ? <Button onClick={() => openCreate(dateColumns[0] || "", "I")} leftIcon={Plus}>Create Exam</Button> : null}
        />
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="p-3 bg-background border-b border-r border-line text-left text-xs font-bold text-ink-faint uppercase tracking-wider w-32">
                    Shift
                  </th>
                  {dateColumns.map((date) => (
                    <th
                      key={date}
                      className={`p-3 bg-background border-b border-r border-line text-center text-xs font-bold uppercase tracking-wider min-w-[180px] ${
                        isToday(date) ? "text-primary bg-primary-soft" : "text-ink-faint"
                      }`}
                    >
                      {formatDateHeader(date)}
                      {isToday(date) && <div className="text-[10px] text-primary font-normal mt-0.5">Today</div>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shiftNames.map((shift) => {
                  const shiftDef = shifts.find((s) => s.name === shift);
                  return (
                    <tr key={shift}>
                      <td className="p-3 border-b border-r border-line bg-background">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-ink">Shift {shift}</span>
                          {shiftDef && (
                            <span className="text-[11px] text-ink-faint flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {shiftDef.startTime} - {shiftDef.endTime}
                            </span>
                          )}
                        </div>
                      </td>
                      {dateColumns.map((date) => {
                        const key = `${date}__${shift}`;
                        const cellExams = examsByDateShift[key] || [];
                        return (
                          <td key={key} className="border-b border-r border-line p-1 align-top min-h-[100px]">
                            {cellExams.length > 0 ? (
                              <div className="space-y-1">
                                {cellExams.map((exam) => {
                                  const courseCode = getCourseCode(exam);
                                  return (
                                    <div
                                      key={exam._id}
                                      className="relative group p-2 rounded-lg bg-primary-soft border border-primary-surface min-h-[70px]"
                                    >
                                      <div className="flex items-center justify-between gap-1 mb-0.5">
                                        <p className="text-xs font-semibold text-primary-dark truncate">{exam.title}</p>
                                        <div className="flex items-center gap-1">
                                          {exam.isBacklog && <Badge tone="danger" className="text-[10px] px-1 py-0">Supplementary</Badge>}
                                          <Badge tone={exam.resultStatus === "published" ? "success" : "warning"} className="text-[10px] px-1 py-0">
                                            {exam.resultStatus === "published" ? "Published" : "Draft"}
                                          </Badge>
                                          <Badge tone={getStatusTone(exam.status)} className="text-[10px] px-1 py-0">{exam.status}</Badge>
                                        </div>
                                      </div>
                                      <p className="text-xs text-primary truncate">{exam.subjectName}</p>
                                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/20">
                                          {courseCode ? `${courseCode}` : ""}{exam.branch ? ` • ${exam.branch}` : ""} • Sec {exam.section}
                                        </span>
                                        {exam.semester && (
                                          <span className="text-[10px] text-ink-faint">Sem {exam.semester}</span>
                                        )}
                                      </div>
                                      <div className="flex flex-wrap gap-x-2 mt-1 text-[11px] text-ink-soft">
                                        <span>{exam.startTime}-{exam.endTime}</span>
                                        {exam.room && <span className="font-semibold text-primary/80">🏛️ {exam.room}</span>}
                                      </div>
                                      {exam.invigilators?.length > 0 && (
                                        <div className="mt-1 text-[10px] text-primary/70 truncate">
                                          <Shield className="w-3 h-3 inline mr-0.5" />
                                          {exam.invigilators.map((i) => i.name || i).join(", ")}
                                        </div>
                                      )}
                                      <div className="absolute top-1 right-1 hidden group-hover:flex gap-1">
                                        <button onClick={() => viewDetail(exam._id)} className="p-1 bg-surface rounded shadow-sm hover:bg-background"><Eye className="w-3 h-3 text-primary" /></button>
                                        {canCreateExam && <button onClick={() => openEdit(exam)} className="p-1 bg-surface rounded shadow-sm hover:bg-background"><Edit className="w-3 h-3 text-primary" /></button>}
                                        {canCreateExam && <button onClick={() => handleDelete(exam._id)} className="p-1 bg-surface rounded shadow-sm hover:bg-background"><Trash2 className="w-3 h-3 text-red-600" /></button>}
                                      </div>
                                    </div>
                                  );
                                })}
                                {canCreateExam && (
                                  <button
                                    onClick={() => openCreate(date, shift)}
                                    className="w-full h-8 rounded-lg border-2 border-dashed border-primary/30 hover:border-primary/60 hover:bg-primary-soft/40 transition flex items-center justify-center opacity-0 hover:opacity-100"
                                  >
                                    <Plus className="w-3.5 h-3.5 text-primary" />
                                  </button>
                                )}
                              </div>
                            ) : (
                              canCreateExam ? (
                                <button
                                  onClick={() => openCreate(date, shift)}
                                  className="w-full min-h-[100px] rounded-lg border-2 border-dashed border-line hover:border-primary/40 hover:bg-primary-soft/40 transition flex items-center justify-center opacity-0 hover:opacity-100"
                                >
                                  <Plus className="w-4 h-4 text-ink-faint" />
                                </button>
                              ) : (
                                <div className="w-full min-h-[100px] flex items-center justify-center text-xs text-ink-faint">
                                  No exam
                                </div>
                              )
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create/Edit Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingExam ? "Edit Exam" : "Create Exam"} size="lg" error={error}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Missing or Expired Exam Period Warning */}
          {activeExamPeriods.length === 0 && !formData.isBacklog && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-700 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                <span>
                  <strong>No Active Exam Periods:</strong> {examPeriods.length > 0 ? "All configured exam periods have already ended (expired). You cannot schedule exams in completed periods." : "You must configure an exam period before scheduling exams."}
                </span>
              </div>
              <Button type="button" size="xs" variant="outline" onClick={() => setShowPeriodForm(true)}>+ New Period</Button>
            </div>
          )}

          {examHalls.length === 0 && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-700 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span><strong>No Exam Halls Registered:</strong> You cannot create exams without registered examination venues.</span>
              </div>
              <Button type="button" size="xs" asChild>
                <Link to="/admin/exams/halls">+ Add Exam Hall</Link>
              </Button>
            </div>
          )}

          <div className="p-3 rounded-xl bg-primary-soft/50 border border-primary/10 text-xs text-primary-dark">
            <p className="font-semibold mb-1">Required fields</p>
            <p>Course → Branch (optional) → Semester → Subject → Section → Exam Period → Exam Hall → Date & Shift are all required.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {/* Step 1: Course */}
            <Select label="1. Course *" value={formData.courseId} onChange={(e) => handleCourseChange(e.target.value)} required>
              <option value="">Select Course...</option>
              {courses.map((c) => <option key={c._id} value={c._id}>{c.name} ({c.code})</option>)}
            </Select>

            {/* Step 2: Branch (Specialization) */}
            <Select
              label="2. Branch (Specialization)"
              value={formData.branch}
              onChange={(e) => handleBranchChange(e.target.value)}
              disabled={!formData.courseId}
            >
              <option value="">
                {!formData.courseId
                  ? "Select course first"
                  : availableBranches.length === 0
                  ? "All / No specific branch"
                  : "All Branches..."}
              </option>
              {availableBranches.map((b) => (
                <option key={b.name} value={b.name}>
                  {b.label}
                </option>
              ))}
            </Select>

            {/* Step 3: Semester (Course + Branch -> Semester -> Subject) */}
            <Select label="3. Semester *" value={formData.semester} onChange={(e) => handleSemesterChange(e.target.value)} required disabled={!formData.courseId}>
              <option value="">{!formData.courseId ? "Select course first" : availableSemesters.length === 0 ? "No semesters found" : "Select Semester..."}</option>
              {availableSemesters.map((sem) => <option key={sem} value={sem}>Semester {sem}</option>)}
            </Select>

            {/* Step 4: Subject (filtered by course, branch & semester) */}
            <Select label="4. Subject *" value={formData.subjectId} onChange={(e) => handleSubjectChange(e.target.value)} required disabled={!formData.courseId}>
              <option value="">{!formData.courseId ? "Select course first" : filteredSubjects.length === 0 ? "No subjects match filter" : "Select Subject..."}</option>
              {filteredSubjects.map((s) => <option key={s._id} value={s._id}>{s.subjectCode} — {s.subjectName} {s.branch ? `(${s.branch})` : ""}</option>)}
            </Select>

            {/* Step 5: Section (from teacher assignments for selected subject) */}
            <Select label="5. Section *" value={formData.section} onChange={(e) => setFormData((p) => ({ ...p, section: e.target.value }))} required disabled={!formData.subjectId}>
              <option value="">{!formData.subjectId ? "Select subject first" : filteredSections.length === 0 ? "No sections assigned — assign subject to teacher first" : "Select Section..."}</option>
              {filteredSections.map((s) => <option key={s} value={s}>Section {s}</option>)}
            </Select>

            {/* Step 6: Exam Period (disabled for backlog exams) */}
            <div className="flex gap-2">
              <Select
                label="6. Exam Period *"
                value={formData.isBacklog ? "" : formData.examPeriodId}
                onChange={(e) => setFormData((p) => ({ ...p, examPeriodId: e.target.value }))}
                required
                disabled={formData.isBacklog}
                className="flex-1"
                hint={formData.isBacklog ? "Backlog exams are not tied to a scheduled period" : undefined}
              >
                <option value="">
                  {formData.isBacklog
                    ? "Not applicable for backlog"
                    : activeExamPeriods.length === 0
                    ? "No active periods (all ended) — create new"
                    : "Select Period..."}
                </option>
                {examPeriods.map((p, i) => {
                  const endStr = (p.endDate || "").split("T")[0];
                  const todayStr = new Date().toISOString().split("T")[0];
                  const isPast = p.isExpired || (endStr && endStr < todayStr);
                  return (
                    <option
                      key={i}
                      value={p._id || p.name}
                      disabled={isPast}
                    >
                      {p.name} ({formatDateDMY(p.startDate)} — {formatDateDMY(p.endDate)})
                      {isPast ? " [Expired / Ended]" : ""}
                    </option>
                  );
                })}
              </Select>
              <Button type="button" variant="outline" size="sm" className="mt-6" onClick={() => setShowPeriodForm(true)} disabled={formData.isBacklog}>+ New</Button>
            </div>

            {/* Step 6: Exam Type (auto-fills max marks) */}
            <Select label="6. Exam Type" value={formData.type} onChange={(e) => handleTypeChange(e.target.value)}>
              <option value="">Select Type...</option>
              {examTypes.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
            </Select>

            {/* Step 7: Title */}
            <Input label="7. Title *" value={formData.title} onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))} required placeholder="e.g. Mid-Term Exam" />

            {/* Step 8: Examination Hall (Room) with real-time capacity */}
            <div className="space-y-1">
              <Select
                label="8. Examination Hall (Room) *"
                value={formData.room}
                onChange={(e) => setFormData((p) => ({ ...p, room: e.target.value }))}
                required
              >
                <option value="">{examHalls.length === 0 ? "⚠️ No exam halls found — create one first" : "Select Exam Hall..."}</option>
                {examHalls.map((h) => (
                  <option key={h._id} value={h.hallCode}>
                    {h.hallCode} — {h.name} (Capacity: {h.capacity} seats • {h.building})
                  </option>
                ))}
              </Select>
              {selectedHall && (
                <div className="flex items-center justify-between text-[11px] text-ink-faint px-1">
                  <span>Capacity: <strong>{selectedHall.capacity} seats</strong> ({selectedHall.rows}R × {selectedHall.cols}C)</span>
                  {formData.section && classStrength > 0 && (
                    <span>Sec {formData.section} Enrolled: <strong>{classStrength} students</strong></span>
                  )}
                </div>
              )}
            </div>

            {/* Date & Shift */}
            <Select label="Shift *" value={formData.shift} onChange={(e) => {
              const val = e.target.value;
              const shiftDef = shifts.find((s) => s.name === val);
              setFormData((p) => ({
                ...p,
                shift: val,
                startTime: shiftDef?.startTime || p.startTime,
                endTime: shiftDef?.endTime || p.endTime,
              }));
            }} required>
              {shiftNames.map((s) => <option key={s} value={s}>Shift {s}</option>)}
            </Select>
            <Input label="Date *" type="date" value={formData.date} onChange={(e) => setFormData((p) => ({ ...p, date: e.target.value }))} required />
            <Input label="Start Time" type="time" value={formData.startTime} onChange={(e) => setFormData((p) => ({ ...p, startTime: e.target.value }))} />
            <Input label="End Time" type="time" value={formData.endTime} onChange={(e) => setFormData((p) => ({ ...p, endTime: e.target.value }))} />
            <Input
              label="Max Marks *"
              type="number"
              value={formData.maxMarks}
              onChange={(e) => setFormData((p) => ({ ...p, maxMarks: parseInt(e.target.value) }))}
              required min="1"
              disabled={!editingExam && !!formData.type}
              hint={!editingExam && formData.type ? "Auto-filled from the selected exam type config" : undefined}
            />
          </div>

          {/* Real-time Hall Capacity Deficit Alert */}
          {isCapacityDeficit && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <div>
                <strong className="font-semibold block">⚠️ Hall Capacity Deficit Alert</strong>
                <span>
                  Section {formData.section} has <strong>{classStrength} enrolled students</strong>, which exceeds the seating capacity of {selectedHall?.hallCode} (<strong>{selectedHall?.capacity} seats</strong>). There is a deficit of <strong>{classStrength - (selectedHall?.capacity || 0)} seats</strong>. Please select a larger examination hall.
                </span>
              </div>
            </div>
          )}

          <label className="flex items-center gap-2.5 cursor-pointer select-none p-3 rounded-xl border border-line bg-background">
            <input
              type="checkbox"
              checked={formData.isBacklog}
              onChange={(e) => setFormData((p) => ({ ...p, isBacklog: e.target.checked, examPeriodId: e.target.checked ? "" : p.examPeriodId }))}
              className="w-4 h-4 accent-primary"
            />
            <span className="text-sm font-semibold text-ink">Supplementary / Backlog exam</span>
            <span className="text-xs text-ink-faint">Mark when this is a backlog (re-take) exam used to clear a student's BACK for a failed subject. Results clear the backlog once published.</span>
          </label>
          <Textarea label="Description" value={formData.description} onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))} rows={2} />
          <div>
            <label className="block text-xs font-semibold text-ink mb-1">Invigilators (max 2, optional)</label>
            <div className="flex gap-2">
              <Select value={formData.invigilators[0] || ""} onChange={(e) => setFormData((p) => ({ ...p, invigilators: [e.target.value, p.invigilators[1] || ""].filter(Boolean) }))}>
                <option value="">None</option>
                {teachers.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
              </Select>
              <Select value={formData.invigilators[1] || ""} onChange={(e) => setFormData((p) => ({ ...p, invigilators: [p.invigilators[0] || "", e.target.value].filter(Boolean) }))}>
                <option value="">None</option>
                {teachers.filter((t) => t._id !== formData.invigilators[0]).map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button
              type="submit"
              leftIcon={editingExam ? Edit : Plus}
              disabled={(activeExamPeriods.length === 0 && !formData.isBacklog) || examHalls.length === 0 || isCapacityDeficit}
            >
              {editingExam ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Inline Exam Period Creation Modal */}
      <Modal isOpen={showPeriodForm} onClose={() => setShowPeriodForm(false)} title="Create Exam Period" size="md">
        <div className="space-y-4">
          <p className="text-sm text-ink-soft">An exam period defines a window during which exams of a certain type can be scheduled.</p>
          <Input label="Period Name *" value={newPeriod.name} onChange={(e) => setNewPeriod((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Mid-Semester 1" required />
          <Input label="Start Date *" type="date" value={newPeriod.startDate} onChange={(e) => setNewPeriod((p) => ({ ...p, startDate: e.target.value }))} required />
          <Input label="End Date *" type="date" value={newPeriod.endDate} onChange={(e) => setNewPeriod((p) => ({ ...p, endDate: e.target.value }))} required />
          <Select label="Linked Exam Type (optional)" value={newPeriod.examTypeCode} onChange={(e) => setNewPeriod((p) => ({ ...p, examTypeCode: e.target.value }))}>
            <option value="">None</option>
            {examTypes.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
          </Select>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowPeriodForm(false)}>Cancel</Button>
            <Button onClick={handleCreatePeriod} leftIcon={Plus}>Create Period</Button>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={!!examDetail} onClose={() => setExamDetail(null)} title="Exam Details" size="lg">
        {examDetail && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-background rounded-xl"><p className="text-xs text-ink-faint uppercase">Title</p><p className="font-semibold text-ink">{examDetail.exam.title}</p></div>
              <div className="p-4 bg-background rounded-xl"><p className="text-xs text-ink-faint uppercase">Status</p><p className="font-semibold text-ink capitalize">{examDetail.exam.status}</p></div>
              <div className="p-4 bg-background rounded-xl"><p className="text-xs text-ink-faint uppercase">Results</p>
                <div className="flex items-center gap-2">
                  {examDetail.exam.isBacklog && <Badge tone="danger">Supplementary</Badge>}
                  <Badge tone={examDetail.exam.resultStatus === "published" ? "success" : "warning"}>
                    {examDetail.exam.resultStatus === "published" ? "Published" : "Draft"}
                  </Badge>
                  {examDetail.exam.publishedAt && (
                    <span className="text-[10px] text-ink-faint block">
                      {formatDateTime(examDetail.exam.publishedAt)}
                    </span>
                  )}
                </div>
              </div>
              <div className="p-4 bg-background rounded-xl"><p className="text-xs text-ink-faint uppercase">Course</p><p className="font-semibold text-ink">{getCourseCode(examDetail.exam) || "—"}</p></div>
              <div className="p-4 bg-background rounded-xl"><p className="text-xs text-ink-faint uppercase">Semester</p><p className="font-semibold text-ink">{examDetail.exam.semester ? `Semester ${examDetail.exam.semester}` : "—"}</p></div>
              <div className="p-4 bg-background rounded-xl"><p className="text-xs text-ink-faint uppercase">Subject</p><p className="font-semibold text-ink">{examDetail.exam.subjectName}</p></div>
              <div className="p-4 bg-background rounded-xl"><p className="text-xs text-ink-faint uppercase">Section</p><p className="font-semibold text-ink">{examDetail.exam.section}</p></div>
              <div className="p-4 bg-background rounded-xl"><p className="text-xs text-ink-faint uppercase">Shift</p><p className="font-semibold text-ink">{examDetail.exam.shift || "—"}</p></div>
              <div className="p-4 bg-background rounded-xl"><p className="text-xs text-ink-faint uppercase">Date</p><p className="font-semibold text-ink">{formatDateDMY(examDetail.exam.date)}</p></div>
              <div className="p-4 bg-background rounded-xl"><p className="text-xs text-ink-faint uppercase">Time</p><p className="font-semibold text-ink">{examDetail.exam.startTime} - {examDetail.exam.endTime}</p></div>
              <div className="p-4 bg-background rounded-xl"><p className="text-xs text-ink-faint uppercase">Max Marks</p><p className="font-semibold text-ink">{examDetail.exam.maxMarks}</p></div>
              <div className="p-4 bg-background rounded-xl"><p className="text-xs text-ink-faint uppercase">Room</p><p className="font-semibold text-ink">{examDetail.exam.room || "—"}</p></div>
              <div className="p-4 bg-background rounded-xl"><p className="text-xs text-ink-faint uppercase">Invigilators</p><p className="font-semibold text-ink">{(examDetail.exam.invigilators || []).map((i) => i.name || i).join(", ") || "—"}</p></div>
            </div>
            {canPublish && (
              <div className="flex justify-end">
                {examDetail.exam.resultStatus === "published" ? (
                  <Button variant="outline" onClick={() => handleUnpublish(examDetail.exam)}>
                    Unpublish Results
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={() => handlePublish(examDetail.exam)} disabled={!examDetail.results?.length}>
                    Publish Results
                  </Button>
                )}
              </div>
            )}
            <div>
              <h3 className="font-semibold text-ink mb-3">Results ({examDetail.results?.length || 0} students)</h3>
              {examDetail.results?.length > 0 ? (
                <Table columns={detailColumns} data={examDetail.results} rowKey="_id" />
              ) : (
                <p className="text-sm text-ink-faint font-medium">No results recorded yet</p>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Bulk Import */}
      <BulkImportModal
        isOpen={showBulk}
        onClose={() => setShowBulk(false)}
        endpoint="/exams/bulk"
        bodyKey="exams"
        itemLabel="exams"
        example={BULK_EXAMPLE}
        columns={BULK_EXAMS_COLUMNS}
        exportData={exams}
        onImported={() => { setShowBulk(false); fetchExams(selectedSection); }}
      />
    </div>
  );
};

export default ExamManager;
