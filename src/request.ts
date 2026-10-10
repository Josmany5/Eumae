import type { Mode, Model, Ref, Turn } from './nav';

/* The request — what this thread hands to /api/ai, decided in one place.
 *
 *  Two ends meet here and neither of them owns the shape on its own. The `+`
 *  menu writes the turn (nav.ts), and the server reads a body of
 *  `{ action, data }` (api/ai.ts:178). The third end is the mockup, and it is
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

/** What each mode asks for. The mockup's clauses (1647) are one short sentence
 *  each and this keeps that length — but the three are now three different
 *  *jobs* rather than three tones, because the two that were thin were failing in
 *  ways the owner met (2026-10-08):
 *
 *   - Ask answered the question and then, sometimes, made something. Nothing
 *     asked it to; the always-on line below did (it used to be pushed on every
 *     reply), which is how a question about a country came back with a page.
 *   - Build dropped the code into the chat and left it there: a wall of html with
 *     the guide somewhere inside it, when what a person wants first is what was
 *     made and how to use it. This clause says which comes first. It cannot yet
 *     say where the thing should *land* — nothing renders an artifact (§7), so
 *     the code block is still the only way a built thing leaves a reply, and that
 *     is a gap in the app rather than a shortcoming of this sentence.
 *   - Learn taught in fragments — a fact, then another fact, then an idea nobody
 *     asked for. The shape below is a lesson, in the order a lesson goes, and the
 *     last line is what keeps it on the subject that was asked about.
 */
const MODE_CLAUSE: Record<Mode, string> = {
  Ask: '. Talk, plan, and decide with them. Answer in prose, on the thing they asked about, and keep code out of the reply unless they ask for code.',
  Build:
    '. Make the thing they asked for. Open with what you made and how to use it — a short guide, ' +
    'not a second copy of the thing — and put the thing itself at the end, once.',
  Learn:
    '. Teach it as a lesson rather than a set of facts: what it is, why it matters, how it works ' +
    'step by step, one worked example, and one thing to try next. Stay on what they asked about: ' +
    'no detours, and no extra ideas they did not ask for.',
};

/** Studio's premise (mockup 1655), and since 2026-10-08 Build's alone.
 *
 *  It used to be pushed onto every reply, and that is where the trouble started:
 *  "return it as one complete html code block" is an instruction to make
 *  something, and it was being given on every turn — including in Ask and Learn,
 *  where nobody had asked for a thing to be made. The sentence is Studio's, so it
 *  now travels only with the mode that builds for it. It stays in that mode
 *  because it is what makes a built thing land in one shape instead of five, and
 *  one shape is what makes it findable later, when something renders it (§7). */
const VISUAL =
  'If you make something visual for them to use (a page, widget, calculator, game, document ' +
  'layout), return it as one complete html code block: whole, working on its own, and at the ' +
  'end of the reply. The words above the block are a guide to it — never a second copy.';

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
  /* The premise only where it can be acted on: Build is the mode that makes a
     thing, so it is the mode that is told what shape to make it in. Every other
     mode gets a clause that fits what it is for (above), rather than a standing
     invitation to start building. */
  if (req.mode === 'Build') lines.push(VISUAL);
  return [
    '',
    '',
    'CHAT SETTINGS (the user picked these in the + picker - follow them for this reply):',
    lines.join('\n'),
  ].join('\n');
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
/** The moment this request leaves the phone, in the person's own words' frame:
 *  the date, the time, and their timezone. Every request carries it, so the
 *  model always knows what "now", "tonight" and "tomorrow" mean for them. */
function timeStamp(): string {
  const now = new Date();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const date = now.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const time = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `\n\nCurrent date and time: ${date}, ${time} (${tz}).`;
}

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
      systemPrompt: BASE_PROMPT + directives(req) + timeStamp(),
      conversationHistory: historyOf(history),
      message: req.text,
      ...(attachments.length ? { attachments } : {}),
      ...(model ? { model } : {}),
      ...(functionDeclarations && functionDeclarations.length ? { functionDeclarations } : {}),
    },
  };
}
