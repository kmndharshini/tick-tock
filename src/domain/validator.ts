import {
  areTimesEqual,
  describeClockTime,
  formatDigitalTime,
  normalizeHours,
  normalizeTime,
} from './clockModel';
import { ExerciseQuestion } from './exerciseGenerator';
import { TimeValue } from './types';

export type MistakeCategory =
  | 'none'
  | 'swapped-hands'
  | 'off-by-one-hour-near-hour'
  | 'off-by-one-hour'
  | 'five-minute-confusion'
  | 'close-minutes'
  | 'adjust-minutes'
  | 'general';

export interface ValidationOptions {
  gearedHands?: boolean;
  toleranceMinutes?: number;
}

export interface ValidationResult {
  isCorrect: boolean;
  mistakeCategory: MistakeCategory;
  hint: string;
  feedbackTitle: string;
  ariaAnnouncement: string;
}

export function circularMinuteDistance(a: number, b: number): number {
  const diff = Math.abs(((a % 60) + 60) % 60 - (((b % 60) + 60) % 60));
  return Math.min(diff, 60 - diff);
}

export function circularHourDistance(a: number, b: number): number {
  const normA = normalizeHours(a);
  const normB = normalizeHours(b);
  const diff = Math.abs(normA - normB);
  return Math.min(diff, 12 - diff);
}

/**
 * Check whether two times are equivalent within an optional minute tolerance.
 */
export function isTimeEquivalent(
  targetTime: TimeValue,
  userTime: TimeValue,
  toleranceMinutes = 0
): boolean {
  const target = normalizeTime(targetTime);
  const user = normalizeTime(userTime);
  if (toleranceMinutes <= 0) {
    return areTimesEqual(target, user);
  }
  return (
    user.hours === target.hours &&
    circularMinuteDistance(user.minutes, target.minutes) <= toleranceMinutes
  );
}

/**
 * Classify a learner's answer against the target time and produce a targeted,
 * encouraging diagnostic hint (EC-GEO-04, EC-EX-05).
 */
export function diagnoseMistake(
  targetTime: TimeValue,
  userTime: TimeValue,
  options: ValidationOptions = {}
): { mistakeCategory: MistakeCategory; hint: string } {
  const target = normalizeTime(targetTime);
  const user = normalizeTime(userTime);
  const gearedHands = options.gearedHands ?? true;

  if (areTimesEqual(target, user)) {
    return {
      mistakeCategory: 'none',
      hint: `Spot on! That shows ${describeClockTime(target)}.`,
    };
  }

  const targetMinStr = String(target.minutes).padStart(2, '0');
  const nextHour = normalizeHours(target.hours + 1);

  // 1. Swapped hour & minute hands (EC-EX-05): check within +-2 minute tolerance
  const expectedSwappedMinutes = (target.hours % 12) * 5;
  const expectedSwappedHour = normalizeHours(Math.round(target.minutes / 5) || 12);
  const userHourAsTicks =
    ((user.hours % 12) * 5 + (gearedHands ? user.minutes / 12 : 0)) % 60;

  const minuteHandOnTargetHour =
    circularMinuteDistance(user.minutes, expectedSwappedMinutes) <= 2;
  const hourHandOnTargetMinute =
    user.hours === expectedSwappedHour ||
    circularMinuteDistance(userHourAsTicks, target.minutes) <= 3;

  if (minuteHandOnTargetHour && hourHandOnTargetMinute) {
    return {
      mistakeCategory: 'swapped-hands',
      hint: `Almost! You put the long minute hand on ${target.hours} and the short hour hand toward ${expectedSwappedHour}. Try pointing the short coral hour hand at ${target.hours} and the long blue minute hand at :${targetMinStr}!`,
    };
  }

  // 2. Off-by-one hour on quarter-to / near-hour times (EC-GEO-04)
  if (
    target.minutes >= 45 &&
    user.hours === nextHour &&
    (circularMinuteDistance(user.minutes, target.minutes) <= 2 ||
      (target.minutes >= 50 && user.minutes === 0))
  ) {
    return {
      mistakeCategory: 'off-by-one-hour-near-hour',
      hint: `Look closely! At ${formatDigitalTime(target)} (${describeClockTime(target)}), the short hour hand is close to ${nextHour}, just before reaching it — so the hour is still ${target.hours}.`,
    };
  }

  // 3. Five-minute interval vs. hour-number confusion (e.g., :04 vs :20)
  if (user.hours === target.hours) {
    if (target.minutes > 0 && target.minutes % 5 === 0 && user.minutes === target.minutes / 5) {
      return {
        mistakeCategory: 'five-minute-confusion',
        hint: `Remember each big number is 5 minutes! Count by 5s from 12 to reach :${targetMinStr} instead of :${String(user.minutes).padStart(2, '0')}.`,
      };
    }

    if (target.minutes >= 1 && target.minutes <= 11 && user.minutes === target.minutes * 5) {
      return {
        mistakeCategory: 'five-minute-confusion',
        hint: `Look at the tiny minute ticks! ${target.minutes} tiny ticks past 12 is :${targetMinStr}, while big number ${target.minutes} counts as :${String(user.minutes).padStart(2, '0')}.`,
      };
    }
  }

  // 4. Off-by-one hour with matching minutes
  if (
    circularHourDistance(user.hours, target.hours) === 1 &&
    circularMinuteDistance(user.minutes, target.minutes) <= 2
  ) {
    return {
      mistakeCategory: 'off-by-one-hour',
      hint: `So close! Your minute hand is in the right spot, and the hour hand is just 1 hour away. Point the short coral hour hand toward ${target.hours}!`,
    };
  }

  // 5. Close minute slip (within +-5 minutes, hour matches)
  if (
    user.hours === target.hours &&
    circularMinuteDistance(user.minutes, target.minutes) <= 5
  ) {
    return {
      mistakeCategory: 'close-minutes',
      hint: `You're super close! Hour ${target.hours} is right — nudge the long blue minute hand just a little to :${targetMinStr}.`,
    };
  }

  // 6. Hour matches, minute needs adjustment
  if (user.hours === target.hours) {
    return {
      mistakeCategory: 'adjust-minutes',
      hint: `Great job on hour ${target.hours}! Now move the long blue minute hand around from 12 to :${targetMinStr}.`,
    };
  }

  // 7. General encouraging guidance
  return {
    mistakeCategory: 'general',
    hint: `Nice try! Start by finding ${target.hours} with the short coral hour hand, then count minutes with the long blue minute hand to :${targetMinStr}.`,
  };
}

