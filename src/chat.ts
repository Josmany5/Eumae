import type { ApiChatBody } from './request';
import { accessToken } from './auth';

/* The sender — what posts a turn to /api/ai and reads the reply back.
 *
 *  The server has spoken this protocol since it was written; nothing ever read
 *  it. `chatStream` (api/ai.ts:290) relays Gemini as Server-Sent Events, one
 *  `data: {...}` frame per piece, and the shape of those frames is its own:
 *
 *    { text }                  a piece of the reply — appended to the whole
 *    { functionCall }          the model asked for a tool
 *    { grounding }             a search happened behind this answer
 *    { error: { message } }    the relay could not finish, and the sentence is
 *                              already written for a person to read
 *    { done: true }            the last frame, always
 *
 *  The mockup reads the same stream (1880) and its reader is the reason this file
 *  is split the way it is: `takeEvents` and `parseEvent` are pure, so the part
 *  that can fail silently — a frame split across two network chunks, a blank
 *  keep-alive line, a piece arriving after `done` — is the part that can be
 *  tested without a browser and without a network.
 *
 *  Three of its behaviours are deliberate, and each is a bug avoided:
 *
 *  - A frame only counts when the blank line after it arrives. The server ends
 *    every frame with `\n\n`, and a chunk boundary can land between the JSON and
 *    that blank line; parsing what has arrived so far would mean parsing half a
 *    JSON object and losing a piece of the answer.
 *  - `error` is not fatal. It arrives *before* `grounding` and `done`, and can
 *    follow real text — a relay that died mid-answer — so the text already
 *    received is kept, and the sentence is kept beside it.
 *  - The reply is only `ok` when no error arrived and something did. An answer of
 *    no words at all is not a success that happened to be short: the server
 *    normally says so itself (`EMPTY_REPLY`) and this is the backstop.
 */

/** One frame, as much as the app needs of it. `call` is carried rather than
 *  dropped: a tool request means the answer is not finished, and there is no
 *  harness to run one yet — whoever builds it needs to see these arrive. */
export type StreamEvent =
  | { kind: 'text'; text: string }
  | { kind: 'call'; name: string; args: Record<string, unknown> }
  | { kind: 'grounding'; grounding: unknown }
  | { kind: 'error'; message: string }
  | { kind: 'done' };

/** Whole frames out of what has arrived, and what is left over.
 *
 *  Returns the leftovers rather than keeping them, so the caller's buffer is a
 *  plain string and this stays a function: `rest` is what the next chunk has to
 *  be appended to. CRLF is normalised because SSE allows both line endings and a
 *  proxy is entitled to rewrite them. */
export function takeEvents(buffer: string): { frames: string[]; rest: string } {
  let rest = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const frames: string[] = [];
  for (;;) {
    const end = rest.indexOf('\n\n');
    if (end === -1) return { frames, rest };
    frames.push(rest.slice(0, end));
    rest = rest.slice(end + 2);
  }
}

/* The sentences this side owns. Every one of them is said to a person whose reply
   did not arrive, so each is a full sentence about what to do next — and the
   server's own failure sentences are passed through untranslated rather than
   rewritten, because it is the end that knows what went wrong. */
const UNKNOWN_FAILURE = 'No reply came back. Try again.';
const UNREACHABLE = 'Could not reach Eumae. Check the connection and try again.';
const CUT_SHORT = 'The connection dropped before the reply finished.';
const EMPTY = 'The reply came back empty.';
const NO_SERVER = 'This build has no server behind it — /api/ai is not answering.';
const SIGNED_OUT = 'Sign in to get a reply.';

/** One frame's meaning, or null if it says nothing this version knows.
 *
 *  Null rather than a throw for three real cases: a `:`-comment keep-alive (the
 *  server sends none, a proxy may), a frame with no `data:` line at all, and JSON
 *  that is not one of the frames above. An unrecognised frame is a newer server
 *  talking, which is not a reason to fail a reply that is arriving fine.
 *
 *  There is no `[DONE]` case: that sentinel is Gemini's, consumed on the server
 *  (api/ai.ts:365), and the end of *this* stream is the `done` frame. */
