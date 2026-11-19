import { describe, expect, it } from 'vitest';
import {
  DC_ADAPTER_EFFICIENCY,
  estimateRuntime,
  estimateSourceRuntime,
  formatDuration,
  resolveSource,
  summarizeLoads,
  type Load,
  type PowerSource,
} from '../src/index.js';

const concentrator: Load = {
  id: 'o2',
  name: 'Oxygen concentrator',
  watts: 300,
  priority: 'life-sustaining',
};

const station: PowerSource = {
  id: 'ps',
  name: 'Power station',
  capacityWh: 1024,
  chemistry: 'lifepo4',
};

describe('resolveSource', () => {
  it('fills defaults for a power station', () => {
    const r = resolveSource(station);
    expect(r).toMatchObject({
      kind: 'power-station',
      stateOfCharge: 1,
      health: 1,
      usableFraction: 0.95,
      inverterEfficiency: 0.9,
      dcEfficiency: 0.92,
      inverterIdleWatts: 10,
      hasDcOutput: true,
    });
  });

  it('scales inverter idle draw with the rating', () => {
    expect(resolveSource({ ...station, acOutputWatts: 1800 }).inverterIdleWatts).toBeCloseTo(
      10.8,
      10,
    );
    expect(resolveSource({ ...station, acOutputWatts: 300 }).inverterIdleWatts).toBe(5);
  });

  it('uses kind defaults for a UPS and a battery with inverter', () => {
    const ups = resolveSource({ ...station, kind: 'ups', chemistry: 'agm' });
    expect(ups.hasDcOutput).toBe(false);
    expect(ups.inverterEfficiency).toBe(0.8);
    expect(ups.inverterIdleWatts).toBe(15);
    const bi = resolveSource({ ...station, kind: 'battery-inverter', acOutputWatts: 2000 });
    expect(bi.inverterEfficiency).toBe(0.88);
    expect(bi.inverterIdleWatts).toBe(20);
  });

  it('accepts explicit overrides and clamps them', () => {
    const r = resolveSource({
      ...station,
      stateOfCharge: 1.5,
      usableFraction: 0.8,
      inverterEfficiency: 0.95,
      inverterIdleWatts: 0,
      dcEfficiency: 2,
      hasDcOutput: false,
    });
    expect(r.stateOfCharge).toBe(1);
    expect(r.usableFraction).toBe(0.8);
    expect(r.inverterEfficiency).toBe(0.95);
    expect(r.inverterIdleWatts).toBe(0);
    expect(r.dcEfficiency).toBe(1);
    expect(r.hasDcOutput).toBe(false);
  });

  it('ignores nonsense efficiencies', () => {
    const r = resolveSource({ ...station, inverterEfficiency: 0, dcEfficiency: Number.NaN });
    expect(r.inverterEfficiency).toBe(0.9);
    expect(r.dcEfficiency).toBe(0.92);
  });
});

