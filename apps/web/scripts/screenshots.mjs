// Takes the README screenshots from a running build with fictional demo data.
//   pnpm --filter @outagekit/web build && pnpm --filter @outagekit/web preview &
//   pnpm screenshots
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..');
const out = join(repo, 'docs', 'images');
const url = process.env.SCREENSHOT_URL ?? 'http://localhost:4173/';
const catalogDir = join(repo, 'packages', 'runtime', 'src', 'catalog');

const { devices } = JSON.parse(await readFile(join(catalogDir, 'devices.json'), 'utf8'));
const { powerSources } = JSON.parse(await readFile(join(catalogDir, 'power-sources.json'), 'utf8'));

const pick = (ids, fallback) => devices.find((d) => ids.includes(d.id)) ?? devices.find(fallback);
const label = (item) => (item.manufacturer ? `${item.manufacturer} ${item.name}` : item.name);

function device(item, uid, settingMatch) {
  const setting =
    item.settings.find((s) => settingMatch && settingMatch.test(s.label)) ??
    item.settings.find((s) => s.id === item.defaultSetting) ??
    item.settings[0];
  return {
    uid,
    catalogId: item.id,
    name: label(item),
    category: item.category,
    settingId: setting.id,
    watts: setting.watts,
    dutyCycle: item.dutyCycle,
    idleWatts: item.idleWatts,
    surgeWatts: item.surgeWatts,
    quantity: 1,
    supply: item.supply,
    priority: item.priority,
    enabled: true,
  };
}

const now = new Date();
const concentrator = pick(['inogen-at-home'], (d) => d.category === 'oxygen-concentrator');
const cpap = pick(['resmed-airsense-10'], (d) => d.category === 'cpap');
const fridge = pick(
  ['generic-full-size-fridge', 'generic-refrigerator'],
  (d) => d.category === 'refrigeration',
);
const router = devices.find(
  (d) => d.category === 'communication' && /router|wi-?fi|modem/i.test(d.name),
);
const phone = devices.find((d) => d.category === 'communication' && /phone/i.test(d.name));
const lamp = devices.find((d) => d.category === 'lighting');
const station =
  powerSources.find((p) => p.id === 'generic-2kwh-lifepo4-power-station') ??
  powerSources.find((p) => p.kind === 'power-station' && p.capacityWh >= 1500) ??
  powerSources[0];

const demo = {
  schemaVersion: 1,
  devices: [
    device(concentrator, 'd1', /2 ?L/i),
    device(cpap, 'd2'),
    device(fridge, 'd3'),
    router && device(router, 'd4'),
    phone && device(phone, 'd5'),
    lamp && device(lamp, 'd6'),
  ].filter(Boolean),
  sources: [
    {
      uid: 's1',
      catalogId: station.id,
      name: label(station),
      kind: station.kind,
      capacityWh: station.capacityWh,
      chemistry: station.chemistry,
      acOutputWatts: station.acOutputWatts,
      acSurgeWatts: station.acSurgeWatts,
      cycleLifeTo80: station.cycleLifeTo80,
      chargedTo: 1,
      lastChargedAt: new Date(now.getTime() - 9 * 86_400_000).toISOString(),
      ageYears: 1,
      cycles: 12,
    },
  ],
  profile: {
    personName: 'Rosa Martinez',
    address: '1428 Elm Street, Springfield',
    phone: '555-0148',
    medicalNote: 'COPD. Oxygen 2 L/min around the clock. CPAP at night.',
    equipmentLocation: 'Power station in the hall closet; oxygen cylinders by the bed',
    utilityName: 'Springfield Electric',
    utilityPhone: '555-0100',
    utilityAccount: '0042-7781',
    contacts: [
      { id: 'c1', name: 'Ana Martinez', relation: 'Daughter', phone: '555-0142' },
      { id: 'c2', name: 'Oxygen supplier', relation: '24-hour line', phone: '555-0177' },
    ],
    destinations: [
      {
        id: 'p1',
        name: "Ana's house",
        address: '22 Oak Avenue',
        phone: '555-0142',
        travelMinutes: 25,
      },
      {
        id: 'p2',
        name: 'Springfield General Hospital',
        address: '900 Main Street',
        phone: '',
        travelMinutes: 15,
      },
    ],
    oxygen: { cylinderCount: 2, cylinderSize: 'E', customLitres: 600, flowLpm: 2 },
    extraNotes: 'Spare key with the neighbor at number 1430.',
  },
  settings: {
    temperatureC: 20,
    temperatureUnit: 'F',
    marginMinutes: 60,
    reminderIntervalDays: 30,
    remindersEnabled: false,
    paper: 'letter',
  },
  outage: null,
  isExample: false,
  cardUpdatedAt: null,
};

