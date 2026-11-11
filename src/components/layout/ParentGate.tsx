import { Calculator, Lock, ShieldCheck } from 'lucide-react';
import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';

export interface ParentGateProps {
  onUnlock: () => void;
  holdDurationMs?: number;
  mathChallenge?: { a: number; b: number };
}

const MATH_PAIRS: readonly { a: number; b: number }[] = [
  { a: 3, b: 4 },
  { a: 4, b: 5 },
  { a: 6, b: 3 },
  { a: 4, b: 7 },
  { a: 6, b: 4 },
];

const TICK_INTERVAL_MS = 50;

/**
 * Child-resistant entry gate for Parent/Teacher settings.
 * Prevents accidental 1-tap entry via a 2-second hold button while providing
 * an accessible keyboard/math multiplication fallback (EC-STR-03).
 */
export function ParentGate({
  onUnlock,
  holdDurationMs = 2000,
  mathChallenge,
}: ParentGateProps) {
  const [challenge] = useState<{ a: number; b: number }>(
    () => mathChallenge ?? MATH_PAIRS[Math.floor(Math.random() * MATH_PAIRS.length)]
  );
  const [isHolding, setIsHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [holdStatus, setHoldStatus] = useState('');

  const [mathInput, setMathInput] = useState('');
  const [mathError, setMathError] = useState('');

  const timerRef = useRef<number | null>(null);
  const holdStartRef = useRef<number | null>(null);
  const unlockedRef = useRef(false);

  const clearHoldTimer = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    holdStartRef.current = null;
  };

  useEffect(() => {
    return () => {
      clearHoldTimer();
    };
  }, []);

  const startHold = () => {
    if (unlockedRef.current || isHolding) return;
    setIsHolding(true);
    setHoldProgress(0);
    setHoldStatus('Keep holding for 2 seconds to unlock.');
    holdStartRef.current = Date.now();

    timerRef.current = window.setInterval(() => {
      if (holdStartRef.current === null || unlockedRef.current) return;
      const elapsed = Date.now() - holdStartRef.current;
      const pct = Math.min(100, Math.round((elapsed / holdDurationMs) * 100));
      setHoldProgress(pct);

      if (elapsed >= holdDurationMs) {
        clearHoldTimer();
        unlockedRef.current = true;
        setIsHolding(false);
        setHoldProgress(100);
        setHoldStatus('Parent and Teacher view unlocked.');
        onUnlock();
      }
    }, TICK_INTERVAL_MS);
  };

  const cancelHold = () => {
    if (!isHolding || unlockedRef.current) return;
    clearHoldTimer();
    setIsHolding(false);
    setHoldProgress(0);
    setHoldStatus('Hold cancelled. Hold for 2 seconds or use the math check below.');
  };

  const handleHoldKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (!event.repeat) {
        startHold();
      }
    }
  };

  const handleHoldKeyUp = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      cancelHold();
    }
  };

  const handleMathSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = mathInput.trim();
    const parsed = Number(trimmed);
    const expected = challenge.a * challenge.b;

    if (trimmed !== '' && Number.isInteger(parsed) && parsed === expected) {
      setMathError('');
      unlockedRef.current = true;
      clearHoldTimer();
      onUnlock();
      return;
    }

    setMathError('Not quite—please enter the multiplication answer and try again.');
  };

  return (
    <section
      aria-labelledby="parent-gate-heading"
      data-testid="parent-gate"
      className="mx-auto flex w-full max-w-2xl flex-col gap-6 rounded-3xl border-2 border-surface-muted bg-surface-card p-6 shadow-sm sm:p-8"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-minute-soft text-minute-dark">
          <Lock className="h-6 w-6" aria-hidden="true" />
        </div>
        <div>
          <h2 id="parent-gate-heading" className="text-xl font-extrabold text-ink sm:text-2xl">
            Grown-Up Check
          </h2>
          <p className="mt-1 text-sm text-ink-muted sm:text-base">
            This area lets parents and teachers view detailed accuracy stats and change learning
            settings.
          </p>
        </div>
      </div>

      {/* Method 1: Hold for 2 seconds */}
      <div className="flex flex-col gap-3 rounded-2xl border-2 border-surface-muted bg-surface p-5">
        <p className="text-sm font-extrabold text-ink">Option 1: Press and hold</p>
        <button
          type="button"
          onPointerDown={(e) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            startHold();
          }}
          onPointerUp={cancelHold}
          onPointerLeave={cancelHold}
          onPointerCancel={cancelHold}
          onKeyDown={handleHoldKeyDown}
          onKeyUp={handleHoldKeyUp}
          onBlur={cancelHold}
          aria-describedby="hold-instruction"
          className="touch-target relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 border-minute bg-minute-soft px-5 py-3.5 text-base font-extrabold text-minute-dark transition-colors hover:bg-minute/15 select-none"
        >
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 bg-minute/25 transition-[width] duration-75"
            style={{ width: `${holdProgress}%` }}
          />
          <ShieldCheck className="relative z-10 h-5 w-5" aria-hidden="true" />
          <span className="relative z-10">
            {isHolding ? `Holding... ${holdProgress}%` : 'Hold for 2 Seconds to Enter'}
          </span>
        </button>

        <div
          role="progressbar"
          aria-label="Hold progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={holdProgress}
          className="h-2.5 w-full overflow-hidden rounded-full bg-surface-muted"
        >
          <div
            className="h-full rounded-full bg-minute transition-[width] duration-75"
            style={{ width: `${holdProgress}%` }}
          />
        </div>

        <p id="hold-instruction" className="text-xs font-semibold text-ink-muted">
          Press and hold with a finger, mouse, or by holding Space/Enter for 2 seconds.
        </p>
        <p className="sr-only" aria-live="polite">
          {holdStatus}
        </p>
      </div>

      {/* Method 2: Accessible Math Check fallback */}
      <form
        onSubmit={handleMathSubmit}
        className="flex flex-col gap-3 rounded-2xl border-2 border-surface-muted bg-surface p-5"
        noValidate
      >
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-hour-dark" aria-hidden="true" />
          <p className="text-sm font-extrabold text-ink">Option 2: Quick math check (Keyboard friendly)</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label
              htmlFor="parent-gate-math"
              className="block text-sm font-extrabold text-ink"
            >
              What is {challenge.a} × {challenge.b}?
            </label>
            <input
              id="parent-gate-math"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={mathInput}
              onChange={(e) => {
                setMathInput(e.target.value);
                if (mathError) setMathError('');
              }}
              placeholder="Enter answer"
              aria-invalid={Boolean(mathError)}
              aria-describedby={mathError ? 'parent-gate-math-error' : undefined}
              className="mt-1.5 min-h-[48px] w-full rounded-2xl border-2 border-surface-muted bg-surface-card px-4 py-2 text-base font-bold text-ink focus:border-minute focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="touch-target inline-flex items-center justify-center rounded-2xl bg-hour-dark px-6 py-3 text-base font-extrabold text-white shadow-sm hover:bg-hour"
          >
            Unlock View
          </button>
        </div>

        {mathError && (
          <p
            id="parent-gate-math-error"
            role="alert"
            className="text-sm font-bold text-hour-dark"
          >
            {mathError}
          </p>
        )}
      </form>
    </section>
  );
}

