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
  ChevronRight
} from "lucide-react";
import Card from "./common/Card";

const UploadEnrollments = () => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState(null); // 'success', 'error', null
  const [uploadSummary, setUploadSummary] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef();

  const API_URL = process.env.REACT_APP_API_URL;
  const token = localStorage.getItem("token");

  const requiredColumns = [
    "enrollmentNumber",
    "email",
    "firstName",
    "lastName",
    "section"
  ];

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

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          setUploadProgress((e.loaded / e.total) * 100);
        }
      });

      xhr.onload = () => {
        setLoading(false);
        setUploadProgress(0);

        if (xhr.status === 200 || xhr.status === 201) {
          const res = JSON.parse(xhr.responseText);
          
          setUploadStatus({ type: "success", message: "Upload completed successfully!" });
          setUploadSummary({
            total: res.data?.total || 0,
            success: res.data?.success || 0,
            failed: res.data?.failed || 0,
            errors: res.data?.errors || []
          });
          
          setFile(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
        } else {
          const res = JSON.parse(xhr.responseText);
          setUploadStatus({ type: "error", message: res.message || "Upload failed" });
        }
      };

      xhr.onerror = () => {
        setLoading(false);
        setUploadStatus({ type: "error", message: "Network error. Please try again." });
      };

      xhr.open("POST", `${API_URL}/admin/upload-enrollments`);
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.send(formData);
    } catch (error) {
      setLoading(false);
      setUploadStatus({ type: "error", message: "Unexpected error occurred" });
    }
  };

  const downloadSample = () => {
    const headers = requiredColumns.join(",");
    const sampleRow = "EN001245,student@example.com,John,Doe,A";
    const content = `${headers}\n${sampleRow}`;
    
    const blob = new Blob([content], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sample_enrollments.csv";
    a.click();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Upload Enrollments</h1>
          <p className="text-gray-500 mt-1">Bulk import student enrollment data via CSV</p>
        </div>

        {/* Main Card */}
        <Card>
          {/* Requirements Section */}
          <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-blue-900 mb-2">CSV Requirements</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-blue-800 mb-1">Required Columns:</p>
                    <div className="flex flex-wrap gap-2">
                      {requiredColumns.map(col => (
                        <span key={col} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                          {col}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-800 mb-1">Specifications:</p>
                    <ul className="text-xs text-blue-700 space-y-1">
                      <li>• CSV format with headers</li>
                      <li>• Max file size: 5MB</li>
                      <li>• Valid email addresses</li>
                      <li>• Unique enrollment numbers</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Upload Area */}
          <form onSubmit={handleUpload}>
            <div
              className={`
                relative border-2 border-dashed rounded-xl p-8 mb-6 text-center
                ${dragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400'}
                ${file ? 'bg-green-50 border-green-400' : ''}
                transition-colors cursor-pointer
              `}
              onClick={() => fileInputRef.current.click()}
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
                <div className="space-y-3">
                  <div className="flex justify-center">
                    <Upload className="w-12 h-12 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-lg font-medium text-gray-700">
                      Drag & drop your CSV file here
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      or click to browse
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="w-8 h-8 text-green-600" />
                    <div className="text-left">
                      <p className="font-medium text-gray-900">{file.name}</p>
                      <p className="text-sm text-gray-500">
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
                    className="p-1 hover:bg-gray-200 rounded-full"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              )}
            </div>

            {/* Progress Bar */}
            {uploadProgress > 0 && (
              <div className="mb-6">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Uploading...</span>
                  <span className="font-medium text-indigo-600">{Math.round(uploadProgress)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Upload Status */}
            {uploadStatus && (
              <div className={`mb-6 p-4 rounded-xl ${
                uploadStatus.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
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
              <div className="mb-6 p-4 bg-gray-50 rounded-xl">
                <h4 className="font-medium text-gray-900 mb-3">Upload Summary</h4>
                <div className="grid grid-cols-3 gap-4 mb-3">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">{uploadSummary.total}</p>
                    <p className="text-xs text-gray-500">Total</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{uploadSummary.success}</p>
                    <p className="text-xs text-gray-500">Success</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-600">{uploadSummary.failed}</p>
                    <p className="text-xs text-gray-500">Failed</p>
                  </div>
                </div>
                {uploadSummary.errors && uploadSummary.errors.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-sm font-medium text-gray-700 mb-2">Errors:</p>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {uploadSummary.errors.map((err, idx) => (
                        <p key={idx} className="text-xs text-red-600">• {err}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={downloadSample}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download Sample
              </button>
              <button
                type="submit"
                disabled={!file || loading}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Upload Enrollments
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Instructions */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="font-medium text-gray-900 mb-3">Instructions</h4>
            <div className="space-y-2 text-sm text-gray-600">
              <p className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                Download the sample CSV template to see the required format
              </p>
              <p className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                Ensure all enrollment numbers are unique
              </p>
              <p className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                Student accounts will be created automatically upon registration
              </p>
              <p className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                Uploaded data will appear in the enrollments section immediately
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default UploadEnrollments;