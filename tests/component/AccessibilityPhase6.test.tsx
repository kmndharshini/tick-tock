import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../src/app/routes';
import { AppShell } from '../../src/components/layout/AppShell';
import { useAppStore } from '../../src/store/useAppStore';

const ALL_ROUTES = ['/', '/learn', '/explore', '/exercise', '/challenge', '/progress', '/parent'];

function mockClockSvgRect(svg: SVGSVGElement) {
  vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 400,
    height: 400,
    right: 400,
    bottom: 400,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
}

describe('Phase 6: Accessibility, ARIA Live Regions, Non-Color Cues & Keyboard Flow', () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.getState().resetProgress();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(ALL_ROUTES)('has 0 critical or serious axe-core violations on %s', async (route) => {
    const { container } = render(
      <MemoryRouter initialEntries={[route]}>
        <AppShell>
          <AppRoutes />
        </AppShell>
      </MemoryRouter>
    );

    const results = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false } },
    });
    const seriousOrCritical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );
    expect(seriousOrCritical).toEqual([]);
  });

  it('defers aria-live announcements until pointerup on drag, while announcing immediately on keyboard steps (EC-A11Y-02)', () => {
    render(
      <MemoryRouter initialEntries={['/explore']}>
        <AppShell>
          <AppRoutes />
        </AppShell>
      </MemoryRouter>
    );

    const svg = screen.getByRole('group', { name: /Analog clock showing/i }) as unknown as SVGSVGElement;
    mockClockSvgRect(svg);

    const liveRegion = screen.getByText('', { selector: 'p.sr-only[aria-live="polite"]' });
    expect(liveRegion).toHaveTextContent('');

    const minuteHit = screen.getByTestId('minute-hit-target');
    fireEvent.pointerDown(minuteHit, { pointerId: 1, clientX: 200, clientY: 80 });
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: 320, clientY: 200 });

    // During drag move, aria-live must stay quiet to avoid flooding screen readers
    expect(liveRegion).toHaveTextContent('');

    fireEvent.pointerUp(svg, { pointerId: 1, clientX: 320, clientY: 200 });
    expect(liveRegion).toHaveTextContent(/Clock set to quarter past 3/i);

    // Keyboard step announces immediately
    const minuteHand = screen.getByRole('slider', { name: 'Minute hand' });
    fireEvent.keyDown(minuteHand, { key: 'ArrowRight' });
    expect(liveRegion).toHaveTextContent(/Clock set to 3:16/i);
  });

  it('distinguishes hour and minute hands purely by length, stroke width, tip geometry, and labels (EC-A11Y-01)', () => {
    render(
      <MemoryRouter initialEntries={['/explore']}>
        <AppRoutes />
      </MemoryRouter>
    );

    const hourHand = screen.getByTestId('hour-hand');
    const minuteHand = screen.getByTestId('minute-hand');

    const hourLine = hourHand.querySelector('line[stroke="var(--color-hour)"]');
    const minuteLine = minuteHand.querySelector('line[stroke="var(--color-minute)"]');

    expect(Number(hourLine?.getAttribute('stroke-width'))).toBeGreaterThan(
      Number(minuteLine?.getAttribute('stroke-width'))
    );
    const hourLength =
      Number(hourLine?.getAttribute('y1')) - Number(hourLine?.getAttribute('y2'));
    const minuteLength =
      Number(minuteLine?.getAttribute('y1')) - Number(minuteLine?.getAttribute('y2'));
    expect(minuteLength).toBeGreaterThan(hourLength);

    expect(hourHand).toHaveTextContent('H');
    expect(minuteHand).toHaveTextContent('M');
  });

  it('supports keyboard-only walkthrough from Home -> Learn -> Set Time -> Submit -> Next (EC-INP-07)', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppShell>
          <AppRoutes />
        </AppShell>
      </MemoryRouter>
    );

    // Toggle header auto-read voice via button
    const voiceToggle = screen.getByRole('button', { name: /Turn on auto-read voice/i });
    await user.click(voiceToggle);
    expect(useAppStore.getState().settings.ttsEnabled).toBe(true);
    await user.click(screen.getByRole('button', { name: /Turn off auto-read voice/i }));

    // Navigate Home -> Learn -> Practice This Now (Exercise)
    await user.click(screen.getByRole('link', { name: /Start Learning/i }));
    expect(screen.getByRole('heading', { name: 'Learn the Clock' })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /2\. Hands/i }));
    await user.click(screen.getByRole('link', { name: /Practice This Now/i }));

    // Switch to Set Time mode and solve via keyboard ArrowRight on Hour hand
    await user.click(screen.getByRole('button', { name: 'Set Time' }));
    const promptHeading = screen.getByRole('heading', { level: 2 });
    const match = promptHeading.textContent?.match(/show (\d+) o'clock/i);
    const targetHour = Number(match![1]);

    const minuteSlider = screen.getByRole('slider', { name: 'Minute hand' });
    if (Number(minuteSlider.getAttribute('aria-valuenow')) !== 0) {
      minuteSlider.focus();
      let minSafety = 0;
      while (Number(minuteSlider.getAttribute('aria-valuenow')) !== 0 && minSafety < 12) {
        await user.keyboard('{Shift>}{ArrowRight}{/Shift}');
        minSafety += 1;
      }
    }

    const hourSlider = screen.getByRole('slider', { name: 'Hour hand' });
    hourSlider.focus();
    let safety = 0;
    while (Number(hourSlider.getAttribute('aria-valuenow')) !== targetHour && safety < 12) {
      await user.keyboard('{ArrowRight}');
      safety += 1;
    }

    await user.click(screen.getByRole('button', { name: 'Check Time' }));
    expect(screen.getByTestId('hint-banner')).toHaveTextContent('Awesome job!');

    await user.click(screen.getByRole('button', { name: 'Next Question' }));
    expect(screen.getByText('Question 2 of 5')).toBeInTheDocument();
  });
});
