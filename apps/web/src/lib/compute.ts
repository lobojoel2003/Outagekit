import {
  daysBetween,
  estimateRuntime,
  estimateStoredCharge,
  findDevice,
  leaveAfterHours,
  oxygenCylinderHours,
  OXYGEN_CYLINDER_LITRES,
  planLoadShedding,
  type Load,
  type PowerSource,
  type RuntimeEstimate,
  type ShedPlan,
} from '@outagekit/runtime';
import type { AppState, DeviceEntry, Destination, Outage, SourceEntry } from '../state/types';

const HOUR_MS = 3_600_000;

export function toLoad(device: DeviceEntry): Load {
  const load: Load = {
    id: device.uid,
    name: device.name,
    watts: device.watts,
    dutyCycle: device.dutyCycle,
    idleWatts: device.idleWatts,
    quantity: device.quantity,
    supply: device.supply,
    priority: device.priority,
    enabled: device.enabled,
  };
  if (device.surgeWatts !== null) load.surgeWatts = device.surgeWatts;
  return load;
}

export function toLoads(devices: readonly DeviceEntry[]): Load[] {
  return devices.map(toLoad);
}

/** Estimated charge of a source right now, allowing for self-discharge since its last top-up. */
export function currentCharge(source: SourceEntry, now: Date): number {
  let days: number;
  try {
    days = daysBetween(source.lastChargedAt, now);
  } catch {
    days = 0;
  }
  return estimateStoredCharge({
    chemistry: source.chemistry,
    chargedTo: source.chargedTo,
    daysSinceCharge: days,
  });
}

export function toSource(source: SourceEntry, stateOfCharge: number): PowerSource {
  const result: PowerSource = {
    id: source.uid,
    name: source.name,
    kind: source.kind,
    capacityWh: source.capacityWh,
    chemistry: source.chemistry,
    stateOfCharge,
    ageYears: source.ageYears,
    cycles: source.cycles,
  };
  if (source.acOutputWatts !== null) result.acOutputWatts = source.acOutputWatts;
  if (source.acSurgeWatts !== null) result.acSurgeWatts = source.acSurgeWatts;
  if (source.cycleLifeTo80 !== null) result.cycleLifeTo80 = source.cycleLifeTo80;
  return result;
}

/** Power sources at their charge now, or at outage start when an outage is running. */
export function toSources(state: AppState, now: Date): PowerSource[] {
  return state.sources.map((source) =>
    toSource(source, state.outage?.chargeAtStart[source.uid] ?? currentCharge(source, now)),
  );
}

export function primaryDestination(state: AppState): Destination | undefined {
  return state.profile.destinations[0];
}

export function travelMinutes(state: AppState): number {
  return primaryDestination(state)?.travelMinutes ?? 30;
}

/** Hours of runtime at the outage-start charge with the current setup. */
export function outageTotalHours(state: AppState, now: Date): number {
  return estimateRuntime(toLoads(state.devices), toSources(state, now), {
    temperatureC: state.settings.temperatureC,
  }).hours;
}

/** Share of the outage-start battery left right now, 0 to 1. */
export function outageFractionLeft(outage: Outage, totalHours: number, now: Date): number {
  const elapsed = Math.max(0, (now.getTime() - Date.parse(outage.segmentStartedAt)) / HOUR_MS);
  if (!Number.isFinite(totalHours)) return outage.segmentFraction;
  if (totalHours <= 0) return 0;
  return Math.max(0, outage.segmentFraction - elapsed / totalHours);
}

export interface InternalBatteryNote {
  deviceName: string;
  hours: number;
  note: string;
}

export interface Computed {
  estimate: RuntimeEstimate;
  shed: ShedPlan;
  /**
   * Hours left: from now if the power went out now, or remaining in the
   * current outage.
   */
  hours: number;
  /** Moment the battery is expected to run out, or null if there is no limit. */
  endsAt: Date | null;
  /** Moment to leave for the place you would go, or null if there is no limit. */
  leaveAt: Date | null;
  /** Hours after the outage starts to leave (planning view). */
  leaveAfterHours: number;
  travelMinutes: number;
  inOutage: boolean;
  /** Hours since the outage started. */
  outageElapsedHours: number;
  /** Share of the battery left during an outage, 0 to 1. */
  fractionLeft: number;
  /** Hours the oxygen cylinders last, or null if none are recorded. */
  oxygenHours: number | null;
  /** Medical devices with their own batteries. */
  internalBatteries: InternalBatteryNote[];
  hasLifeSustaining: boolean;
}

export function oxygenHours(state: AppState): number | null {
  const oxygen = state.profile.oxygen;
  if (!oxygen || oxygen.cylinderCount <= 0 || oxygen.flowLpm <= 0) return null;
  const litres =
    oxygen.cylinderSize === 'custom'
      ? oxygen.customLitres
      : OXYGEN_CYLINDER_LITRES[oxygen.cylinderSize];
  return oxygenCylinderHours({
    cylinder: litres,
    flowLpm: oxygen.flowLpm,
    count: oxygen.cylinderCount,
  });
}

export function internalBatteries(devices: readonly DeviceEntry[]): InternalBatteryNote[] {
  const notes: InternalBatteryNote[] = [];
  for (const device of devices) {
    if (!device.enabled || !device.catalogId) continue;
    const battery = findDevice(device.catalogId)?.internalBattery;
    if (battery) notes.push({ deviceName: device.name, hours: battery.hours, note: battery.note });
  }
  return notes;
}

export function compute(state: AppState, now: Date): Computed {
  const loads = toLoads(state.devices);
  const sources = toSources(state, now);
  const conditions = { temperatureC: state.settings.temperatureC };
  const estimate = estimateRuntime(loads, sources, conditions);
  const shed = planLoadShedding(loads, sources, conditions);
  const travel = travelMinutes(state);
  const margin = state.settings.marginMinutes;
  const leaveAfter = leaveAfterHours(estimate.hours, {
    travelMinutes: travel,
    marginMinutes: margin,
  });

  let hours = estimate.hours;
  let fractionLeft = 1;
  let outageElapsedHours = 0;
  if (state.outage) {
    fractionLeft = outageFractionLeft(state.outage, estimate.hours, now);
    hours = Number.isFinite(estimate.hours) ? fractionLeft * estimate.hours : estimate.hours;
    outageElapsedHours = Math.max(
      0,
      (now.getTime() - Date.parse(state.outage.startedAt)) / HOUR_MS,
    );
  }

  const finite = Number.isFinite(hours);
  const endsAt = finite ? new Date(now.getTime() + hours * HOUR_MS) : null;
  const leaveIn = leaveAfterHours(hours, { travelMinutes: travel, marginMinutes: margin });
  const leaveAt = finite ? new Date(now.getTime() + leaveIn * HOUR_MS) : null;

  return {
    estimate,
    shed,
    hours,
    endsAt,
    leaveAt,
    leaveAfterHours: leaveAfter,
    travelMinutes: travel,
    inOutage: state.outage !== null,
    outageElapsedHours,
    fractionLeft,
    oxygenHours: oxygenHours(state),
    internalBatteries: internalBatteries(state.devices),
    hasLifeSustaining: estimate.loads.hasLifeSustaining,
  };
}
