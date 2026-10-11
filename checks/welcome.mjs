#!/usr/bin/env node
/* Welcome check — welcomeFor is pure (facts in, strings out), so this lifts
 *  it by name like checks/chat.mjs and runs it for real. No browser, no
 *  network, no storage: the screen counts threads/uploads/notes, this proves
 *  the words.
 *
 *  Exit codes: 0 everything holds, 1 something does not.
 */
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';

const src = readFileSync(new URL('../src/screens/ChatScreen.tsx', import.meta.url), 'utf8');

function snippet(name) {
  const at = src.indexOf(`function ${name}(`);
  if (at < 0) throw new Error(`${name} is not in src/screens/ChatScreen.tsx`);
  const start = src.lastIndexOf('export', at);
  const end = src.indexOf('\n}', at);
  if (end < 0) throw new Error(`${name} never closes at column 0`);
  return src.slice(start < 0 ? at : start, end + 2);
}

const js = transformSync(`export function __w() { return 1; }\n${snippet('welcomeFor')}`, {
  loader: 'ts',
  format: 'cjs',
}).code;
const mod = { exports: {} };
new Function('module', 'exports', js)(mod, mod.exports);
const welcomeFor = mod.exports.welcomeFor ?? new Function(`${js}; return welcomeFor;`)();

const failures = [];
const check = (name, cond, detail) => {
  if (!cond) {
    failures.push(name);
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    console.log(`PASS  ${name}`);
  }
};

// Brand-new user: the invite, with the daypart.
check('new-morning', welcomeFor({ hour: 9, threadCount: 0, uploadCount: 0, noteCount: 0 }).sub.startsWith('Good morning'));
check('new-evening', welcomeFor({ hour: 20, threadCount: 0, uploadCount: 0, noteCount: 0 }).sub.startsWith('Good evening'));
check('new-late', welcomeFor({ hour: 2, threadCount: 0, uploadCount: 0, noteCount: 0 }).sub.startsWith('Up late'));
// Title never changes — the brand line.
check(
  'title-stable',
  welcomeFor({ hour: 9, threadCount: 0, uploadCount: 0, noteCount: 0 }).title === 'What are we doing today?',
);
// Returning user: continuity, not a lecture.
{
  const out = welcomeFor({ hour: 14, threadCount: 3, lastThreadTitle: 'Trip plan', uploadCount: 0, noteCount: 0 });
  check('back-names-thread', out.sub.includes('Trip plan'), out.sub);
}
{
  const out = welcomeFor({ hour: 14, threadCount: 2, uploadCount: 2, noteCount: 1 });
  check('back-counts-stuff', out.sub.includes('2 files') && out.sub.includes('1 note'), out.sub);
}
// "New chat" is not a title worth naming.
{
  const out = welcomeFor({ hour: 14, threadCount: 1, lastThreadTitle: 'New chat', uploadCount: 0, noteCount: 0 });
  check('skips-blank-title', !out.sub.includes('New chat'), out.sub);
}

if (failures.length) {
  console.error(`welcome: ${failures.length} failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('all 7 passed');
