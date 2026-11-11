import {
  AlarmClock,
  Backpack,
  BedDouble,
  BookOpen,
  Moon,
  Sparkles,
  Sun,
  Sunset,
  Utensils,
} from 'lucide-react';
import { DailyRoutineId, DailyRoutinePrompt, PartOfDay } from '../../domain/exerciseGenerator';

export interface DailyActivityCardProps {
  routine: DailyRoutinePrompt;
  className?: string;
}

const ROUTINE_VISUALS: Record<
  DailyRoutineId,
  { Icon: typeof Sun; bgClass: string; iconClass: string; sceneLabel: string }
> = {
  'wake-up': {
    Icon: AlarmClock,
    bgClass: 'bg-amber-100 border-amber-300',
    iconClass: 'text-amber-700',
    sceneLabel: 'Morning wake-up alarm',
  },
  'go-to-school': {
    Icon: Backpack,
    bgClass: 'bg-sky-100 border-sky-300',
    iconClass: 'text-sky-700',
    sceneLabel: 'School backpack',
  },
  'eat-lunch': {
    Icon: Utensils,
    bgClass: 'bg-emerald-100 border-emerald-300',
    iconClass: 'text-emerald-700',
    sceneLabel: 'Lunch plate and utensils',
  },
  'play-time': {
    Icon: Sparkles,
    bgClass: 'bg-hour-soft border-hour/30',
    iconClass: 'text-hour-dark',
    sceneLabel: 'Afternoon playtime',
  },
  'do-homework': {
    Icon: BookOpen,
    bgClass: 'bg-indigo-100 border-indigo-300',
    iconClass: 'text-indigo-700',
    sceneLabel: 'Open homework book',
  },
  'go-to-bed': {
    Icon: BedDouble,
    bgClass: 'bg-slate-200 border-slate-400',
    iconClass: 'text-slate-800',
    sceneLabel: 'Cozy bedtime bed',
  },
};

const PART_OF_DAY_BADGE: Record<
  PartOfDay,
  { Icon: typeof Sun; badgeClass: string }
> = {
  morning: {
    Icon: Sun,
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
  },
  afternoon: {
    Icon: Sunset,
    badgeClass: 'bg-hour-soft text-hour-dark border-hour/30',
  },
  evening: {
    Icon: Moon,
    badgeClass: 'bg-indigo-100 text-indigo-950 border-indigo-300',
  },
};

/**
 * Illustrated daily-routine prompt card with clear morning/afternoon/night cues (EC-EX-03).
 */
export function DailyActivityCard({ routine, className = '' }: DailyActivityCardProps) {
  const visual = ROUTINE_VISUALS[routine.id];
  const dayBadge = PART_OF_DAY_BADGE[routine.partOfDay];
  const RoutineIcon = visual.Icon;
  const DayIcon = dayBadge.Icon;

  return (
    <div
      data-testid="daily-activity-card"
      className={`flex flex-col items-center gap-4 rounded-3xl border-2 border-surface-muted bg-surface-card p-6 text-center shadow-sm ${className}`}
    >
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 text-xs font-extrabold uppercase tracking-wide ${dayBadge.badgeClass}`}
      >
        <DayIcon className="h-4 w-4" aria-hidden="true" />
        <span>{routine.partOfDayLabel}</span>
      </span>

      <div
        role="img"
        aria-label={visual.sceneLabel}
        className={`flex h-24 w-24 items-center justify-center rounded-3xl border-2 ${visual.bgClass}`}
      >
        <RoutineIcon className={`h-12 w-12 ${visual.iconClass}`} aria-hidden="true" />
      </div>

      <div>
        <h2 className="text-xl font-extrabold text-ink sm:text-2xl">{routine.title}</h2>
        <p className="mt-1.5 max-w-md text-base font-semibold text-ink-muted">
          {routine.prompt}
        </p>
      </div>
    </div>
  );
}

