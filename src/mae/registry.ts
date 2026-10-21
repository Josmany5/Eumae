/* Mae's tool registry: every action Mae can take, with its form, its risk,
 *  how it reads on the plan card, and how it runs.
 *
 *  Rules this file keeps (each one is a bug Wove had):
 *  - Every create takes a LIST, even for one item. There is no singular
 *    create, so a model can never pick "create task" and cram three tasks
 *    into one title.
 *  - Tasks and events are told apart in the descriptions the model reads:
 *    a task is something you FINISH (its time is a deadline); an event is
 *    something that HAPPENS at a time (meeting, class, appointment).
 *  - Fields are Eumae's own (priority word, deadline time, repeat, list,
 *    subtasks with a done check, goal measure and pace, project links), and
 *    each is checked to the bottom of every list by schema.ts.
 *  - Ids must exist. A write naming an id that isn't there is refused before
 *    it reaches the plan card, with a sentence telling Mae how to find it.
 *  - Reads run at once. Writes never run when the model calls them: the
 *    dispatcher stages them on the plan card, and they run on Approve. */

import type { ObjectParam, Param } from './schema';
import { getTasks, getTask, saveTask, createTask, deleteTask, getLists, addList, type Task, type TaskPriority } from '../tasks';
import { getEvents, getEvent, saveEvent, deleteEvent, skipOccurrence, dayEvents, ymd, type CalEvent, type EventType } from '../events';
import { isOverdue, toConfirm } from '../due';
import { getGoals, saveGoal, createGoal, deleteGoal, goalPct, goalCount, isActiveGoal, goalOf, goalLinkedIds, linkToGoal, unlinkFromGoal, type Goal, type GoalStatus, type GoalLinkKind } from '../goals';
import { getProjects, getProject, saveProject, createProject, deleteProject, linkItem, unlinkItem, projectOf, linkedIds, type LinkKind } from '../projects';
import { getNotes, getNote, saveNote, createNote, deleteNote, titleOf, noteText } from '../notes';
import { newMilestone, type Milestone } from '../milestones';

export type Risk = 'read' | 'write' | 'danger';
export type ItemKind = 'task' | 'event' | 'goal' | 'project' | 'note';
export const ITEM_KINDS: readonly ItemKind[] = ['task', 'event', 'goal', 'project', 'note'];
const LINKABLE: readonly LinkKind[] = ['task', 'event', 'goal', 'note'];

/** One line on the plan card: what kind of thing, what happens to it. */
export interface PlanLine {
  kind: 'Task' | 'Event' | 'Goal' | 'Project' | 'Note' | 'List' | 'Subtask' | 'Milestone' | 'Link';
  verb: 'Create' | 'Edit' | 'Complete' | 'Reopen' | 'Move' | 'Add' | 'Log' | 'Link' | 'Unlink' | 'Delete' | 'Skip';
  text: string;
  detail?: string;
  /** What Mae filled in herself, in plain words ("due date, 30 min"). */
  guess?: string;
}

export interface Opened {
  k: 'task' | 'event' | 'goal';
  id: string;
}

export interface Result {
  ok: boolean;
  /** One sentence, for Mae and for the receipt. */
  summary: string;
  data?: unknown;
  error?: string;
  /** Items this action made or changed, so the receipt can open them. */
  touched?: { kind: ItemKind; id: string; title: string }[];
  /** A UI action asked for (open_item). */
  open?: Opened;
}

/** What a plan carries between its steps: refs a create_projects step named,
 *  so a later step in the same plan can put things in that project. */
export interface RunCtx {
  refs: Map<string, string>;
}

/** What staging knows: refs declared by earlier steps of the plan being
 *  built, so `project: "p1"` passes the check before p1 exists. */
export interface StageCtx {
  refs: Set<string>;
}

export interface Action {
  name: string;
  risk: Risk;
  description: string;
  params: ObjectParam;
  /** Checks a form can't express: ids exist, an event has a time, end after start. */
  verify?: (args: Args, ctx: StageCtx) => string | null;
  /** Writes: how the call reads on the plan card. */
  preview?: (args: Args) => PlanLine[];
  /** Refs this step declares (create_projects). */
  declares?: (args: Args) => string[];
  run: (args: Args, ctx: RunCtx) => Result;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Args = Record<string, any>;

/* ───────────────────────── shared pieces ───────────────────────── */

const s = (description: string, extra: Partial<Extract<Param, { type: 'string' }>> = {}): Param => ({ type: 'string', description, ...extra });
const date = (description: string): Param => ({ type: 'string', format: 'date', description });
const time = (description: string): Param => ({ type: 'string', format: 'time', description });
const num = (description: string, extra: Partial<Extract<Param, { type: 'number' }>> = {}): Param => ({ type: 'number', description, ...extra });
const bool = (description: string): Param => ({ type: 'boolean', description });
const list = (description: string, items: Param, extra: { minItems?: number; maxItems?: number } = {}): Param => ({ type: 'array', description, items, ...extra });
const obj = (properties: Record<string, Param>, required: string[] = [], description?: string): ObjectParam => ({ type: 'object', properties, required, description });

const PRIORITIES: readonly TaskPriority[] = ['none', 'important', 'urgent', 'critical'];
const EVENT_TYPES: readonly EventType[] = ['meeting', 'appointment', 'class', 'other'];
const GOAL_STATUSES: readonly GoalStatus[] = ['not-started', 'in-progress', 'completed', 'let-go'];
const REPEATS = ['none', 'daily', 'weekly', 'monthly'] as const;
const KIND_LABEL: Record<ItemKind, PlanLine['kind']> = { task: 'Task', event: 'Event', goal: 'Goal', project: 'Project', note: 'Note' };

const projectField = s('Project to put it in: an existing project id, or the ref of a project created earlier in this same plan (e.g. "p1").');
const goalField = s('Goal it serves: an existing goal id, or the ref of a goal created earlier in this same plan (e.g. "g1"). A goal owns its own tasks, events and notes, separate from projects.');
const GOAL_KINDS: readonly GoalLinkKind[] = ['task', 'event', 'note'];
const milestoneItem = obj({ title: s('Milestone name.', { max: 120 }), date: date('Milestone date, or leave out.') }, ['title']);

const today = () => ymd(new Date());
const plus = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return ymd(d);
};

