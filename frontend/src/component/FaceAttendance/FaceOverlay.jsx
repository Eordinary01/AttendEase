// src/component/FaceAttendance/FaceOverlay.jsx
import React from "react";
import { ShieldCheck, AlertTriangle, CheckCircle, Eye, ArrowLeft, ArrowRight, Scan, Users, Clock, Sparkles } from "lucide-react";
import "./faceAttendance.css";

// Reusable Token-Driven HUD Reticle Corner Brackets
function ReticleCorners({ status = "neutral" }) {
  const cornerColor =
    status === "verified"
      ? "border-emerald-400"
      : status === "borderline"
      ? "border-amber-400"
      : status === "unrecognized"
      ? "border-rose-400"
      : status === "challenge"
      ? "border-amber-400"
      : "border-white/40";

  return (
    <>
      <div className={`absolute -top-px -left-px w-4 h-4 border-t-[3px] border-l-[3px] rounded-tl-xl pointer-events-none ${cornerColor}`} />
      <div className={`absolute -top-px -right-px w-4 h-4 border-t-[3px] border-r-[3px] rounded-tr-xl pointer-events-none ${cornerColor}`} />
      <div className={`absolute -bottom-px -left-px w-4 h-4 border-b-[3px] border-l-[3px] rounded-bl-xl pointer-events-none ${cornerColor}`} />
      <div className={`absolute -bottom-px -right-px w-4 h-4 border-b-[3px] border-r-[3px] rounded-br-xl pointer-events-none ${cornerColor}`} />
    </>
  );
}

