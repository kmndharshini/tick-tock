import { normalizeHours, normalizeTime } from '../domain/clockModel';
import { TimeValue } from '../domain/types';

type AudioContextConstructor = typeof AudioContext;

let sharedAudioCtx: AudioContext | null = null;

function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    AudioContext?: AudioContextConstructor;
    webkitAudioContext?: AudioContextConstructor;
  };
  return win.AudioContext ?? win.webkitAudioContext ?? null;
}

function getOrCreateAudioContext(): AudioContext | null {
  const Ctor = getAudioContextConstructor();
  if (!Ctor) return null;

  if (!sharedAudioCtx) {
    try {
      sharedAudioCtx = new Ctor();
    } catch {
      return null;
    }
  }

  if (sharedAudioCtx.state === 'suspended') {
    try {
      const resumeResult = sharedAudioCtx.resume?.();
      if (resumeResult && typeof resumeResult.catch === 'function') {
        resumeResult.catch(() => {
          // Ignore autoplay-blocked resume rejections (EC-AUD-01)
        });
      }
    } catch {
      // Ignore synchronous resume errors
    }
  }

  return sharedAudioCtx;
}

/** Reset cached AudioContext reference (primarily for test isolation). */
export function resetAudioService(): void {
  sharedAudioCtx = null;
}

/**
 * Format a clock time into natural spoken English for TTS (EC-AUD-05).
 * Examples: "3 o'clock", "3 oh 5", "quarter past 3", "half past 3", "quarter to 4".
 */
export function formatTimeForSpeech(
  hoursOrTime: number | TimeValue,
  minutesArg?: number
): string {
  const raw: TimeValue =
    typeof hoursOrTime === 'number'
      ? { hours: hoursOrTime, minutes: minutesArg ?? 0 }
      : hoursOrTime;
  const { hours, minutes } = normalizeTime(raw);
  const nextHour = normalizeHours(hours + 1);

  if (minutes === 0) return `${hours} o'clock`;
  if (minutes === 15) return `quarter past ${hours}`;
  if (minutes === 30) return `half past ${hours}`;
  if (minutes === 45) return `quarter to ${nextHour}`;
  if (minutes < 10) return `${hours} oh ${minutes}`;
  return `${hours} ${minutes}`;
}

/** Replace digital HH:MM tokens in a prompt string with natural spoken phrasing. */
export function formatPromptForSpeech(text: string): string {
  return text.replace(/\b(\d{1,2}):(\d{2})\b/g, (_match, hStr, mStr) => {
    const h = Number(hStr);
    const m = Number(mStr);
    if (!Number.isFinite(h) || !Number.isFinite(m) || m < 0 || m > 59) {
      return _match;
    }
    return formatTimeForSpeech(h, m);
  });
}

export function isSpeechSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    Boolean(window.speechSynthesis) &&
    typeof window.speechSynthesis.speak === 'function'
  );
}

/** Immediately cancel any active or queued TTS utterance (EC-AUD-03). */
export function stopSpeech(): void {
  if (!isSpeechSupported()) return;
  try {
    window.speechSynthesis.cancel?.();
  } catch {
    // Safely ignore restricted WebView errors
  }
}

/**
 * Speak text aloud via Web Speech API, cancelling prior queued utterances first (EC-AUD-02).
 * Gracefully no-ops when disabled or unsupported (EC-AUD-04).
 */
export function speakText(
  text: string,
  options: { enabled?: boolean; rate?: number; pitch?: number } = {}
): boolean {
  const { enabled = true, rate = 0.95, pitch = 1.05 } = options;
  if (!enabled || !isSpeechSupported()) {
    return false;
  }

  const spoken = formatPromptForSpeech(text).trim();
  if (!spoken) return false;

  try {
    window.speechSynthesis.cancel?.();

    const utterance =
      typeof SpeechSynthesisUtterance !== 'undefined'
        ? new SpeechSynthesisUtterance(spoken)
        : ({ text: spoken } as SpeechSynthesisUtterance);

    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.lang = 'en-US';

    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

function playTone(
  frequencyStart: number,
  frequencyEnd: number,
  durationSec: number,
  gainPeak: number,
  type: OscillatorType = 'sine',
  delaySec = 0
): void {
  const ctx = getOrCreateAudioContext();
  if (!ctx) return;

  try {
    const startTime = ctx.currentTime + delaySec;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequencyStart, startTime);
    if (frequencyEnd !== frequencyStart) {
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(20, frequencyEnd),
        startTime + durationSec
      );
    }

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(gainPeak, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec);

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start(startTime);
    oscillator.stop(startTime + durationSec + 0.02);
  } catch {
    // Gracefully ignore audio scheduling failures
  }
}

/** Gentle woodblock-style tick when clock hands snap to a step. */
export function playTickSound(enabled = true): void {
  if (!enabled) return;
  playTone(760, 480, 0.035, 0.04, 'triangle');
}

/** Warm ascending chime when a learner answers correctly (zero harsh buzzers). */
export function playSuccessChime(enabled = true): void {
  if (!enabled) return;
  playTone(523.25, 523.25, 0.14, 0.08, 'sine', 0);
  playTone(659.25, 659.25, 0.14, 0.08, 'sine', 0.1);
  playTone(783.99, 783.99, 0.24, 0.09, 'sine', 0.2);
}

/** Soft neutral two-note cue when showing a helpful hint. */
export function playHintCue(enabled = true): void {
  if (!enabled) return;
  playTone(392, 440, 0.16, 0.055, 'sine', 0);
}

/** Immediately mute speech synthesis and suspend AudioContext when user toggles mute (EC-AUD-03). */
export function muteAllAudio(): void {
  stopSpeech();
  if (!sharedAudioCtx) return;
  try {
    if (sharedAudioCtx.state === 'running') {
      const suspendResult = sharedAudioCtx.suspend?.();
      if (suspendResult && typeof suspendResult.catch === 'function') {
        suspendResult.catch(() => {});
      }
    }
  } catch {
    // Ignore suspend errors
  }
}

