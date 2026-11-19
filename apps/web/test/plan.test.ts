import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { cardContent, stateForCard } from '../src/lib/card';
import { compute } from '../src/lib/compute';
import {
  dialParts,
  formatClock,
  formatPercent,
  formatTemperature,
  formatWatts,
  formatWh,
} from '../src/lib/format';
import { recurringReminderIcs } from '../src/lib/ics';
import { plannedChargeReminders, plannedOutageAlerts } from '../src/lib/notify';
import { buildCardPdf, cardFileName, fitScale, pdfSafe } from '../src/lib/pdf';
import { buildPlan, tuneSuggestions } from '../src/lib/plan';
import { parseRoute, hrefFor } from '../src/lib/router';
import { deviceFromCatalog } from '../src/state/factories';
import { devices } from '@outagekit/runtime';
import { NOW, testState } from './helpers';

function fullProfile() {
  const state = testState();
  state.profile = {
    ...state.profile,
    personName: 'Rosa Díaz',
    address: '12 Elm St',
    phone: '555-0100',
    medicalNote: 'COPD, oxygen 2 L/min',
    equipmentLocation: 'Hall closet',
    utilityName: 'City Power',
    utilityPhone: '555-0199',
    utilityAccount: 'A-1',
    contacts: [{ id: 'c', name: 'Ana', relation: 'Daughter', phone: '555-0101' }],
    destinations: [
      { id: 'd', name: "Ana's house", address: '9 Oak Ave', phone: '555-0101', travelMinutes: 20 },
      { id: 'e', name: 'General Hospital', address: '', phone: '', travelMinutes: 15 },
    ],
    oxygen: { cylinderCount: 2, cylinderSize: 'E', customLitres: 0, flowLpm: 2 },
    extraNotes: 'Key under the mat → not really',
  };
  return state;
}

describe('buildPlan', () => {
  it('puts the steps in order', () => {
    const state = testState();
    const steps = buildPlan(state, compute(state, NOW), NOW);
    expect(steps.map((s) => s.id)).toEqual([
      'start',
      'shed',
      'tune',
      'leave',
      'go',
      'backup',
      'help',
    ]);
    expect(steps[1]?.lines[0]).toMatch(/^TV: saves 100 W, adds/);
    expect(steps[1]?.headline).toMatch(/With only medical equipment on, the battery lasts/);
  });

  it('uses the profile when it is filled in', () => {
    const state = fullProfile();
    const steps = buildPlan(state, compute(state, NOW), NOW);
    const text = JSON.stringify(steps);
    expect(text).toContain('Call City Power on 555-0199');
    expect(text).toContain('Account A-1');
    expect(text).toContain("Ana's house · 9 Oak Ave · 555-0101");
    expect(text).toContain('Or: General Hospital');
    expect(text).toContain('2 × E at 2 L/min last about 10 hours 10 minutes');
    expect(text).toContain('Supplies are kept: Hall closet');
    expect(text).toContain('Ana (Daughter): 555-0101');
    expect(text).toContain('20 min to reach');
  });

  it('says to leave straight away when the battery is small', () => {
    const state = testState();
    state.sources[0]!.capacityWh = 300;
    const leave = buildPlan(state, compute(state, NOW), NOW).find((s) => s.id === 'leave');
    expect(leave?.tone).toBe('urgent');
    expect(leave?.headline).toMatch(/as soon as the power goes out/);
  });

  it('gives a clock time during an outage', () => {
    const state = {
      ...testState(),
      outage: {
        startedAt: NOW.toISOString(),
        segmentStartedAt: NOW.toISOString(),
        segmentFraction: 1,
        chargeAtStart: { ps: 1 },
      },
    };
    const leave = buildPlan(state, compute(state, NOW), NOW).find((s) => s.id === 'leave');
    expect(leave?.headline).toMatch(/^Leave by /);
    const late = new Date(NOW.getTime() + 10 * 3_600_000);
    const urgent = buildPlan(state, compute(state, late), late).find((s) => s.id === 'leave');
    expect(urgent?.headline).toBe('Leave now.');
  });

  it('asks for devices when nothing is on', () => {
    const state = testState({ devices: [], sources: [] });
    const steps = buildPlan(state, compute(state, NOW), NOW, { forCard: true });
    expect(steps.find((s) => s.id === 'leave')?.headline).toMatch(/Add your devices/);
    expect(steps[0]?.lines[0]).toMatch(/Get a battery/);
    expect(steps.map((s) => s.id)).not.toContain('shed');
  });

  it('suggests turning off a CPAP humidifier but never oxygen flow', () => {
    const cpap = devices.find((d) => d.category === 'cpap' && d.settings.length > 1)!;
    const highest = [...cpap.settings].sort((a, b) => b.watts - a.watts)[0]!;
    const state = testState({
      devices: [{ ...deviceFromCatalog(cpap, highest.id) }, ...testState().devices],
    });
    const lines = tuneSuggestions(state);
    expect(lines[0]).toMatch(/switch to/);
    expect(lines.join(' ')).toMatch(/Keep your prescribed oxygen flow/);
  });
});

