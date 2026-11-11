import { Award, BookOpen, Clock, Compass, ShieldCheck, Sparkles, Target, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SKILL_ORDER } from '../domain/types';
import { useAppStore } from '../store/useAppStore';

const ACTIVITY_CARDS = [
  {
    to: '/learn',
    title: 'Learn the Clock',
    description: 'Meet the hour & minute hands, numbers 1–12, and 60 minutes.',
    icon: BookOpen,
    accent: 'border-hour/30 bg-hour-soft/70 text-hour-dark',
  },
  {
    to: '/explore',
    title: 'Interactive Clock',
    description: 'Move the hands freely and explore all 00–59 minute labels.',
    icon: Compass,
    accent: 'border-minute/30 bg-minute-soft/70 text-minute-dark',
  },
  {
    to: '/exercise',
    title: 'Practice Exercises',
    description: 'Set the time, match analog & digital clocks, and daily routines.',
    icon: Target,
    accent: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  },
  {
    to: '/challenge',
    title: 'Clock Challenge',
    description: 'Test your skills with or without a timer and earn stars.',
    icon: Trophy,
    accent: 'border-amber-300 bg-amber-50 text-amber-900',
  },
  {
    to: '/progress',
    title: 'Your Progress',
    description: 'View unlocked skills, stars earned, and badges.',
    icon: Award,
    accent: 'border-indigo-200 bg-indigo-50 text-indigo-900',
  },
] as const;

export function HomeScreen() {
  const totalStars = useAppStore((s) => s.totalStars);
  const skills = useAppStore((s) => s.skills);
  const unlockedCount = SKILL_ORDER.filter((id) => skills[id]?.unlocked).length;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <section
        aria-labelledby="home-heading"
        className="rounded-3xl border-2 border-surface-muted bg-surface-card p-6 shadow-sm sm:p-8"
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-hour-soft px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-hour-dark">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Touch-First Clock Learning</span>
            </span>
            <h1 id="home-heading" className="mt-3 text-3xl font-extrabold text-ink sm:text-4xl">
              Welcome to Tick-Tock
            </h1>
            <p className="mt-2 text-base text-ink-muted sm:text-lg">
              Touch, move, and match analog and digital clocks step by step—from o&apos;clock to
              every minute around the dial.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                to="/learn"
                className="touch-target inline-flex items-center justify-center gap-2 rounded-2xl bg-hour-dark px-6 py-3 text-base font-extrabold text-white shadow-sm hover:bg-hour"
              >
                <BookOpen className="h-5 w-5" aria-hidden="true" />
                <span>Start Learning</span>
              </Link>
              <Link
                to="/explore"
                className="touch-target inline-flex items-center justify-center gap-2 rounded-2xl bg-minute px-6 py-3 text-base font-extrabold text-white shadow-sm hover:bg-minute-dark"
              >
                <Clock className="h-5 w-5" aria-hidden="true" />
                <span>Interactive Clock</span>
              </Link>
            </div>
          </div>

          <div className="flex shrink-0 flex-row gap-3 sm:flex-col">
            <div className="rounded-2xl border-2 border-surface-muted bg-surface px-4 py-3 text-center">
              <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Stars</p>
              <p className="text-2xl font-extrabold text-hour-dark">★ {totalStars}</p>
            </div>
            <div className="rounded-2xl border-2 border-surface-muted bg-surface px-4 py-3 text-center">
              <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Skills</p>
              <p className="text-2xl font-extrabold text-minute-dark">
                {unlockedCount}/{SKILL_ORDER.length}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Learning activities" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ACTIVITY_CARDS.map(({ to, title, description, icon: Icon, accent }) => (
          <Link
            key={to}
            to={to}
            className="touch-target group flex flex-col justify-between rounded-3xl border-2 border-surface-muted bg-surface-card p-5 shadow-sm transition hover:border-minute/50 hover:shadow-md"
          >
            <div>
              <div
                className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl border ${accent}`}
              >
                <Icon className="h-6 w-6" aria-hidden="true" />
              </div>
              <h2 className="mt-4 text-xl font-extrabold text-ink group-hover:text-minute-dark">
                {title}
              </h2>
              <p className="mt-1.5 text-sm text-ink-muted">{description}</p>
            </div>
            <span className="mt-4 inline-flex items-center text-sm font-extrabold text-minute-dark">
              Open →
            </span>
          </Link>
        ))}

        <Link
          to="/parent"
          className="touch-target group flex flex-col justify-between rounded-3xl border-2 border-dashed border-surface-muted bg-surface px-5 py-5 transition hover:border-ink/40 hover:bg-surface-card"
        >
          <div>
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-surface-muted bg-surface-card text-ink-muted">
              <ShieldCheck className="h-6 w-6" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-xl font-extrabold text-ink">Parent &amp; Teacher</h2>
            <p className="mt-1.5 text-sm text-ink-muted">
              Review progress summaries and adjust learning settings.
            </p>
          </div>
          <span className="mt-4 inline-flex items-center text-sm font-extrabold text-ink-muted">
            View Summary →
          </span>
        </Link>
      </section>
    </div>
  );
}
