import { KeyboardEvent, PointerEvent, ReactNode, useRef, useState } from 'react';
import {
  CLOCK_CENTER,
  CLOCK_VIEWBOX_SIZE,
  DIAL_OUTER_RADIUS,
  applyHourAngleChange,
  applyMinuteAngleChange,
  clientToSvgPoint,
  pointerToClockAngle,
  polarToCartesian,
  stepHours,
  stepMinutes,
  timeToHandAngles,
} from '../../domain/clockMath';
import { formatDigitalTime } from '../../domain/clockModel';
import { MinuteLabelMode, TimeValue } from '../../domain/types';
import { ClockHands } from './ClockHands';
import { MinuteRing } from './MinuteRing';

export interface AnalogClockProps {
  time: TimeValue;
  interactive?: boolean;
  gearedHands?: boolean;
  minuteLabelMode?: MinuteLabelMode;
  snapStep?: number;
  activeTapHand?: 'hour' | 'minute' | null;
  showHandLabels?: boolean;
  highlightHand?: 'hour' | 'minute' | 'both' | null;
  highlightNumbers?: boolean;
  className?: string;
  ariaLabel?: string;
  onChange?: (next: TimeValue) => void;
  onCommit?: (committed: TimeValue) => void;
  overlaySlot?: ReactNode;
}

