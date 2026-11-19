import {
  chemistryProfile,
  clamp,
  peukertFactor,
  stateOfHealth,
  temperatureFactor,
} from './chemistry.js';
import { nonNegative, summarizeLoads, type LoadSummary } from './loads.js';
import type { Conditions, Load, PowerSource, RuntimeWarning, SourceKind } from './types.js';

/** Default temperature of the battery, in °C, when none is given. */
export const DEFAULT_TEMPERATURE_C = 20;

/** Efficiency of a DC device's own AC adapter, used when a source has no DC outputs. */
export const DC_ADAPTER_EFFICIENCY = 0.85;

interface KindDefaults {
  inverterEfficiency: number;
  dcEfficiency: number;
  hasDcOutput: boolean;
  /** Inverter self-consumption as a share of its continuous rating. */
  idleShare: number;
  /** Smallest self-consumption, in watts. */
  minIdleW: number;
  /** Self-consumption when the rating is unknown, in watts. */
  unknownIdleW: number;
}

export const SOURCE_KIND_DEFAULTS: Readonly<Record<SourceKind, KindDefaults>> = {
  'power-station': {
    inverterEfficiency: 0.9,
    dcEfficiency: 0.92,
    hasDcOutput: true,
    idleShare: 0.006,
    minIdleW: 5,
    unknownIdleW: 10,
  },
  'battery-inverter': {
    inverterEfficiency: 0.88,
    dcEfficiency: 0.95,
    hasDcOutput: true,
    idleShare: 0.01,
    minIdleW: 6,
    unknownIdleW: 12,
  },
  ups: {
    inverterEfficiency: 0.8,
    dcEfficiency: 0.8,
    hasDcOutput: false,
    idleShare: 0.012,
    minIdleW: 8,
    unknownIdleW: 15,
  },
};

/** A power source with every default filled in. */
export interface ResolvedSource {
  id: string;
  name: string;
  kind: SourceKind;
  capacityWh: number;
  chemistry: PowerSource['chemistry'];
  stateOfCharge: number;
  health: number;
  usableFraction: number;
  acOutputWatts: number | undefined;
  acSurgeWatts: number | undefined;
  inverterEfficiency: number;
  inverterIdleWatts: number;
  dcEfficiency: number;
  hasDcOutput: boolean;
}

function efficiency(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? clamp(value, 0.05, 1)
    : fallback;
}

export function resolveSource(source: PowerSource): ResolvedSource {
  const kind = source.kind ?? 'power-station';
  const defaults = SOURCE_KIND_DEFAULTS[kind];
  const profile = chemistryProfile(source.chemistry);
  const rating = nonNegative(source.acOutputWatts) || undefined;
  const surge = nonNegative(source.acSurgeWatts) || undefined;
  const idle =
    source.inverterIdleWatts !== undefined && Number.isFinite(source.inverterIdleWatts)
      ? nonNegative(source.inverterIdleWatts)
      : rating
        ? Math.max(defaults.minIdleW, rating * defaults.idleShare)
        : defaults.unknownIdleW;

  return {
    id: source.id,
    name: source.name,
    kind,
    capacityWh: nonNegative(source.capacityWh),
    chemistry: source.chemistry,
    stateOfCharge:
      source.stateOfCharge === undefined ? 1 : clamp(nonNegative(source.stateOfCharge), 0, 1),
    health: stateOfHealth(source),
    usableFraction:
      source.usableFraction === undefined
        ? profile.usableFraction
        : clamp(nonNegative(source.usableFraction), 0, 1),
    acOutputWatts: rating,
    acSurgeWatts: surge,
    inverterEfficiency: efficiency(source.inverterEfficiency, defaults.inverterEfficiency),
    inverterIdleWatts: idle,
    dcEfficiency: efficiency(source.dcEfficiency, defaults.dcEfficiency),
    hasDcOutput: source.hasDcOutput ?? defaults.hasDcOutput,
  };
}

