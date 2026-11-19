import { clamp } from './chemistry.js';
import type { Load, Priority } from './types.js';

/** Rank of each priority; higher means keep running longer. */
export const PRIORITY_RANK: Readonly<Record<Priority, number>> = {
  comfort: 0,
  essential: 1,
  medical: 2,
  'life-sustaining': 3,
};

/** Treat missing, negative or non-numeric input as zero. */
export function nonNegative(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

export function quantityOf(load: Load): number {
  return load.quantity === undefined ? 1 : Math.floor(nonNegative(load.quantity));
}

/** Whether a load is switched on and counted. */
export function isActive(load: Load): boolean {
  return load.enabled !== false && quantityOf(load) > 0;
}

export function dutyCycleOf(load: Load): number {
  return load.dutyCycle === undefined ? 1 : clamp(nonNegative(load.dutyCycle), 0, 1);
}

/**
 * Average draw of a load over time, in watts, including every unit of it.
 * Returns 0 for a load that is switched off.
 */
export function averageWatts(load: Load): number {
  if (!isActive(load)) return 0;
  const duty = dutyCycleOf(load);
  const running = nonNegative(load.watts);
  const idle = nonNegative(load.idleWatts);
  return (running * duty + idle * (1 - duty)) * quantityOf(load);
}

/** Draw of a load while it is running, in watts, for every unit of it. */
export function runningWatts(load: Load): number {
  if (!isActive(load)) return 0;
  return Math.max(nonNegative(load.watts), nonNegative(load.idleWatts)) * quantityOf(load);
}

export interface LoadSummary {
  /** Number of active loads. */
  count: number;
  /** Average draw of AC loads, at the device, in watts. */
  acAverageW: number;
  /** Average draw of DC loads, at the device, in watts. */
  dcAverageW: number;
  /** Average draw of all loads, at the device, in watts. */
  totalAverageW: number;
  /** Draw if every AC load runs at the same moment, in watts. */
  acPeakW: number;
  /** Worst moment: all AC loads running while the largest motor starts, in watts. */
  acSurgeW: number;
  /** Draw if every DC load runs at the same moment, in watts. */
  dcPeakW: number;
  /** Whether any active load is life-sustaining. */
  hasLifeSustaining: boolean;
}

export function summarizeLoads(loads: readonly Load[]): LoadSummary {
  let count = 0;
  let acAverageW = 0;
  let dcAverageW = 0;
  let acPeakW = 0;
  let dcPeakW = 0;
  let largestExtraSurge = 0;
  let hasLifeSustaining = false;

  for (const load of loads) {
    if (!isActive(load)) continue;
    count++;
    if (load.priority === 'life-sustaining') hasLifeSustaining = true;
    const average = averageWatts(load);
    const running = runningWatts(load);
    if (load.supply === 'dc') {
      dcAverageW += average;
      dcPeakW += running;
    } else {
      acAverageW += average;
      acPeakW += running;
      const extra = nonNegative(load.surgeWatts) - nonNegative(load.watts);
      if (extra > largestExtraSurge) largestExtraSurge = extra;
    }
  }

  return {
    count,
    acAverageW,
    dcAverageW,
    totalAverageW: acAverageW + dcAverageW,
    acPeakW,
    acSurgeW: acPeakW + largestExtraSurge,
    dcPeakW,
    hasLifeSustaining,
  };
}
