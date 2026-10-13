#!/usr/bin/env node
/* Thread-window check — threadRows is pure (msgs in, rows out), so this lifts
 *  it by name like checks/chat.mjs and runs it for real. No browser, no
 *  network, no storage. Day lines were removed 2026-10-13 (owner call: the
 *  thread just flows) — the window still caps at 100, with no date rows.
 *
 *  Exit codes: 0 everything holds, 1 something does not.
 */
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';

const src = readFileSync(new URL('../src/screens/ChatScreen.tsx', import.meta.url), 'utf8');

function snippet(name) {
  const at = src.indexOf(`function ${name}(`);
  if (at < 0) throw new Error(`${name} is not in src/screens/ChatScreen.tsx`);
  const start = src.lastIndexOf('export', at);
  const end = src.indexOf('\n}', at);
  if (end < 0) throw new Error(`${name} never closes at column 0`);
  return src.slice(start < 0 ? at : start, end + 2);
}

const js = transformSync(
  `export function __w() { return 1; }\nconst WINDOW_MSGS = 100;\n${snippet('threadRows')}`,
  { loader: 'ts', format: 'cjs' },
).code;
const mod = { exports: {} };
new Function('module', 'exports', js)(mod, mod.exports);
const { threadRows } = mod.exports;

const failures = [];
const check = (name, cond, detail) => {
  if (!cond) {
    failures.push(name);
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    console.log(`PASS  ${name}`);
  }
};

const msg = (id, ts) => ({ id, role: id % 2 ? 'you' : 'eumae', text: `m${id}`, ts });
const NOW = Date.now();
const DAY = 86400000;

// Short thread: message rows only, no date rows, nothing hidden.
{
  const { rows, hidden } = threadRows([msg(1, NOW - 1000), msg(2, NOW)]);
  check('no-day-rows', hidden === 0 && rows.length === 2 && rows.every((r) => r.kind === 'msg'));
}
// Cross-day thread: still no date rows - the thread just flows.
{
  const { rows } = threadRows([msg(1, NOW - DAY), msg(2, NOW)]);
  check(
    'cross-day-no-lines',
    rows.length === 2 && rows.every((r) => r.kind === 'msg'),
    rows.map((r) => r.kind).join(','),
  );
}
// Long thread: windowed to 100, hidden counted.
{
  const long = Array.from({ length: 150 }, (_, i) => msg(i + 1, NOW - (150 - i) * 60000));
  const { rows, hidden } = threadRows(long);
  check('window-caps', hidden === 50 && rows.filter((r) => r.kind === 'msg').length === 100, `hidden=${hidden}`);
}

if (failures.length) {
  console.error(`threadwin: ${failures.length} failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('all 3 passed');
