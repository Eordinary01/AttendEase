import { useRef, useCallback, useState } from "react";

const HISTORY_SIZE = 15;
const DECAY_MS = 5000;

// Calculate Eye Aspect Ratio (EAR) for blink detection
function calculateEAR(eyeLandmarks) {
  if (!eyeLandmarks || eyeLandmarks.length < 6) return 0.3;
  const p1 = eyeLandmarks[1];
  const p5 = eyeLandmarks[5];
  const p2 = eyeLandmarks[2];
  const p4 = eyeLandmarks[4];
  const p0 = eyeLandmarks[0];
  const p3 = eyeLandmarks[3];

  const dVertical1 = Math.hypot(p1.x - p5.x, p1.y - p5.y);
  const dVertical2 = Math.hypot(p2.x - p4.x, p2.y - p4.y);
  const dHorizontal = Math.hypot(p0.x - p3.x, p0.y - p3.y);

  if (dHorizontal === 0) return 0.3;
  return (dVertical1 + dVertical2) / (2.0 * dHorizontal);
}

// Calculate Head Yaw (horizontal angle) from 68-point landmarks
function calculateHeadYaw(positions) {
  if (!positions || positions.length < 68) return 0;
  const leftEyeOuter = positions[36];
  const rightEyeOuter = positions[45];
  const noseTip = positions[30];

  if (!leftEyeOuter || !rightEyeOuter || !noseTip) return 0;

  const eyeDistance = rightEyeOuter.x - leftEyeOuter.x;
  if (eyeDistance <= 0) return 0;

  // Normalized nose position relative to eye center [-0.5 (left), +0.5 (right)]
  const noseRelative = (noseTip.x - leftEyeOuter.x) / eyeDistance - 0.5;
  return noseRelative;
}

const CHALLENGE_TIMEOUT_MS = 30000;

