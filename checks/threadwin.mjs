#!/usr/bin/env node
/* Thread-window check — threadRows/dayLabel are pure (msgs in, rows out), so
 *  this lifts them by name like checks/chat.mjs and runs them for real. No
 *  browser, no network, no storage.
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
  `export function __w() { return 1; }\nconst WINDOW_MSGS = 100;\n${snippet('dayLabel')}\n${snippet('threadRows')}`,
  { loader: 'ts', format: 'cjs' },
).code;
const mod = { exports: {} };
new Function('module', 'exports', js)(mod, mod.exports);
const { dayLabel, threadRows } = mod.exports;

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
const NOW = new Date(2026, 9, 11, 15, 0, 0).getTime(); // Sun Oct 11 2026 15:00 local
const DAY = 86400000;

check('today', dayLabel(NOW - 3600000, NOW) === 'Today');
check('yesterday', dayLabel(NOW - DAY, NOW) === 'Yesterday');
check(
  'older-date',
  dayLabel(NOW - 5 * DAY, NOW).includes('October') && !['Today', 'Yesterday'].includes(dayLabel(NOW - 5 * DAY, NOW)),
  dayLabel(NOW - 5 * DAY, NOW),
);
// Short thread: one Today line, nothing hidden.
{
  const { rows, hidden } = threadRows([msg(1, NOW - 1000), msg(2, NOW)], NOW);
  check('short-window', hidden === 0 && rows.length === 3 && rows[0].kind === 'day' && rows[0].label === 'Today');
}
// Cross-day thread: both lines, in order.
{
  const { rows } = threadRows([msg(1, NOW - DAY), msg(2, NOW)], NOW);
  check(
    'two-days',
    rows.length === 4 && rows[0].label === 'Yesterday' && rows[2].label === 'Today',
    rows.map((r) => r.label ?? 'msg').join(','),
  );
}
// Long thread: windowed to 100, hidden counted.
{
  const long = Array.from({ length: 150 }, (_, i) => msg(i + 1, NOW - (150 - i) * 60000));
  const { rows, hidden } = threadRows(long, NOW);
  check('window-caps', hidden === 50 && rows.filter((r) => r.kind === 'msg').length === 100, `hidden=${hidden}`);
}

if (failures.length) {
  console.error(`threadwin: ${failures.length} failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('all 6 passed');
