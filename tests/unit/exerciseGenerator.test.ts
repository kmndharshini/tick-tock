import { describe, expect, it } from 'vitest';
import { areTimesEqual, formatDigitalTime } from '../../src/domain/clockModel';
import {
  DAILY_ROUTINES,
  generateExerciseQuestion,
  generateExerciseRound,
} from '../../src/domain/exerciseGenerator';
import { SKILL_ORDER } from '../../src/domain/types';

describe('exerciseGenerator', () => {
  it('always produces 4 unique choices across 500 generated questions per SkillId (EC-EX-02)', () => {
    for (const skillId of SKILL_ORDER) {
      for (let i = 0; i < 500; i++) {
        const question = generateExerciseQuestion({ skillId });
        const uniqueKeys = new Set(question.choices.map((c) => formatDigitalTime(c)));
        expect(uniqueKeys.size).toBe(4);
        expect(question.choices.some((c) => areTimesEqual(c, question.targetTime))).toBe(true);
      }
    }
  });

  it('never generates two consecutive identical target times in a round (EC-EX-01)', () => {
    for (const skillId of SKILL_ORDER) {
      const round = generateExerciseRound(skillId, 30);
      expect(round).toHaveLength(30);
      for (let i = 1; i < round.length; i++) {
        expect(areTimesEqual(round[i].targetTime, round[i - 1].targetTime)).toBe(false);
      }
    }
  });

  it('ensures initialClockTime never equals targetTime on set-time and match-analog (EC-EX-06)', () => {
    for (const skillId of SKILL_ORDER) {
      if (skillId === 'daily-life') continue;
      for (const activityType of ['set-time', 'match-analog'] as const) {
        for (let i = 0; i < 50; i++) {
          const question = generateExerciseQuestion({ skillId, activityType });
          expect(areTimesEqual(question.initialClockTime, question.targetTime)).toBe(false);
        }
      }
    }
  });

  it('pairs Daily Life prompts with time-of-day cues and unambiguous choices (EC-EX-03)', () => {
    expect(DAILY_ROUTINES).toHaveLength(6);

    for (let i = 0; i < 100; i++) {
      const question = generateExerciseQuestion({
        skillId: 'daily-life',
        activityType: 'daily-life',
      });
      expect(question.dailyRoutine).toBeDefined();
      const routine = question.dailyRoutine!;
      expect(['Morning', 'Afternoon', 'Night']).toContain(routine.partOfDayLabel);

      const distractors = question.choices.filter(
        (c) => !areTimesEqual(c, question.targetTime)
      );
      expect(distractors).toHaveLength(3);
      for (const distractor of distractors) {
        expect(routine.plausibleWindowHours).not.toContain(distractor.hours);
      }
    }
  });
});

