import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Grid,
  Calendar,
  Sparkles,
  Printer,
  CheckCircle,
  AlertCircle,
  Clock,
  Layers,
  ShieldCheck,
  RefreshCw,
  Building,
  FileSpreadsheet,
  Download,
  Upload,
  FileText,
  Check,
} from "lucide-react";
import * as XLSX from "xlsx";
import api from "../../utils/api";
import { logError } from "../../utils/logger";
import Button from "../common/ui/Button";
import Card from "../common/ui/Card";
import Badge from "../common/ui/Badge";
import Modal from "../common/ui/Modal";
import DashboardHeader from "../common/ui/DashboardHeader";
import { formatDateDMY } from "../../utils/dateUtils";

const BRANCH_COLORS = [
  { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-600 dark:text-blue-400", dot: "bg-blue-500" },
  { bg: "bg-purple-500/10", border: "border-purple-500/30", text: "text-purple-600 dark:text-purple-400", dot: "bg-purple-500" },
  { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
  { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
  { bg: "bg-rose-500/10", border: "border-rose-500/30", text: "text-rose-600 dark:text-rose-400", dot: "bg-rose-500" },
  { bg: "bg-cyan-500/10", border: "border-cyan-500/30", text: "text-cyan-600 dark:text-cyan-400", dot: "bg-cyan-500" },
];

const ExamSeatingEngine = () => {
  const [examDate, setExamDate] = useState(new Date().toISOString().split("T")[0]);
  const [shift, setShift] = useState("I");
  const [halls, setHalls] = useState([]);
  const [selectedHallIds, setSelectedHallIds] = useState([]);
  const [scheduledExams, setScheduledExams] = useState([]);
  const [scheduledDateSlots, setScheduledDateSlots] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [activeHallId, setActiveHallId] = useState(null);
  const [hallChartData, setHallChartData] = useState(null);

  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  // Excel Import Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [importError, setImportError] = useState(null);
  const [importClearExisting, setImportClearExisting] = useState(false);
  const fileInputRef = useRef(null);

  // Load active halls and scheduled exam dates
  useEffect(() => {
    Promise.all([
      api.get("/exams/seating/halls?isActive=true").catch(() => ({ data: { data: [] } })),
      api.get("/exams/seating/scheduled-dates").catch(() => ({ data: { data: [] } })),
    ])
      .then(([hallsRes, datesRes]) => {
        const hallList = hallsRes.data?.data || [];
        setHalls(hallList);
        setSelectedHallIds(hallList.map((h) => h._id));

        const slots = datesRes.data?.data || [];
        setScheduledDateSlots(slots);

        // Auto-select first scheduled exam slot if today has no exams
        if (slots.length > 0) {
          const todayStr = new Date().toISOString().split("T")[0];
          const hasToday = slots.some((s) => s.date === todayStr);
          if (!hasToday) {
            setExamDate(slots[0].date);
            setShift(slots[0].shift || "I");
          }
        }
      })
      .catch((err) => logError("Fetch initial seating data error", err));
  }, []);

  // Fetch scheduled exams and existing allocations for this Date & Shift
  const fetchSlotData = useCallback(async () => {
    if (!examDate || !shift) return;
    setLoading(true);
    setStatusMsg(null);
    try {
      // 1. Fetch scheduled exams
      const examsRes = await api.get(`/exams?date=${examDate}&shift=${shift}`);
      const exams = examsRes.data?.data || examsRes.data || [];
      setScheduledExams(Array.isArray(exams) ? exams : []);

      // 2. Fetch existing allocations
      const allocRes = await api.get(`/exams/seating/allocations?examDate=${examDate}&shift=${shift}`);
      const allocs = allocRes.data?.data || [];
      setAllocations(allocs);

      if (allocs.length > 0) {
        const uniqueHalls = Array.from(new Set(allocs.map((a) => a.hallId)));
        if (!activeHallId || !uniqueHalls.includes(activeHallId)) {
          setActiveHallId(uniqueHalls[0]);
        }
      }
    } catch (err) {
      logError("Fetch slot data error", err);
    } finally {
      setLoading(false);
    }
  }, [examDate, shift, activeHallId]);

  useEffect(() => {
    fetchSlotData();
  }, [fetchSlotData]);

  // Fetch hall chart matrix when activeHallId changes
  useEffect(() => {
    if (!activeHallId || !examDate || !shift) {
      setHallChartData(null);
      return;
    }

    api.get(`/exams/seating/hall-chart/${activeHallId}?examDate=${examDate}&shift=${shift}`)
      .then((res) => {
        if (res.data?.success) {
          setHallChartData(res.data.data);
        }
      })
      .catch((err) => logError("Fetch hall chart error", err));
  }, [activeHallId, examDate, shift, allocations]);

  // Seating Generator Trigger
  const handleGenerate = async () => {
    if (selectedHallIds.length === 0) {
      setStatusMsg({ type: "error", message: "Please select at least one examination hall." });
      return;
    }

    setGenerating(true);
    setStatusMsg(null);
    try {
      const res = await api.post("/exams/seating/generate", {
        examDate,
        shift,
        hallIds: selectedHallIds,
        clearExisting: true,
      });

      if (res.data?.success) {
        setStatusMsg({
          type: "success",
          message: res.data.message || `Successfully allocated seating for ${res.data.summary?.totalAllocated} candidates!`,
        });
        await fetchSlotData();
      }
    } catch (err) {
      logError("Generate seating error", err);
      setStatusMsg({
        type: "error",
        message: err.response?.data?.message || "Failed to generate seating arrangement.",
      });
    } finally {
      setGenerating(false);
    }
  };

  const selectedCapacity = useMemo(() => {
    return halls
      .filter((h) => selectedHallIds.includes(h._id))
      .reduce((sum, h) => sum + (h.capacity || 0), 0);
  }, [halls, selectedHallIds]);

  const uniqueBranches = useMemo(() => {
    const branches = new Set();
    allocations.forEach((a) => {
      if (a.branch) branches.add(a.branch);
    });
    return Array.from(branches);
  }, [allocations]);

  const branchColorMap = useMemo(() => {
    const map = {};
    uniqueBranches.forEach((b, idx) => {
      map[b] = BRANCH_COLORS[idx % BRANCH_COLORS.length];
    });
    return map;
  }, [uniqueBranches]);

  // Hall Tabs from allocations
  const activeHallAllocations = useMemo(() => {
    const map = new Map();
    allocations.forEach((a) => {
      const count = map.get(a.hallId) || 0;
      map.set(a.hallId, count + 1);
    });
    return map;
  }, [allocations]);

  const handlePrint = () => {
    window.print();
  };

  // ─── EXCEL EXPORT (Multi-Tab Workbook) ───
  const handleExportExcel = () => {
    if (allocations.length === 0) return;

    // 1. Detailed Seating Notice Sheet
    const noticeRows = allocations.map((a, idx) => ({
      "S.No": idx + 1,
      "Exam Hall Code": a.hallCode || "—",
      "Hall Name": a.hallName || "—",
      "Seat Number": a.seatNumber || "—",
      "Row": a.row || "—",
      "Column": a.col || "—",
      "Exam Date": formatDateDMY(a.examDate),
      "Shift": `Shift ${a.shift || "I"}`,
      "Student Roll No": a.studentRollNo || "—",
      "Student Name": a.studentName || "—",
      "Branch": a.branch || "—",
      "Semester": a.semester ? `Sem ${a.semester}` : "—",
      "Section": a.section ? `Sec ${a.section}` : "—",
      "Subject Code": a.subjectCode || "—",
      "Subject Name": a.subjectName || "—",
      "Attendance Status": a.attendanceStatus || "pending",
    }));

    const worksheetNotice = XLSX.utils.json_to_sheet(noticeRows);
    worksheetNotice["!cols"] = [
      { wch: 6 },
      { wch: 15 },
      { wch: 22 },
      { wch: 16 },
      { wch: 6 },
      { wch: 8 },
      { wch: 14 },
      { wch: 10 },
      { wch: 22 },
      { wch: 24 },
      { wch: 10 },
      { wch: 8 },
      { wch: 8 },
      { wch: 14 },
      { wch: 32 },
      { wch: 16 },
    ];

    // 2. Hall Door Summary Sheet
    const hallGroups = {};
    allocations.forEach((a) => {
      const code = a.hallCode || "General";
      if (!hallGroups[code]) {
        hallGroups[code] = {
          "Hall Code": code,
          "Hall Name": a.hallName || "—",
          "Total Candidates": 0,
          "Branches": new Set(),
          "Sections": new Set(),
        };
      }
      hallGroups[code]["Total Candidates"]++;
      if (a.branch) hallGroups[code]["Branches"].add(a.branch);
      if (a.section) hallGroups[code]["Sections"].add(a.section);
    });

    const summaryRows = Object.values(hallGroups).map((h) => ({
      "Hall Code": h["Hall Code"],
      "Hall Name": h["Hall Name"],
      "Total Candidates": h["Total Candidates"],
      "Branches Present": Array.from(h["Branches"]).join(", "),
      "Sections Included": Array.from(h["Sections"]).join(", "),
    }));

    const worksheetSummary = XLSX.utils.json_to_sheet(summaryRows);
    worksheetSummary["!cols"] = [
      { wch: 15 },
      { wch: 25 },
      { wch: 18 },
      { wch: 30 },
      { wch: 20 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheetNotice, "Seating Notice");
    XLSX.utils.book_append_sheet(workbook, worksheetSummary, "Hall Summary");

    // 3. Active Room Matrix Grid Sheet (if loaded)
    if (hallChartData && hallChartData.grid) {
      const matrixData = [];
      matrixData.push([`EXAM SEATING MATRIX — ${hallChartData.hall?.hallCode || ""} (${hallChartData.examDate} Shift ${hallChartData.shift})`]);
      matrixData.push([]);

      hallChartData.grid.forEach((rowSeats, rIdx) => {
        const rowCells = [`Row ${rIdx + 1}`];
        rowSeats.forEach((colBenches) => {
          colBenches.forEach((seat) => {
            if (seat.allocation) {
              rowCells.push(`${seat.seatNumber}: ${seat.allocation.studentName} (${seat.allocation.branch || ""})`);
            } else {
              rowCells.push(`${seat.seatNumber}: [EMPTY]`);
            }
          });
        });
        matrixData.push(rowCells);
      });

      const worksheetMatrix = XLSX.utils.aoa_to_sheet(matrixData);
      XLSX.utils.book_append_sheet(workbook, worksheetMatrix, "Active Room Grid");
    }

    const fileName = `Seating_Notice_${examDate}_Shift_${shift}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  // ─── EXCEL TEMPLATE DOWNLOAD ───
  const handleDownloadTemplate = () => {
    const sampleRows = [
      {
        hallCode: halls[0]?.hallCode || "HALL-A1",
        seatNumber: `${halls[0]?.hallCode || "HALL-A1"}-R1C1`,
        row: 1,
        col: 1,
        rollNo: "APEX26BTECHCSEA001",
        studentName: "Vivaan Sharma",
        subjectCode: scheduledExams[0]?.subjectCode || "CS101",
        examDate: examDate || "2026-03-10",
        shift: shift || "I",
      },
      {
        hallCode: halls[0]?.hallCode || "HALL-A1",
        seatNumber: `${halls[0]?.hallCode || "HALL-A1"}-R1C2`,
        row: 1,
        col: 2,
        rollNo: "APEX26BTECHECEA001",
        studentName: "Aditi Gupta",
        subjectCode: scheduledExams[1]?.subjectCode || "EC101",
        examDate: examDate || "2026-03-10",
        shift: shift || "I",
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "SeatingTemplate");
    XLSX.writeFile(workbook, "Seating_Import_Template.xlsx");
  };

  // ─── EXCEL FILE PARSING ───
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setImportError(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: "array", cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        if (rows.length === 0) {
          setImportError("Uploaded sheet contains no data rows.");
          setParsedRows([]);
          return;
        }

        setParsedRows(rows);
      } catch (err) {
        logError("File parse error", err);
        setImportError("Failed to parse Excel file. Please ensure it is a valid .xlsx or .csv file.");
        setParsedRows([]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // ─── EXCEL IMPORT SUBMIT ───
  const handleImportSubmit = async () => {
    if (parsedRows.length === 0) {
      setImportError("Please select a file with valid seating data.");
      return;
    }

    setImporting(true);
    setImportError(null);
    try {
      const res = await api.post("/exams/seating/import-excel", {
        rows: parsedRows,
        clearExisting: importClearExisting,
      });

      if (res.data?.success) {
        setShowImportModal(false);
        setParsedRows([]);
        setImportFile(null);
        setStatusMsg({
          type: "success",
          message: res.data.message || `Successfully imported ${res.data.importedCount} seating allocations from Excel!`,
        });
        await fetchSlotData();
      }
    } catch (err) {
      logError("Import seating error", err);
      setImportError(err.response?.data?.message || "Failed to import seating allocations.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <DashboardHeader
          greeting="Exam Seating Engine & Room Allotments"
          meta="Generate anti-cheating Jumble & Split seating layouts, export/import Excel seating sheets, and manage venue notices"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="subtle"
                size="sm"
                onClick={fetchSlotData}
                disabled={loading}
                leftIcon={RefreshCw}
              >
                Refresh
              </Button>

              <Button
                variant="subtle"
                size="sm"
                onClick={() => {
                  setShowImportModal(true);
                  setImportError(null);
                  setParsedRows([]);
                  setImportFile(null);
                }}
                leftIcon={Upload}
              >
                Import Excel
              </Button>

              {allocations.length > 0 && (
                <Button
                  variant="subtle"
                  size="sm"
                  onClick={handleExportExcel}
                  leftIcon={FileSpreadsheet}
                >
                  Export Excel
                </Button>
              )}

              {allocations.length > 0 && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handlePrint}
                  leftIcon={Printer}
                >
                  Print Notice
                </Button>
              )}
            </div>
          }
        />
      </div>

      {/* Seating Generator Control Deck */}
      <div className="print:hidden">
        <Card padding="lg" className="space-y-5 border-line">
          {/* Scheduled Dates Quick Selector */}
          {scheduledDateSlots.length > 0 && (
            <div className="pb-3 border-b border-line/60">
              <label className="block text-xs font-semibold text-ink mb-2 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-primary" /> Active Examination Schedule Slots (Click to Select):
              </label>
              <div className="flex flex-wrap gap-2">
                {scheduledDateSlots.map((slot) => {
                  const isCurrent = slot.date === examDate && (slot.shift || "I") === shift;
                  return (
                    <button
                      key={`${slot.date}_${slot.shift}`}
                      type="button"
                      onClick={() => {
                        setExamDate(slot.date);
                        setShift(slot.shift || "I");
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-2 transition ${
                        isCurrent
                          ? "bg-primary text-white border-primary shadow-sm font-semibold"
                          : "bg-surface text-ink border-line hover:bg-surface-alt"
                      }`}
                    >
                      <Calendar className="w-3 h-3" />
                      <span>{slot.date} (Shift {slot.shift || "I"})</span>
                      <span className={`px-1.5 py-0.2 rounded text-[10px] ${isCurrent ? "bg-white/20" : "bg-primary-soft text-primary font-bold"}`}>
                        {slot.examsCount} Exams
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Date Picker */}
            <div>
              <label className="block text-xs font-semibold text-ink mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-primary" /> Examination Date
              </label>
              <input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="w-full text-xs bg-surface border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:border-primary"
              />
            </div>

            {/* 2. Shift Selector */}
            <div>
              <label className="block text-xs font-semibold text-ink mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-primary" /> Examination Shift
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {["I", "II", "III", "IV"].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setShift(s)}
                    className={`py-1.5 text-xs font-bold rounded-lg border transition ${
                      shift === s
                        ? "bg-primary text-white border-primary shadow-sm"
                        : "bg-surface text-ink border-line hover:bg-surface-alt"
                    }`}
                  >
                    Shift {s}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Slot Summary */}
            <div className="p-3 bg-surface-alt/70 border border-line rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[11px] text-ink-faint block">Scheduled Exams</span>
                <span className="text-sm font-bold text-ink">{scheduledExams.length} Subject(s)</span>
              </div>
              <div>
                <span className="text-[11px] text-ink-faint block">Allocated Seats</span>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {allocations.length} Candidates
                </span>
              </div>
            </div>
          </div>

          {/* Scheduled Exams in this slot preview */}
          {scheduledExams.length > 0 && (
            <div className="p-3 rounded-xl bg-primary-soft/30 border border-primary-surface space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-primary-dark">
                <span>📚 Papers in this Slot ({scheduledExams.length}):</span>
                <span className="text-[11px] text-ink-faint font-normal">{examDate} • Shift {shift}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                {scheduledExams.map((ex) => (
                  <div key={ex._id} className="p-2 rounded-lg bg-surface border border-line text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-primary truncate">{ex.subjectCode || ex.subjectName}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-primary-soft text-primary font-semibold">
                        {ex.branch ? `${ex.branch} Sec ${ex.section}` : `Sec ${ex.section}`}
                      </span>
                    </div>
                    <p className="text-[11px] text-ink truncate" title={ex.title}>{ex.title}</p>
                    <div className="text-[10px] text-ink-faint flex items-center justify-between">
                      <span>{ex.startTime}-{ex.endTime}</span>
                      <span className="font-semibold text-ink-soft">Hall: {ex.room || "TBD"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hall Selection & Capacity Meter */}
          <div className="pt-3 border-t border-line/60 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-ink flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-primary" /> Select Exam Halls for Seating Allocation
              </span>
              <span className="font-semibold text-primary">
                Selected Capacity: {selectedCapacity} Seats ({selectedHallIds.length} Halls)
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {halls.map((hall) => {
                const isSelected = selectedHallIds.includes(hall._id);
                return (
                  <button
                    key={hall._id}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setSelectedHallIds(selectedHallIds.filter((id) => id !== hall._id));
                      } else {
                        setSelectedHallIds([...selectedHallIds, hall._id]);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-2 transition ${
                      isSelected
                        ? "bg-primary/10 border-primary text-primary font-semibold"
                        : "bg-surface border-line text-ink-faint hover:text-ink"
                    }`}
                  >
                    <span>{hall.hallCode}</span>
                    <span className="text-[10px] opacity-75">({hall.capacity} seats)</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Button & Status Notice */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-ink-faint flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span>
                <strong>Jumble & Split Strategy:</strong> Automatically alternates students from different branches in adjacent seats to eliminate copying.
              </span>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={generating || scheduledExams.length === 0}
              className="w-full sm:w-auto px-5 py-2.5 bg-primary text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm hover:bg-primary-dark transition disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {generating ? "Computing Anti-Cheating Allocations..." : "Generate Anti-Cheating Seating"}
            </Button>
          </div>

          {statusMsg && (
            <div
              className={`p-3.5 rounded-xl text-xs font-medium border flex items-center gap-2.5 ${
                statusMsg.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                  : "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300"
              }`}
            >
              {statusMsg.type === "success" ? (
                <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              )}
              <span>{statusMsg.message}</span>
            </div>
          )}
        </Card>
      </div>

      {/* Visual Seating Matrix & Hall Tabs */}
      {allocations.length > 0 && (
        <div className="space-y-4">
          {/* Hall Selection Tabs */}
          <div className="print:hidden flex items-center gap-2 overflow-x-auto pb-1">
            {Array.from(activeHallAllocations.keys()).map((hId) => {
              const hallObj = halls.find((h) => h._id === hId);
              const count = activeHallAllocations.get(hId) || 0;
              const isActive = activeHallId === hId;
              return (
                <button
                  key={hId}
                  onClick={() => setActiveHallId(hId)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border flex items-center gap-2 transition ${
                    isActive
                      ? "bg-primary text-white border-primary shadow-sm"
                      : "bg-surface text-ink border-line hover:bg-surface-alt"
                  }`}
                >
                  <Building className="w-3.5 h-3.5" />
                  <span>{hallObj?.hallCode || "Exam Hall"}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${isActive ? "bg-white/20" : "bg-surface-alt"}`}>
                    {count} Students
                  </span>
                </button>
              );
            })}
          </div>

          {/* Branch Color Legend */}
          <div className="print:hidden p-3 bg-surface border border-line rounded-xl flex flex-wrap items-center gap-3 text-xs">
            <span className="font-semibold text-ink flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-primary" /> Branch Interleaving Legend:
            </span>
            {uniqueBranches.map((branch) => {
              const colors = branchColorMap[branch] || BRANCH_COLORS[0];
              return (
                <span
                  key={branch}
                  className={`px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1.5 ${colors.bg} ${colors.border} ${colors.text}`}
                >
                  <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                  {branch}
                </span>
              );
            })}
          </div>

          {/* 2D Interactive Grid View & Printable Door Notice */}
          {hallChartData && (
            <Card padding="lg" className="space-y-6 border-line print:shadow-none print:border-none print:p-0">
              {/* Header on Printable Sheet */}
              <div className="text-center pb-4 border-b border-line">
                <div className="hidden print:block text-xs font-semibold tracking-wider text-ink-faint uppercase mb-1">
                  AttendEase Institutional Examination System
                </div>
                <h3 className="text-lg font-bold text-ink">
                  Examination Seating Chart — {hallChartData.hall?.hallCode} ({hallChartData.hall?.name})
                </h3>
                <p className="text-xs text-ink-faint mt-1">
                  Date: <strong>{hallChartData.examDate}</strong> • Shift: <strong>{hallChartData.shift}</strong> • Venue:{" "}
                  <strong>{hallChartData.hall?.building} ({hallChartData.hall?.floor})</strong> • Total Candidates:{" "}
                  <strong className="text-primary">{hallChartData.totalAllocated}</strong>
                </p>
              </div>

              {/* Podium / Invigilator Desk Visual cue */}
              <div className="max-w-md mx-auto py-2 bg-surface-alt text-center rounded-lg border border-dashed border-line text-xs font-semibold text-ink-faint tracking-wider uppercase">
                ▲ FRONT OF EXAM HALL / INVIGILATOR DESK ▲
              </div>

              {/* The Grid Rows */}
              <div className="overflow-x-auto pb-4">
                <div className="min-w-[650px] flex flex-col gap-3 items-center">
                  {hallChartData.grid.map((rowSeats, rIdx) => (
                    <div key={rIdx} className="flex items-center gap-3">
                      <span className="w-12 text-[11px] font-bold text-ink-faint text-right">
                        Row {rIdx + 1}
                      </span>
                      <div className="flex gap-2.5">
                        {rowSeats.map((colBenches, cIdx) => (
                          <div key={cIdx} className="flex gap-1 bg-surface-alt/40 p-1 rounded-lg border border-line/60">
                            {colBenches.map((seat, bIdx) => {
                              const alloc = seat.allocation;
                              const branchColor = alloc?.branch
                                ? branchColorMap[alloc.branch] || BRANCH_COLORS[0]
                                : null;
                              return (
                                <div
                                  key={bIdx}
                                  className={`w-28 p-2 rounded-lg border flex flex-col justify-between transition-all min-h-[70px] ${
                                    alloc
                                      ? `${branchColor?.bg} ${branchColor?.border} shadow-sm`
                                      : "bg-surface border-line/40 text-ink-faint/40 border-dashed"
                                  }`}
                                >
                                  <div className="flex items-center justify-between text-[10px]">
                                    <span className="font-mono font-bold text-ink">{seat.seatNumber}</span>
                                    {alloc && (
                                      <span
                                        className={`w-1.5 h-1.5 rounded-full ${
                                          alloc.attendanceStatus === "present"
                                            ? "bg-emerald-500"
                                            : alloc.attendanceStatus === "absent"
                                            ? "bg-red-500"
                                            : "bg-amber-500"
                                        }`}
                                      />
                                    )}
                                  </div>

                                  {alloc ? (
                                    <div className="my-1">
                                      <p className="text-[11px] font-bold text-ink truncate" title={alloc.studentName}>
                                        {alloc.studentName}
                                      </p>
                                      <p className="text-[10px] font-mono text-ink-faint truncate">
                                        {alloc.studentRollNo || "No Roll"}
                                      </p>
                                    </div>
                                  ) : (
                                    <div className="text-[10px] text-center my-auto opacity-50">Empty</div>
                                  )}

                                  {alloc && (
                                    <div className="text-[9px] font-semibold text-primary truncate">
                                      {alloc.branch || alloc.subjectCode || "Candidate"}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Printable Footer Strip for Invigilators */}
              <div className="pt-8 mt-6 border-t border-line hidden print:block">
                <div className="grid grid-cols-3 gap-8 text-xs text-ink-faint">
                  <div>
                    <span className="block font-semibold text-ink mb-6">Invigilator 1 Signature:</span>
                    <div className="border-b border-ink/40" />
                  </div>
                  <div>
                    <span className="block font-semibold text-ink mb-6">Invigilator 2 Signature:</span>
                    <div className="border-b border-ink/40" />
                  </div>
                  <div>
                    <span className="block font-semibold text-ink mb-6">Exam Coordinator / Seal:</span>
                    <div className="border-b border-ink/40" />
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ─── EXCEL IMPORT MODAL ─── */}
      <Modal
        isOpen={showImportModal}
        onClose={() => {
          if (!importing) {
            setShowImportModal(false);
            setImportFile(null);
            setParsedRows([]);
            setImportError(null);
          }
        }}
        title="Import Seating Arrangement from Excel"
        subtitle="Upload candidate seat numbers and examination room assignments in bulk."
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button
              variant="outline"
              type="button"
              onClick={handleDownloadTemplate}
              className="flex items-center gap-1.5 text-xs text-primary border-primary/30 hover:bg-primary/10"
            >
              <Download className="w-3.5 h-3.5" /> Download Sample Template
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                type="button"
                disabled={importing}
                onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                  setParsedRows([]);
                }}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={importing || parsedRows.length === 0}
                onClick={handleImportSubmit}
                className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                <Check className="w-3.5 h-3.5" />
                {importing ? "Importing Allocations..." : `Import ${parsedRows.length > 0 ? `(${parsedRows.length} Rows)` : ""}`}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          {/* File Upload Box */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition ${
              importFile
                ? "border-emerald-500/50 bg-emerald-500/5"
                : "border-line hover:border-primary/50 hover:bg-surface-alt"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <p className="font-semibold text-ink">
                  {importFile ? importFile.name : "Click to upload or drag & drop Excel sheet"}
                </p>
                <p className="text-[11px] text-ink-faint mt-0.5">
                  Supported formats: .xlsx, .xls, .csv (Headers: hallCode, seatNumber, rollNo, subjectCode, examDate, shift)
                </p>
              </div>
            </div>
          </div>

          {/* Options */}
          {parsedRows.length > 0 && (
            <div className="p-3 bg-surface-alt rounded-xl border border-line flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={importClearExisting}
                  onChange={(e) => setImportClearExisting(e.target.checked)}
                  className="rounded border-line text-primary focus:ring-primary h-4 w-4"
                />
                <span className="text-xs font-medium text-ink">
                  Overwrite / clear existing allocations for this date slot
                </span>
              </label>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                {parsedRows.length} valid row(s) ready
              </span>
            </div>
          )}

          {/* Preview Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-ink">Spreadsheet Data Preview (First 5 Rows):</span>
              </div>
              <div className="border border-line rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-surface-alt border-b border-line text-ink-faint font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="p-2">Hall Code</th>
                      <th className="p-2">Seat No</th>
                      <th className="p-2">Roll No</th>
                      <th className="p-2">Subject</th>
                      <th className="p-2">Date</th>
                      <th className="p-2">Shift</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {parsedRows.slice(0, 5).map((row, idx) => (
                      <tr key={idx} className="hover:bg-surface-alt/50 text-ink">
                        <td className="p-2 font-mono font-medium">{row.hallCode || row["Hall Code"] || "—"}</td>
                        <td className="p-2 font-mono">{row.seatNumber || row["Seat Number"] || "—"}</td>
                        <td className="p-2 font-mono">{row.rollNo || row.studentRollNo || row["Roll No"] || "—"}</td>
                        <td className="p-2">{row.subjectCode || row["Subject Code"] || "—"}</td>
                        <td className="p-2">{row.examDate || row["Exam Date"] || "—"}</td>
                        <td className="p-2">{row.shift || row["Shift"] || "I"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Error Notice */}
          {importError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
              <span>{importError}</span>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default ExamSeatingEngine;
