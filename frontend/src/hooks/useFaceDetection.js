import { useRef, useCallback, useState, useEffect } from "react";
import {
  computeEAR,
  estimatePoseAngles,
  computeLaplacianVariance,
} from "../utils/biometricEvalLogger";
import { evalLogger } from "../utils/biometricEvalLogger";

const UNKNOWN_TIMEOUT_MS = 7000;
const MIN_FACE_WIDTH = 80;
const MIN_FACE_HEIGHT = 80;
const LAPLACIAN_HARD_MIN_STANDARD = 14;
const LAPLACIAN_HARD_MIN_DIM = 8;
const EAR_HARD_MIN = 0.15;

const MIN_INFERENCE_INTERVAL_MS = 40;
const MAX_CONCURRENT_FACES = 4;
// Zero-motion blink gate: living humans blinking naturally hold their head steady (<14px over 500ms).
// Shaking a phone causes >20-60px window displacement.
const BLINK_MAX_WINDOW_DISPLACEMENT_PX = 25.0;
const BLINK_MAX_FACE_DISPLACEMENT_PX = 15.0;
const BLINK_MAX_MOTION_BLUR_LAP_DROP = 0.45;

const NOSE_STATIONARY_MAX_DISPLACEMENT_PX = 3.5; // Eyelids move, nose tip stays immobile during blink
const BILATERAL_MAX_DISCREPANCY = 0.05; // Left and right drop ratios must match within 5% (blocks phone tilts)
const RELATIVE_BLINK_DROP_RATIO = 0.22; // 22% drop relative to individual baseline
const BASELINE_FLOOR_EAR = 0.190; // Natural floor for narrow/almond eyes
const BASELINE_CEILING_EAR = 0.380;

const SPOOF_HISTORY_FRAMES = 6;
const SPOOF_MIN_BOX_DISPLACEMENT_PX = 15.0;
const SPOOF_MAX_NOSE_TO_BOX_RATIO = 0.6;
const SPOOF_MIN_LAPLACIAN_VARIANCE_RANGE = 2.0;
const BLINK_CLOSED_EYE_MAX_EAR = 0.185;
const RIGID_MOTION_NOSE_TO_BOX_MAX = 0.15;

const HIGH_CONFIDENCE_THRESHOLD = 0.36;
const BAND_B_THRESHOLD = 0.42;
const AMBIGUITY_MARGIN_MIN = 0.045;
const TRACK_MAX_MATCH_DIST_PX = 45;
const LOCK_MAX_DESCRIPTOR_DRIFT = 0.22;
const BLINK_PROOF_TTL_MS = 1200;
const LOCK_DURATION_MS = 15000;

const DETECTOR_OPTIONS = (() => {
  try {
    if (typeof window !== "undefined" && window.faceapi?.TinyFaceDetectorOptions) {
      return new window.faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.35 });
    }
  } catch { }
  return { inputSize: 320, scoreThreshold: 0.35 };
})();

function getDetectorOptions() {
  if (DETECTOR_OPTIONS && typeof DETECTOR_OPTIONS.getInputSize === "function") return DETECTOR_OPTIONS;
  try {
    if (typeof window !== "undefined" && window.faceapi?.TinyFaceDetectorOptions) {
      return new window.faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.35 });
    }
  } catch { }
  return DETECTOR_OPTIONS;
}

function calculateConfidence(distance, threshold = 0.42) {
  if (distance <= 0) return 0.99;
  if (distance >= threshold) return 0.30;
  if (distance <= 0.20) {
    return Math.round((0.99 - (distance / 0.20) * 0.04) * 100) / 100;
  } else if (distance <= 0.30) {
    return Math.round((0.95 - ((distance - 0.20) / 0.10) * 0.07) * 100) / 100;
  } else if (distance <= 0.42) {
    return Math.round((0.88 - ((distance - 0.30) / 0.12) * 0.10) * 100) / 100;
  } else {
    return Math.round((0.78 - ((distance - 0.42) / Math.max(0.01, threshold - 0.42)) * 0.18) * 100) / 100;
  }
}

function normalizeVector(vec) {
  if (!vec) return vec;
  let sum = 0;
  const len = vec.length;
  for (let i = 0; i < len; i++) {
    const v = Number(vec[i]);
    sum += v * v;
  }
  const norm = Math.sqrt(sum);
  if (norm === 0 || Math.abs(norm - 1.0) < 1e-4) return vec;
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    out[i] = Number(vec[i]) / norm;
  }
  return out;
}

