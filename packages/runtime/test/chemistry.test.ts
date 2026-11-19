import { describe, expect, it } from 'vitest';
import {
  CHEMISTRY,
  MIN_MODELLED_HEALTH,
  chemistryProfile,
  clamp,
  peukertFactor,
  stateOfHealth,
  temperatureFactor,
  type Chemistry,
} from '../src/index.js';

const ALL: Chemistry[] = ['lifepo4', 'nmc', 'agm', 'gel', 'flooded'];

describe('clamp', () => {
  it('keeps values inside the range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
  it('treats NaN as the minimum', () => {
    expect(clamp(Number.NaN, 0.2, 1)).toBe(0.2);
  });
});

describe('chemistry profiles', () => {
  it('has sane numbers for every chemistry', () => {
    for (const chemistry of ALL) {
      const p = CHEMISTRY[chemistry];
      expect(p.usableFraction).toBeGreaterThan(0.4);
      expect(p.usableFraction).toBeLessThanOrEqual(1);
      expect(p.peukertExponent).toBeGreaterThanOrEqual(1);
      expect(p.cyclesTo80).toBeGreaterThan(0);
      expect(p.checkIntervalDays).toBeGreaterThan(0);
      const temps = p.temperatureCurve.map(([t]) => t);
      expect([...temps].sort((a, b) => a - b)).toEqual(temps);
      expect(p.temperatureCurve.at(-1)?.[1]).toBe(1);
    }
  });

  it('rejects unknown chemistries', () => {
    expect(() => chemistryProfile('nicad' as Chemistry)).toThrow(RangeError);
  });

  it('only gives lead-acid a Peukert penalty', () => {
    expect(CHEMISTRY.lifepo4.leadAcid).toBe(false);
    expect(CHEMISTRY.agm.leadAcid).toBe(true);
    expect(CHEMISTRY.lifepo4.peukertExponent).toBe(1);
  });
});

describe('stateOfHealth', () => {
  it('is 1 for a new battery', () => {
    expect(stateOfHealth({ chemistry: 'lifepo4' })).toBe(1);
  });

  it('applies calendar fade per year', () => {
    expect(stateOfHealth({ chemistry: 'nmc', ageYears: 2 })).toBeCloseTo(0.94, 10);
    expect(stateOfHealth({ chemistry: 'agm', ageYears: 3 })).toBeCloseTo(0.85, 10);
  });

  it('loses 20% over the rated cycle life', () => {
    expect(stateOfHealth({ chemistry: 'nmc', cycles: 500 })).toBeCloseTo(0.8, 10);
    expect(stateOfHealth({ chemistry: 'lifepo4', cycles: 1500 })).toBeCloseTo(0.9, 10);
  });

  it('uses a manufacturer cycle rating when given', () => {
    expect(stateOfHealth({ chemistry: 'lifepo4', cycles: 1000, cycleLifeTo80: 4000 })).toBeCloseTo(
      0.95,
      10,
    );
    expect(stateOfHealth({ chemistry: 'lifepo4', cycles: 1000, cycleLifeTo80: 0 })).toBeCloseTo(
      1 - 0.2 / 3,
      10,
    );
  });

  it('never models below the floor', () => {
    expect(stateOfHealth({ chemistry: 'flooded', ageYears: 40 })).toBe(MIN_MODELLED_HEALTH);
  });

  it('ignores negative age and cycles', () => {
    expect(stateOfHealth({ chemistry: 'gel', ageYears: -3, cycles: -10 })).toBe(1);
  });

  it('prefers a measured state of health', () => {
    expect(stateOfHealth({ chemistry: 'nmc', ageYears: 9, stateOfHealth: 0.88 })).toBe(0.88);
    expect(stateOfHealth({ chemistry: 'nmc', stateOfHealth: 1.4 })).toBe(1);
  });
});

describe('temperatureFactor', () => {
  it('is 1 at room temperature and above', () => {
    for (const chemistry of ALL) {
      expect(temperatureFactor(chemistry, 20)).toBe(1);
      expect(temperatureFactor(chemistry, 35)).toBe(1);
    }
  });

  it('interpolates between points', () => {
    expect(temperatureFactor('lifepo4', 5)).toBeCloseTo((0.82 + 0.92) / 2, 10);
    expect(temperatureFactor('agm', -5)).toBeCloseTo((0.65 + 0.78) / 2, 10);
    expect(temperatureFactor('nmc', 0)).toBeCloseTo(0.85, 10);
  });

  it('clamps below the coldest point', () => {
    expect(temperatureFactor('lifepo4', -40)).toBe(0.55);
  });

  it('falls as it gets colder', () => {
    let previous = Infinity;
    for (let t = 20; t >= -20; t -= 5) {
      const f = temperatureFactor('nmc', t);
      expect(f).toBeLessThanOrEqual(previous);
      previous = f;
    }
  });
});

describe('peukertFactor', () => {
  it('is 1 for lithium at any rate', () => {
    expect(peukertFactor('lifepo4', 1000, 5000)).toBe(1);
  });

  it('is 1 at or below the rated draw', () => {
    // 1200 Wh at a 20-hour rating is 60 W.
    expect(peukertFactor('agm', 1200, 60)).toBe(1);
    expect(peukertFactor('agm', 1200, 20)).toBe(1);
  });

  it('cuts lead-acid capacity at high draw', () => {
    expect(peukertFactor('agm', 1200, 300)).toBeCloseTo((60 / 300) ** 0.15, 10);
    expect(peukertFactor('flooded', 1200, 300)).toBeLessThan(peukertFactor('agm', 1200, 300));
  });

  it('is 1 for no draw or no capacity', () => {
    expect(peukertFactor('agm', 1200, 0)).toBe(1);
    expect(peukertFactor('agm', 0, 300)).toBe(1);
  });
});
