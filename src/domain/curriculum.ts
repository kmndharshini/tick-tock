import { formatDigitalTime, normalizeTime } from './clockModel';
import {
  ActivityType,
  MinuteLabelMode,
  PersistedAppState,
  ReviewItem,
  SKILL_ORDER,
  SkillId,
  SkillProgress,
  TimeValue,
} from './types';

export interface SkillDefinition {
  skillId: SkillId;
  stepNumber: number;
  title: string;
  shortLabel: string;
  description: string;
  recommendedMinuteMode: MinuteLabelMode;
}

export interface BadgeDefinition {
  id: string;
  title: string;
  description: string;
}

export const CURRICULUM_SKILLS: readonly SkillDefinition[] = [
  {
    skillId: 'clock-parts',
    stepNumber: 1,
    title: 'Meet the Clock Parts',
    shortLabel: 'Clock Parts',
    description: 'Identify the short hour hand, long minute hand, and numbers 1–12.',
    recommendedMinuteMode: 'fives',
  },
  {
    skillId: 'oclock',
    stepNumber: 2,
    title: "Whole Hours (O'Clock)",
    shortLabel: "O'Clock",
    description: 'Read and set exact hours when the minute hand points to 12 (:00).',
    recommendedMinuteMode: 'fives',
  },
  {
    skillId: 'half-past',
    stepNumber: 3,
    title: 'Half Past (:30)',
    shortLabel: 'Half Past',
    description: 'Read and set half hours with the hour hand halfway between hours.',
    recommendedMinuteMode: 'fives',
  },
  {
    skillId: 'quarter-past-to',
    stepNumber: 4,
    title: 'Quarter Past & Quarter To',
    shortLabel: 'Quarter Past & To',
    description: 'Master :15 (quarter past) and :45 (quarter to the next hour).',
    recommendedMinuteMode: 'fives',
  },
  {
    skillId: 'five-minutes',
    stepNumber: 5,
    title: 'Counting by 5 Minutes',
    shortLabel: 'By 5 Minutes',
    description: 'Count around the clock by 5s: 05, 10, 15, 20, all the way to 55.',
    recommendedMinuteMode: 'all',
  },
  {
    skillId: 'exact-minutes',
    stepNumber: 6,
    title: 'Exact Minutes (00–59)',
    shortLabel: 'Exact Minutes',
    description: 'Read and set every single minute from 00 to 59 around the dial.',
    recommendedMinuteMode: 'all',
  },
  {
    skillId: 'daily-life',
    stepNumber: 7,
    title: 'Time in Daily Life',
    shortLabel: 'Daily Life',
    description: 'Connect morning, afternoon, and night routines to clock times.',
    recommendedMinuteMode: 'fives',
  },
  {
    skillId: 'challenge-mix',
    stepNumber: 8,
    title: 'Mixed Clock Challenge',
    shortLabel: 'Challenge Mix',
    description: 'Combine all clock skills in progressive multi-round challenges.',
    recommendedMinuteMode: 'none',
  },
] as const;

export const BADGE_DEFINITIONS: readonly BadgeDefinition[] = [
  {
    id: 'clock-parts-star',
    title: 'Clock Explorer',
    description: 'Practised identifying clock hands and numbers 1–12.',
  },
  {
    id: 'oclock-explorer',
    title: "O'Clock Explorer",
    description: "Earned 2 or more stars in O'Clock practice.",
  },
  {
    id: 'half-past-hero',
    title: 'Half-Past Hero',
    description: 'Earned 2 or more stars in Half Past (:30) practice.',
  },
  {
    id: 'quarter-pro',
    title: 'Quarter Pro',
    description: 'Mastered Quarter Past (:15) and Quarter To (:45).',
  },
  {
    id: 'five-min-finder',
    title: 'Five-Minute Finder',
    description: 'Counted by 5s around the analog clock.',
  },
  {
    id: 'minute-master',
    title: 'Minute Master',
    description: 'Conquered exact 00–59 minute precision.',
  },
  {
    id: 'daily-routine-star',
    title: 'Daily Routine Star',
    description: 'Matched morning, afternoon, and bedtime routines.',
  },
  {
    id: 'challenge-champion',
    title: 'Challenge Champion',
    description: 'Completed a full Clock Challenge adventure.',
  },
  {
    id: 'review-rescuer',
    title: 'Review Rescuer',
    description: 'Practised and cleared a tricky time in Review Mode.',
  },
] as const;

export const STARS_TO_UNLOCK_NEXT = 2;