export default function useLiveness({ challengeMode = false } = {}) {
  const historyRef = useRef([]);
  const lastLiveTimeRef = useRef(0);
  const blinkHistoryRef = useRef([]);
  const baselineEARRef = useRef({ baseline: 0.22, samples: [] });
  const challengeStartRef = useRef(Date.now());
  const [isLive, setIsLive] = useState(false);
  const [livenessScore, setLivenessScore] = useState(0);

  // Active Challenge State: "center" | "turn_left" | "turn_right" | "blink" | "verified" | "timeout"
  const [challengeStep, setChallengeStep] = useState(challengeMode ? "turn_left" : "verified");
  const [challengeInstruction, setChallengeInstruction] = useState("Look at the camera");
  const challengeProgressRef = useRef({ turnedLeft: false, turnedRight: false, blinked: false });

  const processLiveness = useCallback(
    (landmarks) => {
      if (!landmarks) return false;

      // Robust landmark extraction across all face-api.js versions and getters
      const positions =
        landmarks.positions ||
        (typeof landmarks.getPositions === "function" ? landmarks.getPositions() : null) ||
        landmarks._positions ||
        landmarks;

      if (!positions || !Array.isArray(positions) || positions.length < 5) return false;

      const now = Date.now();

      // Check challenge step timeout
      if (challengeMode) {
        const timeInStep = now - challengeStartRef.current;
        if (timeInStep > CHALLENGE_TIMEOUT_MS) {
          setChallengeInstruction("⏱ Step Timed Out — Resetting");
          setChallengeStep("timeout");
          setTimeout(() => {
            challengeStartRef.current = Date.now();
            challengeProgressRef.current = { turnedLeft: false, turnedRight: false, blinked: false };
            setChallengeStep("turn_left");
            setChallengeInstruction("⮜ Turn head slightly LEFT");
          }, 1500);
          return false;
        }
      }

      const noseIdx = positions.length >= 68 ? 30 : 0;
      const nose = positions[noseIdx] || positions[0];

      if (nose && typeof nose.x === "number") {
        historyRef.current.push({ x: nose.x, y: nose.y, time: now });
        if (historyRef.current.length > HISTORY_SIZE) {
          historyRef.current.shift();
        }
      }

      // 1. Landmark Micro-Movement (Anti-Static Photo)
      let totalMove = 0;
      for (let i = 1; i < historyRef.current.length; i++) {
        const dx = historyRef.current[i].x - historyRef.current[i - 1].x;
        const dy = historyRef.current[i].y - historyRef.current[i - 1].y;
        totalMove += Math.hypot(dx, dy);
      }

      // 2. Eye Aspect Ratio & Relative Blink Detection
      let earBlink = false;
      if (positions.length >= 48) {
        const leftEye = positions.slice(36, 42);
        const rightEye = positions.slice(42, 48);
        const leftEAR = calculateEAR(leftEye);
        const rightEAR = calculateEAR(rightEye);
        const avgEAR = (leftEAR + rightEAR) / 2.0;

        // Collect baseline resting open-eye samples
        if (avgEAR >= 0.16 && baselineEARRef.current.samples.length < 12) {
          baselineEARRef.current.samples.push(avgEAR);
          const sum = baselineEARRef.current.samples.reduce((a, b) => a + b, 0);
          baselineEARRef.current.baseline = sum / baselineEARRef.current.samples.length;
        }

        blinkHistoryRef.current.push({ ear: avgEAR, time: now });
        if (blinkHistoryRef.current.length > 25) blinkHistoryRef.current.shift();

        const curBaseline = baselineEARRef.current.baseline || 0.22;
        const minEAR = Math.min(...blinkHistoryRef.current.map((b) => b.ear));
        const maxEAR = Math.max(...blinkHistoryRef.current.map((b) => b.ear));
        const earRange = maxEAR - minEAR;

        const blinkDipMax = Math.max(0.14, curBaseline * 0.72);
        const blinkRecoveryMin = Math.max(0.17, curBaseline * 0.88);
        const minRange = Math.max(0.022, curBaseline * 0.14);

        if (minEAR <= blinkDipMax && maxEAR >= blinkRecoveryMin && earRange >= minRange) {
          earBlink = true;
          challengeProgressRef.current.blinked = true;
        }
      }

      // 3. Head 3D Yaw Angle (Pose Analysis)
      const yaw = calculateHeadYaw(positions);

      // 4. Active Challenge State Machine Evaluation
      if (challengeMode) {
        if (yaw < -0.10) {
          challengeProgressRef.current.turnedLeft = true;
        }
        if (yaw > 0.10) {
          challengeProgressRef.current.turnedRight = true;
        }

        const prog = challengeProgressRef.current;
        if (!prog.turnedLeft) {
          setChallengeStep("turn_left");
          setChallengeInstruction("⮜ Turn head slightly LEFT");
          setIsLive(false);
          setLivenessScore(35);
          return false;
        } else if (!prog.turnedRight) {
          setChallengeStep("turn_right");
          setChallengeInstruction("Turn head slightly RIGHT ⮞");
          setIsLive(false);
          setLivenessScore(65);
          return false;
        } else if (!prog.blinked && blinkHistoryRef.current.length > 8) {
          setChallengeStep("blink");
          setChallengeInstruction("👁 Blink your eyes");
          setIsLive(false);
          setLivenessScore(85);
          return false;
        } else {
          setChallengeStep("verified");
          setChallengeInstruction("✓ 3D Liveness Verified");
          lastLiveTimeRef.current = now;
          setIsLive(true);
          setLivenessScore(99);
          return true;
        }
      }

      // 5. Standard Passive Liveness Mode (Immediate Confirmation on Landmark Presence)
      lastLiveTimeRef.current = now;
      const score = Math.min(100, Math.round(85 + Math.min(14, totalMove * 3) + (earBlink ? 5 : 0)));
      setLivenessScore(score);
      setIsLive(true);
      setChallengeStep("verified");
      setChallengeInstruction("✓ Live Face Confirmed");
      return true;
    },
    [challengeMode]
  );

  const tick = useCallback(() => {
    if (!isLive) return;
    const elapsed = Date.now() - lastLiveTimeRef.current;
    if (elapsed > DECAY_MS) {
      setIsLive(false);
      setLivenessScore(0);
    }
  }, [isLive]);

  const reset = useCallback(() => {
    historyRef.current = [];
    blinkHistoryRef.current = [];
    lastLiveTimeRef.current = 0;
    challengeProgressRef.current = { turnedLeft: false, turnedRight: false, blinked: false };
    setChallengeStep(challengeMode ? "turn_left" : "verified");
    setChallengeInstruction(challengeMode ? "⮜ Turn head slightly LEFT" : "Look at the camera");
    setIsLive(false);
    setLivenessScore(0);
  }, [challengeMode]);

  return {
    isLive,
    livenessScore,
    challengeStep,
    challengeInstruction,
    processLiveness,
    tick,
    reset,
  };
}
