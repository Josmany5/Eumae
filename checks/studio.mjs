#!/usr/bin/env node
/* Studio check - catalog coverage + brief builder, real code.
 *
 * The checks/library.mjs pattern. No browser, no network.
 */
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';

const src = readFileSync(new URL('../src/studio.ts', import.meta.url), 'utf8');
const js = transformSync(src, { loader: 'ts', format: 'cjs' }).code
  .replace(/^export (function|const|let|interface|type|async function) /gm, '$1 ')
  .replace(/^export \{[^}]*\};?/gm, '')
  .replace(/^export default /gm, '');

const failures = [];
const check = (name, cond, detail) => {
  if (!cond) {
    failures.push(name);
    console.log('FAIL  ' + name + (detail ? ' - ' + detail : ''));
  } else {
    console.log('PASS  ' + name);
  }
};

function run(setup, body) {
  const store = {};
  const localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };
  setup(store);
  const mod = { exports: {} };
  const fn = new Function('module', 'exports', 'localStorage', js + '; return (' + body + ');');
  return { out: fn(mod, mod.exports, localStorage), store };
}

// 1. 12 categories, every template resolves + maps back to its category.
{
  const { out } = run(() => {}, '(() => { const cats = STUDIO_CATEGORY_ORDER; const names = cats.flatMap((c) => STUDIO_CATEGORIES[c]); const bad = names.filter((n) => !STUDIO_TEMPLATES[n] || categoryOf(n) === null); return { cats: cats.length, names: names.length, bad }; })()');
  check('catalog-covers', out.cats === 21 && out.names === 58 && out.bad.length === 0, JSON.stringify({ cats: out.cats, names: out.names, bad: out.bad }));
}

// 2. Brief string matches the mockup shape.
{
  const { out } = run(() => {}, '(() => buildBrief("Pitch deck", 1, "Terravita", "Menu, phone"))()');
  check('brief', out === 'Make a Pitch deck (Bold style: YOUR SITE IS LEAKING DINERS). Purpose: Terravita. Must include: Menu, phone', JSON.stringify(out));
}

// 3. Brief with no purpose/details stays clean.
{
  const { out } = run(() => {}, '(() => buildBrief("Memo", 0, "  ", ""))()');
  check('brief-bare', out === 'Make a Memo (Decision style: Memo: ship v8 before the backend)', JSON.stringify(out));
}

// 4. Drafts drawer flag persists.
{
  const { out } = run(() => {}, '(() => { const a = draftsOpen(); setDraftsOpen(true); const b = draftsOpen(); setDraftsOpen(false); return { a, b }; })()');
  check('drafts-flag', out.a === false && out.b === true, JSON.stringify(out));
}

// 5. Every category has an icon (root grid + gallery rows).
{
  const { out } = run(() => {}, '(() => STUDIO_CATEGORY_ORDER.filter((c) => !STUDIO_CATEGORY_ICONS[c]))()');
  check('cat-icons', out.length === 0, JSON.stringify(out));
}

if (failures.length) {
  console.error('studio: ' + failures.length + ' failed: ' + failures.join(', '));
  process.exit(1);
}
console.log('all 5 passed');
