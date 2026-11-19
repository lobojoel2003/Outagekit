// Checks all packages share one version, and (optionally) that a tag matches it.
// Usage: node scripts/check-version.mjs [v1.2.3]
import { androidVersionCode, SEMVER, versions } from './versions.mjs';

const list = versions();
const unique = [...new Set(list.map((entry) => entry.version))];
if (unique.length !== 1) {
  console.error('Package versions differ:');
  for (const entry of list) console.error(`  ${entry.file}: ${entry.version}`);
  console.error('Run: pnpm version:set <version>');
  process.exit(1);
}
const [version] = unique;
if (!SEMVER.test(version)) {
  console.error(`Version ${version} is not semantic (x.y.z).`);
  process.exit(1);
}
const tag = process.argv[2];
if (tag && tag !== `v${version}`) {
  console.error(`Tag ${tag} does not match package version ${version} (expected v${version}).`);
  process.exit(1);
}
console.log(
  `Version ${version} (Android versionCode ${androidVersionCode(version)})${tag ? `, tag ${tag} matches` : ''}.`,
);
