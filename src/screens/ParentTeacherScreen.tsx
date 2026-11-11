import {
  AlertTriangle,
  Check,
  Download,
  Lock,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sliders,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ParentGate } from '../components/layout/ParentGate';
import { formatDigitalTime } from '../domain/clockModel';
import {
  BADGE_DEFINITIONS,
  CURRICULUM_SKILLS,
  STARS_TO_UNLOCK_NEXT,
  getSkillDefinition,
  isSkillEffectivelyUnlocked,
} from '../domain/curriculum';
import { ActivityType, MinuteLabelMode, SKILL_ORDER } from '../domain/types';
import { useAppStore } from '../store/useAppStore';

const MINUTE_LABEL_OPTIONS: { value: MinuteLabelMode; label: string; description: string }[] = [
  { value: 'all', label: 'All (00–59)', description: 'Show every minute number around the dial' },
  { value: 'fives', label: 'By 5s (00, 05...)', description: 'Show 5-minute intervals only' },
  { value: 'none', label: 'Hide', description: 'Hide outer minute labels for challenge' },
];

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  'set-time': 'Set Time',
  'match-digital': 'Analog → Digital',
  'match-analog': 'Digital → Analog',
  'daily-life': 'Daily Life',
};

function formatAccuracy(correctFirstTry: number, attempts: number): string {
  if (attempts <= 0) return '—';
  return `${Math.round((correctFirstTry / attempts) * 100)}%`;
}

function formatPracticedDate(iso: string | null): string {
  if (!iso) return 'Not yet';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return 'Not yet';
  return parsed.toLocaleDateString();
}

