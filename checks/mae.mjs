#!/usr/bin/env node
/* Mae tools check: the registry, the schema checker and the dispatcher,
 * run for real against the real stores with an in-memory localStorage.
 *
 * Every case here is a way Mae went wrong before (Wove), or a promise the
 * plan card makes: nothing runs before Approve, a plan lands whole or not at
 * all, Undo puts everything back.
 *
 * Exit codes: 0 everything holds, 1 something does not. */
import { buildSync } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => {
    store[k] = String(v);
  },
  removeItem: (k) => {
    delete store[k];
  },
};

const out = buildSync({
  stdin: {
    contents: `export * from './src/mae/dispatcher'; export { REGISTRY } from './src/mae/registry'; export { check, toGemini } from './src/mae/schema';
      export { getTasks, getTask } from './src/tasks'; export { getEvents, saveEvent, ymd } from './src/events'; export { getGoals } from './src/goals';
      export { getProjects, linkedIds } from './src/projects'; export { getNotes, titleOf } from './src/notes'; export { parseEvent } from './src/chat';`,
    resolveDir: new URL('..', import.meta.url).pathname,
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
  logLevel: 'silent',
  define: { 'import.meta.env': '{}' },
});
const tmp = join(mkdtempSync(join(tmpdir(), 'mae-')), 'bundle.mjs');
writeFileSync(tmp, out.outputFiles[0].text);
const M = await import(pathToFileURL(tmp).href);

const failures = [];
const check = (name, cond, detail) => {
  if (!cond) {
    failures.push(name);
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  } else console.log(`PASS  ${name}`);
};

const today = M.ymd(new Date());
const d = (n) => {
  const x = new Date();
  x.setDate(x.getDate() + n);
  return M.ymd(x);
};
const stage = (calls) => {
  const plan = M.newPlan();
  const res = M.dispatch(calls, plan);
  return { plan, res };
};

// 1. Registry: every tool has a unique name, a description, a valid Gemini form.
{
  const names = M.REGISTRY.map((a) => a.name);
  check('registry-unique-names', new Set(names).size === names.length);
  const decls = M.declarations();
  check('registry-declarations', decls.length === M.REGISTRY.length && decls.every((x) => x.name && x.description && x.parameters?.type === 'OBJECT'));
  check('registry-no-singular-creates', !names.some((n) => /^create_(task|event|goal|project|note)$/.test(n)), names.filter((n) => n.startsWith('create_')).join(','));
  const creates = M.REGISTRY.filter((a) => a.name.startsWith('create_') && a.name !== 'create_list');
  check('creates-take-lists', creates.every((a) => Object.values(a.params.properties).some((p) => p.type === 'array')));
}

// 2. Three tasks are three tasks, and nothing is made before Approve.
{
  const before = M.getTasks().length;
  const { plan, res } = stage([{ name: 'create_tasks', args: { tasks: [{ title: 'Buy milk' }, { title: 'Call mom', due: d(1), priority: 'urgent' }, { title: 'Book flights', subtasks: ['Compare', 'Pay'] }] } }]);
  check('stage-ok', res[0].ok && res[0].response.staged === true, JSON.stringify(res[0].response));
  check('stage-three-lines', plan.steps[0].lines.length === 3);
  check('nothing-before-approve', M.getTasks().length === before);
  const ran = M.executePlan(plan);
  check('approve-runs', ran.status === 'done' && M.getTasks().length === before + 3, ran.error);
  const flights = M.getTasks().find((t) => t.t === 'Book flights');
  check('subtasks-shape', flights && flights.sub.length === 2 && flights.sub[0].d === 0);
  check('priority-word', M.getTasks().find((t) => t.t === 'Call mom')?.pr === 'urgent');
  const undone = M.undoPlan(ran);
  check('undo-restores', undone.status === 'undone' && M.getTasks().length === before);
}

// 3. The bad calls are bounced with a sentence, before the card.
{
  const r = (args, name = 'create_tasks') => stage([{ name, args }]).res[0];
  check('refuse-merged-lines', !r({ tasks: [{ title: 'Buy milk\nCall mom' }] }).ok);
  const tm = r({ tasks: [{ title: 'Dentist', time: '15:00' }] });
  check('refuse-time-without-due', !tm.ok && /event/.test(tm.response.error), tm.response.error);
  check('refuse-unknown-tool', !stage([{ name: 'create_task', args: { title: 'x' } }]).res[0].ok);
  check('refuse-unknown-field', !r({ tasks: [{ title: 'x', urgent: true }] }).ok);
  check('refuse-fake-date', !r({ tasks: [{ title: 'x', due: '2026-02-30' }] }).ok);
  check('refuse-nested-enum', !r({ tasks: [{ title: 'a' }, { title: 'b', priority: 'high' }] }).ok);
  check('refuse-empty-list', !r({ tasks: [] }).ok);
  check('refuse-missing-list', !r({ tasks: [{ title: 'x', list: 'Nope' }] }).ok);
  const ev = r({ events: [{ title: 'Standup', date: today }] }, 'create_events');
  check('refuse-event-without-start', !ev.ok && /start/.test(ev.response.error));
  check('refuse-end-before-start', !r({ events: [{ title: 'x', date: today, start: '10:00', end: '09:00' }] }, 'create_events').ok);
  check('refuse-unknown-id', !r({ id: 'nope', changes: { title: 'x' } }, 'update_task').ok);
  check('refuse-empty-changes', !r({ id: M.getTasks()[0].id, changes: {} }, 'update_task').ok);
}

// 4. A plan can make a project and put new items in it by ref.
{
  const { plan, res } = stage([
    { name: 'create_projects', args: { projects: [{ ref: 'p1', name: 'Saggio launch', due: d(30) }] } },
    { name: 'create_tasks', args: { tasks: [{ title: 'Shoot photos', project: 'p1' }, { title: 'Write menu copy', project: 'p1' }] } },
    { name: 'create_events', args: { events: [{ title: 'Kickoff call', date: d(2), start: '10:00', end: '10:30', type: 'meeting', project: 'p1' }] } },
  ]);
  check('ref-stage', res.every((x) => x.ok), JSON.stringify(res.map((x) => x.response.error).filter(Boolean)));
  const ran = M.executePlan(plan);
  const p = M.getProjects().find((x) => x.n === 'Saggio launch');
  check('ref-links', ran.status === 'done' && p && M.linkedIds(p.id, 'task').length === 2 && M.linkedIds(p.id, 'event').length === 1, ran.error);
  check('refuse-unknown-ref', !stage([{ name: 'create_tasks', args: { tasks: [{ title: 'x', project: 'p9' }] } }]).res[0].ok);
}

// 5. All or nothing: a step that fails at run time puts everything back.
{
  const t = M.getTasks()[0];
  const before = JSON.stringify([M.getTasks(), M.getEvents(), M.getProjects()]);
  const { plan } = stage([
    { name: 'create_tasks', args: { tasks: [{ title: 'Should vanish' }] } },
    { name: 'update_task', args: { id: t.id, changes: { title: 'Renamed' } } },
  ]);
  // The task disappears between the card and the tap.
  plan.steps[1].args = { id: 'gone-meanwhile', changes: { title: 'Renamed' } };
  const ran = M.executePlan(plan);
  check('atomic-fails', ran.status === 'failed' && /Nothing was changed/.test(ran.error), ran.error);
  check('atomic-rollback', JSON.stringify([M.getTasks(), M.getEvents(), M.getProjects()]) === before);
}

// 6. Reads run at once; writes after a decided plan are refused.
{
  const plan = M.newPlan();
  const res = M.dispatch([{ name: 'get_overview', args: {} }], plan);
  check('read-runs-now', res[0].ok && res[0].response.data?.today === today && plan.steps.length === 0);
  plan.status = 'done';
  check('refuse-write-after-decided', !M.dispatch([{ name: 'create_notes', args: { notes: [{ title: 'x' }] } }], plan)[0].ok);
  const found = M.dispatch([{ name: 'search_items', args: { query: 'saggio' } }], M.newPlan())[0];
  check('search-finds', found.ok && found.response.data.matches.some((m) => m.kind === 'project'));
}

// 7. Repeating events: delete asks one day vs series; scope one skips a day.
{
  const ev = M.saveEvent({ d: today, tm: '09:00', t: 'Gym', rep: { f: 'daily' } });
  const ask = stage([{ name: 'delete_items', args: { items: [{ kind: 'event', id: ev.id }] } }]).res[0];
  check('delete-series-asks', !ask.ok && /one day|series/.test(ask.response.error));
  const { plan } = stage([{ name: 'delete_items', args: { items: [{ kind: 'event', id: ev.id, scope: 'one', date: d(1) }] } }]);
  check('delete-is-danger', plan.steps[0].danger === true);
  M.executePlan(plan);
  const after = M.getEvents().find((x) => x.id === ev.id);
  check('skip-one-day', after && after.skip?.includes(d(1)));
}

// 8. Goals: measure, progress, notes.
{
  const { plan } = stage([{ name: 'create_goals', args: { goals: [{ title: 'Land clients', target: 3, unit: 'clients', target_date: d(90), pace: 1, pace_per: 'month' }] } }]);
  M.executePlan(plan);
  const g = M.getGoals().find((x) => x.t === 'Land clients');
  check('goal-measure', g && g.tgt === 3 && g.cur === 0 && g.pace?.per === 'month');
  const p2 = stage([{ name: 'log_goal_progress', args: { goal_id: g.id, amount: 1 } }]).plan;
  M.executePlan(p2);
  const g2 = M.getGoals().find((x) => x.id === g.id);
  check('goal-progress', g2.cur === 1 && g2.st === 'in-progress');
  const n = stage([{ name: 'create_notes', args: { notes: [{ title: 'Menu ideas', body: 'Pasta night\n\nWine pairing <b>' }] } }]).plan;
  M.executePlan(n);
  const note = M.getNotes().find((x) => M.titleOf(x) === 'Menu ideas');
  check('note-body-escaped', note && note.body.includes('&lt;b&gt;') && !note.body.includes('<b>'));
}

// 9. The stream reader keeps each call's thought signature.
{
  const e = M.parseEvent('data: {"functionCall":{"name":"get_overview","args":{}},"sig":"abc"}');
  check('stream-sig', e && e.kind === 'call' && e.sig === 'abc');
}

if (failures.length) {
  console.log(`\nmae: ${failures.length} failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('\nmae: all checks pass');
