import { averageWatts, isActive, PRIORITY_RANK } from './loads.js';
import { estimateRuntime } from './runtime.js';
import type { Conditions, Load, PowerSource, Priority } from './types.js';

export interface ShedStep {
  /** The load to switch off at this step. */
  load: Load;
  /** Average watts saved at the device by switching it off. */
  savedW: number;
  /** Runtime after this step and every step before it, in hours. */
  hoursAfter: number;
  /** Extra hours this step adds. */
  gainedHours: number;
}

export interface ShedPlan {
  /** Runtime with everything that is on now, in hours. */
  baselineHours: number;
  /** What to switch off, first to last. */
  steps: ShedStep[];
  /** Runtime with only medical and life-sustaining loads left on, in hours. */
  medicalOnlyHours: number;
  /** Runtime with only life-sustaining loads left on, in hours. */
  lifeSustainingOnlyHours: number;
}

export interface ShedOptions {
  /**
   * Priorities that may be switched off, in addition to the order they are
   * shed in. Default: `comfort` and `essential`. Medical and
   * life-sustaining devices are never suggested unless listed here.
   */
  sheddable?: readonly Priority[];
}

function withOnly(loads: readonly Load[], keep: (load: Load) => boolean): Load[] {
  return loads.map((load) => (keep(load) ? load : { ...load, enabled: false }));
}

const rank = (load: Load): number => PRIORITY_RANK[load.priority ?? 'essential'];

/**
 * Work out what to switch off first to stretch the battery.
 *
 * Least important devices go first; within a priority, the biggest average
 * draw goes first, because it buys the most time.
 */
export function planLoadShedding(
  loads: readonly Load[],
  sources: PowerSource | readonly PowerSource[],
  conditions: Conditions = {},
  options: ShedOptions = {},
): ShedPlan {
  const sheddable = new Set<Priority>(options.sheddable ?? ['comfort', 'essential']);
  const baselineHours = estimateRuntime(loads, sources, conditions).hours;

  const candidates = loads
    .filter((load) => isActive(load) && sheddable.has(load.priority ?? 'essential'))
    .map((load) => ({ load, savedW: averageWatts(load) }))
    .filter((candidate) => candidate.savedW > 0)
    .sort((a, b) => rank(a.load) - rank(b.load) || b.savedW - a.savedW);

  const off = new Set<string>();
  const steps: ShedStep[] = [];
  let previous = baselineHours;
  for (const candidate of candidates) {
    off.add(candidate.load.id);
    const hoursAfter = estimateRuntime(
      withOnly(loads, (load) => !off.has(load.id)),
      sources,
      conditions,
    ).hours;
    steps.push({
      load: candidate.load,
      savedW: candidate.savedW,
      hoursAfter,
      gainedHours: hoursAfter - previous,
    });
    previous = hoursAfter;
  }

  const medicalOnlyHours = estimateRuntime(
    withOnly(loads, (load) => rank(load) >= PRIORITY_RANK.medical),
    sources,
    conditions,
  ).hours;
  const lifeSustainingOnlyHours = estimateRuntime(
    withOnly(loads, (load) => load.priority === 'life-sustaining'),
    sources,
    conditions,
  ).hours;

  return { baselineHours, steps, medicalOnlyHours, lifeSustainingOnlyHours };
}

export interface LeaveOptions {
  /** Minutes it takes to reach the place you would go. Default 30. */
  travelMinutes?: number;
  /** Extra minutes kept in hand for delays. Default 60. */
  marginMinutes?: number;
}

/**
 * Hours after the outage starts at which you should leave, so the battery
 * still has the travel time plus a margin left when you set off.
 * Returns 0 when you should leave now and `Infinity` when there is no limit.
 */
export function leaveAfterHours(runtimeHours: number, options: LeaveOptions = {}): number {
  if (!Number.isFinite(runtimeHours)) return Number.POSITIVE_INFINITY;
  const travel = Math.max(0, options.travelMinutes ?? 30);
  const margin = Math.max(0, options.marginMinutes ?? 60);
  return Math.max(0, runtimeHours - (travel + margin) / 60);
}
