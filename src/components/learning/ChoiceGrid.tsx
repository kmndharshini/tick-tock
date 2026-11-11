import { CheckCircle2 } from 'lucide-react';
import { areTimesEqual, formatDigitalTime } from '../../domain/clockModel';
import { TimeValue } from '../../domain/types';

export interface ChoiceGridProps {
  choices: TimeValue[];
  selectedChoice: TimeValue | null;
  correctChoice?: TimeValue | null;
  isResolved?: boolean;
  disabled?: boolean;
  onSelect: (choice: TimeValue) => void;
}

/**
 * Large touch-friendly multiple-choice grid for analog-to-digital and daily-life activities.
 */
export function ChoiceGrid({
  choices,
  selectedChoice,
  correctChoice = null,
  isResolved = false,
  disabled = false,
  onSelect,
}: ChoiceGridProps) {
  return (
    <div
      className="grid grid-cols-2 gap-3 sm:gap-4"
      role="group"
      aria-label="Answer choices"
    >
      {choices.map((choice) => {
        const label = formatDigitalTime(choice);
        const [hourText, minuteText] = label.split(':');
        const isSelected = selectedChoice !== null && areTimesEqual(selectedChoice, choice);
        const isCorrectAnswer =
          isResolved && correctChoice !== null && areTimesEqual(correctChoice, choice);
        const isTriedNotMatch = isSelected && !isResolved;

        let stateClasses =
          'border-surface-muted bg-surface-card hover:border-minute hover:bg-minute-soft/40';
        if (isCorrectAnswer) {
          stateClasses = 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-600/20';
        } else if (isTriedNotMatch) {
          stateClasses = 'border-hour bg-hour-soft/50';
        }

        return (
          <button
            key={label}
            type="button"
            disabled={disabled || isResolved}
            aria-pressed={isSelected}
            aria-label={`Choose ${label}`}
            onClick={() => onSelect(choice)}
            className={[
              'touch-target relative flex min-h-[72px] items-center justify-center rounded-2xl border-2 px-4 py-4 text-3xl font-extrabold tracking-tight shadow-sm transition-colors disabled:cursor-default sm:text-4xl',
              stateClasses,
            ].join(' ')}
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            <span className="text-hour-dark">{hourText}</span>
            <span className="mx-0.5 text-ink" aria-hidden="true">
              :
            </span>
            <span className="text-minute-dark">{minuteText}</span>

            {isCorrectAnswer && (
              <CheckCircle2
                className="ml-2 h-6 w-6 shrink-0 text-emerald-700"
                aria-hidden="true"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

