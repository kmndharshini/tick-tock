import { ArrowRight, Check, Lock, RotateCcw, Sparkles, Trophy } from 'lucide-react';
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
  getNextSkillId,
  getSkillDefinition,
  isSkillEffectivelyUnlocked,
} from '../domain/curriculum';
import {
  ExerciseQuestion,
  generateExerciseRound,
} from '../domain/exerciseGenerator';
import {
  ActivityType,
  MinuteLabelMode,
  SKILL_ORDER,
  SkillId,
  TimeValue,
} from '../domain/types';
import { ValidationResult, validateExerciseAnswer } from '../domain/validator';
import {
  formatTimeForSpeech,
  playHintCue,
  playSuccessChime,
  playTickSound,
  speakText,
} from '../services/audioService';
import { useAppStore } from '../store/useAppStore';

const ROUND_SIZE = 5;

const SKILL_LABELS: Record<SkillId, string> = {
  'clock-parts': 'Clock Parts',
  oclock: "O'Clock",
  'half-past': 'Half Past',
  'quarter-past-to': 'Quarter Past & To',
  'five-minutes': 'By 5 Minutes',
  'exact-minutes': 'Exact Minutes',
  'daily-life': 'Daily Life',
  'challenge-mix': 'Mixed Practice',
};

type ActivityFilter = 'mix' | ActivityType;

const ACTIVITY_FILTERS: { value: ActivityFilter; label: string }[] = [
  { value: 'mix', label: 'All Types' },
  { value: 'set-time', label: 'Set Time' },
  { value: 'match-digital', label: 'Analog → Digital' },
  { value: 'match-analog', label: 'Digital → Analog' },
  { value: 'daily-life', label: 'Daily Life' },
];

const MINUTE_MODES: { value: MinuteLabelMode; label: string }[] = [
  { value: 'all', label: '00–59' },
  { value: 'fives', label: 'By 5s' },
  { value: 'none', label: 'Hide' },
];

function parseSkillParam(raw: string | null): SkillId {
  if (raw && SKILL_ORDER.includes(raw as SkillId)) {
    return raw as SkillId;
  }
  return 'oclock';
}

function parseActivityParam(raw: string | null): ActivityFilter {
  if (
    raw === 'set-time' ||
    raw === 'match-digital' ||
    raw === 'match-analog' ||
    raw === 'daily-life'
  ) {
    return raw;
  }
  return 'mix';
}

