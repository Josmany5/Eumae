/* Habits, routines and flows (his definitions, Oct 21):
 *
 *  - HABIT: one repeated action that needs reinforcement. Set days, a check
 *    a day, a streak.
 *  - ROUTINE: something you want to do, organized into steps (a checklist on
 *    a schedule: a morning, a closing shift).
 *  - FLOW: a way of working the person does to get things done (brain dump,
 *    weekly review, deep work, delegate). Eumae never runs these on its own;
 *    the person starts one and walks its steps.
 *
 * The store keeps the old name and key (`eumae:flows`) so saved lists load as
 * they are. A schedule is real data now (days 0-6 + an optional "HH:MM");
 * `w` is the readable label, rebuilt on every save for anything that still
 * reads it. Checks belong to a day (`doneOn`), so they clear by themselves
 * the next morning, and the streak is counted from `hist`, the days that were
 * actually finished, never a stored number.
 */

export type FlowKind = 'habit' | 'routine' | 'flow';

export interface Flow {
  id: string;
  /** Name, e.g. "Weekly review". */
  n: string;
  /** Readable schedule label ("Weekdays · 7:00 AM", "On demand"). Derived. */
  w: string;
  kind: FlowKind;
  /** Days of the week it's meant for, 0 = Sunday. Empty: any day (habits,
   *  routines) or on demand (flows). */
  days: number[];
  /** Optional time of day, "HH:MM". */
  tm?: string;
  /** Kept for old data; nothing here switches a flow off any more. */
  on: 0 | 1;
  steps: string[];
  /** Step indexes checked on `doneOn`. Another day: treat as empty. */
  done: number[];
  /** The day `done` belongs to, YYYY-MM-DD (local). */
  doneOn?: string;
  /** Days it was finished (all steps, or the habit checked), YYYY-MM-DD. */
  hist: string[];
  /** Legacy stored streak from the old seeds. Ignored; see flowStreak. */
  streak?: number;
  /** True for a labeled example. Never synced anywhere. */
  example?: boolean;
  /** ms since epoch. */
  createdAt: number;
}

export const KIND_LABEL: Record<FlowKind, string> = { habit: 'Habit', routine: 'Routine', flow: 'Flow' };

const KEY = 'eumae:flows';
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

let cache: Flow[] | null = null;

/* ── Dates (local, YYYY-MM-DD) ── */
function ymdOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function todayYmd(): string {
  return ymdOf(new Date());
}

