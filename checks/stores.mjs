#!/usr/bin/env node
/* Goals + projects + flows + guild check — seeds + validation, real code.
 *
 * The checks/notes.mjs pattern, four small stores in one runner (each is
 * storage-only TypeScript with no imports). No browser, no network.
 * Exit codes: 0 everything holds, 1 something does not.
 */
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';

function loadMod(path) {
  const src = readFileSync(new URL(path, import.meta.url), 'utf8');
  return transformSync(src, { loader: 'ts', format: 'cjs' }).code
    .replace(/^export (function|const|let|interface|type|async function) /gm, '$1 ')
    .replace(/^export \{[^}]*\};?/gm, '')
    .replace(/^export default /gm, '');
}

const failures = [];
const check = (name, cond, detail) => {
  if (!cond) {
    failures.push(name);
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    console.log(`PASS  ${name}`);
  }
};

function run(js, setup, body) {
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
  const fakeDate = { now: () => 5000 };
  const mod = { exports: {} };
  const fn = new Function('module', 'exports', 'localStorage', 'Date', `${js}; return (${body});`);
  return { out: fn(mod, mod.exports, localStorage, fakeDate), store };
}

const goals = loadMod('../src/goals.ts');
const projects = loadMod('../src/projects.ts');
const flows = loadMod('../src/flows.ts');
const guild = loadMod('../src/guild.ts');

// Goals: two labeled seeds, bad status dropped.
{
  const { out } = run(goals, () => {}, `(() => getGoals())()`);
  check('goals-seeds', out.length === 2 && out.every((g) => g.example === true), JSON.stringify(out.length));
}
{
  const { out } = run(
    goals,
    (store) => {
      store['eumae:goals'] = JSON.stringify([{ id: 'g9', t: 'X', d: '', st: 'bogus', td: '', createdAt: 1 }]);
    },
    `(() => getGoals())()`,
  );
  check('goals-bad-dropped', out.length === 0, JSON.stringify(out.length));
}

// Projects: two labeled seeds, pin defaults to w1.
{
  const { out } = run(projects, () => {}, `(() => ({ n: getProjects().length, pin: getPinnedProject() }))()`);
  check('projects-seeds', out.n === 2, JSON.stringify(out.n));
  check('projects-pin', out.pin && out.pin.id === 'w1', JSON.stringify(out.pin && out.pin.id));
}

// Flows: the mockup's two flows, on.
{
  const { out } = run(flows, () => {}, `(() => getFlows())()`);
  check(
    'flows-seeds',
    out.length === 2 && out.every((f) => f.on === 1 && f.example === true),
    JSON.stringify(out.map((f) => f.n)),
  );
}

// Guild: people + threads + requests + shared + market + assigned + groups,
// verbatim counts.
{
  const { out } = run(
    guild,
    () => {},
    `(() => { const g = getGuild(); return { people: g.people.length, threads: g.threads.length, reqIn: g.reqIn.length, reqOut: g.reqOut.length, act: g.act.length, shared: g.shared.length, market: g.market.length, assigned: g.assigned.length, groups: g.groups.length }; })()`,
  );
  check(
    'guild-seed-counts',
    out.people === 4 && out.threads === 3 && out.reqIn === 3 && out.reqOut === 3 && out.act === 4 && out.shared === 4 && out.market === 3 && out.assigned === 4 && out.groups === 2,
    JSON.stringify(out),
  );
}

// Guild ops: accept flips to found, decline removes, take flips got.
{
  const { out } = run(
    guild,
    () => {},
    `(() => { const a = answerRequest(0, 1); const st = getGuild().reqIn[0].st; const t = takeMarketplace(0); const got = getGuild().market[0].got; return { a, st, t, got }; })()`,
  );
  check(
    'guild-ops',
    out.st === 'found' && out.got === 1 && /finding it/.test(out.a) && /Studio/.test(out.t),
    JSON.stringify(out),
  );
}

// Guild: old saves without assigned/groups still load.
{
  const { out } = run(
    guild,
    (store) => {
      store['eumae:guild'] = JSON.stringify({
        people: [],
        threads: [],
        reqIn: [],
        reqOut: [],
        act: [],
        shared: [],
        market: [],
      });
    },
    `(() => { const g = getGuild(); return { assigned: g.assigned.length, groups: g.groups.length }; })()`,
  );
  check('guild-old-saves', out.assigned === 0 && out.groups === 0, JSON.stringify(out));
}

if (failures.length) {
  console.error(`stores: ${failures.length} failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('all 8 passed');
