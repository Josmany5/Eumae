#!/usr/bin/env node
/* Run the pure parts of the voice layer: the sentence cutter, the silence the
 * audio element is opened with, the table of voices, and the seam the microphone
 * is wired through.
 *
 * The first two are the kind of code that fails quietly. `chunks` decides how
 * much text goes into one request to the voice server: let a piece grow past the
 * limit and the request is refused, and the symptom is a reply that stops being
 * read aloud halfway. `silence` exists only to open an audio element inside a
 * gesture so iOS will allow the real sound later: get one header byte wrong and
 * nothing complains — the unlock simply never happens, and read aloud is broken
 * on an iPhone while working perfectly on a laptop.
 *
 * The third is not a function at all: it is src/voices.ts, the table of voices
 * the app offers. The bug it exists to catch is in this repo's own history — four
 * rows labelled Nova, Alloy, Onyx and Shimmer, which are another company's voice
 * names, so every one of them sounded like the same voice and nothing said so. So
 * every claim that file makes is checked against a source that has to agree with
 * it: the names against Google's own list (written below, with the page and the
 * date it was read), the default against the name the server falls back to, and
 * the fact that the speaker sends the name it is speaking in.
 *
 * The fourth is a seam rather than a file. The composer hands the mic a
 * `VoiceTyping` once, when the button goes on, and src/voice.ts holds that object
 * for the whole dictation — while React builds a fresh `send` on every render
 * afterwards. So a `send` that reads the composer's *state* reads the field as it
 * was when the mic came on: empty, on a cold mic. That was a real bug in this repo,
 * the one that made the mic look broken, and it is invisible from either file on
 * its own: the composer's own code looks right, and so does the voice layer's. Four
 * verdicts over the two files' shared contract, because the failure they describe
 * is silent — no error, no reply, nothing on screen but the words you just spoke,
 * sitting in the box.
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

/** The four other sources this check reads: the table of voices, the server that
 *  has to fall back to the same voice, the pane that draws the list, and the
 *  composer the mic is actually wired into. Read from disk here and overridable
 *  per call, so checks/voice.selftest.mjs can break them the same way it breaks
 *  src/voice.ts. */
const real = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf8');
const VOICES = real('../src/voices.ts');
const SERVER = real('../api/ai.ts');
const SETTINGS = real('../src/components/settings/Settings.tsx');
const COMPOSER = real('../src/components/shell/Composer.tsx');

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

/** Google's Chirp 3: HD voices for US English and the gender each one is listed
 *  with — the voice list on cloud.google.com/text-to-speech/docs/chirp3-hd, read
 *  2026-10-08. Written out here rather than fetched: a check that needs a network
 *  is a check that stops running, and then stops being a check. */
const GOOGLE = {
  Achernar: 'Female',
  Achird: 'Male',
  Algenib: 'Male',
  Algieba: 'Male',
  Alnilam: 'Male',
  Aoede: 'Female',
  Autonoe: 'Female',
  Callirrhoe: 'Female',
  Charon: 'Male',
  Despina: 'Female',
  Enceladus: 'Male',
  Erinome: 'Female',
  Fenrir: 'Male',
  Gacrux: 'Female',
  Iapetus: 'Male',
  Kore: 'Female',
  Laomedeia: 'Female',
  Leda: 'Female',
  Orus: 'Male',
  Puck: 'Male',
  Pulcherrima: 'Female',
  Rasalgethi: 'Male',
  Sadachbia: 'Male',
  Sadaltager: 'Male',
  Schedar: 'Male',
  Sulafat: 'Female',
  Umbriel: 'Male',
  Vindemiatrix: 'Female',
  Zephyr: 'Female',
  Zubenelgenubi: 'Male',
};

/** The table's own verdicts. The table is *run*, not read: src/voices.ts is a
 *  data file and three small functions, and none of them touches the DOM until it
 *  is called (`storedVoice` does, and this check does not call it) — so the whole
 *  file can be transpiled and evaluated, and the claims made about it are made
 *  against the objects it exports rather than against its spelling. */
