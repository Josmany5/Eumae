import type { Milestone } from './milestones';
import { getTasks } from './tasks';
import { getEvents, attendanceOf } from './events';
import { eventDay } from './due';

/* Goals: the long game. Fields follow the mockup's Goals page
 * (`{id,t,d,st,td}` — title, detail, status, target date). Example seeds are
 * the mockup's own rows, labeled until live data replaces them.
 */

/** 'let-go' = dropped on purpose. The record keeps it, no shame. */
export type GoalStatus = 'not-started' | 'in-progress' | 'completed' | 'let-go';

export interface Goal {
  id: string;
  t: string;
  d: string;
  st: GoalStatus;
  /** Target date, YYYY-MM-DD. Empty means none. */
  td: string;
  /** Dated checkpoints on the way. */
  ms?: Milestone[];
  /** Measure: the number that means done (3 clients, $2,000) and where
   *  you are now. No target means progress comes from milestones. */
  tgt?: number;
  unit?: string;
  cur?: number;
  /** Pace: how many per week or month. Lets the page say "behind" early. */
  pace?: { n: number; per: 'week' | 'month' };
  /** Last change, ms since epoch. */
  upd?: number;
  /** What this goal owns: its own tasks, events and notes (his call, Oct 19).
   *  Separate from projects: an item can sit in a project and a goal at once,
   *  but in only one goal. */
  links?: GoalLink[];
  /** True for a labeled example seed. Never synced anywhere. */
  example?: boolean;
  /** ms since epoch. */
  createdAt: number;
}

export type GoalLinkKind = 'task' | 'event' | 'note';
export interface GoalLink {
  k: GoalLinkKind;
  id: string;
}

const KEY = 'eumae:goals';

let cache: Goal[] | null = null;

function load(): Goal[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      cache = seeds();
      return cache;
    }
    const parsed = JSON.parse(raw);
    cache = Array.isArray(parsed) ? parsed.filter(isGoal) : seeds();
    return cache;
  } catch {
    cache = seeds();
    return cache;
  }
}

/* The mockup's own rows. */
function seeds(): Goal[] {
  const now = Date.now();
  return [
    { id: 'g1', t: 'Ship the YC demo', d: 'November 2 deadline', st: 'in-progress', td: '2026-11-02', example: true, createdAt: now },
    { id: 'g2', t: 'Terravita pitch sent', d: 'First web design client', st: 'not-started', td: '', example: true, createdAt: now },
  ];
}

function save(goals: Goal[]): void {
  cache = goals;
  try {
    localStorage.setItem(KEY, JSON.stringify(goals));
  } catch {
    /* Storage full — in-memory still works. */
  }
}

function isGoal(g: unknown): g is Goal {
  if (!g || typeof g !== 'object') return false;
  const o = g as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.t === 'string' &&
    typeof o.d === 'string' &&
    (o.st === 'not-started' || o.st === 'in-progress' || o.st === 'completed' || o.st === 'let-go') &&
    typeof o.td === 'string' &&
    typeof o.createdAt === 'number'
  );
}

export function getGoals(): Goal[] {
  return [...load()];
}

export function saveGoal(goal: Goal): void {
  goal = { ...goal, upd: Date.now() };
  const goals = load();
  const i = goals.findIndex((g) => g.id === goal.id);
  if (i >= 0) goals[i] = goal;
  else goals.push(goal);
  save(goals);
}

