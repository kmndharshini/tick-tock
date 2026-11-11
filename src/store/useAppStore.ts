import { create } from 'zustand';
import {
  calculateRoundStars,
  enqueueReviewItem,
  evaluateEarnedBadges,
  getNextSkillId,
  resolveReviewItem,
  shouldUnlockNextSkill,
} from '../domain/curriculum';
import {
  ActivityType,
  PersistedAppState,
  SkillId,
  TimeValue,
  UserSettings,
} from '../domain/types';
import { muteAllAudio, stopSpeech } from '../services/audioService';
import {
  clearAppState,
  createDefaultAppState,
  loadAppState,
  saveAppState,
} from '../services/storageService';

export interface ExerciseOutcomeInput {
  skillId: SkillId;
  activityType: ActivityType;
  targetTime: TimeValue;
  firstTry: boolean;
  starsToAward?: number;
}

export interface ChallengeCompletionInput {
  solvedCount: number;
  firstTryCount: number;
  totalQuestions: number;
}

export interface AppStore extends PersistedAppState {
  updateSettings: (partial: Partial<UserSettings>) => void;
  toggleSound: () => void;
  recordExerciseOutcome: (outcome: ExerciseOutcomeInput) => void;
  completeSkillModule: (skillId: SkillId) => void;
  recordReviewAnswer: (itemId: string, isCorrect: boolean) => void;
  recordChallengeCompletion: (summary: ChallengeCompletionInput) => void;
  resetProgress: () => void;
  hydrate: () => void;
}

function commitState(next: PersistedAppState): PersistedAppState {
  saveAppState(next);
  return next;
}

function applyNextSkillUnlock(
  skills: PersistedAppState['skills'],
  skillId: SkillId,
  completedModule = false
): PersistedAppState['skills'] {
  const updatedSkill = skills[skillId];
  if (!updatedSkill || !shouldUnlockNextSkill(updatedSkill, completedModule)) {
    return skills;
  }
  const nextSkillId = getNextSkillId(skillId);
  if (!nextSkillId || skills[nextSkillId]?.unlocked) {
    return skills;
  }
  return {
    ...skills,
    [nextSkillId]: {
      ...skills[nextSkillId],
      unlocked: true,
    },
  };
}

