import type { Chemistry, PowerSource } from './types.js';

/**
 * Behaviour of a battery chemistry, used to derate the nameplate capacity.
 *
 * The figures are deliberately conservative, rounded values drawn from
 * typical cell data sheets. They are documented in docs/METHOD.md. When a
 * manufacturer gives a better number (cycle life, usable capacity, measured
 * state of health), pass it on the {@link PowerSource} and it wins.
 */
export interface ChemistryProfile {
  /** Human-readable name. */
  label: string;
  /** Share of nameplate capacity that can be drawn before cut-off. */
  usableFraction: number;
  /** Capacity lost per year of age, from 0 to 1. */
  calendarFadePerYear: number;
  /** Typical full cycles until the battery holds 80% of its capacity. */
  cyclesTo80: number;
  /** Charge lost per month while stored, from 0 to 1 (includes standby electronics). */
  selfDischargePerMonth: number;
  /** Peukert exponent. 1 means capacity does not drop at high discharge rates. */
  peukertExponent: number;
  /** Discharge time in hours the nameplate capacity is rated at. */
  ratedHours: number;
  /**
   * Usable capacity factor by battery temperature: pairs of [°C, factor],
   * sorted by temperature. Interpolated linearly and clamped at the ends.
   */
  temperatureCurve: ReadonlyArray<readonly [number, number]>;
  /** Lowest temperature at which the battery may be recharged, in °C. */
  minChargeTemperatureC: number;
  /** Suggested days between checking and topping up the charge. */
  checkIntervalDays: number;
  /** Whether this is a lead-acid chemistry. */
  leadAcid: boolean;
}

const LEAD_ACID_CURVE = [
  [-20, 0.5],
  [-10, 0.65],
  [0, 0.78],
  [10, 0.9],
  [20, 1],
] as const;

export const CHEMISTRY: Readonly<Record<Chemistry, ChemistryProfile>> = {
  lifepo4: {
    label: 'Lithium iron phosphate (LiFePO4)',
    usableFraction: 0.95,
    calendarFadePerYear: 0.02,
    cyclesTo80: 3000,
    selfDischargePerMonth: 0.03,
    peukertExponent: 1,
    ratedHours: 1,
    temperatureCurve: [
      [-20, 0.55],
      [-10, 0.7],
      [0, 0.82],
      [10, 0.92],
      [20, 1],
    ],
    minChargeTemperatureC: 0,
    checkIntervalDays: 90,
    leadAcid: false,
  },
  nmc: {
    label: 'Lithium-ion (NMC)',
    usableFraction: 0.95,
    calendarFadePerYear: 0.03,
    cyclesTo80: 500,
    selfDischargePerMonth: 0.03,
    peukertExponent: 1,
    ratedHours: 1,
    temperatureCurve: [
      [-20, 0.6],
      [-10, 0.74],
      [0, 0.85],
      [10, 0.94],
      [20, 1],
    ],
    minChargeTemperatureC: 0,
    checkIntervalDays: 90,
    leadAcid: false,
  },
  agm: {
    label: 'Sealed lead-acid (AGM)',
    usableFraction: 0.8,
    calendarFadePerYear: 0.05,
    cyclesTo80: 400,
    selfDischargePerMonth: 0.03,
    peukertExponent: 1.15,
    ratedHours: 20,
    temperatureCurve: LEAD_ACID_CURVE,
    minChargeTemperatureC: -20,
    checkIntervalDays: 30,
    leadAcid: true,
  },
  gel: {
    label: 'Sealed lead-acid (gel)',
    usableFraction: 0.8,
    calendarFadePerYear: 0.04,
    cyclesTo80: 500,
    selfDischargePerMonth: 0.03,
    peukertExponent: 1.12,
    ratedHours: 20,
    temperatureCurve: LEAD_ACID_CURVE,
    minChargeTemperatureC: -20,
    checkIntervalDays: 30,
    leadAcid: true,
  },
  flooded: {
    label: 'Flooded lead-acid',
    usableFraction: 0.8,
    calendarFadePerYear: 0.06,
    cyclesTo80: 300,
    selfDischargePerMonth: 0.05,
    peukertExponent: 1.25,
    ratedHours: 20,
    temperatureCurve: LEAD_ACID_CURVE,
    minChargeTemperatureC: -20,
    checkIntervalDays: 30,
    leadAcid: true,
  },
};

/** The lowest state of health the age model will report. */
export const MIN_MODELLED_HEALTH = 0.3;

export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function chemistryProfile(chemistry: Chemistry): ChemistryProfile {
  const profile = CHEMISTRY[chemistry];
  if (!profile) throw new RangeError(`Unknown battery chemistry: ${String(chemistry)}`);
  return profile;
}

/**
 * Share of original capacity the battery still holds, from 0 to 1.
 *
 * Uses a measured `stateOfHealth` when given. Otherwise adds calendar fade
 * (per year of age) to cycle fade (20% over the rated cycle life).
 */
export function stateOfHealth(
  source: Pick<
    PowerSource,
    'chemistry' | 'ageYears' | 'cycles' | 'stateOfHealth' | 'cycleLifeTo80'
  >,
): number {
  if (source.stateOfHealth !== undefined) return clamp(source.stateOfHealth, 0, 1);
  const profile = chemistryProfile(source.chemistry);
  const cycleLife =
    source.cycleLifeTo80 && source.cycleLifeTo80 > 0 ? source.cycleLifeTo80 : profile.cyclesTo80;
  const age = Math.max(0, source.ageYears ?? 0);
  const cycles = Math.max(0, source.cycles ?? 0);
  const fade = profile.calendarFadePerYear * age + (0.2 * cycles) / cycleLife;
  return clamp(1 - fade, MIN_MODELLED_HEALTH, 1);
}

/** Usable capacity factor at a battery temperature, from 0 to 1. */
export function temperatureFactor(chemistry: Chemistry, temperatureC: number): number {
  const curve = chemistryProfile(chemistry).temperatureCurve;
  const first = curve[0]!;
  const last = curve[curve.length - 1]!;
  if (temperatureC <= first[0]) return first[1];
  if (temperatureC >= last[0]) return last[1];
  for (let i = 1; i < curve.length; i++) {
    const [t1, f1] = curve[i]!;
    const [t0, f0] = curve[i - 1]!;
    if (temperatureC <= t1) {
      return f0 + ((f1 - f0) * (temperatureC - t0)) / (t1 - t0);
    }
  }
  /* c8 ignore next */
  return last[1];
}

/**
 * Capacity factor for drawing power faster than the battery's rating
 * (Peukert's law, using power in place of current at constant voltage).
 *
 * Only lead-acid batteries lose meaningful capacity this way. Lighter loads
 * than the rating return 1 rather than a bonus, to stay conservative.
 */
export function peukertFactor(chemistry: Chemistry, capacityWh: number, drawW: number): number {
  const profile = chemistryProfile(chemistry);
  if (profile.peukertExponent <= 1 || drawW <= 0 || capacityWh <= 0) return 1;
  const ratedW = capacityWh / profile.ratedHours;
  if (drawW <= ratedW) return 1;
  return (ratedW / drawW) ** (profile.peukertExponent - 1);
}
