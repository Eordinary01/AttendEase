// src/components/Admin/UploadEnrollments.jsx
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
import PageHeader from "../common/ui/PageHeader";
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
  const [uploadStatus, setUploadStatus] = useState(null); // 'success', 'error', null
  const [uploadSummary, setUploadSummary] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [tenantInfo, setTenantInfo] = useState(null);

  const { modalProps, openUpgradeForError, setPlanCode } = useUpgradeModal();

  const fileInputRef = useRef();



  // Theme colors
  const themeColors = {
    primary: colors?.primary || '#6366f1',
    secondary: colors?.secondary || '#8b5cf6',
    light: colors?.primary ? `${colors.primary}20` : '#eef2ff',
    lighter: colors?.primary ? `${colors.primary}10` : '#f5f3ff',
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

  // Fetch tenant info on component mount
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
    // Add BOM for UTF-8
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
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl space-y-6"
    >
      <PageHeader
        title="Upload Enrollments"
        subtitle="Bulk import student enrollment data via CSV"
        icon={Upload}
        actions={
          tenantInfo && (
            <div 
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-white shadow-sm"
              style={{ backgroundColor: themeColors.primary }}
            >
              <Building2 className="w-4 h-4" />
              <span className="font-medium">{tenantInfo.name}</span>
            </div>
          )
        }
      />

      {/* Main Card */}
      <Card>
        {/* Requirements Section */}
        <div 
          className="mb-6 p-4 rounded-xl border"
          style={{ 
            backgroundColor: `${themeColors.primary}10`,
            borderColor: `${themeColors.primary}20`
          }}
        >
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: themeColors.primary }} />
            <div>
              <h3 className="font-medium mb-2" style={{ color: themeColors.primary }}>CSV Requirements</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium mb-1" style={{ color: themeColors.primary }}>Required Columns:</p>
                  <div className="flex flex-wrap gap-2">
                    {requiredColumns.map(col => (
                      <span 
                        key={col} 
                        className="px-2 py-1 rounded text-xs font-medium"
                        style={{ 
                          backgroundColor: `${themeColors.primary}20`,
                          color: themeColors.primary
                        }}
                      >
                        {col}
                      </span>
                    ))}
                  </div>
                  <p className="text-sm font-medium mb-1 mt-3" style={{ color: themeColors.primary }}>Optional (for parent portal):</p>
                  <div className="flex flex-wrap gap-2">
                    {optionalColumns.slice(0, 3).map(col => (
                      <span 
                        key={col} 
                        className="px-2 py-1 rounded text-xs font-medium"
                        style={{ 
                          backgroundColor: `${themeColors.primary}15`,
                          color: themeColors.primary
                        }}
                      >
                        {col}
                      </span>
                    ))}
                  </div>
                  <p className="text-sm font-medium mb-1 mt-3" style={{ color: themeColors.primary }}>Optional (academic structure):</p>
                  <div className="flex flex-wrap gap-2">
                    {optionalColumns.slice(3).map(col => (
                      <span 
                        key={col} 
                        className="px-2 py-1 rounded text-xs font-medium"
                        style={{ 
                          backgroundColor: `${themeColors.primary}15`,
                          color: themeColors.primary
                        }}
                      >
                        {col}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs mt-2" style={{ color: themeColors.primary }}>
                    Parent details enable parents to log in to the parent portal with their own email. Course/branch/semester/admissionYear power the semester auto-increment feature.
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1" style={{ color: themeColors.primary }}>Specifications:</p>
                  <ul className="text-xs space-y-1" style={{ color: themeColors.primary }}>
                    <li>• CSV format with headers</li>
                    <li>• Max file size: 5MB</li>
                    <li>• Valid email addresses</li>
                    <li>• Unique enrollment numbers</li>
                    <li>• Section must exist in your institution</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Upload Area */}
        <form onSubmit={handleUpload}>
          <motion.div
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className={`
              relative border-2 border-dashed rounded-2xl p-10 mb-6 text-center
              ${dragActive ? 'border-primary bg-primary-soft' : 'border-line hover:border-primary/40'}
              ${file ? 'bg-green-50 border-green-400' : ''}
              transition-all cursor-pointer overflow-hidden
            `}
            onClick={() => fileInputRef.current.click()}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            style={{
              borderColor: dragActive ? themeColors.primary : undefined,
              backgroundColor: dragActive ? `${themeColors.primary}10` : undefined,
            }}
          >
            {dragActive && (
              <div className="absolute inset-0 bg-surface/50 backdrop-blur-sm z-10 flex items-center justify-center pointer-events-none">
                <div className="text-primary font-bold text-xl flex items-center gap-2">
                  <Upload className="w-8 h-8 animate-bounce" />
                  Drop to upload
                </div>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              hidden
              onChange={(e) => handleFileChange(e.target.files[0])}
            />

            <AnimatePresence mode="wait">
              {!file ? (
                <motion.div 
                  key="no-file"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  <div className="flex justify-center">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center bg-primary-soft">
                      <Upload className="w-8 h-8" style={{ color: themeColors.primary }} />
                    </div>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-ink">
                      Drag & drop your CSV file here
                    </p>
                    <p className="text-ink-soft mt-2 font-medium">
                      or <span style={{ color: themeColors.primary }} className="hover:underline">click to browse</span>
                    </p>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="file"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex items-center justify-between p-4 bg-surface rounded-xl shadow-sm border border-green-100"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <FileText className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-ink">{file.name}</p>
                      <p className="text-sm font-medium text-ink-soft">
                        {(file.size / 1024).toFixed(2)} KB
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
                    className="p-2 hover:bg-red-50 rounded-full transition-colors group"
                  >
                    <X className="w-5 h-5 text-ink-faint group-hover:text-red-500" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Progress Bar */}
          {uploadProgress > 0 && (
            <div className="mb-6">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-ink-soft">Uploading...</span>
                <span className="font-medium" style={{ color: themeColors.primary }}>{Math.round(uploadProgress)}%</span>
              </div>
              <div className="w-full bg-line rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${uploadProgress}%`,
                    backgroundColor: themeColors.primary
                  }}
                />
              </div>
            </div>
          )}

          {/* Upload Status */}
          {uploadStatus && (
            <div className={`mb-6 p-4 rounded-xl ${
              uploadStatus.type === 'success' 
                ? 'bg-green-50 border border-green-200' 
                : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-center gap-2">
                {uploadStatus.type === 'success' ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600" />
                )}
                <span className={uploadStatus.type === 'success' ? 'text-green-800' : 'text-red-800'}>
                  {uploadStatus.message}
                </span>
              </div>
            </div>
          )}

          {/* Upload Summary */}
          {uploadSummary && (
            <div className="mb-6 p-4 bg-background rounded-xl">
              <h4 className="font-medium text-ink mb-3">Upload Summary</h4>
              <div className="grid grid-cols-3 gap-4 mb-3">
                <div className="text-center">
                  <p className="text-2xl font-bold text-ink">{uploadSummary.total}</p>
                  <p className="text-xs text-ink-soft">Total</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{uploadSummary.success}</p>
                  <p className="text-xs text-ink-soft">Success</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600">{uploadSummary.failed}</p>
                  <p className="text-xs text-ink-soft">Failed</p>
                </div>
              </div>
              {uploadSummary.errors && uploadSummary.errors.length > 0 && (
                <div className="mt-3 pt-3 border-t border-line">
                  <p className="text-sm font-medium text-ink-soft mb-2">Errors:</p>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {uploadSummary.errors.slice(0, 10).map((err, idx) => (
                      <p key={idx} className="text-xs text-red-600">• {err}</p>
                    ))}
                    {uploadSummary.errors.length > 10 && (
                      <p className="text-xs text-ink-soft">... and {uploadSummary.errors.length - 10} more errors</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 mt-8">
            <Button
              type="button"
              variant="outline"
              leftIcon={Download}
              onClick={downloadSample}
              size="lg"
            >
              Sample CSV
            </Button>
            <Button
              type="submit"
              disabled={!file || loading}
              loading={loading}
              size="lg"
              leftIcon={Upload}
              className="flex-1"
              style={{ background: `linear-gradient(135deg, ${themeColors.primary}, ${themeColors.secondary})` }}
            >
              Upload Enrollments
            </Button>
          </div>
        </form>

        {/* Instructions */}
        <div className="mt-6 pt-6 border-t border-line">
          <h4 className="font-medium text-ink mb-3">Instructions</h4>
          <div className="space-y-2 text-sm text-ink-soft">
            <p className="flex items-start gap-2">
              <ChevronRight className="w-4 h-4 text-ink-faint flex-shrink-0 mt-0.5" />
              Download the sample CSV template to see the required format
            </p>
            <p className="flex items-start gap-2">
              <ChevronRight className="w-4 h-4 text-ink-faint flex-shrink-0 mt-0.5" />
              Ensure all enrollment numbers are unique within your institution
            </p>
            <p className="flex items-start gap-2">
              <ChevronRight className="w-4 h-4 text-ink-faint flex-shrink-0 mt-0.5" />
              Student accounts will be created automatically upon registration
            </p>
            <p className="flex items-start gap-2">
              <ChevronRight className="w-4 h-4 text-ink-faint flex-shrink-0 mt-0.5" />
              Uploaded data will appear in the enrollments section immediately
            </p>
            <p className="flex items-start gap-2">
              <ChevronRight className="w-4 h-4 text-ink-faint flex-shrink-0 mt-0.5" />
              Students will be associated with your institution (Tenant ID: {tenantInfo?.id?.slice(-8) || 'Auto-assigned'})
            </p>
          </div>
        </div>
      </Card>

      {/* Tenant Info Card */}
      {tenantInfo && (
        <div 
          className="p-4 rounded-lg border"
          style={{ 
            backgroundColor: `${themeColors.primary}10`,
            borderColor: `${themeColors.primary}20`
          }}
        >
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4" style={{ color: themeColors.primary }} />
            <span className="text-sm text-ink-soft">
              Uploading to: <strong>{tenantInfo.name}</strong>
            </span>
            <span className="text-xs text-ink-faint">
              (Subdomain: {tenantInfo.subdomain})
            </span>
          </div>
        </div>
      )}

      {/* Pricing / Upgrade Modal */}
      <PricingModal {...modalProps} />
    </motion.div>
  );
};

export default UploadEnrollments;
