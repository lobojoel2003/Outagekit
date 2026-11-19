const PRIORITIES = ['comfort', 'essential', 'medical', 'life-sustaining'];
const SUPPLIES = ['ac', 'dc'];
const CHEMISTRIES = ['lifepo4', 'nmc', 'agm', 'gel', 'flooded'];
const KINDS = ['power-station', 'battery-inverter', 'ups'];
const CATEGORIES = [
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
];
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '';
const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

function checkSources(where: string, value: unknown, errors: string[]): void {
  if (!Array.isArray(value)) {
    errors.push(`${where}: sources must be an array`);
    return;
  }
  value.forEach((source, i) => {
    if (!isObject(source) || !isText(source.title)) {
      errors.push(`${where}: sources[${i}] needs a title`);
      return;
    }
    if (source.url !== undefined && (!isText(source.url) || !/^https:\/\//.test(source.url))) {
      errors.push(`${where}: sources[${i}].url must be an https URL`);
    }
  });
}

function checkCommon(where: string, item: Json, ids: Set<string>, errors: string[]): void {
  if (!isText(item.id) || !ID.test(item.id)) errors.push(`${where}: id must be kebab-case`);
  else if (ids.has(item.id)) errors.push(`${where}: duplicate id ${item.id}`);
  else ids.add(item.id);
  if (!isText(item.name)) errors.push(`${where}: name is required`);
  if (item.manufacturer !== null && !isText(item.manufacturer)) {
    errors.push(`${where}: manufacturer must be text or null`);
  }
  if (typeof item.notes !== 'string') errors.push(`${where}: notes must be text`);
  if (typeof item.verified !== 'boolean') errors.push(`${where}: verified must be true or false`);
  checkSources(where, item.sources, errors);
  if (item.verified === true && Array.isArray(item.sources)) {
    const hasUrl = item.sources.some((s) => isObject(s) && isText(s.url));
    if (!hasUrl) errors.push(`${where}: verified entries need at least one source URL`);
  }
}

/** Check a list of catalog devices. Returns a list of problems; empty means valid. */
export function validateDevices(list: unknown): string[] {
  const errors: string[] = [];
  if (!Array.isArray(list)) return ['devices must be an array'];
  const ids = new Set<string>();
  list.forEach((device, index) => {
    const where = `devices[${index}]${isObject(device) && isText(device.id) ? ` (${device.id})` : ''}`;
    if (!isObject(device)) {
      errors.push(`${where}: must be an object`);
      return;
    }
    checkCommon(where, device, ids, errors);
    if (!CATEGORIES.includes(device.category as string)) errors.push(`${where}: unknown category`);
    if (!SUPPLIES.includes(device.supply as string))
      errors.push(`${where}: supply must be ac or dc`);
    if (!PRIORITIES.includes(device.priority as string)) errors.push(`${where}: unknown priority`);
    if (!isNumber(device.dutyCycle) || device.dutyCycle <= 0 || device.dutyCycle > 1) {
      errors.push(`${where}: dutyCycle must be above 0 and at most 1`);
    }
    if (!isNumber(device.idleWatts) || device.idleWatts < 0) {
      errors.push(`${where}: idleWatts must be 0 or more`);
    }
    if (device.surgeWatts !== null && (!isNumber(device.surgeWatts) || device.surgeWatts <= 0)) {
      errors.push(`${where}: surgeWatts must be a positive number or null`);
    }
    if (device.internalBattery !== null) {
      const battery = device.internalBattery;
      if (
        !isObject(battery) ||
        !isNumber(battery.hours) ||
        battery.hours <= 0 ||
        typeof battery.note !== 'string'
      ) {
        errors.push(`${where}: internalBattery needs positive hours and a note, or null`);
      }
    }
    if (!Array.isArray(device.settings) || device.settings.length === 0) {
      errors.push(`${where}: needs at least one setting`);
      return;
    }
    const settingIds = new Set<string>();
    device.settings.forEach((setting: unknown, i: number) => {
      if (!isObject(setting) || !isText(setting.id) || !ID.test(setting.id)) {
        errors.push(`${where}: settings[${i}] needs a kebab-case id`);
        return;
      }
      if (settingIds.has(setting.id)) errors.push(`${where}: duplicate setting ${setting.id}`);
      settingIds.add(setting.id);
      if (!isText(setting.label)) errors.push(`${where}: settings[${i}] needs a label`);
      if (!isNumber(setting.watts) || setting.watts <= 0 || setting.watts > 5000) {
        errors.push(`${where}: settings[${i}].watts must be between 0 and 5000`);
      }
    });
    if (!isText(device.defaultSetting) || !settingIds.has(device.defaultSetting)) {
      errors.push(`${where}: defaultSetting must name one of its settings`);
    }
  });
  return errors;
}

/** Check a list of catalog power sources. Returns a list of problems; empty means valid. */
export function validatePowerSources(list: unknown): string[] {
  const errors: string[] = [];
  if (!Array.isArray(list)) return ['powerSources must be an array'];
  const ids = new Set<string>();
  list.forEach((source, index) => {
    const where = `powerSources[${index}]${isObject(source) && isText(source.id) ? ` (${source.id})` : ''}`;
    if (!isObject(source)) {
      errors.push(`${where}: must be an object`);
      return;
    }
    checkCommon(where, source, ids, errors);
    if (!KINDS.includes(source.kind as string)) errors.push(`${where}: unknown kind`);
    if (!CHEMISTRIES.includes(source.chemistry as string))
      errors.push(`${where}: unknown chemistry`);
    if (!isNumber(source.capacityWh) || source.capacityWh <= 0) {
      errors.push(`${where}: capacityWh must be positive`);
    }
    for (const key of ['acOutputWatts', 'acSurgeWatts', 'cycleLifeTo80'] as const) {
      const value = source[key];
      if (value !== null && (!isNumber(value) || value <= 0)) {
        errors.push(`${where}: ${key} must be a positive number or null`);
      }
    }
  });
  return errors;
}

/** Check both halves of a catalog. Returns a list of problems; empty means valid. */
export function validateCatalog(catalog: { devices: unknown; powerSources: unknown }): string[] {
  return [...validateDevices(catalog.devices), ...validatePowerSources(catalog.powerSources)];
}