describe('fridge card', () => {
  it('assumes a full charge', () => {
    const state = testState();
    state.sources[0]!.chargedTo = 0.3;
    const card = stateForCard(state, NOW);
    expect(card.sources[0]?.chargedTo).toBe(1);
    expect(card.outage).toBeNull();
  });

  it('collects the content', () => {
    const content = cardContent(fullProfile(), NOW, '1.2.3');
    expect(content.criticalLine).toContain('Oxygen concentrator');
    expect(content.runtimeAll).toMatch(/h/);
    expect(content.runtimeMedical).toMatch(/h/);
    expect(content.leaveSub).toBe('after the power goes out');
    expect(content.footer).toContain('1.2.3');
    expect(content.devices[0]).toMatchObject({ name: 'Oxygen concentrator', watts: '300 W avg' });
  });

  it('builds a one-page PDF on Letter and A4', async () => {
    for (const paper of ['letter', 'a4'] as const) {
      const bytes = await buildCardPdf(cardContent(fullProfile(), NOW, '1.0.0'), paper);
      const pdf = await PDFDocument.load(bytes);
      expect(pdf.getPageCount()).toBe(1);
      expect(pdf.getTitle()).toBe('Power outage plan for Rosa Díaz');
    }
  });

  it('still fits on one page with a long plan', async () => {
    const state = fullProfile();
    for (let i = 0; i < 25; i++) {
      state.profile.contacts.push({
        id: `x${i}`,
        name: `Contact ${i}`,
        relation: 'Neighbor',
        phone: '555-0000',
      });
    }
    const pdf = await PDFDocument.load(await buildCardPdf(cardContent(state, NOW, '1.0.0')));
    expect(pdf.getPageCount()).toBe(1);
  });

  it('cleans text for the built-in fonts', () => {
    expect(pdfSafe('≥ 2 → 3 ✓ café — “ok” ≈ 漢')).toBe('>= 2 -> 3 v café — “ok” ~ ?');
    expect(pdfSafe('a\tb\nc')).toBe('a b c');
  });

  it('finds the biggest scale that fits', () => {
    expect(fitScale((s) => s * 100, 1000)).toBeCloseTo(1.15, 5);
    expect(fitScale((s) => s * 1000, 800)).toBeCloseTo(0.8, 5);
    expect(fitScale(() => 99999, 10)).toBe(0.55);
  });

  it('names the file after the person', () => {
    expect(cardFileName('Rosa Díaz')).toBe('outage-plan-rosa-diaz.pdf');
    expect(cardFileName('')).toBe('outage-plan.pdf');
  });
});

