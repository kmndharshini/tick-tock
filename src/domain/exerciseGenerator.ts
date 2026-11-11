import {
  areTimesEqual,
  describeClockTime,
  formatDigitalTime,
  normalizeHours,
  normalizeMinutes,
  normalizeTime,
} from './clockModel';
import { ActivityType, MinuteLabelMode, ReviewItem, SkillId, TimeValue } from './types';

export type PartOfDay = 'morning' | 'afternoon' | 'evening';

export type DailyRoutineId =
  | 'wake-up'
  | 'go-to-school'
  | 'eat-lunch'
  | 'play-time'
  | 'do-homework'
  | 'go-to-bed';

export interface DailyRoutinePrompt {
  id: DailyRoutineId;
  title: string;
  prompt: string;
  partOfDay: PartOfDay;
  partOfDayLabel: 'Morning' | 'Afternoon' | 'Night';
  targetTime: TimeValue;
  plausibleWindowHours: number[];
}

export interface ExerciseQuestion {
  id: string;
  skillId: SkillId;
  activityType: ActivityType;
  prompt: string;
  targetTime: TimeValue;
  initialClockTime: TimeValue;
  choices: TimeValue[];
  dailyRoutine?: DailyRoutinePrompt;
  recommendedMinuteMode: MinuteLabelMode;
  showHandLabels: boolean;
  reviewItemId?: string;
}

export interface GenerateQuestionOptions {
  skillId: SkillId;
  activityType?: ActivityType;
  previousTargetTime?: TimeValue | null;
  previousRoutineId?: DailyRoutineId | null;
  rng?: () => number;
}

export const DAILY_ROUTINES: readonly DailyRoutinePrompt[] = [
  {
    id: 'wake-up',
    title: 'Waking Up',
    prompt: 'Good morning! What time do we usually wake up for the day?',
    partOfDay: 'morning',
    partOfDayLabel: 'Morning',
    targetTime: { hours: 7, minutes: 0 },
    plausibleWindowHours: [6, 7, 8],
  },
  {
    id: 'go-to-school',
    title: 'Going to School',
    prompt: 'Grab your backpack! What morning time fits going to school?',
    partOfDay: 'morning',
    partOfDayLabel: 'Morning',
    targetTime: { hours: 8, minutes: 15 },
    plausibleWindowHours: [7, 8, 9],
  },
  {
    id: 'eat-lunch',
    title: 'Eating Lunch',
    prompt: 'Midday break! What afternoon time fits eating lunch?',
    partOfDay: 'afternoon',
    partOfDayLabel: 'Afternoon',
    targetTime: { hours: 12, minutes: 0 },
    plausibleWindowHours: [11, 12, 1],
  },
  {
    id: 'play-time',
    title: 'Playing Outside',
    prompt: 'After school fun! What afternoon time fits playing outside?',
    partOfDay: 'afternoon',
    partOfDayLabel: 'Afternoon',
    targetTime: { hours: 3, minutes: 30 },
    plausibleWindowHours: [2, 3, 4],
  },
  {
    id: 'do-homework',
    title: 'Doing Homework',
    prompt: 'Time to read and practice in the late afternoon before dinner!',
    partOfDay: 'afternoon',
    partOfDayLabel: 'Afternoon',
    targetTime: { hours: 5, minutes: 0 },
    plausibleWindowHours: [4, 5, 6],
  },
  {
    id: 'go-to-bed',
    title: 'Going to Bed',
    prompt: 'Stars are out at night! What bedtime fits going to sleep?',
    partOfDay: 'evening',
    partOfDayLabel: 'Night',
    targetTime: { hours: 9, minutes: 0 },
    plausibleWindowHours: [8, 9, 10],
  },
] as const;

let questionCounter = 0;

function pickRandom<T>(items: readonly T[], rng: () => number): T {
  const index = Math.min(items.length - 1, Math.max(0, Math.floor(rng() * items.length)));
  return items[index];
}

