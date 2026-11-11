import { describe, expect, it } from 'vitest';
import { generateExerciseQuestion } from '../../src/domain/exerciseGenerator';
import { diagnoseMistake, validateExerciseAnswer } from '../../src/domain/validator';

const PUNITIVE_WORDS = /\b(wrong|failed|failure|error|bad|incorrect)\b/i;

describe('validator & diagnostic hints', () => {
  it('validates 12:00 equivalence and normalized hours across geared and independent modes', () => {
    const question = generateExerciseQuestion({
      skillId: 'oclock',
      activityType: 'set-time',
    });
    question.targetTime = { hours: 12, minutes: 0 };

    const exact = validateExerciseAnswer(question, { hours: 12, minutes: 0 }, { gearedHands: true });
    expect(exact.isCorrect).toBe(true);

    const zeroNormalized = validateExerciseAnswer(
      question,
      { hours: 0, minutes: 0 },
      { gearedHands: false }
    );
    expect(zeroNormalized.isCorrect).toBe(true);
  });

  it('validates match-digital, match-analog, and daily-life answers accurately', () => {
    const matchDigital = generateExerciseQuestion({
      skillId: 'half-past',
      activityType: 'match-digital',
    });
    expect(validateExerciseAnswer(matchDigital, matchDigital.targetTime).isCorrect).toBe(true);

    const matchAnalog = generateExerciseQuestion({
      skillId: 'five-minutes',
      activityType: 'match-analog',
    });
    expect(validateExerciseAnswer(matchAnalog, matchAnalog.targetTime).isCorrect).toBe(true);

    const dailyLife = generateExerciseQuestion({
      skillId: 'daily-life',
      activityType: 'daily-life',
    });
    expect(validateExerciseAnswer(dailyLife, dailyLife.targetTime).isCorrect).toBe(true);
  });

  it('diagnoses swapped hands in both geared and independent modes (EC-EX-05)', () => {
    const gearedSwap = diagnoseMistake(
      { hours: 3, minutes: 0 },
      { hours: 12, minutes: 15 },
      { gearedHands: true }
    );
    expect(gearedSwap.mistakeCategory).toBe('swapped-hands');
    expect(gearedSwap.hint).toMatch(/short.*hour hand.*3/i);
    expect(gearedSwap.hint).not.toMatch(PUNITIVE_WORDS);

    const independentSwap = diagnoseMistake(
      { hours: 3, minutes: 25 },
      { hours: 5, minutes: 15 },
      { gearedHands: false }
    );
    expect(independentSwap.mistakeCategory).toBe('swapped-hands');

    // Tolerance +-2 minutes when dragging in geared mode
    const fuzzySwap = diagnoseMistake(
      { hours: 3, minutes: 0 },
      { hours: 12, minutes: 14 },
      { gearedHands: true }
    );
    expect(fuzzySwap.mistakeCategory).toBe('swapped-hands');
  });

  it('diagnoses off-by-one hour on :45 to :59 quarter-to/near-hour times (EC-GEO-04)', () => {
    const quarterTo = diagnoseMistake(
      { hours: 3, minutes: 45 },
      { hours: 4, minutes: 45 },
      { gearedHands: true }
    );
    expect(quarterTo.mistakeCategory).toBe('off-by-one-hour-near-hour');
    expect(quarterTo.hint).toMatch(/3:45/);
    expect(quarterTo.hint).toMatch(/still 3/i);
    expect(quarterTo.hint).not.toMatch(PUNITIVE_WORDS);

    const nearHour = diagnoseMistake(
      { hours: 3, minutes: 55 },
      { hours: 4, minutes: 55 },
      { gearedHands: true }
    );
    expect(nearHour.mistakeCategory).toBe('off-by-one-hour-near-hour');
  });

  it('diagnoses 5-minute interval vs hour-number confusion (:04 vs :20)', () => {
    const fiveMinConfusion = diagnoseMistake(
      { hours: 3, minutes: 20 },
      { hours: 3, minutes: 4 },
      { gearedHands: true }
    );
    expect(fiveMinConfusion.mistakeCategory).toBe('five-minute-confusion');
    expect(fiveMinConfusion.hint).toMatch(/5 minutes/i);
    expect(fiveMinConfusion.hint).not.toMatch(PUNITIVE_WORDS);

    const reverseConfusion = diagnoseMistake(
      { hours: 3, minutes: 4 },
      { hours: 3, minutes: 20 },
      { gearedHands: true }
    );
    expect(reverseConfusion.mistakeCategory).toBe('five-minute-confusion');
  });

  it('never uses punitive phrasing across all mistake categories', () => {
    const sampleCases = [
      diagnoseMistake({ hours: 3, minutes: 0 }, { hours: 4, minutes: 0 }),
      diagnoseMistake({ hours: 3, minutes: 18 }, { hours: 3, minutes: 16 }),
      diagnoseMistake({ hours: 3, minutes: 35 }, { hours: 3, minutes: 10 }),
      diagnoseMistake({ hours: 3, minutes: 0 }, { hours: 9, minutes: 30 }),
    ];

    for (const result of sampleCases) {
      expect(result.hint).not.toMatch(PUNITIVE_WORDS);
      expect(result.hint.length).toBeGreaterThan(15);
    }
  });
});

