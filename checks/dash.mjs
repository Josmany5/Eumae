#!/usr/bin/env node
/* Dashboard check — seeds + edit ops, against the real code.
 *
 * The checks/notes.mjs pattern. No browser, no network.
 * Exit codes: 0 everything holds, 1 something does not.
 */
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';

/* One module, imports included — same harness as checks/stores.mjs, so this
   check keeps working the day dash.ts imports something. */
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

const js = loadMod('../src/dash.ts');

const failures = [];
let passed = 0;
const check = (name, cond, detail) => {
  if (!cond) {
    failures.push(name);
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    passed++;
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
    removeItem: (k) => {
      delete store[k];
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

/* The seeded pages, as dash.ts states them (his Oct 18 call: Timeline, This
   week, Eumae noticed and Notifications on Today; goals, pinned project and
   latest artifact on Work). */
const SEED = [
  ['tl8', 'week8', 'brief8', 'nts8'],
  ['goals8', 'pj8', 'art8'],
];

// 1. First run seeds the Oct 18 pages.
{
  const { out } = run(() => {}, `(() => getDashboard())()`);
  check('seeds-pages', JSON.stringify(out.pages) === JSON.stringify(SEED), JSON.stringify(out.pages));
  check('seeds-sizes-empty', JSON.stringify(out.sizes) === '{}', JSON.stringify(out.sizes));
}

// 2. Size defaults quick, setSize flips.
{
  const { out } = run(() => {}, `(() => { const d = getDashboard(); const a = sizeOf(d, 'today8'); setSize('today8', 'full'); return { a, b: sizeOf(getDashboard(), 'today8') }; })()`);
  check('size-flip', out.a === 'quick' && out.b === 'full', JSON.stringify(out));
}

// 3. Remove + add round-trip, no duplicates.
{
  const { out } = run(
    () => {},
    `(() => { removeWidget(0, 'week8'); const n1 = getDashboard().pages[0].length; addWidget(0, 'week8'); addWidget(1, 'week8'); const p = getDashboard().pages; return { n1, flat: p.flat().filter((w) => w === 'week8').length }; })()`,
  );
  check('remove-add', out.n1 === 3 && out.flat === 1, JSON.stringify(out));
}

// 4. Move reorders within a page and across pages.
{
  const { out } = run(
    () => {},
    `(() => { moveWidget(0, 0, 0, 2); const p0 = getDashboard().pages[0]; moveWidget(0, 0, 1, 0); const p = getDashboard().pages; return { p0, moved: p[1][0], left: p[0] }; })()`,
  );
  check(
    'move-reorders',
    JSON.stringify(out.p0) === JSON.stringify(['week8', 'brief8', 'tl8', 'nts8']) && out.moved === 'week8' && JSON.stringify(out.left) === JSON.stringify(['brief8', 'tl8', 'nts8']),
    JSON.stringify(out),
  );
}

// 5. Bad stored layout falls back to seeds.
{
  const { out } = run(
    (store) => {
      store['eumae:dash'] = JSON.stringify({ pages: [['today8', 'bogus']], sizes: {} });
    },
    `(() => getDashboard().pages)()`,
  );
  check('bad-falls-back', JSON.stringify(out) === JSON.stringify(SEED), JSON.stringify(out));
}

// 6. A layout from before the Timeline gets the Oct 18 pages; extra pages the
//    user made stay (minus widgets now placed on the first two), names stay.
{
  const { out } = run(
    (store) => {
      store['eumae:dash'] = JSON.stringify({
        pages: [['today8', 'week8', 'goals8'], ['brief8', 'pj8', 'art8', 'nts8'], ['today8']],
        sizes: { week8: 'full' },
        names: ['Mine', 'Work'],
      });
    },
    `(() => { const d = getDashboard(); return { pages: d.pages, sizes: d.sizes, names: d.names }; })()`,
  );
  check(
    'migrate-adds-timeline',
    JSON.stringify(out.pages) === JSON.stringify([...SEED, ['today8']]) && out.sizes.week8 === 'full' && JSON.stringify(out.names?.slice(0, 2)) === JSON.stringify(['Mine', 'Work']),
    JSON.stringify(out),
  );
}

// 7. Half rule matches HALC.
{
  const { out } = run(() => {}, `(() => ({ a: isHalf('goals8', 2), b: isHalf('today8', 2), c: isHalf('goals8', 1) }))()`);
  check('half-rule', out.a === true && out.b === false && out.c === false, JSON.stringify(out));
}

if (failures.length) {
  console.error(`dash: ${failures.length} failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log(`all ${passed} passed`);