/** How one power source performs with the given loads. */
export interface SourceRuntime {
  sourceId: string;
  name: string;
  /** Hours this source alone runs the loads. `Infinity` when there is no load. */
  hours: number;
  /** Nameplate capacity, in watt-hours. */
  nameplateWh: number;
  stateOfCharge: number;
  usableFraction: number;
  health: number;
  temperatureFactor: number;
  peukertFactor: number;
  /** Energy that will actually reach the outputs, in watt-hours. */
  usableWh: number;
  /** AC load at the devices, in watts. */
  acLoadW: number;
  /** DC load at the devices, in watts. */
  dcLoadW: number;
  /** Power the inverter uses itself, in watts. */
  inverterIdleW: number;
  /** Power lost converting battery power for the devices, excluding inverter idle, in watts. */
  conversionLossW: number;
  /** Total power drawn from the battery, in watts. */
  drawW: number;
}

export interface RuntimeEstimate {
  /**
   * Total hours the loads run, using each source one after another.
   * `Infinity` when nothing draws power; 0 when there is no source.
   */
  hours: number;
  loads: LoadSummary;
  sources: SourceRuntime[];
  warnings: RuntimeWarning[];
}

function percent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

function watts(value: number): string {
  return `${Math.round(value).toLocaleString('en-US')} W`;
}

/** Runtime of one source with a set of loads. */
export function estimateSourceRuntime(
  loads: LoadSummary,
  source: PowerSource,
  conditions: Conditions = {},
): SourceRuntime {
  const resolved = resolveSource(source);
  const temperatureC = conditions.temperatureC ?? DEFAULT_TEMPERATURE_C;

  let acLoadW = loads.acAverageW;
  let dcLoadW = loads.dcAverageW;
  if (!resolved.hasDcOutput && dcLoadW > 0) {
    acLoadW += dcLoadW / DC_ADAPTER_EFFICIENCY;
    dcLoadW = 0;
  }

  const inverterIdleW = acLoadW > 0 ? resolved.inverterIdleWatts : 0;
  const acDrawW = acLoadW > 0 ? inverterIdleW + acLoadW / resolved.inverterEfficiency : 0;
  const dcDrawW = dcLoadW > 0 ? dcLoadW / resolved.dcEfficiency : 0;
  const drawW = acDrawW + dcDrawW;
  const conversionLossW = Math.max(0, drawW - inverterIdleW - loads.totalAverageW);

  const tempFactor = temperatureFactor(resolved.chemistry, temperatureC);
  const peukert = peukertFactor(resolved.chemistry, resolved.capacityWh, drawW);
  const usableWh =
    resolved.capacityWh *
    resolved.stateOfCharge *
    resolved.usableFraction *
    resolved.health *
    tempFactor *
    peukert;

  return {
    sourceId: resolved.id,
    name: resolved.name,
    hours: drawW > 0 ? usableWh / drawW : Number.POSITIVE_INFINITY,
    nameplateWh: resolved.capacityWh,
    stateOfCharge: resolved.stateOfCharge,
    usableFraction: resolved.usableFraction,
    health: resolved.health,
    temperatureFactor: tempFactor,
    peukertFactor: peukert,
    usableWh,
    acLoadW: loads.acAverageW,
    dcLoadW: loads.dcAverageW,
    inverterIdleW,
    conversionLossW,
    drawW,
  };
}

