import { describe, expect, it } from 'vitest';
import {
  averageWatts,
  dutyCycleOf,
  isActive,
  nonNegative,
  quantityOf,
  runningWatts,
  summarizeLoads,
  type Load,
} from '../src/index.js';

const load = (overrides: Partial<Load> = {}): Load => ({
  id: 'x',
  name: 'Device',
  watts: 100,
  ...overrides,
});

describe('input cleaning', () => {
  it('treats bad numbers as zero', () => {
    expect(nonNegative(undefined)).toBe(0);
    expect(nonNegative(-5)).toBe(0);
    expect(nonNegative(Number.NaN)).toBe(0);
    expect(nonNegative(Number.POSITIVE_INFINITY)).toBe(0);
    expect(nonNegative(12.5)).toBe(12.5);
  });

  it('defaults quantity to 1 and floors it', () => {
    expect(quantityOf(load())).toBe(1);
    expect(quantityOf(load({ quantity: 2.7 }))).toBe(2);
    expect(quantityOf(load({ quantity: -1 }))).toBe(0);
  });

  it('defaults and clamps duty cycle', () => {
    expect(dutyCycleOf(load())).toBe(1);
    expect(dutyCycleOf(load({ dutyCycle: 0.4 }))).toBe(0.4);
    expect(dutyCycleOf(load({ dutyCycle: 3 }))).toBe(1);
    expect(dutyCycleOf(load({ dutyCycle: -1 }))).toBe(0);
  });

  it('counts a load as active unless switched off or zero quantity', () => {
    expect(isActive(load())).toBe(true);
    expect(isActive(load({ enabled: false }))).toBe(false);
    expect(isActive(load({ quantity: 0 }))).toBe(false);
  });
});

describe('averageWatts', () => {
  it('is the running watts for a continuous load', () => {
    expect(averageWatts(load({ watts: 300 }))).toBe(300);
  });

  it('blends running and idle draw by duty cycle', () => {
    // Fridge: 150 W running 40% of the time, 2 W otherwise.
    expect(averageWatts(load({ watts: 150, dutyCycle: 0.4, idleWatts: 2 }))).toBeCloseTo(61.2, 10);
  });

  it('multiplies by quantity', () => {
    expect(averageWatts(load({ watts: 9, quantity: 3 }))).toBe(27);
  });

  it('is zero when switched off', () => {
    expect(averageWatts(load({ enabled: false }))).toBe(0);
  });

  it('reports running watts as the larger of running and idle', () => {
    expect(runningWatts(load({ watts: 150, idleWatts: 2, quantity: 2 }))).toBe(300);
    expect(runningWatts(load({ watts: 0, idleWatts: 3 }))).toBe(3);
    expect(runningWatts(load({ enabled: false }))).toBe(0);
  });
});

describe('summarizeLoads', () => {
  it('splits AC and DC and finds the peak', () => {
    const summary = summarizeLoads([
      load({ id: 'o2', watts: 300, priority: 'life-sustaining', surgeWatts: 700 }),
      load({ id: 'fridge', watts: 150, dutyCycle: 0.4, idleWatts: 2, surgeWatts: 1200 }),
      load({ id: 'phone', watts: 10, dutyCycle: 0.25, supply: 'dc' }),
      load({ id: 'off', watts: 1500, enabled: false }),
    ]);
    expect(summary.count).toBe(3);
    expect(summary.acAverageW).toBeCloseTo(361.2, 10);
    expect(summary.dcAverageW).toBeCloseTo(2.5, 10);
    expect(summary.totalAverageW).toBeCloseTo(363.7, 10);
    expect(summary.acPeakW).toBe(450);
    // Fridge start-up adds 1050 W over its running draw.
    expect(summary.acSurgeW).toBe(1500);
    expect(summary.dcPeakW).toBe(10);
    expect(summary.hasLifeSustaining).toBe(true);
  });

  it('handles an empty list', () => {
    expect(summarizeLoads([])).toEqual({
      count: 0,
      acAverageW: 0,
      dcAverageW: 0,
      totalAverageW: 0,
      acPeakW: 0,
      acSurgeW: 0,
      dcPeakW: 0,
      hasLifeSustaining: false,
    });
  });

  it('ignores surge ratings lower than running watts', () => {
    expect(summarizeLoads([load({ watts: 100, surgeWatts: 50 })]).acSurgeW).toBe(100);
  });
});
