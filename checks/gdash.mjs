#!/usr/bin/env node
/* Guild dashboard check — seeds + edit ops, against the real code.
 *
 * The checks/dash.mjs pattern on the Guild twin. No browser, no network.
 * Exit codes: 0 everything holds, 1 something does not.
 */
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';

const src = readFileSync(new URL('../src/gdash.ts', import.meta.url), 'utf8');

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

// 1. First run seeds the mockup's Inbox + Network.
{
  const { out } = run(() => {}, `(() => getGuildDashboard())()`);
  check(
    'seeds-pages',
    JSON.stringify(out.pages) === JSON.stringify([['gmsg9', 'greq9', 'gact9'], ['gshr9', 'gmkt9', 'gasn9']]),
    JSON.stringify(out.pages),
  );
  check('seeds-sizes-empty', JSON.stringify(out.sizes) === '{}', JSON.stringify(out.sizes));
}

// 2. Size defaults quick, setGuildSize flips.
{
  const { out } = run(() => {}, `(() => { const d = getGuildDashboard(); const a = guildSizeOf(d, 'gmsg9'); setGuildSize('gmsg9', 'full'); return { a, b: guildSizeOf(getGuildDashboard(), 'gmsg9') }; })()`);
  check('size-flip', out.a === 'quick' && out.b === 'full', JSON.stringify(out));
}

// 3. Remove + add round-trip, no duplicates.
{
  const { out } = run(
    () => {},
    `(() => { removeGuildWidget(0, 'gact9'); const n1 = getGuildDashboard().pages[0].length; addGuildWidget(0, 'gact9'); addGuildWidget(1, 'gact9'); const p = getGuildDashboard().pages; return { n1, flat: p.flat().filter((w) => w === 'gact9').length }; })()`,
  );
  check('remove-add', out.n1 === 2 && out.flat === 1, JSON.stringify(out));
}

// 4. Move reorders within a page and across pages.
{
  const { out } = run(
    () => {},
    `(() => { moveGuildWidget(0, 0, 0, 2); const p0 = getGuildDashboard().pages[0]; moveGuildWidget(0, 0, 1, 0); const p = getGuildDashboard().pages; return { p0, moved: p[1][0] }; })()`,
  );
  check(
    'move-reorders',
    JSON.stringify(out.p0) === JSON.stringify(['greq9', 'gact9', 'gmsg9']) && out.moved === 'greq9',
    JSON.stringify(out),
  );
}

// 5. Bad stored layout falls back to seeds.
{
  const { out } = run(
    (store) => {
      store['eumae:gdash'] = JSON.stringify({ pages: [['gmsg9', 'bogus']], sizes: {} });
    },
    `(() => getGuildDashboard().pages)()`,
  );
  check('bad-falls-back', out.length === 2 && out[0][0] === 'gmsg9', JSON.stringify(out));
}

// 6. Half rule matches HALG.
{
  const { out } = run(() => {}, `(() => ({ a: isGuildHalf('greq9', 2), b: isGuildHalf('gmsg9', 2), c: isGuildHalf('greq9', 1) }))()`);
  check('half-rule', out.a === true && out.b === false && out.c === false, JSON.stringify(out));
}

if (failures.length) {
  console.error(`gdash: ${failures.length} failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('all 6 passed');
