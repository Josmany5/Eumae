#!/usr/bin/env node
/* Events check — seeds + dayEvents sort, against the real code.
 *
 * The checks/notes.mjs pattern. No browser, no network.
 * Exit codes: 0 everything holds, 1 something does not.
 */
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';

function loadMod(path) {
  const r = buildSync({
    entryPoints: [fileURLToPath(new URL(path, import.meta.url))],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    write: false,
    logLevel: 'silent',
  });
  return r.outputFiles[0].text;
}

const js = loadMod('../src/events.ts');

const failures = [];
const check = (name, cond, detail) => {
  if (!cond) {
    failures.push(name);
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    console.log(`PASS  ${name}`);
  }
};

function run(setup, body) {
  const store = {};
  const localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => {
      store[k] = String(v);
    },
  };
  setup(store);
  const mod = { exports: {} };
  const load = new Function('module', 'exports', 'localStorage', 'Date', `${js}\nreturn module.exports;`);
  const ns = load(mod, mod.exports, localStorage, Date);
  const names = Object.keys(ns).filter((k) => /^[A-Za-z_$][\w$]*$/.test(k));
  const fn = new Function('ns', 'localStorage', 'Date', `const {${names.join(', ')}} = ns; return (${body});`);
  return { out: fn(ns, localStorage, Date), store };
}

// 1. First run seeds the mockup's four rows.
{
  const { out } = run(() => {}, `(() => getEvents())()`);
  check('seeds-four', out.length === 4, JSON.stringify(out.length));
  check('seeds-labeled', out.every((e) => e.example === true), 'unlabeled seed');
}

// 2. dayEvents filters by day and sorts by time.
{
  const { out } = run(() => {}, `(() => dayEvents('2026-10-01').map((e) => e.tm))()`);
  check('day-sorted', JSON.stringify(out) === JSON.stringify(['9:00', '14:00', '17:30']), JSON.stringify(out));
}

// 3. Bad rows are dropped.
{
  const { out } = run(
    (store) => {
      store['eumae:events'] = JSON.stringify([{ nope: 1 }, { d: '2026-10-01', tm: '9:00', t: 'Real' }]);
    },
    `(() => getEvents())()`,
  );
  check('bad-dropped', out.length === 1 && out[0].t === 'Real', JSON.stringify(out.length));
}

// 4. Repeats: weekly on chosen days, until a date; ids keep edits on one row.
{
  const { out } = run(
    (store) => {
      store['eumae:events'] = JSON.stringify([
        { id: 'k', d: '2026-10-19', tm: '19:00', t: 'Kung fu', rep: { f: 'weekly', days: [1, 3], until: '2026-10-28' } },
        { d: '2026-10-21', tm: '9:00', t: 'Old row' },
      ]);
    },
    `(() => ({
      wed: dayEvents('2026-10-21').map((e) => e.t),
      tue: dayEvents('2026-10-20').map((e) => e.t),
      after: dayEvents('2026-11-02').map((e) => e.t),
      ids: getEvents().every((e) => !!e.id),
      span: eventsBetween('2026-10-19', 10).filter((e) => e.t === 'Kung fu').map((e) => e.d),
    }))()`,
  );
  check('repeat-weekly', JSON.stringify(out.wed) === JSON.stringify(['Old row', 'Kung fu']) && out.tue.length === 0, JSON.stringify(out));
  check('repeat-until', out.after.length === 0, JSON.stringify(out.after));
  check('repeat-span', JSON.stringify(out.span) === JSON.stringify(['2026-10-19', '2026-10-21', '2026-10-26', '2026-10-28']), JSON.stringify(out.span));
  check('ids-on-load', out.ids === true, 'row without id');
}

if (failures.length) {
  console.error(`events: ${failures.length} failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('all 7 passed');