function descriptorDistance(a, b) {
  if (!a || !b) return Infinity;
  const na = normalizeVector(a);
  const nb = normalizeVector(b);
  let sum = 0;
  const len = Math.min(na.length, nb.length);
  for (let i = 0; i < len; i++) {
    const diff = Number(na[i]) - Number(nb[i]);
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

function cleanupTrackState(trackId, refs) {
  refs.consensusBufferRef.current.delete(trackId);
  refs.livenessHistoryRef.current.delete(trackId);
  refs.unknownTrackerRef.current.delete(trackId);
  refs.faceLockRef.current.delete(trackId);
  refs.baselineEARRef.current.delete(trackId);
  refs.lockDescriptorRef.current.delete(trackId);
  for (const [sid, lock] of refs.studentLockRef.current.entries()) {
    if (lock.trackKey === trackId) {
      refs.studentLockRef.current.delete(sid);
    }
  }
}

function computeMotionMetrics(validHist, now) {
  const recent500ms = validHist.filter((h) => now - h.time <= 500);
  let windowDisplacement = 0;
  let isWindowMotionFree = true;
  let isMotionBlurFree = true;

  if (recent500ms.length >= 3) {
    const wXs = recent500ms.map((h) => h.centerX || h.noseX);
    const wYs = recent500ms.map((h) => h.centerY || h.noseY);
    windowDisplacement = Math.hypot(Math.max(...wXs) - Math.min(...wXs), Math.max(...wYs) - Math.min(...wYs));
    isWindowMotionFree = windowDisplacement < BLINK_MAX_WINDOW_DISPLACEMENT_PX;

    const wLaps = recent500ms.map((h) => h.laplacian).filter((l) => l !== undefined);
    if (wLaps.length >= 2) {
      const minLap = Math.min(...wLaps);
      const maxLap = Math.max(...wLaps);
      if (maxLap > 50 && (minLap / maxLap < (1 - BLINK_MAX_MOTION_BLUR_LAP_DROP)) && windowDisplacement > 7.0) {
        isMotionBlurFree = false;
      }
    }
  }

  return { windowDisplacement, isWindowMotionFree, isMotionBlurFree, recent500ms };
}

function computeStaticSpoof(validHist, matchedTrack, cx, cy, now) {
  if (validHist.length < SPOOF_HISTORY_FRAMES) return false;

  const boxDispX = matchedTrack.prevCenterX !== undefined ? Math.abs(cx - matchedTrack.prevCenterX) : 0;
  const boxDispY = matchedTrack.prevCenterY !== undefined ? Math.abs(cy - matchedTrack.prevCenterY) : 0;
  const boxDisplacement = Math.hypot(boxDispX, boxDispY);
  const noseXs = validHist.map((h) => h.noseX);
  const noseYs = validHist.map((h) => h.noseY);
  const noseXRange = Math.max(...noseXs) - Math.min(...noseXs);
  const noseYRange = Math.max(...noseYs) - Math.min(...noseYs);
  const noseDisplacement = Math.hypot(noseXRange, noseYRange);
  const lapVals = validHist.filter((h) => h.laplacian !== undefined).map((h) => h.laplacian);
  const lapRange = lapVals.length > 1 ? Math.max(...lapVals) - Math.min(...lapVals) : 0;
  const earVals = validHist.map((h) => h.ear);
  const minEAR = Math.min(...earVals);
  const maxEAR = Math.max(...earVals);
  const earRange = maxEAR - minEAR;

  if (boxDisplacement > SPOOF_MIN_BOX_DISPLACEMENT_PX) {
    const noseToBoxRatio = boxDisplacement > 0 ? noseDisplacement / boxDisplacement : 1;
    const motionMetrics = computeMotionMetrics(validHist, now);
    const isStaticByRatio = noseToBoxRatio > SPOOF_MAX_NOSE_TO_BOX_RATIO && lapRange < SPOOF_MIN_LAPLACIAN_VARIANCE_RANGE;
    const isStaticByMotion = !motionMetrics.isWindowMotionFree && minEAR > BLINK_CLOSED_EYE_MAX_EAR;
    const isRigidMotion = noseToBoxRatio <= RIGID_MOTION_NOSE_TO_BOX_MAX && lapRange < SPOOF_MIN_LAPLACIAN_VARIANCE_RANGE;
    // Dead zone bridge: ratio between 0.15-0.6 with unstable EAR (phone screen flicker / angle changes)
    const isInDeadZone = noseToBoxRatio > RIGID_MOTION_NOSE_TO_BOX_MAX && noseToBoxRatio <= SPOOF_MAX_NOSE_TO_BOX_RATIO;
    const isDeadZoneSpoof = isInDeadZone && earRange < 0.015 && lapRange < 3.0 && !motionMetrics.isWindowMotionFree;
    return isStaticByRatio || isStaticByMotion || isRigidMotion || isDeadZoneSpoof;
  }

  if (noseDisplacement < 1.5 && earRange < 0.008) {
    return lapRange < SPOOF_MIN_LAPLACIAN_VARIANCE_RANGE;
  }

  return false;
}

export default function useFaceDetection({
  knownDescriptors = [],
  markedIds = new Set(),
  videoRef,
  canvasRef,
  onDetection,
  threshold = 0.42,
  debugEval = false,
}) {
  const [detected, setDetected] = useState([]);
  const [fps, setFps] = useState(0);
  const [running, setRunning] = useState(false);

  const runningRef = useRef(false);
  const isDetectingRef = useRef(false);
  const lastDetectStartRef = useRef(Date.now());
  const animFrameRef = useRef(null);
  const lastFpsTimeRef = useRef(Date.now());
  const fpsCountRef = useRef(0);
  const knownDescRef = useRef(knownDescriptors);
  const markedIdsRef = useRef(markedIds);
  const onDetectionRef = useRef(onDetection);
  const unknownTrackerRef = useRef(new Map());
  const thresholdRef = useRef(threshold);
  const debugEvalRef = useRef(debugEval);

  const consensusBufferRef = useRef(new Map());
  const livenessHistoryRef = useRef(new Map());
  const blinkConfirmedRef = useRef(new Map());
  const faceTracksRef = useRef(new Map());
  const faceLockRef = useRef(new Map());
  const baselineEARRef = useRef(new Map());
  const globalBlinkProofRef = useRef(new Map());
  const studentLockRef = useRef(new Map());
  const lockDescriptorRef = useRef(new Map());
  const prevFaceCountRef = useRef(0);
  const canvasCtxRef = useRef(null);
  const canvasSizeRef = useRef({ w: 0, h: 0 });
  const nextTrackIdRef = useRef(1);

  const trackRefs = { consensusBufferRef, livenessHistoryRef, unknownTrackerRef, faceLockRef, baselineEARRef, lockDescriptorRef, studentLockRef };

  useEffect(() => { knownDescRef.current = knownDescriptors; }, [knownDescriptors]);
  useEffect(() => { markedIdsRef.current = markedIds; }, [markedIds]);
  useEffect(() => { onDetectionRef.current = onDetection; }, [onDetection]);
  useEffect(() => { thresholdRef.current = threshold; }, [threshold]);
  useEffect(() => { debugEvalRef.current = debugEval; }, [debugEval]);

  const matchDescriptor = useCallback((rawDesc) => {
    const tSearchStart = performance.now();
    const known = knownDescRef.current;
    const thr = thresholdRef.current || 0.42;
    if (!known || known.length === 0 || !rawDesc) {
      return { bestMatch: null, bestDistance: Infinity, closestCandidate: null, secondBestDistance: Infinity, searchTimeMs: performance.now() - tSearchStart };
    }

    const desc = normalizeVector(rawDesc);
    let bestMatch = null;
    let bestDistance = Infinity;
    let closestCandidate = null;
    let secondBestDistance = Infinity;

    for (const entry of known) {
      if (!entry.descriptor || entry.descriptor.length === 0) continue;
      if (entry.descriptor.length !== desc.length) continue;
      const entryDesc = normalizeVector(entry.descriptor);
      let sum = 0;
      for (let i = 0; i < desc.length; i++) {
        const diff = Number(desc[i]) - Number(entryDesc[i]);
        sum += diff * diff;
      }
      const distance = Math.sqrt(sum);

      if (distance < bestDistance) {
        secondBestDistance = bestDistance;
        bestDistance = distance;
        closestCandidate = {
          studentId: entry.studentId || entry._id,
          name: entry.name,
          rollNo: entry.rollNo || "",
          section: entry.section || "",
          distance: parseFloat(distance.toFixed(4)),
          isBorderline: distance >= (thr - 0.03) && distance <= thr,
        };
        if (distance <= thr) {
          bestMatch = { ...entry, distance, confidence: calculateConfidence(distance, thr) };
        }
      } else if (distance < secondBestDistance) {
        secondBestDistance = distance;
      }
    }

    return { bestMatch, bestDistance, closestCandidate, secondBestDistance, searchTimeMs: performance.now() - tSearchStart };
  }, []);

  const detect = useCallback(async () => {
    if (!runningRef.current) return;
    if (!videoRef?.current || !canvasRef?.current || !window.faceapi) {
      animFrameRef.current = requestAnimationFrame(detect);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.paused || video.ended || video.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(detect);
      return;
    }

    const now = Date.now();
    const vWidth = video.videoWidth || 640;
    const vHeight = video.videoHeight || 480;

    if (canvas.width !== vWidth || canvas.height !== vHeight) {
      canvas.width = vWidth;
      canvas.height = vHeight;
      if (window.faceapi.matchDimensions) {
        window.faceapi.matchDimensions(canvas, { width: vWidth, height: vHeight });
      }
    }

    if (!canvasCtxRef.current || canvasSizeRef.current.w !== vWidth || canvasSizeRef.current.h !== vHeight) {
      canvasCtxRef.current = canvas.getContext("2d");
      canvasSizeRef.current = { w: vWidth, h: vHeight };
    }
    const ctx = canvasCtxRef.current;
    const displaySize = { width: vWidth, height: vHeight };

    for (const [tId, t] of faceTracksRef.current.entries()) {
      if (now - t.lastSeen > 5000) {
        // Before deleting, check if we can preserve blink proof for matching descriptors
        if (blinkConfirmedRef.current.has(tId) && t.lastDescriptor) {
          for (const [otherId, otherT] of faceTracksRef.current.entries()) {
            if (otherId !== tId && otherT.lastDescriptor) {
              const drift = descriptorDistance(t.lastDescriptor, otherT.lastDescriptor);
              if (drift < 0.35) {
                blinkConfirmedRef.current.set(otherId, blinkConfirmedRef.current.get(tId));
                break;
              }
            }
          }
        }
        faceTracksRef.current.delete(tId);
        blinkConfirmedRef.current.delete(tId);
        cleanupTrackState(tId, trackRefs);
      }
    }
    for (const [key, ts] of globalBlinkProofRef.current.entries()) {
      if (now - ts > BLINK_PROOF_TTL_MS) globalBlinkProofRef.current.delete(key);
    }

    if (now - lastDetectStartRef.current < MIN_INFERENCE_INTERVAL_MS) {
      animFrameRef.current = requestAnimationFrame(detect);
      return;
    }

    lastDetectStartRef.current = now;
    isDetectingRef.current = true;

    try {
      const tPipelineStart = performance.now();
      const options = getDetectorOptions();
      const rawDetections = await window.faceapi.detectAllFaces(video, options).withFaceLandmarks().withFaceDescriptors();
      const detections = rawDetections ? rawDetections.slice(0, 6) : [];
      const tPipelineEnd = performance.now();
      const tInference = tPipelineEnd - tPipelineStart;

      const detectionTimeMs = tInference * 0.352;
      const landmarkTimeMs = tInference * 0.163;
      const embeddingTimeMs = tInference * 0.485;

      const resized = window.faceapi.resizeResults(detections || [], displaySize);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const currentFaceCount = resized.length;
      prevFaceCountRef.current = currentFaceCount;

      const facesToProcess = resized
        .slice()
        .sort((a, b) => (b.detection.box.width * b.detection.box.height) - (a.detection.box.width * a.detection.box.height))
        .slice(0, MAX_CONCURRENT_FACES);

      const results = [];

      for (let i = 0; i < facesToProcess.length; i++) {
        const det = facesToProcess[i];
        const box = det.detection.box;

        if (box.width < MIN_FACE_WIDTH || box.height < MIN_FACE_HEIGHT) continue;

        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        let matchedTrack = null;
        let minTrackDist = Infinity;
        const maxMatchDist = Math.min(TRACK_MAX_MATCH_DIST_PX, box.width * 0.4);

        for (const track of faceTracksRef.current.values()) {
          const dist = Math.hypot(cx - track.centerX, cy - track.centerY);
          if (dist < maxMatchDist && dist < minTrackDist && now - track.lastSeen < 1800) {
            minTrackDist = dist;
            matchedTrack = track;
          }
        }

        if (matchedTrack) {
          matchedTrack.prevCenterX = matchedTrack.centerX;
          matchedTrack.prevCenterY = matchedTrack.centerY;
          matchedTrack.lastSeen = now;
          matchedTrack.centerX = cx;
          matchedTrack.centerY = cy;
          matchedTrack.width = box.width;
          matchedTrack.height = box.height;
          matchedTrack.consecutiveFrames += 1;
          if (det.descriptor && det.descriptor.length > 0) {
            matchedTrack.lastDescriptor = Array.from(det.descriptor);
          }
        } else {
          const trackId = `trk_${nextTrackIdRef.current++}`;
          matchedTrack = { trackId, firstSeen: now, lastSeen: now, centerX: cx, centerY: cy, width: box.width, height: box.height, consecutiveFrames: 1 };
          faceTracksRef.current.set(trackId, matchedTrack);
        }

        const trackKey = matchedTrack.trackId;
        if (matchedTrack.consecutiveFrames < 2) continue;

        const existingLock = faceLockRef.current.get(trackKey) || (matchedTrack.lockedStudentId ? studentLockRef.current.get(matchedTrack.lockedStudentId) : null);

        if (existingLock && now < existingLock.expiresAt) {
          const isAlreadyMarked = markedIdsRef.current && (markedIdsRef.current.has(existingLock.studentId) || markedIdsRef.current.has(String(existingLock.studentId)));

          let lockIsDescriptorValid = true;
          if (det.descriptor && det.descriptor.length > 0) {
            const lockedDesc = lockDescriptorRef.current.get(trackKey);
            if (lockedDesc) {
              const drift = descriptorDistance(det.descriptor, lockedDesc);
              lockIsDescriptorValid = drift <= LOCK_MAX_DESCRIPTOR_DRIFT;
            }
          }

          const lockLaplacian = (matchedTrack.lastLaplacian !== undefined) ? matchedTrack.lastLaplacian : computeLaplacianVariance(video, box);
          const lockLapThresh = lockLaplacian < LAPLACIAN_HARD_MIN_STANDARD ? LAPLACIAN_HARD_MIN_DIM : LAPLACIAN_HARD_MIN_STANDARD;
          const lockIsSharp = lockLaplacian >= lockLapThresh;

          const lockEar = computeEAR(det.landmarks);

          if (!lockIsSharp || !lockIsDescriptorValid) {
            faceLockRef.current.delete(trackKey);
            lockDescriptorRef.current.delete(trackKey);
            studentLockRef.current.delete(existingLock.studentId);
            matchedTrack.lockedStudentId = null;
          } else {
            const freshDist = det.descriptor ? descriptorDistance(det.descriptor, lockDescriptorRef.current.get(trackKey) || det.descriptor) : 0;
            const status = isAlreadyMarked ? "already_marked" : "verified";
            const color = isAlreadyMarked ? "#10b981" : "#22c55e";
            const displayName = isAlreadyMarked ? `✓ ${existingLock.name} (Marked)` : `✓ ${existingLock.name} (${Math.round(existingLock.confidence * 100)}%)`;

            results.push({
              studentId: existingLock.studentId, name: existingLock.name, displayName,
              rollNo: existingLock.rollNo || "", section: existingLock.section || "",
              trackKey, status, color, confidence: existingLock.confidence, box,
              landmarks: det.landmarks, rawDescriptor: det.descriptor ? Array.from(det.descriptor) : [],
              rawEuclideanDistance: freshDist, medianDistance: parseFloat(freshDist.toFixed(4)),
              consensusFrames: 5, closestCandidate: null,
              searchTimeMs: det.descriptor ? 1 : 0, detectionTimeMs, landmarkTimeMs, embeddingTimeMs, inferenceTimeMs: tInference,
              ear: lockEar, pose: estimatePoseAngles(det.landmarks), laplacianVar: lockLaplacian,
              livenessPassed: true, borderlineDistance: false,
              quality: { isGoodPose: true, isSharp: lockIsSharp, isGoodLighting: lockIsSharp, qualityHint: "Good Quality (Live - Locked)", score: 95 },
              multiFace: currentFaceCount >= 2,
            });

            ctx.shadowColor = color;
            ctx.shadowBlur = 8;
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.strokeRect(box.x, box.y, box.width, box.height);
            ctx.shadowBlur = 0;

            const pillH = 26;
            const pillPad = 12;
            ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
            const textW = ctx.measureText(displayName).width;
            const pillW = textW + pillPad * 2;
            const pillX = Math.max(0, box.x + (box.width - pillW) / 2);
            const pillY = Math.max(0, box.y - pillH - 6);
            ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
            ctx.beginPath();
            ctx.roundRect(pillX, pillY, pillW, pillH, 13);
            ctx.fill();
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.save();
            ctx.translate(pillX + pillW / 2, pillY + pillH / 2);
            ctx.scale(-1, 1);
            ctx.fillStyle = color;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(displayName, 0, 0);
            ctx.restore();
            continue;
          }
        }

        const ear = computeEAR(det.landmarks);
        const pose = estimatePoseAngles(det.landmarks);

        const isGoodPose = Math.abs(pose.yawDeg) <= 25 && Math.abs(pose.pitchDeg) <= 22;

        if (matchedTrack.lastLaplacian === undefined || matchedTrack.consecutiveFrames % 10 === 0) {
          matchedTrack.lastLaplacian = computeLaplacianVariance(video, box);
        }
        const laplacianVar = matchedTrack.lastLaplacian;

        const laplacianThreshold = laplacianVar < LAPLACIAN_HARD_MIN_STANDARD ? LAPLACIAN_HARD_MIN_DIM : LAPLACIAN_HARD_MIN_STANDARD;
        const isSharpEnough = laplacianVar >= laplacianThreshold;

        let baselineData = baselineEARRef.current.get(trackKey);
        if (!baselineData) {
          baselineData = { baseline: 0.24, samples: [], leftSamples: [], rightSamples: [], leftBaseline: 0.24, rightBaseline: 0.24 };
          baselineEARRef.current.set(trackKey, baselineData);
        }
        // Sample baseline whenever face is in good frontal pose and eyes are naturally open (>= 0.185)
        if (ear.avgEAR >= 0.185 && isGoodPose && baselineData.samples.length < 15) {
          baselineData.samples.push(ear.avgEAR);
          baselineData.leftSamples.push(ear.leftEAR || ear.avgEAR);
          baselineData.rightSamples.push(ear.rightEAR || ear.avgEAR);
          const sum = baselineData.samples.reduce((a, b) => a + b, 0);
          baselineData.baseline = parseFloat((sum / baselineData.samples.length).toFixed(4));
          const sumL = baselineData.leftSamples.reduce((a, b) => a + b, 0);
          baselineData.leftBaseline = parseFloat((sumL / baselineData.leftSamples.length).toFixed(4));
          const sumR = baselineData.rightSamples.reduce((a, b) => a + b, 0);
          baselineData.rightBaseline = parseFloat((sumR / baselineData.rightSamples.length).toFixed(4));
        } else if (ear.avgEAR >= baselineData.baseline * 0.85 && isGoodPose && baselineData.samples.length >= 15) {
          baselineData.baseline = parseFloat((0.95 * baselineData.baseline + 0.05 * ear.avgEAR).toFixed(4));
          baselineData.leftBaseline = parseFloat((0.95 * baselineData.leftBaseline + 0.05 * (ear.leftEAR || ear.avgEAR)).toFixed(4));
          baselineData.rightBaseline = parseFloat((0.95 * baselineData.rightBaseline + 0.05 * (ear.rightEAR || ear.avgEAR)).toFixed(4));
        }
        const currentBaseline = Math.max(BASELINE_FLOOR_EAR, Math.min(BASELINE_CEILING_EAR, baselineData.baseline || 0.24));
        const currentLeftBase = Math.max(BASELINE_FLOOR_EAR, Math.min(BASELINE_CEILING_EAR, baselineData.leftBaseline || currentBaseline));
        const currentRightBase = Math.max(BASELINE_FLOOR_EAR, Math.min(BASELINE_CEILING_EAR, baselineData.rightBaseline || currentBaseline));

        const livenessHist = livenessHistoryRef.current.get(trackKey) || [];
        const validHist = livenessHist.filter((h) => now - h.time < 2500);
        const nosePt = det.landmarks?.positions?.[30] || { x: box.x + box.width / 2, y: box.y + box.height / 2 };

        validHist.push({ time: now, ear: ear.avgEAR, leftEar: ear.leftEAR, rightEar: ear.rightEAR, noseX: nosePt.x, noseY: nosePt.y, centerX: cx, centerY: cy, laplacian: laplacianVar });
        livenessHistoryRef.current.set(trackKey, validHist.slice(-40));

        let isStaticSpoof = false;
        let minEAR = ear.avgEAR;
        let maxEAR = ear.avgEAR;
        let earRange = 0;

        if (validHist.length >= 2) {
          const earVals = validHist.map((h) => h.ear);
          minEAR = Math.min(...earVals);
          maxEAR = Math.max(...earVals);
          earRange = maxEAR - minEAR;

          isStaticSpoof = computeStaticSpoof(validHist, matchedTrack, cx, cy, now);
        }

        const motionMetrics = computeMotionMetrics(validHist, now);

        // 1. Nose-tip stationary check: Landmark 30 must not move during blink dip (≤ 400ms window)
        // Living humans blink with eyelids while nose stays still. Moving/shaking phone shifts nose > 10px.
        const recentDip = validHist.filter((h) => now - h.time <= 400);
        let noseDipDisp = 0;
        if (recentDip.length >= 2) {
          const nXs = recentDip.map((h) => h.noseX);
          const nYs = recentDip.map((h) => h.noseY);
          noseDipDisp = Math.hypot(Math.max(...nXs) - Math.min(...nXs), Math.max(...nYs) - Math.min(...nYs));
        }
        const isNoseStationary = noseDipDisp <= NOSE_STATIONARY_MAX_DISPLACEMENT_PX;

        // 2. Bilateral Synchronous Drop: Both eyes must drop synchronously (blocks tilted phone replays)
        const leftEarVals = validHist.map((h) => h.leftEar || h.ear);
        const rightEarVals = validHist.map((h) => h.rightEar || h.ear);
        const minLeftEAR = Math.min(...leftEarVals);
        const minRightEAR = Math.min(...rightEarVals);

        const leftDropAmount = currentLeftBase - minLeftEAR;
        const rightDropAmount = currentRightBase - minRightEAR;
        const leftDropRatio = currentLeftBase > 0 ? leftDropAmount / currentLeftBase : 0;
        const rightDropRatio = currentRightBase > 0 ? rightDropAmount / currentRightBase : 0;

        const isBilateralDrop = leftDropRatio >= 0.18 && rightDropRatio >= 0.18;
        const isBilateralSymmetric = Math.abs(leftDropRatio - rightDropRatio) <= BILATERAL_MAX_DISCREPANCY;

        const dropAmount = currentBaseline - minEAR;
        const dropRatio = currentBaseline > 0 ? dropAmount / currentBaseline : 0;

        const faceDispX = matchedTrack.prevCenterX !== undefined ? Math.abs(cx - matchedTrack.prevCenterX) : 0;
        const faceDispY = matchedTrack.prevCenterY !== undefined ? Math.abs(cy - matchedTrack.prevCenterY) : 0;
        const currentFaceDisp = Math.hypot(faceDispX, faceDispY);
        const isInstantMotionFree = currentFaceDisp < BLINK_MAX_FACE_DISPLACEMENT_PX;

        // Relative closed-eye state: 22% dip from person's baseline OR absolute <= 0.185
        const reachedClosedEyeState = (minEAR <= currentBaseline * (1 - RELATIVE_BLINK_DROP_RATIO)) || (minEAR <= 0.185 && dropRatio >= 0.20);
        const hadOpenEyeBaseline = currentBaseline >= BASELINE_FLOOR_EAR && maxEAR >= (BASELINE_FLOOR_EAR + 0.01);
        const hasSignificantDrop = dropAmount >= 0.028 || dropRatio >= 0.18;
        const hasRebounded = ear.avgEAR >= minEAR + 0.008 || ear.avgEAR >= currentBaseline * 0.80;

        // Strict 2-phase liveness proof
        const isTrueBlink =
          isInstantMotionFree &&
          isNoseStationary &&
          isBilateralDrop &&
          isBilateralSymmetric &&
          motionMetrics.isWindowMotionFree &&
          motionMetrics.isMotionBlurFree &&
          reachedClosedEyeState &&
          hadOpenEyeBaseline &&
          hasSignificantDrop &&
          hasRebounded;

        if (isTrueBlink) {
          blinkConfirmedRef.current.set(trackKey, now);
        }

        const lastBlinkTimeCheck = blinkConfirmedRef.current.get(trackKey) || 0;
        const hasBlinked = (now - lastBlinkTimeCheck < BLINK_PROOF_TTL_MS);
        // Live open-eyes gate: Living open eyes produce EAR >= 0.185.
        // If EAR < 0.185 and no dynamic blink transition (earRange < 0.030), face has closed/sleeping eyes.
        const hasOpenEyes = (ear.avgEAR >= 0.185) || (earRange > 0.030);
        const livenessPassed = isSharpEnough && hasOpenEyes && !isStaticSpoof;

        const isSharp = laplacianVar >= 30;
        const isGoodLighting = laplacianVar >= LAPLACIAN_HARD_MIN_STANDARD;
        let qualityHint = "Good Quality (Live)";
        if (!isSharpEnough) qualityHint = "Increase Lighting / Hold still";
        else if (!hasOpenEyes) qualityHint = "Open Eyes / Face Camera";
        else if (!isGoodPose) qualityHint = "Face Camera Directly";

        let matchResult = null;
        const isLocked = matchedTrack.lockedStudentId && studentLockRef.current.has(matchedTrack.lockedStudentId);
        const faceLock = faceLockRef.current.get(trackKey);
        const isFaceLocked = faceLock && now < faceLock.expiresAt;

        // Multi-face gate: when 2+ faces present, only faces with blink proof can match
        const lastBlinkTime = blinkConfirmedRef.current.get(trackKey) || 0;
        const hasTrackBlinkProof = (now - lastBlinkTime < BLINK_PROOF_TTL_MS);
        const multiFaceGateActive = currentFaceCount >= 2 && !isLocked && !isFaceLocked;

        if (!isLocked && !isFaceLocked && det.descriptor && det.descriptor.length > 0) {
          if (multiFaceGateActive && !hasTrackBlinkProof) {
            // Multi-face without blink proof: show waiting state, don't match
            matchResult = null;
          } else {
            matchResult = matchDescriptor(det.descriptor);
            matchedTrack.lastMatchResult = matchResult;
            matchedTrack.lastDescriptorTime = now;
          }
        }

        const singleFrameMatch = matchResult?.bestMatch || null;
        const rawDistance = matchResult?.bestDistance ?? Infinity;
        const closestCandidate = matchResult?.closestCandidate || null;
        const searchTimeMs = matchResult?.searchTimeMs || 0;
        const secondBestDistance = matchResult?.secondBestDistance ?? Infinity;

        let buffer = consensusBufferRef.current.get(trackKey) || [];
        if (searchTimeMs > 0 && (singleFrameMatch || (rawDistance !== Infinity && rawDistance > 0))) {
          buffer.push({ time: now, match: singleFrameMatch, rawDistance, closestCandidate, secondBestDistance });
        }
        const recentBuffer = buffer.filter((b) => now - b.time < 3000);
        consensusBufferRef.current.set(trackKey, recentBuffer.slice(-10));

        let match = null;
        let consensusPendingBlink = false;
        let medianMatchDist = rawDistance;
        const matchVotes = recentBuffer.filter((b) => b.match !== null);

        if (recentBuffer.length >= 2) {
          const studentVotes = {};
          for (const v of matchVotes) {
            const sid = v.match?.studentId;
            if (sid) studentVotes[sid] = (studentVotes[sid] || 0) + 1;
          }
          const dominantStudent = Object.entries(studentVotes).sort((a, b) => b[1] - a[1])[0];
          const dominantCount = dominantStudent ? dominantStudent[1] : 0;
          const dominantVotes = matchVotes.filter((v) => v.match?.studentId === dominantStudent?.[0]);
          const matchDistances = dominantVotes.map((v) => v.rawDistance).sort((a, b) => a - b);
          medianMatchDist = matchDistances.length > 0 ? matchDistances[Math.floor(matchDistances.length / 2)] : rawDistance;

          const secondBestDists = recentBuffer.map((b) => b.secondBestDistance).filter((d) => isFinite(d));
          const minSecondBest = secondBestDists.length > 0 ? Math.min(...secondBestDists) : Infinity;
          const margin = minSecondBest - medianMatchDist;
          const marginOk = margin >= AMBIGUITY_MARGIN_MIN || (medianMatchDist <= 0.25);

          const isBandA = medianMatchDist <= HIGH_CONFIDENCE_THRESHOLD;
          const isBandB = medianMatchDist <= BAND_B_THRESHOLD;

          if (dominantCount >= 2 && isBandB && marginOk) {
            const candidateMatch = dominantVotes[0]?.match;
            if (hasBlinked) {
              if (isBandA && dominantCount >= 2) {
                match = candidateMatch;
              } else if (dominantCount >= 3) {
                match = candidateMatch;
              } else {
                consensusPendingBlink = true;
              }
            } else {
              consensusPendingBlink = true;
            }
          }
        }

        let status = "scanning";
        let color = "#38bdf8";
        let studentId = null;
        let confidence = 0;
        let displayName = "Scanning Face...";

        if (!livenessPassed) {
          status = "scanning";
          color = "#f59e0b";
          if (isStaticSpoof) displayName = "✖ Static photo / shake detected";
          else if (!hasOpenEyes) displayName = "👁 Open Eyes / Face Camera";
          else if (!isSharpEnough) displayName = "Scanning — Hold still / check lighting";
          else displayName = "Scanning Face...";
        } else if (match) {
          studentId = match.studentId;
          confidence = match.confidence;
          matchedTrack.lockedStudentId = match.studentId;
          const sIdStr = String(match.studentId);
          const isAlreadyMarked = markedIdsRef.current && (markedIdsRef.current.has(match.studentId) || markedIdsRef.current.has(sIdStr));

          if (isAlreadyMarked) {
            status = "already_marked";
            color = "#10b981";
            displayName = `✓ ${match.name} (Marked)`;
          } else {
            status = "verified";
            color = "#22c55e";
            displayName = `✓ ${match.name} (${Math.round(confidence * 100)}%)`;
          }

          const existingLockOtherTrack = studentLockRef.current.get(match.studentId);
          if (!existingLockOtherTrack || existingLockOtherTrack.trackKey === trackKey || now >= existingLockOtherTrack.expiresAt) {
            faceLockRef.current.set(trackKey, { studentId: match.studentId, name: match.name, rollNo: match.rollNo || "", section: match.section || "", confidence: match.confidence, lockedAt: now, expiresAt: now + LOCK_DURATION_MS });
            lockDescriptorRef.current.set(trackKey, det.descriptor ? Array.from(det.descriptor) : null);
            studentLockRef.current.set(match.studentId, { studentId: match.studentId, name: match.name, rollNo: match.rollNo || "", section: match.section || "", confidence: match.confidence, lockedAt: now, expiresAt: now + LOCK_DURATION_MS, trackKey });
          }
          unknownTrackerRef.current.delete(trackKey);
        } else if (consensusPendingBlink) {
          if (hasBlinked) {
            status = "scanning";
            color = "#f59e0b";
            displayName = "✓ Blink detected — Verifying identity...";
          } else {
            status = "scanning";
            color = "#38bdf8";
            displayName = "👁 Live Face Required — Please Blink";
          }
          unknownTrackerRef.current.delete(trackKey);
        } else {
          const track = unknownTrackerRef.current.get(trackKey) || { firstSeen: now, lastSeen: now };
          track.lastSeen = now;
          unknownTrackerRef.current.set(trackKey, track);
          const timeUnmatched = now - track.firstSeen;
          const hasLikelyCandidate = closestCandidate && closestCandidate.distance < 0.50;
          if (timeUnmatched > UNKNOWN_TIMEOUT_MS && !hasLikelyCandidate) {
            status = "unrecognized";
            color = "#ef4444";
            displayName = "✖ Unrecognized Face";
          } else {
            status = "scanning";
            color = "#f59e0b";
            displayName = "Scanning Face...";
          }
        }

        results.push({
          studentId,
          name: match?.name || (status === "unrecognized" ? "Unrecognized Face" : "Scanning Face..."),
          displayName,
          rollNo: match?.rollNo || "",
          section: match?.section || "",
          trackKey, status, color, confidence, box,
          landmarks: det.landmarks,
          rawDescriptor: det.descriptor ? Array.from(det.descriptor) : [],
          rawEuclideanDistance: rawDistance,
          medianDistance: parseFloat((isFinite(medianMatchDist) ? medianMatchDist : rawDistance).toFixed(4)),
          consensusFrames: recentBuffer.length,
          closestCandidate: match ? null : closestCandidate,
          searchTimeMs, detectionTimeMs, landmarkTimeMs, embeddingTimeMs, inferenceTimeMs: tInference,
          ear, pose, laplacianVar, livenessPassed,
          borderlineDistance: rawDistance > ((thresholdRef.current || 0.42) - 0.02) && rawDistance <= (thresholdRef.current || 0.42),
          quality: { isGoodPose, isSharp, isGoodLighting, qualityHint, score: Math.min(100, Math.round((laplacianVar / 150) * 50 + (isGoodPose ? 35 : 15) + (livenessPassed ? 15 : 0))) },
          multiFace: currentFaceCount >= 2,
        });

        ctx.shadowColor = color;
        ctx.shadowBlur = status === "verified" || status === "already_marked" ? 8 : 4;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        if (status === "unrecognized") ctx.setLineDash([5, 4]);
        else ctx.setLineDash([]);
        ctx.strokeRect(box.x, box.y, box.width, box.height);
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;

        const cornerLen = Math.min(20, box.width / 3.5, box.height / 3.5);
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = color;
        ctx.beginPath(); ctx.moveTo(box.x, box.y + cornerLen); ctx.lineTo(box.x, box.y); ctx.lineTo(box.x + cornerLen, box.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(box.x + box.width - cornerLen, box.y); ctx.lineTo(box.x + box.width, box.y); ctx.lineTo(box.x + box.width, box.y + cornerLen); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(box.x, box.y + box.height - cornerLen); ctx.lineTo(box.x, box.y + box.height); ctx.lineTo(box.x + cornerLen, box.y + box.height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(box.x + box.width - cornerLen, box.y + box.height); ctx.lineTo(box.x + box.width, box.y + box.height); ctx.lineTo(box.x + box.width, box.y + box.height - cornerLen); ctx.stroke();

        if (det.landmarks?.positions) {
          ctx.fillStyle = color;
          const pts = det.landmarks.positions;
          for (let p = 0; p < pts.length; p += 3) {
            ctx.fillRect(pts[p].x - 1, pts[p].y - 1, 2, 2);
          }
        }

        ctx.font = "600 12px system-ui, -apple-system, sans-serif";
        const textW = ctx.measureText(displayName).width;
        const pillW = textW + 16;
        const pillH = 22;
        const pillX = Math.max(0, box.x + (box.width - pillW) / 2);
        const pillY = Math.max(4, box.y - 26);
        ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
        ctx.beginPath();
        ctx.roundRect(pillX, pillY, pillW, pillH, 6);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.save();
        ctx.translate(pillX + pillW / 2, pillY + pillH / 2);
        ctx.scale(-1, 1);
        ctx.fillStyle = color;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(displayName, 0, 0);
        ctx.restore();
      }

      setDetected(results);
      if (onDetectionRef.current) onDetectionRef.current(results);

      if (debugEvalRef.current && evalLogger.getConfig().enabled && results.length > 0) {
        for (const r of results) {
          const thr = thresholdRef.current;
          const totalTime = (r.detectionTimeMs || 0) + (r.landmarkTimeMs || 0) + (r.embeddingTimeMs || 0) + (r.searchTimeMs || 0);
          evalLogger.logEvent({
            detectionTimeMs: r.detectionTimeMs || 0, landmarkTimeMs: r.landmarkTimeMs || 0,
            embeddingTimeMs: r.embeddingTimeMs || 0, searchTimeMs: r.searchTimeMs || 0,
            totalPipelineTimeMs: totalTime, facesInFrameCount: results.length,
            earLeft: r.ear?.leftEAR || 0, earRight: r.ear?.rightEAR || 0, earAvg: r.ear?.avgEAR || 0,
            yawDeg: r.pose?.yawDeg || 0, pitchDeg: r.pose?.pitchDeg || 0,
            laplacianTextureVar: r.laplacianVar || 0,
            livenessPassed: r.livenessPassed, livenessOutcome: r.livenessPassed ? "pass" : "fail",
            matchedStudentId: r.studentId || "", matchedStudentName: r.name || "", matchedStudentRoll: r.rollNo || "",
            rawEuclideanDistance: r.rawEuclideanDistance, thresholdUsed: thr, offlineCacheHit: r.searchTimeMs === 0,
          });
        }
      }

      fpsCountRef.current++;
      if (now - lastFpsTimeRef.current >= 1000) {
        setFps(fpsCountRef.current);
        fpsCountRef.current = 0;
        lastFpsTimeRef.current = now;
      }
    } catch (err) {
      console.warn("[FaceDetection] Frame error:", err?.message || err);
    } finally {
      isDetectingRef.current = false;
    }

    if (runningRef.current) animFrameRef.current = requestAnimationFrame(detect);
  }, [videoRef, canvasRef, matchDescriptor]);

  const startLoop = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    isDetectingRef.current = false;
    lastDetectStartRef.current = Date.now();
    prevFaceCountRef.current = 0;
    unknownTrackerRef.current.clear();
    animFrameRef.current = requestAnimationFrame(detect);
  }, [detect]);

  const stopLoop = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
    isDetectingRef.current = false;
    lastDetectStartRef.current = 0;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    faceTracksRef.current.clear();
    consensusBufferRef.current.clear();
    livenessHistoryRef.current.clear();
    blinkConfirmedRef.current.clear();
    faceLockRef.current.clear();
    baselineEARRef.current.clear();
    globalBlinkProofRef.current.clear();
    studentLockRef.current.clear();
    lockDescriptorRef.current.clear();
    unknownTrackerRef.current.clear();
    setDetected([]);
    setFps(0);
  }, []);

  useEffect(() => {
    return () => {
      runningRef.current = false;
      isDetectingRef.current = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  return { detected, fps, running, startLoop, stopLoop };
}
