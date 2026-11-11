import { beforeEach, describe, expect, it } from 'vitest';
import {
  calculateRoundStars,
  CURRICULUM_SKILLS,
  enqueueReviewItem,
  evaluateEarnedBadges,
  getNextSkillId,
  isSkillEffectivelyUnlocked,
  resolveReviewItem,
  shouldUnlockNextSkill,
} from '../../src/domain/curriculum';
import {
  generateChallengeRound,
  generateQuestionFromReviewItem,
} from '../../src/domain/exerciseGenerator';
import { SKILL_ORDER } from '../../src/domain/types';
import { loadAppState } from '../../src/services/storageService';
import { useAppStore } from '../../src/store/useAppStore';

describe('Phase 5: Curriculum, Progression, Rewards & Review Queue', () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.getState().resetProgress();
  });

  it('defines the 8 sequential skills in expected curriculum order', () => {
    expect(CURRICULUM_SKILLS.map((s) => s.skillId)).toEqual(SKILL_ORDER);
    expect(getNextSkillId('clock-parts')).toBe('oclock');
    expect(getNextSkillId('oclock')).toBe('half-past');
    expect(getNextSkillId('challenge-mix')).toBeNull();
  });

  it('unlocks half-past when oclock earns >= 2 stars or completes a module, persisting to localStorage', () => {
    const store = useAppStore.getState();
    expect(useAppStore.getState().skills['half-past'].unlocked).toBe(false);

    store.recordExerciseOutcome({
      skillId: 'oclock',
      activityType: 'set-time',
      targetTime: { hours: 3, minutes: 0 },
      firstTry: true,
      starsToAward: 1,
    });
    expect(useAppStore.getState().skills['half-past'].unlocked).toBe(false);

    store.recordExerciseOutcome({
      skillId: 'oclock',
      activityType: 'match-digital',
      targetTime: { hours: 5, minutes: 0 },
      firstTry: true,
      starsToAward: 1,
    });

    expect(useAppStore.getState().skills['half-past'].unlocked).toBe(true);
    expect(useAppStore.getState().badges).toContain('oclock-explorer');

    const persisted = loadAppState();
    expect(persisted.skills['half-past'].unlocked).toBe(true);
    expect(persisted.totalStars).toBe(2);
  });

  it('handles unlockAllSkills toggling non-destructively (EC-CUR-05)', () => {
    const store = useAppStore.getState();
    store.completeSkillModule('clock-parts'); // unlocks oclock
    store.recordExerciseOutcome({
      skillId: 'oclock',
      activityType: 'set-time',
      targetTime: { hours: 2, minutes: 0 },
      firstTry: true,
      starsToAward: 1,
    });

    store.updateSettings({ unlockAllSkills: true });
    expect(
      isSkillEffectivelyUnlocked(
        'exact-minutes',
        useAppStore.getState().skills,
        useAppStore.getState().settings.unlockAllSkills
      )
    ).toBe(true);

    store.updateSettings({ unlockAllSkills: false });
    const state = useAppStore.getState();
    expect(isSkillEffectivelyUnlocked('clock-parts', state.skills, false)).toBe(true);
    expect(isSkillEffectivelyUnlocked('oclock', state.skills, false)).toBe(true);
    expect(isSkillEffectivelyUnlocked('exact-minutes', state.skills, false)).toBe(false);
    expect(state.totalStars).toBe(1);
    expect(state.skills.oclock.starsEarned).toBe(1);
  });

  it('calculates 1-3 round stars and evaluates badge unlocks accurately', () => {
    expect(calculateRoundStars(0, 0, 6)).toBe(0);
    expect(calculateRoundStars(2, 1, 6)).toBe(1);
    expect(calculateRoundStars(4, 3, 6)).toBe(2);
    expect(calculateRoundStars(6, 5, 6)).toBe(3);

    const state = useAppStore.getState();
    expect(shouldUnlockNextSkill(state.skills['clock-parts'], true)).toBe(true);
    const badges = evaluateEarnedBadges(state, {
      completedChallenge: true,
      clearedReviewItem: true,
    });
    expect(badges).toContain('challenge-champion');
    expect(badges).toContain('review-rescuer');
  });

  it('enqueues, decrements, and clears reviewQueue items and builds review/challenge questions', () => {
    let queue = enqueueReviewItem([], {
      skillId: 'quarter-past-to',
      activityType: 'set-time',
      targetTime: { hours: 3, minutes: 45 },
    });
    expect(queue).toHaveLength(1);
    expect(queue[0].missedCount).toBe(1);

    queue = enqueueReviewItem(queue, {
      skillId: 'quarter-past-to',
      activityType: 'set-time',
      targetTime: { hours: 3, minutes: 45 },
    });
    expect(queue[0].missedCount).toBe(2);

    const reviewQ = generateQuestionFromReviewItem(queue[0]);
    expect(reviewQ.skillId).toBe('quarter-past-to');
    expect(reviewQ.targetTime).toEqual({ hours: 3, minutes: 45 });
    expect(reviewQ.reviewItemId).toBe(queue[0].id);

    queue = resolveReviewItem(queue, queue[0].id);
    expect(queue).toHaveLength(1);
    expect(queue[0].missedCount).toBe(1);

    queue = resolveReviewItem(queue, queue[0].id);
    expect(queue).toHaveLength(0);

    const challengeRound = generateChallengeRound(6);
    expect(challengeRound).toHaveLength(6);
    expect(challengeRound[0].skillId).toBe('oclock');
    expect(challengeRound[5].skillId).toBe('daily-life');
  });
});

