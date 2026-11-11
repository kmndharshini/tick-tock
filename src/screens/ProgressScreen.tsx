import {
  Award,
  BookOpen,
  CheckCircle2,
  Lock,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Trophy,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  BADGE_DEFINITIONS,
  CURRICULUM_SKILLS,
  STARS_TO_UNLOCK_NEXT,
  isSkillEffectivelyUnlocked,
} from '../domain/curriculum';
import { SKILL_ORDER, SkillId } from '../domain/types';
import { useAppStore } from '../store/useAppStore';

type SkillStatus = 'locked' | 'unlocked' | 'mastered';

function getSkillStatus(
  skillId: SkillId,
  unlocked: boolean,
  starsEarned: number,
  unlockAllSkills: boolean,
  skills: ReturnType<typeof useAppStore.getState>['skills']
): SkillStatus {
  const effectivelyUnlocked =
    unlocked || isSkillEffectivelyUnlocked(skillId, skills, unlockAllSkills);
  if (!effectivelyUnlocked) {
    return 'locked';
  }
  if (starsEarned >= STARS_TO_UNLOCK_NEXT) {
    return 'mastered';
  }
  return 'unlocked';
}

export function ProgressScreen() {
  const totalStars = useAppStore((s) => s.totalStars);
  const badges = useAppStore((s) => s.badges);
  const skills = useAppStore((s) => s.skills);
  const reviewQueue = useAppStore((s) => s.reviewQueue);
  const settings = useAppStore((s) => s.settings);

  const unlockedCount = SKILL_ORDER.filter((id) =>
    isSkillEffectivelyUnlocked(id, skills, settings.unlockAllSkills)
  ).length;
  const masteredCount = SKILL_ORDER.filter(
    (id) => (skills[id]?.starsEarned ?? 0) >= STARS_TO_UNLOCK_NEXT
  ).length;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      {/* Header & Summary Stats */}
      <section
        aria-labelledby="progress-heading"
        className="rounded-3xl border-2 border-surface-muted bg-surface-card p-6 shadow-sm sm:p-8"
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-hour-soft px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-hour-dark">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Learning Journey</span>
            </span>
            <h1 id="progress-heading" className="mt-2 text-2xl font-extrabold text-ink sm:text-3xl">
              Your Progress
            </h1>
            <p className="mt-1 text-sm text-ink-muted sm:text-base">
              Earn {STARS_TO_UNLOCK_NEXT} stars in each skill to unlock the next clock adventure!
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {reviewQueue.length > 0 && (
              <Link
                to="/challenge?mode=review"
                className="touch-target inline-flex items-center gap-2 rounded-2xl bg-minute px-5 py-3 text-sm font-extrabold text-white shadow-sm hover:bg-minute-dark"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                <span>Review Tricky Times ({reviewQueue.length})</span>
              </Link>
            )}
            <Link
              to="/parent"
              className="touch-target inline-flex items-center gap-2 rounded-2xl border-2 border-surface-muted bg-surface px-4 py-3 text-sm font-extrabold text-ink hover:bg-surface-muted"
            >
              <ShieldCheck className="h-4 w-4 text-ink-muted" aria-hidden="true" />
              <span>Parent &amp; Teacher</span>
            </Link>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-extrabold uppercase tracking-wide text-amber-900">
              Total Stars
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-2xl font-extrabold text-amber-900">
              <Star className="h-5 w-5 fill-amber-500 text-amber-600" aria-hidden="true" />
              <span>{totalStars}</span>
            </p>
          </div>

          <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-extrabold uppercase tracking-wide text-emerald-900">
              Skills Mastered
            </p>
            <p className="mt-1 text-2xl font-extrabold text-emerald-900">
              {masteredCount}/{SKILL_ORDER.length}
            </p>
          </div>

          <div className="rounded-2xl border-2 border-minute/25 bg-minute-soft p-4">
            <p className="text-xs font-extrabold uppercase tracking-wide text-minute-dark">
              Skills Unlocked
            </p>
            <p className="mt-1 text-2xl font-extrabold text-minute-dark">
              {unlockedCount}/{SKILL_ORDER.length}
            </p>
          </div>

          <div className="rounded-2xl border-2 border-hour/25 bg-hour-soft p-4">
            <p className="text-xs font-extrabold uppercase tracking-wide text-hour-dark">
              Badges Earned
            </p>
            <p className="mt-1 text-2xl font-extrabold text-hour-dark">
              {badges.length}/{BADGE_DEFINITIONS.length}
            </p>
          </div>
        </div>

        {settings.unlockAllSkills && (
          <p className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-minute/30 bg-minute-soft/60 px-4 py-2 text-xs font-extrabold text-minute-dark">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            <span>All skills are currently unlocked by Parent/Teacher settings.</span>
          </p>
        )}
      </section>

      {/* Visual Skill Map */}
      <section aria-labelledby="skill-map-heading" className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 id="skill-map-heading" className="text-xl font-extrabold text-ink sm:text-2xl">
            Skill Pathway Map
          </h2>
          <span className="text-xs font-bold text-ink-muted">Steps 1 to 8</span>
        </div>

        <ol className="grid gap-4 md:grid-cols-2" aria-label="Clock learning skill map">
          {CURRICULUM_SKILLS.map((skillDef) => {
            const progress = skills[skillDef.skillId];
            const status = getSkillStatus(
              skillDef.skillId,
              progress?.unlocked ?? false,
              progress?.starsEarned ?? 0,
              settings.unlockAllSkills,
              skills
            );
            const hasPracticed = (progress?.attempts ?? 0) > 0 || (progress?.starsEarned ?? 0) > 0;
            const actionLabel = hasPracticed ? 'Practice Again' : 'Start Practice';
            const practicePath =
              skillDef.skillId === 'challenge-mix'
                ? '/challenge'
                : `/exercise?skill=${skillDef.skillId}`;

            return (
              <li
                key={skillDef.skillId}
                data-testid={`skill-card-${skillDef.skillId}`}
                data-status={status}
                className={[
                  'flex flex-col justify-between gap-4 rounded-3xl border-2 p-5 shadow-sm transition',
                  status === 'mastered'
                    ? 'border-emerald-300 bg-emerald-50/50'
                    : status === 'unlocked'
                      ? 'border-minute/40 bg-surface-card'
                      : 'border-surface-muted bg-surface-muted/50',
                ].join(' ')}
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-ink-muted">
                      <span
                        className={[
                          'inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold',
                          status === 'mastered'
                            ? 'bg-emerald-700 text-white'
                            : status === 'unlocked'
                              ? 'bg-minute text-white'
                              : 'bg-surface-muted text-ink-muted border border-ink-muted/30',
                        ].join(' ')}
                      >
                        {skillDef.stepNumber}
                      </span>
                      <span>Step {skillDef.stepNumber}</span>
                    </span>

                    {status === 'mastered' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-700 px-3 py-1 text-xs font-extrabold text-white">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Mastered</span>
                      </span>
                    )}
                    {status === 'unlocked' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-minute-soft px-3 py-1 text-xs font-extrabold text-minute-dark">
                        <Target className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Unlocked</span>
                      </span>
                    )}
                    {status === 'locked' && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-ink-muted/25 bg-surface px-3 py-1 text-xs font-extrabold text-ink-muted">
                        <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Locked</span>
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-lg font-extrabold text-ink">{skillDef.title}</h3>
                    <p className="mt-1 text-sm text-ink-muted">{skillDef.description}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs font-extrabold">
                    <span className="inline-flex items-center gap-1 rounded-xl bg-amber-100 px-2.5 py-1 text-amber-900">
                      <span aria-hidden="true">★</span>
                      <span>{progress?.starsEarned ?? 0} Stars</span>
                    </span>
                    {(progress?.attempts ?? 0) > 0 && (
                      <span className="rounded-xl bg-surface px-2.5 py-1 text-ink-muted">
                        {progress.correctFirstTry}/{progress.attempts} first-try
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {status !== 'locked' ? (
                    <>
                      <Link
                        to={practicePath}
                        aria-label={`${actionLabel}: ${skillDef.title}`}
                        className={[
                          'touch-target inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-extrabold text-white shadow-sm',
                          skillDef.skillId === 'challenge-mix'
                            ? 'bg-hour-dark hover:bg-hour'
                            : 'bg-minute hover:bg-minute-dark',
                        ].join(' ')}
                      >
                        {skillDef.skillId === 'challenge-mix' ? (
                          <Trophy className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Target className="h-4 w-4" aria-hidden="true" />
                        )}
                        <span>{actionLabel}</span>
                      </Link>
                      {skillDef.skillId === 'clock-parts' && (
                        <Link
                          to="/learn"
                          className="touch-target inline-flex items-center justify-center gap-1.5 rounded-2xl border-2 border-surface-muted bg-surface-card px-4 py-2.5 text-sm font-extrabold text-ink hover:bg-surface-muted"
                        >
                          <BookOpen className="h-4 w-4" aria-hidden="true" />
                          <span>Lesson</span>
                        </Link>
                      )}
                    </>
                  ) : (
                    <span className="inline-flex min-h-[48px] items-center gap-1.5 rounded-2xl border border-surface-muted bg-surface px-4 py-2 text-xs font-bold text-ink-muted">
                      <Lock className="h-4 w-4" aria-hidden="true" />
                      <span>Earn {STARS_TO_UNLOCK_NEXT} stars in the previous step to unlock</span>
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Earned Badges Showcase */}
      <section
        aria-labelledby="badges-heading"
        className="rounded-3xl border-2 border-surface-muted bg-surface-card p-6 shadow-sm sm:p-8"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 id="badges-heading" className="text-xl font-extrabold text-ink sm:text-2xl">
              Clock Badges
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Collect special badges as you learn each part of the clock.
            </p>
          </div>
          <span className="rounded-full bg-hour-soft px-3.5 py-1.5 text-xs font-extrabold text-hour-dark">
            {badges.length} of {BADGE_DEFINITIONS.length} Earned
          </span>
        </div>

        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BADGE_DEFINITIONS.map((badge) => {
            const isEarned = badges.includes(badge.id);
            return (
              <li
                key={badge.id}
                data-testid={`badge-card-${badge.id}`}
                data-earned={isEarned ? 'true' : 'false'}
                className={[
                  'flex items-start gap-3 rounded-2xl border-2 p-4',
                  isEarned
                    ? 'border-amber-300 bg-amber-50/70'
                    : 'border-surface-muted bg-surface opacity-80',
                ].join(' ')}
              >
                <div
                  className={[
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl',
                    isEarned ? 'bg-amber-200 text-amber-900' : 'bg-surface-muted text-ink-muted',
                  ].join(' ')}
                >
                  {isEarned ? (
                    <Award className="h-6 w-6" aria-hidden="true" />
                  ) : (
                    <Lock className="h-5 w-5" aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-extrabold text-ink">{badge.title}</h3>
                    <span
                      className={[
                        'rounded-full px-2 py-0.5 text-[11px] font-extrabold',
                        isEarned
                          ? 'bg-emerald-700 text-white'
                          : 'bg-surface-muted text-ink-muted',
                      ].join(' ')}
                    >
                      {isEarned ? 'Earned' : 'Locked'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">{badge.description}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