export function createGoal(t: string): Goal {
  const now = Date.now();
  const goal: Goal = {
    id: `g${now.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
    t,
    d: '',
    st: 'not-started',
    td: '',
    createdAt: now,
  };
  saveGoal(goal);
  return goal;
}

export function deleteGoal(id: string): void {
  save(load().filter((g) => g.id !== id));
}

/* Undo: a deep copy of the store taken before a delete; the toast's Undo
   writes it back. Same shape as snapshotTasks / snapshotLibrary. */
export function snapshotGoals(): Goal[] {
  return JSON.parse(JSON.stringify(load()));
}

export function restoreGoals(s: Goal[]): void {
  save(s);
}

/** Still being worked on (not done, not let go). */
export function isActiveGoal(g: Goal): boolean {
  return g.st === 'not-started' || g.st === 'in-progress';
}

/** Percent done, counted, never guessed: the measure when there is one,
 *  else finished milestones. */
export function goalPct(g: Goal): number {
  if (g.st === 'completed') return 100;
  /* Past the target shows the real number (120%); bars clamp their own width. */
  if (g.tgt && g.tgt > 0) return Math.max(0, Math.round(((g.cur ?? 0) / g.tgt) * 100));
  const { done, total } = goalSteps(g);
  return total ? Math.round((done / total) * 100) : 0;
}

/** With no measure, a goal moves by its steps (his call, Oct 22): milestones,
 *  linked tasks (done) and linked events (Attended is done, Not attended drops
 *  out, unanswered stays open), the same rule projects use. */
export function goalSteps(g: Goal): { done: number; total: number; ms: number; tasks: number; events: number } {
  const ms = g.ms ?? [];
  const links = cleanGoalLinks(g.links);
  const tIds = new Set(links.filter((l) => l.k === 'task').map((l) => l.id));
  const eIds = new Set(links.filter((l) => l.k === 'event').map((l) => l.id));
  const tasks = getTasks().filter((t) => tIds.has(t.id));
  const evAns = getEvents()
    .filter((e) => e.id && eIds.has(e.id))
    .map((e) => attendanceOf(e, eventDay(e)))
    .filter((a) => a !== 'no');
  return {
    done: ms.filter((m) => m.done).length + tasks.filter((t) => t.d).length + evAns.filter((a) => a === 'yes').length,
    total: ms.length + tasks.length + evAns.length,
    ms: ms.length,
    tasks: tasks.length,
    events: evAns.length,
  };
}

/** "3 of 5 clients" / "2 of 4 milestones", or '' with neither. */
export function goalCount(g: Goal): string {
  if (g.tgt && g.tgt > 0) return `${fmtNum(g.cur ?? 0)} of ${fmtNum(g.tgt)}${g.unit ? ' ' + g.unit : ''}`;
  const st = goalSteps(g);
  if (!st.total) return '';
  const word = st.total === st.ms ? 'milestone' : 'step';
  return `${st.done} of ${st.total} ${word}${st.total === 1 ? '' : 's'}`;
}

function fmtNum(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** On track or behind, by plain math. With a pace: where you should be by
 *  now since the goal started. Without one: a straight line from start to
 *  the target date. Undefined when there's nothing to measure against. */
export function goalPace(g: Goal): 'on' | 'behind' | undefined {
  if (!isActiveGoal(g) || !g.tgt) return undefined;
  const cur = g.cur ?? 0;
  const days = (Date.now() - g.createdAt) / 86400000;
  if (days < 1) return undefined;
  let expected: number | undefined;
  if (g.pace && g.pace.n > 0) expected = g.pace.n * (days / (g.pace.per === 'week' ? 7 : 30.44));
  else if (g.td) {
    const end = new Date(g.td + 'T23:59').getTime();
    const span = (end - g.createdAt) / 86400000;
    if (span > 0) expected = g.tgt * Math.min(1, days / span);
  }
  if (expected === undefined) return undefined;
  return cur + 1e-9 >= Math.min(expected, g.tgt) * 0.9 ? 'on' : 'behind';
}

export const GOAL_STATUS_LABEL: Record<GoalStatus, string> = {
  'not-started': 'Not started',
  'in-progress': 'Active',
  completed: 'Done',
  'let-go': 'Archived',
};

/* ───────────── What a goal owns ───────────── */

function cleanGoalLinks(l: unknown): GoalLink[] {
  return Array.isArray(l)
    ? l.filter((x): x is GoalLink => !!x && typeof x === 'object' && (x.k === 'task' || x.k === 'event' || x.k === 'note') && typeof x.id === 'string')
    : [];
}

/** The goal an item belongs to, if any. */
export function goalOf(k: GoalLinkKind, id: string): Goal | undefined {
  return load().find((g) => cleanGoalLinks(g.links).some((l) => l.k === k && l.id === id));
}

export function goalLinkedIds(goalId: string, k: GoalLinkKind): string[] {
  const g = load().find((x) => x.id === goalId);
  return g ? cleanGoalLinks(g.links).filter((l) => l.k === k).map((l) => l.id) : [];
}

/** Put an item under a goal. One goal per item: it leaves any other goal. */
export function linkToGoal(goalId: string, k: GoalLinkKind, id: string): void {
  save(
    load().map((g) => {
      const all = cleanGoalLinks(g.links);
      const rest = all.filter((l) => !(l.k === k && l.id === id));
      if (g.id === goalId) return { ...g, links: [...rest, { k, id }], upd: Date.now() };
      return rest.length !== all.length ? { ...g, links: rest } : g;
    }),
  );
}

export function unlinkFromGoal(k: GoalLinkKind, id: string): void {
  save(load().map((g) => (cleanGoalLinks(g.links).some((l) => l.k === k && l.id === id) ? { ...g, links: cleanGoalLinks(g.links).filter((l) => !(l.k === k && l.id === id)) } : g)));
}
