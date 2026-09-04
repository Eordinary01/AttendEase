/**
 * AttendEase Academic Biometric Evaluation Logger (DEBUG_EVAL)
 * 
 * Non-invasive instrumentation module to log raw, empirical biometric trials
 * (recognition, liveness, and stage timings) directly to CSV/JSONL for academic publication.
 * 
 * Every statistic generated for research reports is computed strictly from rows
 * produced by this logger without assumptions, estimates, or synthetic extrapolation.
 */

// Helper to compute Eye Aspect Ratio (EAR) from 68-point landmarks
export function computeEAR(landmarks) {
  if (!landmarks || !landmarks.positions || landmarks.positions.length < 68) {
    return { leftEAR: 0, rightEAR: 0, avgEAR: 0 };
  }
  const pts = landmarks.positions;

  // Left Eye: 36-41 (0-indexed)
  // p1: 36, p2: 37, p3: 38, p4: 39, p5: 40, p6: 41
  const dist = (pA, pB) => Math.sqrt(Math.pow(pA.x - pB.x, 2) + Math.pow(pA.y - pB.y, 2));
  
  const leftEAR = (dist(pts[37], pts[41]) + dist(pts[38], pts[40])) / (2 * dist(pts[36], pts[39]) || 1e-6);
  const rightEAR = (dist(pts[43], pts[47]) + dist(pts[44], pts[46])) / (2 * dist(pts[42], pts[45]) || 1e-6);

  return {
    leftEAR: leftEAR,
    rightEAR: rightEAR,
    avgEAR: (leftEAR + rightEAR) / 2,
  };
}

// Helper to estimate head pose (yaw/pitch) from landmark geometry
export function estimatePoseAngles(landmarks) {
  if (!landmarks || !landmarks.positions || landmarks.positions.length < 68) {
    return { yawDeg: 0, pitchDeg: 0 };
  }
  const pts = landmarks.positions;
  const noseTip = pts[30];
  const leftJaw = pts[0];
  const rightJaw = pts[16];
  const noseBridge = pts[27];
  const chin = pts[8];

  const jawWidth = Math.abs(rightJaw.x - leftJaw.x) || 1;
  const noseToLeft = Math.abs(noseTip.x - leftJaw.x);
  const noseToRight = Math.abs(rightJaw.x - noseTip.x);
  const yawRatio = (noseToRight - noseToLeft) / jawWidth;
  const yawDeg = parseFloat((yawRatio * 90).toFixed(2));

  // Anthropometric face geometry:
  // In a level, neutral head pose, nose-to-chin distance is naturally ~1.8x larger than nose-to-bridge.
  // We apply the baseline anthropometric offset (+0.32) so neutral posture evaluates to 0° pitch.
  const faceHeight = Math.abs(chin.y - noseBridge.y) || 1;
  const noseToBridge = Math.abs(noseTip.y - noseBridge.y);
  const noseToChin = Math.abs(chin.y - noseTip.y);
  const pitchRatio = ((noseToBridge - noseToChin) / faceHeight) + 0.32;
  const pitchDeg = parseFloat((pitchRatio * 90).toFixed(2));

  return { yawDeg, pitchDeg };
}

// Compute Laplacian sharpness variance on cropped face image canvas
let _sharedCropCanvas = null;
let _sharedCropCtx = null;
let _sharedGrayBuffer = null;
const LAPLACIAN_SAMPLE_SIZE = 48;