export function ParentTeacherScreen() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const totalStars = useAppStore((s) => s.totalStars);
  const badges = useAppStore((s) => s.badges);
  const skills = useAppStore((s) => s.skills);
  const reviewQueue = useAppStore((s) => s.reviewQueue);
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const resetProgress = useAppStore((s) => s.resetProgress);

  const totalAttempts = SKILL_ORDER.reduce((sum, id) => sum + (skills[id]?.attempts ?? 0), 0);
  const totalFirstTry = SKILL_ORDER.reduce(
    (sum, id) => sum + (skills[id]?.correctFirstTry ?? 0),
    0
  );

  const handleExportJson = () => {
    const summaryPayload = {
      exportedAt: new Date().toISOString(),
      schemaVersion: 1,
      totalStars,
      badges,
      settings,
      skillSummary: CURRICULUM_SKILLS.map((def) => {
        const entry = skills[def.skillId];
        return {
          skillId: def.skillId,
          title: def.title,
          unlocked: isSkillEffectivelyUnlocked(def.skillId, skills, settings.unlockAllSkills),
          starsEarned: entry?.starsEarned ?? 0,
          attempts: entry?.attempts ?? 0,
          correctFirstTry: entry?.correctFirstTry ?? 0,
          firstTryAccuracyPercent:
            entry && entry.attempts > 0
              ? Math.round((entry.correctFirstTry / entry.attempts) * 100)
              : null,
          lastPracticedAt: entry?.lastPracticedAt ?? null,
        };
      }),
      reviewQueue,
    };

    const jsonText = JSON.stringify(summaryPayload, null, 2);
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      const blob = new Blob([jsonText], { type: 'application/json' });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = 'tick-tock-progress-summary.json';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      if (typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(objectUrl);
      }
    }
    setStatusMessage('Progress summary exported as JSON.');
  };

  const handleConfirmReset = () => {
    resetProgress();
    setShowResetConfirm(false);
    setStatusMessage('All progress has been reset to initial defaults.');
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-minute-soft px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-minute-dark">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Educator &amp; Family Dashboard</span>
          </span>
          <h1 className="mt-2 text-2xl font-extrabold text-ink sm:text-3xl">
            Parent &amp; Teacher View
          </h1>
          <p className="mt-1 text-sm text-ink-muted sm:text-base">
            Review skill accuracy, manage learning defaults, export summaries, or reset progress.
          </p>
        </div>

        {isUnlocked && (
          <button
            type="button"
            onClick={() => {
              setIsUnlocked(false);
              setShowResetConfirm(false);
            }}
            className="touch-target inline-flex items-center gap-2 rounded-2xl border-2 border-surface-muted bg-surface-card px-4 py-2 text-sm font-extrabold text-ink hover:bg-surface-muted"
          >
            <Lock className="h-4 w-4" aria-hidden="true" />
            <span>Lock View</span>
          </button>
        )}
      </div>

      {!isUnlocked ? (
        <ParentGate onUnlock={() => setIsUnlocked(true)} />
      ) : (
        <div className="flex flex-col gap-6" data-testid="parent-dashboard">
          {statusMessage && (
            <p
              role="status"
              aria-live="polite"
              className="flex items-center gap-2 rounded-2xl border-2 border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-extrabold text-emerald-900"
            >
              <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{statusMessage}</span>
            </p>
          )}

          {/* Overview Metrics */}
          <section aria-label="Progress overview" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border-2 border-surface-muted bg-surface-card p-4 shadow-sm">
              <p className="text-xs font-extrabold uppercase tracking-wide text-ink-muted">
                Total Stars
              </p>
              <p className="mt-1 text-2xl font-extrabold text-hour-dark">★ {totalStars}</p>
            </div>
            <div className="rounded-2xl border-2 border-surface-muted bg-surface-card p-4 shadow-sm">
              <p className="text-xs font-extrabold uppercase tracking-wide text-ink-muted">
                First-Try Accuracy
              </p>
              <p className="mt-1 text-2xl font-extrabold text-minute-dark">
                {formatAccuracy(totalFirstTry, totalAttempts)}
              </p>
            </div>
            <div className="rounded-2xl border-2 border-surface-muted bg-surface-card p-4 shadow-sm">
              <p className="text-xs font-extrabold uppercase tracking-wide text-ink-muted">
                Badges Earned
              </p>
              <p className="mt-1 text-2xl font-extrabold text-ink">
                {badges.length}/{BADGE_DEFINITIONS.length}
              </p>
            </div>
            <div className="rounded-2xl border-2 border-surface-muted bg-surface-card p-4 shadow-sm">
              <p className="text-xs font-extrabold uppercase tracking-wide text-ink-muted">
                Flagged Concepts
              </p>
              <p className="mt-1 text-2xl font-extrabold text-amber-800">{reviewQueue.length}</p>
            </div>
          </section>

          {/* Skill Accuracy Table */}
          <section
            aria-labelledby="skill-accuracy-heading"
            className="rounded-3xl border-2 border-surface-muted bg-surface-card p-5 shadow-sm sm:p-6"
          >
            <h2 id="skill-accuracy-heading" className="text-xl font-extrabold text-ink">
              Accuracy by Skill
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Tracks attempts, first-try accuracy, and stars earned across the 8-step curriculum.
            </p>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[580px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b-2 border-surface-muted text-xs font-extrabold uppercase tracking-wide text-ink-muted">
                    <th scope="col" className="py-3 pr-4">
                      Skill
                    </th>
                    <th scope="col" className="px-3 py-3">
                      Status
                    </th>
                    <th scope="col" className="px-3 py-3">
                      Attempts
                    </th>
                    <th scope="col" className="px-3 py-3">
                      First-Try
                    </th>
                    <th scope="col" className="px-3 py-3">
                      Stars
                    </th>
                    <th scope="col" className="py-3 pl-3">
                      Last Practiced
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-muted">
                  {CURRICULUM_SKILLS.map((def) => {
                    const progress = skills[def.skillId];
                    const unlocked = isSkillEffectivelyUnlocked(
                      def.skillId,
                      skills,
                      settings.unlockAllSkills
                    );
                    const mastered = (progress?.starsEarned ?? 0) >= STARS_TO_UNLOCK_NEXT;
                    const statusLabel = !unlocked
                      ? 'Locked'
                      : mastered
                        ? 'Mastered'
                        : 'Unlocked';

                    return (
                      <tr key={def.skillId} data-testid={`parent-skill-row-${def.skillId}`}>
                        <td className="py-3 pr-4 font-extrabold text-ink">
                          {def.stepNumber}. {def.title}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={[
                              'inline-block rounded-full px-2.5 py-0.5 text-xs font-extrabold',
                              statusLabel === 'Mastered'
                                ? 'bg-emerald-100 text-emerald-900'
                                : statusLabel === 'Unlocked'
                                  ? 'bg-minute-soft text-minute-dark'
                                  : 'bg-surface-muted text-ink-muted',
                            ].join(' ')}
                          >
                            {statusLabel}
                          </span>
                        </td>
                        <td className="px-3 py-3 font-bold text-ink">{progress?.attempts ?? 0}</td>
                        <td className="px-3 py-3 font-bold text-ink">
                          {progress && progress.attempts > 0
                            ? `${progress.correctFirstTry}/${progress.attempts} (${formatAccuracy(
                                progress.correctFirstTry,
                                progress.attempts
                              )})`
                            : '—'}
                        </td>
                        <td className="px-3 py-3 font-extrabold text-hour-dark">
                          ★ {progress?.starsEarned ?? 0}
                        </td>
                        <td className="py-3 pl-3 text-ink-muted">
                          {formatPracticedDate(progress?.lastPracticedAt ?? null)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Flagged Concepts / Review Queue */}
          <section
            aria-labelledby="flagged-concepts-heading"
            className="rounded-3xl border-2 border-surface-muted bg-surface-card p-5 shadow-sm sm:p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="flagged-concepts-heading" className="text-xl font-extrabold text-ink">
                  Concepts Needing More Practice
                </h2>
                <p className="mt-1 text-sm text-ink-muted">
                  Times missed during practice are automatically queued for gentle review.
                </p>
              </div>
              {reviewQueue.length > 0 && (
                <Link
                  to="/challenge?mode=review"
                  className="touch-target inline-flex items-center gap-2 rounded-2xl bg-minute px-4 py-2 text-sm font-extrabold text-white hover:bg-minute-dark"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  <span>Open Review Practice</span>
                </Link>
              )}
            </div>

            {reviewQueue.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900">
                No flagged concepts right now—all practiced times are clear!
              </p>
            ) : (
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {reviewQueue.map((item) => (
                  <li
                    key={item.id}
                    data-testid={`review-flag-${item.id}`}
                    className="flex items-center justify-between gap-3 rounded-2xl border-2 border-amber-200 bg-amber-50/70 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-extrabold text-ink">
                        {getSkillDefinition(item.skillId).shortLabel} ·{' '}
                        <span className="tabular-nums">{formatDigitalTime(item.targetTime)}</span>
                      </p>
                      <p className="text-xs font-semibold text-ink-muted">
                        {ACTIVITY_LABELS[item.activityType]}
                      </p>
                    </div>
                    <span className="rounded-full bg-amber-200 px-3 py-1 text-xs font-extrabold text-amber-950">
                      Missed {item.missedCount}×
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Learning & Accessibility Settings */}
          <section
            aria-labelledby="parent-settings-heading"
            className="rounded-3xl border-2 border-surface-muted bg-surface-card p-5 shadow-sm sm:p-6"
          >
            <div className="flex items-center gap-2">
              <Sliders className="h-5 w-5 text-minute-dark" aria-hidden="true" />
              <h2 id="parent-settings-heading" className="text-xl font-extrabold text-ink">
                Learning &amp; Accessibility Settings
              </h2>
            </div>

            <div className="mt-5 flex flex-col gap-5">
              {/* Default Minute Label Mode */}
              <div className="rounded-2xl border-2 border-surface-muted bg-surface p-4">
                <p className="text-sm font-extrabold text-ink">Default Minute Label Mode</p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Choose how outer minute numbers (00–59) appear by default across screens.
                </p>
                <div
                  role="group"
                  aria-label="Default Minute Label Mode"
                  className="mt-3 flex flex-wrap gap-2"
                >
                  {MINUTE_LABEL_OPTIONS.map((opt) => {
                    const active = settings.minuteLabelMode === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => updateSettings({ minuteLabelMode: opt.value })}
                        className={[
                          'touch-target rounded-2xl border-2 px-4 py-2 text-sm font-extrabold transition-colors',
                          active
                            ? 'border-minute bg-minute text-white'
                            : 'border-surface-muted bg-surface-card text-ink hover:bg-minute-soft',
                        ].join(' ')}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Boolean Setting Toggles */}
              <div className="grid gap-3 sm:grid-cols-2">
                <SettingToggleRow
                  label="Unlock All Skills"
                  description="Allow immediate access to every skill without waiting for stars."
                  checked={settings.unlockAllSkills}
                  onToggle={() =>
                    updateSettings({ unlockAllSkills: !settings.unlockAllSkills })
                  }
                />
                <SettingToggleRow
                  label="Geared Hands"
                  description="Moving the minute hand smoothly advances the hour hand."
                  checked={settings.gearedHands}
                  onToggle={() => updateSettings({ gearedHands: !settings.gearedHands })}
                />
                <SettingToggleRow
                  label="Challenge Timer"
                  description="Enable the 90-second countdown by default in Clock Challenge."
                  checked={settings.challengeTimerEnabled}
                  onToggle={() =>
                    updateSettings({ challengeTimerEnabled: !settings.challengeTimerEnabled })
                  }
                />
                <SettingToggleRow
                  label="TTS Auto-Read"
                  description="Automatically read prompts and hints aloud during activities."
                  checked={settings.ttsEnabled}
                  onToggle={() => updateSettings({ ttsEnabled: !settings.ttsEnabled })}
                />
                <SettingToggleRow
                  label="Sound Effects"
                  description="Play gentle woodblock ticks and soft chimes for feedback."
                  checked={settings.soundEnabled}
                  onToggle={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
                />
              </div>
            </div>
          </section>

          {/* Export & Reset Progress */}
          <section
            aria-labelledby="data-management-heading"
            className="rounded-3xl border-2 border-surface-muted bg-surface-card p-5 shadow-sm sm:p-6"
          >
            <h2 id="data-management-heading" className="text-xl font-extrabold text-ink">
              Export &amp; Reset Data
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              All progress is saved locally in this browser—nothing is sent to any server.
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleExportJson}
                className="touch-target inline-flex items-center gap-2 rounded-2xl bg-minute px-5 py-3 text-sm font-extrabold text-white shadow-sm hover:bg-minute-dark"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                <span>Export JSON Summary</span>
              </button>

              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="touch-target inline-flex items-center gap-2 rounded-2xl border-2 border-hour/40 bg-hour-soft px-5 py-3 text-sm font-extrabold text-hour-dark hover:bg-hour/15"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                <span>Reset Progress</span>
              </button>
            </div>

            {showResetConfirm && (
              <div
                role="alertdialog"
                aria-labelledby="reset-confirm-heading"
                aria-describedby="reset-confirm-desc"
                data-testid="reset-confirm-dialog"
                className="mt-5 flex flex-col gap-4 rounded-2xl border-2 border-hour bg-hour-soft p-5"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-hour-dark" aria-hidden="true" />
                  <div>
                    <h3 id="reset-confirm-heading" className="text-base font-extrabold text-ink">
                      Reset all stars and badges? This cannot be undone.
                    </h3>
                    <p id="reset-confirm-desc" className="mt-1 text-sm text-ink-muted">
                      This clears all earned stars, unlocked skills, badges, and review items back
                      to a fresh start.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleConfirmReset}
                    className="touch-target rounded-2xl bg-hour-dark px-5 py-2.5 text-sm font-extrabold text-white hover:bg-hour"
                  >
                    Confirm Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowResetConfirm(false)}
                    className="touch-target rounded-2xl border-2 border-surface-muted bg-surface-card px-5 py-2.5 text-sm font-extrabold text-ink hover:bg-surface-muted"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

interface SettingToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}

function SettingToggleRow({ label, description, checked, onToggle }: SettingToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border-2 border-surface-muted bg-surface p-4">
      <div>
        <p className="text-sm font-extrabold text-ink">{label}</p>
        <p className="mt-0.5 text-xs text-ink-muted">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onToggle}
        className={[
          'touch-target shrink-0 rounded-2xl border-2 px-4 py-2 text-sm font-extrabold transition-colors',
          checked
            ? 'border-emerald-700 bg-emerald-700 text-white'
            : 'border-surface-muted bg-surface-card text-ink hover:bg-surface-muted',
        ].join(' ')}
      >
        {checked ? 'On' : 'Off'}
      </button>
    </div>
  );
}
