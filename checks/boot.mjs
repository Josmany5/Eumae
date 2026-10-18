#!/usr/bin/env node
/* Boot check — the reload-keeps / reopen-fresh rule, against the real code.
 *
 *  boot.ts + threads.ts are storage-only, but they are TypeScript and pull
 *  TabBar's TabId type and nav's PanelView. Like checks/chat.mjs,
 *  this transpiles the real sources with the project's own esbuild and runs
 *  the rule for real against stubbed storages — no browser, no network.
 *  request.ts is stubbed at the type level (ThreadTurn/ApiChatBody) and
 *  TabBar at TabId; everything asserted below runs real logic.
 *
 *  Exit codes: 0 everything holds, 1 something does not.
 */
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';

const threadsSrc = readFileSync(new URL('../src/threads.ts', import.meta.url), 'utf8');
const bootSrc = readFileSync(new URL('../src/boot.ts', import.meta.url), 'utf8');

/* Drop import lines, including App's multi-line `import { … } from '…'`
   blocks: only lines that close with the module path end the skip. The
   single-line `import type … request` in threads.ts is dropped the same way;
   the next two replaces stub the two type names it carried. */
function stripImports(src) {
  const lines = src.split('\n');
  const out = [];
  let skipping = false;
  for (const l of lines) {
    const t = l.trim();
    if (!skipping && /^import[{\s]/.test(t)) {
      if (/from\s+'[^']*'\s*;?\s*$/.test(t)) continue;
      skipping = true;
      continue;
    }
    if (skipping) {
      if (/from\s+'[^']*'\s*;?\s*$/.test(t)) skipping = false;
      continue;
    }
    out.push(l);
  }
  return out.join('\n');
}

const threadsBody = stripImports(threadsSrc)
  .replace('export interface Msg extends ThreadTurn {', 'export interface Msg {')
  .replace('body?: ApiChatBody;', 'body?: unknown;');
const bootBody = stripImports(bootSrc);
/* boot.ts imports PANEL_VIEWS + PanelView from nav.ts; lift both from the real
   source so the stub never drifts from the app. */
const navSrc = readFileSync(new URL('../src/nav.ts', import.meta.url), 'utf8');
const panelType = navSrc.match(/export type PanelView =[^;]*;/)[0].replace('export ', '');
const panelViews = navSrc.match(/export const PANEL_VIEWS[^;]*;/)[0].replace('export ', '');

const js = transformSync(
  `interface ThreadTurn { role: string; text: string; }\ntype TabId = 'chat' | 'console' | 'studio' | 'library' | 'classroom' | 'guild';\n${panelType}\n${panelViews}\n${threadsBody}\n${bootBody}\nboot;`,
  { loader: 'ts' },
).code
  // The sources use `export` — strip it so the bundle runs in a Function.
  // boot.ts also imports TabId from TabBar: drop that line, the stub above
  // carries the type.
  .replace(/^import type \{ TabId \} from '[^']*';/gm, '')
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

/* One boot run against fresh stubbed storages. `Date` is faked forward per
   case so created thread ids cannot collide across cases. */
let now = 1000;
function run(setup) {
  const local = {};
  const session = {};
  const localStorage = {
    getItem: (k) => (k in local ? local[k] : null),
    setItem: (k, v) => {
      local[k] = String(v);
    },
  };
  const sessionStorage = {
    getItem: (k) => (k in session ? session[k] : null),
    setItem: (k, v) => {
      session[k] = String(v);
    },
  };
  setup({ local, session });
  const tick = now;
  now += 1000;
  const fakeDate = { now: () => tick };
  const fn = new Function('localStorage', 'sessionStorage', 'Date', `${js}; return boot();`);
  return { out: fn(localStorage, sessionStorage, fakeDate), local, session };
}

// 1. Cold open on empty storage creates a thread and marks the session.
{
  const { out, local, session } = run(() => {});
  check('cold-creates', out.fresh === true && !!out.threadId && out.messages.length === 0);
  check('cold-marks', session['eumae:session'] === '1');
  check('cold-stores-id', local['eumae:currentThread'] === out.threadId);
}
// 2. Reload (session alive) keeps the stored thread + messages.
{
  const { out } = run(({ local, session }) => {
    session['eumae:session'] = '1';
    local['eumae:currentThread'] = 't1';
    local['eumae:threads'] = JSON.stringify([
      {
        id: 't1',
        title: 'Old',
        createdAt: 1,
        updatedAt: 2,
        messages: [{ id: 1, role: 'you', text: 'hi', ts: 1 }],
      },
    ]);
  });
  check(
    'reload-keeps',
    out.fresh === false && out.threadId === 't1' && out.messages.length === 1,
    JSON.stringify({ fresh: out.fresh, id: out.threadId, n: out.messages.length }),
  );
}
// 3. Fresh tab with history starts a NEW chat, history untouched.
{
  const { out, local } = run(({ local }) => {
    local['eumae:currentThread'] = 't1';
    local['eumae:threads'] = JSON.stringify([
      { id: 't1', title: 'Old', createdAt: 1, updatedAt: 2, messages: [] },
    ]);
  });
  check('reopen-fresh', out.fresh === true && out.threadId !== 't1', out.threadId);
  const list = JSON.parse(local['eumae:threads']);
  check('reopen-keeps-history', list.some((t) => t.id === 't1'));
}
// 4. Corrupt stored id falls back to a fresh thread, never null.
{
  const { out } = run(({ local, session }) => {
    session['eumae:session'] = '1';
    local['eumae:currentThread'] = 'nope';
    local['eumae:threads'] = JSON.stringify([]);
  });
  check('corrupt-fallback', out.fresh === true && !!out.threadId);
}
// 5. A reload mid-reply settles the stranded streaming row.
{
  const { out } = run(({ local, session }) => {
    session['eumae:session'] = '1';
    local['eumae:currentThread'] = 't1';
    local['eumae:threads'] = JSON.stringify([
      {
        id: 't1',
        title: 'Old',
        createdAt: 1,
        updatedAt: 2,
        messages: [{ id: 1, role: 'eumae', text: 'half', streaming: true, ts: 1 }],
      },
    ]);
  });
  check(
    'streaming-settles',
    out.messages.length === 1 && out.messages[0].streaming === false,
    JSON.stringify(out.messages[0]),
  );
}
// 6. One malformed message is dropped at boot; the good ones survive. The
//    crash-looping shape never reaches React, and the cleaned list is
//    written back so the bad row dies once.
{
  const { out, local } = run(({ local, session }) => {
    session['eumae:session'] = '1';
    local['eumae:currentThread'] = 't1';
    local['eumae:threads'] = JSON.stringify([
      {
        id: 't1',
        title: 'Old',
        createdAt: 1,
        updatedAt: 2,
        messages: [
          { id: 1, role: 'you', text: 'hi', ts: 1 },
          { id: 'bad', role: 'eumae', text: 42, ts: 'yesterday' },
          { id: 3, role: 'eumae', text: 'hello back', ts: 3 },
        ],
      },
    ]);
  });
  const stored = JSON.parse(local['eumae:threads']);
  check(
    'bad-message-dropped',
    out.messages.length === 2 && out.messages[0].text === 'hi' && out.messages[1].text === 'hello back',
    JSON.stringify(out.messages.map((m) => m.text)),
  );
  check(
    'bad-message-persisted',
    stored.length === 1 && stored[0].messages.length === 2,
    JSON.stringify(stored[0] && stored[0].messages.length),
  );
}

// 7. A thread whose every message is bad boots empty — never a crash.
{
  const { out } = run(({ local, session }) => {
    session['eumae:session'] = '1';
    local['eumae:currentThread'] = 't1';
    local['eumae:threads'] = JSON.stringify([
      {
        id: 't1',
        title: 'Old',
        createdAt: 1,
        updatedAt: 2,
        messages: [{ nope: true }, null, 'a string'],
      },
    ]);
  });
  check(
    'all-bad-messages-empty',
    out.fresh === false && out.threadId === 't1' && out.messages.length === 0,
    JSON.stringify({ fresh: out.fresh, count: out.messages.length }),
  );
}

// 8. Reload restores where you were: tab + pushed stack survive.
{
  const { out } = run(({ local, session }) => {
    session['eumae:session'] = '1';
    local['eumae:currentThread'] = 't1';
    local['eumae:threads'] = JSON.stringify([
      { id: 't1', title: 'Old', createdAt: 1, updatedAt: 2, messages: [] },
    ]);
    local['eumae:nav'] = JSON.stringify({ tab: 'library', stack: [{ page: 'notes' }] });
  });
  check(
    'reload-restores-nav',
    out.tab === 'library' && out.stack.length === 1 && out.stack[0].page === 'notes',
    JSON.stringify({ tab: out.tab, stack: out.stack }),
  );
}
// 9. Cold open lands on chat with an empty stack, whatever was stored.
{
  const { out } = run(({ local }) => {
    local['eumae:currentThread'] = 't1';
    local['eumae:threads'] = JSON.stringify([
      { id: 't1', title: 'Old', createdAt: 1, updatedAt: 2, messages: [] },
    ]);
    local['eumae:nav'] = JSON.stringify({ tab: 'library', stack: [{ page: 'notes' }] });
  });
  check(
    'cold-lands-chat',
    out.fresh === true && out.tab === 'chat' && out.stack.length === 0,
    JSON.stringify({ tab: out.tab, stack: out.stack }),
  );
}
// 10. A corrupt stored nav boots to chat, never to nowhere.
{
  const { out } = run(({ local, session }) => {
    session['eumae:session'] = '1';
    local['eumae:currentThread'] = 't1';
    local['eumae:threads'] = JSON.stringify([
      { id: 't1', title: 'Old', createdAt: 1, updatedAt: 2, messages: [] },
    ]);
    local['eumae:nav'] = JSON.stringify({ tab: 'nope', stack: [{ nope: 1 }] });
  });
  check(
    'corrupt-nav-fallback',
    out.tab === 'chat' && out.stack.length === 0,
    JSON.stringify({ tab: out.tab, stack: out.stack }),
  );
}

// 11. Reload inside Settings restores the open pane + section.
{
  const { out } = run(({ local, session }) => {
    session['eumae:session'] = '1';
    local['eumae:currentThread'] = 't1';
    local['eumae:threads'] = JSON.stringify([
      { id: 't1', title: 'Old', createdAt: 1, updatedAt: 2, messages: [] },
    ]);
    local['eumae:nav'] = JSON.stringify({
      tab: 'chat',
      stack: [],
      settingsOpen: true,
      settingsView: 'voice',
      panelOpen: true,
      panelView: 'activity',
    });
  });
  check(
    'reload-restores-overlays',
    out.settingsOpen === true &&
      out.settingsView === 'voice' &&
      out.panelOpen === true &&
      out.panelView === 'logbook', // an old stored 'activity' migrates to the Logbook
    JSON.stringify({
      settingsOpen: out.settingsOpen,
      settingsView: out.settingsView,
      panelOpen: out.panelOpen,
      panelView: out.panelView,
    }),
  );
}
// 12. Cold open resets overlays, whatever was stored.
{
  const { out } = run(({ local }) => {
    local['eumae:currentThread'] = 't1';
    local['eumae:threads'] = JSON.stringify([
      { id: 't1', title: 'Old', createdAt: 1, updatedAt: 2, messages: [] },
    ]);
    local['eumae:nav'] = JSON.stringify({
      tab: 'library',
      stack: [{ page: 'notes' }],
      settingsOpen: true,
      settingsView: 'voice',
      panelOpen: true,
      panelView: 'activity',
    });
  });
  check(
    'cold-resets-overlays',
    out.settingsOpen === false &&
      out.settingsView === null &&
      out.panelOpen === false &&
      out.tab === 'chat' &&
      out.stack.length === 0,
    JSON.stringify({ settingsOpen: out.settingsOpen, panelOpen: out.panelOpen }),
  );
}
// 13. Corrupt overlay data boots closed, never stuck open.
{
  const { out } = run(({ local, session }) => {
    session['eumae:session'] = '1';
    local['eumae:currentThread'] = 't1';
    local['eumae:threads'] = JSON.stringify([
      { id: 't1', title: 'Old', createdAt: 1, updatedAt: 2, messages: [] },
    ]);
    local['eumae:nav'] = JSON.stringify({
      tab: 'chat',
      stack: [],
      settingsOpen: 'yes',
      settingsView: 42,
      panelOpen: 1,
      panelView: 'nope',
    });
  });
  check(
    'corrupt-overlays-fallback',
    out.settingsOpen === false &&
      out.settingsView === null &&
      out.panelOpen === false &&
      out.panelView === 'context',
    JSON.stringify({ settingsOpen: out.settingsOpen, panelView: out.panelView }),
  );
}

if (failures.length) {
  console.error(`boot: ${failures.length} failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('all 18 passed');
