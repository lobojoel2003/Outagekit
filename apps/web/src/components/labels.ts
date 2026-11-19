import type { Chemistry, Priority, SourceKind, Supply } from '@outagekit/runtime';

export const PRIORITY_OPTIONS: ReadonlyArray<{ value: Priority; label: string }> = [
  { value: 'life-sustaining', label: 'Life-sustaining' },
  { value: 'medical', label: 'Medical' },
  { value: 'essential', label: 'Essential' },
  { value: 'comfort', label: 'Comfort' },
];

export const PRIORITY_LABEL: Record<Priority, string> = {
  'life-sustaining': 'Life-sustaining',
  medical: 'Medical',
  essential: 'Essential',
  comfort: 'Comfort',
};

export const SUPPLY_OPTIONS: ReadonlyArray<{ value: Supply; label: string }> = [
  { value: 'ac', label: 'AC outlet' },
  { value: 'dc', label: '12 V / USB' },
];

export const CHEMISTRY_OPTIONS: ReadonlyArray<{ value: Chemistry; label: string }> = [
  { value: 'lifepo4', label: 'LiFePO4 (most power stations)' },
  { value: 'nmc', label: 'Lithium-ion (NMC)' },
  { value: 'agm', label: 'Lead-acid AGM' },
  { value: 'gel', label: 'Lead-acid gel' },
  { value: 'flooded', label: 'Lead-acid flooded' },
];

export const KIND_OPTIONS: ReadonlyArray<{ value: SourceKind; label: string }> = [
  { value: 'power-station', label: 'Power station' },
  { value: 'battery-inverter', label: 'Battery + inverter' },
  { value: 'ups', label: 'UPS (battery backup)' },
];
