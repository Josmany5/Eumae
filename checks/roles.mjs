#!/usr/bin/env node
/* Roles check — custom role store + the Role line the server builds, real code.
 *
 * The checks/library.mjs pattern. No browser, no network. Since Oct 29 the
 * Role line is composed on the server (api/_prompts.ts, `composePrompt`), so
 * this reads the same road the app takes: toApiBody writes the spec, the server
 * turns it into the prompt.
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
/* Both in one bundle, one scope — the prompt needs the role the store saved,
   and the spec needs the client's own request builder. */
const both = loadMod('../src/roles', '../src/request', '../api/_prompts');

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

// 3. A custom role's definition reaches the prompt the server builds, in the
//    Role line, from the spec the client wrote.
{
  const { out } = runBoth(
    () => {},
    '(() => { saveRole({ n: "Co-founder", tone: "blunt", style: "short", purpose: "pressure-test" }); const r = findRole("Co-founder"); const turn = { mode: "Ask", role: "Co-founder", skill: "", thinking: "Balanced", model: "Auto" }; const body = toApiBody({ ...turn, refs: [], text: "hi" }, [], r); return { spec: body.data.prompt, prompt: composePrompt(body.data.prompt) }; })()',
  );
  check(
    'role-line',
    out.spec.role === 'Co-founder' &&
      out.spec.tone === 'blunt' &&
      out.prompt.includes('Role: Co-founder.') &&
      out.prompt.includes('tone: blunt') &&
      out.prompt.includes('purpose: pressure-test'),
    JSON.stringify(out.spec),
  );
}

// 4. A built-in role travels as the name alone — no definition, no extra line.
{
  const { out } = runBoth(
    () => {},
    '(() => { const turn = { mode: "Ask", role: "Coach", skill: "", thinking: "Balanced", model: "Auto" }; const body = toApiBody({ ...turn, refs: [], text: "hi" }, [], findRole("Coach") ?? null); return { spec: body.data.prompt, prompt: composePrompt(body.data.prompt) }; })()',
  );
  check('builtin-bare', out.spec.role === 'Coach' && out.prompt.includes('Role: Coach.') && !out.prompt.includes('tone:'), out.prompt.slice(out.prompt.indexOf('Role: '), out.prompt.indexOf('Role: ') + 80));
}

if (failures.length) {
  console.error('roles: ' + failures.length + ' failed: ' + failures.join(', '));
  process.exit(1);
}
console.log('all 4 passed');
