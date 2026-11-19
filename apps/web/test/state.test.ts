import { describe, expect, it } from 'vitest';
import { compute, currentCharge, oxygenHours, toLoad } from '../src/lib/compute';
import { exampleState, emptyState, deviceFromCatalog } from '../src/state/factories';
import {
  exportState,
  importState,
  loadState,
  normalizeState,
  saveState,
  STORAGE_KEY,
} from '../src/state/persist';
import { reducer, type Action } from '../src/state/reducer';
import { devices } from '@outagekit/runtime';
import { NOW, testState } from './helpers';

const at = (iso: string) => (action: Action) => ({ ...action, now: iso });
const HOUR = 3_600_000;

describe('compute', () => {
  it('matches the library for a known setup', () => {
    const result = compute(testState(), NOW);
    // 1024 x 0.95 / (10 + 400 / 0.9)
    expect(result.hours).toBeCloseTo((1024 * 0.95) / (10 + 400 / 0.9), 6);
    expect(result.endsAt?.getTime()).toBeCloseTo(NOW.getTime() + result.hours * HOUR, -2);
    expect(result.inOutage).toBe(false);
    expect(result.travelMinutes).toBe(30);
    expect(result.shed.steps.map((s) => s.load.id)).toEqual(['tv']);
    expect(result.hasLifeSustaining).toBe(true);
  });

  it('works out when to leave', () => {
    const result = compute(testState(), NOW);
    expect(result.leaveAfterHours).toBeCloseTo(result.hours - 1.5, 6);
    expect(result.leaveAt?.getTime()).toBeCloseTo(NOW.getTime() + (result.hours - 1.5) * HOUR, -2);
  });

  it('has no end with no load', () => {
    const result = compute(testState({ devices: [] }), NOW);
    expect(result.hours).toBe(Number.POSITIVE_INFINITY);
    expect(result.endsAt).toBeNull();
    expect(result.leaveAt).toBeNull();
  });

  it('lets stored batteries lose charge over time', () => {
    const source = testState().sources[0]!;
    expect(currentCharge(source, NOW)).toBe(1);
    const later = new Date(NOW.getTime() + 91.32 * 86_400_000);
    expect(currentCharge(source, later)).toBeCloseTo(0.91, 2);
    expect(currentCharge({ ...source, lastChargedAt: 'garbage' }, NOW)).toBe(1);
  });

  it('converts devices to loads', () => {
    const device = testState().devices[0]!;
    expect(toLoad({ ...device, surgeWatts: 700 }).surgeWatts).toBe(700);
    expect(toLoad(device).surgeWatts).toBeUndefined();
  });

  it('works out oxygen cylinder time', () => {
    const state = testState();
    expect(oxygenHours(state)).toBeNull();
    state.profile.oxygen = { cylinderCount: 2, cylinderSize: 'E', customLitres: 0, flowLpm: 2 };
    expect(oxygenHours(state)).toBeCloseTo(10.2, 6);
    state.profile.oxygen = {
      cylinderCount: 1,
      cylinderSize: 'custom',
      customLitres: 600,
      flowLpm: 2,
    };
    expect(oxygenHours(state)).toBeCloseTo(4.5, 6);
  });
});

