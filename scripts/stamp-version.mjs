// Writes the release version and commit into src/app/version.ts before a release build.
// Usage: node scripts/stamp-version.mjs 1.2.3 <commit-sha>
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [version, commit = ''] = process.argv.slice(2);
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version ?? '')) {
  console.error('Usage: node scripts/stamp-version.mjs <semver> [commit]');
  process.exit(1);
}
if (!/^[0-9a-f]{0,40}$/.test(commit)) {
  console.error('The commit must be a hex SHA.');
  process.exit(1);
}
const file = join(dirname(fileURLToPath(import.meta.url)), '../src/app/version.ts');
writeFileSync(
  file,
  `/** Stamped by scripts/stamp-version.mjs during the release build. */
export const APP_VERSION = '${version}';
export const APP_COMMIT = '${commit.slice(0, 7)}';
`,
);
console.log(`Stamped ${version} ${commit.slice(0, 7)}`);
