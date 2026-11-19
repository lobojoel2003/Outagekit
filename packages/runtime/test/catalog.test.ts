import { describe, expect, it } from 'vitest';
import {
  CATEGORY_LABELS,
  DEVICE_CATEGORIES,
  catalogUpdated,
  devices,
  displayName,
  estimateRuntime,
  findDevice,
  findPowerSource,
  loadFromCatalog,
  powerSources,
  settingOf,
  sourceFromCatalog,
  validateCatalog,
  validateDevices,
  validatePowerSources,
  type CatalogDevice,
} from '../src/index.js';

describe('the shipped catalog', () => {
  it('is valid', () => {
    expect(validateCatalog({ devices, powerSources })).toEqual([]);
  });

  it('has a review date', () => {
    expect(catalogUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('labels every category', () => {
    for (const category of DEVICE_CATEGORIES) expect(CATEGORY_LABELS[category]).toBeTruthy();
  });

  it('includes life-sustaining equipment and power stations', () => {
    expect(devices.some((d) => d.priority === 'life-sustaining')).toBe(true);
    expect(devices.some((d) => d.category === 'oxygen-concentrator')).toBe(true);
    expect(devices.some((d) => d.category === 'cpap')).toBe(true);
    expect(powerSources.some((s) => s.kind === 'power-station')).toBe(true);
  });

  it('gives every device a usable runtime on every source', () => {
    for (const source of powerSources) {
      for (const device of devices) {
        const hours = estimateRuntime([loadFromCatalog(device)], sourceFromCatalog(source)).hours;
        expect(hours).toBeGreaterThan(0);
        expect(Number.isFinite(hours)).toBe(true);
      }
    }
  });
});

describe('catalog helpers', () => {
  const device = devices[0]!;
  const source = powerSources[0]!;

  it('finds entries by id', () => {
    expect(findDevice(device.id)).toBe(device);
    expect(findDevice('nope')).toBeUndefined();
    expect(findPowerSource(source.id)).toBe(source);
    expect(findPowerSource('nope')).toBeUndefined();
  });

  it('builds display names', () => {
    expect(displayName({ name: 'AirSense 10', manufacturer: 'ResMed' })).toBe('ResMed AirSense 10');
    expect(displayName({ name: 'Lamp', manufacturer: null })).toBe('Lamp');
  });

  it('picks settings', () => {
    const multi: CatalogDevice = {
      ...device,
      settings: [
        { id: 'a', label: 'A', watts: 10 },
        { id: 'b', label: 'B', watts: 20 },
      ],
      defaultSetting: 'b',
    };
    expect(settingOf(multi).id).toBe('b');
    expect(settingOf(multi, 'a').id).toBe('a');
    expect(settingOf(multi, 'zzz').id).toBe('b');
    expect(settingOf({ ...multi, defaultSetting: 'gone' }).id).toBe('a');
    expect(() => settingOf({ ...multi, settings: [] })).toThrow(RangeError);
  });

  it('turns a device into a load', () => {
    const load = loadFromCatalog(device, { id: 'mine', quantity: 2, enabled: false });
    expect(load).toMatchObject({
      id: 'mine',
      name: displayName(device),
      watts: settingOf(device).watts,
      quantity: 2,
      enabled: false,
      supply: device.supply,
      priority: device.priority,
    });
    const withSurge = loadFromCatalog(
      { ...device, surgeWatts: 900 },
      { supply: 'dc', priority: 'comfort' },
    );
    expect(withSurge.surgeWatts).toBe(900);
    expect(withSurge.supply).toBe('dc');
    expect(withSurge.priority).toBe('comfort');
    expect(loadFromCatalog({ ...device, surgeWatts: null }).surgeWatts).toBeUndefined();
  });

  it('turns a catalog entry into a power source', () => {
    const full = sourceFromCatalog(
      { ...source, acOutputWatts: 1000, acSurgeWatts: 2000, cycleLifeTo80: 3000 },
      { id: 'x', stateOfCharge: 0.5, ageYears: 2, cycles: 100, stateOfHealth: 0.9 },
    );
    expect(full).toMatchObject({
      id: 'x',
      acOutputWatts: 1000,
      acSurgeWatts: 2000,
      cycleLifeTo80: 3000,
      stateOfCharge: 0.5,
      ageYears: 2,
      cycles: 100,
      stateOfHealth: 0.9,
    });
    const bare = sourceFromCatalog({
      ...source,
      acOutputWatts: null,
      acSurgeWatts: null,
      cycleLifeTo80: null,
    });
    expect(bare.acOutputWatts).toBeUndefined();
    expect(bare.acSurgeWatts).toBeUndefined();
    expect(bare.cycleLifeTo80).toBeUndefined();
    expect(bare.stateOfCharge).toBeUndefined();
  });
});

describe('validation', () => {
  const good = devices[0]!;
  const goodSource = powerSources[0]!;

  it('rejects non-arrays', () => {
    expect(validateDevices({})).toEqual(['devices must be an array']);
    expect(validatePowerSources(null)).toEqual(['powerSources must be an array']);
  });

  it('catches bad device fields', () => {
    const errors = validateDevices([
      good,
      { ...good },
      'text',
      {
        ...good,
        id: 'Bad Id',
        name: '',
        manufacturer: 5,
        category: 'toaster',
        supply: 'ac-dc',
        priority: 'urgent',
        dutyCycle: 0,
        idleWatts: -1,
        surgeWatts: 0,
        internalBattery: { hours: 0 },
        notes: 3,
        verified: 'yes',
        sources: 'none',
        defaultSetting: 'missing',
      },
      { ...good, id: 'no-settings', settings: [] },
      {
        ...good,
        id: 'bad-settings',
        settings: [
          { id: 'a', label: 'A', watts: 10 },
          { id: 'a', label: '', watts: -5 },
          { label: 'no id', watts: 3 },
        ],
        defaultSetting: 'a',
      },
      {
        ...good,
        id: 'bad-sources',
        verified: true,
        sources: [{ title: 'Bad link', url: 'http://x' }, { url: 'https://x' }],
      },
      { ...good, id: 'unlinked', verified: true, sources: [{ title: 'No link' }] },
    ]);
    const joined = errors.join('\n');
    for (const fragment of [
      'duplicate id',
      'must be an object',
      'id must be kebab-case',
      'name is required',
      'manufacturer must be text or null',
      'unknown category',
      'supply must be ac or dc',
      'unknown priority',
      'dutyCycle',
      'idleWatts',
      'surgeWatts',
      'internalBattery',
      'notes must be text',
      'verified must be true or false',
      'sources must be an array',
      'defaultSetting',
      'needs at least one setting',
      'duplicate setting a',
      'needs a label',
      'watts must be between',
      'needs a kebab-case id',
      'must be an https URL',
      'needs a title',
      'verified entries need at least one source URL',
    ]) {
      expect(joined).toContain(fragment);
    }
  });

  it('catches bad power source fields', () => {
    const errors = validatePowerSources([
      goodSource,
      7,
      {
        ...goodSource,
        id: 'x',
        kind: 'generator',
        chemistry: 'nicad',
        capacityWh: 0,
        acOutputWatts: -1,
        acSurgeWatts: 'big',
        cycleLifeTo80: 0,
      },
    ]).join('\n');
    for (const fragment of [
      'must be an object',
      'unknown kind',
      'unknown chemistry',
      'capacityWh must be positive',
      'acOutputWatts must be',
      'acSurgeWatts must be',
      'cycleLifeTo80 must be',
    ]) {
      expect(errors).toContain(fragment);
    }
  });
});
