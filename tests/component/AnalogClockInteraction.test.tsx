import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AnalogClock } from '../../src/components/clock/AnalogClock';
import { TapToSetPad } from '../../src/components/clock/TapToSetPad';
import { MinuteLabelMode, TimeValue } from '../../src/domain/types';

function mockSvgRect(svg: SVGSVGElement) {
  vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    right: 400,
    bottom: 400,
    width: 400,
    height: 400,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
}

function InteractiveHarness({
  initialTime = { hours: 11, minutes: 58 },
  gearedHands = true,
  minuteLabelMode = 'all' as MinuteLabelMode,
  onCommit = vi.fn(),
}: {
  initialTime?: TimeValue;
  gearedHands?: boolean;
  minuteLabelMode?: MinuteLabelMode;
  onCommit?: (time: TimeValue) => void;
}) {
  const [time, setTime] = useState<TimeValue>(initialTime);
  const [activeHand, setActiveHand] = useState<'hour' | 'minute'>('minute');

  return (
    <div>
      <AnalogClock
        time={time}
        interactive
        gearedHands={gearedHands}
        minuteLabelMode={minuteLabelMode}
        activeTapHand={activeHand}
        onChange={setTime}
        onCommit={onCommit}
      />
      <TapToSetPad
        time={time}
        gearedHands={gearedHands}
        activeHand={activeHand}
        onActiveHandChange={setActiveHand}
        onChange={setTime}
        onCommit={onCommit}
      />
      <output data-testid="time-output">
        {time.hours}:{String(time.minutes).padStart(2, '0')}
      </output>
    </div>
  );
}