function tableVerdicts(table, server, speaker, settings) {
  const out = [];
  const judge = (name, pass, detail) => out.push({ name, pass, detail });

  const rows = table.VOICES;
  const unknown = rows.filter((row) => !(row.name in GOOGLE)).map((row) => row.name);
  const misgendered = rows
    .filter((row) => row.name in GOOGLE && row.gender !== GOOGLE[row.name])
    .map((row) => `${row.name}=${row.gender}, Google says ${GOOGLE[row.name]}`);
  const misnamed = rows.filter((row) => row.id !== `en-US-Chirp3-HD-${row.name}`).map((row) => row.id);
  const duplicate = new Set(rows.map((row) => row.id)).size !== rows.length;
  const lead = table.DEFAULT_VOICE;

  judge(
    'voices: six rows, each one naming the voice Google answers to',
    rows.length === 6 && !duplicate && misnamed.length === 0,
    `${rows.length} rows${misnamed.length ? ` — ${misnamed.join(', ')}` : ''}${duplicate ? ' — a duplicate id' : ''}`,
  );
  judge(
    'voices: every name is one Google lists for US English',
    unknown.length === 0,
    unknown.length ? unknown.join(', ') : `${Object.keys(GOOGLE).length} names on Google's list`,
  );
  judge(
    "voices: every gender is Google's own for that name",
    misgendered.length === 0,
    misgendered.length ? misgendered.join('; ') : rows.map((row) => `${row.name}=${row.gender}`).join(' '),
  );
  /* The client and the server each name a default, and a request that names no
     voice is answered by the server's — so they have to be the same voice, or the
     row that is ticked is not the one that speaks. The server's name is read out
     of api/ai.ts rather than written here. */
  judge(
    'voices: the default is the voice the server falls back to',
    lead != null && lead === rows[0] && server.includes(`voiceName = '${lead.id}'`),
    `${lead ? lead.id : 'no DEFAULT_VOICE'}`,
  );
  /* The stored value on an install that chose one of the four old names, or a
     value written by hand: it becomes the default voice, never a failure. Both
     probes are rows of the table itself, so changing which voices this app offers
     cannot make this verdict fail for the wrong reason. */
  const other = rows[rows.length - 1];
  judge(
    'voices: a name this app no longer offers lands on the default',
    typeof table.voiceById === 'function' &&
      table.voiceById('Nova') === lead &&
      table.voiceById(undefined) === lead &&
      table.voiceById(other.id) === other &&
      table.voiceById(other.name) === other,
    `Nova and undefined → the default; ${other.name} and its full id → its own row`,
  );
  judge(
    'voices: the speaker sends the name it is speaking in',
    /voice: speakVoice/.test(speaker),
    'the speak request in src/voice.ts',
  );
  /* The mockup's four names must not come back through the pane: that is the bug
     as the person met it — a list offering what the server cannot speak. */
  judge(
    'voices: the pane is drawn from the table, not from four names of its own',
    /VOICES\.map/.test(settings) &&
      /voiceById\(voice\)\.id/.test(settings) &&
      !/'(Nova|Alloy|Onyx|Shimmer)'/.test(settings),
    'src/components/settings/Settings.tsx',
  );

  /* ── How fast it is read ───────────────────────────────────────────────────
     Three things have to agree before a speed is real, and each of them was
     missing until 2026-10-08 — the server parsed and clamped a `rate` that no
     caller ever sent (api/ai.ts:442), and the pane had no row for it. So: the
     steps about to be offered, the row that offers them, and the number that
     leaves for the server. The range is read out of the server's own clamp
     rather than written here, because a step outside it would be silently
     corrected on the way and the setting would read as broken. */
  const range = server.match(/Math\.min\(([\d.]+), Math\.max\(([\d.]+), speakingRate\)\)/);
  const steps = (table.SPEEDS || []).map((s) => s.rate);
  judge(
    `speed: four steps, 1× the default, all inside the server's own ${range ? `${range[2]}–${range[1]}` : 'range'}`,
    !!range &&
      steps.join(',') === '0.75,1,1.25,1.5' &&
      table.DEFAULT_SPEED.rate === 1 &&
      (table.SPEEDS || []).every((s) => typeof s.label === 'string' && s.label.length > 0) &&
      steps.every((rate) => rate >= Number(range[2]) && rate <= Number(range[1])),
    `steps=${steps.join(', ')} default=${table.DEFAULT_SPEED.rate} storedSpeed() with nothing stored=${table.storedSpeed()}`,
  );
  judge(
    'speed: the setting the reader asks for is one of those steps, not the raw number',
    typeof table.storedSpeed === 'function' && steps.includes(table.storedSpeed()),
    'src/voices.ts, `storedSpeed` — the default when nothing is stored',
  );
  judge(
    'speed: the pane draws the steps from the table, not from a list of its own',
    /SPEEDS\.map/.test(settings) && /setSpeed/.test(settings),
    'src/components/settings/Settings.tsx',
  );
  judge(
    'speed: the rate is settled when the run starts and travels on the request',
    /speakRate = storedSpeed\(\)/.test(speaker) && /rate: String\(speakRate\)/.test(speaker),
    'src/voice.ts — `speak` reads it, `fetchClip` sends it',
  );

  return out;
}

/** Judge a source. Returning the verdicts instead of printing them is what lets
 *  checks/voice.selftest.mjs hand this text it has broken on purpose and assert
 *  that every break is caught. */
