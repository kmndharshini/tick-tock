import { stepHours, stepMinutes } from '../../domain/clockMath';
import { TimeValue } from '../../domain/types';

export interface TapToSetPadProps {
  time: TimeValue;
  gearedHands?: boolean;
  activeHand: 'hour' | 'minute';
  onActiveHandChange: (hand: 'hour' | 'minute') => void;
  onChange: (next: TimeValue) => void;
  onCommit?: (committed: TimeValue) => void;
}

/**
 * Accessible Tap-to-Set selector and fine stepper pad so learners can adjust
 * clock hands reliably without sustaining drag gestures.
 */
export function TapToSetPad({
  time,
  gearedHands = true,
  activeHand,
  onActiveHandChange,
  onChange,
  onCommit,
}: TapToSetPadProps) {
  const apply = (next: TimeValue) => {
    onChange(next);
    onCommit?.(next);
  };

  return (
    <div
      className="flex flex-col gap-3 rounded-2xl border-2 border-surface-muted bg-surface-card p-3 sm:p-4"
      aria-label="Tap to set and stepper controls"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-extrabold uppercase tracking-wide text-ink-muted">
          Tap clock to move:
        </span>
        <button
          type="button"
          aria-pressed={activeHand === 'hour'}
          onClick={() => onActiveHandChange('hour')}
          className={[
            'touch-target inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-extrabold transition-colors',
            activeHand === 'hour'
              ? 'bg-hour-dark text-white shadow-sm'
              : 'bg-hour-soft text-hour-dark hover:bg-hour/20',
          ].join(' ')}
        >
          Hour Hand
        </button>
        <button
          type="button"
          aria-pressed={activeHand === 'minute'}
          onClick={() => onActiveHandChange('minute')}
          className={[
            'touch-target inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-extrabold transition-colors',
            activeHand === 'minute'
              ? 'bg-minute text-white shadow-sm'
              : 'bg-minute-soft text-minute-dark hover:bg-minute/20',
          ].join(' ')}
        >
          Minute Hand
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => apply(stepHours(time, -1))}
          aria-label="Subtract 1 hour"
          className="touch-target rounded-xl border-2 border-hour/30 bg-hour-soft px-3 py-2 text-sm font-extrabold text-hour-dark hover:bg-hour/20"
        >
          -1 hr
        </button>
        <button
          type="button"
          onClick={() => apply(stepHours(time, 1))}
          aria-label="Add 1 hour"
          className="touch-target rounded-xl border-2 border-hour/30 bg-hour-soft px-3 py-2 text-sm font-extrabold text-hour-dark hover:bg-hour/20"
        >
          +1 hr
        </button>

        <div className="mx-1 hidden h-6 w-px bg-surface-muted sm:block" aria-hidden="true" />

        <button
          type="button"
          onClick={() => apply(stepMinutes(time, -5, gearedHands))}
          aria-label="Subtract 5 minutes"
          className="touch-target rounded-xl border-2 border-minute/30 bg-minute-soft px-3 py-2 text-sm font-extrabold text-minute-dark hover:bg-minute/20"
        >
          -5m
        </button>
        <button
          type="button"
          onClick={() => apply(stepMinutes(time, -1, gearedHands))}
          aria-label="Subtract 1 minute"
          className="touch-target rounded-xl border-2 border-minute/30 bg-minute-soft px-3 py-2 text-sm font-extrabold text-minute-dark hover:bg-minute/20"
        >
          -1m
        </button>
        <button
          type="button"
          onClick={() => apply(stepMinutes(time, 1, gearedHands))}
          aria-label="Add 1 minute"
          className="touch-target rounded-xl border-2 border-minute/30 bg-minute-soft px-3 py-2 text-sm font-extrabold text-minute-dark hover:bg-minute/20"
        >
          +1m
        </button>
        <button
          type="button"
          onClick={() => apply(stepMinutes(time, 5, gearedHands))}
          aria-label="Add 5 minutes"
          className="touch-target rounded-xl border-2 border-minute/30 bg-minute-soft px-3 py-2 text-sm font-extrabold text-minute-dark hover:bg-minute/20"
        >
          +5m
        </button>
      </div>
    </div>
  );
}

