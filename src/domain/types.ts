export type SkillId =
  | 'clock-parts'
  | 'oclock'
  | 'half-past'
  | 'quarter-past-to'
  | 'five-minutes'
  | 'exact-minutes'
  | 'daily-life'
  | 'challenge-mix';

export const SKILL_ORDER: readonly SkillId[] = [
  'clock-parts',
  'oclock',
  'half-past',
  'quarter-past-to',
  'five-minutes',
  'exact-minutes',
  'daily-life',
  'challenge-mix',
] as const;

export type MinuteLabelMode = 'all' | 'fives' | 'none';
export type InputMode = 'drag' | 'tap' | 'both';
export type ActivityType = 'set-time' | 'match-digital' | 'match-analog' | 'daily-life';

export interface TimeValue {
  hours: number;
  minutes: number;
}

export interface UserSettings {
  soundEnabled: boolean;
  ttsEnabled: boolean;
  minuteLabelMode: MinuteLabelMode;
  showDigitalOnExplore: boolean;
  challengeTimerEnabled: boolean;
  gearedHands: boolean;
  unlockAllSkills: boolean;
}

export interface SkillProgress {
  skillId: SkillId;
  unlocked: boolean;
  starsEarned: number;
  attempts: number;
  correctFirstTry: number;
  lastPracticedAt: string | null;
}

export interface ReviewItem {
  id: string;
  skillId: SkillId;
  activityType: ActivityType;
  targetTime: TimeValue;
  missedCount: number;
}

export interface PersistedAppState {
  schemaVersion: 1;
  settings: UserSettings;
  totalStars: number;
  badges: string[];
  skills: Record<SkillId, SkillProgress>;
  reviewQueue: ReviewItem[];
}

