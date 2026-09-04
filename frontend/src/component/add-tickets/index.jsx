// src/component/add-tickets/index.jsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
  User,
  BookOpen,
  IdCard,
  Upload,
  FileText,
  X,
  Info,
  Loader2,
  GraduationCap,
  Calendar,
  ShieldCheck,
  HelpCircle,
  ArrowLeft
} from "lucide-react";
import api from "../../utils/api";
import { logError } from "../../utils/logger";
import Button from "../common/ui/Button";
import Card from "../common/ui/Card";
import Badge from "../common/ui/Badge";
import DashboardHeader from "../common/ui/DashboardHeader";
import { Select, Textarea } from "../common/ui/Input";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const REASON_OPTIONS = [
  { value: "medical", label: "Medical / Health Issue" },
  { value: "family-emergency", label: "Family Emergency" },
  { value: "institutional-work", label: "Institutional / College Work" },
  { value: "academic", label: "Academic Competition / Seminar" },
  { value: "personal", label: "Personal Emergency" },
  { value: "other", label: "Other Reason" }
];

const InputField = ({ id, icon: Icon, label, value, disabled = true }) => (
  <div className="flex-1">
    <label htmlFor={id} className="block text-xs font-semibold text-ink-soft uppercase tracking-wider mb-1">
      {label}
    </label>
    <div className="relative">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Icon className="h-4 w-4 text-ink-faint" />
      </div>
      <input
        id={id}
        type="text"
        className="w-full pl-9 pr-3 py-2 bg-background border border-line rounded-lg text-sm text-ink font-medium opacity-90 cursor-not-allowed"
        value={value || ""}
        disabled={disabled}
        readOnly
      />
    </div>
  </div>
);

const FileUploadArea = ({ file, setFile, error, setError }) => {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);

  const validateFile = (selectedFile) => {
    if (!selectedFile) return false;

    if (!ALLOWED_FILE_TYPES.includes(selectedFile.type)) {
      setError("Invalid file format. Please upload PDF, DOC, DOCX, JPG, or PNG.");
      return false;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setError("File exceeds 5MB limit.");
      return false;
    }

    setError(null);
    return true;
  };

  const handleFileSelect = (selectedFile) => {
    if (validateFile(selectedFile)) {
      setFile(selectedFile);
    } else {
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFileSelect(e.dataTransfer.files[0]);
  };

  return (
    <div
      className={`
        relative min-h-[160px] rounded-xl border-2 border-dashed bg-surface
        transition-all duration-200 cursor-pointer flex flex-col items-center justify-center p-6 text-center
        ${dragActive ? 'border-primary bg-primary/5 ring-4 ring-primary/10' : 'border-line hover:border-primary/60 hover:bg-surface-hover'}
        ${error ? 'border-red-400 bg-red-50/20' : ''}
      `}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
      />
      {file ? (
        <div className="flex flex-col items-center gap-2">
          <div className="p-3 bg-primary/10 text-primary rounded-xl">
            <FileText className="h-8 w-8" />
          </div>
          <p className="text-sm font-medium text-ink max-w-[280px] truncate">{file.name}</p>
          <Badge tone="primary" size="sm">
            {(file.size / 1024 / 1024).toFixed(2)} MB
          </Badge>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setFile(null);
              if (inputRef.current) inputRef.current.value = '';
              setError(null);
            }}
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-md transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            Remove File
          </button>
        </div>
      ) : (
        <>
          <div className="p-3 bg-surface-raised border border-line text-primary rounded-xl mb-3">
            <Upload className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold text-ink">
            Click to upload <span className="font-normal text-ink-soft">or drag & drop proof document</span>
          </p>
          <p className="text-xs text-ink-faint mt-1">
            PDF, DOCX, JPG, PNG (Max 5MB)
          </p>
        </>
      )}
      {error && (
        <p className="mt-3 text-xs font-semibold text-red-600 flex items-center gap-1">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </p>
      )}
    </div>
  );
};

