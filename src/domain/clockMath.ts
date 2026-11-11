import { normalizeHours, normalizeMinutes, normalizeTime } from './clockModel';
import { TimeValue } from './types';

export const CLOCK_VIEWBOX_SIZE = 400;
export const CLOCK_CENTER = 200;
export const CENTER_DEADZONE_RADIUS = 18;
export const DIAL_OUTER_RADIUS = 195;

export interface HandAngles {
  hourAngle: number;
  minuteAngle: number;
}

/** Convert 0..59 minutes to clockwise degrees from 12 o'clock (0..354). */
export function minutesToDegrees(minutes: number): number {
  return normalizeMinutes(minutes) * 6;
}

/** Normalize any angle in degrees into [0, 360). */
export function normalizeDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

/** Snap a minute count to the nearest step (e.g. 1, 5, 15, 30) in 0..59. */
export function snapMinutes(minutes: number, step = 1): number {
  const safeStep = Math.max(1, Math.round(step));
  const snapped = Math.round(minutes / safeStep) * safeStep;
  return normalizeMinutes(snapped);
}

/** Convert clockwise degrees from 12 o'clock into a snapped 0..59 minute value. */
export function degreesToMinutes(degrees: number, snapStep = 1): number {
  const normalized = normalizeDegrees(degrees);
  const rawMinutes = normalized / 6;
  return snapMinutes(rawMinutes, snapStep);
}

/**
 * Compute clockwise hour-hand degrees from 12 o'clock.
 * In geared mode, each minute advances the hour hand by 0.5 degrees.
 */
export function hoursToDegrees(hours: number, minutes = 0, geared = true): number {
  const normHour = normalizeHours(hours) % 12;
  const normMin = normalizeMinutes(minutes);
  const baseAngle = normHour * 30;
  return geared ? baseAngle + normMin * 0.5 : baseAngle;
}

/** Compute both hour and minute hand angles for a given TimeValue. */
export function timeToHandAngles(time: TimeValue, geared = true): HandAngles {
  const normalized = normalizeTime(time);
  return {
    hourAngle: hoursToDegrees(normalized.hours, normalized.minutes, geared),
    minuteAngle: minutesToDegrees(normalized.minutes),
  };
}

/** Convert clock coordinates (cx, cy, radius, clockwise degrees from 12) to SVG (x, y). */
export function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angleDegrees: number
): { x: number; y: number } {
  const rad = ((angleDegrees - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  };
}

/**
 * Compute clockwise degrees from 12 o'clock and radial distance for an SVG pointer point.
 * Returns null if the point falls inside the center-pivot deadzone (EC-GEO-02).
 */
export function pointerToClockAngle(
  px: number,
  py: number,
  cx = CLOCK_CENTER,
  cy = CLOCK_CENTER,
  deadzoneRadius = CENTER_DEADZONE_RADIUS
): { angle: number; radius: number } | null {
  if (!Number.isFinite(px) || !Number.isFinite(py)) {
    return null;
  }
  const dx = px - cx;
  const dy = py - cy;
  const radius = Math.hypot(dx, dy);
  if (!Number.isFinite(radius) || radius < deadzoneRadius) {
    return null;
  }
  const angle = normalizeDegrees((Math.atan2(dx, -dy) * 180) / Math.PI);
  return { angle, radius };
}

/** Shortest signed angular difference from prevAngle to nextAngle in [-180, 180). */
export function shortestSignedAngleDelta(prevAngle: number, nextAngle: number): number {
  return ((nextAngle - prevAngle + 540) % 360) - 180;
}

/**
 * Update TimeValue from a minute-hand angle change, wrapping hours across 59 <-> 00
 * in geared mode (EC-GEO-01) while avoiding false flips on large non-wrap jumps (EC-INP-05).
 */
export function applyMinuteAngleChange(
  current: TimeValue,
  nextMinuteAngle: number,
  geared = true,
  snapStep = 1
): TimeValue {
  const normalizedCurrent = normalizeTime(current);
  const nextMinutes = degreesToMinutes(nextMinuteAngle, snapStep);

  if (!geared) {
    return {
      hours: normalizedCurrent.hours,
      minutes: nextMinutes,
    };
  }

  const rawDiff = nextMinutes - normalizedCurrent.minutes;
  let hourDelta = 0;

  if (rawDiff < -30) {
    hourDelta = 1;
  } else if (rawDiff > 30 && normalizedCurrent.minutes <= 15 && nextMinutes >= 45) {
    hourDelta = -1;
  }

  return {
    hours: normalizeHours(normalizedCurrent.hours + hourDelta),
    minutes: nextMinutes,
  };
}

/**
 * Update TimeValue from an hour-hand angle change while preserving current minutes.
 * Accounts for the geared minute offset so dragging the hour hand at :30 feels natural.
 */
export function applyHourAngleChange(
  current: TimeValue,
  nextHourAngle: number,
  geared = true
): TimeValue {
  const normalizedCurrent = normalizeTime(current);
  const gearedOffset = geared ? normalizedCurrent.minutes * 0.5 : 0;
  const adjustedAngle = normalizeDegrees(nextHourAngle - gearedOffset);
  const rawHour = Math.round(adjustedAngle / 30);

  return {
    hours: normalizeHours(rawHour === 0 ? 12 : rawHour),
    minutes: normalizedCurrent.minutes,
  };
}

/**
 * Step minutes by a discrete delta (e.g. +1, -1, +5, -5), wrapping hours across 59 <-> 00 in geared mode.
 */
export function stepMinutes(current: TimeValue, deltaMinutes: number, geared = true): TimeValue {
  const normalized = normalizeTime(current);
  const totalMinutes = normalized.minutes + deltaMinutes;

  if (!geared) {
    return {
      hours: normalized.hours,
      minutes: normalizeMinutes(totalMinutes),
    };
  }

  const hourCarry = Math.floor(totalMinutes / 60);
  return {
    hours: normalizeHours(normalized.hours + hourCarry),
    minutes: normalizeMinutes(totalMinutes),
  };
}

/** Step hours by a discrete delta (e.g. +1, -1) while preserving minutes. */
export function stepHours(current: TimeValue, deltaHours: number): TimeValue {
  const normalized = normalizeTime(current);
  return {
    hours: normalizeHours(normalized.hours + deltaHours),
    minutes: normalized.minutes,
  };
}

/** Convert client pointer coordinates to SVG viewBox (0..400) coordinates. */
export function clientToSvgPoint(
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>
): { x: number; y: number } | null {
  if (
    !Number.isFinite(clientX) ||
    !Number.isFinite(clientY) ||
    rect.width <= 0 ||
    rect.height <= 0
  ) {
    return null;
  }
  return {
    x: ((clientX - rect.left) / rect.width) * CLOCK_VIEWBOX_SIZE,
    y: ((clientY - rect.top) / rect.height) * CLOCK_VIEWBOX_SIZE,
  };
}

