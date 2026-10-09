#!/usr/bin/env node
/* Run the two pure parts of the voice layer: the sentence cutter and the silence
 * the audio element is opened with.
 *
 * Both are the kind of code that fails quietly. `chunks` decides how much text
 * goes into one request to the voice server: let a piece grow past the limit and
 * the request is refused, and the symptom is a reply that stops being read aloud
 * halfway. `silence` exists only to open an audio element inside a gesture so
 * iOS will allow the real sound later: get one header byte wrong and nothing
 * complains — the unlock simply never happens, and read aloud is broken on an
 * iPhone while working perfectly on a laptop.
 *
 * So this check runs them for real rather than reading them. Both live in
 * src/voice.ts, which as a whole cannot be imported here: it is TypeScript and
 * it uses `window` and `document`. These two functions use neither, which is not
 * an accident — it is why they are written the way they are. So the check lifts
 * them out of the file by name, transpiles them with the project's own esbuild,
 * and calls them.
 *
 * Everything asserted about the source is read out of the source, never
 * repeated: the chunk limit comes from `const CHUNK_MAX = <n>;`, and if a line
 * this check depends on is renamed or removed it fails loudly instead of passing
 * against a copy of a value that no longer exists.
 *
 *   node checks/voice.mjs            (or: npm run check:voice)
 *
 * Its own cases — including every deliberate break it must catch — are in
 * checks/voice.selftest.mjs, which needs no browser and no network either.
 *
 * Exit codes: 0 everything holds, 1 something does not.
 */
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';

/** How long the silence is: two numbers this file does state itself, because
 *  they are its claim about the shape of the audio rather than the source's. */
const RATE = 8000;
const BYTES = 524;

/** One function, from its `export` (or its `function` keyword, when it has none)
 *  to the closing brace at column 0. The `export` is kept: that is what makes
 *  esbuild hand the function back on the module it is told to write to, and
 *  losing it is how this check first reported "lifted, but neither came back". */
function snippet(source, name) {
  const at = source.indexOf(`function ${name}(`);
  if (at < 0) throw new Error(`${name} is not in src/voice.ts`);
  const start = at > 7 && source.slice(at - 7, at) === 'export ' ? at - 7 : at;
  const end = source.indexOf('\n}', at);
  if (end < 0) throw new Error(`${name} never closes at column 0`);
  return source.slice(start, end + 2);
}

/** What the source's own limit is, so the longest piece is checked against it
 *  rather than against a 420 written here. */
function limitOf(source) {
  const found = source.match(/^const CHUNK_MAX = (\d+);$/m);
  if (!found) throw new Error('const CHUNK_MAX = <n>; is not in src/voice.ts');
  return Number(found[1]);
}

/** The two functions plus the two declarations they read, as runnable
 *  JavaScript. Nothing is copied: the limit and the state line are matched out
 *  of the source with their own spelling, so a rename is a failure and not a
 *  silent substitution. */
export function lift(source) {
  const limit = source.match(/^const CHUNK_MAX = \d+;$/m);
  const state = source.match(/^let silent: string \| null = null;$/m);
  if (!limit) throw new Error('const CHUNK_MAX = <n>; is not in src/voice.ts');
  if (!state) throw new Error('the speaker state line is not in src/voice.ts');
  const code = [
    limit[0],
    state[0],
    snippet(source, 'chunks'),
    snippet(source, 'silence'),
    /* The one line this check adds: `chunks` is exported because the composer
       calls it, and `silence` is not, because only `unlock` does. Asking for it
       here is how the check gets at a function the module keeps to itself. */
    'export { silence };',
  ].join('\n');
  return transformSync(code, { loader: 'ts', format: 'cjs' }).code;
}

/** Judge a source. Returning the verdicts instead of printing them is what lets
 *  checks/voice.selftest.mjs hand this text it has broken on purpose and assert
 *  that every break is caught. */
