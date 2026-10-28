/* A Studio chat (his calls, Oct 27-28; mockups 26 + 27): Eumae's questions
 * flow in the chat, one at a time, with pills (ideas, never walls: type,
 * attach or talk instead any time). Each answer goes into the spec in the
 * person's own words; the app writes it, no AI step. The spec lives in the
 * office (Studio's Build tab) and only holds the context. Make it is in the
 * chat; it hands the whole spec to the AI as one prompt, and the AI writes
 * the code like any chat. Then the chat keeps going: changes rebuild,
 * questions get answers.
 *
 * Saved in localStorage per item, so reopening a draft picks the chat back up. */

import { KINDS, stepsFor, type Kind, type Opt, type Template } from './studioGuide';
import type { Ref } from './nav';

export type Sec = 'is' | 'does' | 'content' | 'look' | 'details' | 'open';
export const SECS: { id: Sec; h: string }[] = [
  { id: 'is', h: 'What it is' },
  { id: 'does', h: 'What it does' },
  { id: 'content', h: 'Content' },
  { id: 'look', h: 'Look' },
  { id: 'details', h: 'Details' },
  { id: 'open', h: 'Eumae decides' },
];

/** One question in the flow. */
export interface Q {
  id: string;
  q: string;
  sec: Sec;
  /** How a tapped pill reads in the spec ("Tone: Warm"). */
  pre?: string;
  opts: Opt[];
  multi?: boolean;
}

export interface SMsg {
  id: string;
  who: 'e' | 'u';
  text: string;
  /** Template pills (first message only). */
  start?: boolean;
  /** The question this message asks (its pills come from it). */
  qid?: string;
  /** Show the Make it button under this message. */
  make?: boolean;
  /** A build landed here: show the preview card. */
  built?: boolean;
  /** After a build: change ideas. */
  chips?: string[];
  streaming?: boolean;
}

export interface Session {
  id: string;
  kind: string;
  tpl: string | null;
  started: boolean;
  spec: Record<Sec, string[]>;
  /** Files and photos from the paperclip, kept for Make it. */
  refs: Ref[];
  msgs: SMsg[];
  /** Questions still to ask, in order. Empty = the flow is done. */
  queue: string[];
  /** Pills ticked on the open pick-several question. */
  ticked: string[];
  fileId?: string;
  title: string;
  at: number;
}

const KEY = 'eumae:studioChats3';
const EVT = 'eumae:studioChats';
export const STUDIO_CHATS_EVENT = EVT;

function load(): Session[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((x) => x && typeof x.id === 'string' && KINDS[x.kind] && x.spec && Array.isArray(x.queue)) : [];
  } catch {
    return [];
  }
}

function store(list: Session[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 60)));
  } catch {
    /* Full storage: the chat still works this session. */
  }
  window.dispatchEvent(new Event(EVT));
}

export function getSession(id: string): Session | undefined {
  return load().find((x) => x.id === id);
}
export function sessionForFile(fileId: string): Session | undefined {
  return load().find((x) => x.fileId === fileId);
}
export function saveSession(s: Session): void {
  store([{ ...s, at: Date.now() }, ...load().filter((x) => x.id !== s.id)]);
}

/* The Studio item on screen, so the office's Build tab shows its spec. */
let active: string | null = null;
export function setActiveStudio(id: string | null): void {
  active = id;
  window.dispatchEvent(new Event(EVT));
}
export const activeStudio = (): Session | undefined => (active ? getSession(active) : undefined);

let n = 0;
export function mid(): string {
  n += 1;
  return 'm' + Date.now().toString(36) + n;
}

/** "slides", "a tracker", "an app". */
export function a(kindName: string): string {
  const k = kindName.toLowerCase();
  return /s$/.test(k) ? k : (/^[aeiou]/.test(k) ? 'an ' : 'a ') + k;
}

export const kindOfSession = (s: Session): Kind => KINDS[s.kind];
export const tplOf = (s: Session): Template | null =>
  s.tpl ? kindOfSession(s).templates.find((t) => t.n === s.tpl) ?? null : null;

const empty = (): Record<Sec, string[]> => ({ is: [], does: [], content: [], look: [], details: [], open: [] });

