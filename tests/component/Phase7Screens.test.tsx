import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../src/app/routes';
import { AppShell } from '../../src/components/layout/AppShell';
import { useAppStore } from '../../src/store/useAppStore';

function renderRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppShell>
        <AppRoutes />
      </AppShell>
    </MemoryRouter>
  );
}

function seedSampleProgress() {
  const store = useAppStore.getState();
  store.recordExerciseOutcome({
    skillId: 'clock-parts',
    activityType: 'set-time',
    targetTime: { hours: 3, minutes: 0 },
    firstTry: true,
    starsToAward: 2,
  });
  store.completeSkillModule('clock-parts');
  store.recordExerciseOutcome({
    skillId: 'oclock',
    activityType: 'match-digital',
    targetTime: { hours: 5, minutes: 0 },
    firstTry: false,
    starsToAward: 1,
  });
  store.recordExerciseOutcome({
    skillId: 'oclock',
    activityType: 'set-time',
    targetTime: { hours: 9, minutes: 0 },
    firstTry: true,
    starsToAward: 1,
  });
}

function unlockParentViaMath() {
  const mathLabel = screen.getByLabelText(/What is (\d+) × (\d+)\?/i);
  const labelElement = screen.getByText(/What is (\d+) × (\d+)\?/i);
  const match = labelElement.textContent?.match(/What is (\d+) × (\d+)\?/i);
  const answer = Number(match![1]) * Number(match![2]);
  fireEvent.change(mathLabel, { target: { value: String(answer) } });
  fireEvent.click(screen.getByRole('button', { name: 'Unlock View' }));
}