export function getSkillDefinition(skillId: SkillId): SkillDefinition {
  return (
    CURRICULUM_SKILLS.find((s) => s.skillId === skillId) ?? CURRICULUM_SKILLS[0]
  );
}

export function getNextSkillId(skillId: SkillId): SkillId | null {
  const index = SKILL_ORDER.indexOf(skillId);
  if (index < 0 || index >= SKILL_ORDER.length - 1) {
    return null;
  }
  return SKILL_ORDER[index + 1];
}

/**
 * Determine whether a skill is effectively unlocked for the learner.
 * Respects `unlockAllSkills` non-destructively (EC-CUR-05).
 */
export function isSkillEffectivelyUnlocked(
  skillId: SkillId,
  skills: Record<SkillId, SkillProgress>,
  unlockAllSkills: boolean
): boolean {
  if (unlockAllSkills || skillId === 'clock-parts') {
    return true;
  }
  return Boolean(skills[skillId]?.unlocked);
}

/**
 * Determine if completing a round or earning stars satisfies the threshold
 * to unlock the next sequential skill.
 */
export function shouldUnlockNextSkill(
  progress: SkillProgress,
  completedModule = false
): boolean {
  return completedModule || progress.starsEarned >= STARS_TO_UNLOCK_NEXT;
}

/**
 * Compute 1-3 star rating for a completed round based on solved count and first-try accuracy.
 */
export function calculateRoundStars(
  solvedCount: number,
  firstTryCount: number,
  totalQuestions: number
): 0 | 1 | 2 | 3 {
  if (solvedCount <= 0 || totalQuestions <= 0) {
    return 0;
  }
  const firstTryRatio = firstTryCount / totalQuestions;
  const solvedRatio = solvedCount / totalQuestions;

  if (solvedRatio >= 0.9 && firstTryRatio >= 0.8) {
    return 3;
  }
  if (solvedRatio >= 0.6 && firstTryRatio >= 0.4) {
    return 2;
  }
  return 1;
}

const SKILL_BADGE_MAP: Record<SkillId, string> = {
  'clock-parts': 'clock-parts-star',
  oclock: 'oclock-explorer',
  'half-past': 'half-past-hero',
  'quarter-past-to': 'quarter-pro',
  'five-minutes': 'five-min-finder',
  'exact-minutes': 'minute-master',
  'daily-life': 'daily-routine-star',
  'challenge-mix': 'challenge-champion',
};

/**
 * Compute all badge IDs earned by the current state plus optional milestone events.
 */
export function evaluateEarnedBadges(
  state: Pick<PersistedAppState, 'badges' | 'skills'>,
  options: {
    completedSkillId?: SkillId;
    completedChallenge?: boolean;
    clearedReviewItem?: boolean;
  } = {}
): string[] {
  const earned = new Set<string>(state.badges);

  for (const skillId of SKILL_ORDER) {
    const skill = state.skills[skillId];
    if (!skill) continue;
    if (skill.starsEarned >= STARS_TO_UNLOCK_NEXT || options.completedSkillId === skillId) {
      earned.add(SKILL_BADGE_MAP[skillId]);
    }
  }

  if (options.completedChallenge) {
    earned.add('challenge-champion');
  }
  if (options.clearedReviewItem) {
    earned.add('review-rescuer');
  }

  return Array.from(earned);
}

/**
 * Add or increment a missed concept in the review queue.
 */
export function enqueueReviewItem(
  queue: ReviewItem[],
  item: {
    skillId: SkillId;
    activityType: ActivityType;
    targetTime: TimeValue;
  }
): ReviewItem[] {
  const normalizedTarget = normalizeTime(item.targetTime);
  const id = `${item.skillId}:${item.activityType}:${formatDigitalTime(normalizedTarget)}`;
  const existingIndex = queue.findIndex((entry) => entry.id === id);

  if (existingIndex >= 0) {
    return queue.map((entry, idx) =>
      idx === existingIndex
        ? { ...entry, missedCount: entry.missedCount + 1 }
        : entry
    );
  }

  return [
    ...queue,
    {
      id,
      skillId: item.skillId,
      activityType: item.activityType,
      targetTime: normalizedTarget,
      missedCount: 1,
    },
  ];
}

/**
 * Decrement missedCount for a review item answered correctly, removing it when cleared.
 */
export function resolveReviewItem(queue: ReviewItem[], itemId: string): ReviewItem[] {
  return queue
    .map((entry) =>
      entry.id === itemId
        ? { ...entry, missedCount: entry.missedCount - 1 }
        : entry
    )
    .filter((entry) => entry.missedCount > 0);
}
