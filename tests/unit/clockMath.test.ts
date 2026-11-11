import { describe, expect, it } from 'vitest';
import {
  applyHourAngleChange,
  applyMinuteAngleChange,
  clientToSvgPoint,
  degreesToMinutes,
  hoursToDegrees,
  minutesToDegrees,
  pointerToClockAngle,
  shortestSignedAngleDelta,
  snapMinutes,
  stepHours,
  stepMinutes,
  timeToHandAngles,
} from '../../src/domain/clockMath';
import {
  areTimesEqual,
  formatDigitalTime,
  normalizeHours,
  normalizeMinutes,
} from '../../src/domain/clockModel';

describe('clockModel', () => {
  it('normalizes hours strictly into 1..12 (EC-GEO-03)', () => {
    expect(normalizeHours(0)).toBe(12);
    expect(normalizeHours(12)).toBe(12);
    expect(normalizeHours(13)).toBe(1);
    expect(normalizeHours(-1)).toBe(11);
    expect(normalizeHours(24)).toBe(12);
  });

  it('normalizes minutes into 0..59 and formats digital time without 00 hour', () => {
    expect(normalizeMinutes(60)).toBe(0);
    expect(normalizeMinutes(-1)).toBe(59);
    expect(formatDigitalTime({ hours: 0, minutes: 15 })).toBe('12:15');
    expect(formatDigitalTime({ hours: 3, minutes: 5 })).toBe('3:05');
    expect(formatDigitalTime({ hours: 3, minutes: 5 }, true)).toBe('03:05');
    expect(areTimesEqual({ hours: 0, minutes: 0 }, { hours: 12, minutes: 0 })).toBe(true);
  });
});

describe('clockMath', () => {
  it('maps all 60 minutes accurately to degrees and back', () => {
    for (let m = 0; m < 60; m++) {
      const deg = minutesToDegrees(m);
      expect(deg).toBe(m * 6);
      expect(degreesToMinutes(deg)).toBe(m);
    }
    expect(minutesToDegrees(15)).toBe(90);
    expect(minutesToDegrees(30)).toBe(180);
    expect(minutesToDegrees(45)).toBe(270);
    expect(minutesToDegrees(59)).toBe(354);
    expect(degreesToMinutes(359)).toBe(0);
  });

  it('snaps minutes to 5-minute and 15-minute intervals', () => {
    expect(snapMinutes(7, 5)).toBe(5);
    expect(snapMinutes(8, 5)).toBe(10);
    expect(snapMinutes(58, 5)).toBe(0);
    expect(snapMinutes(22, 15)).toBe(15);
  });

  it('computes geared and independent hour-hand angles accurately', () => {
    expect(hoursToDegrees(12, 0, true)).toBe(0);
    expect(hoursToDegrees(3, 30, true)).toBe(105);
    expect(hoursToDegrees(3, 45, true)).toBe(112.5);
    expect(hoursToDegrees(3, 45, false)).toBe(90);

    expect(timeToHandAngles({ hours: 6, minutes: 30 }, true)).toEqual({
      hourAngle: 195,
      minuteAngle: 180,
    });
  });

  it('ignores pointer inside center-pivot deadzone and measures clockwise angles outside (EC-GEO-02)', () => {
    expect(pointerToClockAngle(200, 200)).toBeNull();
    expect(pointerToClockAngle(205, 210)).toBeNull();

    const top = pointerToClockAngle(200, 100);
    const right = pointerToClockAngle(300, 200);
    const bottom = pointerToClockAngle(200, 300);
    const left = pointerToClockAngle(100, 200);

    expect(top?.angle).toBeCloseTo(0);
    expect(right?.angle).toBeCloseTo(90);
    expect(bottom?.angle).toBeCloseTo(180);
    expect(left?.angle).toBeCloseTo(270);
  });

  it('wraps hours across 59 <-> 00 in geared mode (EC-GEO-01)', () => {
    expect(applyMinuteAngleChange({ hours: 11, minutes: 59 }, 0, true)).toEqual({
      hours: 12,
      minutes: 0,
    });
    expect(applyMinuteAngleChange({ hours: 12, minutes: 58 }, 12, true)).toEqual({
      hours: 1,
      minutes: 2,
    });
    expect(applyMinuteAngleChange({ hours: 1, minutes: 0 }, 354, true)).toEqual({
      hours: 12,
      minutes: 59,
    });
    expect(applyMinuteAngleChange({ hours: 12, minutes: 2 }, 348, true)).toEqual({
      hours: 11,
      minutes: 58,
    });
  });

  it('does not flip hours on non-wrap jumps or independent hand mode (EC-INP-05)', () => {
    expect(applyMinuteAngleChange({ hours: 12, minutes: 5 }, 210, true)).toEqual({
      hours: 12,
      minutes: 35,
    });
    expect(applyMinuteAngleChange({ hours: 11, minutes: 59 }, 0, false)).toEqual({
      hours: 11,
      minutes: 0,
    });
    expect(shortestSignedAngleDelta(350, 10)).toBe(20);
    expect(shortestSignedAngleDelta(10, 350)).toBe(-20);
  });

  it('updates hour hand while preserving minutes and accounting for geared offset', () => {
    expect(applyHourAngleChange({ hours: 1, minutes: 30 }, 105, true)).toEqual({
      hours: 3,
      minutes: 30,
    });
    expect(applyHourAngleChange({ hours: 1, minutes: 30 }, 0, false)).toEqual({
      hours: 12,
      minutes: 30,
    });
  });

  it('steps hours and minutes discreetly with geared wrap-around', () => {
    expect(stepMinutes({ hours: 12, minutes: 58 }, 5, true)).toEqual({ hours: 1, minutes: 3 });
    expect(stepMinutes({ hours: 1, minutes: 2 }, -5, true)).toEqual({ hours: 12, minutes: 57 });
    expect(stepMinutes({ hours: 12, minutes: 0 }, -1, true)).toEqual({ hours: 11, minutes: 59 });
    expect(stepMinutes({ hours: 12, minutes: 0 }, -1, false)).toEqual({ hours: 12, minutes: 59 });
    expect(stepHours({ hours: 12, minutes: 15 }, 1)).toEqual({ hours: 1, minutes: 15 });
    expect(stepHours({ hours: 1, minutes: 15 }, -1)).toEqual({ hours: 12, minutes: 15 });
  });

  it('maps client coordinates to SVG 400x400 coordinates safely', () => {
    expect(
      clientToSvgPoint(100, 150, { left: 0, top: 0, width: 200, height: 200 })
    ).toEqual({ x: 200, y: 300 });
    expect(clientToSvgPoint(10, 10, { left: 0, top: 0, width: 0, height: 200 })).toBeNull();
  });
});

