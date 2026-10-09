/* The cases behind checks/voice.mjs, run against the real sources it reads.
 *
 *   node checks/voice.selftest.mjs        (or: npm run check:voice:selftest)
 *
 * Needs no browser, no key and no network. Every case but the first and the last
 * is a deliberate break, and each one has to be caught: a check that passes on a
 * file it cannot see through is worse than no check, because it says "verified".
 *
 * The breaks are text substitutions into the real files — src/voice.ts, and the
 * three the table is checked against (src/voices.ts, api/ai.ts and the Settings
 * pane) — so they exercise the real code, the same way checks/models.selftest.mjs
 * feeds `idsIn` source it made up.
 *
 * Exit codes: 0 all cases hold, 1 one does not.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { verdicts } from './voice.mjs';

const SOURCE = fileURLToPath(new URL('../src/voice.ts', import.meta.url));
const source = readFileSync(SOURCE, 'utf8');

/* The three other files this check reads (checks/voice.mjs), so a break can be
   made in any of them the same way it is made in src/voice.ts — and the composer,
   where the mic is wired up. */
const VOICES = readFileSync(fileURLToPath(new URL('../src/voices.ts', import.meta.url)), 'utf8');
const SERVER = readFileSync(fileURLToPath(new URL('../api/ai.ts', import.meta.url)), 'utf8');
const SETTINGS = readFileSync(
  fileURLToPath(new URL('../src/components/settings/Settings.tsx', import.meta.url)),
  'utf8',
);
const COMPOSER = readFileSync(
  fileURLToPath(new URL('../src/components/shell/Composer.tsx', import.meta.url)),
  'utf8',
);

const cases = [];
const check = (name, got, expect) => cases.push({ name, got, expect });

/** The names of the verdicts that fail on a given source — what a person would
 *  see, so asserting on it asserts on the output and not on a private detail. */
const failing = (text) => verdicts(text).filter((verdict) => !verdict.pass).map((verdict) => verdict.name);

/** The same, for a break made in one of the other files. */
const failingWith = (voices = VOICES, server = SERVER, settings = SETTINGS, composer = COMPOSER) =>
  verdicts(source, voices, server, settings, composer)
    .filter((verdict) => !verdict.pass)
    .map((verdict) => verdict.name);

const limitVerdict = (text) => verdicts(text).find((verdict) => verdict.name.startsWith('chunks: a long'));

check('passes on the real src/voice.ts', failing(source), []);

check(
  'names the limit it read out of the source, not one written here',
  limitVerdict(source.replace('const CHUNK_MAX = 4500;', 'const CHUNK_MAX = 99999;')).name,
  'chunks: a long reply splits into pieces of at most 99999',
);

check(
  'fails when that limit grows past the text this check uses',
  failing(source.replace('const CHUNK_MAX = 4500;', 'const CHUNK_MAX = 99999;')),
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
  failing(source.replace('const CHUNK_MAX = 4500;', '')),
  ['the two functions can be lifted out and called'],
);

check(
  'fails when a row names a voice Google does not speak',
  failingWith(VOICES.replace("name: 'Kore',", "name: 'Nova',")),
  [
    'voices: six rows, each one naming the voice Google answers to',
    'voices: every name is one Google lists for US English',
    /* And a third: with a row named Nova, `voiceById('Nova')` is no longer a name
       this app dropped — it is a row. That probe is meaningless in exactly the
       state this break creates, which is the bug itself. */
    'voices: a name this app no longer offers lands on the default',
  ],
);

check(
  "fails when a gender is not the one Google lists for that name",
  failingWith(VOICES.replace("name: 'Puck',\n    gender: 'Male',", "name: 'Puck',\n    gender: 'Female',")),
  ["voices: every gender is Google's own for that name"],
);

check(
  'fails when the client and the server disagree about the default voice',
  failingWith(VOICES, SERVER.replace("voiceName = 'en-US-Chirp3-HD-Achernar'", "voiceName = 'en-US-Chirp3-HD-Achird'")),
  ['voices: the default is the voice the server falls back to'],
);

check(
  'fails when the speaker stops naming the voice it is speaking in',
  failing(source.replace('voice: speakVoice ?? voiceName(storedVoice())', '')),
  ['voices: the speaker sends the name it is speaking in'],
);

