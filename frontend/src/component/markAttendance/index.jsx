// src/components/MarkAttendance.jsx
import React, { useEffect, useState, Fragment, useRef, useMemo } from "react";
import { Listbox, Transition } from "@headlessui/react";
import {
  Calendar,
  Book,
  Check,
  X,
  ChevronDown,
  Users,
  AlertCircle,
  Search,
  RefreshCw,
  Clock,
  Loader2,
  UserCheck,
  UserX,
  BookOpen,
  CheckCircle,
  XCircle,
  Wifi,
  WifiOff,
} from "lucide-react";
import api from "../../utils/api";
import { format } from "date-fns";
import { useTheme } from "../../contexts/ThemeContexts";
import { motion, AnimatePresence } from "framer-motion";
import {
  getOfflineQueue,
  saveToOfflineQueue,
  getPendingSyncCount,
  syncOfflineAttendance,
} from "../../utils/offlineSync";
import PageHeader from "../common/ui/PageHeader";
import Card from "../common/ui/Card";
import StatCard from "../common/ui/StatCard";
import Button from "../common/ui/Button";
import EmptyState from "../common/ui/EmptyState";

function hexToRgbStr(hex = "#6366f1") {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r} ${g} ${b}`;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
// Mirrors backend: new Date("yyyy-mm-dd") is parsed as UTC midnight, then getUTCDay().
const getDayOfWeek = (dateStr) => WEEKDAYS[new Date(dateStr).getUTCDay()];

export default function MarkAttendance() {
  const { colors } = useTheme();
  const primary = colors?.primary || "#7c3aed";
  const secondary = colors?.secondary || primary;

  const cssVars = {
    "--theme-primary": primary,
    "--theme-secondary": secondary,
    "--theme-primary-rgb": hexToRgbStr(primary),
  };

  const [teacherSubjects, setTeacherSubjects] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedDate, setSelectedDate] = useState(
    format(new Date(), "yyyy-MM-dd")
  );
  const [students, setStudents] = useState([]);
  const [attendanceData, setAttendanceData] = useState({});
  const [filterRollNo, setFilterRollNo] = useState("");
  const [responseMessage, setResponseMessage] = useState("");
  const [isSuccessToast, setIsSuccessToast] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchingStudents, setFetchingStudents] = useState(false);
  const [existingAttendance, setExistingAttendance] = useState(false);
  const [classSessionInfo, setClassSessionInfo] = useState(null);
  const [sectionEntries, setSectionEntries] = useState([]);
  const [classSlots, setClassSlots] = useState([]);
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [slotLoading, setSlotLoading] = useState(false);
  const [stats, setStats] = useState({
    totalStudents: 0,
    presentCount: 0,
    absentCount: 0,
  });

  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingSyncCount, setPendingSyncCount] = useState(getPendingSyncCount());
  const [isSyncing, setIsSyncing] = useState(false);

  const hasFetchedSubjects = useRef(false);
  const abortControllerRef = useRef(null);

  const token = localStorage.getItem("token");
  const teacherId = localStorage.getItem("userId");

  const triggerOfflineSync = async () => {
    if (getPendingSyncCount() === 0) return;
    setIsSyncing(true);
    try {
      const res = await syncOfflineAttendance(api);
      setPendingSyncCount(res.remainingCount);
      if (res.syncedCount > 0) {
        showToast(`✅ Synced ${res.syncedCount} offline attendance payload(s) successfully!`, true);
      }
    } catch (err) {
      showToast("⚠️ Offline sync encountered errors. Will retry when online.", false);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      showToast("🌐 Network connection restored. Auto-syncing pending attendance...", true);
      await triggerOfflineSync();
    };
    const handleOffline = () => {
      setIsOnline(false);
      showToast("📶 Offline mode active. Attendance will be saved locally.", false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    setPendingSyncCount(getPendingSyncCount());

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Fetch teacher subjects - only once on mount
  useEffect(() => {
    if (token && !hasFetchedSubjects.current) {
      hasFetchedSubjects.current = true;
      fetchTeacherSubjects();
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [token]);

  // Update selected subject and section when assignment changes
  useEffect(() => {
    if (selectedAssignment) {
      setSelectedSubject(selectedAssignment.subjectId);
      setSelectedSection(selectedAssignment.section);
      setResponseMessage("");
      setExistingAttendance(false);
      setClassSessionInfo(null);
      setAttendanceData({});
    }
  }, [selectedAssignment]);

  // Fetch students when section or subject changes
  useEffect(() => {
    if (selectedSection && selectedSubject) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      fetchStudents(abortControllerRef.current.signal);
      fetchSectionTimetable();

      setExistingAttendance(false);
      setClassSessionInfo(null);
      setClassSlots([]);
      setSelectedSlotId("");
      setAttendanceData({});
    }
  }, [selectedSection, selectedSubject]);

  // Compute the scheduled slots for the selected subject on the selected date's weekday
  useEffect(() => {
    if (!selectedDate || !selectedSubject) {
      setClassSlots([]);
      return;
    }
    const day = getDayOfWeek(selectedDate);
    const slots = sectionEntries.filter(
      (e) => e.day === day && String(e.subjectId) === String(selectedSubject) && !e.isNoClass && e.subjectName !== "No Class"
    );
    setClassSlots(slots);
    setSelectedSlotId((prev) =>
      slots.some((s) => s._id === prev) ? prev : slots[0]?._id || ""
    );
  }, [selectedDate, selectedSubject, sectionEntries]);

  // Check existing attendance when date, subject, section changes
  useEffect(() => {
    if (students.length > 0 && selectedDate && selectedSubject && selectedSection) {
      checkExistingAttendance();
    }
  }, [selectedDate, selectedSubject, selectedSection, students.length]);

  // Calculate stats
  useEffect(() => {
    const filtered = students.filter((student) => {
      const fullName = student.name || "";
      const rollNo = student.rollNo || "";
      const term = filterRollNo.toLowerCase();
      return fullName.toLowerCase().includes(term) || rollNo.toLowerCase().includes(term);
    });

    const total = filtered.length;
    const present = Object.values(attendanceData).filter(
      (value) => value === true
    ).length;

    setStats({
      totalStudents: total,
      presentCount: present,
      absentCount: total - present,
    });
  }, [attendanceData, students, filterRollNo]);

  const fetchTeacherSubjects = async () => {
    try {
      if (!teacherId) {
        showToast("Teacher ID not found. Please log in again.", false);
        return;
      }

      const response = await api.get(
        `/subjects/teacher/${teacherId}/assignments`,
        {
          signal: abortControllerRef.current?.signal
        }
      );

      const subjectsData = response.data.subjects || [];

      // Transform each assignment into a selectable option
      const transformed = subjectsData.map((item) => ({
        assignmentId: item.assignmentId,
        subjectId: item.subject.id,
        subjectName: item.subject.subjectName,
        subjectCode: item.subject.subjectCode,
        semester: item.subject.semester,
        section: item.section,
        displayName: `${item.subject.subjectName} (${item.subject.subjectCode}) - Section ${item.section}`,
        totalStudents: item.stats?.totalStudents || 0,
        registeredStudents: item.stats?.registeredStudents || 0,
      }));

      setTeacherSubjects(transformed);

      if (transformed.length === 0) {
        showToast("No subjects assigned to you yet.", false);
      } else {
        setSelectedAssignment(transformed[0]);
      }
    } catch (error) {
      if (error.name !== 'CanceledError' && error.name !== 'AbortError') {
        showToast(error.response?.data?.message || "Failed to load your subjects.", false);
      }
    }
  };

  const fetchStudents = async (signal) => {
    setFetchingStudents(true);
    try {
      const params = {
        section: selectedSection,
        subjectId: selectedSubject,
      };
      if (selectedAssignment?.subject?.courseId) {
        params.courseId = selectedAssignment.subject.courseId;
      }
      if (selectedAssignment?.subject?.branch) {
        params.branch = selectedAssignment.subject.branch;
      }

      const response = await api.get('/users/public/users', {
        params,
        signal,
      });

      const studentsData = response.data || [];
      setStudents(studentsData);

      if (studentsData.length === 0) {
        showToast(`No students found in section ${selectedSection}`, false);
        setAttendanceData({});
      } else {
        const initialAttendance = {};
        studentsData.forEach((student) => {
          initialAttendance[student._id] = false;
        });
        setAttendanceData(initialAttendance);
        setExistingAttendance(false);
        setClassSessionInfo(null);
      }
    } catch (error) {
      if (error.name !== 'CanceledError' && error.name !== 'AbortError') {
        showToast("Failed to load students.", false);
      }
    } finally {
      setFetchingStudents(false);
    }
  };

  const fetchSectionTimetable = async () => {
    try {
      setSlotLoading(true);
      const res = await api.get(`/timetable/section/${selectedSection}`);
      const data = res.data.data;
      setSectionEntries(Array.isArray(data) ? data : data ? Object.values(data).flat() : []);
    } catch (err) {
      if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
        setSectionEntries([]);
      }
    } finally {
      setSlotLoading(false);
    }
  };

  const checkExistingAttendance = async () => {
    if (students.length === 0) return;

    try {
      const response = await api.get('/attendance/by-date', {
        params: {
          date: selectedDate,
          subjectId: selectedSubject,
          section: selectedSection,
        },
        signal: abortControllerRef.current?.signal,
      });

      if (response.data.attendance && response.data.attendance.length > 0) {
        const existingAttendanceMap = {};
        const validStudentIds = new Set(students.map(s => s._id));

        response.data.attendance.forEach((record) => {
          if (validStudentIds.has(record.studentId._id)) {
            existingAttendanceMap[record.studentId._id] = record.status === "present";
          }
        });

        if (Object.keys(existingAttendanceMap).length > 0) {
          setAttendanceData(existingAttendanceMap);
          setExistingAttendance(true);

          setClassSessionInfo({
            totalRecords: response.data.totalRecords,
            classSlots: response.data.classSlots || []
          });

          showToast(`📋 Existing attendance loaded for ${format(new Date(selectedDate.replace(/-/g, '/')), "MMMM d, yyyy")}`);
        } else {
          resetAttendanceDefault();
        }
      } else {
        resetAttendanceDefault();
      }
    } catch (error) {
      if (error.name !== 'CanceledError' && error.name !== 'AbortError') {
        resetAttendanceDefault();
      }
    }
  };

  const resetAttendanceDefault = () => {
    const defaultAttendance = {};
    students.forEach((student) => {
      defaultAttendance[student._id] = false;
    });
    setAttendanceData(defaultAttendance);
    setExistingAttendance(false);
    setClassSessionInfo(null);
  };

  const handleAttendanceChange = (studentId, isPresent) => {
    setAttendanceData((prev) => ({
      ...prev,
      [studentId]: isPresent,
    }));
  };

  const markAllPresent = () => {
    const allPresent = {};
    students.forEach((student) => {
      allPresent[student._id] = true;
    });
    setAttendanceData(allPresent);
    showToast("All students marked present.");
  };

  const markAllAbsent = () => {
    const allAbsent = {};
    students.forEach((student) => {
      allAbsent[student._id] = false;
    });
    setAttendanceData(allAbsent);
    showToast("All students marked absent.");
  };

  const showToast = (msg, success = true) => {
    setResponseMessage(msg);
    setIsSuccessToast(success);
    setTimeout(() => setResponseMessage(""), 5000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedDate || !selectedSubject || !selectedSection) {
      showToast("Please select date, subject, and section.", false);
      return;
    }

    if (classSlots.length === 0) {
      showToast(`No class is scheduled for this subject on ${getDayOfWeek(selectedDate)}. Please add a timetable slot first.`, false);
      return;
    }

    if (!selectedSlotId) {
      showToast("Please select the class time slot.", false);
      return;
    }

    const validStudentIds = new Set(students.map(s => s._id));
    const attendanceEntries = Object.entries(attendanceData);
    const validEntries = attendanceEntries.filter(([studentId]) =>
      validStudentIds.has(studentId)
    );

    if (validEntries.length === 0) {
      showToast("No valid students to mark attendance for.", false);
      return;
    }

    setIsLoading(true);
    const formattedAttendance = {};
    validEntries.forEach(([studentId, isPresent]) => {
      formattedAttendance[studentId] = isPresent ? "present" : "absent";
    });

    const payload = {
      date: selectedDate,
      subjectId: selectedSubject,
      section: selectedSection,
      timetableId: selectedSlotId,
      attendanceData: formattedAttendance,
    };

    if (!navigator.onLine) {
      saveToOfflineQueue(payload);
      setPendingSyncCount(getPendingSyncCount());
      showToast("📶 Saved offline! Attendance queued for auto-sync when online.", true);
      setIsLoading(false);
      return;
    }

    try {
      const response = await api.post('/attendance/mark', payload);

      if (response.status === 200 || response.status === 201) {
        showToast(
          `✅ Attendance marked successfully! (${response.data.recordsCreated || 0} records created)`
        );
        await checkExistingAttendance();
      }
    } catch (error) {
      if (!error.response || error.code === 'ERR_NETWORK') {
        saveToOfflineQueue(payload);
        setPendingSyncCount(getPendingSyncCount());
        showToast("📶 Network error. Attendance saved offline and queued for auto-sync.", true);
      } else if (error.response?.data?.message?.includes("already exists")) {
        showToast("⚠️ Attendance for this class session already exists.", false);
        setExistingAttendance(true);
      } else {
        showToast(error.response?.data?.message || "Failed to mark attendance.", false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const fullName = student.name || "";
      const rollNo = student.rollNo || "";
      const term = filterRollNo.toLowerCase();
      return fullName.toLowerCase().includes(term) || rollNo.toLowerCase().includes(term);
    });
  }, [students, filterRollNo]);

  if (!token) {
    return (
      <div className="flex items-center justify-center p-6">
        <Card padding="lg" className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-ink mb-2">Authentication Required</h2>
          <p className="text-ink-faint">Please log in to access attendance lists.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6" style={cssVars}>
      <PageHeader
        icon={BookOpen}
        title="Mark Attendance"
        subtitle="Select your subject assignment, adjust the date, and record roll list states."
        actions={
          <div className="flex items-center gap-2 bg-surface px-4 py-2 rounded-xl border border-line shadow-sm text-sm font-semibold text-ink-soft">
            <Calendar className="w-4 h-4 text-ink-faint" />
            {format(new Date(), "EEEE, MMM d, yyyy")}
          </div>
        }
      />

      {/* Offline & Sync Status Banner */}
      {(!isOnline || pendingSyncCount > 0) && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between shadow-card transition-all ${
          !isOnline 
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200' 
            : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-900 dark:text-indigo-200'
        }`}>
          <div className="flex items-center gap-3">
            {!isOnline ? (
              <WifiOff className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 animate-pulse" />
            ) : (
              <Wifi className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
            )}
            <div>
              <p className="text-sm font-bold">
                {!isOnline ? "Offline Mode Active" : "Pending Attendance Sync"}
              </p>
              <p className="text-xs opacity-90">
                {!isOnline 
                  ? `Internet connection unavailable. ${pendingSyncCount} attendance payload(s) queued locally.`
                  : `${pendingSyncCount} offline attendance payload(s) waiting to be synced to server.`}
              </p>
            </div>
          </div>
          {isOnline && pendingSyncCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={triggerOfflineSync}
              disabled={isSyncing}
              className="flex items-center gap-1.5"
            >
              {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {isSyncing ? "Syncing..." : "Sync Now"}
            </Button>
          )}
        </div>
      )}

      {/* Scheduled Class Slot */}
      <div className="bg-surface p-6 rounded-2xl border border-line shadow-card">
        <div className="flex items-center justify-between mb-4">
          <label className="block text-xs font-bold text-ink-faint uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-ink-faint" />
            Scheduled Class Slot {selectedDate ? `(${getDayOfWeek(selectedDate)})` : ""}
          </label>
          {slotLoading && <Loader2 className="w-4 h-4 animate-spin text-ink-faint" />}
        </div>

        {!selectedSubject || !selectedSection ? (
          <p className="text-sm text-ink-faint">Select a subject & section to see its scheduled slots.</p>
        ) : slotLoading ? null : classSlots.length === 0 ? (
          <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-800 text-sm">No class scheduled on {selectedDate ? getDayOfWeek(selectedDate) : ""}</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Attendance can only be marked against a scheduled class. Add a timetable slot for this subject in the Timetable Manager first.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {classSlots.map((slot) => {
              const active = slot._id === selectedSlotId;
              return (
                <button
                  key={slot._id}
                  type="button"
                  onClick={() => setSelectedSlotId(slot._id)}
                  className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition flex items-center gap-2 ${active
                      ? "bg-primary text-white border-primary shadow-sm"
                      : "bg-surface border-line text-ink-soft hover:border-primary/40"
                    }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  {slot.startTime}-{slot.endTime}
                  {slot.room ? ` · ${slot.room}` : ""}
                  {active && <Check className="w-3.5 h-3.5" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Existing Session Warning */}
      {existingAttendance && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
          <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-amber-800 text-sm">Attendance already logged for this date</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Modifying checkmarks and clicking update below will dynamically adjust existing record registers.
            </p>
            {classSessionInfo && (
              <div className="flex flex-wrap gap-4 mt-2 text-xs font-semibold text-amber-700 bg-surface/60 py-1.5 px-3 rounded-lg border border-line">
                <span>Synced Records: {classSessionInfo.totalRecords}</span>
                {classSessionInfo.classSlots?.length > 0 && (
                  <span>Sessions: {classSessionInfo.classSlots.map(s => `Period ${s.slot}`).join(', ')}</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Configuration select grid */}
      <div className="bg-surface p-6 rounded-2xl border border-line shadow-card grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Date Picker */}
        <div>
          <label className="block text-xs font-bold text-ink-faint uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-ink-faint" />
            Attendance Date
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            max={format(new Date(), "yyyy-MM-dd")}
            className="w-full px-3 py-2 border border-line rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none transition bg-surface text-ink"
            required
          />
        </div>

        {/* Subject Assignment Listbox */}
        <div className="md:col-span-2">
          <label className="block text-xs font-bold text-ink-faint uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Book className="w-4 h-4 text-ink-faint" />
            Subject & Section Assignment
          </label>
          <Listbox value={selectedAssignment} onChange={setSelectedAssignment}>
            <div className="relative">
              <Listbox.Button className="w-full rounded-xl bg-surface py-2 pl-3.5 pr-10 text-left border border-line text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 flex items-center justify-between min-h-[38px] transition-all">
                <span className="block truncate font-semibold text-ink">
                  {selectedAssignment?.displayName || "Select subject and section"}
                </span>
                <ChevronDown className="h-4 w-4 text-ink-faint" />
              </Listbox.Button>
              <Transition
                as={Fragment}
                leave="transition ease-in duration-100"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <Listbox.Options className="absolute z-10 mt-1.5 max-h-60 w-full overflow-auto rounded-xl bg-surface py-1 shadow-pop focus:outline-none text-sm border border-line">
                  {teacherSubjects.map((item) => (
                    <Listbox.Option
                      key={item.assignmentId}
                      value={item}
                      className={({ active }) =>
                        `relative cursor-pointer select-none py-2 pl-10 pr-4 transition ${active ? "bg-background text-ink" : "text-ink-soft"
                        }`
                      }
                    >
                      {({ selected }) => (
                        <>
                          <span className={`block truncate ${selected ? "font-bold text-primary" : "font-normal"}`}>
                            {item.displayName}
                          </span>
                          {selected && (
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-primary">
                              <Check className="h-4 w-4" />
                            </span>
                          )}
                        </>
                      )}
                    </Listbox.Option>
                  ))}
                </Listbox.Options>
              </Transition>
            </div>
          </Listbox>
        </div>
      </div>

      {/* Selected Section Indicator & Stats Row */}
      {selectedSection && students.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="Active Target"
            value={`Section ${selectedSection}`}
            subtitle={`${students.length} students enrolled`}
            tone="primary"
            icon={Book}
          />
          <StatCard
            label="Filtered list"
            value={stats.totalStudents}
            tone="neutral"
            icon={Users}
          />
          <StatCard
            label="Present Count"
            value={stats.presentCount}
            tone="success"
            icon={CheckCircle}
          />
          <StatCard
            label="Absent Count"
            value={stats.absentCount}
            tone="danger"
            icon={XCircle}
          />
        </div>
      )}

      {/* Roll List Container */}
      {selectedSection && (
        <Card padding="none" className="overflow-hidden">
          {/* Toolbar */}
          {students.length > 0 && (
            <div className="p-4 border-b border-line bg-background/50 flex flex-col sm:flex-row gap-4 items-center justify-between">
              {/* Search */}
              <div className="relative w-full sm:w-80">
                <input
                  type="text"
                  placeholder="Search by student name or roll..."
                  value={filterRollNo}
                  onChange={(e) => setFilterRollNo(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 border border-line rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary/20 bg-surface transition text-ink placeholder:text-ink-faint"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-faint" />
              </div>

              {/* Bulk tools */}
              <div className="flex gap-2 w-full sm:w-auto justify-end">
                <Button
                  onClick={markAllPresent}
                  variant="subtle"
                  size="sm"
                  leftIcon={UserCheck}
                >
                  Mark All Present
                </Button>
                <Button
                  onClick={markAllAbsent}
                  variant="dangerSubtle"
                  size="sm"
                  leftIcon={UserX}
                >
                  Mark All Absent
                </Button>
              </div>
            </div>
          )}

          {/* List Panels */}
          {fetchingStudents ? (
            <div className="text-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-ink-faint mx-auto mb-3" />
              <p className="text-ink-faint text-sm font-semibold">Loading student roster...</p>
            </div>
          ) : students.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No students enrolled"
              description={`There are no student registries for section ${selectedSection}.`}
            />
          ) : filteredStudents.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No matches found"
              description="Adjust your search keywords."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-line text-xs font-bold text-ink-faint uppercase tracking-wider bg-background/50">
                    <th className="py-3 pl-6">Student Name</th>
                    <th className="py-3">Roll Number</th>
                    <th className="py-3 pr-6 text-center w-40">Status Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-sm">
                  {filteredStudents.map((student) => {
                    const isChecked = attendanceData[student._id] === true;

                    return (
                      <motion.tr
                        key={student._id}
                        layout
                        className="hover:bg-background/70 transition-colors"
                      >
                        <td className="py-3.5 pl-6 font-semibold text-ink flex items-center gap-3">
                          <div className="h-8 w-8 rounded-xl bg-background flex items-center justify-center text-xs font-bold text-ink-faint border border-line flex-shrink-0">
                            {student.name?.charAt(0) || "?"}
                          </div>
                          <span className="truncate">{student.name}</span>
                        </td>
                        <td className="py-3.5 text-ink-soft font-mono text-xs">{student.rollNo || "N/A"}</td>
                        <td className="py-3.5 pr-6 text-center">
                          <div className="inline-flex rounded-xl p-0.5 bg-background border border-line shadow-inner">
                            <button
                              onClick={() => handleAttendanceChange(student._id, true)}
                              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${isChecked
                                  ? "bg-primary text-white shadow-sm"
                                  : "text-ink-soft hover:text-ink"
                                }`}
                            >
                              Present
                            </button>
                            <button
                              onClick={() => handleAttendanceChange(student._id, false)}
                              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${!isChecked
                                  ? "bg-red-600 text-white shadow-sm"
                                  : "text-ink-soft hover:text-ink"
                                }`}
                            >
                              Absent
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer submit action */}
          {students.length > 0 && (
            <div className="p-4 bg-background border-t border-line flex justify-end">
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isLoading || !selectedSection || classSlots.length === 0}
                loading={isLoading}
                leftIcon={RefreshCw}
                style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
              >
                {isLoading ? "Submitting..." : existingAttendance ? "Update Attendance" : "Submit Attendance"}
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Success Toast banner */}
      <AnimatePresence>
        {responseMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className={`fixed bottom-6 right-6 px-5 py-3 rounded-xl shadow-pop border-l-4 max-w-sm z-50 flex items-center gap-3 bg-surface ${isSuccessToast ? "border-emerald-500 text-emerald-700" : "border-amber-500 text-amber-700"
              }`}
          >
            {isSuccessToast ? <CheckCircle className="w-5 h-5 text-emerald-500" /> : <AlertCircle className="w-5 h-5 text-amber-500" />}
            <p className="text-xs font-semibold">{responseMessage}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
