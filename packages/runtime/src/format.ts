export interface DurationParts {
  days: number;
  hours: number;
  minutes: number;
  /** Total minutes after rounding. */
  totalMinutes: number;
}

export interface DurationOptions {
  /**
   * Minutes to round to. Default: 5 for durations of an hour or more, else 1.
   * Rounding is always down, so the figure is never more than the estimate.
   */
  stepMinutes?: number;
}

/** Split a duration in hours into days, hours and minutes, rounding down. */
export function splitDuration(hours: number, options: DurationOptions = {}): DurationParts {
  if (!Number.isFinite(hours) || hours <= 0) {
    return { days: 0, hours: 0, minutes: 0, totalMinutes: 0 };
  }
  const rawMinutes = hours * 60;
  const step = Math.max(1, options.stepMinutes ?? (rawMinutes >= 60 ? 5 : 1));
  // Guard against floating point noise such as 7.333333 h * 60 = 439.99999.
  const totalMinutes = Math.floor((rawMinutes + 1e-6) / step) * step;
  return {
    days: Math.floor(totalMinutes / 1440),
    hours: Math.floor((totalMinutes % 1440) / 60),
    minutes: totalMinutes % 60,
    totalMinutes,
  };
}

export type DurationStyle = 'long' | 'short' | 'clock';

const plural = (value: number, unit: string): string => `${value} ${unit}${value === 1 ? '' : 's'}`;

/**
 * Format a duration in hours for people to read.
 *
 * - `long` (default): "7 hours 20 minutes", "2 days 3 hours"
 * - `short`: "7 h 20 min", "2 d 3 h"
 * - `clock`: "7:20", "51:00"
 *
 * Durations longer than a day drop the minutes. `Infinity` reads as
 * "no limit"; anything under a minute reads as "under 1 minute".
 */
export function formatDuration(
  hours: number,
  style: DurationStyle = 'long',
  options: DurationOptions = {},
): string {
  if (hours === Number.POSITIVE_INFINITY) return style === 'clock' ? '∞' : 'no limit';
  const parts = splitDuration(hours, options);
  if (style === 'clock') {
    const h = parts.days * 24 + parts.hours;
    return `${h}:${String(parts.minutes).padStart(2, '0')}`;
  }
  if (parts.totalMinutes === 0) {
    if (Number.isFinite(hours) && hours > 0) return style === 'short' ? '<1 min' : 'under 1 minute';
    return style === 'short' ? '0 min' : '0 minutes';
  }
  const pieces: string[] = [];
  if (style === 'short') {
    if (parts.days) pieces.push(`${parts.days} d`);
    if (parts.hours) pieces.push(`${parts.hours} h`);
    if (parts.minutes && !parts.days) pieces.push(`${parts.minutes} min`);
  } else {
    if (parts.days) pieces.push(plural(parts.days, 'day'));
    if (parts.hours) pieces.push(plural(parts.hours, 'hour'));
    if (parts.minutes && !parts.days) pieces.push(plural(parts.minutes, 'minute'));
  }
  return pieces.join(' ');
}
