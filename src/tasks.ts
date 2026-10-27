/* Tasks: what the day asks of you.
 *
 * Fields follow the mockup's SEED (`tasks:[{id,t,d}]` — id, text, done) plus
 * the scheduling the mockup's own task page implies (due date/time, estimate,
 * repeat): Eumae schedules, so a task that cannot hold a time is a dead row.
 * The Tasks full page adds the mockup's pgTasks shape: `list` (which list it
 * belongs to), `pr` (priority flag), `sub` (subtasks with their own done).
 * Old rows predate all three and normalize to inbox/none/empty.
 *
 * Example seeds carry `example: true` and the list keeps them until you tell
 * it otherwise: the mockup's paths (brief card, widgets, To-do) only exist
 * with rows in them, and bare empties would hide the very paths this
 * migration is meant to show. Delete them like any row when live data lands.
 */

export type TaskPriority = 'none' | 'important' | 'urgent' | 'critical';

export interface Subtask {
  t: string;
  d: 0 | 1;
}

/** A checklist line: plain text and a tick. No date, priority or owner —
 *  that is what subtasks are for (his call, Oct 26). */
export interface CheckItem {
  t: string;
  d: boolean;
}

export interface TaskList {
  id: string;
  n: string;
}

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
  /** Weekly repeat: days of week 0-6. Empty = the due date's weekday. */
  repDays?: number[];
  /** Last date it repeats, YYYY-MM-DD. */
  repUntil?: string;
  /** Which list — the mockup's t.list, default inbox. */
  list?: string;
  /** Priority — the mockup's t.pr, default none. */
  pr?: TaskPriority;
  /** Subtasks — the mockup's t.sub, default empty. */
  sub?: Subtask[];
  /** Checklist — plain tick lines, separate from subtasks. Absent on old rows. */
  cl?: CheckItem[];
  /** True for a labeled example seed — see above. Never synced anywhere. */
  example?: boolean;
  /** ms since epoch. */
  createdAt: number;
}

const KEY = 'eumae:tasks';
const LISTS_KEY = 'eumae:taskLists';

const PRIORITIES: TaskPriority[] = ['none', 'important', 'urgent', 'critical'];

let cache: Task[] | null = null;
let listsCache: TaskList[] | null = null;

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

function isSubtask(s: unknown): s is Subtask {
  if (!s || typeof s !== 'object') return false;
  const o = s as Record<string, unknown>;
  return typeof o.t === 'string' && (o.d === 0 || o.d === 1);
}

function isCheckItem(c: unknown): c is CheckItem {
  if (!c || typeof c !== 'object') return false;
  const o = c as Record<string, unknown>;
  return typeof o.t === 'string' && typeof o.d === 'boolean';
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
    (o.list === undefined || typeof o.list === 'string') &&
    (o.pr === undefined || PRIORITIES.includes(o.pr as TaskPriority)) &&
    (o.sub === undefined || (Array.isArray(o.sub) && o.sub.every(isSubtask))) &&
    (o.cl === undefined || (Array.isArray(o.cl) && o.cl.every(isCheckItem))) &&
    typeof o.createdAt === 'number'
  );
}

/* Old rows predate list/pr/sub — normalize on the way out, never crash. */
function normalize(t: Task): Task {
  return {
    ...t,
    list: typeof t.list === 'string' ? t.list : 'inbox',
    pr: t.pr && PRIORITIES.includes(t.pr) ? t.pr : 'none',
    sub: Array.isArray(t.sub) ? t.sub.filter(isSubtask) : [],
    ...(Array.isArray(t.cl) ? { cl: t.cl.filter(isCheckItem) } : {}),
  };
}

export function getTasks(): Task[] {
  return load().map(normalize);
}

