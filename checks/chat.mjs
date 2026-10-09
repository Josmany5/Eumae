#!/usr/bin/env node
/* Run the two pure parts of the sender: the frame splitter and the frame reader.
 *
 * Both are the kind of code that fails quietly, which is the only reason a check
 * like this is worth having. A reply arrives as a stream of `data: {...}` frames
 * and neither end can see the other: lose half a frame at a chunk boundary and
 * the symptom is an answer that stops mid-word; read `error` as fatal and a reply
 * that arrived is thrown away for a sentence that came after it; treat an unknown
 * frame as one worth failing on and a newer server becomes an outage.
 *
 * So this check runs them for real rather than reading them. Both live in
 * src/chat.ts, which as a whole cannot be imported here: it is TypeScript and its
 * sender uses `fetch`. These two use neither, which is not an accident — it is
 * why they are written the way they are. So the check lifts them out of the file
 * by name, transpiles them with the project's own esbuild, and calls them.
 *
 * Nothing is asserted against a copy of the source: the failure sentence comes
 * out of `const UNKNOWN_FAILURE = '...';`, and the frames the server writes are
 * matched out of api/ai.ts — so a reworded sentence or a changed frame fails
 * loudly here instead of turning into a reply that never arrives.
 *
 *   node checks/chat.mjs             (or: npm run check:chat)
 *
 * Its own cases — including every deliberate break it must catch — are in
 * checks/chat.selftest.mjs, which needs no browser and no network either.
 *
 * Exit codes: 0 everything holds, 1 something does not.
 */
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';

const SERVER = readFileSync(new URL('../api/ai.ts', import.meta.url), 'utf8');

/** One function, from its `export` to the closing brace at column 0. The
 *  `export` is kept: that is what makes esbuild hand the function back on the
 *  module it is told to write to. */
function snippet(source, name) {
  const at = source.indexOf(`function ${name}(`);
  if (at < 0) throw new Error(`${name} is not in src/chat.ts`);
  const start = at > 7 && source.slice(at - 7, at) === 'export ' ? at - 7 : at;
  const end = source.indexOf('\n}', at);
  if (end < 0) throw new Error(`${name} never closes at column 0`);
  return source.slice(start, end + 2);
}

/** The two functions, plus the one sentence they read, as runnable JavaScript.
 *  `parseEvent` falls back to that sentence for an error frame that carries no
 *  message, so lifting it without its constant would be lifting broken code. */
export function lift(source) {
  const sentence = source.match(/^const UNKNOWN_FAILURE = '.*';$/m);
  if (!sentence) throw new Error("const UNKNOWN_FAILURE = '<sentence>'; is not in src/chat.ts");
  const code = [sentence[0], snippet(source, 'takeEvents'), snippet(source, 'parseEvent')].join('\n');
  return transformSync(code, { loader: 'ts', format: 'cjs' }).code;
}

/** The failure sentence as the source spells it, so the check compares against
 *  the file rather than against a sentence written here. */
function sentenceOf(source) {
  const found = source.match(/^const UNKNOWN_FAILURE = '(.*)';$/m);
  if (!found) throw new Error("const UNKNOWN_FAILURE = '<sentence>'; is not in src/chat.ts");
  return found[1];
}

/** The server's own sentence for the same failure, read out of api/ai.ts. */
function serverSentence() {
  const found = SERVER.match(/^const UPSTREAM_ERROR = '(.*)';$/m);
  if (!found) throw new Error("const UPSTREAM_ERROR = '<sentence>'; is not in api/ai.ts");
  return found[1];
}