export function verdicts(source) {
  const lifted = {};
  try {
    const host = { exports: {} };
    new Function('module', 'exports', lift(source))(host, host.exports);
    Object.assign(lifted, host.exports);
  } catch (error) {
    return [
      {
        name: 'the two functions can be lifted out and called',
        pass: false,
        detail: String(error && error.message),
      },
    ];
  }
  if (typeof lifted.chunks !== 'function' || typeof lifted.silence !== 'function') {
    return [
      {
        name: 'the two functions can be lifted out and called',
        pass: false,
        detail: 'lifted, but neither came back',
      },
    ];
  }
  const { chunks, silence } = lifted;
  const out = [];
  const judge = (name, pass, detail) => out.push({ name, pass, detail });

  const short = chunks('One. Two. Three.');
  judge(
    'chunks: a short paragraph is one piece',
    short.length === 1 && short[0] === 'One. Two. Three.',
    JSON.stringify(short),
  );

  const empty = chunks('');
  judge('chunks: nothing at all is still one piece', empty.length === 1, JSON.stringify(empty));

  const fenced = chunks('Intro.\n```js\nconst a = 1;\n```\nDone.').join('');
  judge(
    'chunks: a code fence is never read aloud',
    !fenced.includes('const a') && fenced.includes('Intro.') && fenced.includes('Done.'),
    JSON.stringify(fenced),
  );

  const long = 'Sentence number one is here. '.repeat(40);
  const pieces = chunks(long);
  const longest = Math.max(...pieces.map((piece) => piece.length));
  judge(
    `chunks: a long reply splits into pieces of at most ${limitOf(source)}`,
    pieces.length > 1 && longest <= limitOf(source) && pieces.join('') === long,
    `pieces=${pieces.length} longest=${longest}`,
  );

  const uri = String(silence());
  const bytes = Buffer.from(uri.split(',')[1] || '', 'base64');
  const at = (from, to) => bytes.toString('ascii', from, to);
  judge('silence: it is a base64 audio/wav data URI', uri.startsWith('data:audio/wav;base64,'), `${bytes.length} bytes`);
  judge('silence: RIFF, and WAVE', at(0, 4) === 'RIFF' && at(8, 12) === 'WAVE', `${at(0, 4)}/${at(8, 12)}`);
  judge(
    `silence: PCM, mono, 8-bit, ${RATE} Hz`,
    bytes.readUInt16LE(20) === 1 &&
      bytes.readUInt16LE(22) === 1 &&
      bytes.readUInt16LE(34) === 8 &&
      bytes.readUInt32LE(24) === RATE &&
      bytes.readUInt32LE(28) === RATE,
    `format=${bytes.readUInt16LE(20)} channels=${bytes.readUInt16LE(22)} bits=${bytes.readUInt16LE(34)} rate=${bytes.readUInt32LE(24)}`,
  );
  judge(
    'silence: the declared sizes agree with the bytes that are there',
    at(12, 16) === 'fmt ' &&
      at(36, 40) === 'data' &&
      bytes.readUInt32LE(4) === bytes.length - 8 &&
      bytes.readUInt32LE(40) === bytes.length - 44 &&
      bytes.length === BYTES,
    `riff=${bytes.readUInt32LE(4)} data=${bytes.readUInt32LE(40)} total=${bytes.length}`,
  );
  const payload = bytes.subarray(44);
  judge(
    'silence: the payload is silence (8-bit PCM rests at 128, not 0)',
    payload.length > 0 && payload.every((byte) => byte === 128),
    `first=${payload[0]} last=${payload[payload.length - 1]}`,
  );

  return out;
}

function main() {
  const source = readFileSync(new URL('../src/voice.ts', import.meta.url), 'utf8');
  const results = verdicts(source);
  for (const result of results) {
    console.log(`${result.pass ? 'PASS' : 'FAIL'}  ${result.name}${result.detail ? ` — ${result.detail}` : ''}`);
  }
  const failed = results.filter((result) => !result.pass).length;
  console.log(failed ? `\n${failed} of ${results.length} failed` : `\nall ${results.length} passed`);
  process.exit(failed ? 1 : 0);
}

/* Importable, so the self-test can hand `verdicts` text it broke on purpose;
   runnable, so it can be pointed at the real file. `process.argv[1]` is how it
   tells the two apart — being imported is not being run. */
if (process.argv[1] && process.argv[1].endsWith('voice.mjs')) main();