describe('reminders', () => {
  it('plans charge reminders only when turned on', () => {
    const state = testState();
    expect(plannedChargeReminders(state, NOW)).toEqual([]);
    state.settings.remindersEnabled = true;
    const planned = plannedChargeReminders(state, NOW);
    expect(planned).toHaveLength(6);
    expect(planned[0]?.at.toISOString()).toBe(
      new Date(NOW.getTime() + 30 * 86_400_000).toISOString(),
    );
    expect(planned[1]!.at.getTime() - planned[0]!.at.getTime()).toBe(30 * 86_400_000);
  });

  it('fires an overdue reminder straight away', () => {
    const state = testState();
    state.settings.remindersEnabled = true;
    state.sources[0]!.lastChargedAt = '2026-01-01T00:00:00Z';
    expect(plannedChargeReminders(state, NOW)[0]?.at.getTime()).toBe(NOW.getTime() + 60_000);
  });

  it('plans outage alerts', () => {
    const state = {
      ...testState(),
      outage: {
        startedAt: NOW.toISOString(),
        segmentStartedAt: NOW.toISOString(),
        segmentFraction: 1,
        chargeAtStart: { ps: 1 },
      },
    };
    const alerts = plannedOutageAlerts(state, compute(state, NOW), NOW);
    expect(alerts.map((a) => a.title)).toEqual([
      'Time to leave',
      'One hour of battery left',
      'Battery may be empty',
    ]);
    expect(plannedOutageAlerts(testState(), compute(testState(), NOW), NOW)).toEqual([]);
  });

  it('writes a repeating calendar event', () => {
    const ics = recurringReminderIcs({
      uid: 'abc',
      title: 'Charge the power station; and test it',
      description:
        'Line one\nLine two, with a very long sentence that needs folding because calendar lines are short',
      start: NOW,
      intervalDays: 30,
      now: NOW,
    });
    expect(ics).toContain('RRULE:FREQ=DAILY;INTERVAL=30');
    expect(ics).toContain('DTSTART:20261119T200000Z');
    expect(ics).toContain('SUMMARY:Charge the power station\\; and test it');
    expect(ics).toContain('BEGIN:VALARM');
    expect(ics.split('\r\n').every((line) => line.length <= 75)).toBe(true);
  });
});

describe('formatting and routing', () => {
  it('formats values', () => {
    expect(formatWatts(61.2)).toBe('61.2 W');
    expect(formatWatts(1234.4)).toBe('1,234 W');
    expect(formatWatts(Number.NaN)).toBe('—');
    expect(formatWh(1024.4)).toBe('1,024 Wh');
    expect(formatPercent(0.456)).toBe('46%');
    expect(formatTemperature(20, 'F')).toBe('68 °F');
    expect(formatTemperature(-3.4, 'C')).toBe('-3 °C');
  });

  it('splits the dial reading', () => {
    expect(dialParts(7 + 20 / 60)).toEqual({ main: '7 h', sub: '20 min' });
    expect(dialParts(0.75)).toEqual({ main: '45 min', sub: '' });
    expect(dialParts(30)).toEqual({ main: '1 d', sub: '6 h' });
    expect(dialParts(Number.POSITIVE_INFINITY)).toEqual({ main: '—', sub: '' });
  });

  it('formats clock times relative to now', () => {
    const now = new Date(2026, 10, 19, 20, 0);
    expect(formatClock(new Date(2026, 10, 19, 23, 40), now)).toBe('11:40 PM');
    expect(formatClock(new Date(2026, 10, 20, 3, 40), now)).toBe('Fri 3:40 AM');
    expect(formatClock(new Date(2026, 11, 25, 9, 0), now)).toBe('Dec 25, 9:00 AM');
  });

  it('parses routes', () => {
    expect(parseRoute('#/card')).toBe('card');
    expect(parseRoute('#/nope')).toBe('home');
    expect(parseRoute('')).toBe('home');
    expect(hrefFor('home')).toBe('#/');
    expect(hrefFor('about')).toBe('#/about');
  });
});
