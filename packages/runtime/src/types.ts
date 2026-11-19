/**
 * How a device is powered. `ac` loads run through the power source's inverter
 * (a wall-style outlet); `dc` loads use a 12 V, USB or other DC port directly.
 */
export type Supply = 'ac' | 'dc';

/**
 * How important a device is during an outage. Used to decide what to switch
 * off first. Ordered from least to most important:
 * `comfort` < `essential` < `medical` < `life-sustaining`.
 */
export type Priority = 'comfort' | 'essential' | 'medical' | 'life-sustaining';

/** Battery cell chemistry. */
export type Chemistry = 'lifepo4' | 'nmc' | 'agm' | 'gel' | 'flooded';

/** What kind of power source this is. Affects default conversion losses. */
export type SourceKind = 'power-station' | 'battery-inverter' | 'ups';

/** A device plugged into the battery. */
export interface Load {
  id: string;
  name: string;
  /** Average draw in watts while the device is running at its current setting. */
  watts: number;
  /**
   * Fraction of the time the device spends drawing `watts`, from 0 to 1.
   * 1 means it runs continuously (an oxygen concentrator); a refrigerator
   * compressor is typically 0.3 to 0.5. Default 1.
   */
  dutyCycle?: number;
  /** Draw in watts for the rest of the time, such as standby. Default 0. */
  idleWatts?: number;
  /** Peak draw in watts for a moment at start-up (motors and compressors). */
  surgeWatts?: number;
  /** How many of this device are plugged in. Default 1. */
  quantity?: number;
  /** Default `ac`. */
  supply?: Supply;
  /** Default `essential`. */
  priority?: Priority;
  /** `false` means switched off and not counted. Default `true`. */
  enabled?: boolean;
}

/** A battery, power station or UPS that powers the loads. */
export interface PowerSource {
  id: string;
  name: string;
  /** Default `power-station`. */
  kind?: SourceKind;
  /** Nameplate capacity in watt-hours. */
  capacityWh: number;
  chemistry: Chemistry;
  /** Current charge from 0 to 1. Default 1 (full). */
  stateOfCharge?: number;
  /** Age in years since manufacture. Default 0. */
  ageYears?: number;
  /** Full charge cycles used so far. Default 0. */
  cycles?: number;
  /**
   * Measured state of health from 0 to 1, if the device reports one.
   * Overrides the age and cycle model.
   */
  stateOfHealth?: number;
  /** Manufacturer-claimed cycles until the battery holds 80% of its capacity. */
  cycleLifeTo80?: number;
  /** Continuous AC output rating of the inverter in watts. */
  acOutputWatts?: number;
  /** Short surge rating of the inverter in watts. */
  acSurgeWatts?: number;
  /** Inverter efficiency at moderate load, from 0 to 1. */
  inverterEfficiency?: number;
  /** Power the inverter uses itself whenever AC output is on, in watts. */
  inverterIdleWatts?: number;
  /** Efficiency of the DC (12 V, USB) outputs, from 0 to 1. */
  dcEfficiency?: number;
  /** Whether the source has DC outputs. Default `true` except for a UPS. */
  hasDcOutput?: boolean;
  /**
   * Fraction of the nameplate capacity that can actually be drawn before the
   * source shuts off. Defaults by chemistry.
   */
  usableFraction?: number;
}

/** Conditions that affect every source. */
export interface Conditions {
  /** Temperature of the battery in °C. Default 20. */
  temperatureC?: number;
}

export type WarningSeverity = 'info' | 'warning' | 'danger';

export type WarningCode =
  | 'no-source'
  | 'no-load'
  | 'ac-overload'
  | 'ac-surge'
  | 'no-dc-output'
  | 'low-charge'
  | 'cold'
  | 'cold-charging'
  | 'hot'
  | 'worn';

export interface RuntimeWarning {
  code: WarningCode;
  severity: WarningSeverity;
  message: string;
  sourceId?: string;
}
