/* A Studio chat (his call, Oct 27, 11:05 PM): the questions, the spec and the
 * build are one screen. Tap a kind and its chat opens; templates are Eumae's
 * first pills; one question at a time, a one-answer tap moves on; typing
 * anything goes to Eumae, who adds it to the spec and asks a follow-up; Make it
 * builds the preview right there (versions in Studio, not in main Chat).
 *
 * Saved in localStorage per item, so reopening a draft picks the chat back up. */

import { KINDS, stepsFor, type Kind, type Picks, type Step, type StepId, type Template } from './studioGuide';

export interface SMsg {
  id: string;
  who: 'e' | 'u';
  text: string;
  /** The scripted question this bubble asks. */
  step?: StepId | 'start';
  /** Suggestions Eumae gave after a typed answer. */
  chips?: string[];
  streaming?: boolean;
}

export interface SFile {
  name: string;
  /** Text content for text files, cut short; empty for others. */
  text: string;
}

export interface Session {
  id: string;
  kind: string;
  tpl: string | null;
  /** True once they picked a template or Custom. */
  started: boolean;
  /** Index into stepsFor(); steps.length means all asked. */
  step: number;
  picks: Picks;
  /** Spec lines from what they typed (Eumae pulls them out) or added by hand. */
  extra: string[];
  files: SFile[];
  msgs: SMsg[];
  fileId?: string;
  title: string;
  at: number;
}

const KEY = 'eumae:studioChats';
const EVT = 'eumae:studioChats';

