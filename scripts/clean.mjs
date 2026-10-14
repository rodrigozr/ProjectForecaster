// Deletes all build/test intermediate and output files. Installed dependencies (node_modules) are kept.
import { existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const TARGETS = [
  'dist', // vite build output
  'coverage', // vitest coverage reports
  'webapp', // build output of the pre-2.0 version
  'node_modules/.vite', // vite dependency pre-bundling cache
  'node_modules/.vite-temp', // vite config bundling temp files
  'node_modules/.vitest', // vitest results cache
  'node_modules/.vitest-cache', // vitest results cache (newer location)
];

const root = fileURLToPath(new URL('..', import.meta.url));
for (const target of TARGETS) {
  const path = root + target;
  if (existsSync(path)) {
    rmSync(path, { recursive: true, force: true });
    console.log(`removed ${target}`);
  }
}
