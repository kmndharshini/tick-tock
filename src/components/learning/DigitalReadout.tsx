import { Moon, Sun, Sunset } from 'lucide-react';
import { describeClockTime, formatDigitalTime } from '../../domain/clockModel';
import { TimeValue } from '../../domain/types';

export type PartOfDay = 'morning' | 'afternoon' | 'evening';

export interface DigitalReadoutProps {
  time: TimeValue;
  visible?: boolean;
  showWords?: boolean;
  partOfDay?: PartOfDay | null;
  className?: string;
}

const PART_OF_DAY_META: Record<PartOfDay, { label: string; Icon: typeof Sun; badgeClass: string }> = {
  morning: {
    label: 'Morning',
    Icon: Sun,
    badgeClass: 'bg-hour-soft text-hour-dark border-hour/30',
  },
  afternoon: {
    label: 'Afternoon',
    Icon: Sun,
    badgeClass: 'bg-minute-soft text-minute-dark border-minute/30',
  },
  evening: {
    label: 'Night',
    Icon: Moon,
    badgeClass: 'bg-surface-muted text-ink border-ink/20',
  },
};

/**
 * Large, tabular-numeral digital time card with optional verbal phrasing and time-of-day badge.
 */
export function DigitalReadout({
  time,
  visible = true,
  showWords = true,
  partOfDay = null,
  className = '',
}: DigitalReadoutProps) {
  if (!visible) {
    return (
      <div
        data-testid="digital-readout-hidden"
        className={`flex min-h-[96px] items-center justify-center rounded-2xl border-2 border-dashed border-surface-muted bg-surface-muted/50 px-5 py-4 text-center text-sm font-bold text-ink-muted ${className}`}
      >
        Digital time hidden — read the analog clock hands!
      </div>
    );
  }

  const digital = formatDigitalTime(time);
  const [hourText, minuteText] = digital.split(':');
  const dayMeta = partOfDay ? PART_OF_DAY_META[partOfDay] : null;
  const DayIcon = dayMeta?.Icon ?? Sunset;

  return (
    <div
      data-testid="digital-readout"
      className={`flex flex-col items-center justify-center rounded-2xl border-2 border-surface-muted bg-surface-card px-5 py-4 shadow-sm ${className}`}
    >
      {dayMeta && (
        <span
          className={`mb-2 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-extrabold uppercase tracking-wide ${dayMeta.badgeClass}`}
        >
          <DayIcon className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{dayMeta.label}</span>
        </span>
      )}

      <div
        className="flex items-baseline gap-1 text-4xl font-extrabold tracking-tight sm:text-5xl"
        style={{ fontVariantNumeric: 'tabular-nums' }}
        aria-label={`Digital time ${digital}`}
      >
        <span className="text-hour-dark">{hourText}</span>
        <span className="text-ink" aria-hidden="true">
          :
        </span>
        <span className="text-minute-dark">{minuteText}</span>
      </div>

      {showWords && (
        <p className="mt-1 text-base font-bold capitalize text-ink-muted">
          {describeClockTime(time)}
        </p>
      )}
    </div>
  );
}