/* ── Schedule ── */
export function fmt12(t: string): string {
  const [h, m] = t.split(':').map(Number);
  if (!Number.isFinite(h)) return t;
  return `${h % 12 || 12}:${String(m || 0).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** "Weekdays", "Daily", "Mon, Wed, Fri", "On demand". */
export function daysLabel(kind: FlowKind, days: number[]): string {
  const d = [...new Set(days)].filter((x) => x >= 0 && x <= 6).sort();
  const key = d.join('');
  if (!d.length || key === '0123456') return !d.length && kind === 'flow' ? 'On demand' : 'Daily';
  if (key === '12345') return 'Weekdays';
  if (key === '06') return 'Weekends';
  return d.map((i) => DAY[i]).join(', ');
}

/** "Weekdays · 7:00 AM", "On demand". */
export function scheduleLabel(f: Pick<Flow, 'kind' | 'days' | 'tm'>): string {
  const d = daysLabel(f.kind, f.days);
  return f.tm ? `${d} · ${fmt12(f.tm)}` : d;
}

/** Old free-text schedules ("Weekdays 7:00 AM", "Manual") → days + time. */
function parseWhen(w: string): { days: number[]; tm?: string } {
  const s = (w || '').toLowerCase();
  if (!s || s.startsWith('manual') || s.startsWith('on demand')) return { days: [] };
  let days: number[] = [];
  if (/daily|every ?day/.test(s)) days = [0, 1, 2, 3, 4, 5, 6];
  else if (/weekdays/.test(s)) days = [1, 2, 3, 4, 5];
  else if (/weekends/.test(s)) days = [0, 6];
  else DAY.forEach((d, i) => s.includes(d.toLowerCase()) && days.push(i));
  let tm: string | undefined;
  const m = s.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/) ?? s.match(/(\d{1,2}):(\d{2})/);
  if (m) {
    let h = +m[1] % 24;
    if (m[3] === 'pm' && h < 12) h += 12;
    if (m[3] === 'am' && h === 12) h = 0;
    tm = `${String(h).padStart(2, '0')}:${m[2] ?? '00'}`;
  }
  return { days, tm };
}

/** Is it meant for this day? Empty days: every day. */
export function isScheduledOn(f: Pick<Flow, 'days'>, d: Date): boolean {
  return !f.days.length || f.days.includes(d.getDay());
}

/* ── Today ── */
/** Step indexes checked today. A check from another day doesn't count. */
export function doneToday(f: Flow): number[] {
  if (f.doneOn !== todayYmd()) return [];
  return f.done.filter((i) => i >= 0 && i < f.steps.length);
}

/** Finished today: the habit is checked, or every step is. */
export function isDoneToday(f: Flow): boolean {
  return f.hist.includes(todayYmd());
}

/** Consecutive scheduled days finished, counting back from today. Today
 *  counts when it's done; while it's still open it doesn't break the run.
 *  Days it isn't scheduled for are skipped. On-demand flows have no streak
 *  (0): there's no day they were due. */
export function flowStreak(f: Flow): number {
  if (f.kind === 'flow' && !f.days.length) return 0;
  const hist = new Set(f.hist);
  const d = new Date();
  let n = 0;
  if (hist.has(ymdOf(d))) n++;
  for (let i = 0; i < 800; i++) {
    d.setDate(d.getDate() - 1);
    if (!isScheduledOn(f, d)) continue;
    if (hist.has(ymdOf(d))) n++;
    else break;
  }
  return n;
}

/** "4-day streak", "Done 3 times", "" (nothing yet). */
export function streakLabel(f: Flow): string {
  if (f.kind === 'flow' && !f.days.length) return f.hist.length ? `Done ${f.hist.length} time${f.hist.length === 1 ? '' : 's'}` : '';
  const s = flowStreak(f);
  return s ? `${s}-day streak` : '';
}

/** Last finished day, or undefined. */
export function lastDone(f: Flow): string | undefined {
  return [...f.hist].sort().pop();
}

/* ── Load / save ── */
function load(): Flow[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    cache = Array.isArray(parsed) ? parsed.filter(isFlow).map(normalize).filter(notOldSeed) : [];
  } catch {
    cache = [];
  }
  return cache;
}

/* The two old seeds (Morning brief, Shutdown ritual) said Eumae runs them,
   which it doesn't. Untouched copies are dropped; edited ones were already
   un-marked and stay. */
function notOldSeed(f: Flow): boolean {
  return !(f.example && (f.id === 'brief' || f.id === 'shut'));
}

/** Old rows (no days/hist, free-text `w`) → the current shape. */
function normalize(f: Flow): Flow {
  const o = f as Flow & Record<string, unknown>;
  const fromW = Array.isArray(o.days) ? null : parseWhen(o.w);
  const days = (fromW ? fromW.days : (o.days as unknown[]).filter((x): x is number => typeof x === 'number' && x >= 0 && x <= 6)).sort();
  const tm = fromW ? fromW.tm : typeof o.tm === 'string' && /^\d{2}:\d{2}$/.test(o.tm) ? o.tm : undefined;
  const hist = Array.isArray(o.hist) ? (o.hist as unknown[]).filter((x): x is string => typeof x === 'string') : [];
  const out: Flow = {
    ...f,
    days,
    hist,
    steps: f.steps.filter((s) => typeof s === 'string'),
    done: f.done.filter((i) => typeof i === 'number'),
    on: f.on === 0 ? 0 : 1,
  };
  if (tm) out.tm = tm;
  else delete out.tm;
  delete out.streak;
  out.w = scheduleLabel(out);
  return out;
}

function save(flows: Flow[]): void {
  cache = flows;
  try {
    localStorage.setItem(KEY, JSON.stringify(flows));
  } catch {
    /* Storage full — in-memory still works. */
  }
}

/** Accepts old rows too ('routine'/'flow', free-text `w`, a stored streak). */
export function isFlow(f: unknown): f is Flow {
  if (!f || typeof f !== 'object') return false;
  const o = f as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.n === 'string' &&
    (typeof o.w === 'string' || Array.isArray(o.days)) &&
    (o.kind === 'habit' || o.kind === 'routine' || o.kind === 'flow') &&
    Array.isArray(o.steps) &&
    Array.isArray(o.done) &&
    typeof o.createdAt === 'number'
  );
}

export function getFlows(): Flow[] {
  return [...load()];
}

export function getFlow(id: string): Flow | undefined {
  return load().find((f) => f.id === id);
}

export function saveFlow(flow: Flow): void {
  const flows = load();
  const next = normalize({ ...flow, days: [...(flow.days ?? [])], hist: [...(flow.hist ?? [])] });
  const i = flows.findIndex((f) => f.id === flow.id);
  if (i >= 0) flows[i] = next;
  else flows.push(next);
  save(flows);
}

export function createFlow(n: string, kind: FlowKind = 'flow', init: Partial<Flow> = {}): Flow {
  const now = Date.now();
  const flow: Flow = {
    id: `f${now.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
    n,
    w: '',
    kind,
    days: kind === 'flow' ? [] : [0, 1, 2, 3, 4, 5, 6],
    on: 1,
    steps: [],
    done: [],
    hist: [],
    createdAt: now,
    ...init,
  };
  saveFlow(flow);
  return getFlow(flow.id) ?? flow;
}

