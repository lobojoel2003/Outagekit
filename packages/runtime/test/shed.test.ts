import { describe, expect, it } from 'vitest';
import { leaveAfterHours, planLoadShedding, type Load, type PowerSource } from '../src/index.js';

const station: PowerSource = { id: 'ps', name: 'Station', capacityWh: 1024, chemistry: 'lifepo4' };

const loads: Load[] = [
  { id: 'o2', name: 'Concentrator', watts: 300, priority: 'life-sustaining' },
  { id: 'cpap', name: 'CPAP', watts: 50, priority: 'medical' },
  { id: 'fridge', name: 'Fridge', watts: 150, dutyCycle: 0.4, idleWatts: 2, priority: 'essential' },
  { id: 'router', name: 'Router', watts: 12, priority: 'essential' },
  { id: 'tv', name: 'TV', watts: 80, priority: 'comfort' },
  { id: 'lamp', name: 'Lamp', watts: 9, priority: 'comfort' },
  { id: 'off', name: 'Heater', watts: 1500, priority: 'comfort', enabled: false },
  { id: 'zero', name: 'Clock', watts: 0, priority: 'comfort' },
];

describe('planLoadShedding', () => {
  const plan = planLoadShedding(loads, station);

  it('sheds comfort before essential, biggest first', () => {
    expect(plan.steps.map((s) => s.load.id)).toEqual(['tv', 'lamp', 'fridge', 'router']);
  });

  it('never suggests medical or life-sustaining devices by default', () => {
    const ids = plan.steps.map((s) => s.load.id);
    expect(ids).not.toContain('o2');
    expect(ids).not.toContain('cpap');
  });

  it('gains time at every step', () => {
    let previous = plan.baselineHours;
    for (const step of plan.steps) {
      expect(step.hoursAfter).toBeGreaterThan(previous);
      expect(step.gainedHours).toBeCloseTo(step.hoursAfter - previous, 10);
      previous = step.hoursAfter;
    }
    expect(plan.steps[0]?.savedW).toBe(80);
  });

  it('ends at the medical-only runtime', () => {
    expect(plan.steps.at(-1)?.hoursAfter).toBeCloseTo(plan.medicalOnlyHours, 10);
    expect(plan.lifeSustainingOnlyHours).toBeGreaterThan(plan.medicalOnlyHours);
  });

  it('can include medical devices when asked', () => {
    const wider = planLoadShedding(
      loads,
      station,
      {},
      { sheddable: ['comfort', 'essential', 'medical'] },
    );
    expect(wider.steps.at(-1)?.load.id).toBe('cpap');
    expect(wider.steps.at(-1)?.hoursAfter).toBeCloseTo(wider.lifeSustainingOnlyHours, 10);
  });

  it('treats a load with no priority as essential', () => {
    const plain = planLoadShedding([{ id: 'a', name: 'A', watts: 10 }], station);
    expect(plain.steps).toHaveLength(1);
    expect(plain.medicalOnlyHours).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('leaveAfterHours', () => {
  it('subtracts travel and margin', () => {
    expect(leaveAfterHours(7)).toBeCloseTo(5.5, 10);
    expect(leaveAfterHours(7, { travelMinutes: 45, marginMinutes: 15 })).toBeCloseTo(6, 10);
  });

  it('says leave now when time is short', () => {
    expect(leaveAfterHours(1)).toBe(0);
    expect(leaveAfterHours(0.5, { travelMinutes: -10, marginMinutes: -10 })).toBe(0.5);
  });

  it('has no limit for an endless runtime', () => {
    expect(leaveAfterHours(Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY);
  });
});
