import { KeyboardEvent, PointerEvent } from 'react';
import { CLOCK_CENTER } from '../../domain/clockMath';
import { TimeValue } from '../../domain/types';

export interface ClockHandsProps {
  time: TimeValue;
  hourAngle: number;
  minuteAngle: number;
  interactive?: boolean;
  showHandLabels?: boolean;
  highlightHand?: 'hour' | 'minute' | 'both' | null;
  activeDragHand?: 'hour' | 'minute' | null;
  onHandPointerDown?: (hand: 'hour' | 'minute', event: PointerEvent<SVGElement>) => void;
  onHandKeyDown?: (hand: 'hour' | 'minute', event: KeyboardEvent<SVGGElement>) => void;
}

/**
 * Distinct, accessible analog clock hands.
 * Differentiated by length (85 vs 132), width (11 vs 6), tip shape, color, and optional labels.
 * Minute hand renders after hour hand so stacked hands at 12:00 stay visually separable.
 */
export function ClockHands({
  time,
  hourAngle,
  minuteAngle,
  interactive = false,
  showHandLabels = false,
  highlightHand = null,
  activeDragHand = null,
  onHandPointerDown,
  onHandKeyDown,
}: ClockHandsProps) {
  const isHourHighlighted =
    highlightHand === 'hour' || highlightHand === 'both' || activeDragHand === 'hour';
  const isMinuteHighlighted =
    highlightHand === 'minute' || highlightHand === 'both' || activeDragHand === 'minute';

  return (
    <g>
      {/* Hour Hand: shorter (85), thicker (11), rounded arrow silhouette */}
      <g
        data-testid="hour-hand"
        transform={`rotate(${hourAngle} ${CLOCK_CENTER} ${CLOCK_CENTER})`}
        className={activeDragHand ? undefined : 'transition-transform duration-75 ease-out'}
        tabIndex={interactive ? 0 : undefined}
        role={interactive ? 'slider' : undefined}
        aria-label={interactive ? 'Hour hand' : undefined}
        aria-valuemin={interactive ? 1 : undefined}
        aria-valuemax={interactive ? 12 : undefined}
        aria-valuenow={interactive ? time.hours : undefined}
        aria-valuetext={interactive ? `${time.hours} o'clock` : undefined}
        onKeyDown={interactive && onHandKeyDown ? (e) => onHandKeyDown('hour', e) : undefined}
      >
        {isHourHighlighted && (
          <line
            x1={CLOCK_CENTER}
            y1={CLOCK_CENTER + 10}
            x2={CLOCK_CENTER}
            y2={CLOCK_CENTER - 86}
            stroke="var(--color-hour)"
            strokeOpacity={0.28}
            strokeWidth={22}
            strokeLinecap="round"
          />
        )}
        <line
          x1={CLOCK_CENTER}
          y1={CLOCK_CENTER + 12}
          x2={CLOCK_CENTER}
          y2={CLOCK_CENTER - 74}
          stroke="var(--color-hour)"
          strokeWidth={11}
          strokeLinecap="round"
        />
        <polygon
          points={`${CLOCK_CENTER},${CLOCK_CENTER - 90} ${CLOCK_CENTER - 10},${CLOCK_CENTER - 68} ${CLOCK_CENTER + 10},${CLOCK_CENTER - 68}`}
          fill="var(--color-hour)"
        />
        {showHandLabels && (
          <g transform={`translate(${CLOCK_CENTER}, ${CLOCK_CENTER - 46})`}>
            <circle r={11} fill="#ffffff" stroke="var(--color-hour)" strokeWidth={2.5} />
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={11}
              fontWeight={800}
              fill="var(--color-hour-dark)"
              transform={`rotate(${-hourAngle})`}
            >
              H
            </text>
          </g>
        )}
      </g>

      {/* Minute Hand: longer (132), slimmer (6), sharp spear tip */}
      <g
        data-testid="minute-hand"
        transform={`rotate(${minuteAngle} ${CLOCK_CENTER} ${CLOCK_CENTER})`}
        className={activeDragHand ? undefined : 'transition-transform duration-75 ease-out'}
        tabIndex={interactive ? 0 : undefined}
        role={interactive ? 'slider' : undefined}
        aria-label={interactive ? 'Minute hand' : undefined}
        aria-valuemin={interactive ? 0 : undefined}
        aria-valuemax={interactive ? 59 : undefined}
        aria-valuenow={interactive ? time.minutes : undefined}
        aria-valuetext={interactive ? `${time.minutes} minutes` : undefined}
        onKeyDown={interactive && onHandKeyDown ? (e) => onHandKeyDown('minute', e) : undefined}
      >
        {isMinuteHighlighted && (
          <line
            x1={CLOCK_CENTER}
            y1={CLOCK_CENTER + 14}
            x2={CLOCK_CENTER}
            y2={CLOCK_CENTER - 134}
            stroke="var(--color-minute)"
            strokeOpacity={0.28}
            strokeWidth={18}
            strokeLinecap="round"
          />
        )}
        <line
          x1={CLOCK_CENTER}
          y1={CLOCK_CENTER + 16}
          x2={CLOCK_CENTER}
          y2={CLOCK_CENTER - 118}
          stroke="var(--color-minute)"
          strokeWidth={6}
          strokeLinecap="round"
        />
        <polygon
          points={`${CLOCK_CENTER},${CLOCK_CENTER - 136} ${CLOCK_CENTER - 7},${CLOCK_CENTER - 112} ${CLOCK_CENTER + 7},${CLOCK_CENTER - 112}`}
          fill="var(--color-minute)"
        />
        {showHandLabels && (
          <g transform={`translate(${CLOCK_CENTER}, ${CLOCK_CENTER - 86})`}>
            <circle r={11} fill="#ffffff" stroke="var(--color-minute)" strokeWidth={2.5} />
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={11}
              fontWeight={800}
              fill="var(--color-minute-dark)"
              transform={`rotate(${-minuteAngle})`}
            >
              M
            </text>
          </g>
        )}
      </g>

      {/* Wide invisible hit targets for touch/mouse dragging (>= 32 SVG units) */}
      {interactive && onHandPointerDown && (
        <g>
          <line
            data-testid="minute-hit-target"
            x1={CLOCK_CENTER}
            y1={CLOCK_CENTER - 18}
            x2={CLOCK_CENTER}
            y2={CLOCK_CENTER - 142}
            stroke="transparent"
            strokeWidth={34}
            strokeLinecap="round"
            transform={`rotate(${minuteAngle} ${CLOCK_CENTER} ${CLOCK_CENTER})`}
            style={{ cursor: activeDragHand === 'minute' ? 'grabbing' : 'grab' }}
            onPointerDown={(e) => onHandPointerDown('minute', e)}
          />
          <line
            data-testid="hour-hit-target"
            x1={CLOCK_CENTER}
            y1={CLOCK_CENTER - 18}
            x2={CLOCK_CENTER}
            y2={CLOCK_CENTER - 86}
            stroke="transparent"
            strokeWidth={36}
            strokeLinecap="round"
            transform={`rotate(${hourAngle} ${CLOCK_CENTER} ${CLOCK_CENTER})`}
            style={{ cursor: activeDragHand === 'hour' ? 'grabbing' : 'grab' }}
            onPointerDown={(e) => onHandPointerDown('hour', e)}
          />
        </g>
      )}

      {/* Center Pivot Cap */}
      <circle
        cx={CLOCK_CENTER}
        cy={CLOCK_CENTER}
        r={10}
        fill="var(--color-ink)"
        stroke="#ffffff"
        strokeWidth={3}
      />
    </g>
  );
}
