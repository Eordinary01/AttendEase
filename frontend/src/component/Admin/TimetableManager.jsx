import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { Calendar, Plus, X, Edit, Trash2, Save, AlertCircle, Check, ChevronDown, ClipboardList, Coffee, GraduationCap } from "lucide-react";
import api from "../../utils/api";
import Modal from "../common/ui/Modal";
import Button from "../common/ui/Button";
import Card from "../common/ui/Card";
import PageHeader from "../common/ui/PageHeader";
import Input, { Select } from "../common/ui/Input";
import BulkImportModal from "../common/ui/BulkImportModal";
import { useToast } from "../../contexts/ToastContext";
import { isBranchMatch, isBranchInList } from "../../utils/branchHelper";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const TIME_SLOTS = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

const BULK_EXAMPLE = `[
  {
    "section": "A",
    "courseCode": "BCOM",
    "branch": "Accounting",
    "semester": "3",
    "day": "Monday",
    "startTime": "09:00",
    "endTime": "10:00",
    "subjectName": "Financial Accounting",
    "subjectCode": "FAC301",
    "teacherName": "Jane Doe",
    "room": "Room 101",
    "isNoClass": false
  },
  {
    "section": "A",
    "courseCode": "BBA",
    "branch": "",
    "semester": "1",
    "day": "Monday",
    "startTime": "10:00",
    "endTime": "11:00",
    "subjectName": "No Class",
    "teacherName": "N/A",
    "room": "",
    "isNoClass": true
  }
]`;

const BULK_TIMETABLE_COLUMNS = [
  { key: "section", label: "Section", required: false, description: "Class section, e.g. A. For regular classes, blank auto-derives from the teacher's subject assignment. Required for No Class rows.", example: "A" },
  { key: "courseCode", label: "Course Code", required: false, description: "Code of the course this class belongs to (same as the manual form). If blank, taken from the subject.", example: "BCOM" },
  { key: "branch", label: "Branch", required: false, description: "Branch within the course (optional)", example: "Accounting" },
  { key: "semester", label: "Semester", required: false, description: "Semester number. If blank, taken from the subject.", example: "3" },
  { key: "day", label: "Day", required: true, description: "Monday to Friday", example: ["Tuesday", "Wednesday", "Thursday"] },
  { key: "startTime", label: "Start Time", required: true, description: "HH:MM 24-hour", example: "09:00" },
  { key: "endTime", label: "End Time", required: true, description: "HH:MM 24-hour, after startTime", example: "10:00" },
  { key: "subjectName", label: "Subject Name", required: true, description: "Use \"No Class\" for a free period", example: "Financial Accounting" },
  { key: "teacherName", label: "Teacher Name", required: true, description: "Assigned teacher. Use N/A for No Class", example: "Jane Doe" },
  { key: "subjectCode", label: "Subject Code", required: false, description: "Short code, e.g. FAC301", example: "FAC301" },
  { key: "teacherId", label: "Teacher ID", required: false, description: "MongoDB _id of teacher (optional, matched by name if blank)", example: "667fa9a9..." },
  { key: "subjectId", label: "Subject ID", required: false, description: "MongoDB _id of subject (optional, matched by name if blank)", example: "667fa9a9..." },
  { key: "room", label: "Room", required: false, description: "Room number / venue", example: "Room 101" },
  { key: "isNoClass", label: "Is No Class", required: false, description: "true/false. Mark free periods", example: false },
  { key: "isActive", label: "Is Active", required: false, description: "true or false (default true)", example: true },
];