describe('reducer', () => {
  const now = at(NOW.toISOString());

  it('adds, updates and removes devices', () => {
    let state = testState();
    const fridge = deviceFromCatalog(devices.find((d) => d.category === 'refrigeration')!);
    state = reducer(state, now({ type: 'device/add', device: fridge }));
    expect(state.devices).toHaveLength(3);
    state = reducer(state, now({ type: 'device/update', uid: fridge.uid, patch: { quantity: 2 } }));
    expect(state.devices[2]?.quantity).toBe(2);
    state = reducer(state, now({ type: 'device/remove', uid: fridge.uid }));
    expect(state.devices).toHaveLength(2);
  });

  it('changes a catalog setting and its watts together', () => {
    const multi = devices.find((d) => d.settings.length > 1)!;
    const device = deviceFromCatalog(multi);
    let state = testState({ devices: [device] });
    const other = multi.settings.find((s) => s.id !== device.settingId)!;
    state = reducer(state, now({ type: 'device/setting', uid: device.uid, settingId: other.id }));
    expect(state.devices[0]).toMatchObject({ settingId: other.id, watts: other.watts });
    // Custom devices have no settings to switch.
    const custom = testState();
    expect(reducer(custom, now({ type: 'device/setting', uid: 'o2', settingId: 'x' }))).toBe(
      custom,
    );
  });

  it('records a charge reading', () => {
    const state = reducer(testState(), now({ type: 'source/charge', uid: 'ps', chargedTo: 1.4 }));
    expect(state.sources[0]).toMatchObject({ chargedTo: 1, lastChargedAt: NOW.toISOString() });
  });

  it('starts an outage at the current charge', () => {
    const state = reducer(testState(), now({ type: 'outage/start' }));
    expect(state.outage).toMatchObject({
      startedAt: NOW.toISOString(),
      segmentFraction: 1,
      chargeAtStart: { ps: 1 },
    });
    expect(reducer(state, now({ type: 'outage/start' }))).toBe(state);
  });

  it('counts down during an outage', () => {
    const started = reducer(testState(), now({ type: 'outage/start' }));
    const total = compute(started, NOW).hours;
    const later = new Date(NOW.getTime() + HOUR);
    const result = compute(started, later);
    expect(result.hours).toBeCloseTo(total - 1, 6);
    expect(result.outageElapsedHours).toBeCloseTo(1, 6);
    expect(result.fractionLeft).toBeCloseTo(1 - 1 / total, 6);
  });

  it('keeps time already used when devices change mid-outage', () => {
    let state = reducer(testState(), now({ type: 'outage/start' }));
    const total = compute(state, NOW).hours;
    const oneHour = new Date(NOW.getTime() + HOUR).toISOString();
    state = reducer(
      state,
      at(oneHour)({ type: 'device/update', uid: 'tv', patch: { enabled: false } }),
    );
    expect(state.outage?.segmentFraction).toBeCloseTo(1 - 1 / total, 6);
    expect(state.outage?.segmentStartedAt).toBe(oneHour);
    // With the TV off, what is left lasts longer than at the old rate.
    const after = compute(state, new Date(oneHour));
    expect(after.hours).toBeGreaterThan(total - 1);
    const oxygenOnly = compute(testState({ devices: testState().devices.slice(0, 1) }), NOW).hours;
    expect(after.hours).toBeCloseTo((1 - 1 / total) * oxygenOnly, 6);
  });

  it('recalibrates from a battery reading during an outage', () => {
    let state = reducer(testState(), now({ type: 'outage/start' }));
    const later = new Date(NOW.getTime() + HOUR).toISOString();
    state = reducer(state, at(later)({ type: 'source/charge', uid: 'ps', chargedTo: 0.5 }));
    expect(state.outage).toMatchObject({
      segmentFraction: 1,
      segmentStartedAt: later,
      chargeAtStart: { ps: 0.5 },
    });
    const full = compute(testState(), NOW).hours;
    expect(compute(state, new Date(later)).hours).toBeCloseTo(full / 2, 6);
  });

  it('leaves the battery at its estimated charge when the power comes back', () => {
    let state = reducer(testState(), now({ type: 'outage/start' }));
    const total = compute(state, NOW).hours;
    const later = new Date(NOW.getTime() + HOUR).toISOString();
    state = reducer(state, at(later)({ type: 'outage/end' }));
    expect(state.outage).toBeNull();
    expect(state.sources[0]?.chargedTo).toBeCloseTo(1 - 1 / total, 6);
    expect(reducer(state, now({ type: 'outage/end' }))).toBe(state);
  });

  it('edits profile lists', () => {
    let state = testState();
    state = reducer(
      state,
      now({
        type: 'contact/add',
        contact: { id: 'c1', name: 'Ana', relation: 'Daughter', phone: '555' },
      }),
    );
    state = reducer(state, now({ type: 'contact/update', id: 'c1', patch: { phone: '556' } }));
    expect(state.profile.contacts[0]?.phone).toBe('556');
    state = reducer(state, now({ type: 'contact/remove', id: 'c1' }));
    expect(state.profile.contacts).toEqual([]);
    state = reducer(
      state,
      now({
        type: 'destination/add',
        destination: { id: 'd1', name: 'Ana', address: '', phone: '', travelMinutes: 45 },
      }),
    );
    state = reducer(
      state,
      now({ type: 'destination/update', id: 'd1', patch: { travelMinutes: 20 } }),
    );
    expect(compute(state, NOW).travelMinutes).toBe(20);
    state = reducer(state, now({ type: 'destination/remove', id: 'd1' }));
    expect(state.profile.destinations).toEqual([]);
    state = reducer(state, now({ type: 'profile/update', patch: { personName: 'Rosa' } }));
    expect(state.profile.personName).toBe('Rosa');
  });

  it('adds and removes sources and settings', () => {
    let state = testState();
    state = reducer(
      state,
      now({ type: 'source/add', source: { ...state.sources[0]!, uid: 'ps2' } }),
    );
    expect(compute(state, NOW).hours).toBeCloseTo(compute(testState(), NOW).hours * 2, 6);
    state = reducer(state, now({ type: 'source/update', uid: 'ps2', patch: { capacityWh: 2048 } }));
    expect(state.sources[1]?.capacityWh).toBe(2048);
    state = reducer(state, now({ type: 'source/remove', uid: 'ps2' }));
    expect(state.sources).toHaveLength(1);
    state = reducer(state, now({ type: 'settings/update', patch: { marginMinutes: 30 } }));
    expect(state.settings.marginMinutes).toBe(30);
    state = reducer(state, now({ type: 'card/updated' }));
    expect(state.cardUpdatedAt).toBe(NOW.toISOString());
  });

  it('handles the example setup', () => {
    let state = exampleState(NOW);
    expect(state.isExample).toBe(true);
    expect(state.devices.length).toBeGreaterThan(2);
    state = reducer(state, now({ type: 'example/keep' }));
    expect(state.isExample).toBe(false);
    state = reducer(exampleState(NOW), now({ type: 'example/clear' }));
    expect(state.devices).toEqual([]);
    expect(state.isExample).toBe(false);
    state = reducer(state, now({ type: 'state/reset' }));
    expect(state.isExample).toBe(true);
    const replacement = emptyState(NOW);
    expect(reducer(state, now({ type: 'state/replace', state: replacement }))).toBe(replacement);
  });
});