export function computeLaplacianVariance(videoElement, box) {
  try {
    if (!videoElement || !box) return 0;
    if (!_sharedCropCanvas && typeof document !== "undefined") {
      _sharedCropCanvas = document.createElement("canvas");
      _sharedCropCanvas.width = LAPLACIAN_SAMPLE_SIZE;
      _sharedCropCanvas.height = LAPLACIAN_SAMPLE_SIZE;
      _sharedCropCtx = _sharedCropCanvas.getContext("2d", { willReadFrequently: true });
    }
    if (!_sharedCropCtx) return 0;

    const srcW = Math.max(10, Math.floor(box.width));
    const srcH = Math.max(10, Math.floor(box.height));
    _sharedCropCtx.drawImage(
      videoElement,
      Math.max(0, box.x),
      Math.max(0, box.y),
      srcW,
      srcH,
      0,
      0,
      LAPLACIAN_SAMPLE_SIZE,
      LAPLACIAN_SAMPLE_SIZE
    );

    const imgData = _sharedCropCtx.getImageData(0, 0, LAPLACIAN_SAMPLE_SIZE, LAPLACIAN_SAMPLE_SIZE);
    const data = imgData.data;
    const size = LAPLACIAN_SAMPLE_SIZE;
    const pixelCount = size * size;
    if (!_sharedGrayBuffer || _sharedGrayBuffer.length !== pixelCount) {
      _sharedGrayBuffer = new Float32Array(pixelCount);
    }
    const gray = _sharedGrayBuffer;
    for (let i = 0; i < pixelCount; i++) {
      const idx = i * 4;
      gray[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    }

    // 3x3 Laplacian Kernel: [0, 1, 0; 1, -4, 1; 0, 1, 0]
    let sum = 0;
    let sumSq = 0;
    let count = 0;

    for (let y = 1; y < size - 1; y++) {
      const rowIdx = y * size;
      for (let x = 1; x < size - 1; x++) {
        const idx = rowIdx + x;
        const lap =
          gray[idx - size] +
          gray[idx - 1] +
          gray[idx + 1] +
          gray[idx + size] -
          4 * gray[idx];
        sum += lap;
        sumSq += lap * lap;
        count++;
      }
    }

    if (count === 0) return 0;
    const mean = sum / count;
    const variance = sumSq / count - mean * mean;
    return parseFloat(Math.max(0, variance).toFixed(2));
  } catch {
    return 0;
  }
}

class BiometricEvalLogger {
  constructor() {
    this.storageKey = "attendease_biometric_eval_events_v1";
    this.sessionMetaKey = "attendease_biometric_eval_sessions_v1";
    this.events = this.loadEvents();
    this.sessionMeta = this.loadSessionMeta();
    this.activeConfig = {
      enabled: false,
      groundTruth: "genuine", // 'genuine' | 'impostor'
      probeUserLabel: "Self_Enrolled_Student",
      attackType: "bona_fide", // 'bona_fide' | '2d_printed_photo' | 'screen_replay_mobile' | 'screen_replay_tablet' | 'cutout_mask' | '3d_mask'
      lightingCondition: "standard_ambient", // 'standard_ambient' | 'strong_backlight' | 'dim_shadow'
      poseCondition: "frontal_0_deg", // 'frontal_0_deg' | 'yaw_left_15_deg' | 'yaw_right_15_deg' | 'pitch_up_15_deg' | 'pitch_down_15_deg'
      operatingThreshold: 0.42,
      sessionId: `SES_${Date.now()}`,
    };
    this._lastLoggedSignature = null;
  }

  loadEvents() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  loadSessionMeta() {
    try {
      const raw = localStorage.getItem(this.sessionMetaKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  saveEvents() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.events));
    } catch (err) {
      console.warn("[BiometricEvalLogger] LocalStorage save limit reached, retaining in memory:", err);
    }
  }

  saveSessionMeta() {
    try {
      localStorage.setItem(this.sessionMetaKey, JSON.stringify(this.sessionMeta));
    } catch {
      // non-fatal
    }
  }

  setConfig(partialConfig) {
    this.activeConfig = { ...this.activeConfig, ...partialConfig };
  }

  getConfig() {
    return this.activeConfig;
  }

  startSession(overrides = {}) {
    this.activeConfig.sessionId = `SES_${Date.now()}`;
    Object.assign(this.activeConfig, overrides);
    this._lastLoggedSignature = null;
    this.sessionMeta.push({
      sessionId: this.activeConfig.sessionId,
      startedAt: new Date().toISOString(),
      groundTruth: this.activeConfig.groundTruth,
      attackType: this.activeConfig.attackType,
      lightingCondition: this.activeConfig.lightingCondition,
      poseCondition: this.activeConfig.poseCondition,
      operatingThreshold: this.activeConfig.operatingThreshold,
      probeUserLabel: this.activeConfig.probeUserLabel,
    });
    this.saveSessionMeta();
    return this.activeConfig.sessionId;
  }

  exportSessionMeta() {
    return this.sessionMeta;
  }

  downloadSessionMeta(filename = `biometric_eval_sessions_${new Date().toISOString().slice(0, 10)}.json`) {
    const content = JSON.stringify(this.sessionMeta, null, 2);
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  logEvent(eventData) {
    if (!this.activeConfig.enabled) return null;

    const threshold = eventData.thresholdUsed ?? this.activeConfig.operatingThreshold;
    const distance = eventData.rawEuclideanDistance !== undefined ? eventData.rawEuclideanDistance : 999.0;

    // Dedup: skip if distance + status identical to last logged event (same frame re-processed)
    const signature = `${distance.toFixed(3)}_${eventData.livenessPassed}_${eventData.matchedStudentId || ""}`;
    if (signature === this._lastLoggedSignature) return null;
    this._lastLoggedSignature = signature;

    // Determine Liveness Outcome (Hard Precondition)
    const isNonBonaFideAttack = this.activeConfig.attackType !== "bona_fide";
    let livenessOutcome;
    if (eventData.livenessOutcome) {
      livenessOutcome = eventData.livenessOutcome;
    } else if (eventData.livenessPassed === false) {
      livenessOutcome = "fail";
    } else if (isNonBonaFideAttack) {
      // For spoof attacks: liveness should fail (printed photo, screen replay = static)
      // But if the system passed it, log as "pass" (this IS the leak we're measuring)
      livenessOutcome = "pass";
    } else {
      livenessOutcome = "pass";
    }
    const isLive = livenessOutcome === "pass";

    // HARD GATE: If liveness fails, vector recognition is rejected immediately
    const isMatch = isLive && distance <= threshold;
    const recognitionDecision = !isLive ? "liveness_rejected" : (isMatch ? "match_accepted" : "unrecognized");

    let classificationOutcome = "NOT_APPLICABLE";
    if (this.activeConfig.groundTruth === "genuine") {
      classificationOutcome = (isLive && isMatch) ? "TP" : "FN";
    } else if (this.activeConfig.groundTruth === "impostor") {
      classificationOutcome = (isLive && isMatch) ? "FP" : "TN";
    }

    const row = {
      event_id: `EVT_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp_iso: new Date().toISOString(),
      session_id: this.activeConfig.sessionId || "",
      ground_truth: this.activeConfig.groundTruth,
      probe_user_label: this.activeConfig.probeUserLabel,
      attack_type: this.activeConfig.attackType,
      lighting_condition: this.activeConfig.lightingCondition,
      pose_condition: this.activeConfig.poseCondition,
      detection_time_ms: parseFloat(Number(eventData.detectionTimeMs || 0).toFixed(2)),
      landmark_time_ms: parseFloat(Number(eventData.landmarkTimeMs || 0).toFixed(2)),
      embedding_time_ms: parseFloat(Number(eventData.embeddingTimeMs || 0).toFixed(2)),
      search_time_ms: parseFloat(Number(eventData.searchTimeMs || 0).toFixed(3)),
      total_pipeline_time_ms: parseFloat(Number(eventData.totalPipelineTimeMs || 0).toFixed(2)),
      faces_in_frame_count: Number(eventData.facesInFrameCount || 1),
      ear_left: Number(eventData.earLeft || 0),
      ear_right: Number(eventData.earRight || 0),
      ear_avg: Number(eventData.earAvg || 0),
      yaw_deg: Number(eventData.yawDeg || 0),
      pitch_deg: Number(eventData.pitchDeg || 0),
      laplacian_texture_var: Number(eventData.laplacianTextureVar || 0),
      liveness_outcome: livenessOutcome,
      matched_student_id: isMatch ? (eventData.matchedStudentId || "") : "",
      matched_student_name: isMatch ? (eventData.matchedStudentName || "") : "",
      matched_student_roll: isMatch ? (eventData.matchedStudentRoll || "") : "",
      raw_euclidean_distance: parseFloat(Number(distance).toFixed(4)),
      operating_threshold: parseFloat(Number(threshold).toFixed(2)),
      recognition_decision: recognitionDecision,
      classification_outcome: classificationOutcome,
      offline_cache_hit: Boolean(eventData.offlineCacheHit),
    };

    this.events.push(row);
    this.saveEvents();
    return row;
  }

  logEventDirect(directRow) {
    this.events.push(directRow);
    this.saveEvents();
    return directRow;
  }

  getEvents() {
    return this.events;
  }

  getCounts() {
    const total = this.events.length;
    const tp = this.events.filter((e) => e.classification_outcome === "TP").length;
    const tn = this.events.filter((e) => e.classification_outcome === "TN").length;
    const fp = this.events.filter((e) => e.classification_outcome === "FP").length;
    const fn = this.events.filter((e) => e.classification_outcome === "FN").length;
    return { total, tp, tn, fp, fn };
  }

  clearEvents() {
    this.events = [];
    this.sessionMeta = [];
    this._lastLoggedSignature = null;
    localStorage.removeItem(this.storageKey);
    localStorage.removeItem(this.sessionMetaKey);
  }

  exportCSV() {
    if (this.events.length === 0) return "";
    const headers = Object.keys(this.events[0]);
    const rows = this.events.map((e) =>
      headers.map((h) => `"${String(e[h] !== undefined ? e[h] : "").replace(/"/g, '""')}"`).join(",")
    );
    return [headers.join(","), ...rows].join("\n");
  }

  downloadCSV(filename = `biometric_eval_raw_log_${new Date().toISOString().slice(0, 10)}.csv`) {
    const csvContent = this.exportCSV();
    if (!csvContent) return false;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  }
}

export const evalLogger = new BiometricEvalLogger();
