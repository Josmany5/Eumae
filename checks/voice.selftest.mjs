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
  'says so when the function it lifts has been renamed',
  failing(source.replace('export function chunks', 'export function chunkz')),
  ['the function can be lifted out and called'],
);

check(
  'says so when a line it depends on has been removed',
  failing(source.replace('const CHUNK_MAX = 4500;', '')),
  ['the function can be lifted out and called'],
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
  'fails when the field is written through anything but the shared ref',
  failingWith(VOICES, SERVER, SETTINGS, COMPOSER.replace('field.current = value;', 'field.current = text;')),
  ['mic: the field the mic writes is the one the send reads'],
);

check(
  'fails when a piece that cannot be played leaves the run speaking',
  failing(source.replace('    if (!buffer) {', '    if (false) {')),
  ['speak: a piece that fails to play still advances the run'],
);

check(
  'fails when a browser voice is slipped back in',
  failing(`${source}\nwindow.speechSynthesis.speak(new SpeechSynthesisUtterance('x'));\n`),
  ['speak: a piece that fails is not read in the browser voice'],
);

check(
  'fails when a clip is fetched as a data URI instead of bytes',
  failing(
    source.replace(
      '      bytes: Uint8Array.from(atob(body.audio), (c) => c.charCodeAt(0)),',
      '      bytes: null,',
    ),
  ),
  ['speak: a clip is fetched as bytes, not as a data URI'],
);

check(
  'fails when a result that lands after the mic is off is not ignored',
  failing(
    source.replace(
      '    /* A result that arrives after the mic was put away belongs to nobody. */\n    if (listener !== voice) return;',
      '    /* A result that arrives after the mic was put away belongs to nobody. */',
    ),
  ),
  ['mic: a result that lands after the mic is off is ignored'],
);

check(
  'fails when the session is not one variable with four states',
  failing(
    source.replace(
      "type Session = 'off' | 'listening' | 'thinking' | 'speaking';",
      'type Session = string;',
    ),
  ),
  ['voice: one session owns the mic and the speaker'],
);

check(
  'fails when the recogniser is aborted or stopped anywhere unexpected',
  failing(`${source}\nrecognizer.abort();\n`),
  ['voice: the recogniser is stopped, never aborted — abort() poisons iOS'],
);

check(
  'fails when the audio session is never handed back',
  failing(source.replace("  suspendAudio();\n", '')),
  ['voice: the context is suspended when the run ends, handing the session back'],
);

check(
  'fails when a clip goes back through a media element',
  failing(
    source.replace('ctx.decodeAudioData(c.bytes.slice().buffer)', 'ctx.decodeAudioData(c.bytes.slice().buffer); URL.createObjectURL(new Blob([c.bytes]))'),
  ),
  ['speak: a clip is decoded and played through Web Audio, never a media element'],
);

check(
  'fails when the streaming read-aloud loses a leg',
  failing(source.replace('export function feedVoiceReply', 'export function feedVoiceRepl')),
  ['voice: a reply is spoken as its sentences arrive, not after it finishes'],
);

check(
  'fails when results are kept while the answer is on its way',
  failing(
    source.replace(
      "    if (session !== 'listening') {\n      vlog(`result dropped — ${session}`);\n      return;\n    }",
      "    if (session !== 'listening') {\n      /* kept: the stuck-text bug returns */\n    }",
    ),
  ),
  ['mic: results are only kept while it is your turn'],
);

check(
  'fails when the debug log API is missing',
  failing(source.replace('export function subscribeVoiceLog', 'function subscribeVoiceLog')),
  ['voice: the debug log records session changes and failures'],
);

check(
  'fails when a dropped connection stops the mic instead of riding the restart',
  failing(
    source.replace(
      "} else if (reason === 'language-not-supported') {",
      "} else if (reason === 'network' || reason === 'language-not-supported') {",
    ),
  ),
  ['mic: a dropped connection rides the restart, not the stop'],
);

check(
  'fails when audio-capture ends the mic session',
  failing(
    source.replace(
      "      vlog('mic error: audio-capture — waiting for the revive', true);",
      '      endMicSession();',
    ),
  ),
  ['mic: audio-capture revives instead of ending the session'],
);

check(
  'fails when the new recognizer starts before the old one ends',
  failing(source.replace('  old.onend = handoff;', '  old.onend = null;\n  startRec(voice);')),
  ['voice: the post-reading handoff never overlaps two recognizers'],
);

check(
  'fails when the send stops holding the interim tail back',
  failing(source.replace("let pending = '';", '')),
  ['mic: a phrase is never sent twice — the send holds the interim tail back'],
);

check(
  'fails when a dead recogniser is restarted in place',
  failing(`${source}\nrecognizer.start();\n`),
  ['mic: a restart is a fresh recogniser, never a restart of the dead one'],
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