function sourceWarnings(
  loads: LoadSummary,
  source: PowerSource,
  runtime: SourceRuntime,
  temperatureC: number,
): RuntimeWarning[] {
  const warnings: RuntimeWarning[] = [];
  const resolved = resolveSource(source);
  const profile = chemistryProfile(resolved.chemistry);
  const sourceId = resolved.id;
  const name = resolved.name;

  if (resolved.acOutputWatts !== undefined && loads.acPeakW > resolved.acOutputWatts) {
    warnings.push({
      code: 'ac-overload',
      severity: 'danger',
      sourceId,
      message: `With everything running at once your devices can draw ${watts(loads.acPeakW)}, more than the ${watts(resolved.acOutputWatts)} ${name} can supply. It may shut off.`,
    });
  } else {
    const surgeLimit = resolved.acSurgeWatts ?? resolved.acOutputWatts;
    if (surgeLimit !== undefined && loads.acSurgeW > surgeLimit) {
      warnings.push({
        code: 'ac-surge',
        severity: 'warning',
        sourceId,
        message: `A motor or compressor starting up can briefly pull ${watts(loads.acSurgeW)}, above the ${watts(surgeLimit)} ${name} can handle. Start large devices one at a time.`,
      });
    }
  }

  if (!resolved.hasDcOutput && loads.dcAverageW > 0) {
    warnings.push({
      code: 'no-dc-output',
      severity: 'info',
      sourceId,
      message: `${name} has no 12 V or USB outputs, so DC devices are counted through their AC adapters.`,
    });
  }

  if (resolved.stateOfCharge < 0.5) {
    warnings.push({
      code: 'low-charge',
      severity: 'warning',
      sourceId,
      message: `${name} is at ${percent(resolved.stateOfCharge)}. Charge it to full while you still have power.`,
    });
  }

  if (resolved.health < 0.8) {
    warnings.push({
      code: 'worn',
      severity: 'warning',
      sourceId,
      message: `${name} holds about ${percent(resolved.health)} of its original capacity. Consider replacing it.`,
    });
  }

  if (runtime.temperatureFactor < 0.95) {
    warnings.push({
      code: 'cold',
      severity: 'info',
      sourceId,
      message: `At ${Math.round(temperatureC)} °C ${name} delivers about ${percent(runtime.temperatureFactor)} of its capacity. Keep it indoors and off cold floors.`,
    });
  }

  if (temperatureC < profile.minChargeTemperatureC) {
    warnings.push({
      code: 'cold-charging',
      severity: 'warning',
      sourceId,
      message: `${name} should not be recharged below ${profile.minChargeTemperatureC} °C. Warm it up before charging.`,
    });
  }

  if (temperatureC > 40) {
    warnings.push({
      code: 'hot',
      severity: 'warning',
      sourceId,
      message: `Above 40 °C ${name} wears out faster and may shut off to protect itself. Keep it in the shade with air around it.`,
    });
  }

  return warnings;
}

/**
 * Estimate how long a set of power sources runs a set of loads.
 *
 * Sources are used one after another (you move the plugs to the next one
 * when the first is empty), so their runtimes add up.
 *
 * @example
 * ```ts
 * const estimate = estimateRuntime(
 *   [{ id: 'o2', name: 'Oxygen concentrator', watts: 300, priority: 'life-sustaining' }],
 *   { id: 'ps', name: 'Power station', capacityWh: 1024, chemistry: 'lifepo4' },
 * );
 * formatDuration(estimate.hours); // "2 hours 50 minutes"
 * ```
 */
export function estimateRuntime(
  loads: readonly Load[],
  sources: PowerSource | readonly PowerSource[],
  conditions: Conditions = {},
): RuntimeEstimate {
  const list: readonly PowerSource[] = Array.isArray(sources) ? sources : [sources as PowerSource];
  const summary = summarizeLoads(loads);
  const temperatureC = conditions.temperatureC ?? DEFAULT_TEMPERATURE_C;
  const warnings: RuntimeWarning[] = [];

  if (list.length === 0) {
    warnings.push({
      code: 'no-source',
      severity: 'danger',
      message: 'Add the battery or power station you would use in an outage.',
    });
  }
  if (summary.totalAverageW === 0) {
    warnings.push({
      code: 'no-load',
      severity: 'info',
      message: 'Add the devices you need to keep running.',
    });
  }

  const results = list.map((source) => {
    const runtime = estimateSourceRuntime(summary, source, conditions);
    warnings.push(...sourceWarnings(summary, source, runtime, temperatureC));
    return runtime;
  });

  const hours =
    results.length === 0 ? 0 : results.reduce((total, result) => total + result.hours, 0);

  return { hours, loads: summary, sources: results, warnings };
}
