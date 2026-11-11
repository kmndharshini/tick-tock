import { Eye, EyeOff, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { AnalogClock } from '../components/clock/AnalogClock';
import { TapToSetPad } from '../components/clock/TapToSetPad';
import { DigitalReadout } from '../components/learning/DigitalReadout';
import { ReadAloudButton } from '../components/learning/ReadAloudButton';
import { describeClockTime } from '../domain/clockModel';
import { MinuteLabelMode, TimeValue } from '../domain/types';
import {
  formatTimeForSpeech,
  playTickSound,
  speakText,
} from '../services/audioService';
import { useAppStore } from '../store/useAppStore';

const MINUTE_MODES: { value: MinuteLabelMode; label: string }[] = [
  { value: 'all', label: 'All 00–59' },
  { value: 'fives', label: 'By 5s' },
  { value: 'none', label: 'Hide' },
];

const QUICK_PRESETS: { label: string; time: TimeValue }[] = [
  { label: "O'clock (3:00)", time: { hours: 3, minutes: 0 } },
  { label: 'Half Past (3:30)', time: { hours: 3, minutes: 30 } },
  { label: 'Quarter Past (3:15)', time: { hours: 3, minutes: 15 } },
  { label: 'Quarter To (3:45)', time: { hours: 3, minutes: 45 } },
];

export function InteractiveClockScreen() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);

  const [time, setTime] = useState<TimeValue>({ hours: 3, minutes: 0 });
  const [activeTapHand, setActiveTapHand] = useState<'hour' | 'minute'>('minute');
  const [showHandLabels, setShowHandLabels] = useState(true);
  const [announcement, setAnnouncement] = useState('');

  const handleCommit = (committed: TimeValue) => {
    setAnnouncement(`Clock set to ${describeClockTime(committed)}`);
    playTickSound(settings.soundEnabled);
    if (settings.ttsEnabled && settings.soundEnabled) {
      speakText(`It is ${formatTimeForSpeech(committed)}`, { enabled: true });
    }
  };

  const applyPreset = (presetTime: TimeValue) => {
    setTime(presetTime);
    handleCommit(presetTime);
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ink sm:text-3xl">Interactive Clock</h1>
          <p className="text-sm text-ink-muted sm:text-base">
            Drag the hands, tap around the dial, or use arrow keys to explore time.
          </p>
        </div>

        <button
          type="button"
          onClick={() => applyPreset({ hours: 12, minutes: 0 })}
          className="touch-target inline-flex items-center gap-2 rounded-2xl border-2 border-surface-muted bg-surface-card px-4 py-2 text-sm font-extrabold text-ink hover:bg-surface-muted"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          <span>Reset 12:00</span>
        </button>
      </div>

      <div className="clock-stage-grid grid items-start gap-6 lg:grid-cols-[minmax(280px,440px)_1fr]">
        {/* Clock Dial Surface */}
        <section
          aria-label="Interactive analog clock"
          className="flex flex-col items-center rounded-3xl border-2 border-surface-muted bg-surface-card p-4 shadow-sm sm:p-6"
        >
          <div className="w-full max-w-[min(84vw,56vh,400px)]">
            <AnalogClock
              time={time}
              interactive
              gearedHands={settings.gearedHands}
              minuteLabelMode={settings.minuteLabelMode}
              activeTapHand={activeTapHand}
              showHandLabels={showHandLabels}
              onChange={setTime}
              onCommit={handleCommit}
            />
          </div>

          <p className="sr-only" aria-live="polite">
            {announcement}
          </p>
        </section>

        {/* Controls & Digital Readout */}
        <section className="flex flex-col gap-4" aria-label="Clock controls">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wide text-ink-muted">
                Digital Readout
              </span>
              <div className="flex items-center gap-2">
                <ReadAloudButton
                  text={`It is ${formatTimeForSpeech(time)}`}
                  label="Speak Time"
                />
                <button
                  type="button"
                  aria-pressed={settings.showDigitalOnExplore}
                  onClick={() =>
                    updateSettings({ showDigitalOnExplore: !settings.showDigitalOnExplore })
                  }
                  className="touch-target inline-flex items-center gap-1.5 rounded-xl border-2 border-surface-muted bg-surface-card px-3 py-1.5 text-xs font-extrabold text-ink hover:bg-surface-muted"
                >
                  {settings.showDigitalOnExplore ? (
                    <>
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                      <span>Hide Digital</span>
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4" aria-hidden="true" />
                      <span>Show Digital</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <DigitalReadout time={time} visible={settings.showDigitalOnExplore} />
          </div>

          {/* Minute Ring Selector */}
          <div className="rounded-2xl border-2 border-surface-muted bg-surface-card p-4">
            <p className="text-xs font-extrabold uppercase tracking-wide text-ink-muted">
              Minute Labels Around Clock
            </p>
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Minute labels mode">
              {MINUTE_MODES.map(({ value, label }) => {
                const selected = settings.minuteLabelMode === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => updateSettings({ minuteLabelMode: value })}
                    className={[
                      'touch-target rounded-xl px-4 py-2 text-sm font-extrabold transition-colors',
                      selected
                        ? 'bg-minute text-white shadow-sm'
                        : 'bg-surface-muted text-ink hover:bg-minute-soft',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                aria-pressed={settings.gearedHands}
                onClick={() => updateSettings({ gearedHands: !settings.gearedHands })}
                className={[
                  'touch-target rounded-xl border-2 px-4 py-2 text-sm font-extrabold',
                  settings.gearedHands
                    ? 'border-hour bg-hour-soft text-hour-dark'
                    : 'border-surface-muted bg-surface text-ink-muted',
                ].join(' ')}
              >
                {settings.gearedHands ? 'Geared Hands: On' : 'Geared Hands: Off'}
              </button>

              <button
                type="button"
                aria-pressed={showHandLabels}
                onClick={() => setShowHandLabels((v) => !v)}
                className={[
                  'touch-target rounded-xl border-2 px-4 py-2 text-sm font-extrabold',
                  showHandLabels
                    ? 'border-minute bg-minute-soft text-minute-dark'
                    : 'border-surface-muted bg-surface text-ink-muted',
                ].join(' ')}
              >
                {showHandLabels ? 'H / M Tags: On' : 'H / M Tags: Off'}
              </button>
            </div>
          </div>

          {/* Tap-to-Set & Steppers */}
          <TapToSetPad
            time={time}
            gearedHands={settings.gearedHands}
            activeHand={activeTapHand}
            onActiveHandChange={setActiveTapHand}
            onChange={setTime}
            onCommit={handleCommit}
          />

          {/* Quick Benchmark Presets */}
          <div className="rounded-2xl border-2 border-surface-muted bg-surface-card p-4">
            <p className="text-xs font-extrabold uppercase tracking-wide text-ink-muted">
              Try a Time Benchmark
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {QUICK_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(preset.time)}
                  className="touch-target rounded-xl border border-surface-muted bg-surface px-3 py-2 text-sm font-bold text-ink hover:border-minute hover:bg-minute-soft"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