/** Judge a source. Returning the verdicts instead of printing them is what lets
 *  checks/chat.selftest.mjs hand this text it has broken on purpose and assert
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
  if (typeof lifted.takeEvents !== 'function' || typeof lifted.parseEvent !== 'function') {
    return [
      {
        name: 'the two functions can be lifted out and called',
        pass: false,
        detail: 'lifted, but neither came back',
      },
    ];
  }

  const { takeEvents, parseEvent } = lifted;
  const sentence = sentenceOf(source);
  const out = [];
  const judge = (name, pass, detail) => out.push({ name, pass, detail });

  /* The two lines of `streamChat`'s own loop, written again here because that
     loop calls `fetch`: append what arrived, take the whole frames out of it, and
     read whatever is left when the response ends. Every frame spelling it depends
     on is checked against api/ai.ts at the end of this list, which is what keeps
     the copy honest. */
  const read = (pieces) => {
    let buffer = '';
    const events = [];
    for (const piece of pieces) {
      const taken = takeEvents(buffer + piece);
      buffer = taken.rest;
      for (const frame of taken.frames) events.push(parseEvent(frame));
    }
    if (buffer.trim()) events.push(parseEvent(buffer));
    return events.filter(Boolean);
  };

  const two = takeEvents('data: {"text":"a"}\n\ndata: {"text":"b"}\n\n');
  judge(
    'splitter: two frames in one chunk are two frames',
    two.frames.length === 2 && two.rest === '',
    `frames=${two.frames.length} rest=${JSON.stringify(two.rest)}`,
  );

  const half = takeEvents('data: {"text":"a"}\n');
  judge(
    'splitter: a frame with no blank line after it is not a frame yet',
    half.frames.length === 0 && half.rest === 'data: {"text":"a"}\n',
    `frames=${half.frames.length} rest=${JSON.stringify(half.rest)}`,
  );

  const crlf = takeEvents('data: {"text":"a"}\r\n\r\ndata: {"done":true}\r\n\r\n');
  judge(
    'splitter: CRLF counts as a frame boundary too',
    crlf.frames.length === 2 && crlf.rest === '',
    `frames=${crlf.frames.length} rest=${JSON.stringify(crlf.rest)}`,
  );

  const reply = read([
    'data: {"text":"Hello"}\n\n',
    'data: {"text":", world"}\n\n',
    'data: {"done":true}\n\n',
  ]);
  const words = reply.filter((event) => event.kind === 'text').map((event) => event.text).join('');
  judge(
    'reader: the pieces come back as one reply',
    reply.map((event) => event.kind).join(',') === 'text,text,done' && words === 'Hello, world',
    `${reply.map((event) => event.kind).join(',')} — ${JSON.stringify(words)}`,
  );

  const split = read(['data: {"te', 'xt":"half', '"}\n', '\ndata: {"text":" and half"}\n\n']);
  judge(
    'reader: a frame split across three chunks is read once, whole',
    split.length === 2 && split[0].text === 'half' && split[1].text === ' and half',
    JSON.stringify(split),
  );

  const quiet = read([': keep-alive\n\n', 'data: {"something":"newer"}\n\n', 'data: {"text":"hi"}\n\n']);
  judge(
    'reader: a keep-alive and a frame this version does not know are skipped',
    quiet.length === 1 && quiet[0].text === 'hi',
    JSON.stringify(quiet),
  );

  const last = read(['data: {"text":"no blank line at the end"}\n']);
  judge(
    'reader: the last frame is read even without its blank line',
    last.length === 1 && last[0].text === 'no blank line at the end',
    JSON.stringify(last),
  );

  const named = parseEvent('data: {"error":{"message":"Gemini is busy"}}');
  const bare = parseEvent('data: {"error":"That key is wrong"}');
  judge(
    "reader: the server's own failure sentence is passed through, both spellings",
    named !== null &&
      named.kind === 'error' &&
      named.message === 'Gemini is busy' &&
      bare !== null &&
      bare.kind === 'error' &&
      bare.message === 'That key is wrong',
    JSON.stringify([named, bare]),
  );

  const nameless = parseEvent('data: {"error":{"message":""}}');
  judge(
    'reader: a failure with no sentence of its own still says something',
    nameless !== null && nameless.kind === 'error' && nameless.message === sentence,
    JSON.stringify(nameless),
  );

  judge(
    'reader: the sentence this side owns is the one the server uses too',
    sentence === serverSentence(),
    `${JSON.stringify(sentence)} vs ${JSON.stringify(serverSentence())}`,
  );

  const cut = read([
    'data: {"text":"Partly sai"}\n\n',
    'data: {"error":{"message":"The relay stopped"}}\n\ndata: {"done":true}\n\n',
  ]);
  judge(
    'reader: an error after text does not throw the text away',
    cut.map((event) => event.kind).join(',') === 'text,error,done' && cut[0].text === 'Partly sai',
    cut.map((event) => event.kind).join(','),
  );

  const call = parseEvent('data: {"functionCall":{"name":"generate_image","args":{"prompt":"a cat"}}}');
  const barecall = parseEvent('data: {"functionCall":{"name":"generate_image"}}');
  judge(
    'reader: a tool request is carried, and is not text',
    call !== null &&
      call.kind === 'call' &&
      call.name === 'generate_image' &&
      call.args.prompt === 'a cat' &&
      barecall !== null &&
      barecall.kind === 'call' &&
      JSON.stringify(barecall.args) === '{}',
    JSON.stringify([call, barecall]),
  );

  const grounded = parseEvent('data: {"grounding":{"queries":["weather"]}}');
  judge(
    'reader: a grounded answer says so',
    grounded !== null && grounded.kind === 'grounding' && grounded.grounding.queries[0] === 'weather',
    JSON.stringify(grounded),
  );

  const junk = [parseEvent('data: {oops'), parseEvent('data: [1,2]'), parseEvent(': ping'), parseEvent('data: ')];
  judge(
    'reader: a frame that is not one of these is ignored, not thrown',
    junk.every((event) => event === null),
    JSON.stringify(junk),
  );

  /* The two ends of this protocol live in different files and nothing else makes
     them agree: the reader above parses exactly these five shapes, and these are
     the lines that write them (api/ai.ts:290, 306, 409, 410, 411). */
  const shapes = [
    /data: \$\{JSON\.stringify\(\{ text \}\)\}/,
    /data: \$\{JSON\.stringify\(\{ functionCall: \{ name: call\.name, args: call\.args \} \}\)\}/,
    /data: \$\{JSON\.stringify\(\{ error: \{ message: streamError \} \}\)\}/,
    /data: \$\{JSON\.stringify\(\{ grounding: streamGrounding \}\)\}/,
    /data: \$\{JSON\.stringify\(\{ done: true \}\)\}/,
  ];
  const found = shapes.filter((shape) => shape.test(SERVER)).length;
  judge(
    'reader: every frame it parses is one the server writes',
    found === shapes.length,
    `${found} of ${shapes.length} found in api/ai.ts`,
  );

  return out;
}

function main() {
  const source = readFileSync(new URL('../src/chat.ts', import.meta.url), 'utf8');
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
if (process.argv[1] && process.argv[1].endsWith('chat.mjs')) main();