export function deleteFlow(id: string): void {
  save(load().filter((f) => f.id !== id));
}

/** Today's history entry follows the checks: on when finished, off when not. */
function withToday(f: Flow, finished: boolean): Flow {
  const t = todayYmd();
  const hist = f.hist.filter((d) => d !== t);
  return { ...f, hist: finished ? [...hist, t] : hist, example: false };
}

/** Set one step's check for today. */
export function setFlowStep(id: string, index: number, on: boolean): void {
  const f = load().find((x) => x.id === id);
  if (!f || index < 0 || index >= f.steps.length) return;
  const cur = doneToday(f);
  const done = on ? [...new Set([...cur, index])] : cur.filter((d) => d !== index);
  saveFlow(withToday({ ...f, done, doneOn: todayYmd() }, f.steps.length > 0 && done.length >= f.steps.length));
}

/* Step toggle: done holds step indexes, for today only. */
export function toggleFlowStep(id: string, index: number): void {
  const f = load().find((x) => x.id === id);
  if (!f) return;
  setFlowStep(id, index, !doneToday(f).includes(index));
}

/** A habit's check for today (also finishes/unfinishes any flow outright). */
export function toggleFlowToday(id: string): void {
  const f = load().find((x) => x.id === id);
  if (!f) return;
  saveFlow(withToday(f, !isDoneToday(f)));
}

export function toggleFlowOn(id: string): void {
  const f = load().find((x) => x.id === id);
  if (!f) return;
  saveFlow({ ...f, on: f.on ? 0 : 1 });
}

/* ── Starters: ready-made ones the person adds with one tap. Not in the
   list until added, so nothing implies they're already running. ── */
export interface Starter {
  key: string;
  n: string;
  kind: FlowKind;
  days: number[];
  tm?: string;
  steps: string[];
  /** One line on what it's for. */
  u: string;
}

export const STARTERS: Starter[] = [
  {
    key: 'braindump',
    n: 'Brain dump',
    kind: 'flow',
    days: [],
    u: 'Get everything out of your head so you can see it.',
    steps: [
      'Write down everything on your mind, big or small',
      'Cross out what no longer matters',
      'Turn each real to-do into a task',
      'Pick the one thing that matters most today',
    ],
  },
  {
    key: 'weekly',
    n: 'Weekly review',
    kind: 'flow',
    days: [5],
    tm: '16:00',
    u: 'Close out the week and set up the next one.',
    steps: [
      'Empty your inboxes and notes into one list',
      'Look back at this week: what got done, what slipped',
      'Check your calendar for the next two weeks',
      'Review your goals and projects',
      'Choose three priorities for next week',
    ],
  },
  {
    key: 'deep',
    n: 'Deep work',
    kind: 'flow',
    days: [],
    u: 'One block of focused work on one thing.',
    steps: [
      'Pick one task and write what done looks like',
      'Close messages and silence your phone',
      'Work on it without switching',
      'Write down where you stopped and the next step',
    ],
  },
  {
    key: 'delegate',
    n: 'Delegate',
    kind: 'flow',
    days: [],
    u: 'Hand something off so it gets done without you.',
    steps: [
      'Name what you want done and why it matters',
      'Choose who should own it',
      'Say what done looks like and by when',
      'Agree on how they will check in',
      'Put a follow-up on your calendar',
    ],
  },
  {
    key: 'morning',
    n: 'Morning routine',
    kind: 'routine',
    days: [1, 2, 3, 4, 5],
    tm: '07:00',
    u: 'A steady start before the day pulls at you.',
    steps: ['Drink a glass of water', 'Stretch for five minutes', "Look at today's calendar", 'Pick your one thing for today'],
  },
  {
    key: 'water',
    n: 'Drink water',
    kind: 'habit',
    days: [0, 1, 2, 3, 4, 5, 6],
    u: 'Eight glasses, every day.',
    steps: [],
  },
  {
    key: 'read',
    n: 'Read 10 pages',
    kind: 'habit',
    days: [0, 1, 2, 3, 4, 5, 6],
    tm: '21:00',
    u: 'A little reading, every night.',
    steps: [],
  },
];

/** Add a starter as the person's own (not an example: they chose it). */
export function addStarter(s: Starter): Flow {
  return createFlow(s.n, s.kind, { days: [...s.days], tm: s.tm, steps: [...s.steps] });
}

/* Undo: a deep copy of the store taken before a change; the toast's Undo
   writes it back. Same shape as snapshotTasks / snapshotLibrary. */
export function snapshotFlows(): Flow[] {
  return JSON.parse(JSON.stringify(load()));
}

export function restoreFlows(s: Flow[]): void {
  save(s);
}
