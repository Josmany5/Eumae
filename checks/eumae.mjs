#!/usr/bin/env node
/* Eumae tools check: the registry, the schema checker and the dispatcher,
 * run for real against the real stores with an in-memory localStorage.
 *
 * Every case here is a way Eumae went wrong before (Wove), or a promise the
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
  get length() {
    return Object.keys(store).length;
  },
  key: (i) => Object.keys(store)[i] ?? null,
};

const out = buildSync({
  stdin: {
    contents: `export * from './src/eumae/dispatcher'; export { REGISTRY, humanTimes } from './src/eumae/registry'; export { resolveDate, resolveTime } from './src/eumae/when'; export { guessesIn } from './src/eumae/guess'; export { check, toGemini } from './src/eumae/schema';
      export { getTasks, getTask } from './src/tasks'; export { getEvents, saveEvent, ymd } from './src/events'; export { getGoals, goalOf, goalLinkedIds } from './src/goals';
      export { getProjects, linkedIds } from './src/projects'; export { getNotes, titleOf } from './src/notes'; export { parseEvent } from './src/chat'; export { getLists, addList } from './src/tasks'; export { getThreads, saveThread, getCurrentThreadId, setCurrentThreadId } from './src/threads'; export { getFiles, getFavs, getTrash, allFolders, folderOf, folderPrefs } from './src/library';`,
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
const tmp = join(mkdtempSync(join(tmpdir(), 'eumae-')), 'bundle.mjs');
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
const stage = (calls, heard = "") => {
  const plan = M.newPlan();
  const res = M.dispatch(calls, plan, heard);
  return { plan, res };
};

// 1. Registry: every tool has a unique name, a description, a valid Gemini form.
{
  const names = M.REGISTRY.map((a) => a.name);
  check('registry-unique-names', new Set(names).size === names.length);
  const decls = M.declarations();
  check('registry-declarations', decls.length === M.REGISTRY.length + 1 && decls.some((x) => x.name === 'drop_plan_lines') && decls.every((x) => x.name && x.description && x.parameters?.type === 'OBJECT'));
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

// 10. One open card per chat: a second ask adds to the waiting card.
{
  const first = stage([{ name: 'create_tasks', args: { tasks: [{ title: 'Outline chapter 1' }, { title: 'Outline chapter 2' }] } }]).plan;
  const next = M.continuePlan(first);
  M.dispatch([{ name: 'create_tasks', args: { tasks: [{ title: 'Pick a title' }] } }], next);
  const lines = next.steps.flatMap((st) => st.lines.map((l) => l.text));
  check('card-adds', next.id === first.id && lines.length === 3 && lines[2] === 'Pick a title', JSON.stringify(lines));
  check('card-fresh', next.steps[0].fresh === false && next.steps[1].fresh === true);
  check('card-note-lists', /STILL WAITING/.test(M.planNote(next)) && /3\. Create task: Pick a title/.test(M.planNote(next)), M.planNote(next));
  const r = M.dispatch([{ name: 'drop_plan_lines', args: { lines: [2] } }], next);
  const left = next.steps.flatMap((st) => st.lines.map((l) => l.text));
  check('card-drop-one', r[0].ok && left.join('|') === 'Outline chapter 1|Pick a title' && next.steps[0].args.tasks.length === 1, JSON.stringify(left));
  const bad = M.dispatch([{ name: 'drop_plan_lines', args: { lines: [9] } }], next);
  check('card-drop-bad', !bad[0].ok);
  const det = M.detachFresh(next);
  check('card-detach', det && det.id !== next.id && det.steps.length === 1 && det.steps[0].lines[0].text === 'Pick a title');
  const before = M.getTasks().length;
  M.executePlan(next);
  check('card-runs-all', M.getTasks().length === before + 2);
}

// 11. Goals own their own tasks, events and notes.
{
  const { plan, res } = stage([
    { name: 'create_goals', args: { goals: [{ title: 'Write my book', ref: 'g1' }] } },
    { name: 'create_tasks', args: { tasks: [{ title: 'Write 500 words', goal: 'g1' }] } },
    { name: 'create_events', args: { events: [{ title: 'Writing block', date: d(1), start: '07:00', goal: 'g1' }] } },
    { name: 'create_notes', args: { notes: [{ title: 'Book idea', body: 'A story about…', goal: 'g1' }] } },
  ]);
  check('goal-ref-stages', res.every((x) => x.ok), JSON.stringify(res.map((x) => x.response.error).filter(Boolean)));
  const ran = M.executePlan(plan);
  const g = M.getGoals().find((x) => x.t === 'Write my book');
  check('goal-owns', ran.status === 'done' && g && M.goalLinkedIds(g.id, 'task').length === 1 && M.goalLinkedIds(g.id, 'event').length === 1 && M.goalLinkedIds(g.id, 'note').length === 1, ran.error);
  const t = M.getTasks().find((x) => x.t === 'Write 500 words');
  const bad = stage([{ name: 'link_to_goal', args: { goal: 'nope', items: [{ kind: 'task', id: t.id }] } }]).res;
  check('goal-link-missing', !bad[0].ok);
  const un = stage([{ name: 'unlink_from_goal', args: { items: [{ kind: 'task', id: t.id }] } }]).plan;
  M.executePlan(un);
  check('goal-unlink', !M.goalOf('task', t.id));
  const li = M.REGISTRY.find((a) => a.name === 'list_items').run({ kind: 'event', goal: g.id }, {});
  check('goal-list-filter', li.ok && li.data.items.length === 1 && li.data.items[0].goal === 'Write my book', JSON.stringify(li.data));
}

// Checklist: plain tick lines on a task, separate from subtasks.
{
  const { plan, res } = stage([{ name: 'create_tasks', args: { tasks: [{ title: 'Pack for the trip', checklist: ['Passport', 'Charger', 'Socks'] }] } }]);
  check('checklist-stage', res[0].ok && /checklist of 3 lines/.test(plan.steps[0].lines[0].detail ?? ''), JSON.stringify(res[0].response));
  M.executePlan(plan);
  const t = M.getTasks().find((x) => x.t === 'Pack for the trip');
  check('checklist-shape', t && t.cl.length === 3 && t.cl.every((c) => c.d === false) && t.sub.length === 0, JSON.stringify(t));
  const read = M.REGISTRY.find((a) => a.name === 'read_item').run({ kind: 'task', id: t.id }, {});
  check('checklist-read', read.ok && read.data.checklist.length === 3 && read.data.checklist[1].text === 'Charger');
  const up = stage([{ name: 'update_task', args: { id: t.id, changes: { checklist_tick: [0], checklist_add: ['Toothbrush'] } } }]);
  check('checklist-lines', up.res[0].ok && up.plan.steps[0].lines.map((l) => l.verb + ' ' + l.text).join('|') === 'Tick Passport|Add Toothbrush', JSON.stringify(up.plan.steps[0]?.lines));
  check('checklist-not-before-approve', !M.getTask(t.id).cl[0].d);
  M.executePlan(up.plan);
  const t2 = M.getTask(t.id);
  check('checklist-tick-add', t2.cl.length === 4 && t2.cl[0].d === true && t2.cl[3].t === 'Toothbrush');
  check('checklist-refuse-bad-index', !stage([{ name: 'update_task', args: { id: t.id, changes: { checklist_tick: [9] } } }]).res[0].ok);
  const li = M.REGISTRY.find((a) => a.name === 'list_items').run({ kind: 'task' }, {});
  check('checklist-in-list', li.ok && li.data.items.some((x) => x.id === t.id && x.checklist === '1/4 ticked'), JSON.stringify(li.data.items.find((x) => x.id === t.id)));
}

// Honesty bite: guesses are named on the card, times read like people say them.
{
  const { plan } = stage([{ name: 'create_tasks', args: { tasks: [{ title: 'Draft chapter one', due: d(3), estimate: 60, guessed: ['due', 'estimate'] }, { title: 'Email editor' }] } }]);
  const [a, b] = plan.steps[0].lines;
  check('guess-label', a.guess === 'due date, how long' && !b.guess, JSON.stringify(a));
  check('guess-not-saved', M.executePlan(plan).status === 'done' && !('guessed' in M.getTasks().find((t) => t.t === 'Draft chapter one')));
  check('human-times', M.humanTimes('Dinner at 19:00, gym 07:30, call at 10:00 AM') === 'Dinner at 7 pm, gym 7:30 am, call at 10:00 AM');
}

// Dates in the person's words, worked out by code. Monday Oct 19, 2026.
{
  const now = new Date(2026, 9, 19, 21, 53);
  const D = (s) => M.resolveDate(s, now);
  const cases = {
    tomorrow: '2026-10-20', today: '2026-10-19', 'in 3 weeks': '2026-11-09', 'three weeks from now': '2026-11-09', 'in a week': '2026-10-26',
    friday: '2026-10-23', 'this friday': '2026-10-23', monday: '2026-10-26', 'next monday': '2026-10-26', 'friday next week': '2026-10-30',
    'next week': '2026-10-26', 'end of the month': '2026-10-31', 'next month': '2026-11-01', 'this weekend': '2026-10-24',
    'Nov 14': '2026-11-14', 'november 14th': '2026-11-14', '14 November': '2026-11-14', 'the 25th': '2026-10-25', 'the 5th': '2026-11-05',
    'the second Friday of November': '2026-11-13', 'last monday of next month': '2026-11-30', 'Jan 3': '2027-01-03', '10/30': '2026-10-30',
    'in 2 months': '2026-12-19', '2026-12-01': '2026-12-01',
  };
  const bad = Object.entries(cases).filter(([k, v]) => { const r = D(k); return !r.ok || r.value !== v; }).map(([k, v]) => `${k}→${JSON.stringify(D(k))} want ${v}`);
  check('dates-resolve', !bad.length, bad.join('; '));
  const nf = D('next friday');
  check('dates-ambiguous-asks', !nf.ok && /Oct 23/.test(nf.why) && /Oct 30/.test(nf.why), JSON.stringify(nf));
  check('dates-unknown-asks', !D('sometime soonish').ok);
  const T = M.resolveTime;
  check('times-resolve', T('7 pm').value === '19:00' && T('7:30am').value === '07:30' && T('noon').value === '12:00' && T('12 am').value === '00:00' && T('8 in the evening').value === '20:00' && T('19:15').value === '19:15');
  check('times-ambiguous-asks', !T('7').ok && !T('7:30').ok);
  const { res, plan } = stage([{ name: 'create_tasks', args: { tasks: [{ title: 'Call the physical therapist', due: 'tomorrow', time: '3 pm' }] } }]);
  const want = M.ymd(new Date(Date.now() + 86400000));
  check('stage-resolves-phrase', res[0].ok && plan.steps[0].args.tasks[0].due === want && plan.steps[0].args.tasks[0].time === '15:00', JSON.stringify(res[0]));
  check('stage-refuses-ambiguous', !stage([{ name: 'create_tasks', args: { tasks: [{ title: 'x', time: '7' }] } }]).res[0].ok);
}

// Guess detector: details the person never said go back to Eumae to name.
{
  const G = M.guessesIn;
  const t = { tasks: [{ title: 'Write for 1 hour on the book', estimate: 60, priority: 'high' }] };
  check('guess-detects', JSON.stringify(G('create_tasks', t, t, 'Help me work on my book this week')) === JSON.stringify(['Write for 1 hour on the book: about 1 hour, high priority']), JSON.stringify(G('create_tasks', t, t, 'Help me work on my book this week')));
  check('guess-quiet-when-said', G('create_tasks', t, t, 'write for an hour, it is urgent').length === 0);
  const d = { tasks: [{ title: 'Call PT', due: '2026-10-20' }] };
  check('guess-date', G('create_tasks', d, d, 'add call PT').length === 1 && G('create_tasks', d, { tasks: [{ due: 'tomorrow' }] }, 'call PT tomorrow').length === 0);
  const e = { events: [{ title: 'Dinner', date: '2026-10-23', start: '19:00', location: 'Saggio' }] };
  check('guess-event-place', /place \(Saggio\)/.test(G('create_events', e, { events: [{ date: 'friday', start: '7 pm' }] }, 'dinner friday at 7 pm')[0] ?? ''));
  const r = stage([{ name: 'create_tasks', args: { tasks: [{ title: 'Draft intro', estimate: 45 }] } }], 'draft the intro');
  check('guess-in-response', r.res[0].ok && r.res[0].response.you_added?.[0] === 'Draft intro: about 45 min', JSON.stringify(r.res[0].response));
}

// Wave 2a: lists, subtasks, one-day moves, chats.
{
  const l = M.addList('Errands2');
  M.executePlan(stage([{ name: 'rename_list', args: { list: 'Errands2', name: 'Shop' } }]).plan);
  check('w2-rename-list', M.getLists().some((x) => x.id === l.id && x.n === 'Shop'));
  check('w2-main-list-kept', !stage([{ name: 'delete_list', args: { list: M.getLists()[0].id } }]).res[0].ok);
  M.executePlan(stage([{ name: 'delete_list', args: { list: 'Shop' } }]).plan);
  check('w2-delete-list', !M.getLists().some((x) => x.id === l.id));

  M.executePlan(stage([{ name: 'create_tasks', args: { tasks: [{ title: 'Pack', subtasks: ['a', 'b', 'c'] }] } }]).plan);
  const tk = M.getTasks().find((x) => x.t === 'Pack');
  M.executePlan(stage([{ name: 'edit_subtasks', args: { task_id: tk.id, rename: [{ index: 0, title: 'A' }], tick: [1], remove: [0, 2] } }]).plan);
  const tk2 = M.getTask(tk.id);
  check('w2-subtasks', tk2.sub.length === 1 && tk2.sub[0].t === 'b' && tk2.sub[0].d === 1, JSON.stringify(tk2.sub));
  check('w2-subtask-bad-index', !stage([{ name: 'edit_subtasks', args: { task_id: tk.id, remove: [5] } }]).res[0].ok);

  const ev = M.saveEvent({ d: today, tm: '07:00', t: 'Run', rep: { f: 'daily' } });
  M.executePlan(stage([{ name: 'move_one_day', args: { event_id: ev.id, date: d(2), to_date: d(3), to_time: '18:00' } }]).plan);
  const series = M.getEvents().find((x) => x.id === ev.id);
  check('w2-move-one-day', series.skip?.includes(d(2)) && M.getEvents().some((x) => x.t === 'Run' && x.d === d(3) && x.tm === '18:00' && !x.rep));

  const now = Date.now() - 3600_000;
  M.saveThread({ id: 'tOld', title: 'Old chat', createdAt: now, updatedAt: now, messages: [{ id: 1, role: 'you', text: 'hi', ts: now }] });
  M.saveThread({ id: 'tCur', title: 'Current', createdAt: now, updatedAt: now, messages: [{ id: 1, role: 'you', text: 'hi', ts: now }] });
  M.setCurrentThreadId('tCur');
  const lc = M.dispatch([{ name: 'list_chats', args: {} }], M.newPlan())[0];
  check('w2-list-chats', lc.ok && lc.response.data.chats.some((c) => c.id === 'tOld'));
  check('w2-no-delete-current', !stage([{ name: 'delete_chats', args: { ids: ['tCur'] } }]).res[0].ok);
  M.saveThread({ id: 'tOff', title: 'Console', createdAt: now, updatedAt: now, messages: [{ id: 1, role: 'you', text: 'hi', ts: now }], from: 'Console' });
  localStorage.setItem('eumae:office:console', 'tOff');
  check('w2-no-delete-open-office', !stage([{ name: 'delete_chats', args: { ids: ['tOff'] } }]).res[0].ok);
  const dp = stage([{ name: 'delete_chats', args: { ids: ['tOld'] } }]).plan;
  check('w2-delete-chat-danger', dp.steps[0]?.danger === true);
  M.executePlan(dp);
  check('w2-delete-chat', !M.getThreads().some((x) => x.id === 'tOld'));
}

// Wave 2b: Library files and folders.
{
  const P = (calls) => stage(calls).plan;
  M.executePlan(P([{ name: 'create_folders', args: { names: ['Pitches'] } }]));
  check('w2b-folder', M.allFolders().includes('Pitches'));
  M.executePlan(P([{ name: 'create_files', args: { files: [{ title: 'Deck A', kind: 'DOC', body: 'one', folder: 'pitches' }, { title: 'Deck B', kind: 'DOC' }] } }]));
  const a = M.getFiles().find((f) => f.t === 'Deck A');
  const b = M.getFiles().find((f) => f.t === 'Deck B');
  check('w2b-create-two', a && b && a.id !== b.id && M.folderOf(a) === 'Pitches' && a.b === 'one' && a.st === 'draft');
  const lf = M.dispatch([{ name: 'list_files', args: { folder: 'Pitches' } }], M.newPlan())[0];
  check('w2b-list', lf.ok && lf.response.data.files.length === 1 && lf.response.data.files[0].id === a.id);
  check('w2b-bad-folder', !stage([{ name: 'create_files', args: { files: [{ title: 'x', kind: 'DOC', folder: 'Nope' }] } }]).res[0].ok);
  M.executePlan(P([{ name: 'edit_file', args: { id: a.id, body: 'two' } }]));
  const a2 = M.getFiles().find((f) => f.id === a.id);
  check('w2b-edit-version', a2.v === 2 && a2.b === 'two' && a2.hist?.some((h) => h.v === 1 && h.b === 'one'));
  M.executePlan(P([{ name: 'restore_version', args: { id: a.id, version: 1 } }]));
  check('w2b-restore-version', M.getFiles().find((f) => f.id === a.id).b === 'one');
  check('w2b-bad-version', !stage([{ name: 'restore_version', args: { id: a.id, version: 9 } }]).res[0].ok);
  M.executePlan(P([{ name: 'favorite_files', args: { ids: [a.id] } }, { name: 'set_file_status', args: { ids: [a.id], status: 'live' } }, { name: 'move_files', args: { ids: [b.id], folder: 'Pitches' } }]));
  check('w2b-fav-live-move', M.getFavs().includes(a.id) && M.getFiles().find((f) => f.id === a.id).st === 'live' && M.folderOf(M.getFiles().find((f) => f.id === b.id)) === 'Pitches');
  check('w2b-no-move-special', !stage([{ name: 'move_files', args: { ids: [b.id], folder: 'Shared' } }]).res[0].ok);
  M.executePlan(P([{ name: 'set_folder_view', args: { folder: 'Pitches', view: 'icon', sort: 'date' } }]));
  check('w2b-folder-view', M.folderPrefs('Pitches').view === 'icon' && M.folderPrefs('Pitches').sort === 'date');
  check('w2b-builtin-folder-kept', !stage([{ name: 'delete_folder', args: { folder: 'Documents' } }]).res[0].ok);
  const tp = P([{ name: 'trash_files', args: { ids: [b.id] } }]);
  check('w2b-trash-danger', tp.steps[0]?.danger === true);
  const done = M.executePlan(tp);
  check('w2b-trash', !M.getFiles().some((f) => f.id === b.id) && M.getTrash().some((t) => t.t === 'Deck B'));
  M.undoPlan(done);
  check('w2b-undo-library', M.getFiles().some((f) => f.id === b.id));
  M.executePlan(P([{ name: 'trash_files', args: { ids: [b.id] } }]));
  const ti = M.getTrash().findIndex((t) => t.t === 'Deck B');
  M.executePlan(P([{ name: 'restore_from_trash', args: { indexes: [ti] } }]));
  check('w2b-restore-trash', M.getFiles().some((f) => f.t === 'Deck B' && f.st === 'draft'));
  M.executePlan(P([{ name: 'rename_folder', args: { folder: 'Pitches', name: 'Decks' } }]));
  check('w2b-rename-folder', M.allFolders().includes('Decks') && M.folderOf(M.getFiles().find((f) => f.id === a.id)) === 'Decks');
  M.executePlan(P([{ name: 'delete_folder', args: { folder: 'Decks' } }]));
  check('w2b-delete-folder-keeps-files', !M.allFolders().includes('Decks') && M.getFiles().some((f) => f.id === a.id));
  M.executePlan(P([{ name: 'empty_trash', args: {} }]));
  check('w2b-empty-trash', M.getTrash().length === 0);
}

if (failures.length) {
  console.log(`\nmae: ${failures.length} failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('\neumae: all checks pass');
