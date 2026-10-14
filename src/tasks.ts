/* Tasks: what the day asks of you.
 *
 * Fields follow the mockup's SEED (`tasks:[{id,t,d}]` — id, text, done) plus
 * the scheduling the mockup's own task page implies (due date/time, estimate,
 * repeat): Eumae schedules, so a task that cannot hold a time is a dead row.
 * Nothing here is invented beyond that — subtasks, lists, Eisenhower flags
 * are the wove repo's later growth, not this migration.
 *
 * Example seeds carry `example: true` and the list keeps them until you tell
 * it otherwise: the mockup's paths (brief card, widgets, To-do) only exist
 * with rows in them, and bare empties would hide the very paths this
 * migration is meant to show. Delete them like any row when live data lands.
 */

export interface Task {
  id: string;
  /** What to do. */
  t: string;
  /** Done: 0 open, 1 done. A number like the mockup, not a boolean. */
  d: 0 | 1;
  /** Due date, YYYY-MM-DD. Absent means someday. */
  due?: string;
  /** Due time, HH:MM 24-hour. Only meaningful beside `due`. */
  tm?: string;
  /** Estimate in minutes. */
  est?: number;
  /** Repeat: none (default), daily, weekly, monthly. */
  rep?: 'none' | 'daily' | 'weekly' | 'monthly';
  /** True for a labeled example seed — see above. Never synced anywhere. */
  example?: boolean;
  /** ms since epoch. */
  createdAt: number;
}

const KEY = 'eumae:tasks';

let cache: Task[] | null = null;

function load(): Task[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      cache = seeds();
      return cache;
    }
    const parsed = JSON.parse(raw);
    cache = Array.isArray(parsed) ? parsed.filter(isTask) : seeds();
    return cache;
  } catch {
    cache = seeds();
    return cache;
  }
}

/* First run starts on the mockup's own rows, labeled examples: the Console's
   brief card, widgets and To-do read these exact three. */
function seeds(): Task[] {
  const now = Date.now();
  return [
    { id: 't1', t: 'Draft YC demo script', d: 0, example: true, createdAt: now },
    { id: 't2', t: 'Call Marcus about Terravita', d: 0, example: true, createdAt: now },
    { id: 't3', t: 'Morning workout', d: 1, example: true, createdAt: now },
  ];
}

function save(tasks: Task[]): void {
  cache = tasks;
  try {
    localStorage.setItem(KEY, JSON.stringify(tasks));
  } catch {
    /* Storage full — in-memory still works. */
  }
}

function isTask(t: unknown): t is Task {
  if (!t || typeof t !== 'object') return false;
  const o = t as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.t === 'string' &&
    (o.d === 0 || o.d === 1) &&
    (o.due === undefined || typeof o.due === 'string') &&
    (o.tm === undefined || typeof o.tm === 'string') &&
    (o.est === undefined || typeof o.est === 'number') &&
    (o.rep === undefined || o.rep === 'none' || o.rep === 'daily' || o.rep === 'weekly' || o.rep === 'monthly') &&
    typeof o.createdAt === 'number'
  );
}

export function getTasks(): Task[] {
  return [...load()];
}

export function getTask(id: string): Task | undefined {
  return load().find((t) => t.id === id);
}

export function saveTask(task: Task): void {
  const tasks = load();
  const i = tasks.findIndex((t) => t.id === task.id);
  if (i >= 0) tasks[i] = task;
  else tasks.push(task);
  save(tasks);
}

export function createTask(t: string): Task {
  const now = Date.now();
  const task: Task = {
    /* Random suffix, like threads/notes/uploads: two creates in the same
       millisecond must never share an id. */
    id: `t${now.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
    t,
    d: 0,
    createdAt: now,
  };
  saveTask(task);
  return task;
}

export function toggleTask(id: string): void {
  const task = getTask(id);
  if (!task) return;
  saveTask({ ...task, d: task.d ? 0 : 1 });
}

export function deleteTask(id: string): void {
  save(load().filter((t) => t.id !== id));
}
