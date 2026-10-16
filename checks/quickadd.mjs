#!/usr/bin/env node
/* Quick-add parser check — one line in, fields out, against the real code.
 * Fixed "now": Thu Oct 15 2026, 10 PM. No browser, no network. */
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';

const js = transformSync(readFileSync(new URL('../src/quickadd.ts', import.meta.url), 'utf8'), { loader: 'ts', format: 'esm' }).code;
const { parseQuick, repLabel } = await import('data:text/javascript,' + encodeURIComponent(js));
const now = new Date(2026, 9, 15, 22);
const failures = [];
const check = (name, cond, detail) => {
  if (!cond) { failures.push(name); console.log(`FAIL  ${name} — ${detail}`); } else console.log(`PASS  ${name}`);
};
const p = (s) => parseQuick(s, now);
const has = (q, o) => Object.entries(o).every(([k, v]) => JSON.stringify(q[k]) === JSON.stringify(v));
const cases = [
  ['weekday-time-place', 'Dentist Tue 3pm at Main St', { title: 'Dentist', date: '2026-10-20', time: '15:00', loc: 'Main St', type: 'appointment' }],
  ['weekly-days-range', 'Kung fu every mon wed 7-8:30pm', { title: 'Kung fu', date: '2026-10-19', time: '19:00', end: '20:30', rep: { f: 'weekly', days: [1, 3] } }],
  ['task-tokens', 'Call Marcus tomorrow 4pm 30m !urgent #work', { title: 'Call Marcus', date: '2026-10-16', time: '16:00', mins: 30, pr: 'urgent', list: 'work' }],
  ['month-day-noon', 'Lunch with Ana Oct 20 at noon', { title: 'Lunch with Ana', date: '2026-10-20', time: '12:00' }],
  ['weekdays', 'Standup weekdays 9:30am', { rep: { f: 'weekly', days: [1, 2, 3, 4, 5] }, time: '09:30' }],
  ['next-weekday', 'Ship demo next fri', { title: 'Ship demo', date: '2026-10-23' }],
  ['name-not-month', 'Email Marcus 12 docs', { title: 'Email Marcus 12 docs', date: undefined }],
  ['bare-at-hour', 'Meet at 3', { title: 'Meet', time: '15:00' }],
  ['tonight', 'Gym tonight', { date: '2026-10-15', time: '20:00' }],
];
for (const [name, input, want] of cases) { const q = p(input); check(name, has(q, want), JSON.stringify(q)); }
check('rep-label', repLabel({ f: 'weekly', days: [1, 3] }) === 'Weekly on Mon, Wed', repLabel({ f: 'weekly', days: [1, 3] }));
if (failures.length) { console.error('quickadd: ' + failures.length + ' failed: ' + failures.join(', ')); process.exit(1); }
console.log(`all ${cases.length + 1} passed`);
