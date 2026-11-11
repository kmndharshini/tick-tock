import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DigitalReadout } from '../../src/components/learning/DigitalReadout';
import { describeClockTime } from '../../src/domain/clockModel';
import { HomeScreen } from '../../src/screens/HomeScreen';
import { InteractiveClockScreen } from '../../src/screens/InteractiveClockScreen';
import { LearnScreen } from '../../src/screens/LearnScreen';
import { useAppStore } from '../../src/store/useAppStore';

describe('Phase 3: Home, Learn & Interactive Clock Screens', () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.getState().resetProgress();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('formats natural clock descriptions and DigitalReadout visibility', () => {
    expect(describeClockTime({ hours: 3, minutes: 0 })).toBe("3 o'clock");
    expect(describeClockTime({ hours: 3, minutes: 15 })).toBe('quarter past 3');
    expect(describeClockTime({ hours: 3, minutes: 30 })).toBe('half past 3');
    expect(describeClockTime({ hours: 3, minutes: 45 })).toBe('quarter to 4');
    expect(describeClockTime({ hours: 3, minutes: 5 })).toBe('3 oh 5');

    const { rerender } = render(
      <DigitalReadout time={{ hours: 3, minutes: 15 }} partOfDay="afternoon" />
    );
    expect(screen.getByTestId('digital-readout')).toHaveTextContent('3:15');
    expect(screen.getByText('Afternoon')).toBeInTheDocument();

    rerender(<DigitalReadout time={{ hours: 3, minutes: 15 }} visible={false} />);
    expect(screen.getByTestId('digital-readout-hidden')).toBeInTheDocument();
  });

  it('renders HomeScreen CTAs and activity links', () => {
    render(
      <MemoryRouter>
        <HomeScreen />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: /Start Learning/i })).toHaveAttribute('href', '/learn');
    expect(screen.getByRole('link', { name: /^Interactive Clock$/i })).toHaveAttribute(
      'href',
      '/explore'
    );
    expect(screen.getByRole('link', { name: /Practice Exercises/i })).toHaveAttribute(
      'href',
      '/exercise'
    );
    expect(screen.getByRole('link', { name: /Clock Challenge/i })).toHaveAttribute(
      'href',
      '/challenge'
    );
    expect(screen.getByRole('link', { name: /Parent & Teacher/i })).toHaveAttribute(
      'href',
      '/parent'
    );
  });

  it('supports InteractiveClockScreen readout toggle, minute ring modes, and presets', async () => {
    const user = userEvent.setup();
    render(<InteractiveClockScreen />);

    expect(screen.getByTestId('digital-readout')).toHaveTextContent('3:00');
    expect(screen.getByTestId('minute-ring').querySelectorAll('text')).toHaveLength(60);

    await user.click(screen.getByRole('button', { name: 'Quarter To (3:45)' }));
    expect(screen.getByTestId('digital-readout')).toHaveTextContent('3:45');
    expect(screen.getByText('quarter to 4')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'By 5s' }));
    expect(screen.getByTestId('minute-ring').querySelectorAll('text')).toHaveLength(12);

    await user.click(screen.getByRole('button', { name: 'Hide' }));
    expect(screen.queryByTestId('minute-ring')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hide Digital' }));
    expect(screen.getByTestId('digital-readout-hidden')).toBeInTheDocument();
  });

  it('steps through all 4 LearnScreen lessons, runs 60-minute demo, and links to Exercise', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LearnScreen />
      </MemoryRouter>
    );

    expect(
      screen.getByRole('heading', { name: 'Meet the Clock Numbers 1 to 12' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Practice This Now/i })).toHaveAttribute(
      'href',
      '/exercise?skill=clock-parts'
    );

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(
      screen.getByRole('heading', { name: 'Short Hour Hand vs. Long Minute Hand' })
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(
      screen.getByRole('heading', { name: '60 Minutes Make 1 Whole Hour' })
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(
      screen.getByRole('heading', { name: 'Counting by 5s & All 00–59 Minutes' })
    ).toBeInTheDocument();
    expect(screen.getByTestId('minute-ring').querySelectorAll('text')).toHaveLength(60);

    await user.click(screen.getByRole('button', { name: /By 5s/i }));
    expect(screen.getByTestId('minute-ring').querySelectorAll('text')).toHaveLength(12);
    expect(screen.getByRole('link', { name: /Practice This Now/i })).toHaveAttribute(
      'href',
      '/exercise?skill=five-minutes'
    );
  });

  it('honors prefers-reduced-motion in Step 3 60-minute demonstration (EC-A11Y-03)', () => {
    vi.useFakeTimers();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });

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
  });
});