function load(): Session[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((x) => x && typeof x.id === 'string' && KINDS[x.kind]) : [];
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

export const STUDIO_CHATS_EVENT = EVT;

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

export function newSession(kind: Kind, tpl?: string | null, seed?: string): Session {
  const s: Session = {
    id: 'sc' + Date.now().toString(36),
    kind: kind.n,
    tpl: null,
    started: false,
    step: 0,
    picks: {},
    extra: [],
    files: [],
    msgs: [
      {
        id: mid(),
        who: 'e',
        step: 'start',
        text: `Let's make ${a(kind.n)}. Start from one of these, or just tell me your idea in your own words.`,
      },
    ],
    title: kind.n,
    at: Date.now(),
  };
  if (tpl !== undefined || seed) {
    return startWith(s, tpl ?? null, seed);
  }
  return s;
}

/** "a slides" -> "slides", "an app". */
export function a(kindName: string): string {
  const k = kindName.toLowerCase();
  return /s$/.test(k) ? k : (/^[aeiou]/.test(k) ? 'an ' : 'a ') + k;
}

export function kindOfSession(s: Session): Kind {
  return KINDS[s.kind];
}

export function tplOf(s: Session): Template | null {
  return s.tpl ? kindOfSession(s).templates.find((t) => t.n === s.tpl) ?? null : null;
}

export function stepsOf(s: Session): Step[] {
  /* No Describe step here: typing your idea IS describing it. */
  return stepsFor(kindOfSession(s), false);
}

/** Pick a template (or Custom = null) and ask the first unanswered question. */
export function startWith(s: Session, tpl: string | null, seed?: string): Session {
  const kd = kindOfSession(s);
  const t = tpl ? kd.templates.find((x) => x.n === tpl) ?? null : null;
  const picks: Picks = { ...(t?.preset ?? {}), ...s.picks, ...(seed ? { describe: seed } : {}) };
  const msgs = [...s.msgs, { id: mid(), who: 'u' as const, text: seed ? seed : t ? t.n : 'Custom' }];
  const next: Session = { ...s, tpl: t ? t.n : null, started: true, picks, msgs, title: t ? t.n : seed ? seed.slice(0, 60) : `Custom ${kd.n.toLowerCase()}` };
  return askNext({ ...next, step: 0 });
}

/** Move to the next question nobody answered yet, and ask it. */
export function askNext(s: Session): Session {
  const steps = stepsOf(s);
  let i = s.step;
  while (i < steps.length && has(s.picks[steps[i].id])) i += 1;
  if (i >= steps.length) {
    return {
      ...s,
      step: steps.length,
      msgs: [...s.msgs, { id: mid(), who: 'e', text: 'That covers it. Tap Make it when you are ready, or keep telling me details: how it works, the real content, anything it must do.' }],
    };
  }
  const st = steps[i];
  return { ...s, step: i, msgs: [...s.msgs, { id: mid(), who: 'e', step: st.id, text: `${st.q} ${st.tip}` }] };
}

/** Jump to a question (tap a step on the spec), even an answered one. */
export function askStep(s: Session, id: StepId): Session {
  const steps = stepsOf(s);
  const i = steps.findIndex((x) => x.id === id);
  if (i < 0) return s;
  const st = steps[i];
  return { ...s, step: i, msgs: [...s.msgs, { id: mid(), who: 'e', step: st.id, text: `${st.q} ${st.tip}` }] };
}

function has(v: string | string[] | undefined): boolean {
  return Array.isArray(v) ? v.length > 0 : !!(v && v.trim());
}

/** One pill tapped on a one-answer question: record it and move on. */
export function answer(s: Session, step: StepId, label: string): Session {
  const picks = { ...s.picks, [step]: label };
  const msgs = [...s.msgs, { id: mid(), who: 'u' as const, text: label }];
  return askNext({ ...s, picks, msgs });
}

/** A pill toggled on a pick-several question. */
export function toggle(s: Session, step: StepId, label: string): Session {
  const cur = Array.isArray(s.picks[step]) ? (s.picks[step] as string[]) : [];
  const nextList = cur.includes(label) ? cur.filter((x) => x !== label) : [...cur, label];
  return { ...s, picks: { ...s.picks, [step]: nextList } };
}

/** Done on a pick-several question (or skip a question). */
export function doneMulti(s: Session, step: StepId): Session {
  const v = s.picks[step];
  const said = Array.isArray(v) && v.length ? v.join(', ') : 'Skip';
  const picks = Array.isArray(v) && v.length ? s.picks : { ...s.picks, [step]: 'Skip' };
  return askNext({ ...s, picks, step: s.step, msgs: [...s.msgs, { id: mid(), who: 'u', text: said }] });
}

export function skip(s: Session, step: StepId): Session {
  return askNext({ ...s, picks: { ...s.picks, [step]: 'Skip' }, msgs: [...s.msgs, { id: mid(), who: 'u', text: 'Skip' }] });
}

/** The spec as sections, for the card. Skipped answers stay out. */
export function specOf(s: Session): { h: string; lines: { text: string; step?: StepId; extra?: number }[] }[] {
  const kd = kindOfSession(s);
  const t = tplOf(s);
  const val = (id: StepId) => {
    const v = s.picks[id];
    const x = Array.isArray(v) ? v.join(', ') : v || '';
    return x === 'Skip' ? '' : x;
  };
  const L = (id: StepId, label?: string) => {
    const v = val(id);
    return v ? [{ text: label ? `${label}: ${v}` : v, step: id }] : [];
  };
  const listOf = (id: StepId) => {
    const v = s.picks[id];
    return (Array.isArray(v) ? v : v && v !== 'Skip' ? [v] : []).filter((x) => x !== 'Skip').map((x) => ({ text: x, step: id }));
  };
  return [
    { h: 'What it is', lines: [{ text: t ? `${kd.n}: ${t.n} (${t.d.toLowerCase()})` : `${kd.n} (custom)` }, ...L('describe'), ...L('for', 'For'), ...L('purpose', 'Goal')] },
    { h: 'What it does', lines: [...listOf('does'), ...s.extra.map((x, i) => ({ text: x, extra: i }))] },
    { h: 'Content', lines: [...listOf('must'), ...s.files.map((f) => ({ text: `File: ${f.name}` }))] },
    { h: 'Look and feel', lines: [...L('style', 'Style'), ...L('colors', 'Colors'), ...L('length', 'Size'), ...L('tone', 'Tone')] },
  ];
}

/** Everything the builder needs, as one detailed ask. */
export function briefOfSession(s: Session): string {
  const parts = specOf(s)
    .filter((sec) => sec.lines.length)
    .map((sec) => `${sec.h}:\n${sec.lines.map((l) => '- ' + l.text).join('\n')}`);
  const files = s.files
    .filter((f) => f.text)
    .map((f) => `\nFile "${f.name}":\n${f.text.slice(0, 4000)}`)
    .join('\n');
  return `Make ${a(s.kind)} from this spec. Build exactly what it says; where it is silent, choose what fits best.\n\n${parts.join('\n\n')}${files}`;
}

export function specCount(s: Session): number {
  return specOf(s).reduce((n, sec) => n + sec.lines.length, 0) - 1;
}

/** Pull the ```spec JSON out of Eumae's follow-up reply. */
export function parseSpecReply(text: string): { say: string; add: string[]; chips: string[] } {
  const m = text.match(/```spec\s*([\s\S]*?)(```|$)/i);
  const say = text.replace(/```spec[\s\S]*$/i, '').trim();
  if (!m) return { say, add: [], chips: [] };
  try {
    const j = JSON.parse(m[1].trim());
    const arr = (x: unknown) => (Array.isArray(x) ? x.filter((y) => typeof y === 'string' && y.trim()).map((y: string) => y.trim()) : []);
    return { say, add: arr(j.add).slice(0, 8), chips: arr(j.chips).slice(0, 5) };
  } catch {
    return { say, add: [], chips: [] };
  }
}

/** While it streams: hide the spec block. */
export function hideSpec(text: string): string {
  return text.replace(/```spec[\s\S]*$/i, '').trim();
}