export function parseEvent(frame: string): StreamEvent | null {
  const lines = frame.split('\n').filter((line) => line.startsWith('data:'));
  if (!lines.length) return null;
  const payload = lines.map((line) => line.slice(5).trim()).join('\n');

  let body: {
    text?: unknown;
    functionCall?: { name?: unknown; args?: unknown };
    grounding?: unknown;
    error?: unknown;
    done?: unknown;
  };
  try {
    body = JSON.parse(payload);
  } catch {
    return null;
  }
  if (!body || typeof body !== 'object') return null;

  if (typeof body.text === 'string') return { kind: 'text', text: body.text };
  if (body.functionCall && typeof body.functionCall.name === 'string') {
    const args = body.functionCall.args;
    return {
      kind: 'call',
      name: body.functionCall.name,
      args: args && typeof args === 'object' ? (args as Record<string, unknown>) : {},
    };
  }
  if (body.error) {
    /* `{ error: { message } }` is the stream's own spelling (api/ai.ts:409); a
       bare `{ error: "..." }` is accepted too, because that is what the server's
       non-streaming answers look like and the reader should not care which end
       of the same server it is reading. */
    const said =
      typeof body.error === 'string' ? body.error : (body.error as { message?: unknown }).message;
    return { kind: 'error', message: typeof said === 'string' && said ? said : UNKNOWN_FAILURE };
  }
  if (body.grounding) return { kind: 'grounding', grounding: body.grounding };
  if (body.done) return { kind: 'done' };
  return null;
}

/** What came back, and whether it came back whole. */
export interface Reply {
  /** True only when the reply arrived whole: no error, and something in it. */
  ok: boolean;
  /** The reply as far as it arrived. Kept even when `ok` is false — half an
   *  answer is still what the model said — and this is what Read aloud reads. */
  text: string;
  /** One sentence for the person when `ok` is false, else null. */
  error: string | null;
  /** A tool the model asked for before finishing, if it asked for one. */
  call: { name: string; args: Record<string, unknown> } | null;
}

/** One sentence for a response that is not a stream.
 *
 *  A 401 is the one case this side knows better than the server: it means the
 *  account on this device is not signed in any more, and the door back is the
 *  sign-in form. Everything else is the server's own sentence, passed through as
 *  written. */
async function refusal(response: Response): Promise<string> {
  let said = '';
  try {
    const body: unknown = await response.json();
    const error = (body as { error?: unknown } | null)?.error;
    if (typeof error === 'string') said = error;
  } catch {
    /* Not JSON — a proxy's error page, or no body at all. */
  }
  if (response.status === 401) return SIGNED_OUT;
  if (said) return said;
  if (response.status === 404) return NO_SERVER;
  return UNKNOWN_FAILURE;
}

/** Post one turn, and call `onText` with the reply so far as each piece lands.
 *
 *  `onText` is handed the whole text each time rather than the new piece: a
 *  caller drawing the bubble wants to replace what it shows, not to concatenate
 *  and disagree with this file about the order things arrived in. The token is
 *  asked for here, at the moment of sending, because the library refreshes an
 *  expiring one in the background — a copy kept anywhere else would be the stale
 *  one exactly when it matters (auth.ts:225). */
export async function streamChat(body: ApiChatBody, onText: (full: string) => void): Promise<Reply> {
  let token: string | null = null;
  try {
    token = await accessToken();
  } catch {
    /* A build with no sign-in configured answers null rather than throwing; a
       throw here is the library failing to load, and the request below reports
       that honestly as unreachable. */
    token = null;
  }

  let response: Response;
  try {
    response = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, text: '', error: UNREACHABLE, call: null };
  }

  if (!response.ok || !response.body) {
    return { ok: false, text: '', error: await refusal(response), call: null };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  let failure: string | null = null;
  let call: Reply['call'] = null;

  /** One frame into the running state on the left. */
  const apply = (frame: string) => {
    const event = parseEvent(frame);
    if (!event) return;
    if (event.kind === 'text') {
      text += event.text;
      onText(text);
    } else if (event.kind === 'call') {
      call = { name: event.name, args: event.args };
    } else if (event.kind === 'error') {
      failure = event.message;
    }
  };

  try {
    for (;;) {
      const step = await reader.read();
      if (step.done) break;
      const read = takeEvents(buffer + decoder.decode(step.value, { stream: true }));
      buffer = read.rest;
      for (const frame of read.frames) apply(frame);
    }
  } catch {
    /* The stream threw — a dropped connection, or a body that stopped early.
       What arrived is kept: a partial reply read aloud would be worse than none,
       but a partial reply *shown* with a sentence about it is not. */
    return { ok: false, text, error: CUT_SHORT, call };
  }
  /* The last frame, if the response ended without its trailing blank line. */
  if (buffer.trim()) apply(buffer);

  if (!failure && !text) failure = EMPTY;
  return { ok: !failure, text, error: failure, call };
}