check(
  "fails when the pane goes back to the mockup's four names",
  failingWith(VOICES, SERVER, SETTINGS.replace('VOICES.map', "['Nova', 'Alloy', 'Onyx', 'Shimmer'].map")),
  ['voices: the pane is drawn from the table, not from four names of its own'],
);

/* ── How fast it is read. One break per thing that has to agree: the steps, the
      raw value `storedSpeed` hands back, the row that offers them, and the number
      that leaves on the request. The range in the first verdict's own name is read
      out of the server's clamp, here as well as there, so a change to that clamp
      fails this file by name instead of silently testing a range nobody uses. */
const RANGE = SERVER.match(/Math\.min\(([\d.]+), Math\.max\(([\d.]+), speakingRate\)\)/);
const SPEED_STEPS = `speed: four steps, 1× the default, all inside the server's own ${RANGE[2]}–${RANGE[1]}`;

check(
  'fails when a step is outside the range the server clamps to',
  failingWith(VOICES.replace("{ rate: 0.75, label: '0.75×' }", "{ rate: 0.6, label: '0.6×' }")),
  [SPEED_STEPS],
);

/* The break is in the catch, not the `find`: this file runs in Node, where there
   is no `localStorage`, so `storedSpeed` can only ever return through its fallback
   path here — which is also the path a browser takes on a first visit. A break put
   in the `find` would be swallowed by the `catch` and this case would pass while
   testing nothing. */
check(
  'fails when the reader is handed something that is not one of the steps',
  failingWith(VOICES.replace('return DEFAULT_SPEED.rate;', 'return 1.9;')),
  ['speed: the setting the reader asks for is one of those steps, not the raw number'],
);

check(
  'fails when the pane stops drawing the steps from the table',
  failingWith(VOICES, SERVER, SETTINGS.replace('SPEEDS.map', "['1×'].map")),
  ['speed: the pane draws the steps from the table, not from a list of its own'],
);

check(
  'fails when the rate stops travelling on the speak request',
  failing(source.replace('        rate: String(speakRate),\n', '')),
  ['speed: the rate is settled when the run starts and travels on the request'],
);

check(
  'says so when the table itself cannot be read',
  failingWith('export const VOICES = ;'),
  ['voices: the table can be lifted out and read'],
);

/* ── The microphone. Each of these is the failure the composer and the speaker
      were actually fixed for, put back on purpose: the seam between a component
      that re-renders and a module that holds the object it was handed. */
check(
  'fails when the mic sends what the render remembered instead of the field',
  failingWith(
    VOICES,
    SERVER,
    SETTINGS,
    COMPOSER.replace('const value = field.current.trim();', 'const value = text.trim();'),
  ),
  ['mic: the send takes its text off the field, not off the render'],
);

check(
  'fails when the mic is handed a read of the render instead of the field',
  failingWith(VOICES, SERVER, SETTINGS, COMPOSER.replace('read: () => field.current,', 'read: () => text,')),
  ['mic: the field the mic reads is the one every writer writes'],
);

check(
  'fails when the silence may play over a piece that is being read',
  failing(source.replace('  if (running || sounding) return;\n', '')),
  ['speak: the silence is never played over a piece that is playing'],
);

check(
  'fails when a piece that cannot be played leaves the run speaking',
  failing(source.replace('    el.onerror = finish;', '    el.onstalled = finish;')),
  ['speak: a piece that fails to play still advances the run'],
);

check(
  'fails when a piece that cannot be played is walked past in silence',
  failing(source.replace('      resolve(played);', '      resolve(true);')),
  ['speak: a piece the element cannot play is read in the browser voice, and said so'],
);

check(
  'fails when a result that lands after the mic is off is not ignored',
  failing(
    source.replace(
      "    if (listener !== voice) return;\n    /* Nor is anything typed while it is speaking (1768). */",
      "    /* Nor is anything typed while it is speaking (1768). */",
    ),
  ),
  ['mic: a result that lands after the mic is off is ignored'],
);

check(
  'fails when a dropped connection stops the mic instead of riding the restart',
  failing(
    source.replace(
      "reason === 'audio-capture' || reason === 'language-not-supported'",
      "reason === 'audio-capture' || reason === 'network' || reason === 'language-not-supported'",
    ),
  ),
  ['mic: a dropped connection rides the restart, not the stop'],
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
