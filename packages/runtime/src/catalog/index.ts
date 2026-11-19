import devicesFile from './devices.json' with { type: 'json' };
import powerSourcesFile from './power-sources.json' with { type: 'json' };
import type { Chemistry, Load, PowerSource, Priority, SourceKind, Supply } from '../types.js';

export const DEVICE_CATEGORIES = [
  'oxygen-concentrator',
  'portable-oxygen-concentrator',
  'cpap',
  'bilevel',
  'ventilator',
  'bed',
  'mattress',
  'suction',
  'nebulizer',
  'feeding-pump',
  'infusion-pump',
  'dialysis',
  'mobility',
  'monitor',
  'refrigeration',
  'communication',
  'lighting',
  'climate',
  'other',
] as const;

export type DeviceCategory = (typeof DEVICE_CATEGORIES)[number];

export const CATEGORY_LABELS: Readonly<Record<DeviceCategory, string>> = {
  'oxygen-concentrator': 'Oxygen concentrator',
  'portable-oxygen-concentrator': 'Portable oxygen concentrator',
  cpap: 'CPAP',
  bilevel: 'Bilevel (BiPAP)',
  ventilator: 'Ventilator',
  bed: 'Powered bed',
  mattress: 'Pressure mattress',
  suction: 'Suction',
  nebulizer: 'Nebulizer',
  'feeding-pump': 'Feeding pump',
  'infusion-pump': 'Infusion pump',
  dialysis: 'Dialysis',
  mobility: 'Mobility',
  monitor: 'Monitor',
  refrigeration: 'Refrigeration',
  communication: 'Phones and internet',
  lighting: 'Lighting',
  climate: 'Heating and cooling',
  other: 'Other',
};

export interface CatalogReference {
  title: string;
  url?: string;
  publisher?: string;
}

export interface DeviceSetting {
  id: string;
  label: string;
  /** Average draw at this setting, in watts. */
  watts: number;
}

export interface CatalogDevice {
  id: string;
  name: string;
  manufacturer: string | null;
  category: DeviceCategory;
  supply: Supply;
  priority: Priority;
  settings: DeviceSetting[];
  defaultSetting: string;
  dutyCycle: number;
  idleWatts: number;
  surgeWatts: number | null;
  internalBattery: { hours: number; note: string } | null;
  notes: string;
  sources: CatalogReference[];
  /** Whether the figures were checked against a manufacturer document. */
  verified: boolean;
}

export interface CatalogPowerSource {
  id: string;
  name: string;
  manufacturer: string | null;
  kind: SourceKind;
  capacityWh: number;
  chemistry: Chemistry;
  acOutputWatts: number | null;
  acSurgeWatts: number | null;
  cycleLifeTo80: number | null;
  notes: string;
  sources: CatalogReference[];
  verified: boolean;
}

/** Common home medical devices and household loads, with their power draw. */
export const devices: readonly CatalogDevice[] = devicesFile.devices as CatalogDevice[];

/** Common power stations, batteries and UPS units. */
export const powerSources: readonly CatalogPowerSource[] =
  powerSourcesFile.powerSources as CatalogPowerSource[];

/** Date the catalog was last reviewed, as YYYY-MM-DD. */
export const catalogUpdated: string = devicesFile.updated;

export function findDevice(id: string): CatalogDevice | undefined {
  return devices.find((device) => device.id === id);
}

export function findPowerSource(id: string): CatalogPowerSource | undefined {
  return powerSources.find((source) => source.id === id);
}

/** Display name including the manufacturer, e.g. "ResMed AirSense 10". */
export function displayName(item: { name: string; manufacturer: string | null }): string {
  return item.manufacturer ? `${item.manufacturer} ${item.name}` : item.name;
}

export function settingOf(device: CatalogDevice, settingId?: string): DeviceSetting {
  const setting =
    device.settings.find((s) => s.id === settingId) ??
    device.settings.find((s) => s.id === device.defaultSetting) ??
    device.settings[0];
  if (!setting) throw new RangeError(`Device ${device.id} has no settings`);
  return setting;
}

export interface LoadOptions {
  /** Unique id for this load. Defaults to the catalog id. */
  id?: string;
  settingId?: string;
  quantity?: number;
  priority?: Priority;
  supply?: Supply;
  enabled?: boolean;
}

/** Turn a catalog device into a {@link Load} for the runtime calculator. */
export function loadFromCatalog(device: CatalogDevice, options: LoadOptions = {}): Load {
  const setting = settingOf(device, options.settingId);
  const load: Load = {
    id: options.id ?? device.id,
    name: displayName(device),
    watts: setting.watts,
    dutyCycle: device.dutyCycle,
    idleWatts: device.idleWatts,
    quantity: options.quantity ?? 1,
    supply: options.supply ?? device.supply,
    priority: options.priority ?? device.priority,
    enabled: options.enabled ?? true,
  };
  if (device.surgeWatts !== null) load.surgeWatts = device.surgeWatts;
  return load;
}

export interface SourceOptions {
  id?: string;
  stateOfCharge?: number;
  ageYears?: number;
  cycles?: number;
  stateOfHealth?: number;
}

/** Turn a catalog power source into a {@link PowerSource}. */
export function sourceFromCatalog(
  item: CatalogPowerSource,
  options: SourceOptions = {},
): PowerSource {
  const source: PowerSource = {
    id: options.id ?? item.id,
    name: displayName(item),
    kind: item.kind,
    capacityWh: item.capacityWh,
    chemistry: item.chemistry,
  };
  if (item.acOutputWatts !== null) source.acOutputWatts = item.acOutputWatts;
  if (item.acSurgeWatts !== null) source.acSurgeWatts = item.acSurgeWatts;
  if (item.cycleLifeTo80 !== null) source.cycleLifeTo80 = item.cycleLifeTo80;
  if (options.stateOfCharge !== undefined) source.stateOfCharge = options.stateOfCharge;
  if (options.ageYears !== undefined) source.ageYears = options.ageYears;
  if (options.cycles !== undefined) source.cycles = options.cycles;
  if (options.stateOfHealth !== undefined) source.stateOfHealth = options.stateOfHealth;
  return source;
}

export { validateCatalog, validateDevices, validatePowerSources } from './validate.js';
