import { ReactNode } from 'react';

interface ScreenPlaceholderProps {
  title: string;
  subtitle: string;
  phaseNote: string;
  children?: ReactNode;
}

/** Shared Phase 0 layout card for scaffolded screens. */
export function ScreenPlaceholder({
  title,
  subtitle,
  phaseNote,
  children,
}: ScreenPlaceholderProps) {
  return (
    <section
      aria-labelledby="screen-heading"
      className="mx-auto w-full max-w-3xl rounded-3xl border-2 border-surface-muted bg-surface-card p-6 shadow-sm sm:p-8"
    >
      <span className="inline-block rounded-full bg-minute-soft px-3 py-1 text-xs font-bold uppercase tracking-wide text-minute-dark">
        {phaseNote}
      </span>
      <h1 id="screen-heading" className="mt-3 text-2xl font-extrabold text-ink sm:text-3xl">
        {title}
      </h1>
      <p className="mt-2 text-base text-ink-muted">{subtitle}</p>
      {children && <div className="mt-6">{children}</div>}
    </section>
  );
}

