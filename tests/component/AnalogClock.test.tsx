import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AnalogClock } from '../../src/components/clock/AnalogClock';

describe('AnalogClock', () => {
  it('renders dial numbers 1–12 and accessible label', () => {
    render(<AnalogClock time={{ hours: 3, minutes: 30 }} />);

    const svg = screen.getByRole('img', { name: 'Analog clock showing 3:30' });
    expect(svg).toHaveAttribute('viewBox', '0 0 400 400');

    for (let h = 1; h <= 12; h++) {
      expect(svg.textContent).toContain(String(h));
    }
  });

  it('updates hour hand transform cleanly when gearedHands toggles from false to true at 3:45 (EC-GEO-06)', () => {
    const { rerender } = render(
      <AnalogClock time={{ hours: 3, minutes: 45 }} gearedHands={false} />
    );

    expect(screen.getByTestId('hour-hand')).toHaveAttribute(
      'transform',
      'rotate(90 200 200)'
    );
    expect(screen.getByTestId('minute-hand')).toHaveAttribute(
      'transform',
      'rotate(270 200 200)'
    );

    rerender(<AnalogClock time={{ hours: 3, minutes: 45 }} gearedHands={true} />);

    expect(screen.getByTestId('hour-hand')).toHaveAttribute(
      'transform',
      'rotate(112.5 200 200)'
    );
  });

  it('renders minute hand after hour hand for 12:00 visibility and shows optional H/M labels (EC-GEO-05)', () => {
    render(<AnalogClock time={{ hours: 12, minutes: 0 }} showHandLabels />);

    const hourHand = screen.getByTestId('hour-hand');
    const minuteHand = screen.getByTestId('minute-hand');

    expect(hourHand).toHaveAttribute('transform', 'rotate(0 200 200)');
    expect(minuteHand).toHaveAttribute('transform', 'rotate(0 200 200)');
    expect(hourHand.textContent).toContain('H');
    expect(minuteHand.textContent).toContain('M');

    const positionMask = hourHand.compareDocumentPosition(minuteHand);
    expect(positionMask & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

