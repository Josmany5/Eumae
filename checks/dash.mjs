#!/usr/bin/env node
/* Dashboard check — seeds + edit ops, against the real code.
 *
 * The checks/notes.mjs pattern. No browser, no network.
 * Exit codes: 0 everything holds, 1 something does not.
 */
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';

const src = readFileSync(new URL('../src/dash.ts', import.meta.url), 'utf8');

const js = transformSync(src, { loader: 'ts', format: 'cjs' }).code
  .replace(/^export (function|const|let|interface|type|async function) /gm, '$1 ')
  .replace(/^export \{[^}]*\};?/gm, '')
  .replace(/^export default /gm, '');

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
    removeItem: (k) => {
      delete store[k];
    },
  };
  setup(store);
  const mod = { exports: {} };
  const fn = new Function('module', 'exports', 'localStorage', 'Date', `${js}; return (${body});`);
  return { out: fn(mod, mod.exports, localStorage, Date), store };
}

// 1. First run seeds the mockup's two pages.
{
  const { out } = run(() => {}, `(() => getDashboard())()`);
  check(
    'seeds-pages',
    JSON.stringify(out.pages) === JSON.stringify([['today8', 'week8', 'goals8'], ['brief8', 'pj8', 'art8', 'nts8']]),
    JSON.stringify(out.pages),
  );
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
  check('remove-add', out.n1 === 2 && out.flat === 1, JSON.stringify(out));
}

// 4. Move reorders within a page and across pages.
{
  const { out } = run(
    () => {},
    `(() => { moveWidget(0, 0, 0, 2); const p0 = getDashboard().pages[0]; moveWidget(0, 0, 1, 0); const p = getDashboard().pages; return { p0, moved: p[1][0] }; })()`,
  );
  check(
    'move-reorders',
    JSON.stringify(out.p0) === JSON.stringify(['week8', 'goals8', 'today8']) && out.moved === 'week8',
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
  check('bad-falls-back', out.length === 2 && out[0][0] === 'today8', JSON.stringify(out));
}

// 6. Half rule matches HALC.
{
  const { out } = run(() => {}, `(() => ({ a: isHalf('goals8', 2), b: isHalf('today8', 2), c: isHalf('goals8', 1) }))()`);
  check('half-rule', out.a === true && out.b === false && out.c === false, JSON.stringify(out));
}

if (failures.length) {
  console.error(`dash: ${failures.length} failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('all 6 passed');
