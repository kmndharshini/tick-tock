import {
  PersistedAppState,
  ReviewItem,
  SKILL_ORDER,
  SkillId,
  SkillProgress,
  UserSettings,
} from '../domain/types';

export const STORAGE_KEY = 'tick_tock_state_v1';

export const DEFAULT_SETTINGS: UserSettings = {
  soundEnabled: true,
  ttsEnabled: false,
  minuteLabelMode: 'all',
  showDigitalOnExplore: true,
  challengeTimerEnabled: false,
  gearedHands: true,
  unlockAllSkills: false,
};

/** Build a fresh per-skill progress map with only the starter skill unlocked. */
export function createDefaultSkills(): Record<SkillId, SkillProgress> {
  const skills = {} as Record<SkillId, SkillProgress>;
  for (const skillId of SKILL_ORDER) {
    skills[skillId] = {
      skillId,
      unlocked: skillId === 'clock-parts',
      starsEarned: 0,
      attempts: 0,
      correctFirstTry: 0,
      lastPracticedAt: null,
    };
  }
  return skills;
}

/** Create a clean initial persisted application state. */
export function createDefaultAppState(): PersistedAppState {
  return {
    schemaVersion: 1,
    settings: { ...DEFAULT_SETTINGS },
    totalStars: 0,
    badges: [],
    skills: createDefaultSkills(),
    reviewQueue: [],
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeSettings(raw: unknown): UserSettings {
  if (!isPlainObject(raw)) {
    return { ...DEFAULT_SETTINGS };
  }

  const minuteMode =
    raw.minuteLabelMode === 'all' ||
    raw.minuteLabelMode === 'fives' ||
    raw.minuteLabelMode === 'none'
      ? raw.minuteLabelMode
      : DEFAULT_SETTINGS.minuteLabelMode;

  return {
    soundEnabled:
      typeof raw.soundEnabled === 'boolean' ? raw.soundEnabled : DEFAULT_SETTINGS.soundEnabled,
    ttsEnabled:
      typeof raw.ttsEnabled === 'boolean' ? raw.ttsEnabled : DEFAULT_SETTINGS.ttsEnabled,
    minuteLabelMode: minuteMode,
    showDigitalOnExplore:
      typeof raw.showDigitalOnExplore === 'boolean'
        ? raw.showDigitalOnExplore
        : DEFAULT_SETTINGS.showDigitalOnExplore,
    challengeTimerEnabled:
      typeof raw.challengeTimerEnabled === 'boolean'
        ? raw.challengeTimerEnabled
        : DEFAULT_SETTINGS.challengeTimerEnabled,
    gearedHands:
      typeof raw.gearedHands === 'boolean' ? raw.gearedHands : DEFAULT_SETTINGS.gearedHands,
    unlockAllSkills:
      typeof raw.unlockAllSkills === 'boolean'
        ? raw.unlockAllSkills
        : DEFAULT_SETTINGS.unlockAllSkills,
  };
}

function sanitizeSkills(raw: unknown): Record<SkillId, SkillProgress> {
  const defaults = createDefaultSkills();
  if (!isPlainObject(raw)) {
    return defaults;
  }

  for (const skillId of SKILL_ORDER) {
    const entry = raw[skillId];
    if (!isPlainObject(entry)) continue;
    defaults[skillId] = {
      skillId,
      unlocked:
        skillId === 'clock-parts'
          ? true
          : typeof entry.unlocked === 'boolean'
            ? entry.unlocked
            : defaults[skillId].unlocked,
      starsEarned:
        typeof entry.starsEarned === 'number' && Number.isFinite(entry.starsEarned) && entry.starsEarned >= 0
          ? Math.floor(entry.starsEarned)
          : 0,
      attempts:
        typeof entry.attempts === 'number' && Number.isFinite(entry.attempts) && entry.attempts >= 0
          ? Math.floor(entry.attempts)
          : 0,
      correctFirstTry:
        typeof entry.correctFirstTry === 'number' &&
        Number.isFinite(entry.correctFirstTry) &&
        entry.correctFirstTry >= 0
          ? Math.floor(entry.correctFirstTry)
          : 0,
      lastPracticedAt: typeof entry.lastPracticedAt === 'string' ? entry.lastPracticedAt : null,
    };
  }

  return defaults;
}

function sanitizeReviewQueue(raw: unknown): ReviewItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is ReviewItem => {
    if (!isPlainObject(item)) return false;
    if (typeof item.id !== 'string') return false;
    if (!SKILL_ORDER.includes(item.skillId as SkillId)) return false;
    if (
      item.activityType !== 'set-time' &&
      item.activityType !== 'match-digital' &&
      item.activityType !== 'match-analog' &&
      item.activityType !== 'daily-life'
    ) {
      return false;
    }
    if (!isPlainObject(item.targetTime)) return false;
    const { hours, minutes } = item.targetTime;
    if (
      typeof hours !== 'number' ||
      typeof minutes !== 'number' ||
      hours < 1 ||
      hours > 12 ||
      minutes < 0 ||
      minutes > 59
    ) {
      return false;
    }
    return typeof item.missedCount === 'number' && item.missedCount >= 1;
  });
}

function getSafeStorage(storage?: Storage): Storage | null {
  if (storage) return storage;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Load persisted application state safely.
 * Falls back to defaults if localStorage is unavailable or contains malformed data.
 */
export function loadAppState(storage?: Storage): PersistedAppState {
  const target = getSafeStorage(storage);
  if (!target) {
    return createDefaultAppState();
  }

  try {
    const raw = target.getItem(STORAGE_KEY);
    if (!raw) {
      return createDefaultAppState();
    }

    const parsed: unknown = JSON.parse(raw);
    if (!isPlainObject(parsed) || parsed.schemaVersion !== 1) {
      return createDefaultAppState();
    }

    return {
      schemaVersion: 1,
      settings: sanitizeSettings(parsed.settings),
      totalStars:
        typeof parsed.totalStars === 'number' &&
        Number.isFinite(parsed.totalStars) &&
        parsed.totalStars >= 0
          ? Math.floor(parsed.totalStars)
          : 0,
      badges: Array.isArray(parsed.badges)
        ? parsed.badges.filter((b): b is string => typeof b === 'string')
        : [],
      skills: sanitizeSkills(parsed.skills),
      reviewQueue: sanitizeReviewQueue(parsed.reviewQueue),
    };
  } catch {
    return createDefaultAppState();
  }
}

/**
 * Persist application state safely, swallowing quota/security errors
 * so the in-memory session continues uninterrupted.
 */
export function saveAppState(state: PersistedAppState, storage?: Storage): boolean {
  const target = getSafeStorage(storage);
  if (!target) return false;

  try {
    target.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/** Remove persisted state safely from storage. */
export function clearAppState(storage?: Storage): boolean {
  const target = getSafeStorage(storage);
  if (!target) return false;

  try {
    target.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

