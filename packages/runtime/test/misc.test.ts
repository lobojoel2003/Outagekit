import { describe, expect, it } from 'vitest';
import {
  OXYGEN_CYLINDER_LITRES,
  ampHoursToWattHours,
  celsiusToFahrenheit,
  chargeReminder,
  daysBetween,
  estimateStoredCharge,
  fahrenheitToCelsius,
  formatDuration,
  oxygenCylinderHours,
  rechargeHours,
  recommendedCheckIntervalDays,
  splitDuration,
  voltAmpsToWatts,
  wattHoursToAmpHours,
  wattsFromVoltsAmps,
} from '../src/index.js';

describe('formatDuration', () => {
  it('reads like the dial', () => {
    expect(formatDuration(7 + 20 / 60)).toBe('7 hours 20 minutes');
    expect(formatDuration(1)).toBe('1 hour');
    expect(formatDuration(1 + 1 / 60, 'long', { stepMinutes: 1 })).toBe('1 hour 1 minute');
    expect(formatDuration(0.75)).toBe('45 minutes');
  });

  it('rounds down to 5 minutes above an hour and to the minute below', () => {
    expect(formatDuration(2 + 59 / 60)).toBe('2 hours 55 minutes');
    expect(formatDuration(59.9 / 60)).toBe('59 minutes');
  });

  it('drops minutes beyond a day', () => {
    expect(formatDuration(51.5)).toBe('2 days 3 hours');
    expect(formatDuration(24)).toBe('1 day');
    expect(formatDuration(25.5, 'short')).toBe('1 d 1 h');
  });

  it('has a short and a clock style', () => {
    expect(formatDuration(7 + 20 / 60, 'short')).toBe('7 h 20 min');
    expect(formatDuration(7 + 20 / 60, 'clock')).toBe('7:20');
    expect(formatDuration(51, 'clock')).toBe('51:00');
    expect(formatDuration(0.05, 'clock')).toBe('0:03');
  });

  it('handles edge cases', () => {
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('no limit');
    expect(formatDuration(Number.POSITIVE_INFINITY, 'clock')).toBe('∞');
    expect(formatDuration(0)).toBe('0 minutes');
    expect(formatDuration(0, 'short')).toBe('0 min');
    expect(formatDuration(-2)).toBe('0 minutes');
    expect(formatDuration(Number.NaN)).toBe('0 minutes');
    expect(formatDuration(0.01)).toBe('under 1 minute');
    expect(formatDuration(0.01, 'short')).toBe('<1 min');
  });

  it('splits into parts', () => {
    expect(splitDuration(26.25)).toEqual({ days: 1, hours: 2, minutes: 15, totalMinutes: 1575 });
    expect(splitDuration(2, { stepMinutes: 30 }).totalMinutes).toBe(120);
  });
});

describe('charge helpers', () => {
  it('measures days between dates', () => {
    expect(daysBetween('2026-01-01T00:00:00Z', '2026-01-31T00:00:00Z')).toBe(30);
    expect(daysBetween('2026-01-31', '2026-01-01')).toBe(0);
    expect(() => daysBetween('not a date', new Date())).toThrow(RangeError);
  });

  it('estimates stored charge from self-discharge', () => {
    expect(estimateStoredCharge({ chemistry: 'lifepo4', daysSinceCharge: 0 })).toBe(1);
    expect(estimateStoredCharge({ chemistry: 'lifepo4', daysSinceCharge: 30.44 * 3 })).toBeCloseTo(
      0.91,
      10,
    );
    expect(
      estimateStoredCharge({ chemistry: 'flooded', chargedTo: 0.8, daysSinceCharge: 30.44 }),
    ).toBeCloseTo(0.75, 10);
    expect(estimateStoredCharge({ chemistry: 'agm', daysSinceCharge: 99999 })).toBe(0);
    expect(estimateStoredCharge({ chemistry: 'agm', daysSinceCharge: -5 })).toBe(1);
  });

  it('suggests check intervals by chemistry', () => {
    expect(recommendedCheckIntervalDays('lifepo4')).toBe(90);
    expect(recommendedCheckIntervalDays('agm')).toBe(30);
  });

  it('works out when the next charge is due', () => {
    const r = chargeReminder({
      lastChargedAt: '2026-10-01T12:00:00Z',
      intervalDays: 30,
      now: '2026-10-21T12:00:00Z',
    });
    expect(r.dueAt.toISOString()).toBe('2026-10-31T12:00:00.000Z');
    expect(r.daysUntilDue).toBeCloseTo(10, 10);
    expect(r.overdue).toBe(false);
    const late = chargeReminder({
      lastChargedAt: new Date('2026-01-01'),
      intervalDays: 0,
      now: Date.parse('2026-01-03'),
    });
    expect(late.overdue).toBe(true);
    expect(late.daysUntilDue).toBeCloseTo(-1, 10);
  });

  it('defaults now to the current time', () => {
    expect(chargeReminder({ lastChargedAt: Date.now(), intervalDays: 30 }).overdue).toBe(false);
  });

  it('estimates recharge time', () => {
    expect(rechargeHours(1020, 600)).toBeCloseTo(2, 10);
    expect(rechargeHours(1000, 500, 0.5, 1)).toBeCloseTo(500 / 425, 10);
    expect(rechargeHours(1000, 0)).toBe(Number.POSITIVE_INFINITY);
    expect(rechargeHours(1000, 100, 1, 0.5)).toBe(0);
  });
});

describe('oxygenCylinderHours', () => {
  it('uses standard sizes', () => {
    expect(OXYGEN_CYLINDER_LITRES.E).toBe(680);
    // 680 L x 0.9 / 2 L/min = 306 min.
    expect(oxygenCylinderHours({ cylinder: 'E', flowLpm: 2 })).toBeCloseTo(5.1, 10);
    expect(
      oxygenCylinderHours({ cylinder: 'D', flowLpm: 2, count: 2, reserveFraction: 0 }),
    ).toBeCloseTo((425 * 2) / 120, 10);
  });

  it('accepts custom litres and a conserver', () => {
    expect(
      oxygenCylinderHours({ cylinder: 600, flowLpm: 2, conserverRatio: 3, reserveFraction: 0 }),
    ).toBe(15);
    expect(
      oxygenCylinderHours({ cylinder: 600, flowLpm: 2, conserverRatio: 0.2, reserveFraction: 2 }),
    ).toBe(0);
  });

  it('has no limit at zero flow', () => {
    expect(oxygenCylinderHours({ cylinder: 'E', flowLpm: 0 })).toBe(Number.POSITIVE_INFINITY);
    expect(oxygenCylinderHours({ cylinder: 'E', flowLpm: 2, count: -1 })).toBe(0);
  });
});

describe('units', () => {
  it('converts battery ratings', () => {
    expect(ampHoursToWattHours(100, 12.8)).toBeCloseTo(1280, 10);
    expect(ampHoursToWattHours(-1, 12)).toBe(0);
    expect(wattHoursToAmpHours(1200, 12)).toBe(100);
    expect(wattHoursToAmpHours(1200, 0)).toBe(0);
  });

  it('converts electrical ratings', () => {
    expect(voltAmpsToWatts(100)).toBe(90);
    expect(voltAmpsToWatts(100, 2)).toBe(100);
    expect(wattsFromVoltsAmps(120, 2.5)).toBe(300);
  });

  it('converts temperatures', () => {
    expect(celsiusToFahrenheit(0)).toBe(32);
    expect(celsiusToFahrenheit(-40)).toBe(-40);
    expect(fahrenheitToCelsius(212)).toBe(100);
  });
});