export function getTask(id: string): Task | undefined {
  const t = load().find((t) => t.id === id);
  return t ? normalize(t) : undefined;
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
    list: 'inbox',
    pr: 'none',
    sub: [],
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

/* Priority cycles none → important → urgent → critical → none — the
   mockup's prCycle. */
export function cyclePriority(id: string): TaskPriority | null {
  const task = getTask(id);
  if (!task) return null;
  const next = PRIORITIES[(PRIORITIES.indexOf(task.pr ?? 'none') + 1) % PRIORITIES.length];
  saveTask({ ...task, pr: next });
  return next;
}

export function toggleSubtask(id: string, index: number): void {
  const task = getTask(id);
  if (!task || !task.sub || !task.sub[index]) return;
  const sub = task.sub.map((s, i) => (i === index ? { ...s, d: (s.d ? 0 : 1) as 0 | 1 } : s));
  saveTask({ ...task, sub });
}

export function addSubtask(id: string, t: string): void {
  const task = getTask(id);
  const name = t.trim();
  if (!task || !name) return;
  saveTask({ ...task, sub: [...(task.sub ?? []), { t: name, d: 0 }] });
}

/* Checklist: plain tick lines. Each helper returns false when nothing
   changed, so the caller only shows the Undo pill for a real change. */
function setCl(id: string, f: (cl: CheckItem[]) => CheckItem[] | null): boolean {
  const task = getTask(id);
  if (!task) return false;
  const next = f((task.cl ?? []).map((c) => ({ ...c })));
  if (!next) return false;
  const t2: Task = { ...task };
  if (next.length) t2.cl = next;
  else delete t2.cl;
  saveTask(t2);
  return true;
}

export function setChecklist(id: string, lines: string[]): boolean {
  return setCl(id, () => lines.map((t) => t.trim()).filter(Boolean).map((t) => ({ t, d: false })));
}

export function toggleCheck(id: string, index: number): boolean {
  return setCl(id, (cl) => (cl[index] ? cl.map((c, i) => (i === index ? { ...c, d: !c.d } : c)) : null));
}

export function addCheck(id: string, t: string): boolean {
  const name = t.trim();
  return setCl(id, (cl) => (name ? [...cl, { t: name, d: false }] : null));
}

export function renameCheck(id: string, index: number, t: string): boolean {
  const name = t.trim();
  return setCl(id, (cl) => (cl[index] && name && cl[index].t !== name ? cl.map((c, i) => (i === index ? { ...c, t: name } : c)) : null));
}

export function deleteCheck(id: string, index: number): boolean {
  return setCl(id, (cl) => (cl[index] ? cl.filter((_, i) => i !== index) : null));
}

/** "2/5" for a task with a checklist, '' without one. */
export function checkCount(task: Task): string {
  const cl = task.cl ?? [];
  return cl.length ? `${cl.filter((c) => c.d).length}/${cl.length}` : '';
}

/* Lists — the mockup's S.lists, seeded inbox + work. */
function seedLists(): TaskList[] {
  return [
    { id: 'inbox', n: 'Inbox' },
    { id: 'work', n: 'Work' },
  ];
}

function loadLists(): TaskList[] {
  if (listsCache) return listsCache;
  try {
    const raw = localStorage.getItem(LISTS_KEY);
    if (!raw) {
      listsCache = seedLists();
      return listsCache;
    }
    const parsed = JSON.parse(raw);
    listsCache = Array.isArray(parsed)
      ? parsed.filter(
          (l): l is TaskList => !!l && typeof l === 'object' && typeof (l as TaskList).id === 'string' && typeof (l as TaskList).n === 'string',
        )
      : seedLists();
    return listsCache;
  } catch {
    listsCache = seedLists();
    return listsCache;
  }
}

function saveLists(lists: TaskList[]): void {
  listsCache = lists;
  try {
    localStorage.setItem(LISTS_KEY, JSON.stringify(lists));
  } catch {
    /* Non-fatal. */
  }
}

export function getLists(): TaskList[] {
  return [...loadLists()];
}

export function addList(n: string): TaskList | null {
  const name = n.trim();
  if (!name) return null;
  const list: TaskList = {
    id: `l${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
    n: name.slice(0, 48),
  };
  saveLists([...loadLists(), list]);
  return list;
}

export function renameSubtask(id: string, index: number, t: string): void {
  const task = getTask(id);
  const name = t.trim();
  if (!task || !task.sub || !task.sub[index] || !name) return;
  saveTask({ ...task, sub: task.sub.map((s, i) => (i === index ? { ...s, t: name } : s)) });
}

export function deleteSubtask(id: string, index: number): void {
  const task = getTask(id);
  if (!task || !task.sub || !task.sub[index]) return;
  saveTask({ ...task, sub: task.sub.filter((_, i) => i !== index) });
}

export function renameList(id: string, n: string): void {
  const name = n.trim().slice(0, 48);
  if (!name) return;
  saveLists(loadLists().map((l) => (l.id === id ? { ...l, n: name } : l)));
}

/* The first list is the default home for tasks and is never deleted; a
   deleted list's tasks move there rather than vanish. Returns false when
   the list could not be deleted. */
export function deleteList(id: string): boolean {
  const lists = loadLists();
  if (lists.length <= 1 || lists[0].id === id || !lists.some((l) => l.id === id)) return false;
  const home = lists[0].id;
  saveLists(lists.filter((l) => l.id !== id));
  save(load().map((t) => ((t.list ?? 'inbox') === id ? { ...t, list: home } : t)));
  return true;
}

/* Undo: snapshot both stores before a delete, put them back on Undo. */
export interface TasksSnapshot {
  tasks: Task[];
  lists: TaskList[];
}

export function snapshotTasks(): TasksSnapshot {
  return { tasks: JSON.parse(JSON.stringify(load())), lists: JSON.parse(JSON.stringify(loadLists())) };
}

export function restoreTasks(s: TasksSnapshot): void {
  save(s.tasks);
  saveLists(s.lists);
}
