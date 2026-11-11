import {
  ArrowLeft,
  ArrowRight,
  Award,
  Check,
  Clock,
  RefreshCw,
  Sparkles,
  Timer,
  TimerOff,
  Trophy,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AnalogClock } from '../components/clock/AnalogClock';
import { TapToSetPad } from '../components/clock/TapToSetPad';
import { ChoiceGrid } from '../components/learning/ChoiceGrid';
import { DailyActivityCard } from '../components/learning/DailyActivityCard';
import { DigitalReadout } from '../components/learning/DigitalReadout';
import { HintBanner } from '../components/learning/HintBanner';
import { ReadAloudButton } from '../components/learning/ReadAloudButton';
import { describeClockTime } from '../domain/clockModel';
import {
  BADGE_DEFINITIONS,
  calculateRoundStars,
  getSkillDefinition,
} from '../domain/curriculum';
import {
  ExerciseQuestion,
  generateChallengeRound,
  generateQuestionFromReviewItem,
} from '../domain/exerciseGenerator';
import { MinuteLabelMode, TimeValue } from '../domain/types';
import { ValidationResult, validateExerciseAnswer } from '../domain/validator';
import {
  formatTimeForSpeech,
  playHintCue,
  playSuccessChime,
  playTickSound,
  speakText,
} from '../services/audioService';
import { useAppStore } from '../store/useAppStore';

export const CHALLENGE_DURATION_MS = 90_000;
const CHALLENGE_QUESTION_COUNT = 6;

type ChallengeMode = 'challenge' | 'review';
type ScreenPhase = 'setup' | 'playing' | 'review-empty' | 'summary';
type FinishReason = 'completed' | 'timeout';

const MINUTE_MODES: { value: MinuteLabelMode; label: string }[] = [
  { value: 'all', label: '00–59' },
  { value: 'fives', label: 'By 5s' },
  { value: 'none', label: 'Hide' },
];