/** Every question a kind can ask, in the order they flow. */
export function questionsFor(kind: Kind, custom: boolean): Q[] {
  const st = Object.fromEntries(stepsFor(kind, custom).map((x) => [x.id, x]));
  const qs: Q[] = [];
  const add = (q: Q | null) => q && qs.push(q);
  if (st.describe) add({ id: 'describe', q: `What ${kind.n.toLowerCase()} do you want?`, sec: 'is', opts: [] });
  add({ id: 'does', q: 'What should it do?', sec: 'does', opts: st.does?.opts ?? [], multi: true });
  add({ id: 'content', q: "What's it about?", sec: 'content', opts: [] });
  add(st.for ? { id: 'for', q: "Who's it for?", sec: 'is', pre: 'For', opts: st.for.opts } : null);
  add(st.purpose ? { id: 'purpose', q: "What's the main goal?", sec: 'is', pre: 'Goal', opts: st.purpose.opts } : null);
  add(st.style ? { id: 'style', q: 'How should it look?', sec: 'look', pre: 'Style', opts: st.style.opts } : null);
  add(st.colors ? { id: 'colors', q: 'Any colors?', sec: 'look', pre: 'Colors', opts: st.colors.opts } : null);
  add(st.length ? { id: 'length', q: 'How long or how big?', sec: 'look', pre: 'Size', opts: st.length.opts } : null);
  add(st.tone ? { id: 'tone', q: 'How should it sound?', sec: 'look', pre: 'Tone', opts: st.tone.opts } : null);
  add(st.must?.opts.length ? { id: 'must', q: 'Anything it must include?', sec: 'content', opts: st.must.opts, multi: true } : null);
  add({
    id: 'else',
    q: 'Anything else it needs?',
    sec: 'details',
    opts: [{ l: 'Nothing else' }],
  });
  return qs;
}

export function questionOf(s: Session, qid?: string): Q | undefined {
  return qid ? questionsFor(kindOfSession(s), !s.tpl).find((q) => q.id === qid) : undefined;
}

export function newSession(kind: Kind, tpl?: string | null, seed?: string): Session {
  const s: Session = {
    id: 'sc' + Date.now().toString(36),
    kind: kind.n,
    tpl: null,
    started: false,
    spec: empty(),
    refs: [],
    msgs: [{ id: mid(), who: 'e', start: true, text: `Let's make ${a(kind.n)}. Start from one of these, or just tell me your idea.` }],
    queue: [],
    ticked: [],
    title: kind.n,
    at: Date.now(),
  };
  if (tpl !== undefined) return startWith(s, tpl);
  if (seed) return answer(startWith(s, null, true), seed);
  return s;
}

/** A template (or Custom) tapped: write what it implies, then the first question. */
export function startWith(s: Session, tpl: string | null, quiet = false): Session {
  const kd = kindOfSession(s);
  const t = tpl ? kd.templates.find((x) => x.n === tpl) ?? null : null;
  const p = t?.preset ?? {};
  const one = (v: unknown) => (Array.isArray(v) ? v.join(', ') : typeof v === 'string' ? v : '');
  const spec = empty();
  spec.is.push(t ? `${t.n}: ${t.d.charAt(0).toLowerCase()}${t.d.slice(1)}` : `${kd.n}`);
  if (p.for) spec.is.push(`For: ${one(p.for)}`);
  if (p.purpose) spec.is.push(`Goal: ${one(p.purpose)}`);
  if (Array.isArray(p.must)) spec.content.push(...p.must);
  if (p.style) spec.look.push(`Style: ${one(p.style)}`);
  if (p.length) spec.look.push(`Size: ${one(p.length)}`);
  if (p.tone) spec.look.push(`Tone: ${one(p.tone)}`);
  const queue = questionsFor(kd, !t)
    .filter((q) => !(q.id in p))
    .map((q) => q.id);
  const next: Session = {
    ...s,
    tpl: t ? t.n : null,
    started: true,
    spec,
    queue,
    ticked: [],
    title: t ? t.n : `New ${kd.n.toLowerCase()}`,
    msgs: quiet ? s.msgs : [...s.msgs, { id: mid(), who: 'u', text: t ? t.n : 'Custom' }],
  };
  return quiet ? next : ask(next, '');
}

