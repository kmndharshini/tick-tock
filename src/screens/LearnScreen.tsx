import { ArrowLeft, ArrowRight, Pause, Play, RotateCcw, Target } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnalogClock } from '../components/clock/AnalogClock';
import { DigitalReadout } from '../components/learning/DigitalReadout';
import { ReadAloudButton } from '../components/learning/ReadAloudButton';
import { stepMinutes } from '../domain/clockMath';
import { MinuteLabelMode, SkillId, TimeValue } from '../domain/types';
import { playTickSound, speakText } from '../services/audioService';
import { useAppStore } from '../store/useAppStore';

interface LessonDefinition {
  id: string;
  stepNumber: number;
  title: string;
  summary: string;
  tip: string;
  practiceSkill: SkillId;
  initialTime: TimeValue;
  defaultMinuteMode: MinuteLabelMode;
  showHandLabels: boolean;
  highlightHand: 'hour' | 'minute' | 'both' | null;
  highlightNumbers: boolean;
}

const LESSONS: LessonDefinition[] = [
  {
    id: 'numbers',
    stepNumber: 1,
    title: 'Meet the Clock Numbers 1 to 12',
    summary:
      'Every analog clock has 12 big hour numbers arranged in a circle, starting with 12 at the very top.',
    tip: 'Follow the circle clockwise from 12 → 1 → 2 → 3 all the way back to 12!',
    practiceSkill: 'clock-parts',
    initialTime: { hours: 12, minutes: 0 },
    defaultMinuteMode: 'none',
    showHandLabels: false,
    highlightHand: null,
    highlightNumbers: true,
  },
  {
    id: 'hands',
    stepNumber: 2,
    title: 'Short Hour Hand vs. Long Minute Hand',
    summary:
      'The short, thick coral arrow (H) points to the hour. The long, slender blue spear (M) points to the minutes.',
    tip: 'Even without colors, you can tell them apart by length and shape: Short = Hour, Long = Minute!',
    practiceSkill: 'oclock',
    initialTime: { hours: 3, minutes: 0 },
    defaultMinuteMode: 'none',
    showHandLabels: true,
    highlightHand: 'both',
    highlightNumbers: false,
  },
  {
    id: 'rotation',
    stepNumber: 3,
    title: '60 Minutes Make 1 Whole Hour',
    summary:
      'Watch what happens when the long minute hand travels all the way around the 60 minute marks: the short hour hand moves forward by 1 hour!',
    tip: 'Press Play to watch 12:00 travel 60 minutes to 1:00, or drag the minute hand yourself.',
    practiceSkill: 'half-past',
    initialTime: { hours: 12, minutes: 0 },
    defaultMinuteMode: 'fives',
    showHandLabels: true,
    highlightHand: 'minute',
    highlightNumbers: false,
  },
  {
    id: 'minutes-ring',
    stepNumber: 4,
    title: 'Counting by 5s & All 00–59 Minutes',
    summary:
      'Each big number is 5 minutes apart (00, 05, 10, 15...). Between 00 and 05 sit four tiny minutes: 01, 02, 03, and 04!',
    tip: 'Switch between "By 5s" and "All 00–59" to see how every single minute fits around the clock.',
    practiceSkill: 'five-minutes',
    initialTime: { hours: 2, minutes: 5 },
    defaultMinuteMode: 'all',
    showHandLabels: true,
    highlightHand: 'minute',
    highlightNumbers: false,
  },
];

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function LearnScreen() {
  const settings = useAppStore((s) => s.settings);
  const [stepIndex, setStepIndex] = useState(0);
  const lesson = LESSONS[stepIndex];

  const [time, setTime] = useState<TimeValue>(lesson.initialTime);
  const [minuteMode, setMinuteMode] = useState<MinuteLabelMode>(lesson.defaultMinuteMode);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    setIsAnimating(false);
    setTime(lesson.initialTime);
    setMinuteMode(lesson.defaultMinuteMode);
    if (settings.ttsEnabled && settings.soundEnabled) {
      speakText(`${lesson.title}. ${lesson.summary}`, { enabled: true });
    }
  }, [lesson, settings.ttsEnabled, settings.soundEnabled]);

  useEffect(() => {
    if (!isAnimating) return;

    const reduced = prefersReducedMotion();
    if (reduced) {
      const timer = window.setTimeout(() => {
        setTime({ hours: 1, minutes: 0 });
        setIsAnimating(false);
      }, 250);
      return () => window.clearTimeout(timer);
    }

    let stepsRemaining = 60;
    const interval = window.setInterval(() => {
      stepsRemaining -= 1;
      setTime((prev) => stepMinutes(prev, 1, true));
      if (stepsRemaining <= 0) {
        setIsAnimating(false);
      }
    }, 55);

    return () => window.clearInterval(interval);
  }, [isAnimating]);

  const startDemo = () => {
    setTime({ hours: 12, minutes: 0 });
    setIsAnimating(true);
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ink sm:text-3xl">Learn the Clock</h1>
          <p className="text-sm text-ink-muted sm:text-base">
            Step {lesson.stepNumber} of {LESSONS.length}: Guided clock discovery
          </p>
        </div>

        {/* Step Pills */}
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Learn steps">
          {LESSONS.map((item, idx) => {
            const active = idx === stepIndex;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setStepIndex(idx)}
                className={[
                  'touch-target rounded-2xl px-4 py-2 text-sm font-extrabold transition-colors',
                  active
                    ? 'bg-minute text-white shadow-sm'
                    : 'bg-surface-card text-ink border-2 border-surface-muted hover:bg-surface-muted',
                ].join(' ')}
              >
                {item.stepNumber}. {item.id === 'numbers' ? 'Numbers' : item.id === 'hands' ? 'Hands' : item.id === 'rotation' ? '60 Mins' : '00–59'}
              </button>
            );
          })}
        </div>
      </div>

      <div className="clock-stage-grid grid items-start gap-6 lg:grid-cols-[minmax(280px,420px)_1fr]">
        <section
          aria-label="Lesson interactive clock"
          className="flex flex-col items-center rounded-3xl border-2 border-surface-muted bg-surface-card p-4 shadow-sm sm:p-6"
        >
          <div className="w-full max-w-[min(84vw,54vh,380px)]">
            <AnalogClock
              time={time}
              interactive
              gearedHands
              minuteLabelMode={minuteMode}
              showHandLabels={lesson.showHandLabels}
              highlightHand={lesson.highlightHand}
              highlightNumbers={lesson.highlightNumbers}
              onChange={(next) => {
                setIsAnimating(false);
                setTime(next);
              }}
              onCommit={() => playTickSound(settings.soundEnabled)}
            />
          </div>
          <DigitalReadout time={time} className="mt-4 w-full max-w-xs" />
        </section>

        <section className="flex flex-col gap-4 rounded-3xl border-2 border-surface-muted bg-surface-card p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="text-xl font-extrabold text-ink sm:text-2xl">{lesson.title}</h2>
            <ReadAloudButton
              text={`${lesson.title}. ${lesson.summary} Tip: ${lesson.tip}`}
              label="Read lesson"
            />
          </div>
          <p className="text-base leading-relaxed text-ink">{lesson.summary}</p>

          <div className="rounded-2xl border-2 border-hour/25 bg-hour-soft p-4 text-sm font-bold text-hour-dark">
            Tip: {lesson.tip}
          </div>

          {lesson.id === 'hands' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border-2 border-hour/30 bg-hour-soft/50 p-3">
                <p className="text-sm font-extrabold text-hour-dark">Hour Hand (H)</p>
                <p className="mt-1 text-xs font-semibold text-ink-muted">
                  Shorter, wider coral arrow — points to the big hour numbers 1–12.
                </p>
              </div>
              <div className="rounded-2xl border-2 border-minute/30 bg-minute-soft/50 p-3">
                <p className="text-sm font-extrabold text-minute-dark">Minute Hand (M)</p>
                <p className="mt-1 text-xs font-semibold text-ink-muted">
                  Longer, slimmer blue spear — reaches out to the 60 minute ticks.
                </p>
              </div>
            </div>
          )}

          {lesson.id === 'rotation' && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={isAnimating ? () => setIsAnimating(false) : startDemo}
                className="touch-target inline-flex items-center gap-2 rounded-2xl bg-minute px-5 py-2.5 text-sm font-extrabold text-white hover:bg-minute-dark"
              >
                {isAnimating ? (
                  <>
                    <Pause className="h-4 w-4" aria-hidden="true" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" aria-hidden="true" />
                    <span>Play 60-Minute Demo</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAnimating(false);
                  setTime({ hours: 12, minutes: 0 });
                }}
                className="touch-target inline-flex items-center gap-2 rounded-2xl border-2 border-surface-muted bg-surface px-4 py-2.5 text-sm font-extrabold text-ink hover:bg-surface-muted"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                <span>Reset</span>
              </button>
            </div>
          )}

          {lesson.id === 'minutes-ring' && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Lesson minute labels">
              <button
                type="button"
                aria-pressed={minuteMode === 'fives'}
                onClick={() => setMinuteMode('fives')}
                className={[
                  'touch-target rounded-xl px-4 py-2 text-sm font-extrabold',
                  minuteMode === 'fives'
                    ? 'bg-minute text-white'
                    : 'bg-surface-muted text-ink hover:bg-minute-soft',
                ].join(' ')}
              >
                By 5s (00, 05, 10...)
              </button>
              <button
                type="button"
                aria-pressed={minuteMode === 'all'}
                onClick={() => setMinuteMode('all')}
                className={[
                  'touch-target rounded-xl px-4 py-2 text-sm font-extrabold',
                  minuteMode === 'all'
                    ? 'bg-minute text-white'
                    : 'bg-surface-muted text-ink hover:bg-minute-soft',
                ].join(' ')}
              >
                All 00–59 Minutes
              </button>
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t-2 border-surface-muted pt-4">
            <div className="flex gap-2">
              <button
                type="button"
                disabled={stepIndex === 0}
                onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                className="touch-target inline-flex items-center gap-1.5 rounded-2xl border-2 border-surface-muted bg-surface px-4 py-2 text-sm font-extrabold text-ink disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                <span>Previous</span>
              </button>
              <button
                type="button"
                disabled={stepIndex === LESSONS.length - 1}
                onClick={() => setStepIndex((i) => Math.min(LESSONS.length - 1, i + 1))}
                className="touch-target inline-flex items-center gap-1.5 rounded-2xl border-2 border-surface-muted bg-surface px-4 py-2 text-sm font-extrabold text-ink disabled:opacity-40"
              >
                <span>Next</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <Link
              to={`/exercise?skill=${lesson.practiceSkill}`}
              className="touch-target inline-flex items-center gap-2 rounded-2xl bg-hour-dark px-5 py-2.5 text-sm font-extrabold text-white shadow-sm hover:bg-hour"
            >
              <Target className="h-4 w-4" aria-hidden="true" />
              <span>Practice This Now</span>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
