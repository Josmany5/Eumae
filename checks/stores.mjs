#!/usr/bin/env node
/* Goals + projects + flows + guild check — seeds + validation, real code.
 *
 * The checks/notes.mjs pattern, four small stores in one runner (each is
 * storage-only TypeScript with no imports). No browser, no network.
 * Exit codes: 0 everything holds, 1 something does not.
 */
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';

/* One module, imports included.
 *
 *  This used to be `transformSync` on a single file plus an `export` strip,
 *  which only works for a file with no imports. The day goals.ts began
 *  importing tasks.ts, the transform emitted `require('./tasks')`, there is no
 *  `require` in an eval scope, and the whole check died silently (it was also
 *  red in CI). Bundling inlines the imports, so the checks keep working as the
 *  stores grow (STANDARD.md 3.4). */
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

function run(js, setup, body, realDate = false) {
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
  const clock = realDate ? Date : fakeDate;
  const mod = { exports: {} };
  /* The bundle runs once, in a scope holding our fake localStorage and clock;
     esbuild's CommonJS output hands its exports back on `module.exports`. */
  const load = new Function('module', 'exports', 'localStorage', 'Date', `${js}\nreturn module.exports;`);
  const ns = load(mod, mod.exports, localStorage, clock);
  /* The body then gets those exports as plain names — the same shape the old
     strip-the-export-keyword eval handed it. */
  const names = Object.keys(ns).filter((k) => /^[A-Za-z_$][\w$]*$/.test(k));
  const fn = new Function('ns', 'localStorage', 'Date', `const {${names.join(', ')}} = ns; return (${body});`);
  return { out: fn(ns, localStorage, clock), store };
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

// Projects: two labeled seeds, pin defaults to w1, status derives.
{
  const { out } = run(
    projects,
    () => {},
    `(() => ({ n: getProjects().length, pin: getPinnedProject(), st: projectStatus(getProjects()[0]), pc: projectPercent(getProjects()[0]) }))()`,
  );
  check('projects-seeds', out.n === 2, JSON.stringify(out.n));
  check('projects-pin', out.pin && out.pin.id === 'w1', JSON.stringify(out.pin && out.pin.id));
  /* Oct 21: progress comes from the project's own links, never the old sample
     counts on the seed row (w1 still carries ts:5, dn:3 — reading those would
     say 60). A seed with no links is 0, plainly. */
  check('projects-status', out.st === 'active' && out.pc === 0, JSON.stringify({ st: out.st, pc: out.pc }));
}

// Projects: percent and label count linked tasks only — done ones, live ones.
{
  const { out } = run(
    projects,
    (store) => {
      store['eumae:tasks'] = JSON.stringify([
        { id: 'ta', t: 'Write the brief', d: 1, createdAt: 1 },
        { id: 'tb', t: 'Book the room', d: 0, createdAt: 1 },
      ]);
    },
    `(() => { const p = { id: 'pz', n: 'Launch', d: '', ts: 9, dn: 9, createdAt: 1, links: [{ k: 'task', id: 'ta' }, { k: 'task', id: 'tb' }, { k: 'task', id: 'gone' }] }; saveProject(p); const got = getProject('pz'); return { pc: projectPercent(got), label: projectCountLabel(got) }; })()`,
  );
  check('projects-percent-links', out.pc === 50 && out.label === '1 of 2 steps', JSON.stringify(out));
}

// Flows (habits / routines / flows): starts empty (starters are offered, not
// seeded), the old example seeds are dropped, old rows migrate, checks belong
// to today, the streak comes from real history on scheduled days only.
{
  const { out } = run(flows, () => {}, `(() => ({ n: getFlows().length, starters: STARTERS.length }))()`, true);
  check('flows-empty-start', out.n === 0 && out.starters >= 5, JSON.stringify(out));
}
{
  const { out } = run(
    flows,
    (store) => {
      store['eumae:flows'] = JSON.stringify([
        { id: 'brief', n: 'Morning brief', w: 'Weekdays 7:00 AM', kind: 'flow', streak: 12, on: 1, steps: ['a'], done: [], example: true, createdAt: 1 },
        { id: 'old', n: 'Close', w: 'Weekdays 9:30 PM', kind: 'routine', streak: 8, on: 1, steps: ['a', 'b'], done: [0], createdAt: 1 },
      ]);
    },
    `(() => { const f = getFlows(); return { n: f.length, days: f[0].days, tm: f[0].tm, done: doneToday(f[0]), streak: flowStreak(f[0]), w: f[0].w }; })()`,
    true,
  );
  check(
    'flows-migrate',
    out.n === 1 && JSON.stringify(out.days) === '[1,2,3,4,5]' && out.tm === '21:30' && out.done.length === 0 && out.streak === 0 && out.w === 'Weekdays · 9:30 PM',
    JSON.stringify(out),
  );
}
{
  const { out } = run(
    flows,
    () => {},
    `(() => {
      const f = createFlow('R', 'routine', { days: [0,1,2,3,4,5,6], steps: ['a', 'b'] });
      toggleFlowStep(f.id, 0);
      const half = { d: doneToday(getFlow(f.id)), fin: isDoneToday(getFlow(f.id)) };
      toggleFlowStep(f.id, 1);
      const full = { fin: isDoneToday(getFlow(f.id)), s: flowStreak(getFlow(f.id)) };
      const y = new Date(); y.setDate(y.getDate() - 1);
      const ys = y.getFullYear() + '-' + String(y.getMonth() + 1).padStart(2, '0') + '-' + String(y.getDate()).padStart(2, '0');
      saveFlow({ ...getFlow(f.id), hist: [...getFlow(f.id).hist, ys] });
      const two = flowStreak(getFlow(f.id));
      const h = createFlow('H', 'habit');
      toggleFlowToday(h.id);
      const hs = flowStreak(getFlow(h.id));
      const od = createFlow('Brain dump', 'flow');
      return { half, full, two, hs, od: scheduleLabel(getFlow(od.id)), ods: flowStreak(getFlow(od.id)) };
    })()`,
    true,
  );
  check(
    'flows-today-streak',
    JSON.stringify(out.half.d) === '[0]' && out.half.fin === false && out.full.fin === true && out.full.s === 1 && out.two === 2 && out.hs === 1 && out.od === 'On demand' && out.ods === 0,
    JSON.stringify(out),
  );
}

// Guild: people + threads + requests + shared + market + assigned + groups,
// verbatim counts. Shared rows default to view access.
{
  const { out } = run(
    guild,
    () => {},
    `(() => { const g = getGuild(); return { people: g.people.length, threads: g.threads.length, reqIn: g.reqIn.length, reqOut: g.reqOut.length, act: g.act.length, shared: g.shared.length, market: g.market.length, assigned: g.assigned.length, groups: g.groups.length, perm: g.shared[0].perm }; })()`,
  );
  check(
    'guild-seed-counts',
    out.people === 4 && out.threads === 3 && out.reqIn === 3 && out.reqOut === 3 && out.act === 4 && out.shared === 4 && out.market === 3 && out.assigned === 4 && out.groups === 2 && out.perm === 'view',
    JSON.stringify(out),
  );
}

// Guild ops: accept flips to found, decline removes, take flips got,
// not-yet flips back to new, assign appends, message sends.
{
  const { out } = run(
    guild,
    () => {},
    `(() => { const a = answerRequest(0, 1); const st = getGuild().reqIn[0].st; const t = takeMarketplace(0); const got = getGuild().market[0].got; answerRequest(0, 3); const back = getGuild().reqIn[0].st; const asg = assignWork('Review deck', 0); const sm = sendGuildMessage(1, 'Hello'); const th = threadWith(3); return { a, st, t, got, back, asg, sm, th }; })()`,
  );
  check(
    'guild-ops',
    out.st === 'found' &&
      out.got === 1 &&
      /finding it/.test(out.a) &&
      /Studio/.test(out.t) &&
      out.back === 'new' &&
      /Marcus/.test(out.asg) &&
      out.sm === 'Sent.' &&
      out.th === 0,
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

// Guild shared access: set + unshare round-trip.
{
  const { out } = run(
    guild,
    () => {},
    `(() => { setSharedPerm(0, 'edit'); const p = getGuild().shared[0].perm; const u = unshare(0); return { p, u, n: getGuild().shared.length }; })()`,
  );
  check('guild-perm', out.p === 'edit' && out.u === 'Unshared.' && out.n === 3, JSON.stringify(out));
}

if (failures.length) {
  console.error(`stores: ${failures.length} failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log(`all ${passed} passed`);