/**
 * Evaluate a user's answer for any Phase 4 exercise activity type.
 */
export function validateExerciseAnswer(
  question: ExerciseQuestion,
  userAnswer: TimeValue,
  options: ValidationOptions = {}
): ValidationResult {
  const tolerance = options.toleranceMinutes ?? 0;
  const isCorrect = isTimeEquivalent(question.targetTime, userAnswer, tolerance);
  const formattedTarget = formatDigitalTime(question.targetTime);

  if (isCorrect) {
    const feedbackTitle = 'Awesome job!';
    const hint =
      question.activityType === 'daily-life' && question.dailyRoutine
        ? `Yes! ${formattedTarget} (${describeClockTime(question.targetTime)}) is a great time for ${question.dailyRoutine.title.toLowerCase()} in the ${question.dailyRoutine.partOfDayLabel.toLowerCase()}.`
        : `You got it! ${formattedTarget} (${describeClockTime(question.targetTime)}).`;

    return {
      isCorrect: true,
      mistakeCategory: 'none',
      feedbackTitle,
      hint,
      ariaAnnouncement: `${feedbackTitle} ${hint}`,
    };
  }

  if (question.activityType === 'daily-life' && question.dailyRoutine) {
    const { mistakeCategory, hint } = diagnoseMistake(question.targetTime, userAnswer, options);
    const dailyHint =
      mistakeCategory === 'general'
        ? `Think about ${question.dailyRoutine.title.toLowerCase()} in the ${question.dailyRoutine.partOfDayLabel.toLowerCase()}! Look at the time-of-day clue and try another time.`
        : hint;

    return {
      isCorrect: false,
      mistakeCategory,
      feedbackTitle: 'Let’s take another look!',
      hint: dailyHint,
      ariaAnnouncement: `Let's take another look. ${dailyHint}`,
    };
  }

  const { mistakeCategory, hint } = diagnoseMistake(question.targetTime, userAnswer, options);
  const feedbackTitle =
    mistakeCategory === 'close-minutes' ||
    mistakeCategory === 'off-by-one-hour' ||
    mistakeCategory === 'off-by-one-hour-near-hour'
      ? 'So close!'
      : 'Almost there!';

  return {
    isCorrect: false,
    mistakeCategory,
    feedbackTitle,
    hint,
    ariaAnnouncement: `${feedbackTitle} ${hint}`,
  };
}

