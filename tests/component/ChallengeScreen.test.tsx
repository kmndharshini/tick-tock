import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../src/app/routes';
import { useAppStore } from '../../src/store/useAppStore';

function renderChallenge(path = '/challenge') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>
  );
}

function solveCurrentQuestionInDom() {
  const dailyCard = screen.queryByTestId('daily-activity-card');

  if (dailyCard) {
    const routineToTime: Record<string, string> = {
      'Waking Up': '7:00',
      'Going to School': '8:15',
      'Eating Lunch': '12:00',
      'Playing Outside': '3:30',
      'Doing Homework': '5:00',
      'Going to Bed': '9:00',
    };
    const title = dailyCard.querySelector('h2')?.textContent?.trim() ?? '';
    fireEvent.click(screen.getByRole('button', { name: `Choose ${routineToTime[title]}` }));
    return;
  }

  const digitalReadout = screen.queryByTestId('digital-readout');
  const promptHeading = screen.getByRole('heading', { level: 2 });

  const choiceGroup = screen.queryByRole('group', { name: 'Answer choices' });
  if (choiceGroup) {
    const clockSvg = screen.getByRole('img', { name: /Analog clock showing/i });
    const targetStr = (clockSvg.getAttribute('aria-label') ?? '')
      .replace('Analog clock showing ', '')
      .trim();
    fireEvent.click(screen.getByRole('button', { name: `Choose ${targetStr}` }));
    return;
  }

  let targetHours = 12;
  let targetMinutes = 0;

  if (digitalReadout) {
    const [h, m] = (digitalReadout.textContent ?? '').split(':').map(Number);
    targetHours = h;
    targetMinutes = m;
  } else {
    const text = promptHeading.textContent ?? '';
    const oclockMatch = text.match(/show (\d+) o'clock/i);
    const quarterPastMatch = text.match(/quarter past (\d+)/i);
    const halfPastMatch = text.match(/half past (\d+)/i);
    const quarterToMatch = text.match(/quarter to (\d+)/i);
    const ohMatch = text.match(/show (\d+) oh (\d+)/i);
    const colonMatch = text.match(/show (\d+):(\d{2})/i);

    if (oclockMatch) {
      targetHours = Number(oclockMatch[1]);
      targetMinutes = 0;
    } else if (quarterPastMatch) {
      targetHours = Number(quarterPastMatch[1]);
      targetMinutes = 15;
    } else if (halfPastMatch) {
      targetHours = Number(halfPastMatch[1]);
      targetMinutes = 30;
    } else if (quarterToMatch) {
      const nextH = Number(quarterToMatch[1]);
      targetHours = nextH === 1 ? 12 : nextH - 1;
      targetMinutes = 45;
    } else if (ohMatch) {
      targetHours = Number(ohMatch[1]);
      targetMinutes = Number(ohMatch[2]);
    } else if (colonMatch) {
      targetHours = Number(colonMatch[1]);
      targetMinutes = Number(colonMatch[2]);
    }
  }

  const minuteSlider = screen.getByRole('slider', { name: 'Minute hand' });
  const hourSlider = screen.getByRole('slider', { name: 'Hour hand' });

  let minSafety = 0;
  while (Number(minuteSlider.getAttribute('aria-valuenow')) !== targetMinutes && minSafety < 65) {
    const currentMin = Number(minuteSlider.getAttribute('aria-valuenow'));
    const diff = (targetMinutes - currentMin + 60) % 60;
    if (diff >= 5) {
      fireEvent.click(screen.getByRole('button', { name: 'Add 5 minutes' }));
    } else {
      fireEvent.click(screen.getByRole('button', { name: 'Add 1 minute' }));
    }
    minSafety += 1;
  }

  let hourSafety = 0;
  while (Number(hourSlider.getAttribute('aria-valuenow')) !== targetHours && hourSafety < 14) {
    fireEvent.click(screen.getByRole('button', { name: 'Add 1 hour' }));
    hourSafety += 1;
  }

  fireEvent.click(screen.getByRole('button', { name: 'Check Time' }));
}

describe('Phase 5: ChallengeScreen & Review Mode', () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.getState().resetProgress();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shows encouraging empty state when opening Review Mode with empty reviewQueue (EC-CUR-01)', async () => {
    const user = userEvent.setup();
    renderChallenge('/challenge');

    await user.click(screen.getByRole('button', { name: /Open Review Mode/i }));
    expect(screen.getByTestId('review-empty-state')).toHaveTextContent(
      /Nothing to review right now/i
    );
    expect(screen.getByRole('button', { name: /Try Untimed Challenge/i })).toBeInTheDocument();
  });

  it('surfaces queued review items and clears them when answered correctly', async () => {
    const user = userEvent.setup();
    useAppStore.getState().recordExerciseOutcome({
      skillId: 'quarter-past-to',
      activityType: 'match-digital',
      targetTime: { hours: 3, minutes: 45 },
      firstTry: false,
      starsToAward: 1,
    });
    expect(useAppStore.getState().reviewQueue).toHaveLength(1);

    renderChallenge('/challenge');
    await user.click(screen.getByRole('button', { name: /Open Review Mode/i }));

    expect(screen.getByText('Review 1 of 1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Choose 3:45' }));
    expect(screen.getByTestId('hint-banner')).toHaveTextContent('Awesome job!');

    await user.click(screen.getByRole('button', { name: 'Finish' }));
    expect(screen.getByTestId('challenge-summary')).toHaveTextContent(/Review Practice Complete/i);
    expect(useAppStore.getState().reviewQueue).toHaveLength(0);
    expect(useAppStore.getState().badges).toContain('review-rescuer');
  });

  it('completes Untimed Challenge without countdown pressure and awards Challenge badge', async () => {
    const user = userEvent.setup();
    renderChallenge('/challenge');

    await user.click(screen.getByRole('button', { name: /Practice Without Timer/i }));
    await user.click(screen.getByRole('button', { name: /Start Untimed Challenge/i }));

    expect(screen.queryByTestId('challenge-timer')).not.toBeInTheDocument();

    for (let i = 0; i < 6; i++) {
      solveCurrentQuestionInDom();
      expect(screen.getByTestId('hint-banner')).toHaveTextContent('Awesome job!');
      await user.click(
        screen.getByRole('button', { name: i === 5 ? 'Finish' : 'Next Question' })
      );
    }

    expect(screen.getByTestId('challenge-summary')).toHaveTextContent(/Challenge Complete/i);
    expect(useAppStore.getState().badges).toContain('challenge-champion');
    expect(useAppStore.getState().totalStars).toBe(6);
  });

  it('tracks Timed Challenge via Date.now() delta across tab sleep and ends gracefully on timeout (EC-CUR-02, EC-CUR-03)', () => {
    vi.useFakeTimers();
    let now = 1_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);

    renderChallenge('/challenge');

    fireEvent.click(screen.getByRole('button', { name: /Timed Challenge \(90s\)/i }));
    fireEvent.click(screen.getByRole('button', { name: /Start Timed Challenge/i }));

    expect(screen.getByTestId('challenge-timer')).toHaveTextContent('01:30');

    // Solve first question so partial progress is earned
    solveCurrentQuestionInDom();
    expect(useAppStore.getState().totalStars).toBe(1);

    // Simulate 35 seconds tab backgrounding (EC-CUR-03)
    now += 35_000;
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.getByTestId('challenge-timer')).toHaveTextContent('00:55');

    // Advance past 00:00 timeout (EC-CUR-02)
    now += 60_000;
    act(() => {
      vi.advanceTimersByTime(300);
    });

    const summary = screen.getByTestId('challenge-summary');
    expect(summary).toHaveTextContent(/Time's up! Look at how many you solved!/i);
    expect(summary).toHaveTextContent(/1 out of 6/i);
    expect(useAppStore.getState().totalStars).toBe(1);
  });

  it('prompts before leaving active challenge with progress (EC-CUR-04)', () => {
    renderChallenge('/challenge');

    fireEvent.click(screen.getByRole('button', { name: /Start Untimed Challenge/i }));
    solveCurrentQuestionInDom();
    fireEvent.click(screen.getByRole('button', { name: 'Next Question' }));

    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent(/Leave this activity\?/i);

    fireEvent.click(screen.getByRole('button', { name: 'Leave Activity' }));
    expect(screen.getByRole('heading', { name: 'Mixed Clock Challenge' })).toBeInTheDocument();
    expect(useAppStore.getState().skills['challenge-mix'].attempts).toBe(0);
  });
});