describe('Phase 7: ProgressScreen, ParentGate & ParentTeacherScreen', () => {
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;

  beforeEach(() => {
    localStorage.clear();
    useAppStore.getState().resetProgress();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
  });

  it('renders ProgressScreen with locked, unlocked, and mastered skills, stars, badges, and Practice Again links', () => {
    seedSampleProgress();
    renderRoute('/progress');

    expect(screen.getByRole('heading', { name: 'Your Progress' })).toBeInTheDocument();
    expect(screen.getByTestId('skill-card-clock-parts')).toHaveAttribute('data-status', 'mastered');
    expect(screen.getByTestId('skill-card-oclock')).toHaveAttribute('data-status', 'mastered');
    expect(screen.getByTestId('skill-card-half-past')).toHaveAttribute('data-status', 'unlocked');
    expect(screen.getByTestId('skill-card-exact-minutes')).toHaveAttribute('data-status', 'locked');

    expect(screen.getByTestId('badge-card-clock-parts-star')).toHaveAttribute(
      'data-earned',
      'true'
    );
    expect(screen.getByTestId('badge-card-oclock-explorer')).toHaveAttribute(
      'data-earned',
      'true'
    );
    expect(screen.getByTestId('badge-card-minute-master')).toHaveAttribute(
      'data-earned',
      'false'
    );

    const practiceAgainLink = screen.getByRole('link', {
      name: /Practice Again: Whole Hours \(O'Clock\)/i,
    });
    expect(practiceAgainLink).toHaveAttribute('href', '/exercise?skill=oclock');

    expect(
      screen.getByRole('link', { name: /Review Tricky Times \(1\)/i })
    ).toHaveAttribute('href', '/challenge?mode=review');
  });

  it('prevents 1-tap entry on ParentGate, cancels hold cleanly on pointercancel/pointerleave, and unlocks after 2s hold (EC-STR-03)', () => {
    vi.useFakeTimers();
    renderRoute('/parent');

    expect(screen.getByTestId('parent-gate')).toBeInTheDocument();
    const holdButton = screen.getByRole('button', { name: /Hold for 2 Seconds to Enter/i });
    const progressBar = screen.getByRole('progressbar', { name: 'Hold progress' });

    // Single click must NOT unlock
    fireEvent.click(holdButton);
    expect(screen.getByTestId('parent-gate')).toBeInTheDocument();
    expect(screen.queryByTestId('parent-dashboard')).not.toBeInTheDocument();

    // Hold partway then interrupt with pointercancel -> progress resets cleanly
    fireEvent.pointerDown(holdButton, { pointerId: 1, pointerType: 'touch' });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(Number(progressBar.getAttribute('aria-valuenow'))).toBeGreaterThan(0);

    fireEvent.pointerCancel(holdButton, { pointerId: 1 });
    expect(progressBar).toHaveAttribute('aria-valuenow', '0');
    expect(screen.queryByTestId('parent-dashboard')).not.toBeInTheDocument();

    // Hold partway then pointerleave -> progress resets cleanly
    fireEvent.pointerDown(holdButton, { pointerId: 1, pointerType: 'mouse', button: 0 });
    act(() => {
      vi.advanceTimersByTime(800);
    });
    fireEvent.pointerLeave(holdButton);
    expect(progressBar).toHaveAttribute('aria-valuenow', '0');
    expect(screen.queryByTestId('parent-dashboard')).not.toBeInTheDocument();

    // Full 2-second hold unlocks
    fireEvent.pointerDown(holdButton, { pointerId: 1, pointerType: 'touch' });
    act(() => {
      vi.advanceTimersByTime(2050);
    });
    expect(screen.getByTestId('parent-dashboard')).toBeInTheDocument();
  });

  it('supports keyboard-friendly math check fallback and rejects wrong answers on ParentGate (EC-STR-03)', async () => {
    const user = userEvent.setup({ delay: null });
    renderRoute('/parent');

    const mathInput = screen.getByLabelText(/What is (\d+) × (\d+)\?/i);
    await user.type(mathInput, '999');
    await user.click(screen.getByRole('button', { name: 'Unlock View' }));

    expect(screen.getByRole('alert')).toHaveTextContent(/Not quite/i);
    expect(screen.queryByTestId('parent-dashboard')).not.toBeInTheDocument();

    const labelText = screen.getByText(/What is (\d+) × (\d+)\?/i).textContent ?? '';
    const match = labelText.match(/What is (\d+) × (\d+)\?/i);
    const product = Number(match![1]) * Number(match![2]);

    await user.clear(mathInput);
    await user.type(mathInput, `${product}{Enter}`);

    expect(screen.getByTestId('parent-dashboard')).toBeInTheDocument();
  });

  it('displays skill accuracy, flagged concepts, toggles settings non-destructively (EC-CUR-05), and exports JSON', () => {
    seedSampleProgress();
    const createObjectUrlSpy = vi.fn(() => 'blob:mock-summary');
    const revokeObjectUrlSpy = vi.fn();
    URL.createObjectURL = createObjectUrlSpy;
    URL.revokeObjectURL = revokeObjectUrlSpy;
    const anchorClickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    renderRoute('/parent');
    unlockParentViaMath();

    // Accuracy row & flagged concept
    const oclockRow = screen.getByTestId('parent-skill-row-oclock');
    expect(oclockRow).toHaveTextContent('1/2 (50%)');
    expect(oclockRow).toHaveTextContent('★ 2');
    expect(screen.getByTestId('review-flag-oclock:match-digital:5:00')).toHaveTextContent(
      'Missed 1×'
    );

    // Toggle settings
    fireEvent.click(screen.getByRole('switch', { name: 'Unlock All Skills' }));
    expect(useAppStore.getState().settings.unlockAllSkills).toBe(true);

    // Toggling Unlock All Skills back off preserves stars and previously unlocked skills (EC-CUR-05)
    fireEvent.click(screen.getByRole('switch', { name: 'Unlock All Skills' }));
    expect(useAppStore.getState().settings.unlockAllSkills).toBe(false);
    expect(useAppStore.getState().totalStars).toBe(4);
    expect(useAppStore.getState().skills['half-past'].unlocked).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'By 5s (00, 05...)' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Geared Hands' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Challenge Timer' }));
    fireEvent.click(screen.getByRole('switch', { name: 'TTS Auto-Read' }));

    const updatedSettings = useAppStore.getState().settings;
    expect(updatedSettings.minuteLabelMode).toBe('fives');
    expect(updatedSettings.gearedHands).toBe(false);
    expect(updatedSettings.challengeTimerEnabled).toBe(true);
    expect(updatedSettings.ttsEnabled).toBe(true);

    // Export JSON summary
    fireEvent.click(screen.getByRole('button', { name: 'Export JSON Summary' }));
    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
    expect(anchorClickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:mock-summary');
    expect(screen.getByRole('status')).toHaveTextContent(/exported as JSON/i);
  });

  it('requires two-step confirmation before resetting progress and clears state cleanly (EC-STR-04)', () => {
    seedSampleProgress();
    renderRoute('/parent');
    unlockParentViaMath();

    expect(useAppStore.getState().totalStars).toBe(4);

    // Single click opens confirmation without clearing
    fireEvent.click(screen.getByRole('button', { name: 'Reset Progress' }));
    expect(screen.getByTestId('reset-confirm-dialog')).toHaveTextContent(
      'Reset all stars and badges? This cannot be undone.'
    );
    expect(useAppStore.getState().totalStars).toBe(4);

    // Cancel keeps progress intact
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByTestId('reset-confirm-dialog')).not.toBeInTheDocument();
    expect(useAppStore.getState().totalStars).toBe(4);

    // Confirm Reset clears skills, totalStars, badges, and reviewQueue
    fireEvent.click(screen.getByRole('button', { name: 'Reset Progress' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Reset' }));

    const fresh = useAppStore.getState();
    expect(fresh.totalStars).toBe(0);
    expect(fresh.badges).toEqual([]);
    expect(fresh.reviewQueue).toEqual([]);
    expect(fresh.skills['clock-parts'].unlocked).toBe(true);
    expect(fresh.skills['clock-parts'].attempts).toBe(0);
    expect(fresh.skills['oclock'].unlocked).toBe(false);
    expect(fresh.skills['half-past'].unlocked).toBe(false);
  });

  it('has 0 critical or serious axe-core violations on /progress', async () => {
    seedSampleProgress();
    const { container } = renderRoute('/progress');
    const progressAxe = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(
      progressAxe.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
    ).toEqual([]);
  }, 15_000);

  it('has 0 critical or serious axe-core violations on unlocked /parent', async () => {
    seedSampleProgress();
    const { container } = renderRoute('/parent');
    unlockParentViaMath();
    const parentAxe = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(
      parentAxe.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
    ).toEqual([]);
  }, 15_000);
});

