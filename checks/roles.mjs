#!/usr/bin/env node
/* Roles check — custom role store + directives line, real code.
 *
 * The checks/library.mjs pattern. No browser, no network.
 */
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';

/* One module (or several, sharing a scope), imports included.
 *
 *  This used to be `transformSync` on a single file plus an `export` strip,
 *  which only works for a file with no imports. request.ts imports voiceLang,
 *  so the check emitted `require('./voiceLang')` — no `require` exists in an
 *  eval scope — and then roles.ts grew imports of its own (STANDARD.md 3.4). */
function loadMod(...specs) {
  const resolveDir = fileURLToPath(new URL('.', import.meta.url));
  const contents = specs.map((s) => `export * from '${s}';`).join('\n');
  const r = buildSync({
    stdin: { contents, loader: 'ts', resolveDir },
    bundle: true,
    format: 'cjs',
    platform: 'node',
    write: false,
    logLevel: 'silent',
  });
  return r.outputFiles[0].text;
}

const roles = loadMod('../src/roles');
/* Both in one bundle, one scope — the directives line needs the role the
   store just saved. */
const both = loadMod('../src/roles', '../src/request');

const failures = [];
const check = (name, cond, detail) => {
  if (!cond) {
    failures.push(name);
    console.log('FAIL  ' + name + (detail ? ' - ' + detail : ''));
  } else {
    console.log('PASS  ' + name);
  }
};

/* Run a bundle once in a scope holding our fake localStorage, then hand the
   body its exports as plain names — the same shape the old strip-the-export
   eval gave it. esbuild's CommonJS output returns its exports on
   `module.exports`. */
function scope(js, setup) {
  const store = {};
  const localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };
  setup(store);
  const mod = { exports: {} };
  const load = new Function('module', 'exports', 'localStorage', js + '\nreturn module.exports;');
  const ns = load(mod, mod.exports, localStorage);
  const names = Object.keys(ns).filter((k) => /^[A-Za-z_$][\w$]*$/.test(k));
  return {
    ns,
    store,
    eval: (body) => new Function('ns', 'localStorage', `const {${names.join(', ')}} = ns; return (${body});`)(ns, localStorage),
  };
}

function run(js, setup, body) {
  const s = scope(js, setup);
  return { out: s.eval(body), store: s.store };
}

function runBoth(setup, body) {
  return run(both, setup, body);
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