const TimetableManager = ({ role = "admin", userId, userName }) => {
  const { success: toastSuccess, error: toastError } = useToast();
  const isTeacher = role === "teacher";
  const [entries, setEntries] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState("");
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teacherAssignments, setTeacherAssignments] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [courses, setCourses] = useState([]);
  const [filterCourse, setFilterCourse] = useState("");
  const [filterBranch, setFilterBranch] = useState("");
  const [filterSemester, setFilterSemester] = useState("");
  const [formData, setFormData] = useState({
    day: "Monday", startTime: "09:00", endTime: "10:00",
    subjectId: "", teacherId: "", section: "", room: "", isNoClass: false,
    courseId: "", courseCode: "", semester: "",
  });
  const [selectedCell, setSelectedCell] = useState(null);
  const [showBulk, setShowBulk] = useState(false);

  useEffect(() => { fetchInitialData(); }, []);

  useEffect(() => {
    if (selectedSection) fetchEntries();
  }, [selectedSection, filterCourse, filterBranch, filterSemester]);

  useEffect(() => {
    if (error || success) {
      const t = setTimeout(() => { setError(null); setSuccess(null); }, 4000);
      return () => clearTimeout(t);
    }
  }, [error, success]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      let teacherList = [];
      let subjectList = [];
      let sectionList = [];
      const assignmentsByTeacher = {};
      if (isTeacher) {
        const [subRes, coursesRes] = await Promise.all([
          api.get('/subjects/all'),
          api.get('/academic/courses').catch(() => ({ data: {} })),
        ]);
        const data = subRes.data || {};
        const allActive = data.allActiveSubjects || [];
        const assigned = data.assignedSubjects?.subjects || [];
        subjectList = allActive.map(s => ({ _id: s.id, subjectCode: s.subjectCode, subjectName: s.subjectName, semester: s.semester, courseId: s.courseId, branch: s.branch }));
        teacherList = [{ _id: userId, name: userName }];
        sectionList = [...new Set(assigned.map(a => a.section).filter(Boolean))];

        // Get IDs of courses the teacher is assigned to
        const assignedCourseIds = new Set();
        assigned.forEach(a => {
          const cid = a.subject?.courseId;
          if (cid) assignedCourseIds.add(String(cid));
        });

        // Filter full course objects to only assigned ones (keeps branches, durationYears, etc.)
        const cList = Array.isArray(coursesRes.data?.data) ? coursesRes.data.data
                    : (Array.isArray(coursesRes.data) ? coursesRes.data : []);
        setCourses(cList.filter(c => assignedCourseIds.has(String(c._id))));

        assignmentsByTeacher[userId] = {};
        assigned.forEach(a => {
          const sec = a.section;
          if (!assignmentsByTeacher[userId][sec]) assignmentsByTeacher[userId][sec] = [];
          assignmentsByTeacher[userId][sec].push({
            subjectId: a.subject?.id || a.subjectId,
            subjectName: a.subject?.subjectName || a.subjectName || "",
            subjectCode: a.subject?.subjectCode || "",
            semester: a.subject?.semester || "",
            courseId: a.subject?.courseId || "",
            courseCode: a.subject?.courseCode || a.subject?.course || "",
            branch: a.subject?.branch || "",
          });
        });
      } else {
        const [teachersRes, subjectsRes, coursesRes] = await Promise.all([
          api.get('/admin/teachers').catch(() => ({ data: {} })),
          api.get('/admin/subjects').catch(() => ({ data: {} })),
          api.get('/academic/courses').catch(() => ({ data: {} })),
        ]);
        const cList = Array.isArray(coursesRes.data?.data) ? coursesRes.data.data : (Array.isArray(coursesRes.data) ? coursesRes.data : []);
        teacherList = Array.isArray(teachersRes.data?.data) ? teachersRes.data.data : (Array.isArray(teachersRes.data) ? teachersRes.data : []);
        subjectList = Array.isArray(subjectsRes.data?.data) ? subjectsRes.data.data : (Array.isArray(subjectsRes.data) ? subjectsRes.data : []);
        setCourses(cList);
        sectionList = [...new Set(teacherList.flatMap(t => t.teachingSections || []).filter(Boolean))];

        teacherList.forEach(t => {
          const map = {};
          Object.entries(t.assignmentsBySection || {}).forEach(([sec, assignments]) => {
            if (Array.isArray(assignments)) {
              assignments.forEach(a => {
                const sub = a.subjectId && typeof a.subjectId === "object" ? a.subjectId : null;
                const sid = sub ? sub._id : (a.subjectId || "");
                if (!map[sec]) map[sec] = [];
                map[sec].push({
                  subjectId: sid,
                  subjectName: sub?.subjectName || a.subjectName || "",
                  subjectCode: sub?.subjectCode || "",
                  semester: sub?.semester || "",
                  courseId: sub?.courseId || "",
                  courseCode: sub?.courseCode || sub?.course || "",
                  branch: sub?.branch || "",
                });
              });
            }
          });
          assignmentsByTeacher[t._id] = map;
        });
      }
      setTeachers(teacherList);
      setSubjects(subjectList);
      setTeacherAssignments(assignmentsByTeacher);

      const allSections = sectionList;
      setSections(allSections.sort());
      if (allSections.length > 0) setSelectedSection(allSections[0]);
      else setLoading(false);
    } catch (err) {
      setError("Failed to load data");
      setLoading(false);
    }
  };

  const availableCourseCodes = useMemo(() => {
    const set = new Set();
    if (Array.isArray(courses)) courses.forEach(c => c && c.code && set.add(c.code));
    if (Array.isArray(subjects)) subjects.forEach(s => s && s.courseCode && set.add(s.courseCode));
    if (Array.isArray(entries)) entries.forEach(e => e && e.courseCode && set.add(e.courseCode));
    return Array.from(set).sort();
  }, [courses, subjects, entries]);

  const availableBranches = useMemo(() => {
    const branchSet = new Set();
    if (Array.isArray(courses)) {
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
    }
    if (Array.isArray(subjects)) {
      subjects.forEach(s => {
        if (!s) return;
        if (filterCourse) {
          const cCode = String(s.courseCode || "").toUpperCase();
          const cId = String(s.courseId || "");
          if (cCode !== filterCourse.toUpperCase() && cId !== filterCourse) return;
        }
        if (s.branch) branchSet.add(String(s.branch).trim());
      });
    }
    return Array.from(branchSet).sort();
  }, [courses, subjects, filterCourse]);

  const availableSemesters = useMemo(() => {
    const set = new Set();
    if (Array.isArray(subjects)) {
      subjects.forEach(s => {
        if (!s || !s.semester) return;
        if (filterCourse) {
          const cCode = String(s.courseCode || "").toUpperCase();
          const cId = String(s.courseId || "");
          if (cCode !== filterCourse.toUpperCase() && cId !== filterCourse) return;
        }
        if (filterBranch) {
          if (!isBranchMatch(s.branch, filterBranch, courses, { excludeUnassigned: true })) return;
        }
        set.add(String(s.semester));
      });
    }
    if (Array.isArray(entries)) {
      entries.forEach(e => {
        if (!e || !e.semester) return;
        if (filterCourse) {
          if (String(e.courseCode || "").toUpperCase() !== filterCourse.toUpperCase()) return;
        }
        if (filterBranch) {
          if (!isBranchMatch(e.branch || e.subjectId?.branch, filterBranch, courses, { excludeUnassigned: true })) return;
        }
        set.add(String(e.semester));
      });
    }
    return Array.from(set).sort((a, b) => parseInt(a) - parseInt(b));
  }, [subjects, entries, filterCourse, filterBranch, courses]);

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

  // Distinct course codes that actually schedule classes in the selected section.
  // Sourced from teacher assignments AND from loaded timetable entries so a
  // shared section is detected even before any entry is created.
  const sectionCourseCodes = useMemo(() => {
    if (!selectedSection) return [];
    const codes = new Set();
    (Array.isArray(entries) ? entries : []).forEach(e => {
      if (e.section === selectedSection && e.courseCode) codes.add(String(e.courseCode).toUpperCase());
    });
    Object.values(teacherAssignments || {}).forEach(secMap => {
      (secMap[selectedSection] || []).forEach(a => {
        if (a.courseCode) codes.add(String(a.courseCode).toUpperCase());
      });
    });
    return Array.from(codes).sort();
  }, [entries, teacherAssignments, selectedSection]);

  // A section is "shared" when multiple courses use it. The user must then
  // pick which course's timetable to view.
  const sharedSection = Boolean(selectedSection && sectionCourseCodes.length > 1 && !filterCourse);

  const handleSectionChange = (e) => {
    const val = e.target.value;
    setSelectedSection(val);
    setFilterCourse("");
    setFilterBranch("");
    setFilterSemester("");
  };

  const sectionCoursesLabel = (sec) => {
    const codes = new Set();
    (Array.isArray(entries) ? entries : []).forEach(e => {
      if (e.section === sec && e.courseCode) codes.add(String(e.courseCode).toUpperCase());
    });
    Object.values(teacherAssignments || {}).forEach(m => {
      (m[sec] || []).forEach(a => {
        if (a.courseCode) codes.add(String(a.courseCode).toUpperCase());
      });
    });
    return Array.from(codes).sort().join(", ");
  };

  const fetchEntries = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterCourse) params.set("courseCode", filterCourse);
      if (filterSemester) params.set("semester", filterSemester);
      if (filterBranch) params.set("branch", filterBranch);
      const qs = params.toString();
      const res = await api.get(
        isTeacher
          ? `/timetable/section/${encodeURIComponent(selectedSection)}${qs ? `?${qs}` : ""}`
          : `/timetable?section=${encodeURIComponent(selectedSection)}${qs ? `&${qs}` : ""}`
      );
      const data = res.data.data;
      const rawEntries = Array.isArray(data) ? data : (data ? Object.values(data).flat() : []);
      const filtered = filterBranch
        ? rawEntries.filter(e => isBranchMatch(e.branch || e.subjectId?.branch, filterBranch, courses, { excludeUnassigned: true }))
        : rawEntries;
      setEntries(filtered);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch timetable");
    } finally {
      setLoading(false);
    }
  };

  const openAdd = (day, startTime) => {
    setEditingEntry(null);
    setFormData({
      day: day || "Monday",
      startTime: startTime || "09:00",
      endTime: incrementHour(startTime || "09:00"),
      courseId: "",
      courseCode: "",
      branch: "",
      semester: "",
      subjectId: "",
      teacherId: "",
      section: selectedSection || (sections.length > 0 ? sections[0] : "A"),
      room: "",
      isNoClass: false,
    });
    setShowForm(true);
  };

  const openEdit = (entry) => {
    const noClass = Boolean(entry.isNoClass || entry.subjectName === "No Class");
    setEditingEntry(entry);
    setFormData({
      day: entry.day, startTime: entry.startTime, endTime: entry.endTime,
      courseId: entry.courseId?._id || entry.courseId || "",
      courseCode: entry.courseCode || "",
      branch: entry.branch || "",
      semester: entry.semester || "1",
      subjectId: entry.subjectId?._id || entry.subjectId || "",
      teacherId: entry.teacherId?._id || entry.teacherId || "",
      section: entry.section, room: entry.room || "",
      isNoClass: noClass,
    });
    setShowForm(true);
  };

  const incrementHour = (time) => {
    const [h, m] = time.split(":").map(Number);
    return `${String(h + 1).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.isNoClass && (!formData.subjectId || !formData.teacherId)) {
      const msg = "Please select subject and teacher for regular classes";
      setError(msg);
      toastError(msg);
      return;
    }
    try {
      setSubmitting(true);
      const teacher = teachers.find(t => String(t._id || t.id) === String(formData.teacherId));
      const subject = subjects.find(s => String(s._id || s.id) === String(formData.subjectId));
      const payload = {
        ...formData,
        subjectName: formData.isNoClass ? "No Class" : (subject?.subjectName || formData.subjectName || ""),
        subjectCode: formData.isNoClass ? "" : (subject?.subjectCode || formData.subjectCode || ""),
        teacherName: formData.isNoClass ? "N/A" : (teacher?.name || formData.teacherName || ""),
        section: formData.section || (formData.isNoClass ? (selectedSection || (sections.length > 0 ? sections[0] : "")) : ""),
      };

      if (editingEntry) {
        await api.put(`/timetable/${editingEntry._id}`, payload);
        const msg = "Timetable entry updated successfully";
        setSuccess(msg);
        toastSuccess(msg);
      } else {
        await api.post('/timetable', payload);
        const msg = "Timetable entry created successfully";
        setSuccess(msg);
        toastSuccess(msg);
      }
      setShowForm(false);
      fetchEntries();
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to save timetable entry";
      setError(msg);
      toastError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this timetable entry?")) return;
    try {
      await api.delete(`/timetable/${id}`);
      const msg = "Entry deleted";
      setSuccess(msg);
      toastSuccess(msg);
      fetchEntries();
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to delete";
      setError(msg);
      toastError(msg);
    }
  };

  // Pre-upload validation for bulk timetable rows: verify every teacher is
  // actually assigned to the subject in the given section.
  const validateBulkRows = (rows) => {
    const errors = [];
    const teacherNameToId = {};
    const teacherCodeToId = {};
    teachers.forEach(t => {
      teacherNameToId[String(t.name).trim().toLowerCase()] = t._id;
      if (t.rollNo) teacherCodeToId[String(t.rollNo).trim().toUpperCase()] = t._id;
      if (t.teacherCode) teacherCodeToId[String(t.teacherCode).trim().toUpperCase()] = t._id;
    });
    const subjectNameToId = {};
    const subjectCodeToId = {};
    subjects.forEach(s => {
      subjectNameToId[String(s.subjectName).trim().toLowerCase()] = s._id;
      if (s.subjectCode) subjectCodeToId[String(s.subjectCode).trim().toUpperCase()] = s._id;
    });

    rows.forEach((row, idx) => {
      const isNoClass = Boolean(row.isNoClass || String(row.subjectName || "").toLowerCase() === "no class");
      if (isNoClass) {
        if (!String(row.section || "").trim()) {
          errors.push({
            index: idx,
            error: "No Class rows need a Section — free periods can't be auto-derived from a teacher assignment.",
          });
        }
        return;
      }

      const section = String(row.section || "").trim().toUpperCase();
      const rawTeacherName = String(row.teacherName || "").trim().toLowerCase();
      const rawSubName = String(row.subjectName || "").trim().toLowerCase();
      const rawSubCode = String(row.subjectCode || "").trim().toUpperCase();

      const rawTeacherCode = String(row.teacherId || "").trim().toUpperCase();
      const rawSubjectCode = String(row.subjectId || "").trim().toUpperCase();
      const isMongoId = (v) => /^[0-9a-f]{24}$/i.test(v);

      const teacherId = (isMongoId(rawTeacherCode) ? rawTeacherCode : null)
        || teacherCodeToId[rawTeacherCode]
        || teacherNameToId[rawTeacherName];
      const subjectId = (isMongoId(rawSubjectCode) ? rawSubjectCode : null)
        || subjectCodeToId[rawSubCode]
        || subjectCodeToId[rawSubjectCode]
        || subjectNameToId[rawSubName];

      if (!teacherId) {
        errors.push({ index: idx, error: `Teacher "${row.teacherName || "?"}" not found in your institution` });
        return;
      }
      if (!subjectId) {
        errors.push({ index: idx, error: `Subject "${row.subjectName || row.subjectCode || "?"}" not found in your institution` });
        return;
      }

      const isSubMatch = (s) => {
        const sId = s.subjectId ? String(s.subjectId._id || s.subjectId) : "";
        const targetId = String(subjectId);
        const sName = String(s.subjectName || s.subjectId?.subjectName || "").trim().toLowerCase();
        const sCode = String(s.subjectCode || s.subjectId?.subjectCode || "").trim().toUpperCase();

        return (targetId && sId === targetId) ||
          (rawSubName && sName === rawSubName) ||
          (rawSubCode && sCode && sCode === rawSubCode);
      };

      const sectionAssignments = teacherAssignments[teacherId]?.[section] || [];
      const assignedInSection = sectionAssignments.some(isSubMatch);
      const assignedAnywhere = Object.values(teacherAssignments[teacherId] || {}).some(
        list => Array.isArray(list) && list.some(isSubMatch)
      );


      if (section && !assignedInSection) {
        errors.push({
          index: idx,
          error: `Teacher "${row.teacherName}" is NOT assigned to "${row.subjectName || row.subjectCode}" in Section ${section}. Assign the subject to the teacher first.`,
        });
      } else if (!section && !assignedAnywhere) {
        errors.push({
          index: idx,
          error: `Teacher "${row.teacherName}" is NOT assigned to "${row.subjectName || row.subjectCode}" in any section. Assign the subject to the teacher first.`,
        });
      }
    });
    return errors;
  };

  const getEntry = (day, time) => entries.find(e => e.day === day && e.startTime === time);

  const teacherMap = useMemo(() => {
    const m = {};
    teachers.forEach(t => { m[t._id] = t; });
    return m;
  }, [teachers]);

  const subjectMap = useMemo(() => {
    const m = {};
    subjects.forEach(s => { m[s._id] = s; });
    return m;
  }, [subjects]);

  // Section is derived from the subject's assignment, not picked up front.
  // Returns the section(s) where the given teacher teaches the given subject.
  const getSectionsForSubjectTeacher = useCallback((subjectId, teacherId) => {
    if (!subjectId || !teacherId) return [];
    const found = [];
    const secMap = teacherAssignments[teacherId] || {};
    for (const [sec, subList] of Object.entries(secMap || {})) {
      if (Array.isArray(subList) && subList.some(s => String(s.subjectId) === String(subjectId))) {
        found.push(sec);
      }
    }
    // Fallback for admins whose teacher payload carries an assignedSubjects array.
    if (found.length === 0 && Array.isArray(teachers)) {
      const t = teachers.find(t => String(t._id) === String(teacherId));
      if (t && Array.isArray(t.assignedSubjects)) {
        t.assignedSubjects.forEach(a => {
          const sid = a.subjectId ? String(a.subjectId._id || a.subjectId) : "";
          if (sid && sid === String(subjectId)) {
            const sec = String(a.section || "").toUpperCase();
            if (sec && !found.includes(sec)) found.push(sec);
          }
        });
      }
    }
    return [...new Set(found)];
  }, [teacherAssignments, teachers]);

  const handleTeacherChange = (e) => {
    const tid = e.target.value;
    setFormData(p => {
      const sectionsFor = p.subjectId && tid ? getSectionsForSubjectTeacher(p.subjectId, tid) : [];
      return {
        ...p,
        teacherId: tid,
        section: sectionsFor.length ? sectionsFor[0] : p.section,
      };
    });
  };

  if (loading && entries.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-16 h-16 border-4 border-primary-soft border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <PageHeader
        title="Timetable Manager"
        subtitle="Manage class schedules and time slots"
        icon={Calendar}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {/* Section Filter */}
            <Select
              value={selectedSection}
              onChange={handleSectionChange}
              className="w-52"
            >
              <option value="">Select Section</option>
              {sections.map(s => {
                const lbl = sectionCoursesLabel(s);
                return <option key={s} value={s}>{lbl ? `Section ${s} (${lbl})` : `Section ${s}`}</option>;
              })}
            </Select>

            {/* Course Filter — scoped to the courses present in the selected section */}
            <Select
              value={filterCourse}
              onChange={e => setFilterCourse(e.target.value)}
              className="w-40"
              disabled={!selectedSection}
            >
              <option value="">
                {selectedSection && sectionCourseCodes.length > 1 ? "Choose Course..." : "All Courses"}
              </option>
              {(selectedSection ? sectionCourseCodes : availableCourseCodes).map(code => (
                <option key={code} value={code}>{code}</option>
              ))}
            </Select>

            {/* Branch Filter */}
            <Select
              value={filterBranch}
              onChange={e => setFilterBranch(e.target.value)}
              className="w-40"
              disabled={!selectedSection}
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
            </Select>

            {/* Semester Filter */}
            <Select
              value={filterSemester}
              onChange={e => setFilterSemester(e.target.value)}
              className="w-36"
              disabled={!selectedSection}
            >
              <option value="">All Semesters</option>
              {availableSemesters.map(sem => (
                <option key={sem} value={sem}>Semester {sem}</option>
              ))}
            </Select>

            <Button variant="outline" leftIcon={ClipboardList} onClick={() => setShowBulk(true)}>
              Bulk Operations
            </Button>
            <Button leftIcon={Plus} onClick={() => openAdd(DAYS[0], "09:00")}>
              Add Entry
            </Button>
          </div>
        }
      />



      {selectedSection ? (
        sharedSection ? (
          <Card className="p-8 text-center">
            <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-ink">
              Section {selectedSection} is shared by {sectionCourseCodes.length} courses
            </h3>
            <p className="text-sm text-ink-soft mt-1 max-w-md mx-auto">
              Multiple courses schedule classes in this section. Select a course to view its timetable.
            </p>
            <div className="flex flex-wrap justify-center gap-3 mt-6">
              {sectionCourseCodes.map(code => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setFilterCourse(code)}
                  className="px-5 py-3.5 rounded-xl border-2 border-primary/30 bg-primary-soft hover:border-primary hover:bg-primary hover:text-white transition text-primary font-bold flex items-center gap-2"
                >
                  <GraduationCap className="w-5 h-5" />
                  {code}
                </button>
              ))}
            </div>
          </Card>
        ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="p-3 bg-background border-b border-r border-line text-left text-xs font-bold text-ink-faint uppercase tracking-wider w-20">Time</th>
                  {DAYS.map(day => (
                    <th key={day} className="p-3 bg-background border-b border-r border-line text-center text-xs font-bold text-ink-faint uppercase tracking-wider">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIME_SLOTS.map(time => (
                  <tr key={time}>
                    <td className="p-2 border-b border-r border-line text-xs text-ink-soft font-medium text-center">{time}</td>
                    {DAYS.map(day => {
                      const entry = getEntry(day, time);
                      const isNoClassEntry = entry && (entry.isNoClass || entry.subjectName === "No Class");
                      return (
                        <td key={`${day}-${time}`} className="border-b border-r border-line p-1 align-top">
                          {entry ? (
                            isNoClassEntry ? (
                              <div className="relative group p-2 rounded-lg bg-slate-100 border border-slate-200 min-h-[80px]">
                                <div className="flex items-center gap-1">
                                  <Coffee className="w-3.5 h-3.5 text-slate-500" />
                                  <p className="text-xs font-bold text-slate-700">No Class</p>
                                </div>
                                <p className="text-[11px] text-slate-500 mt-1">Free Period</p>
                                <p className="text-xs text-slate-400 mt-0.5">{entry.startTime}-{entry.endTime}</p>
                                <div className="absolute top-1 right-1 hidden group-hover:flex gap-1">
                                  <button onClick={() => openEdit(entry)} className="p-1 bg-surface rounded shadow-sm hover:bg-background"><Edit className="w-3 h-3 text-primary" /></button>
                                  <button onClick={() => handleDelete(entry._id)} className="p-1 bg-surface rounded shadow-sm hover:bg-background"><Trash2 className="w-3 h-3 text-red-600" /></button>
                                </div>
                              </div>
                            ) : (
                              <div className="relative group p-2 rounded-lg bg-primary-soft border border-primary-surface min-h-[80px]">
                                <div className="flex items-center justify-between gap-1 mb-1">
                                  <p className="text-xs font-semibold text-primary-dark truncate">{entry.subjectName}</p>
                                  {entry.courseCode && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary flex-shrink-0">
                                      {entry.courseCode}{entry.semester ? ` • S${entry.semester}` : ""}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-primary">{entry.teacherName}</p>
                                {entry.room && <p className="text-xs text-ink-soft">Room: {entry.room}</p>}
                                <p className="text-xs text-ink-faint mt-0.5">{entry.startTime}-{entry.endTime}</p>
                                <div className="absolute top-1 right-1 hidden group-hover:flex gap-1">
                                  <button onClick={() => openEdit(entry)} className="p-1 bg-surface rounded shadow-sm hover:bg-background"><Edit className="w-3 h-3 text-primary" /></button>
                                  <button onClick={() => handleDelete(entry._id)} className="p-1 bg-surface rounded shadow-sm hover:bg-background"><Trash2 className="w-3 h-3 text-red-600" /></button>
                                </div>
                              </div>
                            )
                          ) : (
                            <button onClick={() => openAdd(day, time)} className="w-full min-h-[80px] rounded-lg border-2 border-dashed border-line hover:border-primary/40 hover:bg-primary-soft/40 transition flex items-center justify-center opacity-0 hover:opacity-100">
                              <Plus className="w-4 h-4 text-ink-faint" />
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        )
      ) : (
        <Card className="text-center p-12">
          <Calendar className="w-12 h-12 text-ink-faint mx-auto mb-4" />
          <p className="text-ink-soft">Select a section to manage its timetable</p>
        </Card>
      )}

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingEntry ? "Edit Entry" : "Add Timetable Entry"} size="md" error={error}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3 rounded-xl bg-background border border-line">
            <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-ink">
              <input
                type="checkbox"
                checked={formData.isNoClass}
                onChange={e => setFormData(p => ({
                  ...p,
                  isNoClass: e.target.checked,
                  subjectId: e.target.checked ? "" : p.subjectId,
                  teacherId: e.target.checked ? "" : p.teacherId,
                }))}
                className="w-4 h-4 text-primary rounded border-line focus:ring-primary/20"
              />
              <span>No Class / Free Slot (No class at this timing)</span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Day"
              value={formData.day}
              onChange={e => setFormData(p => ({ ...p, day: e.target.value }))}
            >
              {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
            </Select>
            <Input
              label="Room"
              value={formData.room}
              onChange={e => setFormData(p => ({ ...p, room: e.target.value }))}
              placeholder="e.g. Room 101"
            />
            <Select
              label="Start Time"
              value={formData.startTime}
              onChange={e => setFormData(p => ({ ...p, startTime: e.target.value, endTime: incrementHour(e.target.value) }))}
            >
              {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
            <Input
              label="End Time"
              value={formData.endTime}
              onChange={e => setFormData(p => ({ ...p, endTime: e.target.value }))}
              placeholder="e.g. 11:00"
            />

            {!formData.isNoClass && (() => {
              const selectedCourseObj = (Array.isArray(courses) ? courses : []).find(c => String(c._id) === String(formData.courseId));
              const branchOptions = selectedCourseObj?.branches?.filter(b => b.isActive !== false) || [];
              const matchedBranchObj = branchOptions.find(b => b.code === formData.branch);
              const maxSems = matchedBranchObj?.totalSemesters || (selectedCourseObj ? selectedCourseObj.durationYears * (selectedCourseObj.semestersPerYear || 2) : 8);
              const semOptions = Array.from({ length: maxSems }, (_, i) => String(i + 1));

              const filteredSubjectOptions = (Array.isArray(subjects) ? subjects : []).filter(s => {
                const matchCourse = !formData.courseId ||
                  String(s.courseId || "") === String(formData.courseId) ||
                  (selectedCourseObj && String(s.courseCode || "").toUpperCase() === String(selectedCourseObj.code || "").toUpperCase()) ||
                  (selectedCourseObj && String(s.subjectName || "").toUpperCase().includes(String(selectedCourseObj.code || "").toUpperCase())) ||
                  !s.courseId;

                const matchBranch = isBranchMatch(s.branch, formData.branch, courses);

                const subSem = String(s.semester || "").replace(/\D/g, "");
                const formSem = String(formData.semester || "").replace(/\D/g, "");
                const matchSem = !formData.semester || !s.semester || !subSem || !formSem || subSem === formSem;

                return matchCourse && matchBranch && matchSem;
              });

              const handleCourseSelect = (e) => {
                const cid = e.target.value;
                const cObj = courses.find(c => String(c._id) === String(cid));
                setFormData(p => ({
                  ...p,
                  courseId: cid,
                  courseCode: cObj?.code || "",
                  branch: "",
                  semester: "",
                  subjectId: "",
                  teacherId: "",
                }));
              };

              const handleBranchSelect = (e) => {
                const bName = e.target.value;
                setFormData(p => ({
                  ...p,
                  branch: bName,
                  subjectId: "",
                  teacherId: "",
                }));
              };

              const handleSemesterSelect = (e) => {
                const semVal = e.target.value;
                setFormData(p => ({
                  ...p,
                  semester: semVal,
                  subjectId: "",
                  teacherId: "",
                }));
              };

              const getSubIdStr = (itemSub) => {
                if (!itemSub) return "";
                if (typeof itemSub === "object") return String(itemSub._id || itemSub.id || itemSub.subjectId || "");
                return String(itemSub);
              };

              const handleSubjectSelect = (e) => {
                const sid = e.target.value;
                const sub = subjects.find(s => String(s._id || s.id) === String(sid));

                let autoTeacherId = "";
                if (sid || sub) {
                  const targetSubId = String(sid);
                  const targetSubCode = String(sub?.subjectCode || "").toUpperCase();
                  const targetSubName = String(sub?.subjectName || "").toUpperCase();

                  // Strategy 1: Check teacherAssignments map (by ID, Code, or Name)
                  for (const [tid, secMap] of Object.entries(teacherAssignments || {})) {
                    for (const [sec, subList] of Object.entries(secMap || {})) {
                      if (Array.isArray(subList)) {
                        const match = subList.some(item => {
                          const itemSubId = getSubIdStr(item.subjectId || item);
                          const itemCode = String(item.subjectCode || "").toUpperCase();
                          const itemName = String(item.subjectName || "").toUpperCase();
                          return (targetSubId && itemSubId === targetSubId) ||
                            (targetSubCode && itemCode && itemCode === targetSubCode) ||
                            (targetSubName && itemName && itemName === targetSubName);
                        });
                        if (match) {
                          autoTeacherId = tid;
                          break;
                        }
                      }
                    }
                    if (autoTeacherId) break;
                  }

                  // Strategy 2: Fallback check directly in teachers assignedSubjects array
                  if (!autoTeacherId && Array.isArray(teachers)) {
                    const matchTeacher = teachers.find(t => {
                      if (!Array.isArray(t.assignedSubjects)) return false;
                      return t.assignedSubjects.some(a => {
                        const aSubId = getSubIdStr(a.subjectId);
                        const aSubCode = String(a.subjectCode || a.subjectId?.subjectCode || "").toUpperCase();
                        const aSubName = String(a.subjectName || a.subjectId?.subjectName || "").toUpperCase();
                        return (targetSubId && aSubId === targetSubId) ||
                          (targetSubCode && aSubCode && aSubCode === targetSubCode) ||
                          (targetSubName && aSubName && aSubName === targetSubName);
                      });
                    });
                    if (matchTeacher) autoTeacherId = matchTeacher._id;
                  }
                }

                const sectionsFor = autoTeacherId ? getSectionsForSubjectTeacher(sid, autoTeacherId) : [];
                setFormData(p => ({
                  ...p,
                  subjectId: sid,
                  teacherId: autoTeacherId || p.teacherId,
                  section: sectionsFor.length ? sectionsFor[0] : p.section,
                  courseId: sub?.courseId || p.courseId,
                  courseCode: sub?.courseCode || p.courseCode,
                  branch: sub?.branch || p.branch,
                  semester: sub?.semester ? String(sub.semester) : p.semester,
                }));
              };

              const handleTeacherChange = (e) => {
                const tid = e.target.value;
                const sectionsFor = tid ? getSectionsForSubjectTeacher(formData.subjectId, tid) : [];
                setFormData(p => ({
                  ...p,
                  teacherId: tid,
                  section: sectionsFor.length ? sectionsFor[0] : p.section,
                }));
              };

              const filteredTeachers = (Array.isArray(teachers) ? teachers : []).filter(t => {
                if (!formData.subjectId) return true;
                const secMap = teacherAssignments[t._id];
                if (secMap) {
                  const hasSubject = Object.values(secMap).some(subList =>
                    Array.isArray(subList) && subList.some(item =>
                      String(item.subjectId) === String(formData.subjectId)
                    )
                  );
                  if (hasSubject) return true;
                }
                if (Array.isArray(t.assignedSubjects)) {
                  return t.assignedSubjects.some(a => getSubIdStr(a.subjectId) === String(formData.subjectId));
                }
                return false;
              });

              const selectedTeacherObj = teachers.find(t => String(t._id) === String(formData.teacherId));
              const sectionOptions = formData.isNoClass ? [] : getSectionsForSubjectTeacher(formData.subjectId, formData.teacherId);

              return (
                <>
                  {/* Step 1: Course */}
                  <Select
                    label="1. Select Course *"
                    value={formData.courseId}
                    onChange={handleCourseSelect}
                    required
                  >
                    <option value="">Choose Course...</option>
                    {(Array.isArray(courses) ? courses : []).map(c => (
                      <option key={c._id} value={c._id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </Select>

                  {/* Step 2: Branch */}
                  <Select
                    label="2. Select Branch (Optional)"
                    value={formData.branch}
                    onChange={handleBranchSelect}
                    disabled={!formData.courseId}
                  >
                    <option value="">All Branches ({branchOptions.length})</option>
                    {branchOptions.map(b => (
                      <option key={b._id || b.code} value={b.code}>
                        {b.code} — {b.name}
                      </option>
                    ))}
                  </Select>

                  {/* Step 3: Semester */}
                  <Select
                    label="3. Select Semester *"
                    value={formData.semester}
                    onChange={handleSemesterSelect}
                    disabled={!formData.courseId}
                    required
                  >
                    <option value="">Choose Semester...</option>
                    {semOptions.map(sem => (
                      <option key={sem} value={sem}>
                        Semester {sem}
                      </option>
                    ))}
                  </Select>

                  {/* Step 4: Subject */}
                  <Select
                    label="4. Select Subject *"
                    value={formData.subjectId}
                    onChange={handleSubjectSelect}
                    disabled={!formData.courseId || !formData.semester}
                    required
                  >
                    <option value="">
                      {!formData.semester ? "Select semester first to view subjects" : filteredSubjectOptions.length === 0 ? "No subjects found for this semester" : "Choose Subject..."}
                    </option>
                    {filteredSubjectOptions.map(s => (
                      <option key={s._id || s.subjectId} value={s._id || s.subjectId}>
                        {s.subjectCode} - {s.subjectName}
                      </option>
                    ))}
                  </Select>

                  {/* Step 5: Auto-filled Teacher */}
                  <div className="col-span-2">
                    <Select
                      label={`5. Assigned Teacher (${(filteredTeachers.length > 0 ? filteredTeachers : teachers).length} available) *`}
                      value={formData.teacherId}
                      onChange={handleTeacherChange}
                      required
                    >
                      <option value="">Select teacher...</option>
                      {(filteredTeachers.length > 0 ? filteredTeachers : teachers).map(t => (
                        <option key={t._id} value={t._id}>
                          {t.name} ({t.email})
                        </option>
                      ))}
                    </Select>
                  </div>

                  {/* Step 6: Auto-assigned Section — derived from the subject's assignment */}
                  <div className="col-span-2">
                    <Select
                      label="6. Section (Auto-assigned to subject) *"
                      value={formData.section}
                      onChange={e => setFormData(p => ({ ...p, section: e.target.value }))}
                      disabled={sectionOptions.length === 1}
                      required
                    >
                      {sectionOptions.length > 0 ? (
                        sectionOptions.map(s => <option key={s} value={s}>Section {s}</option>)
                      ) : (
                        <option value="">Auto-derived from subject & teacher...</option>
                      )}
                    </Select>
                    {sectionOptions.length === 0 && formData.subjectId && (
                      <p className="text-[11px] text-amber-600 mt-1">
                        Could not find a section where this teacher teaches the selected subject. Assign the subject to the teacher first.
                      </p>
                    )}
                    {sectionOptions.length > 1 && (
                      <p className="text-[11px] text-ink-faint mt-1">
                        This subject is taught in {sectionOptions.length} sections — pick which one this entry belongs to.
                      </p>
                    )}
                  </div>

                  {/* Auto-filled Summary Card */}
                  {formData.subjectId && (
                    <div className="col-span-2 p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs space-y-1.5">
                      <div className="flex items-center justify-between font-semibold">
                        <span className="flex items-center gap-2 text-indigo-700">
                          <GraduationCap className="w-4 h-4" />
                          Course: {formData.courseCode || selectedCourseObj?.code || "Generic"}
                          {formData.branch ? ` • ${formData.branch}` : ""}
                        </span>
                        <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-bold">
                          Semester {formData.semester || "1"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-indigo-700 text-[11px] border-t border-indigo-200/60 pt-1.5 mt-1.5">
                        <span>Teacher: <strong>{selectedTeacherObj ? selectedTeacherObj.name : "Not auto-assigned"}</strong></span>
                        <span className="text-emerald-700 font-bold flex items-center gap-1">
                          <Check className="w-3 h-3" /> Auto-Configured
                        </span>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>



          {formData.isNoClass && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs flex items-center gap-2">
              <Coffee className="w-4 h-4 flex-shrink-0" />
              <span>This timing will be marked as a free period / break with no class assigned.</span>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button type="submit" leftIcon={Save}>
              {editingEntry ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </Modal>

      <BulkImportModal
        isOpen={showBulk}
        onClose={() => setShowBulk(false)}
        endpoint="/timetable/bulk"
        bodyKey="entries"
        itemLabel="timetable entries"
        example={BULK_EXAMPLE}
        columns={BULK_TIMETABLE_COLUMNS}
        preValidate={validateBulkRows}
        exportData={entries}
        defaults={{ section: selectedSection, courseCode: filterCourse, semester: filterSemester }}
        onImported={() => { setShowBulk(false); fetchEntries(); }}
      />
    </motion.div>
  );
};

export default TimetableManager;
