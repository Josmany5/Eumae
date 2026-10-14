/* Goals: the long game. Fields follow the mockup's Goals page
 * (`{id,t,d,st,td}` — title, detail, status, target date). Example seeds are
 * the mockup's own rows, labeled until live data replaces them.
 */

export type GoalStatus = 'not-started' | 'in-progress' | 'completed';

export interface Goal {
  id: string;
  t: string;
  d: string;
  st: GoalStatus;
  /** Target date, YYYY-MM-DD. Empty means none. */
  td: string;
  /** True for a labeled example seed. Never synced anywhere. */
  example?: boolean;
  /** ms since epoch. */
  createdAt: number;
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
    (o.st === 'not-started' || o.st === 'in-progress' || o.st === 'completed') &&
    typeof o.td === 'string' &&
    typeof o.createdAt === 'number'
  );
}

export function getGoals(): Goal[] {
  return [...load()];
}

export function saveGoal(goal: Goal): void {
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
