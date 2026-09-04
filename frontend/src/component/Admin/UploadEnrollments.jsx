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
  Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Card from "../common/ui/Card";
import Button from "../common/ui/Button";
import DashboardHeader from "../common/ui/DashboardHeader";
import PricingModal from "../common/PricingModal";
import { useUpgradeModal } from "../../utils/billing";
import api from "../../utils/api";
import { logError } from "../../utils/logger";
import { useTheme } from '../../contexts/ThemeContexts';

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

  const themeColors = {
    primary: colors?.primary || '#7c3aed',
    secondary: colors?.secondary || '#06b6d4',
  };

  const requiredColumns = [
    "enrollmentNumber",
    "email",
    "firstName",
    "lastName",
    "section"
  ];

  const optionalColumns = [
    "parentName",
    "parentPhone",
    "parentEmail",
    "course",
    "branch",
    "semester",
    "admissionYear"
  ];

  React.useEffect(() => {
    fetchTenantInfo();
  }, []);

  const fetchTenantInfo = async () => {
    try {
      const response = await api.get('/auth/tenant-info');
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
    
    const isValidType = selectedFile.type === "text/csv" || 
                       selectedFile.name.toLowerCase().endsWith(".csv");
    const isValidSize = selectedFile.size <= 5 * 1024 * 1024; // 5MB

    if (!isValidType) {
      setUploadStatus({ type: "error", message: "Please upload a valid CSV file" });
      return false;
    }

    if (!isValidSize) {
      setUploadStatus({ type: "error", message: "File size must be less than 5MB" });
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
      setUploadStatus({ type: "error", message: "Please select a file first" });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setLoading(true);
      setUploadProgress(0);
      setUploadStatus(null);

      const response = await api.post('/admin/upload-enrollments', formData, {
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        },
      });

      if (response.data.success) {
        setUploadStatus({ type: "success", message: response.data.message || "Upload completed successfully!" });
        setUploadSummary({
          total: response.data.totalProcessed || 0,
          success: response.data.successCount || 0,
          failed: response.data.errorCount || 0,
          errors: response.data.errors || []
        });
        
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        setUploadStatus({ type: "error", message: response.data.message || "Upload failed" });
      }
    } catch (error) {
      logError("Upload Enrollments", error);
      if (!openUpgradeForError(error)) {
        setUploadStatus({ 
          type: "error", 
          message: error.response?.data?.message || "Unexpected error occurred" 
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
    a.download = "sample_enrollments.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl space-y-6">
      <DashboardHeader
        greeting="Bulk Student Enrollment Intake"
        meta={`Upload and batch register student rosters for ${tenantInfo?.name || "your institution"}`}
        actions={
          <Button
            variant="subtle"
            size="sm"
            leftIcon={Download}
            onClick={downloadSample}
          >
            Download CSV Sample
          </Button>
        }
      />

      {/* Main Upload Card */}
      <Card padding="lg" bordered>
        {/* Requirements Box */}
        <div className="mb-6 p-4 rounded-2xl bg-primary/5 border border-primary/20">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
              <Info className="w-4 h-4" />
            </div>
            <div className="space-y-3">
              <h3 className="font-bold text-xs text-ink uppercase tracking-wider">CSV Data Specifications</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold text-ink-soft mb-1.5">Required Headers:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {requiredColumns.map(col => (
                      <span 
                        key={col} 
                        className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-primary/10 text-primary border border-primary/20"
                      >
                        {col}
                      </span>
                    ))}
                  </div>

                  <p className="text-xs font-bold text-ink-soft mb-1.5 mt-3">Optional Academic Headers:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {optionalColumns.map(col => (
                      <span 
                        key={col} 
                        className="px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-background text-ink-soft border border-line/50"
                      >
                        {col}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="text-xs space-y-1.5 text-ink-soft">
                  <p className="font-bold text-ink mb-1">Upload Rules:</p>
                  <p>• File must be formatted as UTF-8 CSV</p>
                  <p>• Maximum upload limit is 5MB</p>
                  <p>• Enrollment numbers must be unique per institution</p>
                  <p>• Section codes will be automatically matched or mapped</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Upload Drop Zone */}
        <form onSubmit={handleUpload}>
          <div
            className={`
              relative border-2 border-dashed rounded-2xl p-8 mb-5 text-center
              ${dragActive ? 'border-primary bg-primary/10' : 'border-line/60 hover:border-primary/40 bg-background/50'}
              ${file ? 'bg-emerald-500/5 border-emerald-500/30' : ''}
              transition cursor-pointer overflow-hidden
            `}
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              hidden
              onChange={(e) => handleFileChange(e.target.files[0])}
            />

            {!file ? (
              <div className="space-y-3 py-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-primary/10 text-primary mx-auto">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-ink">
                    Drag & drop your student CSV file here
                  </p>
                  <p className="text-xs text-ink-soft mt-1">
                    or click to browse files from your computer
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3.5 bg-surface rounded-xl border border-emerald-500/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-600">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-xs text-ink">{file.name}</p>
                    <p className="text-[11px] text-ink-soft">
                      {(file.size / 1024).toFixed(1)} KB • CSV Document
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="p-1.5 hover:bg-rose-500/10 rounded-lg text-ink-soft hover:text-rose-600 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          {uploadProgress > 0 && (
            <div className="mb-5">
              <div className="flex justify-between text-xs mb-1 font-semibold">
                <span className="text-ink-soft">Processing upload...</span>
                <span className="text-primary">{Math.round(uploadProgress)}%</span>
              </div>
              <div className="w-full bg-line/50 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Upload Status Alert */}
          {uploadStatus && (
            <div className={`mb-5 p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
              uploadStatus.type === 'success' 
                ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' 
                : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
            }`}>
              {uploadStatus.type === 'success' ? (
                <CheckCircle className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{uploadStatus.message}</span>
            </div>
          )}

          {/* Upload Summary Box */}
          {uploadSummary && (
            <div className="mb-5 p-4 bg-background rounded-2xl border border-line/50 space-y-3">
              <h4 className="font-bold text-xs text-ink uppercase tracking-wider">Upload Results Summary</h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-surface rounded-xl border border-line/50 text-center">
                  <p className="text-xl font-bold text-ink">{uploadSummary.total}</p>
                  <p className="text-[11px] text-ink-soft font-semibold">Total Records</p>
                </div>
                <div className="p-3 bg-surface rounded-xl border border-emerald-500/20 text-center">
                  <p className="text-xl font-bold text-emerald-600">{uploadSummary.success}</p>
                  <p className="text-[11px] text-ink-soft font-semibold">Successful</p>
                </div>
                <div className="p-3 bg-surface rounded-xl border border-rose-500/20 text-center">
                  <p className="text-xl font-bold text-rose-600">{uploadSummary.failed}</p>
                  <p className="text-[11px] text-ink-soft font-semibold">Failed</p>
                </div>
              </div>

              {uploadSummary.errors && uploadSummary.errors.length > 0 && (
                <div className="pt-2 border-t border-line/50">
                  <p className="text-xs font-bold text-rose-600 mb-1">Errors encountered:</p>
                  <div className="max-h-28 overflow-y-auto space-y-1">
                    {uploadSummary.errors.slice(0, 10).map((err, idx) => (
                      <p key={idx} className="text-[11px] text-rose-500">• {err}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Submit Action */}
          <div className="flex justify-end gap-2.5">
            <Button
              type="submit"
              disabled={!file || loading}
              loading={loading}
              variant="primary"
              size="sm"
              leftIcon={Upload}
            >
              Upload & Process Enrollments
            </Button>
          </div>
        </form>
      </Card>

      <PricingModal {...modalProps} />
    </div>
  );
};

export default UploadEnrollments;