describe('Phase 2: Unified Clock Input & MinuteRing', () => {
  it('supports pointer drag across 12 oclock, tracks outside SVG, and ignores secondary pointers', () => {
    const onCommit = vi.fn();
    render(<InteractiveHarness initialTime={{ hours: 11, minutes: 58 }} onCommit={onCommit} />);

    const svg = screen.getByRole('group') as unknown as SVGSVGElement;
    mockSvgRect(svg);
    svg.setPointerCapture = vi.fn();
    svg.releasePointerCapture = vi.fn();

    const minuteHit = screen.getByTestId('minute-hit-target');
    expect(minuteHit).toHaveAttribute('stroke-width', '34');

    fireEvent.pointerDown(minuteHit, { pointerId: 1, clientX: 190, clientY: 60 });
    expect(svg.setPointerCapture).toHaveBeenCalledWith(1);

    // Secondary finger should be ignored (EC-INP-03)
    fireEvent.pointerMove(svg, { pointerId: 2, clientX: 200, clientY: 360 });
    expect(screen.getByTestId('time-output')).toHaveTextContent('11:58');

    // Drag clockwise past 12 o'clock outside SVG bounds (EC-GEO-01, EC-INP-02)
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: 280, clientY: -40 });
    expect(onCommit).not.toHaveBeenCalled(); // Deferred until commit (EC-A11Y-02)

    fireEvent.pointerUp(svg, { pointerId: 1, clientX: 280, clientY: -40 });
    expect(svg.releasePointerCapture).toHaveBeenCalledWith(1);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('time-output').textContent).toMatch(/^12:/);
  });

  it('cleans up active drag cleanly on pointercancel (EC-INP-04)', () => {
    const onCommit = vi.fn();
    render(<InteractiveHarness initialTime={{ hours: 3, minutes: 0 }} onCommit={onCommit} />);

    const svg = screen.getByRole('group') as unknown as SVGSVGElement;
    mockSvgRect(svg);

    const minuteHit = screen.getByTestId('minute-hit-target');
    fireEvent.pointerDown(minuteHit, { pointerId: 7, clientX: 200, clientY: 70 });
    fireEvent.pointerMove(svg, { pointerId: 7, clientX: 340, clientY: 200 });
    fireEvent.pointerCancel(svg, { pointerId: 7 });

    expect(screen.getByTestId('time-output')).toHaveTextContent('3:15');
    expect(onCommit).toHaveBeenCalledWith({ hours: 3, minutes: 15 });

    // Further moves after cancel should not move hand
    fireEvent.pointerMove(svg, { pointerId: 7, clientX: 200, clientY: 340 });
    expect(screen.getByTestId('time-output')).toHaveTextContent('3:15');
  });

  it('supports Tap-to-Set on dial and ignores taps outside outer bounds (EC-INP-06)', async () => {
    const user = userEvent.setup();
    render(<InteractiveHarness initialTime={{ hours: 12, minutes: 0 }} />);

    const svg = screen.getByRole('group') as unknown as SVGSVGElement;
    mockSvgRect(svg);

    // Tap corner outside outer dial radius (EC-INP-06)
    fireEvent.pointerDown(svg, { pointerId: 1, clientX: 5, clientY: 5 });
    expect(screen.getByTestId('time-output')).toHaveTextContent('12:00');

    // Tap at 3 o'clock (minute = 15)
    fireEvent.pointerDown(svg, { pointerId: 1, clientX: 320, clientY: 200 });
    expect(screen.getByTestId('time-output')).toHaveTextContent('12:15');

    // Switch active hand to Hour and tap at 6 o'clock (hour = 6)
    await user.click(screen.getByRole('button', { name: 'Hour Hand' }));
    fireEvent.pointerDown(svg, { pointerId: 1, clientX: 200, clientY: 320 });
    expect(screen.getByTestId('time-output')).toHaveTextContent('6:15');
  });

  it('supports keyboard slider Arrow and Shift+Arrow controls with ARIA attributes', () => {
    render(<InteractiveHarness initialTime={{ hours: 12, minutes: 58 }} />);

    const hourSlider = screen.getByRole('slider', { name: 'Hour hand' });
    const minuteSlider = screen.getByRole('slider', { name: 'Minute hand' });

    expect(hourSlider).toHaveAttribute('aria-valuenow', '12');
    expect(hourSlider).toHaveAttribute('aria-valuetext', "12 o'clock");
    expect(minuteSlider).toHaveAttribute('aria-valuenow', '58');
    expect(minuteSlider).toHaveAttribute('aria-valuetext', '58 minutes');

    fireEvent.keyDown(minuteSlider, { key: 'ArrowRight', shiftKey: true });
    expect(screen.getByTestId('time-output')).toHaveTextContent('1:03');

    fireEvent.keyDown(hourSlider, { key: 'ArrowLeft' });
    expect(screen.getByTestId('time-output')).toHaveTextContent('12:03');
  });

  it('supports TapToSetPad stepper buttons', async () => {
    const user = userEvent.setup();
    render(<InteractiveHarness initialTime={{ hours: 1, minutes: 2 }} />);

    await user.click(screen.getByRole('button', { name: 'Subtract 5 minutes' }));
    expect(screen.getByTestId('time-output')).toHaveTextContent('12:57');

    await user.click(screen.getByRole('button', { name: 'Add 1 hour' }));
    expect(screen.getByTestId('time-output')).toHaveTextContent('1:57');
  });

  it('renders 00–59 minute ring modes without altering viewBox (EC-UI-03)', () => {
    const { rerender } = render(
      <AnalogClock time={{ hours: 3, minutes: 15 }} minuteLabelMode="all" />
    );

    const svg = screen.getByRole('img');
    expect(svg).toHaveAttribute('viewBox', '0 0 400 400');

    const ringAll = screen.getByTestId('minute-ring');
    expect(ringAll.querySelectorAll('text')).toHaveLength(60);
    expect(ringAll.textContent).toContain('00');
    expect(ringAll.textContent).toContain('01');
    expect(ringAll.textContent).toContain('59');

    rerender(<AnalogClock time={{ hours: 3, minutes: 15 }} minuteLabelMode="fives" />);
    const ringFives = screen.getByTestId('minute-ring');
    const fivesLabels = Array.from(ringFives.querySelectorAll('text')).map(
      (node) => node.textContent
    );
    expect(fivesLabels).toEqual([
      '00',
      '05',
      '10',
      '15',
      '20',
      '25',
      '30',
      '35',
      '40',
      '45',
      '50',
      '55',
    ]);
    expect(svg).toHaveAttribute('viewBox', '0 0 400 400');

    rerender(<AnalogClock time={{ hours: 3, minutes: 15 }} minuteLabelMode="none" />);
    expect(screen.queryByTestId('minute-ring')).not.toBeInTheDocument();
    expect(svg).toHaveAttribute('viewBox', '0 0 400 400');
  });
});