describe('persistence', () => {
  it('round-trips through storage', () => {
    const state = testState();
    expect(saveState(state)).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toContain('Oxygen concentrator');
    expect(loadState()).toEqual(state);
  });

  it('falls back to the example when storage is empty or broken', () => {
    expect(loadState().isExample).toBe(true);
    localStorage.setItem(STORAGE_KEY, '{nope');
    expect(loadState().isExample).toBe(true);
    expect(
      loadState({
        getItem: () => {
          throw new Error('blocked');
        },
      }).isExample,
    ).toBe(true);
    expect(
      saveState(testState(), {
        setItem: () => {
          throw new Error('full');
        },
      }),
    ).toBe(false);
  });

  it('imports backups and rejects other files', () => {
    const state = testState();
    expect(importState(exportState(state))).toMatchObject({
      devices: state.devices,
      sources: state.sources,
    });
    expect(importState('not json')).toBeNull();
    expect(importState('{"schemaVersion":2,"devices":[],"sources":[]}')).toBeNull();
    expect(normalizeState([])).toBeNull();
    expect(normalizeState({ schemaVersion: 1, devices: {}, sources: [] })).toBeNull();
  });

  it('fills in missing fields', () => {
    const state = normalizeState({
      schemaVersion: 1,
      devices: [],
      sources: [],
      profile: { personName: 'Rosa' },
    });
    expect(state?.profile).toMatchObject({
      personName: 'Rosa',
      contacts: [],
      destinations: [],
      oxygen: null,
    });
    expect(state?.settings.marginMinutes).toBe(60);
    expect(state?.outage).toBeNull();
  });
});