describe('estimateRuntime', () => {
  it('runs a 300 W concentrator on a 1 kWh station for about 2 h 50 min', () => {
    const estimate = estimateRuntime([concentrator], station);
    const [source] = estimate.sources;
    // 1024 Wh x 0.95 usable = 972.8 Wh; draw = 10 W idle + 300 / 0.9.
    expect(source?.usableWh).toBeCloseTo(972.8, 6);
    expect(source?.drawW).toBeCloseTo(10 + 300 / 0.9, 6);
    expect(source?.inverterIdleW).toBe(10);
    expect(source?.conversionLossW).toBeCloseTo(300 / 0.9 - 300, 6);
    expect(estimate.hours).toBeCloseTo(972.8 / (10 + 300 / 0.9), 10);
    expect(formatDuration(estimate.hours)).toBe('2 hours 50 minutes');
  });

  it('accepts a single source or a list', () => {
    expect(estimateRuntime([concentrator], [station]).hours).toBe(
      estimateRuntime([concentrator], station).hours,
    );
  });

  it('adds sources one after another', () => {
    const single = estimateRuntime([concentrator], station).hours;
    const double = estimateRuntime([concentrator], [station, { ...station, id: 'ps2' }]).hours;
    expect(double).toBeCloseTo(single * 2, 10);
  });

  it('moves at once when a setting changes', () => {
    const high = estimateRuntime([{ ...concentrator, watts: 350 }], station).hours;
    const low = estimateRuntime([{ ...concentrator, watts: 280 }], station).hours;
    expect(low).toBeGreaterThan(high);
  });

  it('scales with state of charge', () => {
    const full = estimateRuntime([concentrator], station).hours;
    const half = estimateRuntime([concentrator], { ...station, stateOfCharge: 0.5 }).hours;
    expect(half).toBeCloseTo(full / 2, 10);
  });

  it('derates for age and cold', () => {
    const base = estimateRuntime([concentrator], station).hours;
    const old = estimateRuntime([concentrator], { ...station, ageYears: 5 }).hours;
    const cold = estimateRuntime([concentrator], station, { temperatureC: 0 }).hours;
    expect(old).toBeCloseTo(base * 0.9, 10);
    expect(cold).toBeCloseTo(base * 0.82, 10);
  });

  it('routes DC loads around the inverter', () => {
    const cpap: Load = { id: 'cpap', name: 'CPAP', watts: 40 };
    const ac = estimateRuntime([cpap], station).sources[0]!;
    const dc = estimateRuntime([{ ...cpap, supply: 'dc' }], station).sources[0]!;
    expect(ac.drawW).toBeCloseTo(10 + 40 / 0.9, 10);
    expect(dc.drawW).toBeCloseTo(40 / 0.92, 10);
    expect(dc.inverterIdleW).toBe(0);
    expect(dc.drawW).toBeLessThan(ac.drawW);
  });

  it('sends DC loads through AC adapters when there are no DC outputs', () => {
    const ups: PowerSource = {
      id: 'ups',
      name: 'UPS',
      kind: 'ups',
      capacityWh: 200,
      chemistry: 'agm',
    };
    const result = estimateRuntime([{ id: 'r', name: 'Router', watts: 10, supply: 'dc' }], ups);
    expect(result.sources[0]?.drawW).toBeCloseTo(15 + 10 / DC_ADAPTER_EFFICIENCY / 0.8, 10);
    expect(result.warnings.map((w) => w.code)).toContain('no-dc-output');
  });

  it('applies Peukert to a lead-acid battery at high draw', () => {
    const agm: PowerSource = {
      id: 'agm',
      name: 'AGM',
      kind: 'battery-inverter',
      capacityWh: 1200,
      chemistry: 'agm',
      acOutputWatts: 1000,
    };
    const result = estimateRuntime([concentrator], agm).sources[0]!;
    expect(result.peukertFactor).toBeLessThan(0.8);
    expect(result.usableWh).toBeCloseTo(1200 * 0.8 * result.peukertFactor, 6);
  });

  it('is infinite with no load and zero with no source', () => {
    expect(estimateRuntime([], station).hours).toBe(Number.POSITIVE_INFINITY);
    expect(estimateRuntime([{ ...concentrator, enabled: false }], station).hours).toBe(
      Number.POSITIVE_INFINITY,
    );
    const none = estimateRuntime([concentrator], []);
    expect(none.hours).toBe(0);
    expect(none.warnings[0]?.code).toBe('no-source');
  });

  it('warns about no load', () => {
    expect(estimateRuntime([], station).warnings.map((w) => w.code)).toEqual(['no-load']);
  });

  it('warns when the inverter is overloaded', () => {
    const heater: Load = { id: 'h', name: 'Space heater', watts: 1500, priority: 'comfort' };
    const small = { ...station, name: 'Explorer 300', acOutputWatts: 300 };
    const warnings = estimateRuntime([concentrator, heater], small).warnings;
    const overload = warnings.find((w) => w.code === 'ac-overload');
    expect(overload?.severity).toBe('danger');
    expect(overload?.message).toContain('1,800 W');
    expect(overload?.message).toContain('300 W');
    expect(warnings.map((w) => w.code)).not.toContain('ac-surge');
  });

  it('warns about start-up surge using the surge rating', () => {
    const fridge: Load = { id: 'f', name: 'Fridge', watts: 150, surgeWatts: 1200, dutyCycle: 0.4 };
    const codes = (source: PowerSource) =>
      estimateRuntime([concentrator, fridge], source).warnings.map((w) => w.code);
    expect(codes({ ...station, acOutputWatts: 600, acSurgeWatts: 1200 })).toContain('ac-surge');
    expect(codes({ ...station, acOutputWatts: 600 })).toContain('ac-surge');
    expect(codes({ ...station, acOutputWatts: 1800, acSurgeWatts: 2700 })).not.toContain(
      'ac-surge',
    );
    expect(codes(station)).not.toContain('ac-surge');
  });

  it('warns about low charge, wear, cold and heat', () => {
    const codes = (source: PowerSource, temperatureC?: number) =>
      estimateRuntime(
        [concentrator],
        source,
        temperatureC === undefined ? {} : { temperatureC },
      ).warnings.map((w) => w.code);
    expect(codes({ ...station, stateOfCharge: 0.3 })).toContain('low-charge');
    expect(codes({ ...station, stateOfHealth: 0.7 })).toContain('worn');
    expect(codes(station, 5)).toContain('cold');
    expect(codes(station, 5)).not.toContain('cold-charging');
    expect(codes(station, -5)).toContain('cold-charging');
    expect(codes({ ...station, chemistry: 'agm' }, -5)).not.toContain('cold-charging');
    expect(codes(station, 45)).toContain('hot');
    expect(codes(station)).toEqual([]);
  });
});

describe('estimateSourceRuntime', () => {
  it('works from a summary directly', () => {
    const summary = summarizeLoads([concentrator]);
    const result = estimateSourceRuntime(summary, station);
    expect(result.sourceId).toBe('ps');
    expect(result.acLoadW).toBe(300);
    expect(result.dcLoadW).toBe(0);
    expect(result.temperatureFactor).toBe(1);
  });
});