/** Post the next question, or the "ready" message with Make it. */
function ask(s: Session, lead: string): Session {
  const qid = s.queue[0];
  const q = questionOf(s, qid);
  const say = (x: string) => (lead ? `${lead} ${x}` : x);
  if (q) return { ...s, ticked: [], msgs: [...s.msgs, { id: mid(), who: 'e', text: say(q.q), qid: q.id }] };
  return {
    ...s,
    ticked: [],
    msgs: [...s.msgs, { id: mid(), who: 'e', text: say("That covers it. Add anything else, or make it."), make: true }],
  };
}

const push = (spec: Record<Sec, string[]>, sec: Sec, lines: string[]) => {
  const low = (x: string) => x.toLowerCase();
  const add = lines.map((l) => l.trim()).filter((l) => l && !spec[sec].some((y) => low(y) === low(l)));
  return { ...spec, [sec]: [...spec[sec], ...add] };
};

/** Tick or untick a pill on a pick-several question. */
export function tick(s: Session, l: string): Session {
  return { ...s, ticked: s.ticked.includes(l) ? s.ticked.filter((x) => x !== l) : [...s.ticked, l] };
}

/** Their answer to the open question (a pill, the ticked pills, or their own
 *  words). Written into the spec as-is, then the next question. With nothing
 *  open, their words go under Details. */
export function answer(s: Session, text: string, files: Ref[] = []): Session {
  const words = text.trim();
  const q = questionOf(s, s.queue[0]);
  let spec = s.spec;
  const shown = [...(q?.multi ? s.ticked : []), ...(words ? [words] : [])].join(', ');
  const msgs = [...s.msgs, { id: mid(), who: 'u' as const, text: shown || (files.length ? files.map((f) => f.label).join(', ') : 'Done') }];
  if (files.length) spec = push(spec, 'content', files.map((f) => `File: ${f.label}`));
  const refs = [...s.refs, ...files.filter((f) => !s.refs.some((r) => r.label === f.label)).map(({ label, icon, uploadId }) => ({ label, icon, uploadId }))];
  if (!q) {
    if (words) spec = push(spec, 'details', [words]);
    return { ...s, spec, refs, msgs: [...msgs, { id: mid(), who: 'e', text: 'Added. Anything else?', make: true }] };
  }
  if (q.multi) spec = push(spec, q.sec, s.ticked);
  if (words && !(q.id === 'else' && /^nothing else$/i.test(words))) {
    spec = push(spec, q.sec, [q.pre ? `${q.pre}: ${words}` : words]);
  }
  let title = s.title;
  if (q.id === 'describe' && words && /^New /.test(title)) title = words.slice(0, 50);
  return ask({ ...s, spec, refs, title, queue: s.queue.slice(1) }, 'Added.');
}

/** Skip: Eumae picks that one when it makes it. */
export function skip(s: Session): Session {
  const q = questionOf(s, s.queue[0]);
  if (!q) return s;
  const label = q.pre ?? (q.id === 'does' ? 'What it does' : q.id === 'content' ? 'Content' : q.id === 'must' ? 'Must include' : q.id === 'describe' ? 'What it is' : '');
  const spec = q.id === 'else' || !label ? s.spec : push(s.spec, 'open', [label]);
  return ask({ ...s, spec, queue: s.queue.slice(1), msgs: [...s.msgs, { id: mid(), who: 'u', text: 'Skip' }] }, '');
}

export function lineCount(s: Session): number {
  return SECS.filter((x) => x.id !== 'open').reduce((n, x) => n + s.spec[x.id].length, 0);
}

/** The whole spec as one prompt: what Make it hands the AI. */
export function briefOfSession(s: Session): string {
  const parts = SECS.filter((x) => x.id !== 'open' && s.spec[x.id].length).map(
    (x) => `${x.h}:\n${s.spec[x.id].map((l) => '- ' + l).join('\n')}`,
  );
  if (s.spec.open.length) parts.push(`They left these to you (choose what fits best): ${s.spec.open.join(', ')}`);
  return `Make ${a(s.kind)} from this spec. Build exactly what it says; where it is silent, choose what fits best.\n\n${parts.join('\n\n')}`;
}

/** After a build: is this a question about it (answer it) or a change (rebuild)? */
export function isQuestion(text: string): boolean {
  const t = text.trim().toLowerCase();
  return /\?$/.test(t) || /^(what|why|how|which|who|where|when|is|are|does|do|can|could|would|should|will)\b/.test(t);
}

/** Change ideas after a build. */
export const CHANGE_CHIPS = ['Bigger text', 'Different colors', 'Shorter', 'Add more detail'];
