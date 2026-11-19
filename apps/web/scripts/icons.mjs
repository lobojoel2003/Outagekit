// Renders the app icons from the SVG logo. Run with: pnpm --filter @outagekit/web icons
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');

// Standard icon: rounded square.
const rounded = (
  size,
) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
<rect width="64" height="64" rx="15" fill="#0b1220"/>
<circle cx="32" cy="32" r="20" fill="none" stroke="#23304a" stroke-width="7"/>
<path d="M32 12a20 20 0 1 1-19.02 13.82" fill="none" stroke="#f5a524" stroke-width="7" stroke-linecap="round"/>
<path d="M34.5 20 25 34h6.5l-2 10L39 30h-6.5l2-10Z" fill="#fff"/></svg>`;

// Full-bleed icon with the mark inside the maskable safe zone (inner 80%).
const fullBleed = (size, scale = 0.62) => {
  const offset = (64 - 64 * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
<rect width="64" height="64" fill="#0b1220"/>
<g transform="translate(${offset} ${offset}) scale(${scale})">
<circle cx="32" cy="32" r="20" fill="none" stroke="#23304a" stroke-width="7"/>
<path d="M32 12a20 20 0 1 1-19.02 13.82" fill="none" stroke="#f5a524" stroke-width="7" stroke-linecap="round"/>
<path d="M34.5 20 25 34h6.5l-2 10L39 30h-6.5l2-10Z" fill="#fff"/></g></svg>`;
};

// Adaptive icon foreground: transparent, mark inside the 66dp safe circle.
const foreground = (
  size,
) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 108 108">
<g transform="translate(27 27) scale(0.84375)">
<circle cx="32" cy="32" r="20" fill="none" stroke="#23304a" stroke-width="7"/>
<path d="M32 12a20 20 0 1 1-19.02 13.82" fill="none" stroke="#f5a524" stroke-width="7" stroke-linecap="round"/>
<path d="M34.5 20 25 34h6.5l-2 10L39 30h-6.5l2-10Z" fill="#fff"/></g></svg>`;

// Round launcher icon for older Android versions.
const round = (
  size,
) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
<circle cx="32" cy="32" r="32" fill="#0b1220"/>
<g transform="translate(5 5) scale(0.84375)">
<circle cx="32" cy="32" r="20" fill="none" stroke="#23304a" stroke-width="7"/>
<path d="M32 12a20 20 0 1 1-19.02 13.82" fill="none" stroke="#f5a524" stroke-width="7" stroke-linecap="round"/>
<path d="M34.5 20 25 34h6.5l-2 10L39 30h-6.5l2-10Z" fill="#fff"/></g></svg>`;

// Splash screen: the mark centred on the app's dark background.
const splash = (width, height) => {
  const mark = Math.round(Math.min(width, height) * 0.28);
  const x = (width - mark) / 2;
  const y = (height - mark) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<rect width="${width}" height="${height}" fill="#0b1220"/>
<g transform="translate(${x} ${y}) scale(${mark / 64})">
<circle cx="32" cy="32" r="20" fill="none" stroke="#23304a" stroke-width="7"/>
<path d="M32 12a20 20 0 1 1-19.02 13.82" fill="none" stroke="#f5a524" stroke-width="7" stroke-linecap="round"/>
<path d="M34.5 20 25 34h6.5l-2 10L39 30h-6.5l2-10Z" fill="#fff"/></g></svg>`;
};

// Monochrome notification icon for Android (white on transparent).
const notification = (
  size,
) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">
<path d="M13.2 2 5 13.5h6.2L10 22l8.5-11.5h-6.2L13.2 2Z" fill="#fff"/></svg>`;

async function png(svg, size, file, height = size) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(
    file,
    await sharp(Buffer.from(svg)).resize(size, height).png({ compressionLevel: 9 }).toBuffer(),
  );
  console.log('wrote', file.replace(root + '/', ''));
}

await png(rounded(512), 192, join(pub, 'pwa-192.png'));
await png(rounded(1024), 512, join(pub, 'pwa-512.png'));
await png(fullBleed(1024, 0.7), 512, join(pub, 'maskable-512.png'));
await png(fullBleed(512, 0.72), 180, join(pub, 'apple-touch-icon.png'));
await png(rounded(1024), 1024, join(root, '..', '..', 'docs', 'images', 'icon.png'));

// Android launcher and notification icons, when the Android project exists.
const res = join(root, 'android', 'app', 'src', 'main', 'res');
const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
try {
  const { stat } = await import('node:fs/promises');
  await stat(res);
  for (const [name, factor] of Object.entries(densities)) {
    const dir = join(res, `mipmap-${name}`);
    await png(rounded(512), Math.round(48 * factor), join(dir, 'ic_launcher.png'));
    await png(round(512), Math.round(48 * factor), join(dir, 'ic_launcher_round.png'));
    await png(foreground(1024), Math.round(108 * factor), join(dir, 'ic_launcher_foreground.png'));
    await png(
      notification(96),
      Math.round(24 * factor),
      join(res, `drawable-${name}`, 'ic_stat_outagekit.png'),
    );
  }
  const splashes = {
    drawable: [480, 320],
    'drawable-land-mdpi': [480, 320],
    'drawable-land-hdpi': [800, 480],
    'drawable-land-xhdpi': [1280, 720],
    'drawable-land-xxhdpi': [1600, 960],
    'drawable-land-xxxhdpi': [1920, 1280],
    'drawable-port-mdpi': [320, 480],
    'drawable-port-hdpi': [480, 800],
    'drawable-port-xhdpi': [720, 1280],
    'drawable-port-xxhdpi': [960, 1600],
    'drawable-port-xxxhdpi': [1280, 1920],
  };
  for (const [dir, [w, h]] of Object.entries(splashes)) {
    await png(splash(w, h), w, join(res, dir, 'splash.png'), h);
  }
} catch {
  console.log('No Android project yet; skipped launcher icons.');
}
