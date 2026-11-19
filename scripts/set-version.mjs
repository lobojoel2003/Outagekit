// Sets one version across the monorepo and opens a changelog section for it.
// Usage: pnpm version:set 1.2.0
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  androidVersionCode,
  PACKAGE_FILES,
  readJson,
  root,
  SEMVER,
  writeJson,
} from './versions.mjs';

const version = process.argv[2]?.replace(/^v/, '');
if (!version || !SEMVER.test(version)) {
  console.error('Usage: pnpm version:set <major.minor.patch>');
  process.exit(1);
}
androidVersionCode(version);

for (const file of PACKAGE_FILES) {
  const data = readJson(file);
  data.version = version;
  writeJson(file, data);
  console.log(`${file} -> ${version}`);
}

const changelogPath = join(root, 'CHANGELOG.md');
const changelog = readFileSync(changelogPath, 'utf8');
const heading = `## [${version}]`;
if (!changelog.includes(heading)) {
  const today = new Date().toISOString().slice(0, 10);
  const updated = changelog.replace('## [Unreleased]', `## [Unreleased]\n\n${heading} - ${today}`);
  writeFileSync(changelogPath, updated);
  console.log(`CHANGELOG.md: opened section ${heading} - ${today}`);
}

console.log(`
Next:
  git commit -am "Release v${version}"
  git tag -a v${version} -m "Outagekit v${version}"
  git push origin main --follow-tags`);
