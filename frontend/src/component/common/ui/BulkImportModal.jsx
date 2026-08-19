import React, { useEffect, useState, useRef } from "react";
import { 
  Upload, 
  FileSpreadsheet, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  FileDown, 
  Trash2,
  Lock,
  Crown,
  Info
} from "lucide-react";
import * as XLSX from "xlsx";
import api from "../../../utils/api";
import { logError } from "../../../utils/logger";
import Modal from "./Modal";
import Button from "./Button";
import { useUpgradeModal } from "../../../utils/billing";
import PricingModal from "../PricingModal";

/**
 * Plan-gated Bulk Import & Export Modal.
 * Accepts Excel (.xlsx, .xls) and CSV file uploads only,
 * with a downloadable dummy sample template and a format guide
 * so users know the exact columns to fill.
 */
const BulkImportModal = ({
  isOpen,
  onClose,
  endpoint,
  bodyKey,
  example,
  itemLabel = "records",
  exportData = null,
  onImported,
  columns = [],
  preValidate = null,
  defaults = {},
}) => {
  const [file, setFile] = useState(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [planModules, setPlanModules] = useState(null);

  const fileInputRef = useRef(null);
  const { modalProps, openUpgrade, openUpgradeForError, setPlanCode } = useUpgradeModal();

  const activeDefaults = Object.fromEntries(
    Object.entries(defaults || {}).filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== "")
  );

  useEffect(() => {
    if (isOpen) {
      setFile(null);
      setParsedRows([]);
      setResult(null);
      setSubmitting(false);
      api
        .get("/tenant/usage")
        .then((res) => {
          if (res.data.success) {
            setPlanModules(res.data.data?.plan?.modules || {});
            setPlanCode(res.data.data?.tenant?.subscription?.plan);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  // Parse sample data from example / columns prop
  const getSampleData = () => {
    let base = [];
    if (Array.isArray(example)) base = example;
    else if (typeof example === "string") {
      try {
        const parsed = JSON.parse(example);
        if (Array.isArray(parsed)) base = parsed;
      } catch (e) {
        // Fallback
      }
    }

    // If a structured column guide is provided, build a richer dummy sample
    // that includes every column (so the template shows the full format).
    if (Array.isArray(columns) && columns.length > 0) {
      const keyedRows = base.map((r) => {
        const row = {};
        columns.forEach((c) => {
          row[c.key] = r[c.key] !== undefined ? r[c.key] : (activeDefaults[c.key] ?? (c.example !== undefined ? c.example : ""));
        });
        return row;
      });

      // Keep up to 3 realistic example rows so the dummy clearly shows the
      // format; pad with extra generated rows up to a total of 5.
      let sample = keyedRows.slice(0, 3);
      const rowsToAdd = Math.max(0, 5 - sample.length);
      for (let i = 0; i < rowsToAdd; i++) {
        const row = {};
        columns.forEach((c) => {
          let ex = c.example;
          if (Array.isArray(ex)) ex = ex[i % ex.length];
          row[c.key] = activeDefaults[c.key] ?? (
            typeof ex === "string" && ex.includes("{{i}}")
              ? ex.replace("{{i}}", String(i + 2))
              : (ex !== undefined ? ex : "")
          );
        });
        sample.push(row);
      }
      return sample;
    }

    return base;
  };

  // Download Dummy Sample File (CSV / XLSX)
  const handleDownloadSample = (format = "csv") => {
    const sampleRows = getSampleData();
    const worksheet = XLSX.utils.json_to_sheet(sampleRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "SampleTemplate");

    const cleanLabel = itemLabel.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
    const fileName = `dummy_sample_${cleanLabel}.${format}`;

    if (format === "csv") {
      XLSX.writeFile(workbook, fileName, { bookType: "csv" });
    } else {
      XLSX.writeFile(workbook, fileName, { bookType: "xlsx" });
    }
  };

  // Export Data to CSV / Excel
  const handleExportData = (format = "csv") => {
    const dataToExport = (exportData && exportData.length > 0) 
      ? exportData 
      : (parsedRows.length > 0 ? parsedRows : getSampleData());

    if (!dataToExport || dataToExport.length === 0) {
      setResult({ success: false, message: "No data available to export." });
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Export");

    const cleanLabel = itemLabel.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
    const fileName = `export_${cleanLabel}.${format}`;

    if (format === "csv") {
      XLSX.writeFile(workbook, fileName, { bookType: "csv" });
    } else {
      XLSX.writeFile(workbook, fileName, { bookType: "xlsx" });
    }
  };

  // Handle file selection and parsing
  const processFile = (selectedFile) => {
    if (!selectedFile) return;

    const validExts = [".csv", ".xlsx", ".xls"];
    const ext = selectedFile.name.substring(selectedFile.name.lastIndexOf(".")).toLowerCase();
    if (!validExts.includes(ext)) {
      setResult({ success: false, message: "Invalid file type. Please upload a .csv, .xlsx, or .xls file." });
      return;
    }

    setFile(selectedFile);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array", cellDates: true, dateNF: "yyyy-mm-dd" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: false, dateNF: "yyyy-mm-dd" });

        if (!Array.isArray(rows) || rows.length === 0) {
          setResult({ success: false, message: "The uploaded file contains no data rows." });
          setParsedRows([]);
          return;
        }

        // Helper: detect Excel serial date numbers and convert to YYYY-MM-DD
        const excelSerialToISO = (val) => {
          const num = Number(val);
          if (Number.isNaN(num) || num < 1000 || num > 2958465) return null;
          const ms = Math.round((num - 25569) * 86400000);
          const d = new Date(ms);
          if (isNaN(d.getTime())) return null;
          const y = d.getUTCFullYear();
          const m = String(d.getUTCMonth() + 1).padStart(2, "0");
          const dy = String(d.getUTCDate()).padStart(2, "0");
          return `${y}-${m}-${dy}`;
        };

        // Clean & cast booleans / nulls, fix Excel serial dates
        const cleaned = rows
          .map((r) => {
            const item = {};
            Object.keys(r).forEach((k) => {
              const trimmedKey = k.trim();
              let val = r[k];
              if (typeof val === "string") val = val.trim();
              if (val === "true" || val === "TRUE" || val === true) val = true;
              if (val === "false" || val === "FALSE" || val === false) val = false;
              // Convert Date objects from XLSX cellDates:true to ISO strings
              if (val instanceof Date && !isNaN(val.getTime())) {
                const y = val.getFullYear();
                const m = String(val.getMonth() + 1).padStart(2, "0");
                const dy = String(val.getDate()).padStart(2, "0");
                val = `${y}-${m}-${dy}`;
              }
              // Catch any remaining Excel serial numbers in date-like columns
              if (trimmedKey.toLowerCase().includes("date") && typeof val === "number") {
                const iso = excelSerialToISO(val);
                if (iso) val = iso;
              }
              if (typeof val === "string" && trimmedKey.toLowerCase().includes("date")) {
                const iso = excelSerialToISO(val);
                if (iso) val = iso;
              }
              item[trimmedKey] = val;
            });
            // Fill blank columns with the contextual defaults (e.g. the section,
            // course or semester the user had filtered to), so every row doesn't
            // have to repeat them. Explicit file values always win.
            Object.entries(activeDefaults).forEach(([k, v]) => {
              if (item[k] === undefined || item[k] === null || String(item[k]).trim() === "") {
                item[k] = v;
              }
            });
            return item;
          })
          // Filter out empty/garbage trailing rows from spreadsheets
          .filter((item) => {
            const vals = Object.values(item);
            return vals.some((v) => v != null && String(v).trim() !== "" && String(v).trim() !== "=");
          });

        setParsedRows(cleaned);
      } catch (err) {
        logError("Parse File", err);
        setResult({ success: false, message: "Failed to parse file: " + err.message });
      }
    };
    reader.readAsArrayBuffer(selectedFile);
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
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleImport = async () => {
    let payloadRecords = [];

    if (parsedRows.length === 0) {
      setResult({ success: false, message: "Please upload a valid CSV or Excel file first." });
      return;
    }
    payloadRecords = parsedRows;

    if (payloadRecords.length === 0) {
      setResult({ success: false, message: "Records list cannot be empty." });
      return;
    }

    // Optional pre-upload validation (e.g. check teacher->subject assignments)
    if (typeof preValidate === "function") {
      const preErrors = await preValidate(payloadRecords);
      if (preErrors && preErrors.length > 0) {
        setResult({
          success: false,
          message: `Import blocked — ${preErrors.length} row(s) have errors. Fix the highlighted rows and re-upload.`,
          errors: preErrors,
        });
        return;
      }
    }

    setSubmitting(true);
    setResult(null);
    try {
      const res = await api.post(endpoint, { [bodyKey]: payloadRecords });
      const createdCount = res.data?.data?.length ?? payloadRecords.length;
      setResult({
        success: true,
        message: res.data?.message || `${createdCount} ${itemLabel} imported successfully!`,
      });
      if (onImported) onImported(createdCount);
      if (onClose) onClose();
    } catch (err) {
      const data = err.response?.data;
      if (!openUpgradeForError(err)) {
        setResult({
          success: false,
          message: data?.message || "Import failed.",
          errors: data?.errors || null,
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`Bulk Import & Export (${itemLabel})`}
        subtitle={`Upload a CSV or Excel file, download a dummy sample template, or export current ${itemLabel}.`}
        size="lg"
        footer={
          planModules && !planModules.bulkOperations ? (
            <div className="flex justify-end w-full">
              <Button type="button" variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-faint hidden sm:inline">Export:</span>
                <Button
                  type="button"
                  variant="subtle"
                  size="sm"
                  leftIcon={FileSpreadsheet}
                  onClick={() => handleExportData("xlsx")}
                  title="Export current entries to Excel"
                >
                  Excel
                </Button>
                <Button
                  type="button"
                  variant="subtle"
                  size="sm"
                  leftIcon={FileText}
                  onClick={() => handleExportData("csv")}
                  title="Export current entries to CSV"
                >
                  CSV
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleImport}
                  loading={submitting}
                  disabled={submitting || parsedRows.length === 0}
                  leftIcon={Upload}
                >
                  {submitting ? "Importing..." : "Import Data"}
                </Button>
              </div>
            </div>
          )
        }
      >
        {planModules && (!planModules.bulkOperations && !planModules.bulkImport) ? (
          <div className="py-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto text-amber-600 border border-amber-200">
              <Lock className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-ink">Bulk Operations Locked</h3>
              <p className="text-sm text-ink-soft max-w-md mx-auto mt-1">
                Bulk Import & Export functionality is an Enterprise feature. Upgrade to the Enterprise plan to unlock bulk operations.
              </p>
            </div>
            <Button
              type="button"
              onClick={() =>
                openUpgrade({
                  resourceType: "bulk_operations",
                  requiredPlan: "enterprise",
                  message: "Upgrade to Enterprise to unlock Bulk Operations.",
                })
              }
              leftIcon={Crown}
              className="bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-200"
            >
              Upgrade to Enterprise
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
          {/* Result Alert */}
          {result && (
            <div
              className={`flex gap-3 rounded-xl border p-3.5 ${
                result.success
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-red-50 border-red-200 text-red-800"
              }`}
            >
              {result.success ? (
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              )}
              <div className="text-sm w-full">
                <p className="font-semibold">{result.message}</p>
                {Array.isArray(result.errors) && result.errors.length > 0 && (
                  <div className="mt-2 space-y-1 max-h-40 overflow-auto border-t border-red-200/60 pt-2">
                    {result.errors.map((e, idx) => (
                      <p key={idx} className="text-xs text-red-700 font-mono">
                        Row #{e.index !== undefined ? e.index + 1 : idx + 1}: {e.error}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Contextual defaults hint */}
          {Object.keys(activeDefaults).length > 0 && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-800 px-3 py-2.5 text-xs flex items-start gap-2">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                Pre-filled from your current view —{" "}
                {Object.entries(activeDefaults).map(([k, v]) => (
                  <code key={k} className="font-mono font-bold bg-indigo-100 border border-indigo-200 rounded px-1 py-0.5 mx-0.5">{k}={v}</code>
                ))}{" "}
                will be applied to every blank row automatically. You can still override any cell in the file.
              </span>
            </div>
          )}

          {/* Sample Download Bar */}
          <div className="flex flex-wrap items-center justify-between bg-primary-soft/50 border border-primary-surface p-3 rounded-xl gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary-dark">
              <FileDown className="w-4 h-4 text-primary" />
              <span>Download Dummy Sample File:</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                leftIcon={Download}
                onClick={() => handleDownloadSample("csv")}
              >
                Sample CSV
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                leftIcon={Download}
                onClick={() => handleDownloadSample("xlsx")}
              >
                Sample Excel (.xlsx)
              </Button>
            </div>
          </div>

          {/* Format Guide / Docs */}
          {columns.length > 0 && (
            <div className="rounded-xl border border-line bg-surface p-3">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-4 h-4 text-primary" />
                <p className="text-xs font-bold text-ink-soft uppercase tracking-wider">
                  File Format Guide — {itemLabel}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="text-ink-faint uppercase tracking-wider border-b border-line">
                      <th className="py-1.5 pr-3 font-semibold">Column</th>
                      <th className="py-1.5 pr-3 font-semibold">Required</th>
                      <th className="py-1.5 font-semibold">Description / Example</th>
                    </tr>
                  </thead>
                  <tbody>
                    {columns.map((c) => (
                      <tr key={c.key} className="border-b border-line/50 last:border-0">
                        <td className="py-1.5 pr-3 font-mono text-primary font-semibold">{c.key}</td>
                        <td className="py-1.5 pr-3">
                          {c.required ? (
                            <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 font-bold">Yes</span>
                          ) : (
                            <span className="text-ink-faint">Optional</span>
                          )}
                        </td>
                        <td className="py-1.5 text-ink-soft">
                          {c.description}
                          {c.example !== undefined && (
                            <span className="text-ink-faint font-mono"> — e.g. {typeof c.example === "string" ? c.example : JSON.stringify(c.example)}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-ink-faint mt-2">
                Keep the first row as the column headers exactly as shown. Blank optional columns are skipped; required columns cannot be empty.
              </p>
            </div>
          )}

          {/* File Upload */}
          <div className="space-y-3">
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center transition cursor-pointer ${
                dragActive
                  ? "border-primary bg-primary-soft/50"
                  : file
                  ? "border-emerald-300 bg-emerald-50/50"
                  : "border-line hover:border-primary/40 bg-surface"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                hidden
                onChange={(e) => processFile(e.target.files?.[0])}
              />
              {!file ? (
                <div className="space-y-2">
                  <div className="w-12 h-12 rounded-full bg-primary-soft flex items-center justify-center mx-auto text-primary">
                    <Upload className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold text-ink">
                    Drag & drop your Excel (.xlsx) or CSV file here
                  </p>
                  <p className="text-xs text-ink-faint">
                    or click to browse files
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-between text-left p-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-ink">{file.name}</p>
                      <p className="text-xs text-ink-soft">
                        {(file.size / 1024).toFixed(1)} KB • {parsedRows.length} rows loaded
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      setParsedRows([]);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="p-2 hover:bg-red-100 rounded-full text-red-600 transition"
                    title="Remove file"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Data Preview */}
            {parsedRows.length > 0 && (
              <div className="rounded-xl border border-line bg-background p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-ink-soft">
                    Loaded Records Preview ({parsedRows.length} total {itemLabel})
                  </p>
                  <span className="text-[11px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    ✓ Ready for import
                  </span>
                </div>
                <div className="max-h-60 overflow-auto text-[11px] font-mono bg-surface p-2.5 rounded-lg border border-line space-y-2">
                  {parsedRows.map((r, idx) => (
                    <div key={idx} className="border-b border-line/40 pb-1.5 last:border-0 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span className="text-primary font-bold">#{idx + 1}</span>
                      {Object.entries(r).map(([key, val]) => (
                        <span key={key} className="text-ink-soft">
                          <span className="text-ink-faint font-semibold">{key}:</span> {String(val)}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <p className="text-xs text-ink-faint">
            Note: All entries are validated transactionally. If any row contains errors, no records will be inserted and row error details will be reported above.
          </p>
        </div>
        )}
      </Modal>
      <PricingModal {...modalProps} />
    </>
  );
};

export default BulkImportModal;
