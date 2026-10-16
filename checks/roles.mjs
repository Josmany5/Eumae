#!/usr/bin/env node
/* Roles check — custom role store + directives line, real code.
 *
 * The checks/library.mjs pattern. No browser, no network.
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

const roles = loadMod('../src/roles.ts');
const request = loadMod('../src/request.ts');

const failures = [];
const check = (name, cond, detail) => {
  if (!cond) {
    failures.push(name);
    console.log('FAIL  ' + name + (detail ? ' - ' + detail : ''));
  } else {
    console.log('PASS  ' + name);
  }
};

function run(js, setup, body, extra) {
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

function runBoth(setup, body) {
  const store = {};
  const localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };
  setup(store);
  const js = roles + '\n' + request;
  const mod = { exports: {} };
  const fn = new Function('module', 'exports', 'localStorage', js + '; return (' + body + ');');
  return { out: fn(mod, mod.exports, localStorage), store };
}

// 1. Empty store, save + find round-trip, blank name defaults.
{
  const { out } = run(roles, () => {}, '(() => { const n = saveRole({ n: "  ", tone: "blunt", style: "", purpose: "" }); return { n, found: !!findRole(n), all: getRoles().length }; })()');
  check('save-find', out.n === 'Custom role' && out.found && out.all === 1, JSON.stringify(out));
}

// 2. Bad rows drop.
{
  const { out } = run(roles, (store) => { store['eumae:roles'] = JSON.stringify([{ n: 'x' }, null, 'nope']); }, '(() => getRoles().length)()');
  check('bad-drops', out === 0, JSON.stringify(out));
}

// 3. Custom role reaches systemPrompt via directives().
{
  const { out } = runBoth(
    () => {},
    '(() => { saveRole({ n: "Co-founder", tone: "blunt", style: "short", purpose: "pressure-test" }); const r = findRole("Co-founder"); const req = { mode: "Ask", role: "Co-founder", skill: "", thinking: "Balanced", model: "Auto", refs: [], text: "hi" }; return directives(req, r); })()',
  );
  check(
    'directives-line',
    out.includes('Role: Co-founder.') && out.includes('tone: blunt') && out.includes('pressure-test'),
    JSON.stringify(out.slice(-160)),
  );
}

// 4. Built-in role travels bare — no custom lookup, no extra line.
{
  const { out } = runBoth(
    () => {},
    '(() => { const req = { mode: "Ask", role: "Coach", skill: "", thinking: "Balanced", model: "Auto", refs: [], text: "hi" }; return directives(req, findRole("Coach") ?? null); })()',
  );
  check('builtin-bare', out.includes('Role: Coach.') && !out.includes('tone:'), JSON.stringify(out.slice(-120)));
}

if (failures.length) {
  console.error('roles: ' + failures.length + ' failed: ' + failures.join(', '));
  process.exit(1);
}
console.log('all 4 passed');
