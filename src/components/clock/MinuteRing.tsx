import { CLOCK_CENTER, polarToCartesian } from '../../domain/clockMath';
import { MinuteLabelMode } from '../../domain/types';

export interface MinuteRingProps {
  mode: MinuteLabelMode;
  activeMinute?: number | null;
}

const MINUTE_LABELS = Array.from({ length: 60 }, (_, minute) => {
  const isFive = minute % 5 === 0;
  const pos = polarToCartesian(CLOCK_CENTER, CLOCK_CENTER, 179, minute * 6);
  return {
    minute,
    isFive,
    label: String(minute).padStart(2, '0'),
    x: pos.x,
    y: pos.y,
  };
});

/**
 * Renders optional 00–59 minute labels around the outer dial perimeter (r = 179)
 * without obscuring tick marks or hour numerals or altering the SVG viewBox.
 */
export function MinuteRing({ mode, activeMinute = null }: MinuteRingProps) {
  if (mode === 'none') {
    return null;
  }

  const items = mode === 'fives' ? MINUTE_LABELS.filter((m) => m.isFive) : MINUTE_LABELS;

  return (
    <g data-testid="minute-ring" aria-hidden="true">
      {items.map(({ minute, isFive, label, x, y }) => {
        const isActive = activeMinute === minute;
        return (
          <g key={minute}>
            {(isFive || isActive) && (
              <circle
                cx={x}
                cy={y}
                r={isFive ? 11 : 8.5}
                fill={isActive ? 'var(--color-minute)' : 'var(--color-minute-soft)'}
              />
            )}
            <text
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={isFive ? 11.5 : 8.5}
              fontWeight={isFive ? 800 : 600}
              fill={
                isActive
                  ? '#ffffff'
                  : isFive
                    ? 'var(--color-minute-dark)'
                    : 'var(--color-ink-muted)'
              }
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {label}
            </text>
          </g>
        );
      })}
    </g>
  );
}