function shuffleArray<T>(items: readonly T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickDistinctTime(
  candidates: TimeValue[],
  previousTargetTime: TimeValue | null | undefined,
  rng: () => number
): TimeValue {
  const filtered = previousTargetTime
    ? candidates.filter((candidate) => !areTimesEqual(candidate, previousTargetTime))
    : candidates;
  const pool = filtered.length > 0 ? filtered : candidates;
  return normalizeTime(pickRandom(pool, rng));
}

function buildTargetPoolForSkill(skillId: SkillId): TimeValue[] {
  const hours = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  switch (skillId) {
    case 'clock-parts':
    case 'oclock':
      return hours.map((h) => ({ hours: h, minutes: 0 }));

    case 'half-past':
      return hours.map((h) => ({ hours: h, minutes: 30 }));

    case 'quarter-past-to':
      return hours.flatMap((h) => [
        { hours: h, minutes: 15 },
        { hours: h, minutes: 45 },
      ]);

    case 'five-minutes': {
      const fives = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
      return hours.flatMap((h) => fives.map((m) => ({ hours: h, minutes: m })));
    }

    case 'exact-minutes': {
      const result: TimeValue[] = [];
      for (const h of hours) {
        for (let m = 1; m <= 59; m++) {
          if (m % 5 !== 0) {
            result.push({ hours: h, minutes: m });
          }
        }
      }
      return result;
    }

    case 'daily-life':
      return DAILY_ROUTINES.map((r) => r.targetTime);

    case 'challenge-mix':
      return [
        ...buildTargetPoolForSkill('oclock'),
        ...buildTargetPoolForSkill('half-past'),
        ...buildTargetPoolForSkill('quarter-past-to'),
        ...buildTargetPoolForSkill('five-minutes'),
      ];
  }
}

/**
 * Pick a neutral starting clock position that never matches the target time (EC-EX-06).
 */
export function pickInitialClockTime(targetTime: TimeValue): TimeValue {
  const norm = normalizeTime(targetTime);
  const neutral: TimeValue = { hours: 6, minutes: 0 };
  if (!areTimesEqual(neutral, norm)) {
    return neutral;
  }
  return {
    hours: normalizeHours(norm.hours + 6),
    minutes: norm.minutes === 0 ? 30 : 0,
  };
}

/**
 * Generate 4 unique, plausible TimeValue choices including the targetTime (EC-EX-02).
 */
export function generateChoices(
  targetTime: TimeValue,
  skillId: SkillId,
  rng: () => number = Math.random,
  dailyRoutine?: DailyRoutinePrompt
): TimeValue[] {
  const normTarget = normalizeTime(targetTime);
  const seenKeys = new Set<string>([formatDigitalTime(normTarget)]);
  const distractors: TimeValue[] = [];

  const excludedHours = dailyRoutine ? new Set(dailyRoutine.plausibleWindowHours) : null;

  const tryAdd = (candidate: TimeValue) => {
    if (distractors.length >= 3) return;
    const normalized = normalizeTime(candidate);
    if (excludedHours && excludedHours.has(normalized.hours)) {
      return;
    }
    const key = formatDigitalTime(normalized);
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      distractors.push(normalized);
    }
  };

  if (skillId === 'daily-life' && dailyRoutine) {
    // Prefer unambiguous routine times from other parts of the day
    const otherRoutines = shuffleArray(
      DAILY_ROUTINES.filter((r) => r.id !== dailyRoutine.id),
      rng
    );
    for (const other of otherRoutines) {
      tryAdd(other.targetTime);
    }
    const unambiguousFallbacks: TimeValue[] = [
      { hours: 12, minutes: 0 },
      { hours: 4, minutes: 0 },
      { hours: 9, minutes: 0 },
      { hours: 7, minutes: 0 },
      { hours: 2, minutes: 30 },
      { hours: 10, minutes: 30 },
      { hours: 11, minutes: 0 },
      { hours: 1, minutes: 30 },
    ];
    for (const fallback of unambiguousFallbacks) {
      tryAdd(fallback);
    }
  } else {
    // 1. Swapped hands distractor (e.g., 3:00 -> 12:15, 3:25 -> 5:15)
    const swappedHour = normalizeHours(Math.round(normTarget.minutes / 5) || 12);
    const swappedMinute = (normTarget.hours % 12) * 5;
    tryAdd({ hours: swappedHour, minutes: swappedMinute });

    // 2. Off-by-1 hour distractor (critical for :45 quarter-to questions, e.g., 3:45 vs 4:45)
    tryAdd({ hours: normalizeHours(normTarget.hours + 1), minutes: normTarget.minutes });
    tryAdd({ hours: normalizeHours(normTarget.hours - 1), minutes: normTarget.minutes });

    // 3. 5-minute vs hour-number confusion (e.g., 3:20 vs 3:04)
    if (normTarget.minutes > 0 && normTarget.minutes % 5 === 0) {
      tryAdd({ hours: normTarget.hours, minutes: normTarget.minutes / 5 });
    } else if (normTarget.minutes >= 1 && normTarget.minutes <= 11) {
      tryAdd({ hours: normTarget.hours, minutes: normTarget.minutes * 5 });
    }

    // 4. Skill-contextual distractors
    if (skillId === 'oclock' || skillId === 'clock-parts') {
      tryAdd({ hours: normalizeHours(normTarget.hours + 2), minutes: 0 });
      tryAdd({ hours: normalizeHours(normTarget.hours + 6), minutes: 0 });
      tryAdd({ hours: normTarget.hours, minutes: 30 });
    } else if (skillId === 'half-past') {
      tryAdd({ hours: normTarget.hours, minutes: 0 });
      tryAdd({ hours: normalizeHours(normTarget.hours + 1), minutes: 0 });
      tryAdd({ hours: normalizeHours(normTarget.hours + 2), minutes: 30 });
    } else if (skillId === 'quarter-past-to') {
      tryAdd({ hours: normTarget.hours, minutes: normTarget.minutes === 15 ? 45 : 15 });
      tryAdd({ hours: normTarget.hours, minutes: 30 });
      tryAdd({ hours: normTarget.hours, minutes: 0 });
    } else if (skillId === 'five-minutes') {
      tryAdd({ hours: normTarget.hours, minutes: normalizeMinutes(normTarget.minutes + 5) });
      tryAdd({ hours: normTarget.hours, minutes: normalizeMinutes(normTarget.minutes - 5) });
      tryAdd({ hours: normTarget.hours, minutes: normalizeMinutes(normTarget.minutes + 10) });
    } else {
      tryAdd({ hours: normTarget.hours, minutes: normalizeMinutes(normTarget.minutes + 1) });
      tryAdd({ hours: normTarget.hours, minutes: normalizeMinutes(normTarget.minutes - 1) });
      tryAdd({ hours: normTarget.hours, minutes: normalizeMinutes(normTarget.minutes + 5) });
    }
  }

  // Deterministic fallback pool guaranteeing 4 unique choices
  const fallbackMinutes = [0, 15, 30, 45, 5, 10, 20, 25, 35, 40, 50, 55];
  for (let hOffset = 0; hOffset < 12 && distractors.length < 3; hOffset++) {
    const h = normalizeHours(normTarget.hours + hOffset);
    for (const m of fallbackMinutes) {
      tryAdd({ hours: h, minutes: m });
      if (distractors.length >= 3) break;
    }
  }

  return shuffleArray([normTarget, ...distractors.slice(0, 3)], rng);
}

