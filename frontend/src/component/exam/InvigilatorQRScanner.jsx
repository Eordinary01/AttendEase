import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Scan,
  Camera,
  CameraOff,
  CheckCircle,
  AlertCircle,
  ShieldAlert,
  UserCheck,
  Building,
  Users,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import api from "../../utils/api";
import { logError } from "../../utils/logger";
import Button from "../common/ui/Button";
import Card from "../common/ui/Card";
import Badge from "../common/ui/Badge";
import DashboardHeader from "../common/ui/DashboardHeader";

const InvigilatorQRScanner = () => {
  const [halls, setHalls] = useState([]);
  const [selectedHallId, setSelectedHallId] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [manualToken, setManualToken] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [checkedInList, setCheckedInList] = useState([]);

  const html5QrCodeRef = useRef(null);

  // Load active halls
  useEffect(() => {
    api.get("/exams/seating/halls?isActive=true")
      .then((res) => {
        if (res.data?.success) {
          const list = res.data.data || [];
          setHalls(list);
          if (list.length > 0) {
            setSelectedHallId(list[0]._id);
          }
        }
      })
      .catch((err) => logError("Fetch halls error", err));
  }, []);

  // Fetch checked-in roster for this hall
  const fetchRoster = useCallback(async () => {
    if (!selectedHallId) return;
    try {
      const today = new Date().toISOString().split("T")[0];
      const res = await api.get(`/exams/seating/allocations?hallId=${selectedHallId}&examDate=${today}`);
      if (res.data?.success) {
        setCheckedInList(res.data.data || []);
      }
    } catch (err) {
      logError("Fetch roster error", err);
    }
  }, [selectedHallId]);

  useEffect(() => {
    fetchRoster();
  }, [fetchRoster]);

  const verifyQRCode = useCallback(async (token) => {
    if (!token || verifying) return;
    setVerifying(true);
    setScanResult(null);

    try {
      const res = await api.post("/exams/seating/verify-ticket", {
        qrToken: token.trim(),
        targetHallId: selectedHallId,
        autoCheckIn: true,
      });

      const data = res.data;
      setScanResult({
        type: data.hallMismatch ? "warning" : "success",
        message: data.message,
        allocation: data.data?.allocation,
        student: data.data?.student,
        hallMismatch: data.hallMismatch,
        hallMismatchMessage: data.hallMismatchMessage,
      });

      // Refresh checked-in list
      fetchRoster();
    } catch (err) {
      logError("Verify QR token error", err);
      const isTampered = err.response?.data?.code === "SIGNATURE_MISMATCH";
      setScanResult({
        type: "error",
        isTampered,
        message: err.response?.data?.message || "Failed to verify examination QR code.",
      });
    } finally {
      setVerifying(false);
    }
  }, [selectedHallId, verifying, fetchRoster]);

  // Start Camera QR Scanner
  const startScanner = async () => {
    setIsScanning(true);
    setScanResult(null);

    try {
      const qrRegionId = "qr-reader-container";
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode(qrRegionId);
      }

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      };

      await html5QrCodeRef.current.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          verifyQRCode(decodedText);
        },
        () => {
          // Frame error ignore
        }
      );
    } catch (err) {
      logError("Start camera QR scanner error", err);
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current && isScanning) {
      try {
        await html5QrCodeRef.current.stop();
      } catch (e) {}
    }
    setIsScanning(false);
  };

  // Clean up scanner on unmount
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manualToken) {
      verifyQRCode(manualToken);
    }
  };

  const selectedHall = halls.find((h) => h._id === selectedHallId);
  const presentCount = checkedInList.filter((c) => c.attendanceStatus === "present").length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <DashboardHeader
        greeting="Invigilator Hall Entry QR Scanner"
        meta="1-Tap student Admit Card QR verification, cryptographic integrity validation, and entrance check-in"
      />

      {/* Duty Venue Selector & KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Venue Select */}
        <Card padding="md" className="space-y-2 border-line">
          <label className="block text-xs font-semibold text-ink flex items-center gap-1.5">
            <Building className="w-3.5 h-3.5 text-primary" /> Active Duty Examination Hall
          </label>
          <select
            value={selectedHallId}
            onChange={(e) => setSelectedHallId(e.target.value)}
            className="w-full text-xs bg-surface border border-line rounded-lg px-3 py-2 text-ink font-semibold focus:outline-none focus:border-primary"
          >
            {halls.map((h) => (
              <option key={h._id} value={h._id}>
                {h.hallCode} — {h.name} ({h.capacity} Seats)
              </option>
            ))}
          </select>
          <span className="text-[11px] text-ink-faint block">
            {selectedHall?.building} • {selectedHall?.floor}
          </span>
        </Card>

        {/* Checked-In Stats */}
        <Card padding="md" className="flex items-center justify-between border-line">
          <div>
            <span className="text-xs text-ink-faint font-medium">Checked-In Candidates</span>
            <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {presentCount} / {checkedInList.length}
            </div>
            <span className="text-[11px] text-ink-faint">
              {checkedInList.length > 0
                ? `${Math.round((presentCount / checkedInList.length) * 100)}% Room Attendance`
                : "No candidates assigned"}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
            <UserCheck className="w-6 h-6" />
          </div>
        </Card>

        {/* Security Badge */}
        <Card padding="md" className="flex items-center justify-between border-line">
          <div>
            <span className="text-xs text-ink-faint font-medium">Verification Engine</span>
            <div className="text-sm font-bold text-ink mt-0.5 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-primary" /> HMAC-SHA256
            </div>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              Anti-Tamper Active
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Sparkles className="w-6 h-6" />
          </div>
        </Card>
      </div>

      {/* Main Scanner Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Camera Feed */}
        <Card padding="lg" className="space-y-4 border-line">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-ink flex items-center gap-2">
              <Camera className="w-4 h-4 text-primary" /> Live QR Camera Feed
            </h3>
            {isScanning && (
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Scanner Active
              </span>
            )}
          </div>

          {/* Scanner Viewport */}
          <div className="relative rounded-xl overflow-hidden bg-neutral-900 aspect-square flex flex-col items-center justify-center border border-line">
            <div id="qr-reader-container" className="w-full h-full" />
            {!isScanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70 space-y-2 p-6 text-center bg-neutral-900">
                <Scan className="w-12 h-12 opacity-50 mb-1" />
                <p className="text-sm font-semibold">Camera is idle</p>
                <p className="text-xs text-white/50 max-w-xs">
                  Click "Start Camera Scanner" below to begin verifying student Admit Cards at the exam hall entrance.
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {!isScanning ? (
              <Button
                onClick={startScanner}
                className="w-full py-2.5 bg-primary text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm hover:bg-primary-dark transition"
              >
                <Camera className="w-4 h-4" /> Start Camera Scanner
              </Button>
            ) : (
              <Button
                onClick={stopScanner}
                className="w-full py-2.5 bg-red-600 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm hover:bg-red-700 transition"
              >
                <CameraOff className="w-4 h-4" /> Stop Scanner
              </Button>
            )}
          </div>

          {/* Manual Token Fallback */}
          <form onSubmit={handleManualSubmit} className="pt-2 border-t border-line/60 space-y-2">
            <label className="block text-[11px] font-semibold text-ink-faint">
              Manual QR Token String Fallback
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Paste QR payload token..."
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                className="flex-1 text-xs bg-surface border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:border-primary font-mono text-[11px]"
              />
              <Button
                type="submit"
                disabled={!manualToken || verifying}
                variant="outline"
                className="text-xs px-3 py-2 whitespace-nowrap"
              >
                Verify
              </Button>
            </div>
          </form>
        </Card>

        {/* Right: Scan Verification Result Card */}
        <div className="space-y-4">
          {verifying ? (
            <Card padding="lg" className="text-center py-16 space-y-3 animate-pulse border-line">
              <Sparkles className="w-10 h-10 mx-auto text-primary animate-spin" />
              <h4 className="font-bold text-sm text-ink">Verifying Cryptographic HMAC Signature...</h4>
            </Card>
          ) : scanResult ? (
            <Card
              padding="lg"
              className={`space-y-4 border-2 ${
                scanResult.type === "success"
                  ? "bg-emerald-500/[0.03] border-emerald-500/40"
                  : scanResult.type === "warning"
                  ? "bg-amber-500/[0.03] border-amber-500/40"
                  : "bg-red-500/[0.03] border-red-500/40"
              }`}
            >
              {/* Result Status Banner */}
              <div
                className={`p-3.5 rounded-xl text-xs font-bold flex items-center gap-2.5 ${
                  scanResult.type === "success"
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : scanResult.type === "warning"
                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                    : "bg-red-500/10 text-red-700 dark:text-red-300"
                }`}
              >
                {scanResult.type === "success" ? (
                  <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-600" />
                ) : scanResult.type === "warning" ? (
                  <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-600" />
                ) : (
                  <ShieldAlert className="w-5 h-5 flex-shrink-0 text-red-600" />
                )}
                <span>{scanResult.message}</span>
              </div>

              {/* Verified Candidate Profile Card */}
              {scanResult.allocation && (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center gap-4">
                    {scanResult.student?.avatar ? (
                      <img
                        src={scanResult.student.avatar}
                        alt={scanResult.allocation.studentName}
                        className="w-16 h-16 rounded-xl object-cover border-2 border-primary shadow-sm"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-primary/10 border-2 border-primary flex items-center justify-center text-primary font-bold text-xl">
                        {scanResult.allocation.studentName?.charAt(0) || "S"}
                      </div>
                    )}
                    <div>
                      <h4 className="text-base font-bold text-ink">
                        {scanResult.allocation.studentName}
                      </h4>
                      <p className="font-mono text-xs font-semibold text-primary">
                        Roll No: {scanResult.allocation.studentRollNo || "No Roll"}
                      </p>
                      <p className="text-xs text-ink-faint">
                        {scanResult.allocation.branch || "Candidate"} • Section {scanResult.allocation.section || "A"}
                      </p>
                    </div>
                  </div>

                  {/* Seat Allocation Callout */}
                  <div className="p-3.5 bg-surface border border-line rounded-xl grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-ink-faint block text-[11px]">Assigned Seat</span>
                      <span className="font-mono font-extrabold text-primary text-base">
                        {scanResult.allocation.seatNumber}
                      </span>
                    </div>
                    <div>
                      <span className="text-ink-faint block text-[11px]">Venue Hall</span>
                      <span className="font-bold text-ink">
                        {scanResult.allocation.hallCode} ({scanResult.allocation.hallName || "Main Venue"})
                      </span>
                    </div>
                    <div>
                      <span className="text-ink-faint block text-[11px]">Subject</span>
                      <span className="font-semibold text-ink truncate block">
                        {scanResult.allocation.subjectName}
                      </span>
                    </div>
                    <div>
                      <span className="text-ink-faint block text-[11px]">Check-In Status</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        ✓ Present (Gate Verified)
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          ) : (
            <Card padding="lg" className="text-center py-16 text-ink-faint space-y-2 border-line">
              <Scan className="w-10 h-10 mx-auto text-ink-soft opacity-30" />
              <p className="font-semibold text-ink text-sm">Waiting for Scan...</p>
              <p className="text-xs max-w-xs mx-auto">
                Position the student's Admit Card QR code in front of the camera to verify identity.
              </p>
            </Card>
          )}

          {/* Room Live Checked-in List */}
          <Card padding="md" className="space-y-3 border-line">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-ink flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-primary" /> Hall Candidate Roster ({checkedInList.length})
              </span>
              <span className="text-emerald-600 font-semibold text-[11px]">
                {presentCount} Present
              </span>
            </div>

            <div className="max-h-48 overflow-y-auto divide-y divide-line text-xs">
              {checkedInList.length === 0 ? (
                <div className="text-center py-4 text-ink-faint text-[11px]">
                  No candidates allocated to this hall for today.
                </div>
              ) : (
                checkedInList.map((item) => (
                  <div key={item._id} className="py-2 flex items-center justify-between gap-2">
                    <div className="truncate">
                      <span className="font-bold text-ink block truncate">{item.studentName}</span>
                      <span className="text-[10px] font-mono text-ink-faint">
                        {item.studentRollNo} • Seat {item.seatNumber}
                      </span>
                    </div>
                    <Badge variant={item.attendanceStatus === "present" ? "success" : "neutral"}>
                      {item.attendanceStatus === "present" ? "Present" : "Pending"}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default InvigilatorQRScanner;
