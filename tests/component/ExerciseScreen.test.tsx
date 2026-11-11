import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppRoutes } from '../../src/app/routes';
import { formatDigitalTime } from '../../src/domain/clockModel';
import { useAppStore } from '../../src/store/useAppStore';

function renderExerciseAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>
  );
}

describe('Phase 4: ExerciseScreen & Learning Components', () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.getState().resetProgress();
  });

  it('supports deep-linked skill, diagnostic hint retry flow, and solving Set Time', async () => {
    const user = userEvent.setup();
    renderExerciseAt('/exercise?skill=oclock&type=set-time');

    expect(screen.getByRole('heading', { name: 'Clock Exercises' })).toBeInTheDocument();
    const promptHeading = screen.getByRole('heading', { level: 2 });
    expect(promptHeading.textContent).toMatch(/o'clock/i);

    // Extract target hour from prompt ("Can you show X o'clock on the clock?")
    const match = promptHeading.textContent?.match(/show (\d+) o'clock/i);
    expect(match).not.toBeNull();
    const targetHour = Number(match![1]);

    // Initial clock is never equal to targetTime (EC-EX-06), so immediate check gives a hint
    await user.click(screen.getByRole('button', { name: 'Check Time' }));
    const hintBanner = screen.getByTestId('hint-banner');
    expect(hintBanner).toBeInTheDocument();
    expect(hintBanner.textContent).not.toMatch(/\b(wrong|failed|error|incorrect)\b/i);
    // Session stays on Question 1 for retry
    expect(screen.getByText('Question 1 of 5')).toBeInTheDocument();

    // Move minute hand to 0 if needed (when target is 6:00, initial is 12:30)
    const minuteSlider = screen.getByRole('slider', { name: 'Minute hand' });
    let minSafety = 0;
    while (Number(minuteSlider.getAttribute('aria-valuenow')) !== 0 && minSafety < 12) {
      await user.click(screen.getByRole('button', { name: 'Add 5 minutes' }));
      minSafety += 1;
    }

    // Move hour hand using +1 hr stepper until aria-valuenow === targetHour
    const hourSlider = screen.getByRole('slider', { name: 'Hour hand' });
    let safety = 0;
    while (Number(hourSlider.getAttribute('aria-valuenow')) !== targetHour && safety < 12) {
      await user.click(screen.getByRole('button', { name: 'Add 1 hour' }));
      safety += 1;
    }

    await user.click(screen.getByRole('button', { name: 'Check Time' }));
    expect(screen.getByTestId('hint-banner')).toHaveTextContent('Awesome job!');
    expect(useAppStore.getState().totalStars).toBe(1);
    expect(useAppStore.getState().skills.oclock.attempts).toBe(1);
    expect(useAppStore.getState().skills.oclock.correctFirstTry).toBe(0);
    expect(useAppStore.getState().reviewQueue).toHaveLength(1);
  });

  it('prevents duplicate star/attempt recording when double-clicking a ChoiceGrid card (EC-EX-04)', async () => {
    renderExerciseAt('/exercise?skill=half-past&type=match-digital');

    const clockSvg = screen.getByRole('img', { name: /Analog clock showing/i });
    const ariaLabel = clockSvg.getAttribute('aria-label') ?? '';
    const targetTimeStr = ariaLabel.replace('Analog clock showing ', '').trim();

    const targetButton = screen.getByRole('button', { name: `Choose ${targetTimeStr}` });
    fireEvent.click(targetButton);
    fireEvent.click(targetButton);

    expect(screen.getByTestId('hint-banner')).toHaveTextContent('Awesome job!');
    expect(useAppStore.getState().totalStars).toBe(1);
    expect(useAppStore.getState().skills['half-past'].attempts).toBe(1);
    expect(useAppStore.getState().skills['half-past'].correctFirstTry).toBe(1);
  });

  it('renders Match Digital -> Analog with DigitalReadout and interactive clock', async () => {
    const user = userEvent.setup();
    renderExerciseAt('/exercise?skill=oclock&type=match-analog');

    const readout = screen.getByTestId('digital-readout');
    const targetText = readout.textContent?.trim() ?? '';
    const [targetHour, targetMinute] = targetText.split(':').map(Number);

    const minuteSlider = screen.getByRole('slider', { name: 'Minute hand' });
    let minSafety = 0;
    while (Number(minuteSlider.getAttribute('aria-valuenow')) !== targetMinute && minSafety < 65) {
      const currentMin = Number(minuteSlider.getAttribute('aria-valuenow'));
      const diff = (targetMinute - currentMin + 60) % 60;
      if (diff >= 5) {
        await user.click(screen.getByRole('button', { name: 'Add 5 minutes' }));
      } else {
        await user.click(screen.getByRole('button', { name: 'Add 1 minute' }));
      }
      minSafety += 1;
    }

    const hourSlider = screen.getByRole('slider', { name: 'Hour hand' });
    let safety = 0;
    while (Number(hourSlider.getAttribute('aria-valuenow')) !== targetHour && safety < 12) {
      await user.click(screen.getByRole('button', { name: 'Add 1 hour' }));
      safety += 1;
    }

    await user.click(screen.getByRole('button', { name: 'Check Time' }));
    expect(screen.getByTestId('hint-banner')).toHaveTextContent(
      formatDigitalTime({ hours: targetHour, minutes: targetMinute })
    );
  });

  it('completes a full 5-question Daily Life round with time-of-day cues', async () => {
    const user = userEvent.setup();
    renderExerciseAt('/exercise?skill=daily-life');

    const routineToTime: Record<string, string> = {
      'Waking Up': '7:00',
      'Going to School': '8:15',
      'Eating Lunch': '12:00',
      'Playing Outside': '3:30',
      'Doing Homework': '5:00',
      'Going to Bed': '9:00',
    };

    for (let round = 0; round < 5; round++) {
      const card = screen.getByTestId('daily-activity-card');
      expect(card.textContent).toMatch(/Morning|Afternoon|Night/);

      const titleEl = card.querySelector('h2');
      const routineTitle = titleEl?.textContent?.trim() ?? '';
      const expectedTime = routineToTime[routineTitle];
      expect(expectedTime).toBeDefined();

      await user.click(screen.getByRole('button', { name: `Choose ${expectedTime}` }));
      expect(screen.getByTestId('hint-banner')).toHaveTextContent('Awesome job!');

      const nextBtnName = round === 4 ? 'Finish Round' : 'Next Question';
      await user.click(screen.getByRole('button', { name: nextBtnName }));
    }

    expect(screen.getByText(/Great Round! You Earned ★ 5/i)).toBeInTheDocument();
    expect(useAppStore.getState().totalStars).toBe(5);
    expect(useAppStore.getState().skills['daily-life'].correctFirstTry).toBe(5);
  });
});