export function formatCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function ChallengeScreen() {
  const [searchParams] = useSearchParams();
  const settings = useAppStore((s) => s.settings);
  const reviewQueue = useAppStore((s) => s.reviewQueue);
  const badges = useAppStore((s) => s.badges);
  const recordExerciseOutcome = useAppStore((s) => s.recordExerciseOutcome);
  const recordReviewAnswer = useAppStore((s) => s.recordReviewAnswer);
  const recordChallengeCompletion = useAppStore((s) => s.recordChallengeCompletion);

  const [phase, setPhase] = useState<ScreenPhase>(() => {
    const modeParam = searchParams.get('mode');
    if (modeParam === 'review' && useAppStore.getState().reviewQueue.length === 0) {
      return 'review-empty';
    }
    return 'setup';
  });
  const [mode, setMode] = useState<ChallengeMode>('challenge');
  const [useTimer, setUseTimer] = useState<boolean>(settings.challengeTimerEnabled);
  const [questions, setQuestions] = useState<ExerciseQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [minuteMode, setMinuteMode] = useState<MinuteLabelMode>(settings.minuteLabelMode);

  const [clockTime, setClockTime] = useState<TimeValue>({ hours: 6, minutes: 0 });
  const [activeTapHand, setActiveTapHand] = useState<'hour' | 'minute'>('minute');
  const [selectedChoice, setSelectedChoice] = useState<TimeValue | null>(null);
  const [feedback, setFeedback] = useState<ValidationResult | null>(null);
  const [hadMistake, setHadMistake] = useState(false);
  const [roundResolved, setRoundResolved] = useState(false);
  const [clockAnnouncement, setClockAnnouncement] = useState('');

  const [solvedCount, setSolvedCount] = useState(0);
  const [firstTryCount, setFirstTryCount] = useState(0);
  const [finishReason, setFinishReason] = useState<FinishReason>('completed');
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Timestamp-based timer state (EC-CUR-03)
  const [remainingMs, setRemainingMs] = useState(CHALLENGE_DURATION_MS);
  const endTimestampRef = useRef<number | null>(null);
  const pausedRemainingRef = useRef<number>(CHALLENGE_DURATION_MS);

  // Synchronous submission lock (EC-EX-04)
  const resolvedGuardRef = useRef(false);
  const promptHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const badgesBeforeRef = useRef<string[]>(badges);

  const currentQuestion = questions[questionIndex] ?? null;

  const resetQuestionInputs = (q: ExerciseQuestion) => {
    resolvedGuardRef.current = false;
    setClockTime(q.initialClockTime);
    setSelectedChoice(null);
    setFeedback(null);
    setHadMistake(false);
    setRoundResolved(false);
    setClockAnnouncement('');
  };

  const startChallenge = (timed: boolean) => {
    const generated = generateChallengeRound(CHALLENGE_QUESTION_COUNT);
    badgesBeforeRef.current = useAppStore.getState().badges;
    setMode('challenge');
    setUseTimer(timed);
    setQuestions(generated);
    setQuestionIndex(0);
    setSolvedCount(0);
    setFirstTryCount(0);
    setFinishReason('completed');
    setShowExitConfirm(false);
    resetQuestionInputs(generated[0]);

    if (timed) {
      endTimestampRef.current = Date.now() + CHALLENGE_DURATION_MS;
      pausedRemainingRef.current = CHALLENGE_DURATION_MS;
      setRemainingMs(CHALLENGE_DURATION_MS);
    } else {
      endTimestampRef.current = null;
      setRemainingMs(CHALLENGE_DURATION_MS);
    }
    setPhase('playing');
  };

  const startReviewMode = () => {
    const currentQueue = useAppStore.getState().reviewQueue;
    if (currentQueue.length === 0) {
      setMode('review');
      setPhase('review-empty');
      return;
    }
    const reviewQuestions = currentQueue.map((item) => generateQuestionFromReviewItem(item));
    badgesBeforeRef.current = useAppStore.getState().badges;
    setMode('review');
    setUseTimer(false);
    endTimestampRef.current = null;
    setQuestions(reviewQuestions);
    setQuestionIndex(0);
    setSolvedCount(0);
    setFirstTryCount(0);
    setFinishReason('completed');
    setShowExitConfirm(false);
    resetQuestionInputs(reviewQuestions[0]);
    setPhase('playing');
  };

  // Auto-open review if ?mode=review
  useEffect(() => {
    if (searchParams.get('mode') === 'review' && phase === 'setup') {
      startReviewMode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timestamp-delta countdown effect (EC-CUR-02, EC-CUR-03)
  useEffect(() => {
    if (phase !== 'playing' || mode !== 'challenge' || !useTimer || showExitConfirm) {
      return;
    }

    if (endTimestampRef.current === null) {
      endTimestampRef.current = Date.now() + pausedRemainingRef.current;
    }

    const syncClock = () => {
      if (endTimestampRef.current === null) return;
      const nextRemaining = Math.max(0, endTimestampRef.current - Date.now());
      setRemainingMs(nextRemaining);
      pausedRemainingRef.current = nextRemaining;

      if (nextRemaining <= 0) {
        endTimestampRef.current = null;
        setFinishReason('timeout');
        setPhase('summary');
        if (solvedCount > 0) {
          recordChallengeCompletion({
            solvedCount,
            firstTryCount,
            totalQuestions: questions.length,
          });
        }
      }
    };

    syncClock();
    const intervalId = window.setInterval(syncClock, 250);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncClock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [
    phase,
    mode,
    useTimer,
    showExitConfirm,
    solvedCount,
    firstTryCount,
    questions.length,
    recordChallengeCompletion,
  ]);

  const pauseForExitPrompt = () => {
    if (solvedCount === 0 && questionIndex === 0 && !hadMistake) {
      endTimestampRef.current = null;
      setPhase('setup');
      return;
    }
    if (useTimer && endTimestampRef.current !== null) {
      pausedRemainingRef.current = Math.max(0, endTimestampRef.current - Date.now());
      endTimestampRef.current = null;
    }
    setShowExitConfirm(true);
  };

  const resumeFromExitPrompt = () => {
    if (useTimer) {
      endTimestampRef.current = Date.now() + pausedRemainingRef.current;
    }
    setShowExitConfirm(false);
  };

  const confirmLeaveChallenge = () => {
    endTimestampRef.current = null;
    setShowExitConfirm(false);
    setPhase('setup');
  };

  const processAnswer = (answer: TimeValue) => {
    if (!currentQuestion || resolvedGuardRef.current || roundResolved) return;

    const validation = validateExerciseAnswer(currentQuestion, answer, {
      gearedHands: settings.gearedHands,
    });
    setFeedback(validation);

    if (validation.isCorrect) {
      resolvedGuardRef.current = true;
      setRoundResolved(true);
      playSuccessChime(settings.soundEnabled);
      const firstTry = !hadMistake;
      setSolvedCount((c) => c + 1);
      if (firstTry) {
        setFirstTryCount((c) => c + 1);
      }

      if (mode === 'review' && currentQuestion.reviewItemId) {
        recordReviewAnswer(currentQuestion.reviewItemId, true);
      } else {
        recordExerciseOutcome({
          skillId: currentQuestion.skillId,
          activityType: currentQuestion.activityType,
          targetTime: currentQuestion.targetTime,
          firstTry,
          starsToAward: 1,
        });
      }
    } else {
      setHadMistake(true);
      playHintCue(settings.soundEnabled);
    }

    if (settings.ttsEnabled && settings.soundEnabled) {
      speakText(validation.ariaAnnouncement, { enabled: true });
    }
  };

  const handleNextQuestion = () => {
    if (questionIndex + 1 >= questions.length) {
      endTimestampRef.current = null;
      if (mode === 'challenge') {
        recordChallengeCompletion({
          solvedCount,
          firstTryCount,
          totalQuestions: questions.length,
        });
      }
      setFinishReason('completed');
      setPhase('summary');
      return;
    }

    const nextIdx = questionIndex + 1;
    setQuestionIndex(nextIdx);
    resetQuestionInputs(questions[nextIdx]);
    window.setTimeout(() => {
      promptHeadingRef.current?.focus();
    }, 0);
  };

  const isClockInputActivity =
    currentQuestion?.activityType === 'set-time' ||
    currentQuestion?.activityType === 'match-analog';

  const spokenPromptText = currentQuestion
    ? currentQuestion.activityType === 'match-analog'
      ? `${currentQuestion.prompt} The digital time is ${formatTimeForSpeech(currentQuestion.targetTime)}.`
      : currentQuestion.prompt
    : '';

  useEffect(() => {
    if (
      phase === 'playing' &&
      currentQuestion &&
      settings.ttsEnabled &&
      settings.soundEnabled
    ) {
      speakText(spokenPromptText, { enabled: true });
    }
  }, [
    phase,
    currentQuestion,
    spokenPromptText,
    settings.ttsEnabled,
    settings.soundEnabled,
  ]);

  const newlyEarnedBadges = BADGE_DEFINITIONS.filter(
    (b) => badges.includes(b.id) && !badgesBeforeRef.current.includes(b.id)
  );

  const summaryStars = calculateRoundStars(
    solvedCount,
    firstTryCount,
    Math.max(1, questions.length)
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ink sm:text-3xl">Clock Challenge</h1>
          <p className="text-sm text-ink-muted sm:text-base">
            Test your clock skills at your own pace, race a gentle timer, or review tricky times.
          </p>
        </div>

        {phase === 'playing' && (
          <div className="flex flex-wrap items-center gap-2">
            {mode === 'challenge' && useTimer && (
              <span
                data-testid="challenge-timer"
                aria-label={`Time remaining ${formatCountdown(remainingMs)}`}
                className={[
                  'inline-flex min-h-[48px] items-center gap-1.5 rounded-2xl border-2 px-4 py-2 text-base font-extrabold',
                  remainingMs <= 15_000
                    ? 'border-hour bg-hour-soft text-hour-dark'
                    : 'border-minute/30 bg-minute-soft text-minute-dark',
                ].join(' ')}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                <Timer className="h-4 w-4" aria-hidden="true" />
                <span>{formatCountdown(remainingMs)}</span>
              </span>
            )}

            <span className="inline-flex min-h-[48px] items-center rounded-2xl border-2 border-surface-muted bg-surface-card px-4 py-2 text-sm font-extrabold text-ink">
              {mode === 'review' ? 'Review' : 'Challenge'} {questionIndex + 1} of{' '}
              {questions.length}
            </span>

            <button
              type="button"
              onClick={pauseForExitPrompt}
              className="touch-target inline-flex items-center gap-1.5 rounded-2xl border-2 border-surface-muted bg-surface-card px-4 py-2 text-sm font-extrabold text-ink hover:bg-surface-muted"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>Leave</span>
            </button>
          </div>
        )}
      </div>

      {/* Mid-challenge exit confirmation (EC-CUR-04) */}
      {showExitConfirm && phase === 'playing' && (
        <div
          role="alertdialog"
          aria-labelledby="exit-dialog-title"
          className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border-2 border-amber-400 bg-amber-50 p-5 shadow-sm"
        >
          <div>
            <h2 id="exit-dialog-title" className="text-lg font-extrabold text-amber-950">
              Leave this activity?
            </h2>
            <p className="text-sm font-semibold text-amber-900">
              Any stars you already earned are safely saved. Incomplete rounds won&apos;t count as
              finished.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={resumeFromExitPrompt}
              className="touch-target rounded-2xl bg-minute px-5 py-2.5 text-sm font-extrabold text-white hover:bg-minute-dark"
            >
              Keep Playing
            </button>
            <button
              type="button"
              onClick={confirmLeaveChallenge}
              className="touch-target rounded-2xl border-2 border-amber-400 bg-white px-5 py-2.5 text-sm font-extrabold text-amber-950 hover:bg-amber-100"
            >
              Leave Activity
            </button>
          </div>
        </div>
      )}

      {phase === 'setup' && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Mixed Challenge Card */}
          <section
            aria-labelledby="challenge-mode-heading"
            className="flex flex-col justify-between gap-5 rounded-3xl border-2 border-surface-muted bg-surface-card p-6 shadow-sm"
          >
            <div className="flex flex-col gap-4">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-300 bg-amber-50 text-amber-800">
                <Trophy className="h-6 w-6" aria-hidden="true" />
              </div>

              <div>
                <h2 id="challenge-mode-heading" className="text-xl font-extrabold text-ink sm:text-2xl">
                  Mixed Clock Challenge
                </h2>
                <p className="mt-1.5 text-sm text-ink-muted sm:text-base">
                  6 escalating questions from o&apos;clock and half past up to exact minutes and
                  daily routines.
                </p>
              </div>

              <div>
                <p className="text-xs font-extrabold uppercase tracking-wide text-ink-muted">
                  Choose Timer Preference
                </p>
                <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Challenge timer mode">
                  <button
                    type="button"
                    aria-pressed={!useTimer}
                    onClick={() => setUseTimer(false)}
                    className={[
                      'touch-target inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-extrabold transition-colors',
                      !useTimer
                        ? 'bg-minute text-white shadow-sm'
                        : 'border-2 border-surface-muted bg-surface text-ink hover:bg-surface-muted',
                    ].join(' ')}
                  >
                    <TimerOff className="h-4 w-4" aria-hidden="true" />
                    <span>Practice Without Timer</span>
                  </button>

                  <button
                    type="button"
                    aria-pressed={useTimer}
                    onClick={() => setUseTimer(true)}
                    className={[
                      'touch-target inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-extrabold transition-colors',
                      useTimer
                        ? 'bg-hour-dark text-white shadow-sm'
                        : 'border-2 border-surface-muted bg-surface text-ink hover:bg-surface-muted',
                    ].join(' ')}
                  >
                    <Timer className="h-4 w-4" aria-hidden="true" />
                    <span>Timed Challenge (90s)</span>
                  </button>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => startChallenge(useTimer)}
              className="touch-target inline-flex items-center justify-center gap-2 rounded-2xl bg-hour-dark px-6 py-3 text-base font-extrabold text-white shadow-sm hover:bg-hour"
            >
              <Sparkles className="h-5 w-5" aria-hidden="true" />
              <span>Start {useTimer ? 'Timed' : 'Untimed'} Challenge</span>
            </button>
          </section>

          {/* Review Weak Concepts Card */}
          <section
            aria-labelledby="review-mode-heading"
            className="flex flex-col justify-between gap-5 rounded-3xl border-2 border-surface-muted bg-surface-card p-6 shadow-sm"
          >
            <div className="flex flex-col gap-4">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-minute/30 bg-minute-soft text-minute-dark">
                <RefreshCw className="h-6 w-6" aria-hidden="true" />
              </div>

              <div>
                <h2 id="review-mode-heading" className="text-xl font-extrabold text-ink sm:text-2xl">
                  Review Weak Concepts
                </h2>
                <p className="mt-1.5 text-sm text-ink-muted sm:text-base">
                  Practise the specific clock times you missed earlier. Answer them to clear your
                  review list!
                </p>
              </div>

              <div className="rounded-2xl border-2 border-surface-muted bg-surface px-4 py-3">
                <span className="text-sm font-extrabold text-ink">
                  {reviewQueue.length === 0
                    ? '0 tricky times waiting — great job!'
                    : `${reviewQueue.length} ${reviewQueue.length === 1 ? 'time' : 'times'} ready to review`}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={startReviewMode}
              className="touch-target inline-flex items-center justify-center gap-2 rounded-2xl bg-minute px-6 py-3 text-base font-extrabold text-white shadow-sm hover:bg-minute-dark"
            >
              <RefreshCw className="h-5 w-5" aria-hidden="true" />
              <span>Open Review Mode</span>
            </button>
          </section>
        </div>
      )}

      {/* Empty Review Queue State (EC-CUR-01) */}
      {phase === 'review-empty' && (
        <section
          data-testid="review-empty-state"
          aria-label="Review queue empty"
          className="flex flex-col items-center gap-4 rounded-3xl border-2 border-emerald-300 bg-surface-card p-8 text-center shadow-sm"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-700">
            <Award className="h-9 w-9" aria-hidden="true" />
          </div>
          <h2 className="text-2xl font-extrabold text-ink">
            Nothing to review right now — great job!
          </h2>
          <p className="max-w-md text-base font-semibold text-ink-muted">
            You have cleared every tricky time. Try a Challenge round or explore the interactive
            clock!
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => startChallenge(false)}
              className="touch-target inline-flex items-center gap-2 rounded-2xl bg-hour-dark px-6 py-3 text-base font-extrabold text-white shadow-sm hover:bg-hour"
            >
              <Trophy className="h-5 w-5" aria-hidden="true" />
              <span>Try Untimed Challenge</span>
            </button>
            <Link
              to="/explore"
              className="touch-target inline-flex items-center gap-2 rounded-2xl border-2 border-surface-muted bg-surface px-5 py-3 text-base font-extrabold text-ink hover:bg-surface-muted"
            >
              <Clock className="h-5 w-5" aria-hidden="true" />
              <span>Explore Mode</span>
            </Link>
            <button
              type="button"
              onClick={() => setPhase('setup')}
              className="touch-target rounded-2xl border-2 border-surface-muted bg-surface-card px-5 py-3 text-base font-extrabold text-ink hover:bg-surface-muted"
            >
              Back to Challenge Menu
            </button>
          </div>
        </section>
      )}

      {/* Active Gameplay */}
      {phase === 'playing' && currentQuestion && (
        <div className="clock-stage-grid grid items-start gap-6 lg:grid-cols-[minmax(280px,420px)_1fr]">
          <section
            aria-label="Challenge visual panel"
            className="flex flex-col items-center gap-3 rounded-3xl border-2 border-surface-muted bg-surface-card p-4 shadow-sm sm:p-6"
          >
            {currentQuestion.activityType === 'daily-life' && currentQuestion.dailyRoutine ? (
              <DailyActivityCard routine={currentQuestion.dailyRoutine} className="w-full" />
            ) : (
              <>
                <div className="w-full max-w-[min(84vw,54vh,380px)]">
                  <AnalogClock
                    time={
                      currentQuestion.activityType === 'match-digital'
                        ? currentQuestion.targetTime
                        : clockTime
                    }
                    interactive={isClockInputActivity && !roundResolved && !showExitConfirm}
                    gearedHands={settings.gearedHands}
                    minuteLabelMode={minuteMode}
                    activeTapHand={isClockInputActivity ? activeTapHand : null}
                    showHandLabels={currentQuestion.showHandLabels}
                    onChange={(next) => {
                      if (!roundResolved) setClockTime(next);
                    }}
                    onCommit={(committed) => {
                      setClockAnnouncement(`Clock set to ${describeClockTime(committed)}`);
                      playTickSound(settings.soundEnabled);
                    }}
                  />
                </div>

                <div
                  className="flex flex-wrap items-center justify-center gap-1.5"
                  role="group"
                  aria-label="Minute label helper"
                >
                  {MINUTE_MODES.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={minuteMode === value}
                      onClick={() => setMinuteMode(value)}
                      className={[
                        'touch-target rounded-xl px-3 py-1.5 text-xs font-extrabold',
                        minuteMode === value
                          ? 'bg-minute text-white'
                          : 'bg-surface-muted text-ink hover:bg-minute-soft',
                      ].join(' ')}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <p className="sr-only" aria-live="polite">
                  {clockAnnouncement}
                </p>
              </>
            )}
          </section>

          <section className="flex flex-col gap-4" aria-label="Challenge question and answer">
            <div className="rounded-3xl border-2 border-surface-muted bg-surface-card p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-block rounded-full bg-minute-soft px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-minute-dark">
                  {getSkillDefinition(currentQuestion.skillId).shortLabel}
                </span>
                <ReadAloudButton text={spokenPromptText} label="Read question" />
              </div>
              <h2
                ref={promptHeadingRef}
                tabIndex={-1}
                className="mt-2 text-xl font-extrabold text-ink focus:outline-none sm:text-2xl"
              >
                {currentQuestion.prompt}
              </h2>

              {currentQuestion.activityType === 'match-analog' && (
                <DigitalReadout
                  time={currentQuestion.targetTime}
                  showWords={false}
                  className="mt-4"
                />
              )}
            </div>

            {isClockInputActivity ? (
              <TapToSetPad
                time={clockTime}
                gearedHands={settings.gearedHands}
                activeHand={activeTapHand}
                onActiveHandChange={setActiveTapHand}
                onChange={(next) => {
                  if (!roundResolved) setClockTime(next);
                }}
                onCommit={(committed) => {
                  setClockAnnouncement(`Clock set to ${describeClockTime(committed)}`);
                  playTickSound(settings.soundEnabled);
                }}
              />
            ) : (
              <ChoiceGrid
                choices={currentQuestion.choices}
                selectedChoice={selectedChoice}
                correctChoice={currentQuestion.targetTime}
                isResolved={roundResolved}
                onSelect={(choice) => {
                  if (resolvedGuardRef.current || roundResolved) return;
                  setSelectedChoice(choice);
                  processAnswer(choice);
                }}
              />
            )}

            <HintBanner result={feedback} />

            <div className="flex flex-wrap items-center gap-3">
              {isClockInputActivity && !roundResolved && (
                <button
                  type="button"
                  onClick={() => processAnswer(clockTime)}
                  className="touch-target inline-flex items-center gap-2 rounded-2xl bg-hour-dark px-6 py-3 text-base font-extrabold text-white shadow-sm hover:bg-hour"
                >
                  <Check className="h-5 w-5" aria-hidden="true" />
                  <span>Check Time</span>
                </button>
              )}

              {roundResolved && (
                <button
                  type="button"
                  onClick={handleNextQuestion}
                  className="touch-target inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-6 py-3 text-base font-extrabold text-white shadow-sm hover:bg-emerald-800"
                >
                  <span>
                    {questionIndex + 1 >= questions.length ? 'Finish' : 'Next Question'}
                  </span>
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </button>
              )}
            </div>
          </section>
        </div>
      )}

      {/* Summary Phase (Completed OR Graceful Timeout) */}
      {phase === 'summary' && (
        <section
          data-testid="challenge-summary"
          aria-label="Challenge summary"
          className="flex flex-col items-center gap-4 rounded-3xl border-2 border-emerald-300 bg-surface-card p-8 text-center shadow-sm"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-100 text-amber-700">
            <Trophy className="h-9 w-9" aria-hidden="true" />
          </div>

          <h2 className="text-2xl font-extrabold text-ink sm:text-3xl">
            {finishReason === 'timeout'
              ? "Time's up! Look at how many you solved!"
              : mode === 'review'
                ? 'Review Practice Complete!'
                : 'Challenge Complete!'}
          </h2>

          <p className="max-w-md text-base font-semibold text-ink-muted">
            You solved {solvedCount} out of {questions.length} clock questions
            {solvedCount > 0 ? ` (${firstTryCount} on your first try)` : ''}!
          </p>

          <div
            className="flex items-center gap-2 rounded-2xl border-2 border-amber-200 bg-amber-50 px-5 py-3 text-xl font-extrabold text-amber-800"
            aria-label={`Round rating ${summaryStars} out of 3 stars`}
          >
            {[1, 2, 3].map((idx) => (
              <span key={idx} aria-hidden="true">
                {idx <= summaryStars ? '★' : '☆'}
              </span>
            ))}
            <span className="ml-2 text-sm font-bold text-amber-900">
              +{solvedCount} {solvedCount === 1 ? 'Star' : 'Stars'} Saved
            </span>
          </div>

          {newlyEarnedBadges.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2">
              {newlyEarnedBadges.map((badge) => (
                <span
                  key={badge.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-minute/30 bg-minute-soft px-3.5 py-1.5 text-xs font-extrabold text-minute-dark"
                >
                  <Award className="h-4 w-4" aria-hidden="true" />
                  <span>Badge Unlocked: {badge.title}</span>
                </span>
              ))}
            </div>
          )}

          <div className="mt-2 flex flex-wrap justify-center gap-3">
            {mode === 'challenge' ? (
              <button
                type="button"
                onClick={() => startChallenge(useTimer)}
                className="touch-target inline-flex items-center gap-2 rounded-2xl bg-hour-dark px-6 py-3 text-base font-extrabold text-white shadow-sm hover:bg-hour"
              >
                <Sparkles className="h-5 w-5" aria-hidden="true" />
                <span>Play Challenge Again</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={startReviewMode}
                className="touch-target inline-flex items-center gap-2 rounded-2xl bg-minute px-6 py-3 text-base font-extrabold text-white shadow-sm hover:bg-minute-dark"
              >
                <RefreshCw className="h-5 w-5" aria-hidden="true" />
                <span>Check Review List</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setPhase('setup')}
              className="touch-target rounded-2xl border-2 border-surface-muted bg-surface px-5 py-3 text-base font-extrabold text-ink hover:bg-surface-muted"
            >
              Challenge Menu
            </button>

            <Link
              to="/progress"
              className="touch-target inline-flex items-center gap-2 rounded-2xl border-2 border-surface-muted bg-surface-card px-5 py-3 text-base font-extrabold text-ink hover:bg-surface-muted"
            >
              <Award className="h-5 w-5" aria-hidden="true" />
              <span>View Progress</span>
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
