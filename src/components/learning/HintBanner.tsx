import { CheckCircle2, Lightbulb } from 'lucide-react';
import { ValidationResult } from '../../domain/validator';

export interface HintBannerProps {
  result: ValidationResult | null;
  className?: string;
}

/**
 * Encouraging, non-punitive feedback banner with diagnostic hints for learners.
 */
export function HintBanner({ result, className = '' }: HintBannerProps) {
  return (
    <div aria-live="polite" aria-atomic="true" className={className}>
      {result && (
        <div
          data-testid="hint-banner"
          className={[
            'flex items-start gap-3 rounded-2xl border-2 p-4 shadow-sm',
            result.isCorrect
              ? 'border-emerald-500 bg-emerald-50 text-emerald-950'
              : 'border-amber-400 bg-amber-50 text-amber-950',
          ].join(' ')}
        >
          {result.isCorrect ? (
            <CheckCircle2
              className="mt-0.5 h-6 w-6 shrink-0 text-emerald-700"
              aria-hidden="true"
            />
          ) : (
            <Lightbulb
              className="mt-0.5 h-6 w-6 shrink-0 text-amber-700"
              aria-hidden="true"
            />
          )}

          <div className="flex flex-col gap-0.5">
            <p className="text-base font-extrabold">{result.feedbackTitle}</p>
            <p className="text-sm font-semibold leading-relaxed">{result.hint}</p>
          </div>
        </div>
      )}
    </div>
  );
}

