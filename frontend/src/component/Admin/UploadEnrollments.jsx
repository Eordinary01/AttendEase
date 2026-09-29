// src/component/Admin/UploadEnrollments.jsx
// Redesigned with Academic Precision System (redesign/DESIGN.md & redesign/code.html)
// Bulk Student Enrollment Intake, CSV Schema Validation, and Roster Ingestion
import React, { useState, useRef } from "react";
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertCircle,
  Download,
  X,
  Info,
  ChevronRight,
  Building2,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import PricingModal from "../common/PricingModal";
import { useUpgradeModal } from "../../utils/billing";
import api from "../../utils/api";
import { logError } from "../../utils/logger";
import { useTheme } from "../../contexts/ThemeContexts";

const UploadEnrollments = () => {
  const { colors } = useTheme();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [uploadSummary, setUploadSummary] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [tenantInfo, setTenantInfo] = useState(null);

  const { modalProps, openUpgradeForError, setPlanCode } = useUpgradeModal();
  const fileInputRef = useRef();

  const requiredColumns = [
    "enrollmentNumber",
    "email",
    "firstName",
    "lastName",
    "section",
  ];

  const optionalColumns = [
    "parentName",
    "parentPhone",
    "parentEmail",
    "course",
    "branch",
    "semester",
    "admissionYear",
  ];

  React.useEffect(() => {
    fetchTenantInfo();
  }, []);

  const fetchTenantInfo = async () => {
    try {
      const response = await api.get("/auth/tenant-info");
      if (response.data.success) {
        const tenant = response.data.data?.tenant;
        setTenantInfo(tenant);
        setPlanCode(tenant?.subscription?.plan || null);
      }
    } catch (error) {
      logError("Fetch Tenant Info", error);
    }
  };

  const validateFile = (selectedFile) => {
    if (!selectedFile) return false;
    
    const isValidType =
      selectedFile.type === "text/csv" || 
      selectedFile.name.toLowerCase().endsWith(".csv");
    const isValidSize = selectedFile.size <= 5 * 1024 * 1024; // 5MB

    if (!isValidType) {
      setUploadStatus({ type: "error", message: "Please upload a valid .CSV file format." });
      return false;
    }

    if (!isValidSize) {
      setUploadStatus({ type: "error", message: "File size exceeds the statutory limit of 5MB." });
      return false;
    }

    return true;
  };

  const handleFileChange = (selectedFile) => {
    if (!validateFile(selectedFile)) {
      setFile(null);
      return;
    }

    setFile(selectedFile);
    setUploadStatus(null);
    setUploadSummary(null);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const droppedFile = e.dataTransfer.files[0];
    handleFileChange(droppedFile);
  };

  const handleUpload = async (e) => {
    e.preventDefault();

    if (!file) {
      setUploadStatus({ type: "error", message: "Please select or drop a valid CSV file." });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setLoading(true);
      setUploadProgress(0);
      setUploadStatus(null);

      const response = await api.post("/admin/upload-enrollments", formData, {
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        },
      });

      if (response.data.success) {
        setUploadStatus({ type: "success", message: response.data.message || "Roster batch ingested successfully!" });
        setUploadSummary({
          total: response.data.totalProcessed || 0,
          success: response.data.successCount || 0,
          failed: response.data.errorCount || 0,
          errors: response.data.errors || [],
        });
        
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        setUploadStatus({ type: "error", message: response.data.message || "Upload ingestion failed." });
      }
    } catch (error) {
      logError("Upload Enrollments", error);
      if (!openUpgradeForError(error)) {
        setUploadStatus({ 
          type: "error", 
          message: error.response?.data?.message || "Unexpected server error during CSV intake.",
        });
      }
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const downloadSample = () => {
    const headers = [...requiredColumns, ...optionalColumns].join(",");
    const sampleRow = "EN001245,student@example.com,John,Doe,A,Mary Doe,+919876543210,mary.doe@example.com,Bachelor of Technology,CSE,1,2026";
    const content = `\uFEFF${headers}\n${sampleRow}`;
    
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sample_student_enrollments.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl space-y-6 font-sans antialiased text-slate-800">
      {/* 1. Header Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Bulk Student Enrollment Intake
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Batch intake and roster provisioning for {tenantInfo?.name || "your institution"}
          </p>
        </div>

        <button
          onClick={downloadSample}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-xs transition-all self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5 text-primary" />
          <span>Download Sample CSV</span>
        </button>
      </div>

      {/* 2. Schema Specification Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-soft border border-primary/20 flex items-center justify-center text-primary">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">CSV Header Specification</h3>
              <p className="text-xs text-slate-500">Ensure column headers match exactly to enable automated schema parsing</p>
            </div>
          </div>
          <span className="text-[11px] font-mono font-bold text-primary-dark bg-primary-soft px-2.5 py-0.5 rounded border border-primary/20">
            UTF-8 Encoded
          </span>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5 font-mono">
              Mandatory Fields:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {requiredColumns.map((col) => (
                <span
                  key={col}
                  className="font-mono text-xs font-semibold px-2.5 py-1 rounded-lg bg-primary-soft text-primary-dark border border-primary/20"
                >
                  {col} *
                </span>
              ))}
            </div>
          </div>

          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5 font-mono">
              Optional Metadata Fields:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {optionalColumns.map((col) => (
                <span
                  key={col}
                  className="font-mono text-xs font-medium px-2 py-1 rounded-lg bg-slate-100 text-slate-600 border border-slate-200"
                >
                  {col}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Drag & Drop Upload Zone */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-4">
        <form onSubmit={handleUpload} className="space-y-4">
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
              dragActive
                ? "border-primary bg-primary-soft/40 scale-[1.01]"
                : file
                ? "border-emerald-500 bg-emerald-50/20"
                : "border-slate-300 hover:border-primary/40 hover:bg-slate-50/60"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => handleFileChange(e.target.files[0])}
              className="hidden"
            />

            <div className="flex flex-col items-center justify-center space-y-2">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
                  file ? "bg-emerald-100 text-emerald-700" : "bg-primary-soft text-primary"
                }`}
              >
                <Upload className="w-6 h-6" />
              </div>

              {file ? (
                <div>
                  <p className="text-sm font-bold text-slate-900">{file.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {(file.size / 1024).toFixed(1)} KB • Ready for intake processing
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    Click to select CSV roster, or drag and drop file here
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Standard comma-separated format up to 5MB
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Upload Progress Bar */}
          {loading && uploadProgress > 0 && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-600 font-semibold">Streaming Records...</span>
                <span className="font-bold text-primary">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            {file && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
              >
                Clear Selection
              </button>
            )}

            <button
              type="submit"
              disabled={!file || loading}
              className="px-5 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-semibold shadow-xs transition disabled:opacity-50 inline-flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing Intake Batch...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Start Roster Ingestion</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* 4. Status Notification */}
      {uploadStatus && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-start gap-3 ${
            uploadStatus.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {uploadStatus.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <h4 className="font-bold text-sm">
              {uploadStatus.type === "success" ? "Ingestion Completed" : "Intake Error"}
            </h4>
            <p className="mt-0.5 leading-relaxed">{uploadStatus.message}</p>
          </div>
        </div>
      )}

      {/* 5. Summary KPI Breakdown */}
      {uploadSummary && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-4">
          <h3 className="text-base font-bold text-slate-900">Intake Audit Summary</h3>

          <div className="grid grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block font-mono">
                Total Rows
              </span>
              <span className="text-2xl font-black text-slate-900 font-sans mt-1 block">
                {uploadSummary.total}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block font-mono">
                Ingested
              </span>
              <span className="text-2xl font-black text-emerald-700 font-sans mt-1 block">
                {uploadSummary.success}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200">
              <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider block font-mono">
                Errors / Skipped
              </span>
              <span className="text-2xl font-black text-rose-700 font-sans mt-1 block">
                {uploadSummary.failed}
              </span>
            </div>
          </div>

          {/* Errors list if any */}
          {uploadSummary.errors?.length > 0 && (
            <div className="space-y-2 pt-2">
              <span className="text-xs font-bold text-slate-700 block">Row-Level Ingestion Warnings:</span>
              <div className="max-h-48 overflow-y-auto space-y-1.5 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono">
                {uploadSummary.errors.map((err, idx) => (
                  <div key={idx} className="text-rose-600 flex items-start gap-1.5">
                    <span>•</span>
                    <span>{typeof err === "string" ? err : JSON.stringify(err)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pricing Upgrade Modal */}
      <PricingModal {...modalProps} />
    </div>
  );
};

export default UploadEnrollments;
