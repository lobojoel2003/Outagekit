import { celsiusToFahrenheit, formatDuration } from '@outagekit/runtime';

export { formatDuration };

/** "3:40 AM", with the weekday when it is not today: "Thu 3:40 AM". */
export function formatClock(date: Date, now: Date = new Date()): string {
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return time;
  const days = (date.getTime() - now.getTime()) / 86_400_000;
  if (days > 0 && days < 6.5) {
    const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
    return `${weekday} ${time}`;
  }
  return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${time}`;
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatWatts(watts: number): string {
  if (!Number.isFinite(watts)) return '—';
  const rounded = watts >= 100 ? Math.round(watts) : Math.round(watts * 10) / 10;
  return `${rounded.toLocaleString('en-US')} W`;
}

export function formatWh(wh: number): string {
  return `${Math.round(wh).toLocaleString('en-US')} Wh`;
}

export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

export function formatTemperature(celsius: number, unit: 'C' | 'F'): string {
  const value = unit === 'F' ? celsiusToFahrenheit(celsius) : celsius;
  return `${Math.round(value)} °${unit}`;
}

/** Big two-part dial reading: "7 h" + "20 min". */
export function dialParts(hours: number): { main: string; sub: string } {
  if (!Number.isFinite(hours)) return { main: '—', sub: '' };
  const short = formatDuration(hours, 'short');
  const [first, ...rest] = short.split(/(?<=[hd]) /);
  return { main: first ?? short, sub: rest.join(' ') };
}

export type Tone = 'good' | 'warn' | 'danger' | 'idle';

/** Colour of the dial: red under 3 hours, amber under 8, green beyond. */
export function toneFor(hours: number): Tone {
  if (!Number.isFinite(hours)) return 'idle';
  if (hours < 3) return 'danger';
  if (hours < 8) return 'warn';
  return 'good';
}