export function verdicts(source, voices = VOICES, server = SERVER, settings = SETTINGS, composer = COMPOSER) {
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

  const long = 'Sentence number one is here. '.repeat(200);
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

  /* ── The table ─────────────────────────────────────────────────────────────
     Lifted and called rather than pattern-matched: it is a table, and the claims
     worth checking about a table are about what it holds. */
  const table = {};
  let tableError = null;
  try {
    const host = { exports: {} };
    new Function('module', 'exports', transformSync(voices, { loader: 'ts', format: 'cjs' }).code)(
      host,
      host.exports,
    );
    Object.assign(table, host.exports);
  } catch (error) {
    tableError = String(error && error.message);
  }
  if (tableError || !Array.isArray(table.VOICES)) {
    judge(
      'voices: the table can be lifted out and read',
      false,
      tableError ?? 'it lifted, but no VOICES came back',
    );
  } else {
    judge('voices: the table can be lifted out and read', true, `${table.VOICES.length} rows`);
    out.push(...tableVerdicts(table, server, source, settings));
  }

  /* ── The microphone ────────────────────────────────────────────────────────
     The mic is two files: this one, which runs the recogniser, and the composer,
     which owns the field. Where they meet is a single object — `VoiceTyping`,
     handed to `toggleMic` when the button goes on — and that is the seam that
     failed: voice.ts holds the object for the whole dictation (`let listener`,
     below), so every callback on it is the one built on the render that switched
     the mic on, while React makes a new copy of the composer's `send` on every
     render after that. A `send` reading the composer's *state* therefore reads
     the field as it was when the mic came on — empty, on a cold mic — and the
     dictation never leaves the box, with nothing anywhere saying why. The field
     ref is the one value every writer writes, which is why the send and the read
     both have to come off it. Asserted on the line that decides it rather than on
     the presence of a name, so a rewrite that keeps the meaning keeps passing. */
  const sendStart = composer.indexOf('const send = (byVoice = false) => {');
  const sendBody = sendStart < 0 ? '' : composer.slice(sendStart, composer.indexOf('\n  };', sendStart));
  const fromField = /const value = ([^;]+);/.exec(sendBody);
  judge(
    'mic: the send takes its text off the field, not off the render',
    !!fromField && fromField[1].trim() === 'field.current.trim()',
    fromField ? `const value = ${fromField[1].trim()};` : "no `const value = ...;` in the composer's send",
  );
  judge(
    'mic: the field the mic reads is the one every writer writes',
    /read: \(\) => field\.current/.test(composer) && /field\.current = value;/.test(composer),
    'the read the mic is given, and the write behind every change',
  );

  /* And the speaker's half of the same seam: while it is reading, it holds the
     mic's send off (1756) — so a run that never finishes is a microphone that
     never types again. These two are the ways out. A renamed function is the same
     answer as a missing line: an empty body fails the verdict instead of throwing
     through the one that has to report it. */
  const bodyOf = (name) => {
    try {
      return snippet(source, name);
    } catch {
      return '';
    }
  };
  const unlockBody = bodyOf('unlock');
  judge(
    'speak: the silence is never played over a piece that is playing',
    /if \(running \|\| sounding\) return;/.test(unlockBody),
    unlockBody ? 'unlock, which plays through the element the reply comes out of' : 'unlock is not in src/voice.ts',
  );
  const speakBody = bodyOf('playClip');
  judge(
    'speak: a piece that fails to play still advances the run',
    /el\.onerror = finish/.test(speakBody),
    speakBody ? "the run's own answer to a piece it cannot play" : 'playClip is not in src/voice.ts',
  );
  const runBody = bodyOf('runSpeak');
  judge(
    'speak: a piece the element cannot play is read in the browser voice, and said so',
    /resolve\(played\)/.test(speakBody) &&
      /playBrowserPiece\(clip\.text\)/.test(runBody) &&
      /Could not play that here/.test(source),
    speakBody && runBody
      ? 'playClip reports it, runSpeak falls back and says so'
      : 'playClip or runSpeak is not in src/voice.ts',
  );
  const resultHead = (source.match(/rec\.onresult = \(event\) => \{([\s\S]{0,400})/) || [])[1] || '';
  judge(
    'mic: a result that lands after the mic is off is ignored',
    /if \(listener !== voice\) return;/.test(resultHead),
    resultHead ? 'onresult, which must check the session the way onend does' : 'rec.onresult is not in src/voice.ts',
  );
  const stopBranch = (source.match(/reason === 'audio-capture'[^\n]*/) || [''])[0];
  judge(
    'mic: a dropped connection rides the restart, not the stop',
    stopBranch.includes('audio-capture') && !stopBranch.includes('network'),
    stopBranch || 'the fatal-error branch is not in src/voice.ts',
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

