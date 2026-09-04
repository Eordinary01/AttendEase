import React, { useState, useEffect } from "react";
import {
  Award,
  Calendar,
  Printer,
  ShieldCheck,
  AlertTriangle,
  FileCheck2,
  Lock,
  Layers,
  Clock,
  MapPin,
  CheckCircle2,
  Ban,
  Info,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import api from "../../utils/api";
import { logError } from "../../utils/logger";
import Button from "../common/ui/Button";
import Card from "../common/ui/Card";
import Badge from "../common/ui/Badge";
import DashboardHeader from "../common/ui/DashboardHeader";
import { formatDateDMY, formatDateReadable } from "../../utils/dateUtils";

const StudentHallTicket = () => {
  const [ticketData, setTicketData] = useState(null);
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchHallTicket();
  }, []);

  const fetchHallTicket = async (periodId = "") => {
    if (periodId) setSwitching(true);
    else setLoading(true);
    setError(null);

    try {
      const url = periodId
        ? `/exams/seating/my-hall-ticket?examPeriodId=${periodId}`
        : "/exams/seating/my-hall-ticket";
      const res = await api.get(url);

      if (res.data) {
        setTicketData(res.data.data);
        if (res.data.data?.examPeriod?._id) {
          setSelectedPeriodId(res.data.data.examPeriod._id);
        }
        if (!res.data.success && res.data.message) {
          setError(res.data.message);
        }
      }
    } catch (err) {
      logError("Fetch hall ticket error", err);
      const msg = err.response?.data?.message || "Failed to load examination admit card.";
      setError(msg);
      if (err.response?.data?.data) {
        setTicketData(err.response.data.data);
        if (err.response.data.data?.examPeriod?._id) {
          setSelectedPeriodId(err.response.data.data.examPeriod._id);
        }
      }
    } finally {
      setLoading(false);
      setSwitching(false);
    }
  };

  const handlePeriodChange = (periodId) => {
    if (periodId === selectedPeriodId) return;
    setSelectedPeriodId(periodId);
    fetchHallTicket(periodId);
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-ink-faint animate-pulse space-y-3">
        <Award className="w-12 h-12 mx-auto text-primary opacity-50" />
        <p className="font-bold text-sm text-ink">Verifying Academic Periods & Generating Signed Admit Card...</p>
        <p className="text-xs text-ink-faint">Validating scheduled exams, course curriculum, and security keys</p>
      </div>
    );
  }

  const {
    student,
    institution,
    examPeriod,
    availablePeriods = [],
    allocations = [],
    instructions = [],
    qrPayload,
  } = ticketData || {};

  const canDownload = Boolean(ticketData?.examsCount > 0 && allocations.length > 0);
  const currentPeriod = examPeriod || availablePeriods.find((p) => String(p._id) === String(selectedPeriodId));

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Header & Actions (Hidden during print) */}
      <div className="print:hidden space-y-4">
        <DashboardHeader
          greeting="Examination Admit Card & Hall Ticket"
          meta="Generate and print your official cryptographically verified admit card with seating allocations and QR security"
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={handlePrint}
                disabled={!canDownload}
                leftIcon={Printer}
              >
                Print Admit Card (PDF)
              </Button>
            </div>
          }
        />

        {/* Exam Period Selector Bar */}
        {availablePeriods.length > 0 && (
          <div className="p-3 bg-surface border border-line rounded-2xl shadow-2xs space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-ink-faint flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-primary" /> Select Examination Period
              </span>
              <span className="text-[11px] text-ink-faint">
                Admit cards are isolated per exam period
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {availablePeriods.map((period) => {
                const isSelected = String(period._id) === String(selectedPeriodId);
                const hasExams = period.hasExams || period.examsCount > 0;

                return (
                  <button
                    key={period._id}
                    type="button"
                    onClick={() => handlePeriodChange(period._id)}
                    className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-medium transition border ${
                      isSelected
                        ? "bg-primary text-white border-primary shadow-sm"
                        : "bg-surface text-ink hover:bg-surface-alt border-line"
                    }`}
                  >
                    <span className="font-semibold">{period.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${
                        isSelected
                          ? "bg-white/20 text-white"
                          : hasExams
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                          : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                      }`}
                    >
                      {hasExams ? `${period.examsCount || allocations.length} Exams` : "No Exams"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Switching Loader */}
      {switching && (
        <div className="py-12 text-center text-ink-faint animate-pulse">
          <p className="text-xs font-semibold">Loading admit card for selected exam period...</p>
        </div>
      )}

      {/* Warning/Error Notice when Exams are NOT created by Admin for this Period */}
      {!switching && !canDownload && (
        <Card padding="lg" className="border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 text-center py-10 space-y-3 print:hidden">
          <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
            <Ban className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-ink text-base">
              Admit Card Unavailable for {currentPeriod?.name || "this Examination Period"}
            </h3>
            <p className="text-xs text-ink-soft max-w-lg mx-auto">
              {error ||
                `The administration has not yet scheduled any examinations for your semester (${student?.semester ? `Semester ${student.semester}` : "current curriculum"}) in this exam period. The Admit Card can only be downloaded once exams are officially created.`}
            </p>
          </div>

          <div className="pt-2 flex items-center justify-center gap-4 text-[11px] text-ink-faint">
            <span className="flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-primary" /> Branch: {student?.branch || "General"}
            </span>
            <span>•</span>
            <span>Semester {student?.semester || "1"}</span>
            <span>•</span>
            <span>Section {student?.section || "A"}</span>
          </div>
        </Card>
      )}

      {/* Official Printable Admit Card (Shown when exams exist) */}
      {!switching && canDownload && student && (
        <div className="bg-surface border border-line rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm print:shadow-none print:border-none print:p-0 print:m-0 text-ink">
          {/* Card Header with Institutional Watermark/Header */}
          <div className="text-center pb-5 border-b-2 border-primary/30 space-y-1">
            <div className="flex items-center justify-center gap-2.5 text-primary font-bold text-lg sm:text-xl tracking-tight">
              {institution?.logo ? (
                <img src={institution.logo} alt={institution.name} className="h-7 w-auto object-contain max-w-[40px] rounded" />
              ) : (
                <ShieldCheck className="w-6 h-6" />
              )}
              <span className="uppercase">{institution?.name || "ACADEMIC EXAMINATION AUTHORITY"}</span>
            </div>
            <h2 className="text-base sm:text-lg font-extrabold uppercase tracking-wide text-ink">
              Official Examination Hall Ticket & Admit Card
            </h2>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full text-xs font-bold text-primary">
              <span>{currentPeriod?.name?.toUpperCase() || "SEMESTER EXAMINATION"}</span>
              <span>•</span>
              <span>Semester {student.semester || "1"}</span>
            </div>
          </div>

          {/* Candidate Profile Details & Primary QR Code */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center p-4 bg-surface-alt/50 border border-line rounded-xl">
            {/* Avatar / Photo */}
            <div className="flex flex-col items-center justify-center text-center">
              {student.avatar ? (
                <img
                  src={student.avatar}
                  alt={student.name}
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl object-cover border-2 border-primary shadow-sm"
                />
              ) : (
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl bg-primary/10 border-2 border-primary flex items-center justify-center text-primary font-bold text-2xl">
                  {student.name?.charAt(0) || "S"}
                </div>
              )}
              <span className="text-[10px] font-semibold text-ink-faint mt-1.5 uppercase tracking-wider">
                Candidate Photo
              </span>
            </div>

            {/* Student Information Grid */}
            <div className="md:col-span-2 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-ink-faint block text-[11px]">Candidate Name</span>
                <span className="font-bold text-ink text-sm">{student.name}</span>
              </div>
              <div>
                <span className="text-ink-faint block text-[11px]">Roll Number</span>
                <span className="font-mono font-bold text-primary text-sm">
                  {student.rollNo || student.enrollmentNumber || "NOT ASSIGNED"}
                </span>
              </div>
              <div>
                <span className="text-ink-faint block text-[11px]">Program / Course</span>
                <span className="font-semibold text-ink">{student.courseName || "Undergraduate Program"}</span>
              </div>
              <div>
                <span className="text-ink-faint block text-[11px]">Branch / Specialization</span>
                <span className="font-semibold text-ink">{student.branch || "General"}</span>
              </div>
              <div>
                <span className="text-ink-faint block text-[11px]">Semester & Section</span>
                <span className="font-semibold text-ink">
                  Semester {student.semester || "1"} • Section {student.section || "A"}
                </span>
              </div>
              <div>
                <span className="text-ink-faint block text-[11px]">Exam Period Window</span>
                <span className="font-semibold text-ink">
                  {currentPeriod?.startDate ? formatDateDMY(currentPeriod.startDate) : "Active"} –{" "}
                  {currentPeriod?.endDate ? formatDateDMY(currentPeriod.endDate) : "Session"}
                </span>
              </div>
            </div>

            {/* Security QR Box */}
            <div className="flex flex-col items-center justify-center p-3 bg-surface border border-line rounded-xl text-center shadow-2xs">
              {qrPayload || (allocations.length > 0 && allocations[0].qrPayload) ? (
                <QRCodeSVG
                  value={qrPayload || allocations[0].qrPayload}
                  size={105}
                  level="H"
                  includeMargin={false}
                  className="rounded"
                />
              ) : (
                <div className="w-24 h-24 bg-surface-alt rounded flex items-center justify-center text-xs text-ink-faint">
                  QR Ready
                </div>
              )}
              <span className="text-[9px] font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-1.5 flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" /> HMAC-SHA256 SIGNED
              </span>
            </div>
          </div>

          {/* Examination Venue & Seating Schedule Table */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-primary" /> Examination Timetable & Seating Allocations
              </h3>
              <span className="text-xs font-semibold text-ink-faint">
                Total Papers: {allocations.length}
              </span>
            </div>

            <div className="overflow-x-auto border border-line rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-surface-alt/80 border-b border-line text-ink font-bold text-[11px] uppercase">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-2">Shift / Time</th>
                    <th className="py-2.5 px-3">Subject & Code</th>
                    <th className="py-2.5 px-3">Exam Hall / Venue</th>
                    <th className="py-2.5 px-3">Allocated Seat</th>
                    <th className="py-2.5 px-3 text-right">Verification Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {allocations.map((alloc, idx) => (
                    <tr key={alloc._id || idx} className="hover:bg-surface-alt/30 transition-colors">
                      <td className="py-3 px-3 font-semibold text-ink whitespace-nowrap">
                        {formatDateReadable(alloc.examDate, true)} ({formatDateDMY(alloc.examDate)})
                      </td>
                      <td className="py-3 px-2">
                        <span className="font-bold text-primary block">Shift {alloc.shift}</span>
                        {alloc.startTime && alloc.endTime && (
                          <span className="text-[10px] text-ink-faint">
                            {alloc.startTime} - {alloc.endTime}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-bold text-ink block">{alloc.subjectName}</span>
                        <span className="text-[10px] font-mono text-ink-faint">{alloc.subjectCode}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-bold text-ink block">{alloc.hallCode}</span>
                        <span className="text-[10px] text-ink-faint">{alloc.hallName || "Main Venue"}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md font-mono font-extrabold text-xs bg-primary/10 text-primary border border-primary/30">
                          {alloc.seatNumber}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Badge
                          tone={
                            alloc.attendanceStatus === "present"
                              ? "success"
                              : alloc.attendanceStatus === "absent"
                              ? "danger"
                              : "info"
                          }
                        >
                          {alloc.attendanceStatus === "present"
                            ? "Checked In"
                            : alloc.attendanceStatus === "absent"
                            ? "Absent"
                            : "Scheduled"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Examination Instructions */}
          <div className="p-4 bg-surface-alt/40 border border-line rounded-xl space-y-2 text-[11px] text-ink-faint">
            <h4 className="font-bold text-ink text-xs uppercase tracking-wide flex items-center gap-1.5">
              <FileCheck2 className="w-3.5 h-3.5 text-primary" /> Candidate Instructions & Examination Conduct
            </h4>
            <ul className="list-disc pl-4 space-y-1">
              {instructions.map((ins, idx) => (
                <li key={idx}>{ins}</li>
              ))}
            </ul>
          </div>

          {/* Signatures Strip */}
          <div className="pt-8 grid grid-cols-2 gap-12 text-xs">
            <div className="text-center">
              <div className="border-b border-ink/40 w-48 mx-auto mb-2" />
              <span className="font-semibold text-ink text-xs block">Candidate Signature</span>
              <span className="text-[10px] text-ink-faint">(To be signed in presence of invigilator)</span>
            </div>
            <div className="text-center">
              <div className="border-b border-ink/40 w-48 mx-auto mb-2" />
              <span className="font-semibold text-ink text-xs block">Controller of Examinations</span>
              <span className="text-[10px] text-ink-faint">
                {institution?.name || "Institutional"} Authorized Cryptographic Credential
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentHallTicket;