const outageState = {
  ...demo,
  outage: {
    startedAt: new Date(now.getTime() - 95 * 60_000).toISOString(),
    segmentStartedAt: new Date(now.getTime() - 95 * 60_000).toISOString(),
    segmentFraction: 1,
    chargeAtStart: { s1: 1 },
  },
};

const browser = await chromium.launch();

async function shot({
  state,
  hash = '',
  width,
  height,
  scheme = 'light',
  file,
  before,
  scale = 2,
  full = false,
}) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: scale,
    colorScheme: scheme,
    serviceWorkers: 'block',
  });
  await context.addInitScript((value) => {
    localStorage.setItem('outagekit:v1', value);
  }, JSON.stringify(state));
  const page = await context.newPage();
  await page.goto(`${url}${hash}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  if (before) await before(page);
  const buffer = await page.screenshot({ fullPage: full, animations: 'disabled' });
  await context.close();
  if (file) {
    await writeFile(join(out, file), buffer);
    console.log('wrote', file);
  }
  return buffer;
}

async function framed(
  buffers,
  file,
  { gap = 48, pad = 56, radius = 44, background = '#e9e5dc' } = {},
) {
  const images = await Promise.all(
    buffers.map(async (buffer) => {
      const meta = await sharp(buffer).metadata();
      const mask = Buffer.from(
        `<svg width="${meta.width}" height="${meta.height}"><rect width="${meta.width}" height="${meta.height}" rx="${radius}" ry="${radius}"/></svg>`,
      );
      return {
        buffer: await sharp(buffer)
          .composite([{ input: mask, blend: 'dest-in' }])
          .png()
          .toBuffer(),
        width: meta.width,
        height: meta.height,
      };
    }),
  );
  const width =
    images.reduce((sum, image) => sum + image.width, 0) + gap * (images.length - 1) + pad * 2;
  const height = Math.max(...images.map((image) => image.height)) + pad * 2;
  let left = pad;
  const composite = images.map((image) => {
    const item = { input: image.buffer, left, top: pad };
    left += image.width + gap;
    return item;
  });
  const canvas = await sharp({ create: { width, height, channels: 4, background } })
    .composite(composite)
    .png()
    .toBuffer();
  await sharp(canvas)
    .resize({ width: Math.min(width, 1400) })
    .png({ compressionLevel: 9 })
    .toFile(join(out, file));
  console.log('wrote', file);
}

await mkdir(out, { recursive: true });

// 1. Desktop hero.
await shot({ state: demo, width: 1280, height: 860, file: 'hero.png' });

// 2. Phone, light and dark.
const light = await shot({ state: demo, width: 390, height: 844, scale: 2 });
const dark = await shot({ state: demo, width: 390, height: 844, scale: 2, scheme: 'dark' });
await framed([light, dark], 'mobile.png');

// 3. Outage mode on a phone.
const outage = await shot({
  state: outageState,
  width: 390,
  height: 844,
  scale: 2,
  scheme: 'dark',
});
await framed([outage], 'outage.png', { background: '#1b2335' });

// 4. Add-device dialog.
await shot({
  state: demo,
  width: 1100,
  height: 760,
  file: 'add-device.png',
  before: async (page) => {
    await page.getByRole('button', { name: 'Add device' }).click();
    await page.getByRole('searchbox').fill('oxygen');
    await page.waitForTimeout(300);
  },
});

// 5. The real PDF card, rendered to an image.
const context = await browser.newContext({ acceptDownloads: true, serviceWorkers: 'block' });
await context.addInitScript(
  (value) => localStorage.setItem('outagekit:v1', value),
  JSON.stringify(demo),
);
const page = await context.newPage();
await page.goto(`${url}#/card`, { waitUntil: 'networkidle' });
const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button', { name: /Download PDF/ }).click(),
]);
const pdfPath = join(out, 'sample-fridge-card.pdf');
await download.saveAs(pdfPath);
console.log('wrote sample-fridge-card.pdf');
await context.close();
try {
  execFileSync('python3', [
    '-c',
    'import sys, pymupdf; d = pymupdf.open(sys.argv[1]); d[0].get_pixmap(dpi=110).save(sys.argv[2])',
    pdfPath,
    join(out, 'fridge-card-raw.png'),
  ]);
  const raw = await readFile(join(out, 'fridge-card-raw.png'));
  await framed([raw], 'fridge-card.png', { radius: 6 });
  const { unlink } = await import('node:fs/promises');
  await unlink(join(out, 'fridge-card-raw.png'));
} catch (error) {
  console.warn(
    'Could not render the PDF (needs python3 with PyMuPDF); using the HTML preview instead.',
    error.message,
  );
  await shot({
    state: demo,
    hash: '#/card',
    width: 900,
    height: 1200,
    file: 'fridge-card.png',
    before: async (p) => {
      await p.addStyleTag({ content: '.no-print,.topbar,.site-footer{display:none!important}' });
    },
  });
}

await browser.close();