function fmtDate(d?: string): string {
  if (!d) return '';
  const dt = new Date(d + 'T12:00');
  if (Number.isNaN(dt.getTime())) return d;
  const t = today();
  if (d === t) return 'Today';
  if (d === plus(1)) return 'Tomorrow';
  return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function fmtTime(tm?: string): string {
  if (!tm) return '';
  const m = /^(\d{1,2}):(\d{2})$/.exec(tm);
  if (!m) return tm;
  const h = Number(m[1]);
  return `${h % 12 || 12}${m[2] === '00' ? '' : ':' + m[2]} ${h < 12 ? 'am' : 'pm'}`;
}

/* 5B (his call, Oct 19): people read "7 pm", never "19:00". Tool fields stay
   HH:MM; anything Mae SAYS is put back into a human clock. Skips ranges of
   digits that are not times (ratios like 3:2 stay, since the minutes must be
   two digits) and anything already followed by am/pm. */
export function humanTimes(text: string): string {
  return text.replace(/(^|[^\d:])([01]?\d|2[0-3]):([0-5]\d)(?!\d|:\d)(?!\s?(?:[aApP]\.?[mM]\b))/g, (_m, pre, hh, mm) => {
    const h = Number(hh);
    return `${pre}${h % 12 || 12}${mm === '00' ? '' : ':' + mm} ${h < 12 ? 'am' : 'pm'}`;
  });
}

const GUESS_WORD: Record<string, string> = { due: 'due date', time: 'time', estimate: 'how long', priority: 'priority', repeat: 'repeat', date: 'date', start: 'start time', end: 'end time', target_date: 'target date', target: 'target', pace: 'pace', milestones: 'milestones', location: 'place', subtasks: 'steps', list: 'list', type: 'type' };
function guessOf(x: Args): string | undefined {
  const g: string[] = Array.isArray(x.guessed) ? x.guessed.filter((k: unknown) => typeof k === 'string' && x[k as string] !== undefined && x[k as string] !== '') : [];
  return g.length ? [...new Set(g.map((k) => GUESS_WORD[k] ?? k.replace(/_/g, ' ')))].join(', ') : undefined;
}

const join = (...parts: (string | false | undefined | null)[]) => parts.filter(Boolean).join(' · ');
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

function esc(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** A note body from plain text: the title as the first block, then one block
 *  per paragraph — the shape the note editor writes. */
function noteHtml(title: string, body?: string): string {
  const paras = (body ?? '').split(/\n{2,}|\r?\n/).map((p) => p.trim()).filter(Boolean);
  return [`<div>${esc(title)}</div>`, ...paras.map((p) => `<div>${esc(p)}</div>`)].join('');
}

function titleOfKind(kind: ItemKind, id: string): string | undefined {
  switch (kind) {
    case 'task':
      return getTask(id)?.t;
    case 'event':
      return getEvent(id)?.t;
    case 'goal':
      return getGoals().find((g) => g.id === id)?.t;
    case 'project':
      return getProject(id)?.n;
    case 'note': {
      const n = getNote(id);
      return n ? titleOf(n) : undefined;
    }
  }
}

function exists(kind: ItemKind, id: string): boolean {
  return titleOfKind(kind, id) !== undefined;
}

function missing(kind: ItemKind, id: string): string {
  return `No ${kind} with id "${id}". Find the right id with search_items or list_items; never guess one.`;
}

function checkProject(p: unknown, ctx: StageCtx, at: string): string | null {
  if (p === undefined || p === null || p === '') return null;
  const id = String(p);
  if (ctx.refs.has(id) || getProject(id)) return null;
  return `${at}: no project "${id}". Use an existing project id, or create_projects with that ref earlier in this plan.`;
}

function checkGoal(g: unknown, ctx: StageCtx, at: string): string | null {
  if (g === undefined || g === null || g === '') return null;
  const id = String(g);
  if (ctx.refs.has(id) || getGoals().some((x) => x.id === id)) return null;
  return `${at}: no goal "${id}". Use an existing goal id, or create_goals with that ref earlier in this plan.`;
}

function resolveGoal(g: unknown, ctx: RunCtx): string | undefined {
  if (g === undefined || g === null || g === '') return undefined;
  const id = String(g);
  return ctx.refs.get(id) ?? (getGoals().some((x) => x.id === id) ? id : undefined);
}

function resolveProject(p: unknown, ctx: RunCtx): string | undefined {
  if (p === undefined || p === null || p === '') return undefined;
  const id = String(p);
  return ctx.refs.get(id) ?? (getProject(id) ? id : undefined);
}

function resolveList(v: unknown): string | null {
  if (v === undefined || v === null || v === '') return 'inbox';
  const want = String(v).trim().toLowerCase();
  const l = getLists().find((x) => x.id.toLowerCase() === want || x.n.toLowerCase() === want);
  return l ? l.id : null;
}

function listError(v: unknown, at: string): string | null {
  if (resolveList(v) !== null) return null;
  return `${at}: no task list "${v}". Lists: ${getLists().map((l) => l.n).join(', ')}. Use create_list first if a new one is wanted.`;
}

function weekdays(v: unknown): number[] | undefined {
  return Array.isArray(v) && v.length ? [...new Set(v.map(Number))].sort() : undefined;
}

function milestones(v: unknown): Milestone[] | undefined {
  if (!Array.isArray(v) || !v.length) return undefined;
  return v.map((m: Args) => newMilestone(String(m.title).trim(), m.date ?? ''));
}

/* ───────────────────────── reads ───────────────────────── */

const taskRow = (t: Task) => ({ id: t.id, title: t.t, done: !!t.d, due: t.due, time: t.tm, priority: t.pr, list: t.list, project: projectOf('task', t.id)?.n, goal: goalOf('task', t.id)?.t });
const eventRow = (e: CalEvent) => ({ id: e.id, title: e.t, date: e.d, start: e.allDay ? undefined : e.tm, end: e.end, all_day: !!e.allDay, repeats: e.rep?.f, location: e.loc, goal: e.id ? goalOf('event', e.id)?.t : undefined });
const goalRow = (g: Goal) => ({ id: g.id, title: g.t, status: g.st, percent: goalPct(g), progress: goalCount(g) || undefined, target_date: g.td || undefined, steps: GOAL_KINDS.reduce((n, k) => n + goalLinkedIds(g.id, k).length, 0) || undefined });

const reads: Action[] = [
  {
    name: 'get_overview',
    risk: 'read',
    description:
      'Snapshot of the person\'s day and work: today\'s and tomorrow\'s events and tasks, overdue tasks, active goals, projects, and task lists, each with ids. Call this first when you need context.',
    params: obj({}),
    run: () => {
      const t = today();
      const tm = plus(1);
      const tasks = getTasks();
      const open = tasks.filter((x) => !x.d);
      return {
        ok: true,
        summary: 'Read the overview',
        data: {
          today: t,
          tomorrow: tm,
          overdue_tasks: open.filter((x) => isOverdue(x)).map(taskRow),
          today_tasks: open.filter((x) => x.due === t && !isOverdue(x)).map(taskRow),
          /* Ended, unanswered: the person has not said whether they attended. */
          events_awaiting_attendance: toConfirm().map(({ ev, day }) => ({ id: ev.id, title: ev.t, date: day, time: ev.tm })),
          today_events: dayEvents(t).map(eventRow),
          tomorrow_tasks: open.filter((x) => x.due === tm).map(taskRow),
          tomorrow_events: dayEvents(tm).map(eventRow),
          undated_open_tasks: open.filter((x) => !x.due).length,
          active_goals: getGoals().filter(isActiveGoal).map(goalRow),
          projects: getProjects().map((p) => ({ id: p.id, name: p.n, due: p.due, items: (p.links ?? []).length })),
          task_lists: getLists().map((l) => ({ id: l.id, name: l.n })),
        },
      };
    },
  },
  {
    name: 'search_items',
    risk: 'read',
    description: 'Find tasks, events, goals, projects and notes by words in their title (notes: also their text). Returns up to 25 matches with ids.',
    params: obj(
      {
        query: s('Words to look for.', { max: 200 }),
        kinds: list('Limit to these kinds. Leave out for all.', s('Item kind.', { enum: ITEM_KINDS })),
      },
      ['query'],
    ),
    run: (a) => {
      const q = String(a.query).toLowerCase().trim();
      const want = (k: ItemKind) => !a.kinds?.length || a.kinds.includes(k);
      const hit = (t: string) => t.toLowerCase().includes(q) || q.split(/\s+/).every((w) => t.toLowerCase().includes(w));
      const out: Args[] = [];
      if (want('task')) getTasks().filter((x) => hit(x.t)).forEach((x) => out.push({ kind: 'task', ...taskRow(x) }));
      if (want('event')) getEvents().filter((x) => hit(x.t)).forEach((x) => out.push({ kind: 'event', ...eventRow(x) }));
      if (want('goal')) getGoals().filter((x) => hit(x.t)).forEach((x) => out.push({ kind: 'goal', ...goalRow(x) }));
      if (want('project')) getProjects().filter((x) => hit(x.n + ' ' + x.d)).forEach((x) => out.push({ kind: 'project', id: x.id, name: x.n, due: x.due }));
      if (want('note')) getNotes().filter((x) => hit(titleOf(x) + ' ' + noteText(x))).forEach((x) => out.push({ kind: 'note', id: x.id, title: titleOf(x) }));
      return { ok: true, summary: `Found ${plural(out.length, 'match')}`, data: { matches: out.slice(0, 25), more: Math.max(0, out.length - 25) } };
    },
  },
  {
    name: 'list_items',
    risk: 'read',
    description: 'List items of one kind, optionally by date range, status, project, or goal (the tasks, events or notes a goal owns). Returns up to 50 with ids.',
    params: obj(
      {
        kind: s('Which kind.', { enum: ITEM_KINDS }),
        from: date('Start of a date range (tasks: due date; events: occurrence date).'),
        to: date('End of the range, inclusive.'),
        status: s('Tasks: open, done or all (default open). Goals: active, done, let-go or all (default active).', { enum: ['open', 'done', 'active', 'let-go', 'all'] }),
        project: s('Only items in this project id.'),
        goal: s('Only tasks, events or notes under this goal id.'),
      },
      ['kind'],
    ),
    verify: (a) => (a.project && !getProject(a.project) ? missing('project', a.project) : a.goal && !getGoals().some((g) => g.id === a.goal) ? missing('goal', a.goal) : a.goal && !GOAL_KINDS.includes(a.kind) ? 'Only tasks, events and notes sit under a goal.' : a.from && a.to && a.to < a.from ? '"to" is before "from".' : null),
    run: (a) => {
      const inProject = (k: LinkKind) => {
        const p = a.project ? new Set(linkedIds(a.project, k)) : null;
        const g = a.goal && GOAL_KINDS.includes(k as GoalLinkKind) ? new Set(goalLinkedIds(a.goal, k as GoalLinkKind)) : null;
        return p && g ? new Set([...p].filter((x) => g.has(x))) : (p ?? g);
      };
      let rows: unknown[] = [];
      if (a.kind === 'task') {
        const only = inProject('task');
        const st = a.status ?? 'open';
        rows = getTasks()
          .filter((t) => (st === 'all' ? true : st === 'done' ? !!t.d : !t.d))
          .filter((t) => (!a.from || (t.due && t.due >= a.from)) && (!a.to || (t.due && t.due <= a.to)))
          .filter((t) => !only || only.has(t.id))
          .map(taskRow);
      } else if (a.kind === 'event') {
        const only = inProject('event');
        if (a.from || a.to) {
          const from = a.from ?? today();
          const to = a.to ?? from;
          const out: CalEvent[] = [];
          for (let d = new Date(from + 'T12:00'); ymd(d) <= to && out.length < 200; d.setDate(d.getDate() + 1)) out.push(...dayEvents(ymd(d)));
          rows = out.filter((e) => !only || only.has(e.id!)).map(eventRow);
        } else {
          rows = getEvents().filter((e) => !only || only.has(e.id!)).map(eventRow);
        }
      } else if (a.kind === 'goal') {
        const only = inProject('goal');
        const st = a.status ?? 'active';
        rows = getGoals()
          .filter((g) => (st === 'all' ? true : st === 'done' ? g.st === 'completed' : st === 'let-go' ? g.st === 'let-go' : isActiveGoal(g)))
          .filter((g) => !only || only.has(g.id))
          .map(goalRow);
      } else if (a.kind === 'project') {
        rows = getProjects().map((p) => ({ id: p.id, name: p.n, description: p.d, due: p.due, items: (p.links ?? []).length }));
      } else {
        const only = inProject('note');
        rows = getNotes().filter((n) => !only || only.has(n.id)).map((n) => ({ id: n.id, title: titleOf(n), updated: new Date(n.updatedAt).toISOString().slice(0, 10) }));
      }
      return { ok: true, summary: `Listed ${plural(rows.length, a.kind)}`, data: { items: rows.slice(0, 50), more: Math.max(0, rows.length - 50) } };
    },
  },
  {
    name: 'read_item',
    risk: 'read',
    description: 'Read one item in full by kind and id: every field, subtasks, milestones, its project and goal, what a project or goal holds, and for notes the text.',
    params: obj({ kind: s('Item kind.', { enum: ITEM_KINDS }), id: s('The item id.') }, ['kind', 'id']),
    verify: (a) => (exists(a.kind, a.id) ? null : missing(a.kind, a.id)),
    run: (a) => {
      const id = String(a.id);
      let data: unknown;
      if (a.kind === 'task') {
        const t = getTask(id)!;
        data = { ...taskRow(t), goal: goalOf('task', id)?.t, estimate_min: t.est, repeat: t.rep, repeat_days: t.repDays, repeat_until: t.repUntil, subtasks: (t.sub ?? []).map((x, i) => ({ index: i, title: x.t, done: !!x.d })) };
      } else if (a.kind === 'event') {
        const e = getEvent(id)!;
        data = { ...eventRow(e), type: e.type, notes: e.note, repeat: e.rep, skipped_dates: e.skip, project: projectOf('event', id)?.n, goal: goalOf('event', id)?.t };
      } else if (a.kind === 'goal') {
        const g = getGoals().find((x) => x.id === id)!;
        data = { ...goalRow(g), why: g.d, target: g.tgt, unit: g.unit, current: g.cur, pace: g.pace, milestones: g.ms, project: projectOf('goal', id)?.n, items: GOAL_KINDS.flatMap((k) => goalLinkedIds(id, k).map((iid) => ({ kind: k, id: iid, title: titleOfKind(k, iid) })).filter((x) => x.title !== undefined)) };
      } else if (a.kind === 'project') {
        const p = getProject(id)!;
        const items = (p.links ?? []).map((l) => ({ kind: l.k, id: l.id, title: LINKABLE.includes(l.k) ? titleOfKind(l.k as ItemKind, l.id) : undefined })).filter((x) => x.title !== undefined);
        data = { id: p.id, name: p.n, description: p.d, due: p.due, milestones: p.ms, items };
      } else {
        const n = getNote(id)!;
        const text = noteText(n);
        data = { id: n.id, title: titleOf(n), text: text.length > 8000 ? text.slice(0, 8000) + '…' : text, project: projectOf('note', id)?.n, goal: goalOf('note', id)?.t };
      }
      return { ok: true, summary: `Read ${a.kind} "${titleOfKind(a.kind, id)}"`, data };
    },
  },
  {
    name: 'find_free_time',
    risk: 'read',
    description: 'Open time slots on a day that fit a length, between a start and end hour (default 08:00 to 20:00), around timed events and timed tasks.',
    params: obj(
      {
        date: date('The day to look at.'),
        minutes: num('How long the slot must be.', { min: 5, max: 720, integer: true }),
        from: time('Earliest start, default 08:00.'),
        to: time('Latest end, default 20:00.'),
      },
      ['date', 'minutes'],
    ),
    run: (a) => {
      const m = (tm: string) => Number(tm.slice(0, 2)) * 60 + Number(tm.slice(3, 5));
      const hhmm = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
      const busy: [number, number][] = [];
      for (const e of dayEvents(a.date)) {
        if (e.allDay || !/^\d{1,2}:\d{2}$/.test(e.tm)) continue;
        const st = m(e.tm.padStart(5, '0'));
        const en = e.end && /^\d{2}:\d{2}$/.test(e.end) ? m(e.end) : st + 60;
        busy.push([st, Math.max(en, st + 15)]);
      }
      for (const t of getTasks()) {
        if (t.d || t.due !== a.date || !t.tm) continue;
        const st = m(t.tm);
        busy.push([st, st + (t.est ?? 30)]);
      }
      busy.sort((x, y) => x[0] - y[0]);
      const start = m(a.from ?? '08:00');
      const end = m(a.to ?? '20:00');
      const slots: { start: string; end: string }[] = [];
      let cur = start;
      for (const [bs, be] of busy) {
        if (bs - cur >= a.minutes && bs <= end) slots.push({ start: hhmm(cur), end: hhmm(Math.min(bs, end)) });
        cur = Math.max(cur, be);
      }
      if (end - cur >= a.minutes) slots.push({ start: hhmm(cur), end: hhmm(end) });
      return { ok: true, summary: `Found ${plural(slots.length, 'open slot')} on ${a.date}`, data: { date: a.date, slots } };
    },
  },
  {
    name: 'open_item',
    risk: 'read',
    description: 'Show a task, event or goal to the person in its office tab, e.g. right after making it or when they ask to see it.',
    params: obj({ kind: s('Item kind.', { enum: ['task', 'event', 'goal'] }), id: s('The item id.') }, ['kind', 'id']),
    verify: (a) => (exists(a.kind, a.id) ? null : missing(a.kind, a.id)),
    run: (a) => ({ ok: true, summary: `Opened ${a.kind} "${titleOfKind(a.kind, a.id)}"`, open: { k: a.kind, id: a.id } }),
  },
];

/* ───────────────────────── creates ───────────────────────── */

/* Honesty (2B, his call Oct 19): every detail Mae filled in herself is named,
   and Mae SAYS it in her reply (guess.ts checks her too; no card label, his call 9:47 PM). */
const guessedField = list(
  "Names of the fields YOU filled in that the person did not say (e.g. [\"due\", \"estimate\", \"priority\"]). Leave out when every detail came from them.",
  s('A field name from this object.', { max: 30 }),
  { maxItems: 20 },
);

const taskFields: Record<string, Param> = {
  title: s('One task, in the person\'s words. Never several tasks in one title.', { max: 200 }),
  due: date('Due date. Leave out when none was given; never invent one.'),
  time: time('Deadline time on the due date (needs due). A thing that HAPPENS at a time is an event, not a task.'),
  estimate: num('Estimated minutes.', { min: 1, max: 1440, integer: true }),
  priority: s('Priority word.', { enum: PRIORITIES }),
  list: s('Task list name or id from get_overview task_lists. Default Inbox.'),
  repeat: s('Repeat.', { enum: REPEATS }),
  repeat_days: list('Weekly repeat only: days 0-6 (0 = Sunday).', num('Weekday.', { min: 0, max: 6, integer: true })),
  repeat_until: date('Last date it repeats.'),
  subtasks: list('Subtask titles, one per step.', s('Subtask.', { max: 200 }), { maxItems: 30 }),
  project: projectField,
  goal: goalField,
  guessed: guessedField,
};

function verifyTask(t: Args, at: string, ctx: StageCtx): string | null {
  if (t.time && !t.due) return `${at}.time needs a due date. If it happens at a time, it is an event (create_events).`;
  if (t.repeat && t.repeat !== 'none' && !t.due) return `${at}.repeat needs a due date to repeat from.`;
  if (t.repeat_days?.length && t.repeat !== 'weekly') return `${at}.repeat_days only works with repeat "weekly".`;
  if (t.repeat_until && t.due && t.repeat_until < t.due) return `${at}.repeat_until is before the due date.`;
  if (/\n/.test(t.title)) return `${at}.title has several lines. Make each line its own task.`;
  return listError(t.list, `${at}.list`) ?? checkProject(t.project, ctx, `${at}.project`) ?? checkGoal(t.goal, ctx, `${at}.goal`);
}

function taskDetail(t: Args): string {
  return join(t.due && fmtDate(t.due), t.time && `by ${fmtTime(t.time)}`, t.estimate && `${t.estimate} min`, t.priority && t.priority !== 'none' && t.priority, t.repeat && t.repeat !== 'none' && `repeats ${t.repeat}`, t.subtasks?.length && plural(t.subtasks.length, 'subtask'));
}

const eventFields: Record<string, Param> = {
  title: s('What happens.', { max: 200 }),
  date: date('The day it happens (first day, if it repeats).'),
  start: time('Start time. Required unless all_day.'),
  end: time('End time, after start.'),
  all_day: bool('True for an all-day event with no time.'),
  location: s('Where.', { max: 200 }),
  type: s('Kind of event.', { enum: EVENT_TYPES }),
  repeat: s('Repeat.', { enum: REPEATS }),
  repeat_days: list('Weekly repeat only: days 0-6 (0 = Sunday).', num('Weekday.', { min: 0, max: 6, integer: true })),
  repeat_until: date('Last date it repeats.'),
  notes: s('Notes.', { max: 2000 }),
  project: projectField,
  goal: goalField,
  guessed: guessedField,
};

function verifyEvent(e: Args, at: string, ctx: StageCtx | null): string | null {
  if (e.all_day && (e.start || e.end)) return `${at}: an all-day event has no start or end time.`;
  if (e.end && e.start && e.end <= e.start) return `${at}.end must be after start.`;
  if (e.end && !e.start && !e.all_day) return `${at}.end needs a start time.`;
  if (e.repeat_days?.length && e.repeat !== 'weekly') return `${at}.repeat_days only works with repeat "weekly".`;
  if (e.repeat_until && e.date && e.repeat_until < e.date) return `${at}.repeat_until is before the date.`;
  return ctx ? checkProject(e.project, ctx, `${at}.project`) ?? checkGoal(e.goal, ctx, `${at}.goal`) : null;
}

function eventDetail(e: Args): string {
  return join(fmtDate(e.date), e.all_day ? 'all day' : e.start && (e.end ? `${fmtTime(e.start)}–${fmtTime(e.end)}` : fmtTime(e.start)), e.location, e.type && e.type !== 'other' && e.type, e.repeat && e.repeat !== 'none' && `repeats ${e.repeat}`);
}

function repeatOf(e: Args): CalEvent['rep'] {
  if (!e.repeat || e.repeat === 'none') return undefined;
  return { f: e.repeat, ...(weekdays(e.repeat_days) ? { days: weekdays(e.repeat_days) } : {}), ...(e.repeat_until ? { until: e.repeat_until } : {}) };
}

const goalFields: Record<string, Param> = {
  title: s('The aim, short.', { max: 200 }),
  why: s('Why it matters, one line.', { max: 500 }),
  target_date: date('When it should be reached.'),
  target: num('The number that means done (e.g. 3 clients, 2000 dollars).', { min: 0 }),
  unit: s('Unit for target, e.g. "clients", "$", "km".', { max: 30 }),
  current: num('Where they are now toward target.', { min: 0 }),
  pace: num('How many per pace_per, to warn early when behind.', { min: 0 }),
  pace_per: s('Pace period.', { enum: ['week', 'month'] }),
  milestones: list('Dated checkpoints on the way.', milestoneItem, { maxItems: 30 }),
  project: projectField,
  ref: s('Short ref for this plan, e.g. "g1", so other steps can put tasks, events or notes under this new goal with goal: "g1".', { max: 20 }),
  guessed: guessedField,
};

function verifyGoal(g: Args, at: string, ctx: StageCtx | null): string | null {
  if ((g.unit || g.current !== undefined) && g.target === undefined) return `${at}: unit and current need a target number.`;
  if (g.pace !== undefined && !g.pace_per) return `${at}.pace needs pace_per (week or month).`;
  return ctx ? checkProject(g.project, ctx, `${at}.project`) : null;
}

const creates: Action[] = [
  {
    name: 'create_tasks',
    risk: 'write',
    description:
      'Make tasks: things the person will FINISH and tick off. One object per task — three to-dos are three objects, never one combined title. A meeting, class, appointment or anything that happens at a set time is an event (create_events), not a task. Use this list even for a single task.',
    params: obj({ tasks: list('One object per task.', obj(taskFields, ['title']), { minItems: 1, maxItems: 50 }) }, ['tasks']),
    verify: (a, ctx) => {
      for (let i = 0; i < a.tasks.length; i++) {
        const e = verifyTask(a.tasks[i], `tasks[${i}]`, ctx);
        if (e) return e;
      }
      return null;
    },
    preview: (a) => a.tasks.map((t: Args) => ({ kind: 'Task', verb: 'Create', text: t.title.trim(), detail: taskDetail(t) || undefined, guess: guessOf(t) })),
    run: (a, ctx) => {
      const touched: Result['touched'] = [];
      for (const t of a.tasks as Args[]) {
        const base = createTask(t.title.trim());
        const task: Task = {
          ...base,
          ...(t.due ? { due: t.due } : {}),
          ...(t.time ? { tm: t.time } : {}),
          ...(t.estimate ? { est: t.estimate } : {}),
          pr: t.priority ?? 'none',
          list: resolveList(t.list) ?? 'inbox',
          ...(t.repeat && t.repeat !== 'none' ? { rep: t.repeat } : {}),
          ...(weekdays(t.repeat_days) ? { repDays: weekdays(t.repeat_days) } : {}),
          ...(t.repeat_until ? { repUntil: t.repeat_until } : {}),
          sub: (t.subtasks ?? []).map((x: string) => ({ t: x.trim(), d: 0 as const })).filter((x: { t: string }) => x.t),
        };
        saveTask(task);
        const pid = resolveProject(t.project, ctx);
        if (pid) linkItem(pid, 'task', task.id);
        const gid = resolveGoal(t.goal, ctx);
        if (gid) linkToGoal(gid, 'task', task.id);
        touched.push({ kind: 'task', id: task.id, title: task.t });
      }
      return { ok: true, summary: `Created ${plural(touched.length, 'task')}`, touched, data: { created: touched } };
    },
  },
  {
    name: 'create_events',
    risk: 'write',
    description:
      'Make calendar events: things that HAPPEN at a date and time (meetings, classes, appointments, trips, birthdays). One object per event. Something to finish by a deadline is a task, not an event. Use this list even for one event.',
    params: obj({ events: list('One object per event.', obj(eventFields, ['title', 'date']), { minItems: 1, maxItems: 50 }) }, ['events']),
    verify: (a, ctx) => {
      for (let i = 0; i < a.events.length; i++) {
        const e = a.events[i];
        if (!e.all_day && !e.start) return `events[${i}] needs a start time, or all_day true. If no time was given, ask the person.`;
        const err = verifyEvent(e, `events[${i}]`, ctx);
        if (err) return err;
      }
      return null;
    },
    preview: (a) => a.events.map((e: Args) => ({ kind: 'Event', verb: 'Create', text: e.title.trim(), detail: eventDetail(e), guess: guessOf(e) })),
    run: (a, ctx) => {
      const touched: Result['touched'] = [];
      for (const e of a.events as Args[]) {
        const saved = saveEvent({
          d: e.date,
          tm: e.all_day ? '' : e.start,
          t: e.title.trim(),
          ...(e.end ? { end: e.end } : {}),
          ...(e.all_day ? { allDay: true } : {}),
          ...(e.location ? { loc: e.location } : {}),
          type: e.type ?? 'other',
          ...(repeatOf(e) ? { rep: repeatOf(e) } : {}),
          ...(e.notes ? { note: e.notes } : {}),
        });
        const pid = resolveProject(e.project, ctx);
        if (pid) linkItem(pid, 'event', saved.id!);
        const gid = resolveGoal(e.goal, ctx);
        if (gid) linkToGoal(gid, 'event', saved.id!);
        touched.push({ kind: 'event', id: saved.id!, title: saved.t });
      }
      return { ok: true, summary: `Created ${plural(touched.length, 'event')}`, touched, data: { created: touched } };
    },
  },
  {
    name: 'create_goals',
    risk: 'write',
    description:
      'Make goals: long efforts measured over weeks or months (land 3 clients, run a half marathon). Something doable in one sitting is a task. Give target + unit when the aim is a number. One object per goal.',
    params: obj({ goals: list('One object per goal.', obj(goalFields, ['title']), { minItems: 1, maxItems: 20 }) }, ['goals']),
    declares: (a) => a.goals.map((g: Args) => g.ref).filter(Boolean),
    verify: (a, ctx) => {
      const refs = a.goals.map((g: Args) => g.ref).filter(Boolean);
      if (new Set(refs).size !== refs.length) return 'Two goals share a ref. Give each its own.';
      for (let i = 0; i < a.goals.length; i++) {
        const e = verifyGoal(a.goals[i], `goals[${i}]`, ctx);
        if (e) return e;
      }
      return null;
    },
    preview: (a) =>
      a.goals.map((g: Args) => ({
        kind: 'Goal',
        verb: 'Create',
        text: g.title.trim(),
        detail: join(g.target !== undefined && `${g.current ?? 0} of ${g.target}${g.unit ? ' ' + g.unit : ''}`, g.target_date && `by ${fmtDate(g.target_date)}`, g.pace && `${g.pace} per ${g.pace_per}`, g.milestones?.length && plural(g.milestones.length, 'milestone')) || undefined,
        guess: guessOf(g),
      })),
    run: (a, ctx) => {
      const touched: Result['touched'] = [];
      for (const g of a.goals as Args[]) {
        const base = createGoal(g.title.trim());
        const goal: Goal = {
          ...base,
          d: g.why ?? '',
          td: g.target_date ?? '',
          ...(g.target !== undefined ? { tgt: g.target, cur: g.current ?? 0 } : {}),
          ...(g.unit ? { unit: g.unit } : {}),
          ...(g.pace ? { pace: { n: g.pace, per: g.pace_per } } : {}),
          ...(milestones(g.milestones) ? { ms: milestones(g.milestones) } : {}),
        };
        saveGoal(goal);
        const pid = resolveProject(g.project, ctx);
        if (pid) linkItem(pid, 'goal', goal.id);
        if (g.ref) ctx.refs.set(g.ref, goal.id);
        touched.push({ kind: 'goal', id: goal.id, title: goal.t });
      }
      return { ok: true, summary: `Created ${plural(touched.length, 'goal')}`, touched, data: { created: touched.map((t, i) => ({ ...t, ref: a.goals[i].ref })) } };
    },
  },
  {
    name: 'create_projects',
    risk: 'write',
    description:
      'Make projects: containers that own tasks, events, goals and notes. Give each a short ref ("p1") so other steps in the same plan can put items in it with project: "p1".',
    params: obj(
      {
        projects: list(
          'One object per project.',
          obj({ ref: s('Short ref for this plan, e.g. "p1".', { max: 20 }), name: s('Project name.', { max: 120 }), description: s('One line.', { max: 300 }), due: date('Deadline.'), milestones: list('Checkpoints.', milestoneItem, { maxItems: 30 }) }, ['name']),
          { minItems: 1, maxItems: 10 },
        ),
      },
      ['projects'],
    ),
    declares: (a) => a.projects.map((p: Args) => p.ref).filter(Boolean),
    verify: (a) => {
      const refs = a.projects.map((p: Args) => p.ref).filter(Boolean);
      if (new Set(refs).size !== refs.length) return 'Two projects share a ref. Give each its own.';
      return null;
    },
    preview: (a) => a.projects.map((p: Args) => ({ kind: 'Project', verb: 'Create', text: p.name.trim(), detail: join(p.due && `due ${fmtDate(p.due)}`, p.milestones?.length && plural(p.milestones.length, 'milestone'), p.description) || undefined })),
    run: (a, ctx) => {
      const touched: Result['touched'] = [];
      for (const p of a.projects as Args[]) {
        const base = createProject(p.name.trim());
        saveProject({ ...base, d: p.description ?? '', ...(p.due ? { due: p.due } : {}), ...(milestones(p.milestones) ? { ms: milestones(p.milestones) } : {}) });
        if (p.ref) ctx.refs.set(p.ref, base.id);
        touched.push({ kind: 'project', id: base.id, title: base.n });
      }
      return { ok: true, summary: `Created ${plural(touched.length, 'project')}`, touched, data: { created: touched.map((t, i) => ({ ...t, ref: a.projects[i].ref })) } };
    },
  },
  {
    name: 'create_notes',
    risk: 'write',
    description: 'Make notes: information to keep, with no done-state. Body is plain text; blank lines start new paragraphs. One object per note.',
    params: obj({ notes: list('One object per note.', obj({ title: s('Title.', { max: 120 }), body: s('Text.', { max: 20000 }), project: projectField, goal: goalField }, ['title']), { minItems: 1, maxItems: 20 }) }, ['notes']),
    verify: (a, ctx) => {
      for (let i = 0; i < a.notes.length; i++) {
        const e = checkProject(a.notes[i].project, ctx, `notes[${i}].project`) ?? checkGoal(a.notes[i].goal, ctx, `notes[${i}].goal`);
        if (e) return e;
      }
      return null;
    },
    preview: (a) => a.notes.map((n: Args) => ({ kind: 'Note', verb: 'Create', text: n.title.trim(), detail: n.body ? `${n.body.trim().split(/\s+/).length} words` : undefined })),
    run: (a, ctx) => {
      const touched: Result['touched'] = [];
      for (const n of a.notes as Args[]) {
        const base = createNote(n.title.trim());
        saveNote({ ...base, body: noteHtml(n.title.trim(), n.body) });
        const pid = resolveProject(n.project, ctx);
        if (pid) linkItem(pid, 'note', base.id);
        const gid = resolveGoal(n.goal, ctx);
        if (gid) linkToGoal(gid, 'note', base.id);
        touched.push({ kind: 'note', id: base.id, title: n.title.trim() });
      }
      return { ok: true, summary: `Created ${plural(touched.length, 'note')}`, touched, data: { created: touched } };
    },
  },
  {
    name: 'create_list',
    risk: 'write',
    description: 'Make a new task list (like Work or Errands). Tasks can then use it by name.',
    params: obj({ name: s('List name.', { max: 40 }) }, ['name']),
    verify: (a) => (getLists().some((l) => l.n.toLowerCase() === a.name.trim().toLowerCase()) ? `A list named "${a.name}" already exists.` : null),
    preview: (a) => [{ kind: 'List', verb: 'Create', text: a.name.trim() }],
    run: (a) => {
      const l = addList(a.name.trim());
      return l ? { ok: true, summary: `Created list "${l.n}"`, data: { id: l.id, name: l.n } } : { ok: false, summary: 'List not created', error: 'That list could not be made (empty or already there).' };
    },
  },
];

/* ───────────────────────── changes ───────────────────────── */

const taskChange = obj(
  {
    title: taskFields.title,
    due: date('New due date, or "" to clear.'),
    time: time('New deadline time, or "" to clear.'),
    estimate: num('Minutes, or 0 to clear.', { min: 0, max: 1440, integer: true }),
    priority: taskFields.priority,
    list: taskFields.list,
    repeat: taskFields.repeat,
    repeat_days: taskFields.repeat_days,
    repeat_until: date('Last repeat date, or "" to clear.'),
  },
  [],
  'Only the fields to change.',
);

const eventChange = obj(
  {
    title: eventFields.title,
    date: date('New date.'),
    start: time('New start time.'),
    end: time('New end time, or "" to clear.'),
    all_day: eventFields.all_day,
    location: s('Where, or "" to clear.', { max: 200 }),
    type: eventFields.type,
    repeat: eventFields.repeat,
    repeat_days: eventFields.repeat_days,
    repeat_until: date('Last repeat date, or "" to clear.'),
    notes: s('Notes, or "" to clear.', { max: 2000 }),
  },
  [],
  'Only the fields to change.',
);

const goalChange = obj(
  {
    title: goalFields.title,
    why: goalFields.why,
    status: s('Goal status.', { enum: GOAL_STATUSES }),
    target_date: date('Target date, or "" to clear.'),
    target: goalFields.target,
    unit: goalFields.unit,
    current: goalFields.current,
    pace: goalFields.pace,
    pace_per: goalFields.pace_per,
  },
  [],
  'Only the fields to change.',
);

const changeList = (c: Args) =>
  Object.entries(c)
    .map(([k, v]) => (v === '' ? `clear ${k.replace('_', ' ')}` : `${k.replace('_', ' ')} → ${k === 'due' || k === 'date' || k.endsWith('_date') || k === 'repeat_until' ? fmtDate(String(v)) : k === 'time' || k === 'start' || k === 'end' ? fmtTime(String(v)) : Array.isArray(v) ? v.join(', ') : String(v)}`))
    .join(' · ');

const emptyChange = (c: Args | undefined) => (!c || !Object.keys(c).length ? 'changes is empty. Name at least one field to change.' : null);

const changes: Action[] = [
  {
    name: 'update_task',
    risk: 'write',
    description: 'Change fields on one task. Only send the fields that change.',
    params: obj({ id: s('Task id.'), changes: taskChange }, ['id', 'changes']),
    verify: (a) => {
      if (!getTask(a.id)) return missing('task', a.id);
      const t = getTask(a.id)!;
      const merged = { title: a.changes.title ?? t.t, due: a.changes.due ?? t.due, time: a.changes.time ?? t.tm, repeat: a.changes.repeat ?? t.rep, repeat_days: a.changes.repeat_days ?? t.repDays, list: a.changes.list };
      return emptyChange(a.changes) ?? verifyTask({ ...merged, due: merged.due || undefined, time: merged.time || undefined }, 'changes', { refs: new Set() });
    },
    preview: (a) => [{ kind: 'Task', verb: 'Edit', text: getTask(a.id)?.t ?? a.id, detail: changeList(a.changes) }],
    run: (a) => {
      const t = getTask(a.id);
      if (!t) return { ok: false, summary: 'Task not found', error: missing('task', a.id) };
      const c = a.changes;
      const next: Task = { ...t };
      if (c.title !== undefined) next.t = c.title.trim();
      if (c.due !== undefined) c.due ? (next.due = c.due) : (delete next.due, delete next.tm);
      if (c.time !== undefined) c.time ? (next.tm = c.time) : delete next.tm;
      if (c.estimate !== undefined) c.estimate ? (next.est = c.estimate) : delete next.est;
      if (c.priority !== undefined) next.pr = c.priority;
      if (c.list !== undefined) next.list = resolveList(c.list) ?? next.list;
      if (c.repeat !== undefined) c.repeat === 'none' ? (delete next.rep, delete next.repDays, delete next.repUntil) : (next.rep = c.repeat);
      if (c.repeat_days !== undefined) next.repDays = weekdays(c.repeat_days);
      if (c.repeat_until !== undefined) c.repeat_until ? (next.repUntil = c.repeat_until) : delete next.repUntil;
      saveTask(next);
      return { ok: true, summary: `Updated task "${next.t}"`, touched: [{ kind: 'task', id: next.id, title: next.t }] };
    },
  },
  {
    name: 'update_event',
    risk: 'write',
    description: 'Change fields on one event (the whole series, if it repeats). Only send the fields that change.',
    params: obj({ id: s('Event id.'), changes: eventChange }, ['id', 'changes']),
    verify: (a) => {
      const e = getEvent(a.id);
      if (!e) return missing('event', a.id);
      const c = a.changes;
      const allDay = c.all_day ?? !!e.allDay;
      const merged = { all_day: allDay, start: allDay ? undefined : (c.start ?? (e.tm || undefined)), end: allDay ? undefined : c.end === '' ? undefined : (c.end ?? e.end), date: c.date ?? e.d, repeat: c.repeat ?? e.rep?.f, repeat_days: c.repeat_days, repeat_until: c.repeat_until || undefined };
      if (!allDay && !merged.start) return 'changes: a timed event needs a start time.';
      return emptyChange(c) ?? verifyEvent(merged, 'changes', null);
    },
    preview: (a) => [{ kind: 'Event', verb: 'Edit', text: getEvent(a.id)?.t ?? a.id, detail: changeList(a.changes) }],
    run: (a) => {
      const e = getEvent(a.id);
      if (!e) return { ok: false, summary: 'Event not found', error: missing('event', a.id) };
      const c = a.changes;
      const next: CalEvent = { ...e };
      if (c.title !== undefined) next.t = c.title.trim();
      if (c.date !== undefined) next.d = c.date;
      if (c.all_day === true) {
        next.allDay = true;
        next.tm = '';
        delete next.end;
      } else if (c.all_day === false) delete next.allDay;
      if (c.start !== undefined) next.tm = c.start;
      if (c.end !== undefined) c.end ? (next.end = c.end) : delete next.end;
      if (c.location !== undefined) c.location ? (next.loc = c.location) : delete next.loc;
      if (c.type !== undefined) next.type = c.type;
      if (c.notes !== undefined) c.notes ? (next.note = c.notes) : delete next.note;
      if (c.repeat !== undefined || c.repeat_days !== undefined || c.repeat_until !== undefined) {
        const f = c.repeat ?? e.rep?.f ?? 'none';
        next.rep = repeatOf({ repeat: f, repeat_days: c.repeat_days ?? e.rep?.days, repeat_until: c.repeat_until === '' ? undefined : (c.repeat_until ?? e.rep?.until) });
        if (!next.rep) delete next.rep;
      }
      saveEvent(next);
      return { ok: true, summary: `Updated event "${next.t}"`, touched: [{ kind: 'event', id: next.id!, title: next.t }] };
    },
  },
  {
    name: 'update_goal',
    risk: 'write',
    description: 'Change fields on one goal, including its status (not-started, in-progress, completed, let-go). Only send the fields that change.',
    params: obj({ id: s('Goal id.'), changes: goalChange }, ['id', 'changes']),
    verify: (a) => {
      const g = getGoals().find((x) => x.id === a.id);
      if (!g) return missing('goal', a.id);
      return emptyChange(a.changes) ?? verifyGoal({ ...a.changes, target: a.changes.target ?? g.tgt, pace_per: a.changes.pace_per ?? g.pace?.per }, 'changes', null);
    },
    preview: (a) => [{ kind: 'Goal', verb: 'Edit', text: getGoals().find((x) => x.id === a.id)?.t ?? a.id, detail: changeList(a.changes) }],
    run: (a) => {
      const g = getGoals().find((x) => x.id === a.id);
      if (!g) return { ok: false, summary: 'Goal not found', error: missing('goal', a.id) };
      const c = a.changes;
      const next: Goal = { ...g };
      if (c.title !== undefined) next.t = c.title.trim();
      if (c.why !== undefined) next.d = c.why;
      if (c.status !== undefined) next.st = c.status;
      if (c.target_date !== undefined) next.td = c.target_date;
      if (c.target !== undefined) next.tgt = c.target;
      if (c.unit !== undefined) next.unit = c.unit;
      if (c.current !== undefined) next.cur = c.current;
      if (c.pace !== undefined) next.pace = c.pace ? { n: c.pace, per: c.pace_per ?? g.pace?.per ?? 'week' } : undefined;
      saveGoal(next);
      return { ok: true, summary: `Updated goal "${next.t}"`, touched: [{ kind: 'goal', id: next.id, title: next.t }] };
    },
  },
  {
    name: 'update_project',
    risk: 'write',
    description: 'Rename a project, or change its description or deadline.',
    params: obj({ id: s('Project id.'), changes: obj({ name: s('New name.', { max: 120 }), description: s('One line.', { max: 300 }), due: date('Deadline, or "" to clear.') }, [], 'Only the fields to change.') }, ['id', 'changes']),
    verify: (a) => (getProject(a.id) ? emptyChange(a.changes) : missing('project', a.id)),
    preview: (a) => [{ kind: 'Project', verb: 'Edit', text: getProject(a.id)?.n ?? a.id, detail: changeList(a.changes) }],
    run: (a) => {
      const p = getProject(a.id);
      if (!p) return { ok: false, summary: 'Project not found', error: missing('project', a.id) };
      const c = a.changes;
      const next = { ...p, ...(c.name !== undefined ? { n: c.name.trim() } : {}), ...(c.description !== undefined ? { d: c.description } : {}) };
      if (c.due !== undefined) c.due ? (next.due = c.due) : delete next.due;
      saveProject(next);
      return { ok: true, summary: `Updated project "${next.n}"`, touched: [{ kind: 'project', id: next.id, title: next.n }] };
    },
  },
  {
    name: 'update_note',
    risk: 'write',
    description: 'Change a note: retitle it, add text to the end (append), or replace its whole text (body). Prefer append unless asked to rewrite.',
    params: obj({ id: s('Note id.'), title: s('New title.', { max: 120 }), append: s('Text to add at the end.', { max: 20000 }), body: s('New full text (replaces everything under the title).', { max: 20000 }) }, ['id']),
    verify: (a) => {
      if (!getNote(a.id)) return missing('note', a.id);
      if (a.append && a.body) return 'Use append or body, not both.';
      if (!a.title && !a.append && !a.body) return 'Nothing to change: give title, append or body.';
      return null;
    },
    preview: (a) => [{ kind: 'Note', verb: 'Edit', text: (getNote(a.id) && titleOf(getNote(a.id)!)) ?? a.id, detail: join(a.title && `title → ${a.title}`, a.append && 'add text', a.body && 'replace text') }],
    run: (a) => {
      const n = getNote(a.id);
      if (!n) return { ok: false, summary: 'Note not found', error: missing('note', a.id) };
      const title = (a.title ?? titleOf(n)).trim();
      let body: string;
      if (a.body !== undefined) body = noteHtml(title, a.body);
      else {
        const rest = n.body.replace(/^<(div|p|h1|h2)[^>]*>[\s\S]*?<\/\1>/i, '');
        body = noteHtml(title) + rest + (a.append ? noteHtml('', a.append).replace(/^<div><\/div>/, '') : '');
      }
      saveNote({ ...n, title, body });
      return { ok: true, summary: `Updated note "${title}"`, touched: [{ kind: 'note', id: n.id, title }] };
    },
  },
  {
    name: 'complete_tasks',
    risk: 'write',
    description: 'Mark tasks done, or open again with done false.',
    params: obj({ ids: list('Task ids.', s('Task id.'), { minItems: 1, maxItems: 100 }), done: bool('true = done (default), false = reopen.') }, ['ids']),
    verify: (a) => {
      for (const id of a.ids) if (!getTask(id)) return missing('task', id);
      return null;
    },
    preview: (a) => a.ids.map((id: string) => ({ kind: 'Task', verb: a.done === false ? 'Reopen' : 'Complete', text: getTask(id)?.t ?? id })),
    run: (a) => {
      const done = a.done === false ? 0 : 1;
      const touched: Result['touched'] = [];
      for (const id of a.ids as string[]) {
        const t = getTask(id);
        if (!t) continue;
        saveTask({ ...t, d: done });
        touched.push({ kind: 'task', id, title: t.t });
      }
      return { ok: true, summary: `${done ? 'Completed' : 'Reopened'} ${plural(touched.length, 'task')}`, touched };
    },
  },
  {
    name: 'reschedule',
    risk: 'write',
    description: 'Move tasks (due date), events (date, optional new start), goals (target date) or projects (deadline) to a new date.',
    params: obj(
      {
        items: list(
          'What to move.',
          obj({ kind: s('Item kind.', { enum: ['task', 'event', 'goal', 'project'] }), id: s('Item id.'), date: date('New date.'), time: time('Tasks: new deadline time. Events: new start (end moves with it).') }, ['kind', 'id', 'date']),
          { minItems: 1, maxItems: 100 },
        ),
      },
      ['items'],
    ),
    verify: (a) => {
      for (const it of a.items) {
        if (!exists(it.kind, it.id)) return missing(it.kind, it.id);
        if (it.time && (it.kind === 'goal' || it.kind === 'project')) return `A ${it.kind} has no time; leave time out.`;
      }
      return null;
    },
    preview: (a) => a.items.map((it: Args) => ({ kind: KIND_LABEL[it.kind as ItemKind], verb: 'Move', text: titleOfKind(it.kind, it.id) ?? it.id, detail: join(`to ${fmtDate(it.date)}`, it.time && fmtTime(it.time)) })),
    run: (a) => {
      const touched: Result['touched'] = [];
      for (const it of a.items as Args[]) {
        if (it.kind === 'task') {
          const t = getTask(it.id);
          if (t) saveTask({ ...t, due: it.date, ...(it.time ? { tm: it.time } : {}) });
        } else if (it.kind === 'event') {
          const e = getEvent(it.id);
          if (e) {
            const next: CalEvent = { ...e, d: it.date };
            if (it.time && !e.allDay) {
              if (e.end && e.tm) {
                const m = (x: string) => Number(x.split(':')[0]) * 60 + Number(x.split(':')[1]);
                const dur = m(e.end) - m(e.tm);
                const en = Math.min(m(it.time) + dur, 23 * 60 + 59);
                next.end = `${String(Math.floor(en / 60)).padStart(2, '0')}:${String(en % 60).padStart(2, '0')}`;
              }
              next.tm = it.time;
            }
            saveEvent(next);
          }
        } else if (it.kind === 'goal') {
          const g = getGoals().find((x) => x.id === it.id);
          if (g) saveGoal({ ...g, td: it.date });
        } else {
          const p = getProject(it.id);
          if (p) saveProject({ ...p, due: it.date });
        }
        touched.push({ kind: it.kind, id: it.id, title: titleOfKind(it.kind, it.id) ?? it.id });
      }
      return { ok: true, summary: `Moved ${plural(touched.length, 'item')}`, touched };
    },
  },
  {
    name: 'add_subtasks',
    risk: 'write',
    description: 'Add subtasks (steps) to an existing task.',
    params: obj({ task_id: s('Task id.'), subtasks: list('Subtask titles, one per step.', s('Subtask.', { max: 200 }), { minItems: 1, maxItems: 30 }) }, ['task_id', 'subtasks']),
    verify: (a) => (getTask(a.task_id) ? null : missing('task', a.task_id)),
    preview: (a) => a.subtasks.map((x: string) => ({ kind: 'Subtask', verb: 'Add', text: x.trim(), detail: `on ${getTask(a.task_id)?.t ?? a.task_id}` })),
    run: (a) => {
      const t = getTask(a.task_id);
      if (!t) return { ok: false, summary: 'Task not found', error: missing('task', a.task_id) };
      const sub = [...(t.sub ?? []), ...a.subtasks.map((x: string) => ({ t: x.trim(), d: 0 as const })).filter((x: { t: string }) => x.t)];
      saveTask({ ...t, sub });
      return { ok: true, summary: `Added ${plural(a.subtasks.length, 'subtask')} to "${t.t}"`, touched: [{ kind: 'task', id: t.id, title: t.t }] };
    },
  },
  {
    name: 'log_goal_progress',
    risk: 'write',
    description: 'Add to a measured goal\'s current count (e.g. +1 client, +250 dollars). Negative to correct. The goal must have a target.',
    params: obj({ goal_id: s('Goal id.'), amount: num('How much to add.') }, ['goal_id', 'amount']),
    verify: (a) => {
      const g = getGoals().find((x) => x.id === a.goal_id);
      if (!g) return missing('goal', a.goal_id);
      if (!g.tgt) return 'That goal has no target number. Set one with update_goal first, or use milestones.';
      return null;
    },
    preview: (a) => {
      const g = getGoals().find((x) => x.id === a.goal_id);
      return [{ kind: 'Goal', verb: 'Log', text: g?.t ?? a.goal_id, detail: g ? `${a.amount >= 0 ? '+' : ''}${a.amount}${g.unit ? ' ' + g.unit : ''} → ${Math.max(0, (g.cur ?? 0) + a.amount)} of ${g.tgt}` : undefined }];
    },
    run: (a) => {
      const g = getGoals().find((x) => x.id === a.goal_id);
      if (!g) return { ok: false, summary: 'Goal not found', error: missing('goal', a.goal_id) };
      const cur = Math.max(0, (g.cur ?? 0) + a.amount);
      saveGoal({ ...g, cur, ...(g.st === 'not-started' && cur > 0 ? { st: 'in-progress' as const } : {}) });
      return { ok: true, summary: `Logged progress on "${g.t}": ${cur} of ${g.tgt}`, touched: [{ kind: 'goal', id: g.id, title: g.t }] };
    },
  },
  {
    name: 'add_milestones',
    risk: 'write',
    description: 'Add dated checkpoints to a goal or a project.',
    params: obj({ kind: s('Goal or project.', { enum: ['goal', 'project'] }), id: s('Goal or project id.'), milestones: list('Milestones.', milestoneItem, { minItems: 1, maxItems: 30 }) }, ['kind', 'id', 'milestones']),
    verify: (a) => (exists(a.kind, a.id) ? null : missing(a.kind, a.id)),
    preview: (a) => a.milestones.map((m: Args) => ({ kind: 'Milestone', verb: 'Add', text: m.title.trim(), detail: join(m.date && fmtDate(m.date), `on ${titleOfKind(a.kind, a.id) ?? a.id}`) })),
    run: (a) => {
      const add = milestones(a.milestones) ?? [];
      if (a.kind === 'goal') {
        const g = getGoals().find((x) => x.id === a.id)!;
        saveGoal({ ...g, ms: [...(g.ms ?? []), ...add] });
      } else {
        const p = getProject(a.id)!;
        saveProject({ ...p, ms: [...(p.ms ?? []), ...add] });
      }
      const title = titleOfKind(a.kind, a.id) ?? a.id;
      return { ok: true, summary: `Added ${plural(add.length, 'milestone')} to "${title}"`, touched: [{ kind: a.kind, id: a.id, title }] };
    },
  },
  {
    name: 'link_to_project',
    risk: 'write',
    description: 'Put existing tasks, events, goals or notes into a project. An item lives in one project, so this moves it if it was in another.',
    params: obj(
      {
        project: projectField,
        items: list('Items to put in.', obj({ kind: s('Item kind.', { enum: LINKABLE }), id: s('Item id.') }, ['kind', 'id']), { minItems: 1, maxItems: 100 }),
      },
      ['project', 'items'],
    ),
    verify: (a, ctx) => {
      const e = checkProject(a.project, ctx, 'project');
      if (e) return e;
      for (const it of a.items) if (!exists(it.kind, it.id)) return missing(it.kind, it.id);
      return null;
    },
    preview: (a) => a.items.map((it: Args) => ({ kind: 'Link', verb: 'Link', text: titleOfKind(it.kind, it.id) ?? it.id, detail: `${it.kind} → ${getProject(a.project)?.n ?? `new project ${a.project}`}` })),
    run: (a, ctx) => {
      const pid = resolveProject(a.project, ctx);
      if (!pid) return { ok: false, summary: 'Project not found', error: `No project "${a.project}".` };
      for (const it of a.items as Args[]) linkItem(pid, it.kind, it.id);
      return { ok: true, summary: `Put ${plural(a.items.length, 'item')} in "${getProject(pid)?.n}"`, touched: [{ kind: 'project', id: pid, title: getProject(pid)?.n ?? '' }] };
    },
  },
  {
    name: 'unlink_from_project',
    risk: 'write',
    description: 'Take items out of whatever project they are in. The items themselves stay.',
    params: obj({ items: list('Items to take out.', obj({ kind: s('Item kind.', { enum: LINKABLE }), id: s('Item id.') }, ['kind', 'id']), { minItems: 1, maxItems: 100 }) }, ['items']),
    verify: (a) => {
      for (const it of a.items) {
        if (!exists(it.kind, it.id)) return missing(it.kind, it.id);
        if (!projectOf(it.kind, it.id)) return `${it.kind} "${titleOfKind(it.kind, it.id)}" is not in a project.`;
      }
      return null;
    },
    preview: (a) => a.items.map((it: Args) => ({ kind: 'Link', verb: 'Unlink', text: titleOfKind(it.kind, it.id) ?? it.id, detail: `out of ${projectOf(it.kind, it.id)?.n ?? 'its project'}` })),
    run: (a) => {
      for (const it of a.items as Args[]) unlinkItem(it.kind, it.id);
      return { ok: true, summary: `Took ${plural(a.items.length, 'item')} out of their project` };
    },
  },
];


const goalLinks: Action[] = [
  {
    name: 'link_to_goal',
    risk: 'write',
    description: 'Put existing tasks, events or notes under a goal (the steps that serve it). An item serves one goal, so this moves it if it was under another. Separate from projects: it can stay in its project too.',
    params: obj(
      {
        goal: goalField,
        items: list('Items to put under it.', obj({ kind: s('Item kind.', { enum: GOAL_KINDS }), id: s('Item id.') }, ['kind', 'id']), { minItems: 1, maxItems: 100 }),
      },
      ['goal', 'items'],
    ),
    verify: (a, ctx) => {
      const e = checkGoal(a.goal, ctx, 'goal');
      if (e) return e;
      for (const it of a.items) if (!exists(it.kind, it.id)) return missing(it.kind, it.id);
      return null;
    },
    preview: (a) => a.items.map((it: Args) => ({ kind: 'Link', verb: 'Link', text: titleOfKind(it.kind, it.id) ?? it.id, detail: `${it.kind} → goal ${getGoals().find((g) => g.id === a.goal)?.t ?? `new goal ${a.goal}`}` })),
    run: (a, ctx) => {
      const gid = resolveGoal(a.goal, ctx);
      if (!gid) return { ok: false, summary: 'Goal not found', error: `No goal "${a.goal}".` };
      for (const it of a.items as Args[]) linkToGoal(gid, it.kind, it.id);
      const title = getGoals().find((g) => g.id === gid)?.t ?? '';
      return { ok: true, summary: `Put ${plural(a.items.length, 'item')} under "${title}"`, touched: [{ kind: 'goal', id: gid, title }] };
    },
  },
  {
    name: 'unlink_from_goal',
    risk: 'write',
    description: 'Take tasks, events or notes out from under their goal. The items themselves stay.',
    params: obj({ items: list('Items to take out.', obj({ kind: s('Item kind.', { enum: GOAL_KINDS }), id: s('Item id.') }, ['kind', 'id']), { minItems: 1, maxItems: 100 }) }, ['items']),
    verify: (a) => {
      for (const it of a.items) {
        if (!exists(it.kind, it.id)) return missing(it.kind, it.id);
        if (!goalOf(it.kind, it.id)) return `${it.kind} "${titleOfKind(it.kind, it.id)}" is not under a goal.`;
      }
      return null;
    },
    preview: (a) => a.items.map((it: Args) => ({ kind: 'Link', verb: 'Unlink', text: titleOfKind(it.kind, it.id) ?? it.id, detail: `out of ${goalOf(it.kind, it.id)?.t ?? 'its goal'}` })),
    run: (a) => {
      for (const it of a.items as Args[]) unlinkFromGoal(it.kind, it.id);
      return { ok: true, summary: `Took ${plural(a.items.length, 'item')} out from under their goal` };
    },
  },
];

/* ───────────────────────── removes ───────────────────────── */

const removes: Action[] = [
  {
    name: 'delete_items',
    risk: 'danger',
    description:
      'Delete items. Only when the person clearly asked to delete. For a repeating event, scope "one" with date removes just that day; scope "series" removes them all. If it is unclear which, ask first.',
    params: obj(
      {
        items: list(
          'What to delete.',
          obj({ kind: s('Item kind.', { enum: ITEM_KINDS }), id: s('Item id.'), scope: s('Repeating events only.', { enum: ['one', 'series'] }), date: date('With scope "one": the day to remove.') }, ['kind', 'id']),
          { minItems: 1, maxItems: 100 },
        ),
      },
      ['items'],
    ),
    verify: (a) => {
      for (const it of a.items) {
        if (!exists(it.kind, it.id)) return missing(it.kind, it.id);
        if (it.kind === 'event' && getEvent(it.id)?.rep && !it.scope) return `"${getEvent(it.id)?.t}" repeats. Ask whether to delete just one day (scope "one" + date) or the whole series.`;
        if (it.scope === 'one' && !it.date) return 'scope "one" needs the date to remove.';
        if (it.scope && it.kind !== 'event') return 'scope is only for repeating events.';
      }
      return null;
    },
    preview: (a) => a.items.map((it: Args) => ({ kind: KIND_LABEL[it.kind as ItemKind], verb: it.scope === 'one' ? 'Skip' : 'Delete', text: titleOfKind(it.kind, it.id) ?? it.id, detail: it.scope === 'one' ? `only ${fmtDate(it.date)}` : it.scope === 'series' ? 'whole series' : undefined })),
    run: (a) => {
      let n = 0;
      for (const it of a.items as Args[]) {
        if (!exists(it.kind, it.id)) continue;
        if (it.kind === 'task') deleteTask(it.id);
        else if (it.kind === 'event') {
          if (it.scope === 'one') skipOccurrence(it.id, it.date);
          else {
            const e = getEvent(it.id)!;
            deleteEvent(e);
          }
        } else if (it.kind === 'goal') deleteGoal(it.id);
        else if (it.kind === 'project') deleteProject(it.id);
        else deleteNote(it.id);
        if (it.kind !== 'project' && !(it.kind === 'event' && it.scope === 'one')) unlinkItem(it.kind, it.id);
        n++;
      }
      return { ok: true, summary: `Deleted ${plural(n, 'item')}` };
    },
  },
];

export const REGISTRY: readonly Action[] = [...reads, ...creates, ...changes, ...goalLinks, ...removes];

const BY_NAME = new Map(REGISTRY.map((a) => [a.name, a]));
export function getAction(name: string): Action | undefined {
  return BY_NAME.get(name);
}
