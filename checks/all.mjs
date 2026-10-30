#!/usr/bin/env node
/* Every check, one gate.
 *
 * CI used to name 14 of the 25 `check:*` scripts by hand, so the other eleven
 * could rot where nobody looked — and three of them had (STANDARD.md 3.4/3.5).
 * This reads the list out of package.json instead of repeating it, so the day
 * a check is added to scripts it is covered, and nothing has to be remembered.
 *
 * Runs each in its own process, keeps going after a failure so one run shows
 * every break, and exits 1 if any failed.
 *
 * Exit codes: 0 everything passed, 1 something did not.
 *
 * A check that exits 2 says "this machine cannot answer that" — the live
 * checks that need GEMINI_API_KEY do it (see checks/models.mjs). Those are
 * reported as SKIP and do not fail the gate, so CI runs them where a key
 * exists and says plainly where one does not.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const scripts = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).scripts;
const names = Object.keys(scripts).filter((k) => k.startsWith('check:') && k !== 'check:all');

const failed = [];
const skipped = [];
const started = Date.now();

for (const [i, name] of names.entries()) {
  const cmd = scripts[name];
  const direct = /^node\s+(.+)$/.exec(cmd);
  console.log(`\n── ${name} (${i + 1}/${names.length}) `.padEnd(72, '─'));
  const at = Date.now();
  const r = direct
    ? spawnSync(process.execPath, [direct[1]], { cwd: root, stdio: 'inherit' })
    : spawnSync(cmd, { cwd: root, stdio: 'inherit', shell: true });
  const secs = ((Date.now() - at) / 1000).toFixed(1);
  const skip = r.status === 2;
  const ok = r.status === 0;
  if (skip) skipped.push(name);
  else if (!ok) failed.push(name);
  console.log(`${ok ? 'PASS' : skip ? 'SKIP' : 'FAIL'}  ${name} (${secs}s)`);
}

const total = ((Date.now() - started) / 1000).toFixed(1);
const note = skipped.length ? ` (skipped, no key here: ${skipped.join(', ')})` : '';
if (failed.length) {
  console.error(`\n${failed.length} of ${names.length} checks failed in ${total}s: ${failed.join(', ')}${note}`);
  process.exit(1);
}
console.log(`\nall ${names.length - skipped.length} checks passed in ${total}s${note}`);
