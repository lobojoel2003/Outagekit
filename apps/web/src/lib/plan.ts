import { findDevice, formatDuration, type CatalogDevice } from '@outagekit/runtime';
import type { AppState, DeviceEntry } from '../state/types';
import type { Computed } from './compute';
import { formatClock, formatWatts } from './format';

export type StepKind = 'start' | 'shed' | 'tune' | 'leave' | 'go' | 'backup' | 'help';

export interface PlanStep {
  id: StepKind;
  title: string;
  /** One-line summary shown in bold, e.g. "Leave by 3:40 AM". */
  headline?: string;
  lines: string[];
  /** Visual tone for the step. */
  tone: 'neutral' | 'act' | 'urgent';
}

export interface PlanOptions {
  /** Wording for the printed card rather than the screen. */
  forCard?: boolean;
}

const LUNG_CATEGORIES = new Set<CatalogDevice['category']>([
  'oxygen-concentrator',
  'portable-oxygen-concentrator',
]);

function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

function enabledDevices(state: AppState): DeviceEntry[] {
  return state.devices.filter((d) => d.enabled && d.quantity > 0);
}

/** Suggestions to turn devices down where that is safe (never oxygen flow or ventilation). */
export function tuneSuggestions(state: AppState): string[] {
  const lines: string[] = [];
  for (const device of enabledDevices(state)) {
    if (device.category !== 'cpap' && device.category !== 'bilevel') continue;
    const catalog = device.catalogId ? findDevice(device.catalogId) : undefined;
    if (!catalog || catalog.settings.length < 2) continue;
    const lowest = [...catalog.settings].sort((a, b) => a.watts - b.watts)[0];
    if (lowest && lowest.watts < device.watts - 1) {
      lines.push(
        `${device.name}: switch to "${lowest.label}" to save about ${formatWatts(device.watts - lowest.watts)}.`,
      );
    }
  }
  if (enabledDevices(state).some((d) => LUNG_CATEGORIES.has(d.category))) {
    lines.push('Keep your prescribed oxygen flow. Only change it if your clinician tells you to.');
  }
  if (enabledDevices(state).some((d) => d.category === 'refrigeration')) {
    lines.push('Keep the fridge and freezer shut. A closed fridge stays cold for about 4 hours.');
  }
  return lines;
}

