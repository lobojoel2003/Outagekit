import { defaultSettings, emptyProfile, exampleState } from './factories';
import type { AppState } from './types';

export const STORAGE_KEY = 'outagekit:v1';

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Check and fill in a saved or imported state. Returns null when the data is
 * not an Outagekit plan at all.
 */
export function normalizeState(raw: unknown): AppState | null {
  if (!isObject(raw)) return null;
  if (raw.schemaVersion !== 1) return null;
  if (!Array.isArray(raw.devices) || !Array.isArray(raw.sources)) return null;
  const profile = isObject(raw.profile) ? raw.profile : {};
  const settings = isObject(raw.settings) ? raw.settings : {};
  const base = emptyProfile();
  return {
    schemaVersion: 1,
    devices: raw.devices.filter(isObject) as unknown as AppState['devices'],
    sources: raw.sources.filter(isObject) as unknown as AppState['sources'],
    profile: {
      ...base,
      ...(profile as Partial<AppState['profile']>),
      contacts: Array.isArray(profile.contacts)
        ? (profile.contacts as AppState['profile']['contacts'])
        : [],
      destinations: Array.isArray(profile.destinations)
        ? (profile.destinations as AppState['profile']['destinations'])
        : [],
      oxygen: isObject(profile.oxygen)
        ? (profile.oxygen as unknown as AppState['profile']['oxygen'])
        : null,
    },
    settings: { ...defaultSettings(), ...(settings as Partial<AppState['settings']>) },
    outage: isObject(raw.outage) ? (raw.outage as unknown as AppState['outage']) : null,
    isExample: raw.isExample === true,
    cardUpdatedAt: typeof raw.cardUpdatedAt === 'string' ? raw.cardUpdatedAt : null,
  };
}

export function loadState(
  storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage,
): AppState {
  try {
    const text = storage?.getItem(STORAGE_KEY);
    if (text) {
      const state = normalizeState(JSON.parse(text));
      if (state) return state;
    }
  } catch {
    // Fall through to the example when storage is unavailable or corrupt.
  }
  return exampleState();
}

export function saveState(
  state: AppState,
  storage: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage,
): boolean {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/** Text for a backup file the user can keep or move to another device. */
export function exportState(state: AppState): string {
  return JSON.stringify(
    { app: 'outagekit', exportedAt: new Date().toISOString(), ...state },
    null,
    2,
  );
}

export function importState(text: string): AppState | null {
  try {
    return normalizeState(JSON.parse(text));
  } catch {
    return null;
  }
}
