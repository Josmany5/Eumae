#!/usr/bin/env node
/* Studio's creator flow — the questions, the spec they build, and the hand-off
 * to Make it.
 *
 *  This is the one part of Studio with no checks behind it (checks/studio.mjs
 *  covers the older catalog in src/studio.ts), and it is the part that is hardest
 *  to hold in your head: the flow is a queue of questions, each answer is written
 *  into a spec, and the spec is the *only* thing Make it sends. Lose a line on
 *  the way through and the page comes back missing a thing the person asked for,
 *  with nothing on screen to say so.
 *
 *  So these cases are about what survives, not about wording: every answer lands
 *  in the spec, the flow always ends somewhere Make it can be tapped, Skip says
 *  "you decide" instead of pretending it was answered, and a change asked politely
 *  ("Can you make it bigger?") rebuilds instead of being answered in words.
 *
 *  Reads the real engine (src/studioChat.ts) and the real catalog it asks from
 *  (src/studioGuide.ts), so the two cannot drift apart quietly.
 *
 * Exit codes: 0 everything holds, 1 something does not.
 */
import { buildSync } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/* The engine reads the person's saved flow out of localStorage when it is
   asked for a session; here there is no browser, so it gets one. */
const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};

const built = buildSync({
  stdin: {
    contents: `
      export {
        newSession, startWith, answer, skip, tick, questionsFor, questionOf,
        kindOfSession, lineCount, briefOfSession, isQuestion, SECS, getSession,
      } from './src/studioChat';
      export { KINDS } from './src/studioGuide';
    `,
    resolveDir: new URL('..', import.meta.url).pathname,
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
  logLevel: 'silent',
  define: { 'import.meta.env': '{}' },
});
const dir = mkdtempSync(join(tmpdir(), 'studiochat-'));
const file = join(dir, 'sc.mjs');
writeFileSync(file, built.outputFiles[0].text);
const M = await import(pathToFileURL(file).href);

let bad = 0;
const ok = (cond, what, detail) => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${what}${cond || !detail ? '' : ` — ${detail}`}`);
  if (!cond) bad++;
};
const lines = (s) => Object.entries(s.spec).flatMap(([sec, ls]) => ls.map((l) => `${sec}: ${l}`));
const drain = (s) => {
  let x = s;
  let guard = 0;
  while (x.queue.length && guard++ < 50) x = M.answer(x, 'something', []);
  return x;
};

/* ── 1. A session starts nowhere near a spec ──────────────────────────────── */
{
  const s = M.newSession(M.KINDS.Document);
  ok(!s.started && s.msgs.length === 1 && s.msgs[0].start === true, 'a new Studio item opens with the template message only');
  ok(lines(s).length === 0, 'and no spec lines yet', JSON.stringify(lines(s)));
  ok(s.queue.length === 0, 'and no question asked until they choose', JSON.stringify(s.queue));
}

/* ── 2. A template writes what it already implies, and asks the rest ──────── */
{
  const kd = M.KINDS.Document;
  const s = M.startWith(M.newSession(kd), 'Résumé');
  const asked = s.queue;
  const implied = lines(s);
  ok(s.started && s.tpl === 'Résumé' && s.title === 'Résumé', 'tapping a template starts the flow with its name');
  ok(implied.length > 0, 'the template writes what it implies into the spec', JSON.stringify(implied));
  ok(
    !asked.includes('purpose') && !asked.includes('length'),
    'and does not ask what it already answered',
    JSON.stringify(asked),
  );
  ok(asked.includes('for'), 'while still asking what the template left open (who it is for)', JSON.stringify(asked));
  ok(asked.length > 0 && s.msgs[s.msgs.length - 1].qid === asked[0], 'the first question is on the table');
}

/* ── 3. Custom asks from the top, including what it is ────────────────────── */
{
  const s = M.startWith(M.newSession(M.KINDS.Document), null);
  ok(s.queue[0] === 'describe', 'Custom starts by asking what it is', JSON.stringify(s.queue[0]));
  ok(s.tpl === null && s.started, 'and knows no template was picked');
}

/* ── 4. One answer moves the flow exactly one question ────────────────────── */
{
  const s = M.startWith(M.newSession(M.KINDS.Document), 'Résumé');
  const before = s.queue;
  const after = M.answer(s, 'Recruiters at small studios', []);
  ok(after.queue.length === before.length - 1 && after.queue[0] === before[1], 'an answer advances exactly one question');
  ok(
    lines(after).some((l) => l.includes('Recruiters at small studios')),
    'and the words they typed are in the spec, as typed',
    JSON.stringify(lines(after)),
  );
}

/* ── 5. Unticking never advances; Done advances once ──────────────────────── */
{
  const s = M.startWith(M.newSession(M.KINDS.Document), 'Résumé');
  const q = M.questionOf(s, s.queue[0]);
  ok(q?.multi === true, 'the "what should it do" question is the pick-several one', JSON.stringify(q?.id));
  const ticked = M.tick(M.tick(s, q.opts[0].l), q.opts[1].l);
  ok(ticked.queue.join() === s.queue.join(), 'ticking a pill is not an answer — the flow stays put');
  const unticked = M.tick(ticked, q.opts[0].l);
  ok(!unticked.ticked.includes(q.opts[0].l) && unticked.ticked.includes(q.opts[1].l), 'and a second tap takes it back off');
  const done = M.answer(unticked, '');
  const got = lines(done).join(' | ');
  ok(done.queue.length === s.queue.length - 1, 'Done moves it on');
  ok(got.includes(q.opts[1].l) && !got.includes(q.opts[0].l), 'carrying the ticked pills and only those', got);
}

/* ── 6. Skip is "you decide", never a made-up answer ─────────────────────── */
{
  const s = M.startWith(M.newSession(M.KINDS.Document), 'Résumé');
  const skipped = M.skip(s);
  ok(skipped.queue.length === s.queue.length - 1, 'Skip moves it on');
  ok(skipped.spec.open.length > 0, 'and records it under "Eumae decides"', JSON.stringify(skipped.spec.open));
  ok(
    skipped.spec.open.every((l) => !/something/i.test(l)),
    'and writes no answer of its own',
    JSON.stringify(skipped.spec.open),
  );
}

/* ── 7. Every flow ends somewhere Make it can be tapped ──────────────────── */
for (const name of Object.keys(M.KINDS)) {
  const kd = M.KINDS[name];
  const custom = drain(M.startWith(M.newSession(kd), null));
  ok(custom.queue.length === 0 && custom.msgs[custom.msgs.length - 1].make === true, `${name}: answering everything ends on Make it`);
  const tpl = kd.templates[0]?.n;
  if (tpl) {
    const flow = drain(M.startWith(M.newSession(kd), tpl));
    ok(flow.queue.length === 0 && flow.msgs[flow.msgs.length - 1].make === true, `${name}: so does the "${tpl}" template`);
  }
}

/* ── 8. What Make it sends is the whole spec ─────────────────────────────── */
{
  const s = drain(M.startWith(M.newSession(M.KINDS.Document), 'Résumé'));
  const brief = M.briefOfSession(s);
  const missing = lines(s)
    .map((l) => l.slice(l.indexOf(': ') + 2))
    .filter((l) => !brief.includes(l));
  ok(missing.length === 0, 'every spec line reaches Make it', JSON.stringify(missing.slice(0, 3)));
  ok(/^Make /.test(brief) && /spec/i.test(brief), 'and it is asked for as a spec, not as a chat message', brief.slice(0, 60));
  if (s.spec.open.length) {
    ok(/left to you/i.test(brief), 'and what they left to her is named as hers to choose');
  }
}

/* ── 9. A change asked politely is a change, not a question ──────────────── */
for (const t of ['make it bigger', 'Can you make it bigger?', 'Could you change the title?', 'can you please add a footer', 'Would you rename it to Anna?']) {
  ok(!M.isQuestion(t), `${JSON.stringify(t)} is a change (rebuild), not a question`, `isQuestion = ${M.isQuestion(t)}`);
}
for (const t of ['what does the second button do?', 'Can you explain why it is blue?', 'how do I print it', 'is the text too small?']) {
  ok(M.isQuestion(t), `${JSON.stringify(t)} is a question (answer it)`, `isQuestion = ${M.isQuestion(t)}`);
}

/* ── 10. Two items never share a spec ───────────────────────────────────── */
{
  const a = M.startWith(M.newSession(M.KINDS.Document), 'Résumé');
  const b = M.newSession(M.KINDS.Slides, 'Pitch deck');
  ok(b.id !== a.id, 'a second item gets its own id');
  ok(
    !lines(b).some((l) => lines(a).includes(l)),
    'and its own spec, not a copy of the first',
    JSON.stringify(lines(b).filter((l) => lines(a).includes(l))),
  );
  ok(M.SECS.some((x) => x.id === 'open'), 'the "Eumae decides" section still exists (Skip needs it)');
}

console.log(bad === 0 ? '\nstudio flow: all good' : `\nstudio flow: ${bad} FAILED`);
process.exit(bad === 0 ? 0 : 1);
