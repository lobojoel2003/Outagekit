import { averageWatts, findDevice, formatDuration } from '@outagekit/runtime';
import type { AppState } from '../state/types';
import { compute, toLoad, type Computed } from './compute';
import { formatDate, formatTemperature, formatWatts } from './format';
import { buildPlan, type PlanStep } from './plan';

export interface CardDevice {
  name: string;
  detail: string;
  watts: string;
}

/** Everything the printed card shows, worked out once for both PDF and print preview. */
export interface CardContent {
  title: string;
  personName: string;
  address: string;
  phone: string;
  medicalNote: string;
  criticalLine: string | null;
  runtimeAll: string;
  runtimeMedical: string | null;
  /** Short value for the "when to leave" box, e.g. "5 h 50 min" or "Right away". */
  leaveValue: string;
  leaveSub: string;
  leaveLine: string;
  sourceLine: string;
  steps: PlanStep[];
  devices: CardDevice[];
  extraNotes: string;
  footer: string;
  hasDevices: boolean;
}

/**
 * The card is printed once and kept for months, so it uses a full charge
 * rather than whatever the battery is at today, and no outage in progress.
 */
export function stateForCard(state: AppState, now: Date): AppState {
  return {
    ...state,
    outage: null,
    sources: state.sources.map((source) => ({
      ...source,
      chargedTo: 1,
      lastChargedAt: now.toISOString(),
    })),
  };
}

function settingLabel(state: AppState, uid: string): string {
  const device = state.devices.find((d) => d.uid === uid);
  if (!device) return '';
  const parts: string[] = [];
  const setting = device.catalogId
    ? findDevice(device.catalogId)?.settings.find((s) => s.id === device.settingId)
    : undefined;
  if (setting && (findDevice(device.catalogId ?? '')?.settings.length ?? 0) > 1)
    parts.push(setting.label);
  if (device.quantity > 1) parts.push(`${device.quantity} units`);
  if (device.supply === 'dc') parts.push('12 V / USB');
  if (device.dutyCycle < 1) parts.push(`runs ${Math.round(device.dutyCycle * 100)}% of the time`);
  return parts.join(', ');
}

export function cardContent(state: AppState, now: Date, version: string): CardContent {
  const cardState = stateForCard(state, now);
  const computed: Computed = compute(cardState, now);
  const steps = buildPlan(cardState, computed, now, { forCard: true });
  const enabled = cardState.devices.filter((d) => d.enabled && d.quantity > 0);
  const critical = enabled.filter((d) => d.priority === 'life-sustaining');
  const profile = state.profile;
  const finite = Number.isFinite(computed.estimate.hours);

  const medicalOnly = computed.shed.medicalOnlyHours;
  const runtimeMedical =
    computed.shed.steps.length > 0 && Number.isFinite(medicalOnly)
      ? formatDuration(medicalOnly, 'short')
      : null;

  const sourceNames = cardState.sources.map((s) => s.name);
  const sourceLine = sourceNames.length
    ? `On ${sourceNames.join(' + ')}, fully charged, at ${formatTemperature(state.settings.temperatureC, state.settings.temperatureUnit)}.`
    : 'No battery recorded.';

  let leaveLine = 'Add devices and a battery to work out when to leave.';
  let leaveValue = '—';
  let leaveSub = '';
  if (finite) {
    const now = computed.leaveAfterHours <= 0;
    leaveLine = now
      ? 'Leave as soon as the power goes out.'
      : `Leave ${formatDuration(computed.leaveAfterHours)} after the power goes out.`;
    leaveValue = now ? 'Right away' : formatDuration(computed.leaveAfterHours, 'short');
    leaveSub = now ? 'battery is too small to wait' : 'after the power goes out';
  }

  return {
    title: 'Power outage plan',
    personName: profile.personName,
    address: profile.address,
    phone: profile.phone,
    medicalNote: profile.medicalNote,
    criticalLine: critical.length
      ? `Life-sustaining equipment in this home: ${critical.map((d) => d.name).join(', ')}.`
      : null,
    runtimeAll: finite ? formatDuration(computed.estimate.hours, 'short') : '—',
    runtimeMedical,
    leaveValue,
    leaveSub,
    leaveLine,
    sourceLine,
    steps,
    devices: enabled.map((device) => ({
      name: device.name,
      detail: settingLabel(cardState, device.uid),
      watts: `${formatWatts(averageWatts(toLoad(device)))} avg`,
    })),
    extraNotes: profile.extraNotes,
    footer: `Made with Outagekit ${version} on ${formatDate(now)}. Battery times are estimates: check your equipment manuals and test your setup.`,
    hasDevices: enabled.length > 0,
  };
}
