/* A Studio chat (his call, Oct 27; mockup 25-studio-chat-phone.png): the talk,
 * the spec and the build are one screen. Eumae leads with plain questions and
 * idea chips (ideas only, never a form); whatever they type, Eumae files into
 * the spec and asks the next thing that matters. Make it builds in Studio.
 *
 * Saved in localStorage per item, so reopening a draft picks the chat back up. */

import { KINDS, type Kind, type Template } from './studioGuide';

export type Sec = 'is' | 'does' | 'content' | 'look' | 'open';
export const SECS: { id: Sec; h: string }[] = [
  { id: 'is', h: 'What it is' },
  { id: 'does', h: 'What it does' },
  { id: 'content', h: 'Content' },
  { id: 'look', h: 'Look' },
  { id: 'open', h: 'Open questions' },
];

export interface SMsg {
  id: string;
  who: 'e' | 'u';
  text: string;
  /** Template chips (first message only). */
  start?: boolean;
  /** Idea chips: tap to add or remove that line in What it does. */
  ideas?: string[];
  /** Answer chips: tap to send as your answer. */
  chips?: string[];
  streaming?: boolean;
}

export interface Session {
  id: string;
  kind: string;
  tpl: string | null;
  started: boolean;
  spec: Record<Sec, string[]>;
  files: string[];
  msgs: SMsg[];
  fileId?: string;
  title: string;
  at: number;
}

const KEY = 'eumae:studioChats2';
const EVT = 'eumae:studioChats';
export const STUDIO_CHATS_EVENT = EVT;

