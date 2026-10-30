import { replyLanguageNudge, storedVoiceLang } from './voiceLang';
import type { Mode, Model, Ref, Turn } from './nav';
import type { CustomRole } from './roles';

/* The request — what this thread hands to /api/ai, decided in one place.
 *
 *  Two ends meet here and neither of them owns the shape on its own. The `+`
 *  menu writes the turn (nav.ts), and the server reads a body of
 *  `{ action, data }` (api/ai.ts:178). The third end is the mockup, which
 *  built the settings block this shape grew out of (1644-1661).
 *
 *  Since Oct 29 the five settings travel as FIVE VALUES, not as prose: the
 *  server composes the CHAT SETTINGS block itself (api/_prompts.ts), because a
 *  prompt the client can write is a prompt a caller can write. What crosses the
 *  wire is a spec of choices (`PromptSpec` below) plus the app's context for
 *  this turn. The one setting the server has a field of its own for, `model`,
 *  travels as a *key* into the server's table (`lite` / `best`), not as the
 *  label the chip shows.
 *
 *  Writing that down, once, is this module's whole job.
 */

/** What the app tells the server about this turn's instructions.
 *
 *  The words are Eumae's, and they live on the server (api/_prompts.ts,
 *  composePrompt). This side sends the CHOICES the person made — the opening,
 *  the mode, the role and its definition, the language, their clock — plus the
 *  app's data for this turn. It used to send a prompt string with markers in
 *  it, which meant the endpoint obeyed whatever came after the first marker:
 *  a caller could write their own instructions and have them followed
 *  (STANDARD.md 3.1, reproduced before it was fixed).
 *
 *  `context` is the one free-text field: what the app knows this turn (the page
 *  being edited, a spec, a hint). It is data, and the server places it after
 *  the instructions, never before them. */
export interface PromptSpec {
  /** Which opening: the plain chat one, or Eumae's full one with tools. */
  base: 'base' | 'eumae';
  mode?: Mode;
  role?: string;
  skill?: string;
  thinking?: 'Quick' | 'Balanced' | 'Deep';
  /** A custom role's own definition, when the person wrote one. */
  tone?: string;
  style?: string;
  purpose?: string;
  /** The person's clock, as one line: "Wednesday, October 29, 2026, 7:04 PM". */
  now?: string;
  /** The language to reply in, by its English name. */
  lang?: string;
  /** Which room of the app is asking. */
  room?: 'console' | 'studio' | 'library' | 'classroom';
  /** Studio's two jobs: make the thing, or answer a question about it. */
  studio?: 'make' | 'answer';
  /** What the app knows this turn — its state, a page's code, a spec, a hint. */
  context?: string;
}

/** How this one message was asked: the chat's turn, plus the two things that
 *  belong to the message rather than to the chat — what was attached, and what
 *  was typed. Same shape the phase named. */
export interface TurnRequest extends Turn {
  refs: Ref[];
  text: string;
}

/** Snapshot the turn at send time. `refs` is copied rather than referenced: the
 *  request is a *record* of what was attached when this message was sent, so
 *  detaching a file afterwards cannot rewrite what an earlier message said. */
export function buildRequest(turn: Turn, refs: readonly Ref[], text: string): TurnRequest {
  return { ...turn, refs: [...refs], text };
}


/** The label the chip shows is *not* the key the server reads.
 *
 *  `MODEL_IDS` (api/ai.ts:62) has two entries, `lite` and `best`, and the two chat
 *  branches resolve anything they do not recognise to the default (ai.ts:192 for
 *  `chat`, 246 for `chatStream`). So 'Fast' travelling
 *  as 'Fast' would not fail — it would quietly hand you the cheapest model under
 *  a label that promised a choice. Auto travels as *no key at all* (the mockup
 *  does the same, 1874) and lets the server default apply; note that with two
 *  entries in the table, Auto and Fast land on the same model today, which is
 *  why "The router picks" is still a promise and not a mechanism. */
const MODEL_KEYS: Record<Model, string | undefined> = {
  Auto: undefined,
  Fast: 'lite',
  Best: 'best',
};

export function modelKey(model: Model): string | undefined {
  return MODEL_KEYS[model];
}

/** Bytes on the wire, in the shape the server sanitizes (api/ai.ts:22-27):
 *  base64, image / PDF / plain text only, 3 MB in total. */
export interface Attachment {
  mimeType: string;
  data: string;
}

/** `data:<mime>;base64,<bytes>` — what `FileReader.readAsDataURL` produces. */
const DATA_URL = /^data:([^;,]+);base64,(.+)$/;

/** Only a ref with a `url` has bytes, and today only a photo gets one: App's
 *  reader stops at `!file.type.startsWith('image/')` (App.tsx:96) and attaches
/** Every ref with a data URL becomes a Gemini part — images, PDFs, audio, video.
 *  The MIME type rides along, so the model knows what it is looking at. */
