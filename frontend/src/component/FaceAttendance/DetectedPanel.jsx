// src/component/FaceAttendance/DetectedPanel.jsx
import React, { useState } from "react";
import {
  CheckCircle2,
  UserCheck,
  Clock,
  Zap,
  ShieldAlert,
  Sparkles,
  Search,
  UserPlus,
  ChevronDown,
  X,
  AlertTriangle,
  Eye,
} from "lucide-react";
import "./faceAttendance.css";

export default function DetectedPanel({
  detected = [],
  markedIds = new Set(),
  autoMark = true,
  countdowns = {},
  unauthorizedCooldowns = {},
  roster = [],
  onQuickMark,
  onOpenQuickEnroll,
}) {
  const [manualPickerIndex, setManualPickerIndex] = useState(null);
  const [manualSearch, setManualSearch] = useState("");

  const unique = [];
  const seen = new Set();
  for (const d of detected) {
    const key = d.studentId || d.name;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(d);
  }

  if (unique.length === 0) {
    return (
      <div className="p-4 rounded-2xl bg-surface-alt/40 border border-line/60 text-center text-ink-soft">
        <div className="flex items-center justify-center gap-2 text-xs font-bold">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span>No faces currently detected in camera frame</span>
        </div>
        <p className="text-[11px] opacity-75 mt-0.5">
          Align faces within the camera to begin instant biometric verification
        </p>
      </div>
    );
  }

  // Filter roster for inline manual marker dropdown
  const filteredRoster = roster.filter((s) => {
    const sId = String(s._id || s.id || s.studentId || "");
    if (markedIds && markedIds.has(sId)) return false; // Hide already marked
    if (!manualSearch) return true;
    const q = manualSearch.toLowerCase().trim();
    const nameMatch = (s.name || `${s.firstName || ""} ${s.lastName || ""}`).toLowerCase().includes(q);
    const rollMatch = (s.rollNo || s.enrollmentNumber || "").toLowerCase().includes(q);
    return nameMatch || rollMatch;
  });

  return (
    <div className="det-panel space-y-2.5">
      <div className="flex items-center justify-between px-1 text-[11px] font-bold text-ink-soft uppercase tracking-wider">
        <span className="flex items-center gap-1.5 text-ink">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Live On-Screen Faces ({unique.length})
        </span>
        <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
          {autoMark ? (
            <>
              <Zap className="w-3 h-3 text-emerald-500 fill-emerald-500" />
              <span>Multi-Frame Auto-Mark Active</span>
            </>
          ) : (
            <span>Manual Click Mode</span>
          )}
        </span>
      </div>

      {unique.map((d, i) => {
        const studentIdStr = String(d.studentId || "");
        const isMarked = (studentIdStr && markedIds?.has(studentIdStr)) || d.status === "already_marked";
        const isVerified = d.status === "verified";
        const isUnrecognized = d.status === "unrecognized";

        const candidate = d.closestCandidate;
        const isBorderline = isUnrecognized && candidate && candidate.isBorderline;
        const isCandidateMarked = candidate && markedIds && markedIds.has(String(candidate.studentId));

        const isBlinkDetected = Boolean(d.displayName && d.displayName.includes("Blink detected"));
        const isBlinkPending = Boolean(d.displayName && d.displayName.includes("Blink to verify"));

        // Countdown info for this student
        const countdownInfo = countdowns[studentIdStr];
        const remainingSec = typeof countdownInfo === "object" ? (countdownInfo?.remainingSec ?? 5) : (countdownInfo ?? 5);
        const progressPercent = Math.max(0, Math.min(100, ((5 - remainingSec) / 5) * 100));

        // Cooldown info for unauthorized face
        const cooldownRemaining = unauthorizedCooldowns[d.trackKey || d.name || i] || 0;

        const isPickerOpen = manualPickerIndex === i;

        return (
          <div
            key={`${d.studentId || d.name}-${i}`}
            className={`det-item rounded-2xl transition-all shadow-sm overflow-hidden ${
              isMarked
                ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-950 dark:text-emerald-100"
                : isVerified
                ? "bg-primary/5 border border-primary/25 text-ink"
                : isBorderline
                ? "bg-amber-500/10 border border-amber-500/35 text-ink"
                : isBlinkDetected
                ? "bg-amber-500/10 border border-amber-500/35 text-ink"
                : isBlinkPending
                ? "bg-sky-500/10 border border-sky-500/30 text-ink"
                : isUnrecognized
                ? "bg-rose-500/10 border border-rose-500/25 text-ink"
                : "bg-surface border border-line text-ink"
            }`}
          >
            {/* Active Countdown Progress Bar for Verified Faces */}
            {isVerified && !isMarked && autoMark && (
              <div className="countdown-bar-container">
                <div
                  className="countdown-bar-fill"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            )}

            <div className="flex items-center justify-between gap-3 p-3">
              {/* Left Identity & Icon */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                    isMarked || isVerified
                      ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                      : isBorderline || isBlinkDetected
                      ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                      : isBlinkPending
                      ? "bg-sky-500/20 text-sky-600 dark:text-sky-400"
                      : isUnrecognized
                      ? "bg-rose-500/20 text-rose-500"
                      : "bg-cyan-500/20 text-cyan-600 dark:text-cyan-400"
                  }`}
                >
                  {isMarked ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  ) : isVerified ? (
                    <UserCheck className="w-5 h-5 text-primary" />
                  ) : isBorderline ? (
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                  ) : isBlinkDetected ? (
                    <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
                  ) : isBlinkPending ? (
                    <Eye className="w-5 h-5 text-sky-500 animate-pulse" />
                  ) : isUnrecognized ? (
                    <ShieldAlert className="w-5 h-5 text-rose-500" />
                  ) : (
                    <Clock className="w-4 h-4 text-cyan-500 animate-spin" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  {/* Name + Roll No Heading */}
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="font-extrabold text-ink text-xs truncate">
                      {isBorderline
                        ? `Likely: ${candidate.name}`
                        : isUnrecognized
                        ? "Unrecognized / Not in Roster"
                        : d.name}
                    </span>
                    {(d.rollNo || (isBorderline && candidate.rollNo)) && (
                      <span className="text-[11px] text-ink-soft shrink-0 font-medium">
                        ({d.rollNo || candidate.rollNo})
                      </span>
                    )}
                  </div>

                  {/* Dynamic Status Subtitle */}
                  <div className="text-[11px] text-ink-soft mt-0.5 truncate flex items-center gap-1.5 flex-wrap">
                    {isMarked ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Attendance Marked Present
                      </span>
                    ) : isVerified ? (
                      autoMark ? (
                        <span className="text-primary font-semibold flex items-center gap-1">
                          <Clock className="w-3 h-3 animate-spin" /> Auto-marking in {remainingSec}s...
                        </span>
                      ) : (
                        <span className="text-ink-soft">
                          Match Confidence: {Math.round((d.confidence || 0.95) * 100)}%
                        </span>
                      )
                    ) : isBorderline ? (
                      <span className="text-amber-700 dark:text-amber-300 font-medium flex items-center gap-1">
                        Borderline Match (D = {candidate.distance}) · Lighting/Angle shift
                      </span>
                    ) : isBlinkDetected ? (
                      <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-500 animate-pulse" /> Blink detected — Verifying...
                      </span>
                    ) : isBlinkPending ? (
                      <span className="text-sky-600 dark:text-sky-400 font-medium flex items-center gap-1">
                        <Eye className="w-3 h-3 text-sky-500" /> Identity confirmed — Blink eyes to verify
                      </span>
                    ) : isUnrecognized ? (
                      cooldownRemaining > 0 ? (
                        <span className="text-rose-500 dark:text-rose-400 font-medium">
                          Out-of-Roster Face · Cooldown {cooldownRemaining}s
                        </span>
                      ) : (
                        <span className="text-rose-500 font-medium">
                          No matching student profile in this active section
                        </span>
                      )
                    ) : (
                      <span>Analyzing multi-frame consensus...</span>
                    )}

                    {/* Quality Badges */}
                    {d.quality && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-surface-alt/70 border border-line rounded-md text-[9px] text-ink-soft font-mono">
                        <span>{d.quality.qualityHint}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons Right Side */}
              <div className="shrink-0 flex items-center gap-2">
                {isMarked ? (
                  <span className="px-3 py-1 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-extrabold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Present
                  </span>
                ) : isVerified ? (
                  <div className="flex items-center gap-1.5">
                    {autoMark && (
                      <div className="countdown-chip">
                        <Clock className="w-3 h-3 animate-spin" />
                        <span>{remainingSec}s</span>
                      </div>
                    )}
                    {onQuickMark && d.studentId && (
                      <button
                        type="button"
                        onClick={() => onQuickMark(d.studentId)}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl text-xs transition shadow-sm hover:scale-105 flex items-center gap-1 cursor-pointer"
                      >
                        <Zap className="w-3 h-3" /> Mark Now
                      </button>
                    )}
                  </div>
                ) : isBorderline && !isCandidateMarked ? (
                  <button
                    type="button"
                    onClick={() => onQuickMark && onQuickMark(candidate.studentId)}
                    className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold rounded-xl text-xs transition shadow-sm shadow-emerald-500/20 hover:scale-102 flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Confirm Present
                  </button>
                ) : isUnrecognized ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setManualPickerIndex(isPickerOpen ? null : i)}
                      className="px-2.5 py-1 bg-surface hover:bg-surface-alt border border-line hover:border-primary/40 rounded-xl text-[11px] font-bold text-ink transition flex items-center gap-1 cursor-pointer"
                    >
                      <Search className="w-3 h-3 text-primary" />
                      <span>{isPickerOpen ? "Close" : "Mark Manual"}</span>
                      <ChevronDown className={`w-3 h-3 transition-transform ${isPickerOpen ? "rotate-180" : ""}`} />
                    </button>
                    {onOpenQuickEnroll && (
                      <button
                        type="button"
                        onClick={onOpenQuickEnroll}
                        className="p-1.5 bg-surface-alt hover:bg-surface border border-line hover:border-primary/40 rounded-xl text-ink-soft hover:text-primary transition cursor-pointer"
                        title="Enroll this student face"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ) : (
                  <span className="px-2 py-0.5 bg-surface-alt border border-line rounded-lg text-[10px] text-ink-soft">
                    Scanning
                  </span>
                )}
              </div>
            </div>

            {/* Inline Manual Roster Search Dropdown */}
            {isPickerOpen && (
              <div className="p-3 bg-surface-alt/80 border-t border-line/60 space-y-2 animate-in fade-in slide-in-from-top-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-ink-soft">
                  <span>Select student from section roster:</span>
                  <span className="text-[10px] opacity-75">{filteredRoster.length} remaining unmarked</span>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft" />
                  <input
                    type="text"
                    value={manualSearch}
                    onChange={(e) => setManualSearch(e.target.value)}
                    placeholder="Search by student name or roll no..."
                    className="w-full pl-8 pr-3 py-1.5 bg-surface border border-line rounded-xl text-xs text-ink focus:outline-none focus:ring-1 focus:ring-primary"
                    autoFocus
                  />
                  {manualSearch && (
                    <button
                      type="button"
                      onClick={() => setManualSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-soft hover:text-ink"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="max-h-36 overflow-y-auto space-y-1 pt-1">
                  {filteredRoster.length === 0 ? (
                    <p className="text-center py-2 text-[11px] text-ink-soft">
                      No matching unmarked students found
                    </p>
                  ) : (
                    filteredRoster.map((student) => {
                      const sId = String(student._id || student.id || student.studentId || "");
                      return (
                        <div
                          key={sId}
                          onClick={() => {
                            if (onQuickMark) onQuickMark(sId);
                            setManualPickerIndex(null);
                            setManualSearch("");
                          }}
                          className="flex items-center justify-between p-2 rounded-xl bg-surface hover:bg-primary/10 border border-line hover:border-primary/30 transition cursor-pointer text-xs"
                        >
                          <div className="truncate">
                            <span className="font-bold text-ink">{student.name}</span>
                            {student.rollNo && (
                              <span className="text-ink-soft text-[10px] ml-1">({student.rollNo})</span>
                            )}
                          </div>
                          <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                            Mark Present
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