export default function Ticket() {
  const navigate = useNavigate();
  const [userData, setUserData] = useState({
    name: "",
    email: "",
    section: "",
    rollNo: "",
    userId: ""
  });

  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchingSubjects, setFetchingSubjects] = useState(true);

  // Form State
  const [formData, setFormData] = useState({
    subjectId: "",
    teacherId: "",
    absentDate: new Date().toISOString().split("T")[0],
    reason: "medical",
    reasonDescription: ""
  });

  const [file, setFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [disableSubmit, setDisableSubmit] = useState(false);
  const [responseStatus, setResponseStatus] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [fileError, setFileError] = useState(null);

  // Cooldown prevention
  const [lastSubmitTime, setLastSubmitTime] = useState(
    localStorage.getItem("lastTicketSubmitTime") || null
  );

  const todayStr = new Date().toISOString().split("T")[0];

  // 1. Fetch User Data and Student Subjects with Assigned Teachers
  useEffect(() => {
    const initData = async () => {
      try {
        setLoading(true);
        const userId = localStorage.getItem("userId");

        // Parallel fetch of user profile and subjects with assigned teachers
        const [userRes, subjectsRes] = await Promise.allSettled([
          userId ? api.get(`/users/public/users/${userId}`) : Promise.reject("No user ID"),
          api.get("/tickets/student/subjects-teachers")
        ]);

        if (userRes.status === "fulfilled" && userRes.value.data) {
          const user = userRes.value.data;
          setUserData({
            name: user.name || "",
            email: user.email || "",
            section: user.section || "",
            rollNo: user.rollNo || "",
            branch: user.branch || "",
            semester: user.semester || 1,
            courseName: user.courseName || "Undergraduate",
            userId: user._id || userId
          });
        } else {
          setUserData({
            name: localStorage.getItem("name") || "",
            email: localStorage.getItem("userEmail") || "",
            section: localStorage.getItem("section") || "",
            rollNo: localStorage.getItem("rollNo") || "",
            branch: "",
            semester: 1,
            courseName: "",
            userId: localStorage.getItem("userId") || ""
          });
        }

        if (subjectsRes.status === "fulfilled" && subjectsRes.value.data?.success) {
          const subList = subjectsRes.value.data.subjects || [];
          const studentInfo = subjectsRes.value.data.studentInfo;

          if (studentInfo) {
            setUserData(prev => ({
              ...prev,
              name: studentInfo.name || prev.name,
              rollNo: studentInfo.rollNo || prev.rollNo,
              section: studentInfo.section || prev.section,
              branch: studentInfo.branch || prev.branch,
              semester: studentInfo.semester || prev.semester,
              courseName: studentInfo.courseName || prev.courseName
            }));
          }

          setSubjects(subList);

          // Auto-select first subject and its automatically assigned teacher
          if (subList.length > 0) {
            const firstSub = subList[0];
            const autoTeacher = firstSub.assignedTeacher || firstSub.teachers?.[0];
            setFormData(prev => ({
              ...prev,
              subjectId: firstSub.id || firstSub._id,
              teacherId: autoTeacher ? (autoTeacher.id || autoTeacher._id) : ""
            }));
          }
        } else {
          setSubjects([]);
        }
      } catch (err) {
        logError("Init Create Ticket Data", err);
      } finally {
        setLoading(false);
        setFetchingSubjects(false);
      }
    };

    initData();
  }, []);

  // Cooldown Timer
  useEffect(() => {
    if (lastSubmitTime) {
      const elapsed = Date.now() - parseInt(lastSubmitTime);
      const cooldownPeriod = 30000; // 30s cooldown
      if (elapsed < cooldownPeriod) {
        setDisableSubmit(true);
        const timeout = setTimeout(() => {
          setDisableSubmit(false);
        }, cooldownPeriod - elapsed);
        return () => clearTimeout(timeout);
      }
    }
  }, [lastSubmitTime]);

  // Selected Subject Object
  const selectedSubject = subjects.find(
    s => (s.id || s._id) === formData.subjectId
  );

  // Automatically resolved teacher for selected subject
  const currentAssignedTeacher = selectedSubject?.assignedTeacher || selectedSubject?.teachers?.[0] || null;

  // When Subject Changes -> Automatically resolve and bind assigned teacher!
  const handleSubjectChange = (e) => {
    const newSubjectId = e.target.value;
    const sub = subjects.find(s => (s.id || s._id) === newSubjectId);
    const autoTeacher = sub?.assignedTeacher || sub?.teachers?.[0];

    setFormData(prev => ({
      ...prev,
      subjectId: newSubjectId,
      teacherId: autoTeacher ? (autoTeacher.id || autoTeacher._id) : ""
    }));
  };

  const handleFieldChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.id || e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.subjectId) {
      setErrorMessage("Please select a subject.");
      return;
    }

    if (!formData.teacherId) {
      setErrorMessage("No teacher is assigned to this subject. Please contact administration.");
      return;
    }

    if (!formData.absentDate) {
      setErrorMessage("Please select the date of absence.");
      return;
    }

    if (!formData.reasonDescription || formData.reasonDescription.trim().length < 10) {
      setErrorMessage("Please provide a description of at least 10 characters.");
      return;
    }

    if (!file) {
      setFileError("Supporting proof document is required.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setResponseStatus(null);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append("subjectId", formData.subjectId);
      formDataToSend.append("teacherId", formData.teacherId);
      formDataToSend.append("absentDate", formData.absentDate);
      formDataToSend.append("reason", formData.reason);
      formDataToSend.append("reasonDescription", formData.reasonDescription.trim());
      formDataToSend.append("files", file);

      const response = await api.post("/tickets", formDataToSend, {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      });

      if (response.data?.success) {
        setDisableSubmit(true);
        const currentTime = Date.now();
        setLastSubmitTime(currentTime);
        localStorage.setItem("lastTicketSubmitTime", currentTime);
        setResponseStatus("success");

        setTimeout(() => {
          navigate("/dashboard");
        }, 1800);
      } else {
        setResponseStatus("error");
        setErrorMessage(response.data?.message || "Failed to create ticket.");
      }
    } catch (err) {
      logError("Create Ticket Error", err);
      setResponseStatus("error");
      setErrorMessage(
        err.response?.data?.message || "An error occurred while creating the ticket. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-28">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
          <p className="text-sm font-medium text-ink-soft">Loading your semester subjects and teachers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <DashboardHeader
        greeting="Absence Verification & Leave Ticket"
        meta="Submit formal medical, institutional, or emergency absence certificates directly to your course faculty"
        actions={
          <Button
            variant="subtle"
            size="sm"
            leftIcon={ArrowLeft}
            onClick={() => navigate("/dashboard")}
          >
            Back to Dashboard
          </Button>
        }
      />

      {/* Student Academic Details Card */}
      <Card padding="md">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-line">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-ink-soft">
              Student Academic Profile
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {userData.courseName && (
              <Badge tone="primary" size="sm">
                {userData.courseName}
              </Badge>
            )}
            {userData.branch && (
              <Badge tone="neutral" size="sm">
                {userData.branch}
              </Badge>
            )}
            {userData.semester && (
              <Badge tone="success" size="sm">
                Semester {userData.semester}
              </Badge>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <InputField id="name" icon={User} label="Full Name" value={userData.name} />
          <InputField id="rollNo" icon={IdCard} label="Roll Number" value={userData.rollNo} />
          <InputField id="section" icon={BookOpen} label="Section" value={userData.section} />
          <InputField id="email" icon={GraduationCap} label="Email Address" value={userData.email} />
        </div>
      </Card>

      {/* Main Ticket Form */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <Card padding="lg">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Subject Selection & Auto-Fetched Teacher */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-2">
                <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  Subject & Assigned Teacher
                </h3>
                <span className="text-xs text-ink-faint">
                  Showing Semester {userData.semester || 1} Subjects
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                {/* Subject Selector (Scoped to student's semester, course, branch) */}
                <div>
                  <Select
                    id="subjectId"
                    label={<span>Select Your Subject <span className="text-red-500">*</span></span>}
                    value={formData.subjectId}
                    onChange={handleSubjectChange}
                    disabled={isSubmitting || fetchingSubjects || subjects.length === 0}
                    required
                  >
                    {subjects.length === 0 ? (
                      <option value="">No subjects found for Semester {userData.semester || 1}</option>
                    ) : (
                      subjects.map(sub => (
                        <option key={sub.id || sub._id} value={sub.id || sub._id}>
                          {sub.subjectCode ? `[${sub.subjectCode}] ` : ""}{sub.subjectName}
                        </option>
                      ))
                    )}
                  </Select>
                  <p className="text-xs text-ink-faint mt-1">
                    Showing only subjects in your semester for {userData.branch || "your branch"}.
                  </p>
                </div>

                {/* Automatically Fetched Teacher Display */}
                <div>
                  <label className="block text-sm font-semibold text-ink mb-1.5">
                    Assigned Teacher <span className="text-red-500">*</span>
                  </label>
                  {currentAssignedTeacher ? (
                    <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs flex-shrink-0">
                          {currentAssignedTeacher.name?.charAt(0) || "T"}
                        </div>
                        <div className="truncate">
                          <p className="text-sm font-bold text-emerald-950 dark:text-emerald-100 truncate">
                            {currentAssignedTeacher.name}
                          </p>
                          <p className="text-xs text-emerald-700 dark:text-emerald-300 truncate">
                            {currentAssignedTeacher.email || "Subject Teacher"}
                          </p>
                        </div>
                      </div>
                      <Badge tone="success" size="sm" className="flex-shrink-0">
                        <ShieldCheck className="h-3 w-3 inline mr-1" />
                        Auto-Fetched
                      </Badge>
                    </div>
                  ) : (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center gap-2 text-xs text-amber-800 dark:text-amber-200">
                      <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                      <span>No teacher is currently assigned to this subject for Section {userData.section}.</span>
                    </div>
                  )}
                  <p className="text-xs text-ink-faint mt-1">
                    Teacher is automatically determined based on your section timetable.
                  </p>
                </div>
              </div>
            </div>

            {/* Date & Reason Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-2">
                <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  Absence & Grievance Details
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Absence Date */}
                <div>
                  <label htmlFor="absentDate" className="block text-sm font-semibold text-ink mb-1.5">
                    Date of Absence <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="absentDate"
                    name="absentDate"
                    type="date"
                    max={todayStr}
                    value={formData.absentDate}
                    onChange={handleFieldChange}
                    className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    required
                  />
                  <p className="text-xs text-ink-faint mt-1">
                    Cannot be a future date.
                  </p>
                </div>

                {/* Reason Category */}
                <div>
                  <Select
                    id="reason"
                    label={<span>Reason Category <span className="text-red-500">*</span></span>}
                    value={formData.reason}
                    onChange={handleFieldChange}
                    required
                  >
                    {REASON_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                  <p className="text-xs text-ink-faint mt-1">
                    Select the category that best describes your absence.
                  </p>
                </div>
              </div>

              {/* Reason Description */}
              <div>
                <Textarea
                  id="reasonDescription"
                  name="reasonDescription"
                  label={<span>Reason Description & Remarks <span className="text-red-500">*</span></span>}
                  placeholder="Explain why you were absent and details about the attached supporting document (min 10 characters)..."
                  value={formData.reasonDescription}
                  onChange={handleFieldChange}
                  rows={4}
                  required
                />
                <div className="flex justify-between items-center text-xs text-ink-faint mt-1">
                  <span>Minimum 10 characters required</span>
                  <span className={formData.reasonDescription.length < 10 ? "text-amber-500 font-medium" : "text-emerald-600 font-medium"}>
                    {formData.reasonDescription.length} / 500 characters
                  </span>
                </div>
              </div>
            </div>

            {/* Document Upload Section */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-ink">
                Supporting Proof Document <span className="text-red-500">*</span>
              </label>
              <FileUploadArea
                file={file}
                setFile={setFile}
                error={fileError}
                setError={setFileError}
              />
            </div>

            {/* Form Error or Success Feedback Banner */}
            <AnimatePresence>
              {errorMessage && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2.5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm"
                >
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </motion.div>
              )}

              {responseStatus === "success" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2.5 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium"
                >
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                  <span>Ticket successfully routed to {currentAssignedTeacher?.name || "your teacher"}! Redirecting to Dashboard...</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-line">
              <div className="text-xs text-ink-faint flex items-center gap-1.5">
                <Info className="h-4 w-4 text-primary" />
                <span>Your teacher will review this document and update your attendance upon approval.</span>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/dashboard")}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  variant="primary"
                  leftIcon={Send}
                  disabled={disableSubmit || isSubmitting || !currentAssignedTeacher}
                  loading={isSubmitting}
                >
                  {isSubmitting ? "Submitting..." : "Submit Ticket"}
                </Button>
              </div>
            </div>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}
