import { TimeValue } from './types';

/**
 * Normalize an hour value strictly into the 12-hour analog range 1..12.
 * Ensures 0 and 12 both map to 12 (never 00).
 */
export function normalizeHours(hours: number): number {
  const rounded = Math.round(hours);
  return (((rounded - 1) % 12) + 12) % 12 + 1;
}

/** Normalize a minute value strictly into 0..59. */
export function normalizeMinutes(minutes: number): number {
  const rounded = Math.round(minutes);
  return ((rounded % 60) + 60) % 60;
}

/** Normalize a TimeValue into valid 12-hour bounds ({ hours: 1..12, minutes: 0..59 }). */
export function normalizeTime(time: TimeValue): TimeValue {
  return {
    hours: normalizeHours(time.hours),
    minutes: normalizeMinutes(time.minutes),
  };
}

/** Format a TimeValue as 12-hour digital string (e.g., "3:05", "12:00"). */
export function formatDigitalTime(time: TimeValue, padHour = false): string {
  const normalized = normalizeTime(time);
  const hourStr = padHour
    ? String(normalized.hours).padStart(2, '0')
    : String(normalized.hours);
  const minStr = String(normalized.minutes).padStart(2, '0');
  return `${hourStr}:${minStr}`;
}

/** Check whether two TimeValues represent the exact same 12-hour clock time. */
export function areTimesEqual(a: TimeValue, b: TimeValue): boolean {
  const normA = normalizeTime(a);
  const normB = normalizeTime(b);
  return normA.hours === normB.hours && normA.minutes === normB.minutes;
}

/** Return a child-friendly spoken/readable phrase for a 12-hour TimeValue. */
export function describeClockTime(time: TimeValue): string {
  const { hours, minutes } = normalizeTime(time);
  const nextHour = normalizeHours(hours + 1);

  if (minutes === 0) return `${hours} o'clock`;
  if (minutes === 15) return `quarter past ${hours}`;
  if (minutes === 30) return `half past ${hours}`;
  if (minutes === 45) return `quarter to ${nextHour}`;
  if (minutes < 10) return `${hours} oh ${minutes}`;
  return `${hours}:${String(minutes).padStart(2, '0')}`;
}

