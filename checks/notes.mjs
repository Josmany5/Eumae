#!/usr/bin/env node
/* Notes check — migration + first-line title, against the real code.
 *
 *  src/notes.ts is storage-only TypeScript with no imports, so this
 *  transpiles it with the project's own esbuild and runs the rules for real
 *  against stubbed storage — the checks/boot.mjs pattern. No browser, no
 *  network.
 *
 *  What it exists to catch: the 2026-10-12 rebuild (entries-per-visit boxes
 *  into one flowing document). Old notes carry `entries`; new ones carry
 *  `body`+`sessions`. Both must parse, old must migrate without losing text,
 *  the title must read off the first line, and a fresh note must start empty.
 *
 *  Exit codes: 0 everything holds, 1 something does not.
 */
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';

const src = readFileSync(new URL('../src/notes.ts', import.meta.url), 'utf8');

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

/* One run against fresh stubbed storage. `Date` is faked forward per case so
   created ids cannot collide across cases. */
let now = 1000;
function run(setup, body) {
  const store = {};
  const localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => {
      store[k] = String(v);
    },
  };
  setup(store);
  const tick = now;
  now += 1000;
  const fakeDate = { now: () => tick };
  const mod = { exports: {} };
  const fn = new Function(
    'module',
    'exports',
    'localStorage',
    'Date',
    `${js}; return (${body});`,
  );
  return { out: fn(mod, mod.exports, localStorage, fakeDate), store };
}

const OLD = {
  id: 'n1',
  title: 'Trip',
  entries: [
    { id: 'e1', text: '<p>pack bags</p>', createdAt: 100, editedAt: 100 },
    { id: 'e2', text: '<p>book flight</p>', createdAt: 200, editedAt: 200 },
  ],
  sortNewFirst: true,
  createdAt: 100,
  updatedAt: 200,
  ownerId: '',
};

// 1. An old-shape note migrates: no text lost, sessions stamped, title kept.
{
  const { out } = run(
    (store) => {
      store['eumae:notes'] = JSON.stringify([OLD]);
    },
    `(() => { const ns = getNotes(); return { body: ns[0].body, sessions: ns[0].sessions, title: titleOf(ns[0]) }; })()`,
  );
  check(
    'migrate-keeps-text',
    out.body.includes('pack bags') && out.body.includes('book flight'),
    out.body.slice(0, 80),
  );
  check(
    'migrate-stamps-sessions',
    Array.isArray(out.sessions) && out.sessions.length === 2,
    JSON.stringify(out.sessions),
  );
  check('migrate-title', out.title.includes('pack bags'), out.title);
}

// 2. Empty entries never become sessions or body.
{
  const { out } = run(
    (store) => {
      store['eumae:notes'] = JSON.stringify([
        {
          ...OLD,
          id: 'n2',
          entries: [{ id: 'e9', text: '<p><br></p>', createdAt: 50, editedAt: 50 }],
        },
      ]);
    },
    `(() => { const ns = getNotes(); return { body: ns[0].body, sessions: ns[0].sessions }; })()`,
  );
  check(
    'migrate-skips-empty',
    out.body === '' && out.sessions.length === 0,
    JSON.stringify({ body: out.body, sessions: out.sessions }),
  );
}

// 3. A fresh note starts empty with no sessions.
{
  const { out } = run(
    () => {},
    `(() => { const n = createNote(); return { body: n.body, sessions: n.sessions, title: titleOf(n) }; })()`,
  );
  check(
    'fresh-starts-empty',
    out.body === '' && Array.isArray(out.sessions) && out.sessions.length === 0,
    JSON.stringify(out),
  );
}

// 4. A migrated note passes through untouched on the next load.
{
  const { out } = run(
    (store) => {
      store['eumae:notes'] = JSON.stringify([OLD]);
    },
    `(() => { const once = getNotes()[0]; return { sessions: once.sessions.length, bodyLen: once.body.length }; })()`,
  );
  check('migrate-idempotent-shape', out.sessions === 2 && out.bodyLen > 0, JSON.stringify(out));
}

if (failures.length) {
  console.error(`notes: ${failures.length} failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('all 4 passed');
