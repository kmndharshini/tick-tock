import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Award,
  BookOpen,
  Clock,
  Compass,
  Home,
  MessageSquare,
  ShieldCheck,
  Target,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

interface AppShellProps {
  children: ReactNode;
}

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/learn', label: 'Learn', icon: BookOpen },
  { to: '/explore', label: 'Clock', icon: Compass },
  { to: '/exercise', label: 'Practice', icon: Target },
  { to: '/challenge', label: 'Challenge', icon: Trophy },
  { to: '/progress', label: 'Progress', icon: Award },
  { to: '/parent', label: 'Parent', icon: ShieldCheck },
] as const;

/** Persistent responsive shell with large touch targets and global audio toggle. */
export function AppShell({ children }: AppShellProps) {
  const soundEnabled = useAppStore((s) => s.settings.soundEnabled);
  const ttsEnabled = useAppStore((s) => s.settings.ttsEnabled);
  const totalStars = useAppStore((s) => s.totalStars);
  const toggleSound = useAppStore((s) => s.toggleSound);
  const updateSettings = useAppStore((s) => s.updateSettings);

  return (
    <div className="flex min-h-screen flex-col bg-surface text-ink">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-2xl focus:bg-minute focus:px-4 focus:py-3 focus:text-sm focus:font-extrabold focus:text-white focus:shadow-lg"
      >
        Skip to main content
      </a>

      <header className="sticky top-0 z-20 border-b-2 border-surface-muted bg-surface-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2">
          <NavLink
            to="/"
            className="touch-target inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-lg font-extrabold text-ink hover:bg-surface-muted"
          >
            <Clock className="h-6 w-6 text-hour-dark" aria-hidden="true" />
            <span>Tick-Tock</span>
          </NavLink>

          <div className="flex items-center gap-2">
            <span
              className="inline-flex min-h-[48px] items-center gap-1.5 rounded-2xl bg-hour-soft px-3 py-2 text-sm font-bold text-hour-dark"
              aria-label={`Total stars earned: ${totalStars}`}
            >
              <span aria-hidden="true">★</span>
              <span>{totalStars}</span>
            </span>

            <button
              type="button"
              onClick={() => updateSettings({ ttsEnabled: !ttsEnabled })}
              aria-pressed={ttsEnabled}
              aria-label={ttsEnabled ? 'Turn off auto-read voice' : 'Turn on auto-read voice'}
              className={[
                'touch-target inline-flex items-center justify-center gap-1.5 rounded-2xl border-2 px-3 py-2 text-sm font-bold transition-colors',
                ttsEnabled
                  ? 'border-minute bg-minute-soft text-minute-dark'
                  : 'border-surface-muted bg-surface-card text-ink hover:bg-surface-muted',
              ].join(' ')}
            >
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{ttsEnabled ? 'Voice On' : 'Voice Off'}</span>
            </button>

            <button
              type="button"
              onClick={toggleSound}
              aria-pressed={soundEnabled}
              aria-label={soundEnabled ? 'Mute sound' : 'Unmute sound'}
              className="touch-target inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-surface-muted bg-surface-card px-3 py-2 text-sm font-bold text-ink hover:bg-surface-muted"
            >
              {soundEnabled ? (
                <Volume2 className="h-5 w-5 text-minute" aria-hidden="true" />
              ) : (
                <VolumeX className="h-5 w-5 text-ink-muted" aria-hidden="true" />
              )}
              <span className="hidden sm:inline">{soundEnabled ? 'Sound On' : 'Muted'}</span>
            </button>
          </div>
        </div>

        <nav
          aria-label="Main navigation"
          className="mx-auto flex max-w-5xl flex-wrap items-center gap-1.5 px-4 pb-2"
        >
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                [
                  'touch-target inline-flex items-center justify-center gap-1.5 rounded-2xl px-3 py-2 text-sm font-bold transition-colors',
                  isActive
                    ? 'bg-minute text-white shadow-sm'
                    : 'bg-surface-muted/60 text-ink hover:bg-surface-muted',
                ].join(' ')
              }
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </header>

      <main id="main-content" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}