export const useAppStore = create<AppStore>((set, get) => ({
  ...loadAppState(),

  updateSettings: (partial) => {
    const current = get();
    const nextSettings = { ...current.settings, ...partial };
    if (partial.soundEnabled === false) {
      muteAllAudio();
    } else if (partial.ttsEnabled === false) {
      stopSpeech();
    }
    const next: PersistedAppState = {
      schemaVersion: 1,
      settings: nextSettings,
      totalStars: current.totalStars,
      badges: current.badges,
      skills: current.skills,
      reviewQueue: current.reviewQueue,
    };
    set(commitState(next));
  },

  toggleSound: () => {
    const { settings, updateSettings } = get();
    updateSettings({ soundEnabled: !settings.soundEnabled });
  },

  recordExerciseOutcome: ({
    skillId,
    activityType,
    targetTime,
    firstTry,
    starsToAward = 1,
  }) => {
    const current = get();
    const existingSkill = current.skills[skillId];
    const nowIso = new Date().toISOString();
    const starsDelta = Math.max(0, Math.floor(starsToAward));

    const updatedSkill = {
      ...existingSkill,
      attempts: existingSkill.attempts + 1,
      correctFirstTry: existingSkill.correctFirstTry + (firstTry ? 1 : 0),
      starsEarned: existingSkill.starsEarned + starsDelta,
      lastPracticedAt: nowIso,
    };

    const nextSkills = applyNextSkillUnlock(
      { ...current.skills, [skillId]: updatedSkill },
      skillId,
      false
    );

    const nextReviewQueue = firstTry
      ? current.reviewQueue
      : enqueueReviewItem(current.reviewQueue, {
          skillId,
          activityType,
          targetTime,
        });

    const nextBadges = evaluateEarnedBadges({
      badges: current.badges,
      skills: nextSkills,
    });

    const next: PersistedAppState = {
      schemaVersion: 1,
      settings: current.settings,
      totalStars: current.totalStars + starsDelta,
      badges: nextBadges,
      skills: nextSkills,
      reviewQueue: nextReviewQueue,
    };
    set(commitState(next));
  },

  completeSkillModule: (skillId) => {
    const current = get();
    const nextSkills = applyNextSkillUnlock(current.skills, skillId, true);
    const nextBadges = evaluateEarnedBadges(
      { badges: current.badges, skills: nextSkills },
      { completedSkillId: skillId }
    );

    const next: PersistedAppState = {
      schemaVersion: 1,
      settings: current.settings,
      totalStars: current.totalStars,
      badges: nextBadges,
      skills: nextSkills,
      reviewQueue: current.reviewQueue,
    };
    set(commitState(next));
  },

  recordReviewAnswer: (itemId, isCorrect) => {
    const current = get();
    const item = current.reviewQueue.find((entry) => entry.id === itemId);
    if (!item) return;

    const nowIso = new Date().toISOString();
    const existingSkill = current.skills[item.skillId];

    if (!isCorrect) {
      const nextQueue = enqueueReviewItem(current.reviewQueue, {
        skillId: item.skillId,
        activityType: item.activityType,
        targetTime: item.targetTime,
      });
      const next: PersistedAppState = {
        schemaVersion: 1,
        settings: current.settings,
        totalStars: current.totalStars,
        badges: current.badges,
        skills: {
          ...current.skills,
          [item.skillId]: {
            ...existingSkill,
            attempts: existingSkill.attempts + 1,
            lastPracticedAt: nowIso,
          },
        },
        reviewQueue: nextQueue,
      };
      set(commitState(next));
      return;
    }

    const nextQueue = resolveReviewItem(current.reviewQueue, itemId);
    const updatedSkill = {
      ...existingSkill,
      attempts: existingSkill.attempts + 1,
      starsEarned: existingSkill.starsEarned + 1,
      lastPracticedAt: nowIso,
    };
    const nextSkills = applyNextSkillUnlock(
      { ...current.skills, [item.skillId]: updatedSkill },
      item.skillId,
      false
    );
    const nextBadges = evaluateEarnedBadges(
      { badges: current.badges, skills: nextSkills },
      { clearedReviewItem: true }
    );

    const next: PersistedAppState = {
      schemaVersion: 1,
      settings: current.settings,
      totalStars: current.totalStars + 1,
      badges: nextBadges,
      skills: nextSkills,
      reviewQueue: nextQueue,
    };
    set(commitState(next));
  },

  recordChallengeCompletion: ({ solvedCount, firstTryCount, totalQuestions }) => {
    const current = get();
    const nowIso = new Date().toISOString();
    const challengeStars = calculateRoundStars(solvedCount, firstTryCount, totalQuestions);
    const existing = current.skills['challenge-mix'];

    const updatedChallengeSkill = {
      ...existing,
      unlocked: true,
      attempts: existing.attempts + 1,
      correctFirstTry:
        existing.correctFirstTry + (solvedCount === totalQuestions && firstTryCount === totalQuestions ? 1 : 0),
      starsEarned: Math.max(existing.starsEarned, challengeStars),
      lastPracticedAt: nowIso,
    };

    const nextSkills = {
      ...current.skills,
      'challenge-mix': updatedChallengeSkill,
    };
    const nextBadges = evaluateEarnedBadges(
      { badges: current.badges, skills: nextSkills },
      { completedChallenge: solvedCount > 0 }
    );

    const next: PersistedAppState = {
      schemaVersion: 1,
      settings: current.settings,
      totalStars: current.totalStars,
      badges: nextBadges,
      skills: nextSkills,
      reviewQueue: current.reviewQueue,
    };
    set(commitState(next));
  },

  resetProgress: () => {
    clearAppState();
    const fresh = createDefaultAppState();
    saveAppState(fresh);
    set(fresh);
  },

  hydrate: () => {
    set(loadAppState());
  },
}));
