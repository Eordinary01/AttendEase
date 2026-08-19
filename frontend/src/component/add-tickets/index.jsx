// src/components/Ticket.jsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Clock,
  CheckCircle,
  AlertCircle,
  User,
  BookOpen,
  IdCard,
  Upload,
  FileText,
  X,
  Info,
  Loader2
} from "lucide-react";
import api from "../../utils/api";
import { logError } from "../../utils/logger";
import Button from "../common/ui/Button";
import Card from "../common/ui/Card";
import Badge from "../common/ui/Badge";
import PageHeader from "../common/ui/PageHeader";
import { Textarea } from "../common/ui/Input";

const API_URL = process.env.REACT_APP_API_URL;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const InputField = ({ id, icon: Icon, label, value, onChange, disabled, required = false }) => (
  <div className="flex-1">
    <label htmlFor={id} className="block text-sm font-medium text-ink-soft mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <div className="relative">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Icon className="h-5 w-5 text-ink-faint" />
      </div>
      <input
        id={id}
        type="text"
        className={`
          w-full pl-10 pr-4 py-2.5 bg-surface border border-line rounded-lg
          text-ink transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary
          disabled:opacity-50 disabled:bg-background
        `}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
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
      setError("Invalid file type. Please upload PDF, DOC, DOCX, or images (JPG, PNG)");
      return false;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setError("File size exceeds 5MB limit");
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
        relative h-full min-h-[200px] rounded-lg border-2 border-dashed bg-surface
        transition-all duration-200 cursor-pointer
        ${dragActive ? 'border-primary bg-primary/10' : 'border-line hover:border-primary'}
        ${error ? 'border-red-500' : ''}
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
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        {file ? (
          <div className="flex flex-col items-center gap-2">
            <FileText className="h-10 w-10 text-primary" />
            <p className="text-sm text-ink-soft break-all max-w-[200px]">{file.name}</p>
            <p className="text-xs text-ink-faint">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setFile(null);
                if (inputRef.current) inputRef.current.value = '';
                setError(null);
              }}
              className="flex items-center gap-1 text-red-600 hover:text-red-700 transition-colors"
            >
              <X className="h-4 w-4" />
              Remove
            </button>
          </div>
        ) : (
          <>
            <Upload className="h-10 w-10 text-primary mb-2" />
            <p className="text-sm text-ink-soft mb-2">Drag and drop your file here, or</p>
            <p className="text-xs text-ink-faint">Click to browse</p>
            <p className="text-xs text-ink-faint mt-2">
              Supported: PDF, DOC, DOCX, JPG, PNG (Max 5MB)
            </p>
          </>
        )}
      </div>
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
  const [formData, setFormData] = useState({
    document: "",
  });
  const [file, setFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [disableSubmit, setDisableSubmit] = useState(false);
  const [responseStatus, setResponseStatus] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastSubmitTime, setLastSubmitTime] = useState(
    localStorage.getItem("lastTicketSubmitTime") || null
  );

  const token = localStorage.getItem("token");

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userId = localStorage.getItem("userId");
        if (!userId) {
          throw new Error("User ID not found");
        }

        const response = await api.get(`/users/public/users/${userId}`);

        const user = response.data;
        setUserData({
          name: user.name || "",
          email: user.email || "",
          section: user.section || "",
          rollNo: user.rollNo || "",
          userId: user._id || userId
        });

        localStorage.setItem("name", user.name || "");
        localStorage.setItem("section", user.section || "");
        localStorage.setItem("rollNo", user.rollNo || "");

      } catch (error) {
        logError("Fetch User Data", error);
        setUserData({
          name: localStorage.getItem("name") || "",
          email: localStorage.getItem("userEmail") || "",
          section: localStorage.getItem("section") || "",
          rollNo: localStorage.getItem("rollNo") || "",
          userId: localStorage.getItem("userId") || ""
        });
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [token]);

  useEffect(() => {
    if (lastSubmitTime) {
      const elapsed = Date.now() - parseInt(lastSubmitTime);
      const cooldownPeriod = 100000;
      if (elapsed < cooldownPeriod) {
        setDisableSubmit(true);
        const timeout = setTimeout(() => {
          setDisableSubmit(false);
        }, cooldownPeriod - elapsed);
        return () => clearTimeout(timeout);
      }
    }
  }, [lastSubmitTime]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.document.trim()) {
      setErrorMessage("Please provide document details");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setResponseStatus(null);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append("document", formData.document);

      if (file) {
        formDataToSend.append("files", file);
      }

      const response = await fetch(`${API_URL}/tickets`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formDataToSend,
      });

      const data = await response.json();

      if (response.ok) {
        setDisableSubmit(true);
        const currentTime = Date.now();
        setLastSubmitTime(currentTime);
        localStorage.setItem("lastTicketSubmitTime", currentTime);
        setResponseStatus("success");

        setFormData({ document: "" });
        setFile(null);
        setFileError(null);

        setTimeout(() => {
          navigate("/dashboard");
        }, 2000);
      } else {
        setResponseStatus("error");
        setErrorMessage(data.message || "An error occurred while creating the ticket.");
      }
    } catch (error) {
      logError("Create Ticket", error);
      setResponseStatus("error");
      setErrorMessage(error.message || "An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 text-primary animate-spin" />
          <p className="text-ink-soft">Loading your information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Send}
        title="Create Support Ticket"
        subtitle="Submit a request for absence proof or document verification"
        actions={lastSubmitTime && (
          <Badge tone="neutral">
            <Clock className="h-3.5 w-3.5" />
            Last: {new Date(parseInt(lastSubmitTime)).toLocaleTimeString()}
          </Badge>
        )}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card padding="lg">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-primary flex items-center gap-2">
                <User className="h-5 w-5" />
                Student Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <InputField
                  id="name"
                  icon={User}
                  label="Full Name"
                  value={userData.name}
                  onChange={() => { }}
                  disabled
                />
                <InputField
                  id="email"
                  icon={User}
                  label="Email"
                  value={userData.email}
                  onChange={() => { }}
                  disabled
                />
                <InputField
                  id="section"
                  icon={BookOpen}
                  label="Section"
                  value={userData.section}
                  onChange={() => { }}
                  disabled
                />
                <InputField
                  id="rollNo"
                  icon={IdCard}
                  label="Roll Number"
                  value={userData.rollNo}
                  onChange={() => { }}
                  disabled
                />
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-primary flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Ticket Details
              </h2>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <Textarea
                    id="document"
                    label={<span>Document Details <span className="text-red-500">*</span></span>}
                    className="h-[200px]"
                    value={formData.document}
                    onChange={handleChange}
                    disabled={disableSubmit}
                    placeholder="Describe your issue or reason for absence in detail..."
                    required
                  />
                  <p className="text-xs text-ink-faint mt-2">
                    <Info className="h-3 w-3 inline mr-1" />
                    Please provide all necessary details for verification
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink-soft mb-1">
                    Supporting Documents
                  </label>
                  <FileUploadArea
                    file={file}
                    setFile={setFile}
                    error={fileError}
                    setError={setFileError}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end items-center gap-4 pt-4 border-t border-line">


              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/dashboard")}
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  variant="primary"
                  leftIcon={Send}
                  disabled={disableSubmit || isSubmitting}
                  loading={isSubmitting}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Ticket'}
                </Button>
              </div>
            </div>

            <AnimatePresence>
              {responseStatus && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className={`flex items-center gap-2 p-3 rounded-lg ${responseStatus === "error"
                    ? "bg-red-50 text-red-700 border border-red-200"
                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    }`}
                >
                  {responseStatus === "error" ?
                    <AlertCircle className="h-4 w-4" /> :
                    <CheckCircle className="h-4 w-4" />
                  }
                  <span>
                    {responseStatus === "error"
                      ? "Failed to create ticket. Please try again."
                      : "Ticket created successfully! Redirecting..."
                    }
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="p-4 bg-background rounded-lg border border-line"
      >
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="text-sm text-ink-soft">
            <p className="mb-1"><strong className="text-ink">Note:</strong> Your ticket will be reviewed by your teacher.</p>
            <p>You can track the status of your tickets from your dashboard.</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
