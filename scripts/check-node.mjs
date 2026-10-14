// Fails fast when the running Node.js is older than the version required by package.json "engines".
// Kept dependency-free and in plain syntax so it runs (and prints a clear error) even on old Node versions.
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const required = Number(/(\d+)/.exec(pkg.engines.node)[1]);
const current = process.versions.node;

if (Number(current.split('.')[0]) < required) {
  console.error(
    `\nProject Forecaster requires Node.js ${required} or later, but you are running ${current}.\n` +
      `Switch versions (for example "nvm use", which reads .nvmrc) and try again.\n`,
  );
  process.exit(1);
}