function defaultActivityTypeForSkill(skillId: SkillId, rng: () => number): ActivityType {
  if (skillId === 'daily-life') return 'daily-life';
  const types: ActivityType[] = ['set-time', 'match-digital', 'match-analog'];
  return pickRandom(types, rng);
}

function recommendedMinuteModeForSkill(skillId: SkillId): MinuteLabelMode {
  switch (skillId) {
    case 'clock-parts':
    case 'oclock':
    case 'half-past':
    case 'quarter-past-to':
      return 'fives';
    case 'five-minutes':
    case 'exact-minutes':
      return 'all';
    case 'daily-life':
    case 'challenge-mix':
      return 'fives';
  }
}

function buildPromptText(
  activityType: ActivityType,
  targetTime: TimeValue,
  dailyRoutine?: DailyRoutinePrompt
): string {
  if (activityType === 'daily-life' && dailyRoutine) {
    return dailyRoutine.prompt;
  }
  if (activityType === 'set-time') {
    return `Can you show ${describeClockTime(targetTime)} on the clock?`;
  }
  if (activityType === 'match-digital') {
    return 'Which digital time matches the analog clock?';
  }
  return 'Move the clock hands to match this digital time!';
}

/**
 * Generate a single exercise question for the requested skill and optional activity type.
 * Prevents consecutive duplicate target times (EC-EX-01) and ensures 4 unique choices (EC-EX-02).
 */
