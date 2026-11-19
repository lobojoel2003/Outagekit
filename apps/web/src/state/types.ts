import type { Chemistry, DeviceCategory, Priority, SourceKind, Supply } from '@outagekit/runtime';

/** A device the household has, as stored in the app. */
export interface DeviceEntry {
  uid: string;
  /** Catalog id, or null for a custom device. */
  catalogId: string | null;
  name: string;
  category: DeviceCategory;
  /** Selected catalog setting, or null for a custom device. */
  settingId: string | null;
  /** Average watts while running at the current setting. */
  watts: number;
  dutyCycle: number;
  idleWatts: number;
  surgeWatts: number | null;
  quantity: number;
  supply: Supply;
  priority: Priority;
  enabled: boolean;
}

/** A battery or power station, as stored in the app. */
export interface SourceEntry {
  uid: string;
  catalogId: string | null;
  name: string;
  kind: SourceKind;
  capacityWh: number;
  chemistry: Chemistry;
  acOutputWatts: number | null;
  acSurgeWatts: number | null;
  cycleLifeTo80: number | null;
  /** Charge level at the last top-up or reading, 0 to 1. */
  chargedTo: number;
  /** When it was last charged or read, as an ISO date-time. */
  lastChargedAt: string;
  ageYears: number;
  cycles: number;
}

export interface Contact {
  id: string;
  name: string;
  relation: string;
  phone: string;
}

export interface Destination {
  id: string;
  name: string;
  address: string;
  phone: string;
  travelMinutes: number;
}

export interface OxygenBackup {
  cylinderCount: number;
  /** D, E or a custom size in litres. */
  cylinderSize: 'D' | 'E' | 'custom';
  customLitres: number;
  flowLpm: number;
}

export interface Profile {
  personName: string;
  address: string;
  phone: string;
  /** Short medical note for responders, e.g. "COPD, on 2 L/min oxygen around the clock". */
  medicalNote: string;
  /** Where the equipment, batteries and supplies are kept. */
  equipmentLocation: string;
  utilityName: string;
  utilityPhone: string;
  utilityAccount: string;
  contacts: Contact[];
  destinations: Destination[];
  oxygen: OxygenBackup | null;
  extraNotes: string;
}

export interface Settings {
  /** Temperature where the battery is kept, °C. */
  temperatureC: number;
  temperatureUnit: 'C' | 'F';
  /** Minutes kept in hand when working out when to leave. */
  marginMinutes: number;
  /** Days between charge checks. */
  reminderIntervalDays: number;
  remindersEnabled: boolean;
  paper: 'letter' | 'a4';
}

/** An outage in progress. Remaining time is tracked as a share of the battery. */
export interface Outage {
  startedAt: string;
  /** Start of the current stretch with unchanged devices and settings. */
  segmentStartedAt: string;
  /** Share of the outage-start battery energy left at the start of the stretch, 0 to 1. */
  segmentFraction: number;
  /** Charge of each source when the outage began (or was last read), by uid. */
  chargeAtStart: Record<string, number>;
}

export interface AppState {
  schemaVersion: 1;
  devices: DeviceEntry[];
  sources: SourceEntry[];
  profile: Profile;
  settings: Settings;
  outage: Outage | null;
  /** True while the example setup has not been replaced. */
  isExample: boolean;
  /** When the plan card was last downloaded or printed. */
  cardUpdatedAt: string | null;
}
