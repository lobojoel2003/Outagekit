import { formatDuration } from '@outagekit/runtime';
import { dialParts, formatClock, toneFor } from '../lib/format';

interface DialProps {
  hours: number;
  endsAt: Date | null;
  now: Date;
  /** "planning" shows how long the setup runs; "outage" shows time left. */
  mode: 'planning' | 'outage';
  /** Optional marker for when to leave, in hours from now. */
  leaveInHours?: number | null;
}

const SIZE = 320;
const CENTER = SIZE / 2;
const RADIUS = 134;
const STROKE = 22;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const INNER_RADIUS = RADIUS - STROKE - 6;
const INNER_CIRCUMFERENCE = 2 * Math.PI * INNER_RADIUS;

function point(fraction: number, radius: number): { x: number; y: number } {
  const angle = fraction * 2 * Math.PI - Math.PI / 2;
  return { x: CENTER + radius * Math.cos(angle), y: CENTER + radius * Math.sin(angle) };
}

/**
 * A 24-hour dial. The arc starts at the top (now) and sweeps clockwise for
 * as long as the battery lasts; past a day, an inner ring shows the extra.
 */
export function Dial({ hours, endsAt, now, mode, leaveInHours }: DialProps) {
  const finite = Number.isFinite(hours);
  const tone = toneFor(hours);
  const fraction = finite ? Math.min(1, Math.max(0, hours / 24)) : 0;
  const extra = finite && hours > 24 ? Math.min(1, (hours - 24) / 24) : 0;
  const end = point(fraction, RADIUS);
  const parts = dialParts(hours);
  const caption = mode === 'outage' ? 'Time left' : 'Your setup runs';
  const spoken = finite
    ? `${mode === 'outage' ? 'Time left' : 'Your setup runs'} ${formatDuration(hours)}${
        endsAt ? `, until ${formatClock(endsAt, now)}` : ''
      }`
    : 'Add a device and a battery to see how long your setup runs';
  const leaveFraction =
    leaveInHours !== null &&
    leaveInHours !== undefined &&
    Number.isFinite(leaveInHours) &&
    leaveInHours < 24
      ? Math.max(0, leaveInHours / 24)
      : null;
  const leavePoint = leaveFraction !== null ? point(leaveFraction, RADIUS) : null;

  const ticks = Array.from({ length: 24 }, (_, hour) => {
    const major = hour % 6 === 0;
    const outer = point(hour / 24, RADIUS - STROKE / 2 - 4);
    const inner = point(hour / 24, RADIUS - STROKE / 2 - (major ? 14 : 9));
    return (
      <line
        key={hour}
        x1={outer.x}
        y1={outer.y}
        x2={inner.x}
        y2={inner.y}
        className={major ? 'dial-tick dial-tick-major' : 'dial-tick'}
      />
    );
  });

  const labels = [6, 12, 18].map((hour) => {
    const p = point(hour / 24, RADIUS - STROKE / 2 - 28);
    return (
      <text
        key={hour}
        x={p.x}
        y={p.y}
        className="dial-hour"
        textAnchor="middle"
        dominantBaseline="central"
      >
        {hour}h
      </text>
    );
  });

  return (
    <figure className={`dial dial-${tone}`} role="img" aria-label={spoken} data-testid="dial">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true" focusable="false">
        <circle cx={CENTER} cy={CENTER} r={RADIUS} className="dial-track" strokeWidth={STROKE} />
        {ticks}
        {labels}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          className="dial-arc"
          strokeWidth={STROKE}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
          transform={`rotate(-90 ${CENTER} ${CENTER})`}
          style={{ opacity: fraction > 0 ? 1 : 0 }}
        />
        {extra > 0 && (
          <circle
            cx={CENTER}
            cy={CENTER}
            r={INNER_RADIUS}
            className="dial-arc dial-arc-extra"
            strokeWidth={6}
            strokeDasharray={INNER_CIRCUMFERENCE}
            strokeDashoffset={INNER_CIRCUMFERENCE * (1 - extra)}
            transform={`rotate(-90 ${CENTER} ${CENTER})`}
          />
        )}
        {leavePoint && (
          <g className="dial-leave">
            <circle cx={leavePoint.x} cy={leavePoint.y} r={7} />
          </g>
        )}
        {fraction > 0 && fraction < 1 && (
          <circle cx={end.x} cy={end.y} r={STROKE / 2 + 3} className="dial-end" />
        )}
        <circle cx={CENTER} cy={CENTER - RADIUS} r={4} className="dial-now" />
      </svg>
      <figcaption className="dial-readout" aria-hidden="true">
        <span className="dial-caption">{caption}</span>
        <span className="dial-main" data-testid="dial-main">
          {parts.main}
        </span>
        {parts.sub && <span className="dial-sub">{parts.sub}</span>}
        {endsAt && finite && <span className="dial-until">until {formatClock(endsAt, now)}</span>}
        {extra > 0 && <span className="dial-until">more than a day</span>}
      </figcaption>
    </figure>
  );
}
