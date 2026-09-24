import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Clock,
  FileText,
  Upload,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Info,
  Trash2,
  ExternalLink,
  BookOpen,
  CalendarDays,
  ShieldAlert,
  Send,
  Loader2,
  ChevronRight,
  WifiOff,
  Wifi,
  Users,
} from "lucide-react";
import api from "../../utils/api";
import { formatDateDMY, formatDateTime } from "../../utils/dateUtils";
import Button from "../common/ui/Button";
import Card from "../common/ui/Card";
import Badge from "../common/ui/Badge";
import DashboardHeader from "../common/ui/DashboardHeader";
import { Select, Textarea } from "../common/ui/Input";
import UniversalSpinner from "../common/ui/UniversalSpinner";
import EmptyState from "../common/ui/EmptyState";

const LEAVE_TYPES = [
  { value: "medical", label: "Medical / Health Illness", color: "danger" },
  { value: "od", label: "On Duty (OD) / College Representation", color: "purple" },
  { value: "personal", label: "Personal Emergency / Family", color: "primary" },
  { value: "bereavement", label: "Bereavement / Compassionate", color: "neutral" },
  { value: "other", label: "Other Legitimate Reason", color: "neutral" },
];

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export default function LeaveApplication() {
  const [profile, setProfile] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Offline Sync State
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [offlineCount, setOfflineCount] = useState(0);

  // Form State
  const [leaveType, setLeaveType] = useState("medical");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [scope, setScope] = useState("section"); // 'section' | 'single' | 'multi'
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedSubjectIds, setSelectedSubjectIds] = useState([]);
  const [selectedSlotId, setSelectedSlotId] = useState(""); // optional specific timetableId
  const [reason, setReason] = useState("");
  const [reasonDescription, setReasonDescription] = useState("");
  const [files, setFiles] = useState([]);
  const [fileError, setFileError] = useState("");

  // Timetable Slot Preview State
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewError, setPreviewError] = useState("");

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [examConflictBanner, setExamConflictBanner] = useState(null);

  // Leave History
  const [leaves, setLeaves] = useState([]);
  const [loadingLeaves, setLoadingLeaves] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [cancellingId, setCancellingId] = useState(null);

  const fileInputRef = useRef(null);

  // Sync offline requests queued in localStorage
  const syncOfflineQueue = useCallback(async () => {
    const rawQueue = localStorage.getItem("pending_offline_leaves");
    if (!rawQueue) return;
    let queue = [];
    try {
      queue = JSON.parse(rawQueue);
    } catch (e) {
      return;
    }
    if (!queue.length) return;

    let syncedCount = 0;
    const remaining = [];

    for (const item of queue) {
      try {
        const payload = {
          leaveType: item.leaveType,
          fromDate: item.fromDate,
          toDate: item.toDate,
          reason: item.reason,
          reasonDescription: item.reasonDescription,
        };
        if (item.scope === "single" && item.selectedSubjectId) {
          payload.subjectId = item.selectedSubjectId;
        } else if (item.scope === "multi" && item.selectedSubjectIds?.length > 0) {
          payload.subjectIds = item.selectedSubjectIds;
        }
        if (item.selectedSlotId) payload.timetableId = item.selectedSlotId;

        await api.post("/leaves", payload);
        syncedCount++;
      } catch (err) {
        remaining.push(item);
      }
    }

    localStorage.setItem("pending_offline_leaves", JSON.stringify(remaining));
    setOfflineCount(remaining.length);

    if (syncedCount > 0) {
      setSubmitSuccess(`Synced ${syncedCount} offline leave request(s) with the server.`);
      fetchLeaves();
    }
  }, []);

  // Online / Offline Connectivity Listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      syncOfflineQueue();
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial check for offline queue
    const rawQueue = localStorage.getItem("pending_offline_leaves");
    if (rawQueue) {
      try {
        const q = JSON.parse(rawQueue);
        setOfflineCount(q.length);
        if (navigator.onLine && q.length > 0) {
          syncOfflineQueue();
        }
      } catch (e) {}
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [syncOfflineQueue]);

  // 1. Fetch profile & student subjects
  const fetchStudentData = async () => {
    try {
      setLoadingProfile(true);

      const [userRes, subRes, enrolledRes] = await Promise.allSettled([
        api.get("/users/profile"),
        api.get("/tickets/student/subjects-teachers"),
        api.get("/subjects/student/enrolled").catch(() => null),
      ]);

      const profileData =
        (userRes.status === "fulfilled" &&
          (userRes.value?.data?.data || userRes.value?.data?.user || userRes.value?.data)) ||
        null;

      const studentInfo =
        (subRes.status === "fulfilled" &&
          (subRes.value?.data?.studentInfo || subRes.value?.data?.student || subRes.value?.data?.data)) ||
        null;

      let storedUser = null;
      try {
        const raw = localStorage.getItem("user");
        if (raw) storedUser = JSON.parse(raw);
      } catch (e) {}

      const resolvedSection =
        profileData?.section ||
        studentInfo?.section ||
        storedUser?.section ||
        localStorage.getItem("userSection") ||
        "";

      const resolvedName =
        profileData?.name ||
        studentInfo?.name ||
        storedUser?.name ||
        localStorage.getItem("userName") ||
        "Student";

      const resolvedRollNo =
        profileData?.rollNo ||
        studentInfo?.rollNo ||
        storedUser?.rollNo ||
        localStorage.getItem("userRollNo") ||
        "";

      const resolvedEmail =
        profileData?.email ||
        studentInfo?.email ||
        storedUser?.email ||
        localStorage.getItem("userEmail") ||
        "";

      const rawCourseId =
        profileData?.courseId || studentInfo?.courseId || storedUser?.courseId || null;
      const resolvedCourseId =
        rawCourseId && typeof rawCourseId === "object"
          ? String(rawCourseId._id || "")
          : typeof rawCourseId === "string" && rawCourseId !== "[object Object]"
          ? rawCourseId
          : null;
      const resolvedCourseName =
        (typeof profileData?.courseId === "object" ? profileData.courseId.name : null) ||
        profileData?.courseName ||
        studentInfo?.courseName ||
        storedUser?.courseName ||
        "";
      const resolvedBranch =
        profileData?.branch || studentInfo?.branch || storedUser?.branch || "";
      const resolvedSemester =
        profileData?.semester || studentInfo?.semester || storedUser?.semester || "";

      setProfile({
        name: resolvedName,
        rollNo: resolvedRollNo,
        section: resolvedSection,
        email: resolvedEmail,
        courseId: resolvedCourseId,
        courseName: resolvedCourseName,
        branch: resolvedBranch,
        semester: resolvedSemester,
      });

      // Populate subjects for single/multi subject leave selection
      if (subRes.status === "fulfilled" && Array.isArray(subRes.value?.data?.subjects) && subRes.value.data.subjects.length > 0) {
        setSubjects(subRes.value.data.subjects);
      } else if (enrolledRes.status === "fulfilled" && Array.isArray(enrolledRes.value?.data?.data)) {
        setSubjects(enrolledRes.value.data.data);
      }
    } catch (err) {
      console.error("Error loading student profile for leave application:", err);
    } finally {
      setLoadingProfile(false);
    }
  };

  // 2. Fetch student's own leave applications
  const fetchLeaves = async () => {
    try {
      setLoadingLeaves(true);
      const res = await api.get("/leaves/student");
      if (res.data?.success) {
        setLeaves(res.data.data || []);
      }
    } catch (err) {
      console.error("Error fetching student leaves:", err);
    } finally {
      setLoadingLeaves(false);
    }
  };

  useEffect(() => {
    fetchStudentData();
    fetchLeaves();
  }, []);

  // Slot Preview Preflight Check
  const fetchSlotPreview = useCallback(async () => {
    const currentSection = (profile?.section || "").trim().toUpperCase();
    if (!currentSection || !fromDate || !toDate) {
      setPreviewData(null);
      return;
    }

    if (new Date(fromDate) > new Date(toDate)) {
      setPreviewError("From Date cannot be later than To Date");
      setPreviewData(null);
      return;
    }

    try {
      setPreviewLoading(true);
      setPreviewError("");
      const params = {
        section: currentSection,
        fromDate,
        toDate,
      };
      const cId = profile?.courseId?._id ? String(profile.courseId._id) : (typeof profile?.courseId === "string" ? profile.courseId : null);
      if (cId && cId !== "[object Object]") params.courseId = cId;
      if (profile?.branch) params.branch = profile.branch;
      if (profile?.semester !== undefined && profile?.semester !== null && profile?.semester !== "") {
        params.semester = profile.semester;
      }
      if (scope === "single" && selectedSubjectId) {
        params.subjectId = selectedSubjectId;
      }

      const res = await api.get("/leaves/slots-preview", { params });
      if (res.data?.success) {
        setPreviewData(res.data.data);
      }
    } catch (err) {
      const msg = err.response?.data?.message || "Could not preview timetable slots";
      setPreviewError(msg);
      setPreviewData(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [profile?.section, profile?.courseId, profile?.branch, profile?.semester, fromDate, toDate, scope, selectedSubjectId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSlotPreview();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchSlotPreview]);

  // Handle file uploads
  const handleFilesSelected = (e) => {
    const selected = Array.from(e.target.files || []);
    setFileError("");

    if (files.length + selected.length > MAX_FILES) {
      setFileError(`You can only upload up to ${MAX_FILES} attachments in total.`);
      return;
    }

    for (const f of selected) {
      if (!ALLOWED_TYPES.includes(f.type)) {
        setFileError(`Unsupported file format: ${f.name}. Allowed: PDF, JPG, PNG, WEBP, DOC, DOCX.`);
        return;
      }
      if (f.size > MAX_FILE_SIZE) {
        setFileError(`File ${f.name} exceeds 10MB limit.`);
        return;
      }
    }

    setFiles((prev) => [...prev, ...selected]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (idx) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const toggleSubjectSelection = (subId) => {
    setSelectedSubjectIds((prev) =>
      prev.includes(subId) ? prev.filter((id) => id !== subId) : [...prev, subId]
    );
  };

  // Submit leave form
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");
    setSubmitSuccess("");
    setExamConflictBanner(null);

    if (!fromDate || !toDate) {
      setSubmitError("Please specify both From Date and To Date");
      return;
    }

    if (new Date(fromDate) > new Date(toDate)) {
      setSubmitError("From Date cannot be later than To Date");
      return;
    }

    if (reason.trim().length < 3) {
      setSubmitError("Please provide a summary reason of at least 3 characters");
      return;
    }

    if (reasonDescription.trim().length < 10) {
      setSubmitError("Please provide a detailed explanation of at least 10 characters");
      return;
    }

    if (scope === "single" && !selectedSubjectId) {
      setSubmitError("Please select a specific subject for single-subject leave");
      return;
    }

    if (scope === "multi" && selectedSubjectIds.length === 0) {
      setSubmitError("Please select at least one subject for multi-subject leave");
      return;
    }

    // OFFLINE QUEUEING FALLBACK
    if (!navigator.onLine) {
      const offlineQueue = JSON.parse(localStorage.getItem("pending_offline_leaves") || "[]");
      offlineQueue.push({
        id: `offline_${Date.now()}`,
        leaveType,
        fromDate,
        toDate,
        scope,
        selectedSubjectId,
        selectedSubjectIds,
        selectedSlotId,
        reason: reason.trim(),
        reasonDescription: reasonDescription.trim(),
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem("pending_offline_leaves", JSON.stringify(offlineQueue));
      setOfflineCount(offlineQueue.length);
      setSubmitSuccess(
        "You are currently offline. Your leave application has been safely saved locally and will auto-submit as soon as internet connectivity returns."
      );
      setReason("");
      setReasonDescription("");
      setSelectedSlotId("");
      return;
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append("leaveType", leaveType);
      formData.append("fromDate", fromDate);
      formData.append("toDate", toDate);
      formData.append("reason", reason.trim());
      formData.append("reasonDescription", reasonDescription.trim());

      if (scope === "single" && selectedSubjectId) {
        formData.append("subjectId", selectedSubjectId);
        formData.append("subjectIds", JSON.stringify([selectedSubjectId]));
      } else if (scope === "multi" && selectedSubjectIds.length > 0) {
        formData.append("subjectIds", JSON.stringify(selectedSubjectIds));
      }

      if (selectedSlotId) {
        formData.append("timetableId", selectedSlotId);
      }

      files.forEach((file) => {
        formData.append("attachments", file);
      });

      const res = await api.post("/leaves", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data?.success) {
        setSubmitSuccess("Leave request submitted successfully! Queued for faculty review.");
        // Reset form
        setReason("");
        setReasonDescription("");
        setFiles([]);
        setSelectedSlotId("");
        setSelectedSubjectIds([]);
        // Refresh leaves list
        fetchLeaves();
      }
    } catch (err) {
      const errorData = err.response?.data;
      const msg = errorData?.message || "Failed to submit leave request";

      if (errorData?.code === "EXAM_OD_FORBIDDEN" || errorData?.examConflict) {
        setExamConflictBanner({
          title: "Exam Period Conflict Detected",
          message: msg,
          examTitle: errorData?.conflictingExamTitle,
          examDate: errorData?.conflictingExamDate,
        });
      } else {
        setSubmitError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Cancel leave
  const handleCancelLeave = async (leaveId) => {
    if (!window.confirm("Are you sure you want to cancel this leave application? Any reconciled attendance will be reverted.")) return;
    try {
      setCancellingId(leaveId);
      const res = await api.post(`/leaves/${leaveId}/cancel`, { reason: "Cancelled by student" });
      if (res.data?.success) {
        fetchLeaves();
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to cancel leave request");
    } finally {
      setCancellingId(null);
    }
  };

  // Filter leaves
  const filteredLeaves = leaves.filter((item) => {
    if (statusFilter === "all") return true;
    return item.status === statusFilter;
  });

  const getLeaveTypeBadge = (type) => {
    const item = LEAVE_TYPES.find((t) => t.value === type) || {
      label: type.toUpperCase(),
      color: "neutral",
    };
    return <Badge tone={item.color}>{item.label}</Badge>;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "approved":
      case "attendance-updated":
        return <Badge tone="success">Approved & Reconciled</Badge>;
      case "rejected":
        return <Badge tone="danger">Rejected</Badge>;
      case "needs-more-info":
        return <Badge tone="warning">Action Required</Badge>;
      case "cancelled":
        return <Badge tone="neutral">Cancelled</Badge>;
      default:
        return <Badge tone="purple">Pending Review</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Offline Status Alert Banner */}
      {isOffline && (
        <div className="flex items-center justify-between p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-800 dark:text-amber-200 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <WifiOff className="h-4 w-4 text-amber-600 animate-pulse" />
            <span>You are currently offline. Applications will be safely queued locally and submitted automatically when reconnected.</span>
          </div>
          {offlineCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[11px]">
              {offlineCount} pending in queue
            </span>
          )}
        </div>
      )}

      {/* Header */}
      <DashboardHeader
        title="Leave & OD Management"
        subtitle="Apply for medical leaves, on-duty approvals, and track academic attendance reconciliation."
        breadcrumbs={[
          { label: "Dashboard", href: "/student/dashboard" },
          { label: "Leave Applications" },
        ]}
      />

      {/* Student Identity Card */}
      <Card className="p-4 bg-gradient-to-r from-primary/5 via-surface to-surface border border-line">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-base shadow-sm">
              {profile?.name ? profile.name.charAt(0).toUpperCase() : "S"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-ink">
                  {loadingProfile ? "Loading student profile..." : profile?.name || "Student"}
                </h3>
                {profile?.rollNo && (
                  <span className="px-2 py-0.5 rounded-full bg-surface-alt border border-line text-[11px] font-mono font-medium text-ink-soft">
                    {profile.rollNo}
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-soft mt-0.5">
                {profile?.email || ""}
                {profile?.courseName && (
                  <span className="text-ink-faint"> • {profile.courseName}</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-medium flex-wrap">
            <div className="px-3 py-1.5 rounded-lg bg-surface border border-line flex items-center gap-2 shadow-2xs">
              <span className="text-ink-faint">Section:</span>
              <span className="font-bold text-primary font-mono">
                {profile?.section ? `Section ${profile.section}` : "Unassigned"}
              </span>
            </div>
            {profile?.semester && (
              <div className="px-3 py-1.5 rounded-lg bg-surface border border-line flex items-center gap-2 shadow-2xs">
                <span className="text-ink-faint">Semester:</span>
                <span className="font-bold text-ink">Sem {profile.semester}</span>
              </div>
            )}
            {profile?.branch && (
              <div className="px-3 py-1.5 rounded-lg bg-surface border border-line flex items-center gap-2 shadow-2xs">
                <span className="text-ink-faint">Branch:</span>
                <span className="font-bold text-ink">{profile.branch}</span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Main Grid: Application Form (Left) & Applications History (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Apply for Leave Form */}
        <div className="lg:col-span-6 space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-2 pb-4 mb-4 border-b border-line">
              <Calendar className="h-5 w-5 text-primary" />
              <h2 className="text-base font-bold text-ink">Submit Leave Application</h2>
            </div>

            {/* Exam Conflict Alert Banner */}
            {examConflictBanner && (
              <div className="mb-4 p-4 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 space-y-2">
                <div className="flex items-center gap-2 text-red-700 dark:text-red-300 font-bold text-sm">
                  <ShieldAlert className="h-5 w-5 flex-shrink-0" />
                  <h4>{examConflictBanner.title}</h4>
                </div>
                <p className="text-xs text-red-600 dark:text-red-400">
                  {examConflictBanner.message}
                </p>
                {examConflictBanner.examTitle && (
                  <div className="text-[11px] font-mono text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/50 p-2 rounded">
                    Conflicting Examination: {examConflictBanner.examTitle} (
                    {formatDateDMY(examConflictBanner.examDate)})
                  </div>
                )}
              </div>
            )}

            {submitError && (
              <div className="mb-4 p-3.5 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {submitSuccess && (
              <div className="mb-4 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 flex items-start gap-2.5 text-xs text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{submitSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Leave Type Selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1.5">
                  Leave Category <span className="text-red-500">*</span>
                </label>
                <Select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                  disabled={submitting}
                  required
                >
                  {LEAVE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Scope Selection: Section vs Single Subject vs Multi-Subject */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1.5">
                  Application Scope <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setScope("section")}
                    className={`py-2 px-2 rounded-lg text-xs font-semibold border transition-all text-center ${
                      scope === "section"
                        ? "bg-primary text-white border-primary shadow-sm"
                        : "bg-surface text-ink border-line hover:bg-surface-alt"
                    }`}
                  >
                    All Classes (Full Day)
                  </button>
                  <button
                    type="button"
                    onClick={() => setScope("single")}
                    className={`py-2 px-2 rounded-lg text-xs font-semibold border transition-all text-center ${
                      scope === "single"
                        ? "bg-primary text-white border-primary shadow-sm"
                        : "bg-surface text-ink border-line hover:bg-surface-alt"
                    }`}
                  >
                    Single Subject
                  </button>
                  <button
                    type="button"
                    onClick={() => setScope("multi")}
                    className={`py-2 px-2 rounded-lg text-xs font-semibold border transition-all text-center ${
                      scope === "multi"
                        ? "bg-primary text-white border-primary shadow-sm"
                        : "bg-surface text-ink border-line hover:bg-surface-alt"
                    }`}
                  >
                    Multi-Subject
                  </button>
                </div>
              </div>

              {/* Subject Selector (if scope === 'single') */}
              {scope === "single" && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1.5">
                    Select Subject <span className="text-red-500">*</span>
                  </label>
                  <Select
                    value={selectedSubjectId}
                    onChange={(e) => setSelectedSubjectId(e.target.value)}
                    disabled={submitting || subjects.length === 0}
                    required={scope === "single"}
                  >
                    <option value="">-- Choose Subject --</option>
                    {subjects.map((sub) => (
                      <option key={sub.id || sub._id} value={sub.id || sub._id}>
                        {sub.subjectCode ? `[${sub.subjectCode}] ` : ""}
                        {sub.subjectName}
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              {/* Multi-Subject Checkbox Selector (if scope === 'multi') */}
              {scope === "multi" && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1.5">
                    Select Subjects ({selectedSubjectIds.length} chosen) <span className="text-red-500">*</span>
                  </label>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 p-2.5 rounded-lg border border-line bg-surface-alt/50">
                    {subjects.map((sub) => {
                      const sId = sub.id || sub._id;
                      const isChecked = selectedSubjectIds.includes(sId);
                      return (
                        <label
                          key={sId}
                          className="flex items-center gap-2.5 p-1.5 rounded hover:bg-surface cursor-pointer text-xs text-ink"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSubjectSelection(sId)}
                            className="rounded border-line text-primary focus:ring-primary"
                          />
                          <span className="font-medium">
                            {sub.subjectCode ? `[${sub.subjectCode}] ` : ""}
                            {sub.subjectName}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Date Range Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1.5">
                    From Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                    disabled={submitting}
                  />
                  <p className="text-[11px] text-ink-faint mt-1">Start date of absence</p>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1.5">
                    To Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                    disabled={submitting}
                  />
                  <p className="text-[11px] text-ink-faint mt-1">End date of absence</p>
                </div>
              </div>

              {/* Timetable Preflight / Slot Verification Feedback */}
              {previewLoading && (
                <div className="flex items-center gap-2 p-3 bg-surface-alt rounded-lg border border-line text-xs text-ink-soft">
                  <UniversalSpinner size="sm" />
                  <span>Validating scheduled classes against section timetable...</span>
                </div>
              )}

              {previewError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg text-xs text-red-700 dark:text-red-300">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{previewError}</span>
                </div>
              )}

              {previewData && !previewLoading && (
                <div className="space-y-2 p-3.5 bg-surface-alt/70 rounded-lg border border-line">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-ink flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-primary" />
                      Timetable Verification:
                    </span>
                    <span className="font-bold text-ink">
                      {previewData.totalDays} {previewData.totalDays === 1 ? "day" : "days"} •{" "}
                      {previewData.totalSlots} scheduled {previewData.totalSlots === 1 ? "class" : "classes"}
                    </span>
                  </div>

                  {previewData.zeroSlotDays?.length > 0 && (
                    <div className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300 mt-1">
                      <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                      <span>
                        Note: No classes scheduled on {previewData.zeroSlotDays.map((d) => formatDateDMY(d)).join(", ")}.
                      </span>
                    </div>
                  )}

                  {/* Half-day / Specific slot picker if single-day leave */}
                  {previewData.totalDays === 1 && previewData.schedule[0]?.slots?.length > 1 && (
                    <div className="pt-2 border-t border-line/70">
                      <label className="block text-[11px] font-semibold text-ink mb-1">
                        Select Specific Class Slot (Optional / Half-Day):
                      </label>
                      <Select
                        value={selectedSlotId}
                        onChange={(e) => setSelectedSlotId(e.target.value)}
                      >
                        <option value="">Full Day (All scheduled classes on this date)</option>
                        {previewData.schedule[0].slots.map((slot) => (
                          <option key={slot.timetableId} value={slot.timetableId}>
                            {slot.startTime} - {slot.endTime} • {slot.subjectName || slot.subjectCode}
                          </option>
                        ))}
                      </Select>
                    </div>
                  )}
                </div>
              )}

              {/* Reason Summary */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1.5">
                  Reason Summary <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., Severe Viral Fever or Inter-College Robotics Hackathon"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                  disabled={submitting}
                  minLength={3}
                  maxLength={200}
                />
              </div>

              {/* Reason Description */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1.5">
                  Detailed Explanation <span className="text-red-500">*</span>
                </label>
                <Textarea
                  placeholder="Provide complete context, doctor recommendations, or event participation details..."
                  rows={3}
                  value={reasonDescription}
                  onChange={(e) => setReasonDescription(e.target.value)}
                  required
                  disabled={submitting}
                  minLength={10}
                  maxLength={2000}
                />
              </div>

              {/* Attachments Section */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1.5">
                  Supporting Documents / Proofs
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-line hover:border-primary/50 bg-surface-alt/40 hover:bg-surface-alt rounded-xl p-4 text-center cursor-pointer transition-colors"
                >
                  <Upload className="h-6 w-6 text-ink-faint mx-auto mb-1.5" />
                  <p className="text-xs font-semibold text-ink">
                    Click to upload doctor certificate, event invite, or letter
                  </p>
                  <p className="text-[11px] text-ink-faint mt-0.5">
                    PDF, JPG, PNG, DOCX up to 10MB each (max 5 attachments)
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx"
                  onChange={handleFilesSelected}
                  className="hidden"
                  disabled={submitting}
                />

                {fileError && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" /> {fileError}
                  </p>
                )}

                {/* Uploaded files preview */}
                {files.length > 0 && (
                  <div className="mt-2.5 space-y-1.5">
                    {files.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 rounded-lg bg-surface border border-line text-xs"
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                          <span className="truncate text-ink font-medium">{file.name}</span>
                          <span className="text-ink-faint text-[10px]">
                            ({(file.size / 1024).toFixed(0)} KB)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(idx)}
                          className="text-red-500 hover:text-red-700 p-1 rounded"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={submitting || (previewError && !previewData)}
                  className="w-full flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Submitting Application...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      <span>Submit Application</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Card>
        </div>

        {/* RIGHT COLUMN: Applications History & Status */}
        <div className="lg:col-span-6 space-y-4">
          <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-line">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                <h2 className="text-base font-bold text-ink">My Applications</h2>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 bg-surface-alt p-1 rounded-lg border border-line text-xs">
                {["all", "pending", "approved", "rejected"].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setStatusFilter(tab)}
                    className={`px-2.5 py-1 rounded-md capitalize font-semibold transition-all ${
                      statusFilter === tab
                        ? "bg-surface text-primary shadow-2xs"
                        : "text-ink-soft hover:text-ink"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {loadingLeaves ? (
              <div className="py-12 flex justify-center">
                <UniversalSpinner size="md" />
              </div>
            ) : filteredLeaves.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="No Leave Applications"
                description={
                  statusFilter === "all"
                    ? "You have not submitted any leave requests yet."
                    : `No leave applications found with status '${statusFilter}'.`
                }
              />
            ) : (
              <div className="space-y-4">
                {filteredLeaves.map((item) => (
                  <motion.div
                    key={item._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-xl border border-line bg-surface hover:shadow-sm transition-shadow space-y-3"
                  >
                    {/* Header: Type & Status */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getLeaveTypeBadge(item.leaveType)}
                        {item.flowType && (
                          <Badge tone={item.flowType === "single-subject" ? "neutral" : "purple"} size="sm">
                            {item.flowType === "single-subject"
                              ? "Single Subject"
                              : item.flowType === "multi-subject"
                              ? "Multi-Subject"
                              : "All Classes"}
                          </Badge>
                        )}
                        {item.examPeriodConflict && (
                          <Badge tone="danger" size="sm">
                            Exam Conflict
                          </Badge>
                        )}
                      </div>
                      {getStatusBadge(item.status)}
                    </div>

                    {/* Date Window in strict DD/MM/YYYY */}
                    <div className="flex items-center gap-2 text-xs font-semibold text-ink">
                      <Calendar className="h-3.5 w-3.5 text-primary" />
                      <span>
                        {formatDateDMY(item.fromDate)}
                        {item.fromDate !== item.toDate && ` — ${formatDateDMY(item.toDate)}`}
                      </span>
                      {item.sessionSlot?.startTime && (
                        <span className="text-ink-soft font-normal">
                          ({item.sessionSlot.startTime} - {item.sessionSlot.endTime})
                        </span>
                      )}
                    </div>

                    {/* Assigned Mentor or Teacher */}
                    {(item.mentorId?.name || item.assignedTeacherId?.name) && (
                      <div className="flex items-center gap-1.5 text-xs text-ink-soft">
                        <Users className="h-3.5 w-3.5 text-ink-faint" />
                        <span>
                          {item.mentorId?.name
                            ? `Academic Mentor: ${item.mentorId.name}`
                            : `Subject Faculty: ${item.assignedTeacherId.name}`}
                        </span>
                      </div>
                    )}

                    {/* Reason Summary */}
                    <div>
                      <p className="text-xs font-bold text-ink">{item.reason}</p>
                      <p className="text-xs text-ink-soft line-clamp-2 mt-0.5">
                        {item.reasonDescription}
                      </p>
                    </div>

                    {/* Attachments List */}
                    {item.attachments?.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {item.attachments.map((att, attIdx) => (
                          <a
                            key={attIdx}
                            href={att.url || `/api/tickets/file/${att._id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-alt hover:bg-line text-xs font-medium text-ink transition-colors border border-line"
                          >
                            <FileText className="h-3 w-3 text-primary" />
                            <span className="max-w-[140px] truncate">{att.originalName}</span>
                            <ExternalLink className="h-2.5 w-2.5 text-ink-faint" />
                          </a>
                        ))}
                      </div>
                    )}

                    {/* Revert outcome note if cancelled */}
                    {item.revertOutcome && (
                      <div className="p-2 bg-neutral-100 dark:bg-neutral-800/60 rounded text-[11px] text-ink-faint border border-line">
                        Attendance Reverted: {item.revertOutcome.revertedCount || 0} absent restored,{" "}
                        {item.revertOutcome.deletedSyntheticCount || 0} synthetic records removed.
                      </div>
                    )}

                    {/* Multi-tier Approval Chain Status */}
                    {item.approvalChain?.length > 0 && (
                      <div className="pt-2 border-t border-line/60 flex items-center justify-between text-[11px] text-ink-faint">
                        <div className="flex items-center gap-1.5">
                          <span>Approval Chain:</span>
                          {item.approvalChain.map((step, sIdx) => (
                            <span
                              key={sIdx}
                              className={`px-1.5 py-0.5 rounded uppercase font-semibold text-[10px] ${
                                step.status === "approved"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                  : step.status === "rejected"
                                  ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                                  : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              }`}
                            >
                              {step.role} ({step.status})
                            </span>
                          ))}
                        </div>

                        {["pending", "approved", "attendance-updated"].includes(item.status) && (
                          <button
                            type="button"
                            onClick={() => handleCancelLeave(item._id)}
                            disabled={cancellingId === item._id}
                            className="text-red-600 hover:text-red-800 font-semibold text-xs"
                          >
                            {cancellingId === item._id ? "Cancelling..." : "Cancel"}
                          </button>
                        )}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
