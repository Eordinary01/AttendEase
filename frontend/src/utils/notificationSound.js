// frontend/src/utils/notificationSound.js
/**
 * notificationSound.js
 * Synthesizes a gentle, premium notification chime using the Web Audio API.
 * No external audio files or network requests required.
 */

const STORAGE_KEY = 'attendease_notification_sound';

let audioCtx = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function isNotificationSoundEnabled() {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    return val !== 'false'; // Default to true
  } catch {
    return true;
  }
}

export function setNotificationSoundEnabled(enabled) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Plays a pleasant 2-tone melodic notification chime
 * Tone 1: E5 (659.25 Hz), Tone 2: A5 (880 Hz)
 */
export function playNotificationChime() {
  if (!isNotificationSoundEnabled()) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // First note: 659.25 Hz (E5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);

    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.exponentialRampToValueAtTime(0.18, now + 0.03);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.35);

    // Second note: 880.00 Hz (A5), slight delay
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.0, now + 0.12);

    gain2.gain.setValueAtTime(0.001, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.22, now + 0.16);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc2.start(now + 0.12);
    osc2.stop(now + 0.55);
  } catch (err) {
    // AudioContext autoplay restrictions or device mute
  }
}
