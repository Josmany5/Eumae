/* The cases behind checks/chat.mjs, run against the real src/chat.ts.
 *
 *   node checks/chat.selftest.mjs       (or: npm run check:chat:selftest)
 *
 * Needs no browser, no key and no network. Every case but the first and the last
 * is a deliberate break, and each one has to be caught: a check that passes on a
 * file it cannot see through is worse than no check, because it says "verified".
 *
 * The breaks are text substitutions into the real file, so they exercise the real
 * functions — the same way checks/voice.selftest.mjs breaks src/voice.ts.
 *
 * One verdict cannot be broken from here: `reader: every frame it parses is one
 * the server writes` reads api/ai.ts, a different file.
 *
 * Exit codes: 0 all cases hold, 1 one does not.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { verdicts } from './chat.mjs';

const SOURCE = fileURLToPath(new URL('../src/chat.ts', import.meta.url));
const source = readFileSync(SOURCE, 'utf8');

const cases = [];
const check = (name, got, expect) => cases.push({ name, got, expect });

/** The names of the verdicts that fail on a given source — what a person would
 *  see, so asserting on it asserts on the output and not on a private detail. */
const failing = (text) => verdicts(text).filter((verdict) => !verdict.pass).map((verdict) => verdict.name);

check('passes on the real src/chat.ts', failing(source), []);

check(
  'fails when a frame that has not finished is read anyway',
  failing(source.replace('return { frames, rest };', "return { frames, rest: '' };")),
  [
    'splitter: a frame with no blank line after it is not a frame yet',
    'reader: a frame split across three chunks is read once, whole',
    /* Losing the remainder loses the tail too: the last frame of a stream is the
       one with no blank line after it. */
    'reader: the last frame is read even without its blank line',
  ],
);

check(
  'fails when only one spelling of a failure is understood',
  failing(
    source.replace(
      "typeof body.error === 'string' ? body.error : (body.error as { message?: unknown }).message",
      '(body.error as { message?: unknown }).message',
    ),
  ),
  ["reader: the server's own failure sentence is passed through, both spellings"],
);

check(
  'fails when this side and the server no longer say the same sentence',
  failing(source.replace("const UNKNOWN_FAILURE = 'No reply came back. Try again.';", "const UNKNOWN_FAILURE = 'Something went wrong.';")),
  ['reader: the sentence this side owns is the one the server uses too'],
);

check(
  'fails when a tool request loses its arguments',
  failing(source.replace('args: args && typeof args === \'object\' ? (args as Record<string, unknown>) : {},', 'args: {},')),
  ['reader: a tool request is carried, and is not text'],
);

check(
  'fails when a grounded answer stops saying so',
  failing(source.replace('if (body.grounding) return { kind: \'grounding\', grounding: body.grounding };', 'if (body.grounding) return null;')),
  ['reader: a grounded answer says so'],
);

check(
  'says so when a function it lifts has been renamed',
  failing(source.replace('export function takeEvents(buffer: string)', 'export function takeFrames(buffer: string)')),
  ['the two functions can be lifted out and called'],
);

check(
  'says so when the sentence it depends on has been removed',
  failing(source.replace("const UNKNOWN_FAILURE = 'No reply came back. Try again.';", '')),
  ['the two functions can be lifted out and called'],
);

check(
  'a comment change is not an alarm',
  failing(`${source}\n/* a new note, which changes nothing that runs */\n`),
  [],
);

let failed = 0;
for (const c of cases) {
  const ok = JSON.stringify(c.got) === JSON.stringify(c.expect);
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.name}`);
  if (!ok) console.log(`      got      ${JSON.stringify(c.got)}\n      expected ${JSON.stringify(c.expect)}`);
}
console.log(failed === 0 ? `\nall ${cases.length} passed` : `\n${failed} of ${cases.length} FAILED`);
process.exit(failed === 0 ? 0 : 1);