export function refsToAttachments(refs: readonly Ref[]): Attachment[] {
  const attachments: Attachment[] = [];
  for (const r of refs) {
    const m = DATA_URL.exec(r.url ?? '');
    if (m) attachments.push({ mimeType: m[1], data: m[2] });
  }
  return attachments;
}

/** A turn as the thread knows it. `ChatScreen`'s `Msg` extends this, so the
 *  bubbles on screen and the history on the wire cannot disagree about what a
 *  turn is made of. */
export interface ThreadTurn {
  role: 'you' | 'eumae';
  text: string;
}

/** The same thing in the wire's own spelling. The server reads
 *  `msg.role === 'user' ? 'user' : 'model'` (api/ai.ts:77), so anything that is
 *  not exactly `user` becomes a past *reply* — our two names must not travel,
 *  or the person's own sentences come back to the model as Eumae's. */
export interface WireMessage {
  role: 'user' | 'model';
  content: string;
}

/** The mockup keeps the last 24 turns (1871). That is a window, not a summary:
 *  it is what fits, and it is why an old conversation quietly stops being
 *  context. */
export const HISTORY_LIMIT = 24;

/** Call with the thread *before* the message being sent — that message travels
 *  as `message` and not as history, which is what the mockup's own `slice(0,-1)`
 *  is doing (1871). */
export function historyOf(
  turns: readonly ThreadTurn[],
  limit: number = HISTORY_LIMIT,
): WireMessage[] {
  return turns
    .slice(-limit)
    .map((t) => ({ role: t.role === 'you' ? 'user' : 'model', content: t.text }));
}

/** What the thread posts to /api/ai. The server reads exactly these keys
 *  (ai.ts:178-192) and nothing else, so an unrecognised one is not an error —
 *  it is silence. That is why the shape is a type here instead of an object
 *  literal assembled at the call site. */
export interface ApiChatBody {
  action: 'chatStream';
  data: {
    prompt: PromptSpec;
    conversationHistory: WireMessage[];
    message: string;
    attachments?: Attachment[];
    model?: string;
    functionDeclarations?: unknown[];
    /** This turn's tool exchange so far (Eumae's calls and the app's answers). */
    tail?: unknown[];
  };
}

/** The whole request: the chat's settings as prose, the window of history, this
 *  message, and whatever came with it.
 *
 *  `chatStream` rather than `chat` (the server has both) because the thread is
 *  the streaming path — the mockup streams (1872) and reads SSE frames out of
 *  the response (1880). `functionDeclarations` is a pass-through and is not
 *  invented here: a tool set belongs to the harness (the mockup declares exactly
 *  one tool, `generate_image`, at 1627), and nothing asks for tools yet.
 *
 *  `message` is `req.text` as typed. The mockup also has a fallback for a turn
 *  that is *only* a file — "What is in this document?" / "What is in this
 *  image?" (1863) — which we do not need yet, because the composer will not send
 *  an empty field at all (Composer.tsx:101 disables Send on empty text). */
/** The moment this request leaves the phone, in the person's own words' frame:
 *  the date, the time, and their timezone — ONE line, because the server puts
 *  it into the prompt as "Current date and time: …" and a setting that carries
 *  a newline is a second instruction hiding in a setting. Every request carries
 *  it, so the model always knows what "now", "tonight" and "tomorrow" mean. */
function clockLine(): string {
  const now = new Date();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const date = now.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const time = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${date}, ${time} (${tz})`;
}

/** Items added from the office's Context tab ride under the message as text. */
function ctxBlock(refs: readonly Ref[]): string {
  const items = refs.filter((r) => r.ctx);
  if (!items.length) return '';
  return '\n\n---\nAttached for context:\n' + items.map((r) => `[${r.label}]\n${r.ctx!.slice(0, 6000)}`).join('\n\n');
}

export function toApiBody(
  req: TurnRequest,
  history: readonly ThreadTurn[],
  customRole?: CustomRole | null,
  functionDeclarations?: unknown[],
): ApiChatBody {
  const attachments = refsToAttachments(req.refs);
  const model = modelKey(req.model);
  return {
    action: 'chatStream',
    data: {
      prompt: {
        base: 'base',
        mode: req.mode,
        thinking: req.thinking,
        ...(req.role ? { role: req.role } : {}),
        ...(req.skill ? { skill: req.skill } : {}),
        /* A custom role's definition rides with its name, as before; a built-in
           role travels as the name alone (customRole is null for those). */
        ...(customRole && customRole.tone ? { tone: customRole.tone } : {}),
        ...(customRole && customRole.style ? { style: customRole.style } : {}),
        ...(customRole && customRole.purpose ? { purpose: customRole.purpose } : {}),
        now: clockLine(),
        lang: storedVoiceLang().english,
      },
      conversationHistory: historyOf(history),
      message: req.text + ctxBlock(req.refs) + replyLanguageNudge(),
      ...(attachments.length ? { attachments } : {}),
      ...(model ? { model } : {}),
      ...(functionDeclarations && functionDeclarations.length ? { functionDeclarations } : {}),
    },
  };
}