export function ExerciseScreen() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSkill = parseSkillParam(searchParams.get('skill'));
  const initialActivity = parseActivityParam(searchParams.get('type'));

  const settings = useAppStore((s) => s.settings);
  const skills = useAppStore((s) => s.skills);
  const recordExerciseOutcome = useAppStore((s) => s.recordExerciseOutcome);
  const completeSkillModule = useAppStore((s) => s.completeSkillModule);

  const [selectedSkill, setSelectedSkill] = useState<SkillId>(initialSkill);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>(initialActivity);
  const [minuteMode, setMinuteMode] = useState<MinuteLabelMode>(settings.minuteLabelMode);

  const [questions, setQuestions] = useState<ExerciseQuestion[]>(() =>
    generateExerciseRound(
      initialSkill,
      ROUND_SIZE,
      initialActivity === 'mix' ? undefined : initialActivity
    )
  );
  const [questionIndex, setQuestionIndex] = useState(0);
  const [roundComplete, setRoundComplete] = useState(false);

  const currentQuestion = questions[questionIndex];

  const [clockTime, setClockTime] = useState<TimeValue>(
    () => currentQuestion.initialClockTime
  );
  const [activeTapHand, setActiveTapHand] = useState<'hour' | 'minute'>('minute');
  const [selectedChoice, setSelectedChoice] = useState<TimeValue | null>(null);
  const [feedback, setFeedback] = useState<ValidationResult | null>(null);
  const [hadMistake, setHadMistake] = useState(false);
  const [roundResolved, setRoundResolved] = useState(false);
  const [roundStars, setRoundStars] = useState(0);
  const [firstTryWins, setFirstTryWins] = useState(0);
  const [clockAnnouncement, setClockAnnouncement] = useState('');

  // Synchronous guard preventing double-click/rapid-tap duplicate submissions (EC-EX-04)
  const resolvedGuardRef = useRef(false);
  const promptHeadingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    const paramSkill = parseSkillParam(searchParams.get('skill'));
    const paramActivity = parseActivityParam(searchParams.get('type'));
    if (searchParams.has('skill') && paramSkill !== selectedSkill) {
      startNewRound(paramSkill, paramActivity);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const resetQuestionState = (nextQuestion: ExerciseQuestion) => {
    resolvedGuardRef.current = false;
    setClockTime(nextQuestion.initialClockTime);
    setSelectedChoice(null);
    setFeedback(null);
    setHadMistake(false);
    setRoundResolved(false);
    setClockAnnouncement('');
  };

  const startNewRound = (skill: SkillId, filter: ActivityFilter) => {
    const nextSkill = filter === 'daily-life' ? 'daily-life' : skill;
    const nextQuestions = generateExerciseRound(
      nextSkill,
      ROUND_SIZE,
      filter === 'mix' ? undefined : filter
    );
    setSelectedSkill(nextSkill);
    setActivityFilter(filter);
    setQuestions(nextQuestions);
    setQuestionIndex(0);
    setRoundComplete(false);
    setRoundStars(0);
    setFirstTryWins(0);
    resetQuestionState(nextQuestions[0]);
  };

  const handleSkillChange = (skill: SkillId) => {
    const nextFilter: ActivityFilter =
      skill === 'daily-life' ? 'daily-life' : activityFilter === 'daily-life' ? 'mix' : activityFilter;
    setSearchParams({ skill });
    startNewRound(skill, nextFilter);
  };

  const handleActivityFilterChange = (filter: ActivityFilter) => {
    const nextSkill: SkillId =
      filter === 'daily-life'
        ? 'daily-life'
        : selectedSkill === 'daily-life'
          ? 'oclock'
          : selectedSkill;
    setSearchParams({ skill: nextSkill, ...(filter !== 'mix' ? { type: filter } : {}) });
    startNewRound(nextSkill, filter);
  };

  const processAnswer = (answer: TimeValue) => {
    if (resolvedGuardRef.current || roundResolved) return;

    const validation = validateExerciseAnswer(currentQuestion, answer, {
      gearedHands: settings.gearedHands,
    });
    setFeedback(validation);

    if (validation.isCorrect) {
      resolvedGuardRef.current = true;
      setRoundResolved(true);
      playSuccessChime(settings.soundEnabled);
      const firstTry = !hadMistake;
      if (firstTry) {
        setFirstTryWins((c) => c + 1);
      }
      setRoundStars((s) => s + 1);
      recordExerciseOutcome({
        skillId: currentQuestion.skillId,
        activityType: currentQuestion.activityType,
        targetTime: currentQuestion.targetTime,
        firstTry,
        starsToAward: 1,
      });
    } else {
      setHadMistake(true);
      playHintCue(settings.soundEnabled);
    }

    if (settings.ttsEnabled && settings.soundEnabled) {
      speakText(validation.ariaAnnouncement, { enabled: true });
    }
  };

  const handleCheckClock = () => {
    processAnswer(clockTime);
  };

  const handleSelectChoice = (choice: TimeValue) => {
    if (resolvedGuardRef.current || roundResolved) return;
    setSelectedChoice(choice);
    processAnswer(choice);
  };

  const handleNextQuestion = () => {
    if (questionIndex + 1 >= questions.length) {
      completeSkillModule(selectedSkill);
      setRoundComplete(true);
      return;
    }
    const nextIndex = questionIndex + 1;
    setQuestionIndex(nextIndex);
    resetQuestionState(questions[nextIndex]);
    window.setTimeout(() => {
      promptHeadingRef.current?.focus();
    }, 0);
  };

  const isClockInputActivity =
    currentQuestion.activityType === 'set-time' ||
    currentQuestion.activityType === 'match-analog';

  const spokenPromptText =
    currentQuestion.activityType === 'match-analog'
      ? `${currentQuestion.prompt} The digital time is ${formatTimeForSpeech(currentQuestion.targetTime)}.`
      : currentQuestion.prompt;

  useEffect(() => {
    if (!roundComplete && settings.ttsEnabled && settings.soundEnabled) {
      speakText(spokenPromptText, { enabled: true });
    }
  }, [currentQuestion.id, roundComplete, spokenPromptText, settings.ttsEnabled, settings.soundEnabled]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ink sm:text-3xl">Clock Exercises</h1>
          <p className="text-sm text-ink-muted sm:text-base">
            Practise setting the time, matching analog and digital clocks, and daily routines.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex min-h-[48px] items-center rounded-2xl border-2 border-surface-muted bg-surface-card px-4 py-2 text-sm font-extrabold text-ink">
            Question {Math.min(questionIndex + 1, questions.length)} of {questions.length}
          </span>
          <button
            type="button"
            onClick={() => startNewRound(selectedSkill, activityFilter)}
            className="touch-target inline-flex items-center gap-2 rounded-2xl border-2 border-surface-muted bg-surface-card px-4 py-2 text-sm font-extrabold text-ink hover:bg-surface-muted"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            <span>New Round</span>
          </button>
        </div>
      </div>

      {/* Skill Selector */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Skill topic">
        {SKILL_ORDER.map((skillId) => {
          const active = selectedSkill === skillId;
          const unlocked = isSkillEffectivelyUnlocked(
            skillId,
            skills,
            settings.unlockAllSkills
          );
          return (
            <button
              key={skillId}
              type="button"
              aria-pressed={active}
              onClick={() => handleSkillChange(skillId)}
              className={[
                'touch-target inline-flex items-center gap-1.5 rounded-2xl px-3.5 py-2 text-xs font-extrabold transition-colors sm:text-sm',
                active
                  ? 'bg-hour-dark text-white shadow-sm'
                  : 'border-2 border-surface-muted bg-surface-card text-ink hover:bg-surface-muted',
              ].join(' ')}
            >
              {!unlocked && <Lock className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />}
              <span>{SKILL_LABELS[skillId]}</span>
            </button>
          );
        })}
      </div>

      {/* Activity Type Filter */}
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Exercise activity type">
        <span className="text-xs font-extrabold uppercase tracking-wide text-ink-muted">
          Activity:
        </span>
        {ACTIVITY_FILTERS.map(({ value, label }) => {
          const active = activityFilter === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              onClick={() => handleActivityFilterChange(value)}
              className={[
                'touch-target rounded-xl px-3 py-1.5 text-xs font-extrabold transition-colors sm:text-sm',
                active
                  ? 'bg-minute text-white shadow-sm'
                  : 'bg-surface-muted text-ink hover:bg-minute-soft',
              ].join(' ')}
            >
              {label}
            </button>
          );
        })}
      </div>

      {roundComplete ? (
        <section
          aria-label="Round complete summary"
          className="flex flex-col items-center gap-4 rounded-3xl border-2 border-emerald-300 bg-surface-card p-8 text-center shadow-sm"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-100 text-amber-700">
            <Trophy className="h-9 w-9" aria-hidden="true" />
          </div>
          <h2 className="text-2xl font-extrabold text-ink sm:text-3xl">
            Great Round! You Earned ★ {roundStars}
          </h2>
          <p className="max-w-md text-base font-semibold text-ink-muted">
            You solved all {questions.length} clock questions, including {firstTryWins} on your
            first try!
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => startNewRound(selectedSkill, activityFilter)}
              className="touch-target inline-flex items-center gap-2 rounded-2xl bg-hour-dark px-6 py-3 text-base font-extrabold text-white shadow-sm hover:bg-hour"
            >
              <Sparkles className="h-5 w-5" aria-hidden="true" />
              <span>Play Another Round</span>
            </button>
            {(() => {
              const nextSkill = getNextSkillId(selectedSkill);
              if (!nextSkill) return null;
              const nextDef = getSkillDefinition(nextSkill);
              return (
                <button
                  type="button"
                  onClick={() => handleSkillChange(nextSkill)}
                  className="touch-target inline-flex items-center gap-2 rounded-2xl bg-minute px-6 py-3 text-base font-extrabold text-white shadow-sm hover:bg-minute-dark"
                >
                  <span>Next: {nextDef.shortLabel}</span>
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </button>
              );
            })()}
            <Link
              to="/explore"
              className="touch-target inline-flex items-center gap-2 rounded-2xl border-2 border-surface-muted bg-surface px-5 py-3 text-base font-extrabold text-ink hover:bg-surface-muted"
            >
              <span>Interactive Clock</span>
            </Link>
          </div>
        </section>
      ) : (
        <div className="clock-stage-grid grid items-start gap-6 lg:grid-cols-[minmax(280px,420px)_1fr]">
          {/* Left Panel: Analog Clock OR Daily Life Routine Card */}
          <section
            aria-label="Exercise visual panel"
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
                    interactive={isClockInputActivity && !roundResolved}
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

          {/* Right Panel: Prompt, Controls / Choices, Hints */}
          <section className="flex flex-col gap-4" aria-label="Exercise question and answer">
            <div className="rounded-3xl border-2 border-surface-muted bg-surface-card p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-block rounded-full bg-minute-soft px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-minute-dark">
                  {SKILL_LABELS[currentQuestion.skillId]}
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
                onSelect={handleSelectChoice}
              />
            )}

            <HintBanner result={feedback} />

            <div className="flex flex-wrap items-center gap-3">
              {isClockInputActivity && !roundResolved && (
                <button
                  type="button"
                  onClick={handleCheckClock}
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
                    {questionIndex + 1 >= questions.length ? 'Finish Round' : 'Next Question'}
                  </span>
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
