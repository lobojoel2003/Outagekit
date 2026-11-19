import { findDevice, settingOf } from '@outagekit/runtime';
import { currentCharge, outageFractionLeft, outageTotalHours } from '../lib/compute';
import { emptyState, exampleState } from './factories';
import type {
  AppState,
  Contact,
  DeviceEntry,
  Destination,
  Profile,
  Settings,
  SourceEntry,
} from './types';

export type Action =
  | { type: 'device/add'; device: DeviceEntry }
  | { type: 'device/update'; uid: string; patch: Partial<DeviceEntry> }
  | { type: 'device/setting'; uid: string; settingId: string }
  | { type: 'device/remove'; uid: string }
  | { type: 'source/add'; source: SourceEntry }
  | { type: 'source/update'; uid: string; patch: Partial<SourceEntry> }
  | { type: 'source/remove'; uid: string }
  | { type: 'source/charge'; uid: string; chargedTo: number }
  | { type: 'settings/update'; patch: Partial<Settings> }
  | { type: 'profile/update'; patch: Partial<Profile> }
  | { type: 'contact/add'; contact: Contact }
  | { type: 'contact/update'; id: string; patch: Partial<Contact> }
  | { type: 'contact/remove'; id: string }
  | { type: 'destination/add'; destination: Destination }
  | { type: 'destination/update'; id: string; patch: Partial<Destination> }
  | { type: 'destination/remove'; id: string }
  | { type: 'outage/start' }
  | { type: 'outage/end' }
  | { type: 'example/clear' }
  | { type: 'example/keep' }
  | { type: 'state/replace'; state: AppState }
  | { type: 'state/reset' }
  | { type: 'card/updated' };

/** Every action carries the moment it happened, so the reducer stays pure. */
export type TimedAction = Action & { now: string };

/** Actions that change how fast the battery drains. */
const AFFECTS_DRAIN = new Set<Action['type']>([
  'device/add',
  'device/update',
  'device/setting',
  'device/remove',
  'source/add',
  'source/update',
  'source/remove',
  'settings/update',
]);

function updateById<T extends { id: string }>(list: T[], id: string, patch: Partial<T>): T[] {
  return list.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

function updateByUid<T extends { uid: string }>(list: T[], uid: string, patch: Partial<T>): T[] {
  return list.map((item) => (item.uid === uid ? { ...item, ...patch } : item));
}

function apply(state: AppState, action: TimedAction): AppState {
  const now = new Date(action.now);
  switch (action.type) {
    case 'device/add':
      return { ...state, devices: [...state.devices, action.device] };
    case 'device/update':
      return { ...state, devices: updateByUid(state.devices, action.uid, action.patch) };
    case 'device/setting': {
      const device = state.devices.find((d) => d.uid === action.uid);
      const catalog = device?.catalogId ? findDevice(device.catalogId) : undefined;
      if (!device || !catalog) return state;
      const setting = settingOf(catalog, action.settingId);
      return {
        ...state,
        devices: updateByUid(state.devices, action.uid, {
          settingId: setting.id,
          watts: setting.watts,
        }),
      };
    }
    case 'device/remove':
      return { ...state, devices: state.devices.filter((d) => d.uid !== action.uid) };
    case 'source/add':
      return { ...state, sources: [...state.sources, action.source] };
    case 'source/update':
      return { ...state, sources: updateByUid(state.sources, action.uid, action.patch) };
    case 'source/remove':
      return { ...state, sources: state.sources.filter((s) => s.uid !== action.uid) };
    case 'source/charge': {
      const chargedTo = Math.min(1, Math.max(0, action.chargedTo));
      const sources = updateByUid(state.sources, action.uid, {
        chargedTo,
        lastChargedAt: action.now,
      });
      if (!state.outage) return { ...state, sources };
      // A fresh reading during an outage resets the countdown from what the battery says.
      const chargeAtStart: Record<string, number> = {};
      for (const source of sources) {
        chargeAtStart[source.uid] =
          source.uid === action.uid
            ? chargedTo
            : (state.outage.chargeAtStart[source.uid] ?? currentCharge(source, now));
      }
      return {
        ...state,
        sources,
        outage: {
          ...state.outage,
          chargeAtStart,
          segmentStartedAt: action.now,
          segmentFraction: 1,
        },
      };
    }
    case 'settings/update':
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case 'profile/update':
      return { ...state, profile: { ...state.profile, ...action.patch } };
    case 'contact/add':
      return {
        ...state,
        profile: { ...state.profile, contacts: [...state.profile.contacts, action.contact] },
      };
    case 'contact/update':
      return {
        ...state,
        profile: {
          ...state.profile,
          contacts: updateById(state.profile.contacts, action.id, action.patch),
        },
      };
    case 'contact/remove':
      return {
        ...state,
        profile: {
          ...state.profile,
          contacts: state.profile.contacts.filter((c) => c.id !== action.id),
        },
      };
    case 'destination/add':
      return {
        ...state,
        profile: {
          ...state.profile,
          destinations: [...state.profile.destinations, action.destination],
        },
      };
    case 'destination/update':
      return {
        ...state,
        profile: {
          ...state.profile,
          destinations: updateById(state.profile.destinations, action.id, action.patch),
        },
      };
    case 'destination/remove':
      return {
        ...state,
        profile: {
          ...state.profile,
          destinations: state.profile.destinations.filter((d) => d.id !== action.id),
        },
      };
    case 'outage/start': {
      if (state.outage) return state;
      const chargeAtStart: Record<string, number> = {};
      for (const source of state.sources) chargeAtStart[source.uid] = currentCharge(source, now);
      return {
        ...state,
        outage: {
          startedAt: action.now,
          segmentStartedAt: action.now,
          segmentFraction: 1,
          chargeAtStart,
        },
      };
    }
    case 'outage/end': {
      if (!state.outage) return state;
      // Leave each battery at its estimated charge so the planning view stays honest.
      const total = outageTotalHours(state, now);
      const fraction = outageFractionLeft(state.outage, total, now);
      const sources = state.sources.map((source) => ({
        ...source,
        chargedTo: (state.outage?.chargeAtStart[source.uid] ?? source.chargedTo) * fraction,
        lastChargedAt: action.now,
      }));
      return { ...state, sources, outage: null };
    }
    case 'example/clear':
      return { ...emptyState(now), settings: state.settings, profile: state.profile };
    case 'example/keep':
      return { ...state, isExample: false };
    case 'state/replace':
      return action.state;
    case 'state/reset':
      return exampleState(now);
    case 'card/updated':
      return { ...state, cardUpdatedAt: action.now };
  }
}

/**
 * During an outage, close the current stretch before a change to devices or
 * settings, so time already used is counted at the old rate.
 */
function checkpoint(state: AppState, action: TimedAction): AppState {
  if (!state.outage || !AFFECTS_DRAIN.has(action.type)) return state;
  const now = new Date(action.now);
  const total = outageTotalHours(state, now);
  return {
    ...state,
    outage: {
      ...state.outage,
      segmentFraction: outageFractionLeft(state.outage, total, now),
      segmentStartedAt: action.now,
    },
  };
}

export function reducer(state: AppState, action: TimedAction): AppState {
  return apply(checkpoint(state, action), action);
}
