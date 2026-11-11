import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  formatPromptForSpeech,
  formatTimeForSpeech,
  muteAllAudio,
  playHintCue,
  playSuccessChime,
  playTickSound,
  resetAudioService,
  speakText,
} from '../../src/services/audioService';
import { useAppStore } from '../../src/store/useAppStore';

describe('Phase 6: audioService (Web Speech & Web Audio)', () => {
  const originalSpeechSynthesis = window.speechSynthesis;
  const originalUtterance = globalThis.SpeechSynthesisUtterance;
  const originalAudioContext = window.AudioContext;

  beforeEach(() => {
    resetAudioService();
    localStorage.clear();
    useAppStore.getState().resetProgress();
  });

  afterEach(() => {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      writable: true,
      value: originalSpeechSynthesis,
    });
    globalThis.SpeechSynthesisUtterance = originalUtterance;
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      writable: true,
      value: originalAudioContext,
    });
    vi.restoreAllMocks();
  });

  it('formats natural spoken clock phrases (EC-AUD-05)', () => {
    expect(formatTimeForSpeech(3, 0)).toBe("3 o'clock");
    expect(formatTimeForSpeech(3, 5)).toBe('3 oh 5');
    expect(formatTimeForSpeech(3, 15)).toBe('quarter past 3');
    expect(formatTimeForSpeech(3, 30)).toBe('half past 3');
    expect(formatTimeForSpeech(3, 45)).toBe('quarter to 4');
    expect(formatTimeForSpeech({ hours: 12, minutes: 22 })).toBe('12 22');
    expect(formatPromptForSpeech('Show 3:05 on the clock')).toBe('Show 3 oh 5 on the clock');
  });

  it('calls speechSynthesis.cancel() immediately before every speak() call (EC-AUD-02)', () => {
    const callOrder: string[] = [];
    const cancelMock = vi.fn(() => callOrder.push('cancel'));
    const speakMock = vi.fn(() => callOrder.push('speak'));

    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      writable: true,
      value: { cancel: cancelMock, speak: speakMock },
    });
    globalThis.SpeechSynthesisUtterance = vi.fn().mockImplementation((text: string) => ({
      text,
      rate: 1,
      pitch: 1,
      lang: 'en-US',
    })) as unknown as typeof SpeechSynthesisUtterance;

    expect(speakText('Can you show 3 o’clock?')).toBe(true);
    expect(speakText('quarter past 3')).toBe(true);
    expect(callOrder).toEqual(['cancel', 'speak', 'cancel', 'speak']);
  });

  it('stops speech and suspends AudioContext immediately when muted (EC-AUD-03)', () => {
    const cancelMock = vi.fn();
    const suspendMock = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      writable: true,
      value: { cancel: cancelMock, speak: vi.fn() },
    });

    const mockOsc = {
      type: 'sine',
      frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
    const mockGain = {
      gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
    };

    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        state: 'running',
        currentTime: 0,
        destination: {},
        createOscillator: () => mockOsc,
        createGain: () => mockGain,
        suspend: suspendMock,
        resume: vi.fn().mockResolvedValue(undefined),
      })),
    });

    playSuccessChime(true);
    useAppStore.getState().toggleSound();

    expect(cancelMock).toHaveBeenCalled();
    expect(suspendMock).toHaveBeenCalled();

    muteAllAudio();
    expect(cancelMock).toHaveBeenCalledTimes(2);
  });

  it('gracefully no-ops when speechSynthesis is undefined (EC-AUD-04)', () => {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      writable: true,
      value: undefined,
    });

    expect(() => speakText('3 o clock')).not.toThrow();
    expect(speakText('3 o clock')).toBe(false);
  });

  it('handles suspended AudioContext whose resume() rejects without unhandled rejection (EC-AUD-01)', () => {
    const mockOsc = {
      type: 'sine',
      frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
    const mockGain = {
      gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
    };

    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        state: 'suspended',
        currentTime: 0,
        destination: {},
        createOscillator: () => mockOsc,
        createGain: () => mockGain,
        resume: vi.fn().mockRejectedValue(new Error('Autoplay blocked')),
        suspend: vi.fn().mockResolvedValue(undefined),
      })),
    });

    expect(() => {
      playTickSound(true);
      playSuccessChime(true);
      playHintCue(true);
    }).not.toThrow();
  });
});

