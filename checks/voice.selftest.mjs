/* The cases behind checks/voice.mjs, run against the real src/voice.ts.
 *
 *   node checks/voice.selftest.mjs        (or: npm run check:voice:selftest)
 *
 * Needs no browser, no key and no network. Every case but the first is a
 * deliberate break, and each one has to be caught: a check that passes on a file
 * it cannot see through is worse than no check, because it says "verified".
 *
 * The breaks are text substitutions into the real file, so they exercise the
 * real functions — the same way checks/models.selftest.mjs feeds `idsIn` source
 * it made up.
 *
 * Exit codes: 0 all cases hold, 1 one does not.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { verdicts } from './voice.mjs';

const SOURCE = fileURLToPath(new URL('../src/voice.ts', import.meta.url));
const source = readFileSync(SOURCE, 'utf8');

const cases = [];
const check = (name, got, expect) => cases.push({ name, got, expect });

/** The names of the verdicts that fail on a given source — what a person would
 *  see, so asserting on it asserts on the output and not on a private detail. */
const failing = (text) => verdicts(text).filter((verdict) => !verdict.pass).map((verdict) => verdict.name);

const limitVerdict = (text) => verdicts(text).find((verdict) => verdict.name.startsWith('chunks: a long'));

check('passes on the real src/voice.ts', failing(source), []);

check(
  'names the limit it read out of the source, not one written here',
  limitVerdict(source.replace('const CHUNK_MAX = 420;', 'const CHUNK_MAX = 99999;')).name,
  'chunks: a long reply splits into pieces of at most 99999',
);

check(
  'fails when that limit grows past the text this check uses',
  failing(source.replace('const CHUNK_MAX = 420;', 'const CHUNK_MAX = 99999;')),
  ['chunks: a long reply splits into pieces of at most 99999'],
);

check(
  'fails when code fences stop being dropped',
  failing(source.replace("text.replace(/```[\\s\\S]*?```/g, ' ')", 'text')),
  ['chunks: a code fence is never read aloud'],
);

check(
  'fails when the WAV is no longer recognised as one',
  failing(source.replace("put(0, 'RIFF')", "put(0, 'RIFX')")),
  ['silence: RIFF, and WAVE'],
);

check(
  'fails when the format stops being 8-bit mono PCM at 8000 Hz',
  failing(source.replace('const rate = 8000;', 'const rate = 44100;')),
  ['silence: PCM, mono, 8-bit, 8000 Hz'],
);

check(
  'fails when the declared depth and the real one disagree',
  failing(source.replace("view.setUint16(34, 8, true); // bits per sample", 'view.setUint16(34, 16, true); // bits per sample')),
  ['silence: PCM, mono, 8-bit, 8000 Hz'],
);

check(
  'fails when the payload stops being silence',
  failing(source.replace('bytes.fill(128, 44)', 'bytes.fill(0, 44)')),
  ['silence: the payload is silence (8-bit PCM rests at 128, not 0)'],
);

check(
  'says so when a function it lifts has been renamed',
  failing(source.replace('function silence(): string {', 'function silencio(): string {')),
  ['the two functions can be lifted out and called'],
);

check(
  'says so when a line it depends on has been removed',
  failing(source.replace('const CHUNK_MAX = 420;', '')),
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