const MINUTE_TICKS = Array.from({ length: 60 }, (_, index) => {
  const angle = index * 6;
  const isMajor = index % 5 === 0;
  const innerRadius = isMajor ? 133 : 139;
  const outerRadius = 148;
  const p1 = polarToCartesian(CLOCK_CENTER, CLOCK_CENTER, innerRadius, angle);
  const p2 = polarToCartesian(CLOCK_CENTER, CLOCK_CENTER, outerRadius, angle);
  return { index, isMajor, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
});

const HOUR_NUMBERS = Array.from({ length: 12 }, (_, idx) => {
  const hour = idx + 1;
  const pos = polarToCartesian(CLOCK_CENTER, CLOCK_CENTER, 114, hour * 30);
  return { hour, x: pos.x, y: pos.y };
});

/**
 * Resolution-independent SVG analog clock centered at (200, 200) inside viewBox 0 0 400 400.
 * Supports pointer drag with capture, tap-to-set dial clicks, keyboard sliders, and 00–59 ring.
 */
export function AnalogClock({
  time,
  interactive = false,
  gearedHands = true,
  minuteLabelMode = 'none',
  snapStep = 1,
  activeTapHand = null,
  showHandLabels = false,
  highlightHand = null,
  highlightNumbers = false,
  className = '',
  ariaLabel,
  onChange,
  onCommit,
  overlaySlot,
}: AnalogClockProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const dragHandRef = useRef<'hour' | 'minute' | null>(null);
  const latestTimeRef = useRef<TimeValue>(time);
  latestTimeRef.current = time;

  const [activeDragHand, setActiveDragHand] = useState<'hour' | 'minute' | null>(null);

  const { hourAngle, minuteAngle } = timeToHandAngles(time, gearedHands);
  const label = ariaLabel ?? `Analog clock showing ${formatDigitalTime(time)}`;

  const computeTimeFromPointer = (
    hand: 'hour' | 'minute',
    clientX: number,
    clientY: number,
    requireOuterBounds = false
  ): TimeValue | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const svgPt = clientToSvgPoint(clientX, clientY, svg.getBoundingClientRect());
    if (!svgPt) return null;

    const polar = pointerToClockAngle(svgPt.x, svgPt.y);
    if (!polar) return null;
    if (requireOuterBounds && polar.radius > DIAL_OUTER_RADIUS) {
      return null;
    }

    return hand === 'minute'
      ? applyMinuteAngleChange(latestTimeRef.current, polar.angle, gearedHands, snapStep)
      : applyHourAngleChange(latestTimeRef.current, polar.angle, gearedHands);
  };

  const handleHandPointerDown = (hand: 'hour' | 'minute', event: PointerEvent<SVGElement>) => {
    if (!interactive || activePointerIdRef.current !== null) return;
    event.stopPropagation();

    activePointerIdRef.current = event.pointerId;
    dragHandRef.current = hand;
    setActiveDragHand(hand);

    try {
      svgRef.current?.setPointerCapture?.(event.pointerId);
    } catch {
      // Ignore synthetic pointer ids in environments without active pointer capture
    }
  };

  const handleSvgPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (!interactive || !activeTapHand || activePointerIdRef.current !== null) return;
    const next = computeTimeFromPointer(activeTapHand, event.clientX, event.clientY, true);
    if (next) {
      onChange?.(next);
      onCommit?.(next);
    }
  };

  const handleSvgPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (
      !interactive ||
      activePointerIdRef.current !== event.pointerId ||
      !dragHandRef.current
    ) {
      return;
    }
    const next = computeTimeFromPointer(dragHandRef.current, event.clientX, event.clientY);
    if (next) {
      latestTimeRef.current = next;
      onChange?.(next);
    }
  };

  const endDrag = (event: PointerEvent<SVGSVGElement>) => {
    if (activePointerIdRef.current !== event.pointerId) return;

    try {
      svgRef.current?.releasePointerCapture?.(event.pointerId);
    } catch {
      // Ignore release errors if capture was not active
    }

    activePointerIdRef.current = null;
    dragHandRef.current = null;
    setActiveDragHand(null);
    onCommit?.(latestTimeRef.current);
  };

  const handleHandKeyDown = (hand: 'hour' | 'minute', event: KeyboardEvent<SVGGElement>) => {
    if (!interactive) return;

    let delta = 0;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      delta = 1;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      delta = -1;
    } else {
      return;
    }

    event.preventDefault();
    let next: TimeValue;
    if (hand === 'hour') {
      next = stepHours(time, delta);
    } else {
      const minuteStep = event.shiftKey ? 5 : snapStep;
      next = stepMinutes(time, delta * minuteStep, gearedHands);
    }

    onChange?.(next);
    onCommit?.(next);
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${CLOCK_VIEWBOX_SIZE} ${CLOCK_VIEWBOX_SIZE}`}
      role={interactive ? 'group' : 'img'}
      aria-label={label}
      style={interactive ? { touchAction: 'none', overscrollBehavior: 'contain' } : undefined}
      className={`h-auto w-full select-none ${className}`}
      onPointerDown={handleSvgPointerDown}
      onPointerMove={handleSvgPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {/* Dial Background */}
      <circle
        cx={CLOCK_CENTER}
        cy={CLOCK_CENTER}
        r={156}
        fill="#ffffff"
        stroke="var(--color-ink)"
        strokeWidth={5}
      />

      {/* Optional 00–59 Minute Ring */}
      <MinuteRing
        mode={minuteLabelMode}
        activeMinute={interactive ? time.minutes : null}
      />

      {/* 60 Radial Tick Marks */}
      <g aria-hidden="true">
        {MINUTE_TICKS.map((tick) => (
          <line
            key={tick.index}
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
            stroke={tick.isMajor ? 'var(--color-ink)' : '#8a94a6'}
            strokeWidth={tick.isMajor ? 3.5 : 1.5}
            strokeLinecap="round"
          />
        ))}
      </g>

      {/* Hour Numbers 1–12 */}
      <g aria-hidden="true">
        {HOUR_NUMBERS.map(({ hour, x, y }) => (
          <g key={hour}>
            {highlightNumbers && (
              <circle
                cx={x}
                cy={y}
                r={15}
                fill="var(--color-hour)"
                fillOpacity={0.14}
              />
            )}
            <text
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={22}
              fontWeight={800}
              fill="var(--color-ink)"
            >
              {hour}
            </text>
          </g>
        ))}
      </g>

      {/* Distinct Hour & Minute Hands + Interactive Hit Overlays + Pivot */}
      <ClockHands
        time={time}
        hourAngle={hourAngle}
        minuteAngle={minuteAngle}
        interactive={interactive}
        showHandLabels={showHandLabels}
        highlightHand={highlightHand}
        activeDragHand={activeDragHand}
        onHandPointerDown={handleHandPointerDown}
        onHandKeyDown={handleHandKeyDown}
      />

      {overlaySlot}
    </svg>
  );
}