export default function FaceOverlay({
  detected = [],
  fps = 0,
  isLive = false,
  livenessScore = 0,
  challengeInstruction = "",
  challengeStep = "verified",
  showFlash = false,
  activeSection = "A",
  autoMark = true,
  countdowns = {},
  unauthorizedCooldowns = {},
}) {
  const hasFace = detected.length > 0;
  const verifiedList = detected.filter((d) => d.status === "verified");
  const alreadyMarkedList = detected.filter((d) => d.status === "already_marked");
  const unrecognizedList = detected.filter((d) => d.status === "unrecognized");

  const verifiedCount = verifiedList.length;
  const alreadyMarkedCount = alreadyMarkedList.length;
  const unrecognizedCount = unrecognizedList.length;

  const isMultiFace = detected.length > 1;

  // Find shortest active countdown among verified faces
  let minCountdown = 5;
  if (verifiedCount > 0 && autoMark) {
    for (const v of verifiedList) {
      const sId = String(v.studentId || "");
      const cd = countdowns[sId];
      const cdVal = typeof cd === "object" ? cd?.remainingSec : cd;
      if (cdVal !== undefined) {
        minCountdown = Math.min(minCountdown, cdVal);
      }
    }
  }

  // Viewfinder status styling
  let boxStateClass = "neutral";
  let statusText = "Align face within the camera frame";
  let icon = null;

  if (hasFace) {
    if (isMultiFace) {
      if (verifiedCount > 0) {
        boxStateClass = "verified";
        statusText = autoMark
          ? `✓ ${verifiedCount} Student${verifiedCount > 1 ? "s" : ""} Verified · Auto-marking in ${minCountdown}s...`
          : `✓ ${verifiedCount} Student${verifiedCount > 1 ? "s" : ""} Verified (${verifiedList.map((v) => v.name).join(", ")})`;
        icon = autoMark ? <Clock className="w-3.5 h-3.5 text-emerald-400 animate-spin" /> : <Users className="w-3.5 h-3.5 text-emerald-400" />;
      } else if (alreadyMarkedCount > 0) {
        boxStateClass = "verified";
        statusText = `✓ ${alreadyMarkedCount} Student${alreadyMarkedCount > 1 ? "s" : ""} Already Marked`;
        icon = <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />;
      } else {
        boxStateClass = unrecognizedCount > 0 ? "unrecognized" : "checking";
        statusText =
          unrecognizedCount > 0
            ? `✖ ${unrecognizedCount} Unrecognized Face${unrecognizedCount > 1 ? "s" : ""} (Check Panel Below)`
            : `Scanning ${detected.length} Faces...`;
        icon = unrecognizedCount > 0 ? <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> : <Scan className="w-3.5 h-3.5 text-primary" />;
      }
    } else {
      // Single face
      const single = detected[0];
      const sId = String(single.studentId || "");
      const cdSingle = countdowns[sId];
      const singleCountdown = typeof cdSingle === "object" ? (cdSingle?.remainingSec ?? 5) : (cdSingle ?? 5);
      const isBorderline = single.status === "unrecognized" && single.closestCandidate?.isBorderline;
      const qualityHint = single.quality?.qualityHint;

      if (single.status === "already_marked") {
        boxStateClass = "verified";
        statusText = `✓ Attendance already marked for ${single.name}`;
        icon = <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />;
      } else if (single.status === "verified") {
        boxStateClass = "verified";
        statusText = autoMark
          ? `✓ Verified: ${single.name} · Auto-marking in ${singleCountdown}s`
          : `✓ Verified: ${single.name} (${Math.round((single.confidence || 0.95) * 100)}%)`;
        icon = autoMark ? <Clock className="w-3.5 h-3.5 text-emerald-400 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />;
      } else if (isBorderline) {
        boxStateClass = "borderline";
        statusText = `Likely: ${single.closestCandidate.name} · Confirm attendance in panel below`;
        icon = <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
      } else if (single.status === "unrecognized") {
        const cdRem = unauthorizedCooldowns[single.trackKey || single.name || 0] || 0;
        boxStateClass = "unrecognized";
        statusText = cdRem > 0
          ? `✖ Out-of-Roster Student · Cooldown (${cdRem}s)`
          : `✖ Unrecognized Face (Not enrolled in Sec ${activeSection})`;
        icon = <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />;
      } else if (challengeStep && challengeStep !== "verified") {
        boxStateClass = "challenge";
        statusText = challengeInstruction;
        if (challengeStep === "turn_left") icon = <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />;
        else if (challengeStep === "turn_right") icon = <ArrowRight className="w-3.5 h-3.5 text-amber-400" />;
        else if (challengeStep === "blink") icon = <Eye className="w-3.5 h-3.5 text-amber-400" />;
      } else if (single.displayName && single.displayName.includes("Blink detected")) {
        boxStateClass = "challenge";
        statusText = single.displayName;
        icon = <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />;
      } else if (single.displayName && single.displayName.includes("Blink to verify")) {
        boxStateClass = "challenge";
        statusText = single.displayName;
        icon = <Eye className="w-3.5 h-3.5 text-sky-400 animate-pulse" />;
      } else {
        boxStateClass = "checking";
        statusText = qualityHint && qualityHint !== "Good Quality"
          ? `${qualityHint} · Scanning Multi-Frame...`
          : "Scanning Face & Matching Biometrics...";
        icon = <ShieldCheck className="w-3.5 h-3.5 text-primary" />;
      }
    }
  }

  // Top Status Badge Text
  let topBadgeText = "SEARCHING";
  let topBadgeClass = "neutral";

  if (hasFace) {
    if (isMultiFace) {
      topBadgeText = verifiedCount > 0 && autoMark
        ? `MULTI-FACE: ${verifiedCount} READY (AUTO-MARK IN ${minCountdown}s)`
        : `MULTI-FACE: ${detected.length} DETECTED (${verifiedCount} READY)`;
      topBadgeClass = verifiedCount > 0 ? "live" : "detecting";
    } else if (alreadyMarkedCount > 0) {
      topBadgeText = "ALREADY MARKED";
      topBadgeClass = "live";
    } else if (verifiedCount > 0) {
      const sId = String(detected[0]?.studentId || "");
      const singleCountdown = countdowns[sId]?.remainingSec ?? 5;
      topBadgeText = autoMark
        ? `VERIFIED · MARKING IN ${singleCountdown}s`
        : `LIVE (${Math.round((detected[0]?.confidence || 0.95) * 100)}%)`;
      topBadgeClass = "live";
    } else if (detected[0]?.status === "unrecognized" && detected[0]?.closestCandidate?.isBorderline) {
      topBadgeText = `BORDERLINE MATCH`;
      topBadgeClass = "challenge";
    } else if (detected[0]?.status === "scanning") {
      topBadgeText = detected[0]?.displayName?.includes("Blink detected")
        ? "BLINK VERIFIED"
        : detected[0]?.displayName?.includes("Blink to verify")
        ? "AWAITING BLINK"
        : "CONSENSUS SCAN...";
      topBadgeClass = detected[0]?.displayName?.includes("Blink detected") ? "challenge" : "detecting";
    } else if (challengeStep && challengeStep !== "verified") {
      topBadgeText = `CHALLENGE (${livenessScore || 50}%)`;
      topBadgeClass = "challenge";
    } else {
      topBadgeText = "CONSENSUS SCAN...";
      topBadgeClass = "detecting";
    }
  }

  return (
    <>
      {showFlash && <div className="am-flash" />}

      {/* Cyber Grid Texture */}
      <div className="cam-grid-overlay" />

      {/* High-Tech Top HUD Status Bar */}
      <div className="hud-top-bar">
        <div className={`hud-pill ${topBadgeClass}`}>
          <span className="pulse-live-dot" />
          <span>{topBadgeText}</span>
        </div>
        <div className="flex items-center gap-2">
          {detected.length > 0 && (
            <div className="px-2.5 py-1 bg-black/60 backdrop-blur-md text-white/90 text-[11px] font-bold rounded-lg border border-white/10 flex items-center gap-1.5 shadow-sm">
              <Users className="w-3.5 h-3.5 text-cyan-400" />
              <span>
                {detected.length} Face{detected.length > 1 ? "s" : ""}
              </span>
            </div>
          )}
          <div className="hud-fps">{fps} FPS</div>
        </div>
      </div>

      {/* Center Face Reticle (Only when 0 or 1 face is in frame for alignment guidance) */}
      {!isMultiFace && (
        <div className={`face-viewfinder ${boxStateClass} relative`}>
          <ReticleCorners status={boxStateClass} />
        </div>
      )}

      {/* Guidance Instruction Below Frame */}
      <div className={`viewfinder-guide-text ${boxStateClass}`}>
        {icon}
        <span>{statusText}</span>
      </div>

      {/* Bottom Liveness Progress Indicator */}
      <div className="liveness-bar-container">
        <div
          className="liveness-bar"
          style={{
            width: isLive ? `${Math.max(35, livenessScore || 95)}%` : hasFace ? "50%" : "0%",
            backgroundColor: hasFace && detected.some((d) => d.livenessPassed === false)
              ? "#f59e0b"
              : undefined,
          }}
        />
      </div>
    </>
  );
}
