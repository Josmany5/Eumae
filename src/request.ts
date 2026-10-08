import type { Mode, Model, Ref, Turn } from './nav';

/* The request — what this thread hands to /api/ai, decided in one place.
 *
 *  Two ends meet here and neither of them owns the shape on its own. The `+`
 *  menu writes the turn (nav.ts), and the server reads a body of
 *  `{ action, data }` (api/ai.ts:124). The third end is the mockup, and it is
 *  the reason none of this is guesswork — it builds exactly this at line 1872:
 *
 *    {action:"chatStream",data:{systemPrompt:PROMPT+directives(),
 *     conversationHistory:hist,message:apiMsg,functionDeclarations:TOOLS}}
 *
 *  Which settles the one thing worth settling: the five settings do *not*
 *  travel as five fields. They travel as prose — `directives()` (mockup 1644)
 *  turns them into a block appended to the system prompt — and the single
 *  setting the server has a field for, `model`, travels as a *key* into the
 *  server's own table (`lite` / `best`), not as the label the chip shows.
 *  Writing that down, once, is this module's whole job. Phase 6 calls it;
 *  §5 check 6 is what keeps it true until then.
 */

/** The base instruction, prepended to the settings block.
 *
 *  The mockup's own paragraph (1626) names the owner and calls him "the person
 *  building it". This repo is public and carries no real name (§3), so the
 *  paragraph is written fresh: same job, nobody's name in it, and the same
 *  admission — that this thread cannot yet see or change anything inside the
 *  app, so a request to do so is answered plainly instead of faked. */
export const BASE_PROMPT =
  'You are Eumae, the personal AI inside the Eumae app. Answer directly and plainly, in a ' +
  'warm, natural tone. You cannot yet see or change the person\u2019s tasks, files, or anything ' +
  'else in the app; if they ask you to do something inside the app, say plainly that this ' +
  'thread is not wired to do that yet. Answer everything else normally.';

/** What each mode asks for, from the mockup's own clauses (1647). The sentences
 *  are the mockup's; the pronouns are not — it addressed one man by name. */
const MODE_CLAUSE: Record<Mode, string> = {
  Ask: '. Talk, plan, and decide with them.',
  Build: '. If you make something visual, return it as one complete html code block.',
  Learn: '. Teach clearly, with short examples.',
};

/** The always-on line (mockup 1655): Studio's whole premise, told to the model
 *  before anyone has built Studio. It stays because it is what makes a built
 *  thing land in one shape instead of five. */
const VISUAL =
  'If you make something visual for them to use (a page, widget, calculator, game, document ' +
  'layout), return it as one complete html code block.';

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

/** The settings block from `directives()` (mockup 1644-1661), transcribed word
 *  for word — including its hyphen — with one substitution: the mockup wrote
 *  "him", and this repo cannot know who is typing.
 *
 *  Two deliberate departures, both because the model should be told less that
 *  is not true:
 *   - `role: ''` is Default (the Role section in `AddSheet.tsx`). The mockup keeps the literal
 *     string and tells the model "Role: Default." anyway (1648-1650); an empty
 *     role describes nothing a persona needs to be told, so no line is sent —
 *     the same reason its own chip hides Default (1270).
 *   - the skill line drops the skill's own description, which the mockup
 *     appends when there is one (1652). No skill exists yet, so there is no
 *     description to carry; the sentence itself still says "Follow it." */
export function directives(req: TurnRequest): string {
  const lines = [`Mode: ${req.mode}${MODE_CLAUSE[req.mode]}`];
  if (req.role) lines.push(`Role: ${req.role}.`);
  if (req.skill) lines.push(`Skill: ${req.skill}. Follow it.`);
  /* Balanced asks for nothing extra — the mockup only speaks up for the two
     ends (1653), which is what makes Balanced the default rather than a third
     instruction. */
  if (req.thinking === 'Quick') lines.push('Keep the reply brief.');
  if (req.thinking === 'Deep') lines.push('Think it through and give a fuller, more careful answer.');
  lines.push(VISUAL);
  return [
    '',
    '',
    'CHAT SETTINGS (the user picked these in the + picker - follow them for this reply):',
    lines.join('\n'),
  ].join('\n');
}

/** The label the chip shows is *not* the key the server reads.
 *
 *  `MODEL_IDS` (api/ai.ts:39) has two entries, `lite` and `best`, and the two chat
 *  branches resolve anything they do not recognise to the default (ai.ts:135 for
 *  `chat`, 185 for `chatStream`). So 'Fast' travelling
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

/** Bytes on the wire, in the shape the server sanitizes (api/ai.ts:4, 9):
 *  base64, image / PDF / plain text only, 3 MB in total. */
export interface Attachment {
  mimeType: string;
  data: string;
}

/** `data:<mime>;base64,<bytes>` — what `FileReader.readAsDataURL` produces. */
const DATA_URL = /^data:([^;,]+);base64,(.+)$/;

/** Only a ref with a `url` has bytes, and today only a photo gets one: App's
 *  reader stops at `!file.type.startsWith('image/')` (App.tsx:96) and attaches
 *  a PDF as a bare label. So a PDF ref is skipped here rather than sent as an
 *  empty part, and the mockup's behaviour for it — read the file, then ask "What
 *  is in this document?" (1863) — waits for the file work in Phase 6. */
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
 *  `msg.role === 'user' ? 'user' : 'model'` (api/ai.ts:54), so anything that is
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
 *  (ai.ts:124-135) and nothing else, so an unrecognised one is not an error —
 *  it is silence. That is why the shape is a type here instead of an object
 *  literal assembled at the call site. */
export interface ApiChatBody {
  action: 'chatStream';
  data: {
    systemPrompt: string;
    conversationHistory: WireMessage[];
    message: string;
    attachments?: Attachment[];
    model?: string;
    functionDeclarations?: unknown[];
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
export function toApiBody(
  req: TurnRequest,
  history: readonly ThreadTurn[],
  functionDeclarations?: unknown[],
): ApiChatBody {
  const attachments = refsToAttachments(req.refs);
  const model = modelKey(req.model);
  return {
    action: 'chatStream',
    data: {
      systemPrompt: BASE_PROMPT + directives(req),
      conversationHistory: historyOf(history),
      message: req.text,
      ...(attachments.length ? { attachments } : {}),
      ...(model ? { model } : {}),
      ...(functionDeclarations && functionDeclarations.length ? { functionDeclarations } : {}),
    },
  };
}
