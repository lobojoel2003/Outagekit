import {
  findDevice,
  findPowerSource,
  displayName,
  settingOf,
  type CatalogDevice,
  type CatalogPowerSource,
} from '@outagekit/runtime';
import { newId } from './ids';
import type { AppState, DeviceEntry, Profile, Settings, SourceEntry } from './types';

export function deviceFromCatalog(device: CatalogDevice, settingId?: string): DeviceEntry {
  const setting = settingOf(device, settingId);
  return {
    uid: newId('dev'),
    catalogId: device.id,
    name: displayName(device),
    category: device.category,
    settingId: setting.id,
    watts: setting.watts,
    dutyCycle: device.dutyCycle,
    idleWatts: device.idleWatts,
    surgeWatts: device.surgeWatts,
    quantity: 1,
    supply: device.supply,
    priority: device.priority,
    enabled: true,
  };
}

export function customDevice(partial: Partial<DeviceEntry> = {}): DeviceEntry {
  return {
    uid: newId('dev'),
    catalogId: null,
    name: 'My device',
    category: 'other',
    settingId: null,
    watts: 50,
    dutyCycle: 1,
    idleWatts: 0,
    surgeWatts: null,
    quantity: 1,
    supply: 'ac',
    priority: 'essential',
    enabled: true,
    ...partial,
  };
}

export function sourceFromCatalogEntry(
  item: CatalogPowerSource,
  now: Date = new Date(),
): SourceEntry {
  return {
    uid: newId('src'),
    catalogId: item.id,
    name: displayName(item),
    kind: item.kind,
    capacityWh: item.capacityWh,
    chemistry: item.chemistry,
    acOutputWatts: item.acOutputWatts,
    acSurgeWatts: item.acSurgeWatts,
    cycleLifeTo80: item.cycleLifeTo80,
    chargedTo: 1,
    lastChargedAt: now.toISOString(),
    ageYears: 0,
    cycles: 0,
  };
}

export function customSource(
  now: Date = new Date(),
  partial: Partial<SourceEntry> = {},
): SourceEntry {
  return {
    uid: newId('src'),
    catalogId: null,
    name: 'My battery',
    kind: 'power-station',
    capacityWh: 1000,
    chemistry: 'lifepo4',
    acOutputWatts: 1000,
    acSurgeWatts: null,
    cycleLifeTo80: null,
    chargedTo: 1,
    lastChargedAt: now.toISOString(),
    ageYears: 0,
    cycles: 0,
    ...partial,
  };
}

export function emptyProfile(): Profile {
  return {
    personName: '',
    address: '',
    phone: '',
    medicalNote: '',
    equipmentLocation: '',
    utilityName: '',
    utilityPhone: '',
    utilityAccount: '',
    contacts: [],
    destinations: [],
    oxygen: null,
    extraNotes: '',
  };
}

export function defaultSettings(): Settings {
  return {
    temperatureC: 20,
    temperatureUnit: 'F',
    marginMinutes: 60,
    reminderIntervalDays: 30,
    remindersEnabled: false,
    paper: 'letter',
  };
}

/** Catalog ids used for the example setup, with fallbacks if an id changes. */
const EXAMPLE_DEVICES: Array<{
  ids: string[];
  setting?: string;
}> = [
  { ids: ['inogen-at-home', 'generic-oxygen-concentrator-5l'], setting: '2-lpm' },
  { ids: ['resmed-airsense-10', 'generic-cpap'] },
  { ids: ['generic-refrigerator-full-size'] },
  { ids: ['generic-wifi-router-modem'] },
  { ids: ['generic-phone-charger'] },
  { ids: ['generic-led-bulb'] },
];

// A generic battery keeps the example neutral between brands.
const EXAMPLE_SOURCES = [
  'generic-2kwh-lifepo4-power-station',
  'generic-1kwh-lifepo4-power-station',
];

function firstDevice(ids: string[]): CatalogDevice | undefined {
  for (const id of ids) {
    const device = findDevice(id);
    if (device) return device;
  }
  return undefined;
}

/** A realistic starting point so the dial shows something on first open. */
export function exampleState(now: Date = new Date()): AppState {
  const devices: DeviceEntry[] = [];
  for (const example of EXAMPLE_DEVICES) {
    const device = firstDevice(example.ids);
    if (device) devices.push(deviceFromCatalog(device, example.setting));
  }
  const sourceItem = EXAMPLE_SOURCES.map((id) => findPowerSource(id)).find(Boolean);
  const sources = sourceItem ? [sourceFromCatalogEntry(sourceItem, now)] : [customSource(now)];

  return {
    schemaVersion: 1,
    devices,
    sources,
    profile: emptyProfile(),
    settings: defaultSettings(),
    outage: null,
    isExample: true,
    cardUpdatedAt: null,
  };
}

export function emptyState(now: Date = new Date()): AppState {
  return {
    ...exampleState(now),
    devices: [],
    sources: [customSource(now)],
    isExample: false,
  };
}
