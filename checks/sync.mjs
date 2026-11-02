#!/usr/bin/env node
/* Sync check — the three-way merge, case by case, against the real code.
 *
 * mergeKind in src/sync.ts is pure: local items, the server's rows, and the
 * base (what this device last agreed with the server) go in; the new local
 * list, the upserts, the deletes, and the new base come out. The Supabase
 * calls around it are not run here. The checks/stores.mjs pattern: bundle
 * with the project's own esbuild, run against stubbed storage. auth.ts reads
 * import.meta.env at module load, so the bundle defines it empty — no
 * project is configured in here, and no network is touched.
 *
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
    define: { 'import.meta.env': '{}' },
  });
  return r.outputFiles[0].text;
}

const js = loadMod('../src/sync.ts');

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
const mod = { exports: {} };
const load = new Function('module', 'exports', 'localStorage', `${js}\nreturn module.exports;`);
const { mergeKind } = load(mod, mod.exports, localStorage);

const failures = [];
const check = (name, cond, detail) => {
  if (!cond) {
    failures.push(name);
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    console.log(`PASS  ${name}`);
  }
};

const def = { single: false, idOf: (x) => String(x.id) };
const item = (id, text, stamp) => ({ id, t: text, ...(stamp ? { updatedAt: stamp } : {}) });
const remoteOf = (items, deletedIds = []) => {
  const m = new Map();
  for (const i of items) m.set(String(i.id), { data: i, deleted: deletedIds.includes(i.id) });
  return m;
};
const baseOf = (items) => {
  const b = {};
  for (const i of items) {
    let h = 5381;
    const s = JSON.stringify(i);
    for (let k = 0; k < s.length; k++) h = ((h << 5) + h + s.charCodeAt(k)) | 0;
    b[String(i.id)] = { h: (h >>> 0).toString(36), t: i.updatedAt ?? 0 };
  }
  return b;
};
const ids = (list) => list.map((i) => i.id).sort().join(',');

// 1. New local item: kept, upserted, base set.
{
  const out = mergeKind(def, [item('a', 'one')], new Map(), {});
  check('new-local', ids(out.local) === 'a' && out.upserts.length === 1 && !!out.base.a, JSON.stringify(out.upserts));
}
// 2. New remote item: applied locally, nothing upserted.
{
  const out = mergeKind(def, [], remoteOf([item('a', 'one')]), {});
  check('new-remote', ids(out.local) === 'a' && out.upserts.length === 0 && out.localChanged, '');
}
// 3. Both unchanged: nothing moves.
{
  const a = item('a', 'one', 5);
  const out = mergeKind(def, [a], remoteOf([a]), baseOf([a]));
  check('unchanged', !out.localChanged && out.upserts.length === 0 && out.deletes.length === 0, '');
}
// 4. Local-only change: upserted.
{
  const before = item('a', 'one', 5);
  const after = item('a', 'edited', 9);
  const out = mergeKind(def, [after], remoteOf([before]), baseOf([before]));
  check('local-change', out.upserts.length === 1 && out.upserts[0].data.t === 'edited', '');
}
// 5. Remote-only change: applied.
{
  const before = item('a', 'one', 5);
  const after = item('a', 'edited', 9);
  const out = mergeKind(def, [before], remoteOf([after]), baseOf([before]));
  check('remote-change', out.local[0].t === 'edited' && out.upserts.length === 0, '');
}
// 6. Both changed, remote stamp newer: remote wins.
{
  const base = item('a', 'one', 5);
  const mine = item('a', 'mine', 8);
  const theirs = item('a', 'theirs', 12);
  const out = mergeKind(def, [mine], remoteOf([theirs]), baseOf([base]));
  check('both-remote-newer', out.local[0].t === 'theirs' && out.upserts.length === 0, '');
}
// 7. Both changed, local stamp newer: local wins and upserts.
{
  const base = item('a', 'one', 5);
  const mine = item('a', 'mine', 20);
  const theirs = item('a', 'theirs', 12);
  const out = mergeKind(def, [mine], remoteOf([theirs]), baseOf([base]));
  check('both-local-newer', out.local[0].t === 'mine' && out.upserts.length === 1, '');
}
// 8. Local delete, remote unchanged: the delete is pushed.
{
  const a = item('a', 'one', 5);
  const out = mergeKind(def, [], remoteOf([a]), baseOf([a]));
  check('local-delete', out.deletes.length === 1 && out.deletes[0].id === 'a' && !out.base.a, JSON.stringify(out.deletes));
}
// 9. Local delete, remote changed meanwhile: the item comes back.
{
  const a = item('a', 'one', 5);
  const changed = item('a', 'edited elsewhere', 9);
  const out = mergeKind(def, [], remoteOf([changed]), baseOf([a]));
  check('delete-vs-edit', ids(out.local) === 'a' && out.deletes.length === 0, '');
}
// 10. Remote tombstone, local unchanged: dropped locally.
{
  const a = item('a', 'one', 5);
  const out = mergeKind(def, [a], remoteOf([a], ['a']), baseOf([a]));
  check('remote-delete', out.local.length === 0 && out.localChanged && !out.base.a, '');
}
// 11. Remote tombstone, local changed: local wins, tombstone cleared by upsert.
{
  const a = item('a', 'one', 5);
  const edited = item('a', 'edited here', 9);
  const out = mergeKind(def, [edited], remoteOf([a], ['a']), baseOf([a]));
  check('delete-vs-local-edit', ids(out.local) === 'a' && out.upserts.length === 1, '');
}
// 12. First sync, account already has data: untouched examples stay behind.
{
  const seed = { id: 't1', t: 'Example', example: true };
  const mine = item('x', 'real');
  const out = mergeKind(def, [seed, mine], remoteOf([item('y', 'account data')]), {});
  check('first-sync-seeds', ids(out.local) === 'x,y' && out.upserts.length === 1 && out.upserts[0].id === 'x', ids(out.local));
}
// 13. First sync, empty account: this device's state is adopted whole.
{
  const seed = { id: 't1', t: 'Example', example: true };
  const out = mergeKind(def, [seed], new Map(), {});
  check('first-sync-adopts', ids(out.local) === 't1' && out.upserts.length === 1, '');
}
// 14. A single on first sync: the account's state wins over this device's.
{
  const singleDef = { single: true, idOf: () => 'state' };
  const localState = { pages: ['seed'] };
  const accountState = { pages: ['real'] };
  const out = mergeKind(singleDef, [localState], new Map([['state', { data: accountState, deleted: false }]]), {});
  check('single-first-sync', out.local[0].pages[0] === 'real' && out.upserts.length === 0, '');
}
// 15. In base, missing from the pull (a partial read): left exactly as-is.
{
  const a = item('a', 'one', 5);
  const out = mergeKind(def, [a], new Map(), baseOf([a]));
  check('partial-read-safe', ids(out.local) === 'a' && out.upserts.length === 0 && !!out.base.a, '');
}

if (failures.length) {
  console.error(`sync: ${failures.length} failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('all 15 passed');