function load(): Session[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((x) => x && typeof x.id === 'string' && KINDS[x.kind] && x.spec) : [];
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

const empty = (): Record<Sec, string[]> => ({ is: [], does: [], content: [], look: [], open: [] });

export function newSession(kind: Kind, tpl?: string | null, seed?: string): Session {
  const s: Session = {
    id: 'sc' + Date.now().toString(36),
    kind: kind.n,
    tpl: null,
    started: false,
    spec: empty(),
    files: [],
    msgs: [{ id: mid(), who: 'e', start: true, text: `Let's make ${a(kind.n)}. Start from one of these, or just tell me your idea.` }],
    title: kind.n,
    at: Date.now(),
  };
  return tpl !== undefined ? startWith(s, tpl) : seed ? { ...s, title: seed.slice(0, 60) } : s;
}

/** A template (or Custom) tapped: fill what it implies, then ask what it does. */
export function startWith(s: Session, tpl: string | null): Session {
  const kd = kindOfSession(s);
  const t = tpl ? kd.templates.find((x) => x.n === tpl) ?? null : null;
  const p = t?.preset ?? {};
  const one = (v: unknown) => (Array.isArray(v) ? v.join(', ') : typeof v === 'string' ? v : '');
  const spec = empty();
  spec.is.push(t ? `${t.n}: ${t.d.toLowerCase()}` : `A ${kd.n.toLowerCase()}`);
  if (p.for) spec.is.push(`For ${one(p.for).toLowerCase()}`);
  if (p.purpose) spec.is.push(`Goal: ${one(p.purpose).toLowerCase()}`);
  if (Array.isArray(p.must)) spec.content.push(...p.must);
  if (p.length) spec.look.push(one(p.length));
  if (p.style) spec.look.push(one(p.style));
  if (p.tone) spec.look.push(`${one(p.tone)} tone`);
  const name = t ? t.n.toLowerCase() : kd.n.toLowerCase();
  return {
    ...s,
    tpl: t ? t.n : null,
    started: true,
    spec,
    title: t ? t.n : `New ${kd.n.toLowerCase()}`,
    msgs: [
      ...s.msgs,
      { id: mid(), who: 'u', text: t ? t.n : 'Custom' },
      {
        id: mid(),
        who: 'e',
        text: `${cap(a(name))}. Nice. What should it actually do? Say it your way. The chips are just ideas.`,
        ideas: kd.does.map((o) => o.l),
      },
    ],
  };
}

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

/** An idea chip: add it to What it does, or take it back out. */
export function toggleIdea(s: Session, idea: string): Session {
  const has = s.spec.does.includes(idea);
  return { ...s, spec: { ...s.spec, does: has ? s.spec.does.filter((x) => x !== idea) : [...s.spec.does, idea] } };
}

export function lineCount(s: Session): number {
  return SECS.filter((x) => x.id !== 'open').reduce((n, x) => n + s.spec[x.id].length, 0);
}

/** Short one-line summary for the pinned bar. */
export function summary(s: Session): string {
  return [...s.spec.does, ...s.spec.content, ...s.spec.look].join(' · ');
}

/** Everything the builder needs, as one detailed ask. */
export function briefOfSession(s: Session): string {
  const parts = SECS.filter((x) => x.id !== 'open' && s.spec[x.id].length).map(
    (x) => `${x.h}:\n${s.spec[x.id].map((l) => '- ' + l).join('\n')}`,
  );
  if (s.files.length) parts.push(`Files they attached: ${s.files.join(', ')}`);
  if (s.spec.open.length) parts.push(`Still open (choose what fits best):\n${s.spec.open.map((l) => '- ' + l).join('\n')}`);
  return `Make ${a(s.kind)} from this spec. Build exactly what it says; where it is silent, choose what fits best.\n\n${parts.join('\n\n')}`;
}

/** What the spec still lacks, so Eumae asks about the gap that matters. */
export function gaps(s: Session): string {
  const miss: string[] = [];
  if (s.spec.does.length < 2) miss.push('what it does and how it works');
  if (!s.spec.content.length) miss.push('the real content, data or materials');
  if (!s.spec.is.some((l) => /^for |goal/i.test(l))) miss.push('who it is for and what it is for');
  if (!s.spec.look.length) miss.push('the look, colors, size or length, and tone');
  miss.push('rules or technical needs if they matter here (sign-in, saving, reminders, offline, integrations)');
  return miss.join('; ');
}

type Patch = Partial<Record<Sec | 'resolved' | 'chips', string[]>> & { title?: string };

/** Pull the JSON out of Eumae's reply. Models label the block spec, json or
 *  nothing, or skip the fence, so take the trailing {...} that parses. */
export function parseSpecReply(text: string): { say: string; patch: Patch } {
  const say = hideSpec(text);
  const m = text.slice(say.length).match(/\{[\s\S]*\}/);
  if (!m) return { say, patch: {} };
  try {
    const j = JSON.parse(m[0]);
    const arr = (x: unknown) =>
      Array.isArray(x) ? x.filter((y) => typeof y === 'string' && y.trim()).map((y: string) => y.trim()).slice(0, 8) : [];
    const patch: Patch = {};
    for (const k of ['is', 'does', 'content', 'look', 'open', 'resolved', 'chips'] as const) patch[k] = arr(j[k]);
    if (typeof j.title === 'string' && j.title.trim()) patch.title = j.title.trim().slice(0, 60);
    return { say, patch };
  } catch {
    return { say, patch: {} };
  }
}

/** Everything from the first code fence, or a bare {"is"...} object, is data. */
export function hideSpec(text: string): string {
  const i = text.search(/```|\{\s*"(is|does|content|look|open|resolved|chips|title)"/);
  return (i < 0 ? text : text.slice(0, i)).trim();
}

export function applyPatch(s: Session, p: Patch): Session {
  const spec = { ...s.spec };
  const low = (x: string) => x.toLowerCase();
  for (const x of SECS) {
    const add = (p[x.id] ?? []).filter((l) => !spec[x.id].some((y) => low(y) === low(l)));
    spec[x.id] = [...spec[x.id], ...add];
  }
  if (p.resolved?.length) spec.open = spec.open.filter((l) => !p.resolved!.some((r) => low(r) === low(l)));
  const custom = !s.tpl && /^New /.test(s.title);
  return { ...s, spec, title: p.title && custom ? p.title : s.title };
}
