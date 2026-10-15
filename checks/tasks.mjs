#!/usr/bin/env node
/* Tasks check — seeds + toggle + validation, against the real code.
 *
 * src/tasks.ts is storage-only TypeScript with no imports: transpile with
 * the project's own esbuild, run the rules for real against stubbed
 * storage. The checks/notes.mjs pattern. No browser, no network.
 *
 * Exit codes: 0 everything holds, 1 something does not.
 */
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';

const src = readFileSync(new URL('../src/tasks.ts', import.meta.url), 'utf8');

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
  };
  setup(store);
  const fakeDate = { now: () => 5000 };
  const mod = { exports: {} };
  const fn = new Function('module', 'exports', 'localStorage', 'Date', `${js}; return (${body});`);
  return { out: fn(mod, mod.exports, localStorage, fakeDate), store };
}

// 1. First run seeds the mockup's three rows, labeled examples.
{
  const { out } = run(() => {}, `(() => getTasks())()`);
  check('seeds-three', out.length === 3, JSON.stringify(out.length));
  check(
    'seeds-labeled',
    out.every((t) => t.example === true),
    JSON.stringify(out.map((t) => t.example)),
  );
  check('seeds-titles', out[0].t === 'Draft YC demo script' && out[2].d === 1, JSON.stringify(out.map((t) => t.t)));
}

// 2. Toggle flips done, keeps the row.
{
  const { out } = run(() => {}, `(() => { toggleTask('t1'); return getTask('t1'); })()`);
  check('toggle-flips', out && out.d === 1, JSON.stringify(out && out.d));
}

// 3. Bad rows are dropped, never crash.
{
  const { out } = run(
    (store) => {
      store['eumae:tasks'] = JSON.stringify([{ id: 'x' }, null, 'nope', { id: 'ok', t: 'Real', d: 0, createdAt: 1 }]);
    },
    `(() => getTasks())()`,
  );
  check('bad-dropped', out.length === 1 && out[0].t === 'Real', JSON.stringify(out.length));
}

// 4. Create + delete round-trip.
{
  const { out } = run(
    () => {},
    `(() => { const t = createTask('New thing'); const n1 = getTasks().length; deleteTask(t.id); return { n1, n2: getTasks().length }; })()`,
  );
  check('create-delete', out.n1 === 4 && out.n2 === 3, JSON.stringify(out));
}

// 5. Old rows normalize: list inbox, pr none, sub empty.
{
  const { out } = run(
    (store) => {
      store['eumae:tasks'] = JSON.stringify([{ id: 'old', t: 'Old row', d: 0, createdAt: 1 }]);
    },
    `(() => getTask('old'))()`,
  );
  check(
    'old-normalizes',
    out && out.list === 'inbox' && out.pr === 'none' && Array.isArray(out.sub) && out.sub.length === 0,
    JSON.stringify(out),
  );
}

// 6. Priority cycles none → important → urgent → critical → none.
{
  const { out } = run(
    () => {},
    `(() => { const a = cyclePriority('t1'); const b = cyclePriority('t1'); const c = cyclePriority('t1'); const d = cyclePriority('t1'); return [a, b, c, d]; })()`,
  );
  check(
    'pr-cycles',
    JSON.stringify(out) === JSON.stringify(['important', 'urgent', 'critical', 'none']),
    JSON.stringify(out),
  );
}

// 7. Subtasks add + toggle.
{
  const { out } = run(
    () => {},
    `(() => { addSubtask('t1', 'First step'); const n = getTask('t1').sub.length; toggleSubtask('t1', 0); return { n, d: getTask('t1').sub[0].d }; })()`,
  );
  check('subtasks', out.n === 1 && out.d === 1, JSON.stringify(out));
}

// 8. Lists seed inbox + work, add appends.
{
  const { out } = run(
    () => {},
    `(() => { const before = getLists().map((l) => l.id); const added = addList('Home'); return { before, added: added && added.n, after: getLists().length }; })()`,
  );
  check(
    'lists',
    JSON.stringify(out.before) === JSON.stringify(['inbox', 'work']) && out.added === 'Home' && out.after === 3,
    JSON.stringify(out),
  );
}

if (failures.length) {
  console.error(`tasks: ${failures.length} failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('all 8 passed');
