#!/usr/bin/env node
/* Library check - seeds + folder ops + trash + prefs, real code.
 *
 * The checks/stores.mjs pattern. No browser, no network.
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

const lib = loadMod('../src/library.ts');

const failures = [];
const check = (name, cond, detail) => {
  if (!cond) {
    failures.push(name);
    console.log('FAIL  ' + name + (detail ? ' - ' + detail : ''));
  } else {
    console.log('PASS  ' + name);
  }
};

function run(js, setup, body) {
  const store = {};
  const localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };
  setup(store);
  const clock = { now: () => 8000 };
  const mod = { exports: {} };
  const fn = new Function('module', 'exports', 'localStorage', 'Date', js + '; return (' + body + ');');
  const fakeDate = { now: () => 8000 };
  return { out: fn(mod, mod.exports, localStorage, { now: () => 8000 }), store };
}

// 1. Seeds: 4 files verbatim, fav f1, 1 trash row.
{
  const { out } = run(lib, () => {}, '(() => ({ n: getFiles().length, favs: getFavs(), trash: getTrash().length }))()');
  check('seeds', out.n === 4 && JSON.stringify(out.favs) === '["f1"]' && out.trash === 1, JSON.stringify(out));
}

// 2. folOf + liveOnly: drafts hidden from folders, kinds filed right.
{
  const { out } = run(lib, () => {}, '(() => ({ docs: filesIn("Documents").map((f) => f.id), routines: filesIn("Routines").map((f) => f.id), links: filesIn("Links").map((f) => f.id) }))()');
  check('folders-live', JSON.stringify(out.docs) === '["f1"]' && JSON.stringify(out.routines) === '["f3"]' && JSON.stringify(out.links) === '["f4"]', JSON.stringify(out));
}

// 3. Folder add rejects blanks + dupes.
{
  const { out } = run(lib, () => {}, '(() => ({ a: addFolder("  "), b: addFolder("Documents"), c: addFolder("Zines"), n: getFolders().length }))()');
  check('add-folder', out.n === 1 && /Name/.test(out.a) && /exists/.test(out.b) && /created/.test(out.c), JSON.stringify(out));
}

// 4. Fav flip + status flip + trash round-trip.
{
  const { out } = run(lib, () => {}, '(() => { const on = toggleFav("f3"); const st = toggleStatus("f3").st; const gone = trashFile("f3"); const back = restoreTrash(0); return { on, st, gone, back, n: getFiles().length }; })()');
  check('ops', out.on === true && out.st === 'draft' && out.gone === true && out.back === true && out.n === 4, JSON.stringify(out));
}

// 5. Bad rows drop, prefs default.
{
  const { out } = run(lib, (store) => { store['eumae:library'] = JSON.stringify({ files: [{ id: 'x', t: 'Bad', k: 'NOPE', st: 'live', v: 1, b: '', createdAt: 1 }], folders: 'nope', favs: [], trash: [], filed: {}, prefs: {} }); }, '(() => ({ n: getFiles().length, p: folderPrefs("Documents") }))()');
  check('bad-drops', out.n === 0 && out.p.view === 'list' && out.p.sort === 'name', JSON.stringify(out));
}

// 6. Sort orders name/date/kind.
{
  const { out } = run(lib, () => {}, '(() => { const fs = getFiles(); return { byName: sortFiles(fs, "name", "asc").map((f) => f.id), byDate: sortFiles(fs, "date", "desc").map((f) => f.id) }; })()');
  check('sort', JSON.stringify(out.byDate) === '["f4","f3","f2","f1"]' && out.byName[0] === 'f4', JSON.stringify(out));
}

if (failures.length) {
  console.error('library: ' + failures.length + ' failed: ' + failures.join(', '));
  process.exit(1);
}
console.log('all 6 passed');