export function generateExerciseQuestion(options: GenerateQuestionOptions): ExerciseQuestion {
  const rng = options.rng ?? Math.random;
  const { skillId, previousTargetTime, previousRoutineId } = options;

  let resolvedSkill: SkillId = skillId;
  if (skillId === 'challenge-mix' && !options.activityType) {
    const subSkills: SkillId[] = [
      'oclock',
      'half-past',
      'quarter-past-to',
      'five-minutes',
      'exact-minutes',
      'daily-life',
    ];
    resolvedSkill = pickRandom(subSkills, rng);
  }

  const activityType =
    options.activityType ?? defaultActivityTypeForSkill(resolvedSkill, rng);

  let dailyRoutine: DailyRoutinePrompt | undefined;
  let targetTime: TimeValue;

  if (activityType === 'daily-life' || resolvedSkill === 'daily-life') {
    const availableRoutines = DAILY_ROUTINES.filter((routine) => {
      if (previousRoutineId && routine.id === previousRoutineId) return false;
      if (previousTargetTime && areTimesEqual(routine.targetTime, previousTargetTime)) {
        return false;
      }
      return true;
    });
    dailyRoutine = pickRandom(
      availableRoutines.length > 0 ? availableRoutines : DAILY_ROUTINES,
      rng
    );
    targetTime = normalizeTime(dailyRoutine.targetTime);
  } else {
    const pool = buildTargetPoolForSkill(resolvedSkill);
    targetTime = pickDistinctTime(pool, previousTargetTime, rng);
  }

  const choices = generateChoices(targetTime, dailyRoutine ? 'daily-life' : resolvedSkill, rng, dailyRoutine);
  const initialClockTime = pickInitialClockTime(targetTime);

  questionCounter += 1;
  return {
    id: `q-${skillId}-${questionCounter}`,
    skillId,
    activityType: dailyRoutine ? 'daily-life' : activityType,
    prompt: buildPromptText(dailyRoutine ? 'daily-life' : activityType, targetTime, dailyRoutine),
    targetTime,
    initialClockTime,
    choices,
    dailyRoutine,
    recommendedMinuteMode: recommendedMinuteModeForSkill(skillId),
    showHandLabels: skillId === 'clock-parts' || skillId === 'oclock',
  };
}

/** Generate a round of N consecutive questions with zero adjacent duplicate target times. */
export function generateExerciseRound(
  skillId: SkillId,
  count = 5,
  activityType?: ActivityType,
  rng: () => number = Math.random
): ExerciseQuestion[] {
  const questions: ExerciseQuestion[] = [];
  let prevTime: TimeValue | null = null;
  let prevRoutine: DailyRoutineId | null = null;

  for (let i = 0; i < count; i++) {
    const q = generateExerciseQuestion({
      skillId,
      activityType,
      previousTargetTime: prevTime,
      previousRoutineId: prevRoutine,
      rng,
    });
    questions.push(q);
    prevTime = q.targetTime;
    prevRoutine = q.dailyRoutine?.id ?? null;
  }

  return questions;
}

const CHALLENGE_DIFFICULTY_CURVE: readonly SkillId[] = [
  'oclock',
  'half-past',
  'quarter-past-to',
  'five-minutes',
  'exact-minutes',
  'daily-life',
] as const;

/**
 * Generate an escalating multi-round mixed challenge across curriculum skills.
 */
export function generateChallengeRound(
  count = 6,
  rng: () => number = Math.random
): ExerciseQuestion[] {
  const questions: ExerciseQuestion[] = [];
  let prevTime: TimeValue | null = null;
  let prevRoutine: DailyRoutineId | null = null;

  for (let i = 0; i < count; i++) {
    const tierIndex = Math.min(
      CHALLENGE_DIFFICULTY_CURVE.length - 1,
      Math.floor((i / Math.max(1, count)) * CHALLENGE_DIFFICULTY_CURVE.length)
    );
    const tierSkill = CHALLENGE_DIFFICULTY_CURVE[tierIndex];
    const q = generateExerciseQuestion({
      skillId: tierSkill,
      previousTargetTime: prevTime,
      previousRoutineId: prevRoutine,
      rng,
    });
    questions.push(q);
    prevTime = q.targetTime;
    prevRoutine = q.dailyRoutine?.id ?? null;
  }

  return questions;
}

/**
 * Construct a targeted review question directly from a queued ReviewItem.
 */
export function generateQuestionFromReviewItem(
  item: ReviewItem,
  rng: () => number = Math.random
): ExerciseQuestion {
  const targetTime = normalizeTime(item.targetTime);
  const dailyRoutine =
    item.activityType === 'daily-life'
      ? DAILY_ROUTINES.find((r) => areTimesEqual(r.targetTime, targetTime)) ?? DAILY_ROUTINES[0]
      : undefined;

  const choices = generateChoices(
    targetTime,
    dailyRoutine ? 'daily-life' : item.skillId,
    rng,
    dailyRoutine
  );

  questionCounter += 1;
  return {
    id: `review-${item.id}-${questionCounter}`,
    skillId: item.skillId,
    activityType: item.activityType,
    prompt: buildPromptText(item.activityType, targetTime, dailyRoutine),
    targetTime,
    initialClockTime: pickInitialClockTime(targetTime),
    choices,
    dailyRoutine,
    recommendedMinuteMode: recommendedMinuteModeForSkill(item.skillId),
    showHandLabels: item.skillId === 'clock-parts' || item.skillId === 'oclock',
    reviewItemId: item.id,
  };
}