export function buildPlan(
  state: AppState,
  computed: Computed,
  now: Date,
  options: PlanOptions = {},
): PlanStep[] {
  const steps: PlanStep[] = [];
  const devices = enabledDevices(state);
  const critical = devices.filter(
    (d) => d.priority === 'life-sustaining' || d.priority === 'medical',
  );
  const sourceNames = state.sources.map((s) => s.name);
  const profile = state.profile;

  // 1. Start.
  const start: string[] = [];
  if (critical.length && sourceNames.length) {
    start.push(`Plug ${listNames(critical.map((d) => d.name))} into ${listNames(sourceNames)}.`);
  } else if (!sourceNames.length) {
    start.push('Get a battery or power station ready before the next outage.');
  }
  start.push(
    options.forCard
      ? 'Write down the time the power went out.'
      : 'Tap "Power is out" to start the countdown, or write down the time.',
  );
  if (profile.utilityName) {
    const phone = profile.utilityPhone ? ` on ${profile.utilityPhone}` : '';
    const account = profile.utilityAccount ? ` Account ${profile.utilityAccount}.` : '';
    start.push(
      `Call ${profile.utilityName}${phone}: report the outage and say someone here relies on medical equipment.${account}`,
    );
  } else {
    start.push(
      'Call your electric utility: report the outage and say someone here relies on medical equipment.',
    );
  }
  steps.push({ id: 'start', title: 'When the power goes out', lines: start, tone: 'act' });

  // 2. Shed load.
  if (computed.shed.steps.length) {
    const lines = computed.shed.steps.map(
      (step) =>
        `${step.load.name}: saves ${formatWatts(step.savedW)}${
          Number.isFinite(step.gainedHours) && step.gainedHours >= 1 / 60
            ? `, adds ${formatDuration(step.gainedHours, 'short')}`
            : ''
        }`,
    );
    const medicalOnly = computed.shed.medicalOnlyHours;
    steps.push({
      id: 'shed',
      title: 'Switch off first',
      headline: Number.isFinite(medicalOnly)
        ? `With only medical equipment on, the battery lasts ${formatDuration(medicalOnly)}.`
        : undefined,
      lines,
      tone: 'neutral',
    });
  }

  // 3. Turn down.
  const tune = tuneSuggestions(state);
  if (tune.length) steps.push({ id: 'tune', title: 'Turn down', lines: tune, tone: 'neutral' });

  // 4. When to leave.
  const destination = profile.destinations[0];
  const where = destination?.name || 'somewhere with power';
  const leaveLines = [
    `That leaves ${computed.travelMinutes} min to reach ${where} and ${state.settings.marginMinutes} min to spare.`,
  ];
  let leaveHeadline: string;
  let leaveTone: PlanStep['tone'] = 'act';
  if (
    !Number.isFinite(computed.hours) ||
    state.sources.length === 0 ||
    computed.estimate.loads.count === 0
  ) {
    leaveHeadline = 'Add your devices and battery to work out when to leave.';
    leaveTone = 'neutral';
  } else if (computed.inOutage) {
    const leaveAt = computed.leaveAt as Date;
    leaveHeadline =
      leaveAt.getTime() - now.getTime() < 60_000
        ? 'Leave now.'
        : `Leave by ${formatClock(leaveAt, now)}.`;
    if (leaveHeadline === 'Leave now.') leaveTone = 'urgent';
  } else if (computed.leaveAfterHours <= 0) {
    leaveHeadline =
      'Leave as soon as the power goes out: the battery will not last long enough to wait.';
    leaveTone = 'urgent';
  } else {
    const at = new Date(now.getTime() + computed.leaveAfterHours * 3_600_000);
    leaveHeadline = options.forCard
      ? `Leave ${formatDuration(computed.leaveAfterHours)} after the power goes out.`
      : `Leave ${formatDuration(computed.leaveAfterHours)} after the power goes out (by ${formatClock(at, now)} if it went out now).`;
  }
  steps.push({
    id: 'leave',
    title: 'When to leave',
    headline: leaveHeadline,
    lines: leaveLines,
    tone: leaveTone,
  });

  // 5. Where to go.
  const goLines: string[] = [];
  if (destination) {
    goLines.push(
      [destination.name, destination.address, destination.phone]
        .filter((part) => part.trim())
        .join(' · '),
    );
    for (const alternate of profile.destinations.slice(1)) {
      goLines.push(
        `Or: ${[alternate.name, alternate.address, alternate.phone].filter((part) => part.trim()).join(' · ')}`,
      );
    }
  } else {
    goLines.push(
      'Decide now: family or friends with power, a hospital, or a community cooling or warming center.',
    );
  }
  steps.push({ id: 'go', title: 'Where to go', lines: goLines, tone: 'neutral' });

  // 6. If the battery runs out.
  const backup: string[] = [];
  const oxygen = profile.oxygen;
  if (oxygen && computed.oxygenHours !== null) {
    const size =
      oxygen.cylinderSize === 'custom' ? `${oxygen.customLitres} L` : oxygen.cylinderSize;
    backup.push(
      `Switch to oxygen cylinders: ${oxygen.cylinderCount} × ${size} at ${oxygen.flowLpm} L/min last about ${formatDuration(computed.oxygenHours)}.`,
    );
  }
  for (const battery of computed.internalBatteries) {
    backup.push(
      `${battery.deviceName} has its own battery: about ${formatDuration(battery.hours)}${battery.note ? ` (${battery.note})` : ''}.`,
    );
  }
  if (profile.equipmentLocation) backup.push(`Supplies are kept: ${profile.equipmentLocation}.`);
  backup.push('Call 911 if anyone has trouble breathing, chest pain, or becomes confused.');
  steps.push({ id: 'backup', title: 'If the battery runs out', lines: backup, tone: 'urgent' });

  // 7. Who to call.
  const help = ['Emergency: 911'];
  for (const contact of profile.contacts) {
    const relation = contact.relation ? ` (${contact.relation})` : '';
    help.push(`${contact.name}${relation}: ${contact.phone}`);
  }
  steps.push({ id: 'help', title: 'Who to call', lines: help, tone: 'neutral' });

  return steps;
}
