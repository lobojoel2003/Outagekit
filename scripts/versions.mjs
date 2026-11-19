import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Every package.json whose version must move together. */
export const PACKAGE_FILES = [
  'package.json',
  'packages/runtime/package.json',
  'apps/web/package.json',
];

export const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

export function readJson(file) {
  return JSON.parse(readFileSync(join(root, file), 'utf8'));
}

export function writeJson(file, data) {
  writeFileSync(join(root, file), `${JSON.stringify(data, null, 2)}\n`);
}

export function versions() {
  return PACKAGE_FILES.map((file) => ({ file, version: readJson(file).version }));
}

/** Android versionCode for a version: major * 10000 + minor * 100 + patch. */
export function androidVersionCode(version) {
  const match = SEMVER.exec(version);
  if (!match) throw new Error(`Not a semantic version: ${version}`);
  const [major, minor, patch] = match.slice(1, 4).map(Number);
  if (minor > 99 || patch > 99)
    throw new Error('Minor and patch must stay below 100 for the Android versionCode');
  return major * 10000 + minor * 100 + patch;
}
