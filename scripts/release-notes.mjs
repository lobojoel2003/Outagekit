// Prints the CHANGELOG.md section for a version, for the GitHub release body.
// Usage: node scripts/release-notes.mjs 1.2.0
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { root } from './versions.mjs';

const version = process.argv[2]?.replace(/^v/, '');
if (!version) {
  console.error('Usage: node scripts/release-notes.mjs <version>');
  process.exit(1);
}
const lines = readFileSync(join(root, 'CHANGELOG.md'), 'utf8').split('\n');
const start = lines.findIndex((line) => line.startsWith(`## [${version}]`));
if (start === -1) {
  console.log(`Outagekit ${version}.`);
  process.exit(0);
}
let end = lines.findIndex((line, i) => i > start && /^## \[/.test(line));
if (end === -1) end = lines.length;
const body = lines
  .slice(start + 1, end)
  .filter((line) => !/^\[[^\]]+\]: /.test(line))
  .join('\n')
  .trim();
console.log(body);
