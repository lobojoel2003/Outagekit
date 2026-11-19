import { customDevice, customSource, defaultSettings, emptyProfile } from '../src/state/factories';
import type { AppState } from '../src/state/types';

export const NOW = new Date('2026-11-19T20:00:00Z');

/** A small, fully known setup so tests do not depend on the catalog. */
export function testState(overrides: Partial<AppState> = {}): AppState {
  return {
    schemaVersion: 1,
    devices: [
      customDevice({
        uid: 'o2',
        name: 'Oxygen concentrator',
        category: 'oxygen-concentrator',
        watts: 300,
        priority: 'life-sustaining',
      }),
      customDevice({ uid: 'tv', name: 'TV', category: 'other', watts: 100, priority: 'comfort' }),
    ],
    sources: [
      customSource(NOW, {
        uid: 'ps',
        name: 'Power station',
        capacityWh: 1024,
        chemistry: 'lifepo4',
        acOutputWatts: null,
      }),
    ],
    profile: emptyProfile(),
    settings: { ...defaultSettings(), temperatureC: 20 },
    outage: null,
    isExample: false,
    cardUpdatedAt: null,
    ...overrides,
  };
}
