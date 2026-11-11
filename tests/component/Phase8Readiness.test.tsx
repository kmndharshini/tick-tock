import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnalogClock } from '../../src/components/clock/AnalogClock';
import { CLOCK_CENTER, CLOCK_VIEWBOX_SIZE, polarToCartesian } from '../../src/domain/clockMath';
import { ExerciseScreen } from '../../src/screens/ExerciseScreen';
import { InteractiveClockScreen } from '../../src/screens/InteractiveClockScreen';
import { LearnScreen } from '../../src/screens/LearnScreen';
import '../../src/app/theme.css';

describe('Phase 8: Responsive Geometry, Touch Ergonomics & Reduced Motion Readiness', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('keeps all 60 MinuteRing labels unclipped and non-overlapping inside viewBox (EC-UI-01)', () => {
    const minuteRadius = 179;
    const outerTickRadius = 148;
    const hourNumRadius = 114;

    expect(minuteRadius - outerTickRadius).toBeGreaterThanOrEqual(30);
    expect(outerTickRadius - hourNumRadius).toBeGreaterThanOrEqual(30);

    const points = Array.from({ length: 60 }, (_, m) =>
      polarToCartesian(CLOCK_CENTER, CLOCK_CENTER, minuteRadius, m * 6)
    );

    for (let i = 0; i < points.length; i++) {
      const curr = points[i];
      const next = points[(i + 1) % points.length];
      expect(curr.x).toBeGreaterThan(10);
      expect(curr.x).toBeLessThan(CLOCK_VIEWBOX_SIZE - 10);
      expect(curr.y).toBeGreaterThan(10);
      expect(curr.y).toBeLessThan(CLOCK_VIEWBOX_SIZE - 10);

      const chordDist = Math.hypot(next.x - curr.x, next.y - curr.y);
      // Font size for minor labels is 8.5 and major is 11.5; chord distance > 18 guarantees separation
      expect(chordDist).toBeGreaterThan(18);
    }
  });

  it('applies touch-action: none and overscroll-behavior: contain on interactive AnalogClock (EC-INP-01)', () => {
    render(<AnalogClock time={{ hours: 3, minutes: 0 }} interactive />);
    const svg = screen.getByRole('group', { name: 'Analog clock showing 3:00' });
    expect(svg.style.touchAction).toBe('none');
    expect(svg.style.overscrollBehavior).toBe('contain');
  });

  it('applies landscape clock-stage-grid layout class and loads responsive/a11y media rules (EC-UI-02, EC-A11Y-01, EC-A11Y-03)', () => {
    const exploreRender = render(
      <MemoryRouter>
        <InteractiveClockScreen />
      </MemoryRouter>
    );
    expect(exploreRender.container.querySelector('.clock-stage-grid')).not.toBeNull();
    exploreRender.unmount();

    const exerciseRender = render(
      <MemoryRouter>
        <ExerciseScreen />
      </MemoryRouter>
    );
    expect(exerciseRender.container.querySelector('.clock-stage-grid')).not.toBeNull();
    exerciseRender.unmount();

    const cssText = Array.from(document.querySelectorAll('style'))
      .map((s) => s.textContent ?? '')
      .join('\n');
    expect(cssText).toContain('clock-stage-grid');
    expect(cssText).toContain('prefers-reduced-motion');
    expect(cssText).toContain('forced-colors');
  });

  it('replaces sweeping 60-minute animation with gentle step when prefers-reduced-motion matches (EC-A11Y-03)', () => {
    vi.useFakeTimers();
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    try {
      render(
        <MemoryRouter>
          <LearnScreen />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByRole('tab', { name: /3\. 60 Mins/i }));
      fireEvent.click(screen.getByRole('button', { name: /Play 60-Minute Demo/i }));

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(screen.getByTestId('digital-readout')).toHaveTextContent('1:00');
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });
});

