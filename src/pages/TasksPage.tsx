/* Tasks full page — the mockup's pgTasks, rebuilt as React.
 *
 * List tabs (All + lists + new), active/completed/all seg, rows with
 * toggle + subtask counts + priority cycle + expand (subtasks with add +
 * toggle), Add task inline. No prompt(): inputs live in the page, like the
 * Library's folder naming.
 */

import { rowTap } from '../rowTap';
import { useEffect, useState } from 'react';
import { useNav } from '../nav';
import {
  getTasks,
  getLists,
  addList,
  createTask,
  saveTask,
  toggleTask,
  deleteTask,
  cyclePriority,
  toggleSubtask,
  addSubtask,
  renameSubtask,
  deleteSubtask,
  renameList,
  deleteList,
  getTask,
  snapshotTasks,
  restoreTasks,
  type Task,
  type TaskPriority,
} from '../tasks';
import type { PageProps } from './index';
import { QuickAdd } from '../components/QuickAdd';
import { fmtShort, fmtTime, type Quick } from '../quickadd';
import { ItemMenu, ProjectChip } from '../components/ItemMenu';
import { projectOf, linkedIds } from '../projects';
import { getGoals } from '../goals';
import { setFocus, onEditTask, onDataChange, openOfficeEdit } from '../focus';
import { TaskForm } from '../components/TaskForm';
import { isOverdue } from '../due';

type Mode = 'day' | 'project' | 'goal' | 'matrix' | 'done';
const MODES: { id: Mode; label: string }[] = [
  { id: 'day', label: 'By day' },
  { id: 'project', label: 'By project' },
  { id: 'goal', label: 'By goal' },
  { id: 'matrix', label: 'Matrix' },
  { id: 'done', label: 'Done' },
];

const PR_WORD: Record<TaskPriority, string> = { none: 'none', important: 'Important', urgent: 'Urgent', critical: 'Critical' };

const PR_COLOR: Record<TaskPriority, string> = {
  none: 'var(--mut)',
  important: 'var(--ac)',
  urgent: 'var(--am)',
  critical: 'var(--rd)',
};

export default function TasksPage({ arg }: PageProps) {
  const { notify, openPanel } = useNav();
  const [list, setList] = useState('all');
  const [tick, setTick] = useState(0);
  const [mode, setMode] = useState<Mode>('day');
  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState<Set<string>>(() => new Set());
  /* Opened with a task id (from a project): land on that task's form. */
  const [draft, setDraft] = useState<Task | null>(() => (typeof arg === 'string' ? getTask(arg) ?? null : null));
  const [newList, setNewList] = useState('');
  const [addingList, setAddingList] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newSub, setNewSub] = useState('');
  const [editLists, setEditLists] = useState(false);
  const refresh = () => setTick((t) => t + 1);
  useEffect(() => onDataChange(refresh), []);
  void tick;
  /* Edit from Mae's office opens the form right here. */
  useEffect(
    () =>
      onEditTask((id) => {
        /* A second tap on Edit closes the form again. */
        const t = getTask(id);
        setDraft((d) => (d?.id === id ? null : t ?? null));
      }),
    [],
  );
  /* Tap a task: it opens read-only in Mae's office (the sheet on a phone). */
  const openItem = (t: Task) => {
    setFocus({ k: 'task', id: t.id });
    openPanel('item');
  };
  const toggleSel = (id: string) =>
    setSel((s0) => {
      const n = new Set(s0);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const endSelect = () => {
    setSelecting(false);
    setSel(new Set());
  };

  const lists = getLists();
  const tasks = getTasks()
    .filter((t) => (list === 'all' ? true : (t.list ?? 'inbox') === list))
    .filter((t) => (mode === 'done' ? !!t.d : !t.d));

  /* Quick add: the parsed line becomes a full task. A #list that doesn't
     exist yet is created, so "#work" just works. */
  const fromQuick = (q: Quick): Task => {
    const t = createTask(q.title);
    let listId = list !== 'all' ? list : t.list;
    if (q.list) {
      const hit = getLists().find((l) => l.n.toLowerCase() === q.list || l.id === q.list);
      listId = hit ? hit.id : (addList(q.list[0].toUpperCase() + q.list.slice(1))?.id ?? listId);
    }
    return {
      ...t,
      list: listId,
      due: q.date ?? (q.time ? todayYmd() : undefined),
      tm: q.time,
      est: q.mins,
      pr: q.pr ?? 'none',
      rep: q.rep ? q.rep.f : undefined,
      repDays: q.rep?.days,
      repUntil: q.rep?.until,
    };
  };
  const addQuick = (q: Quick) => {
    const t = fromQuick(q);
    saveTask(t);
    refresh();
    notify(`Added ${t.t}${t.due ? ' · ' + fmtShort(t.due) : ''}${t.tm ? ' ' + fmtTime(t.tm) : ''}`);
  };

  const submitList = () => {
    const added = addList(newList);
    if (!added) {
      notify('Name it first.');
      return;
    }
    setNewList('');
    setAddingList(false);
    setList(added.id);
    refresh();
  };

  /* Deletes snapshot the store first; the toast's Undo puts it back. */
  const undoable = (msg: string, act: () => boolean | void) => {
    const snap = snapshotTasks();
    if (act() === false) return;
    refresh();
    notify(msg, {
      undo: () => {
        restoreTasks(snap);
        refresh();
      },
    });
  };
  const removeList = (id: string) =>
    undoable('List deleted. Its tasks moved to ' + lists[0].n + '.', () => {
      const ok = deleteList(id);
      if (ok && list === id) setList('all');
      return ok;
    });

  return (
    <div className="qaPage">
      <QuickAdd
        kind="task"
        placeholder="New task"
        hint="Type it how you'd say it: “Call Marcus tomorrow 4pm 30m !urgent #work”"
        onAdd={addQuick}
        onMore={(q) => {
          const t = fromQuick(q.title.trim() ? q : { ...q, title: 'New task' });
          deleteTask(t.id); /* fromQuick saved a stub; the form saves for real */
          setDraft(t);
        }}
      />
      {draft ? (
        <TaskForm
          task={draft}
          lists={lists}
          onCancel={() => setDraft(null)}
          onDelete={
            getTask(draft.id)
              ? () => {
                  const id = draft.id;
                  setDraft(null);
                  undoable('Task deleted.', () => deleteTask(id));
                }
              : undefined
          }
          onSave={(t) => {
            const before = getTask(t.id);
            saveTask(t);
            setDraft(null);
            refresh();
            notify(before ? 'Task saved.' : 'Task added.', {
              undo: () => {
                if (before) saveTask(before);
                else deleteTask(t.id);
                refresh();
              },
            });
          }}
        />
      ) : null}
      <div className="ftabs">
        <button className={list === 'all' ? 'on' : ''} onClick={() => setList('all')}>
          All
        </button>
        {lists.map((l) => (
          <button key={l.id} className={list === l.id ? 'on' : ''} onClick={() => setList(l.id)}>
            {l.n}
          </button>
        ))}
        {addingList ? (
          <span style={{ display: 'flex', gap: 6, flex: 'none' }}>
            <input
              className="lib2-search"
              placeholder="List name"
              value={newList}
              onChange={(e) => setNewList(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitList();
                if (e.key === 'Escape') setAddingList(false);
              }}
              aria-label="New list name"
            />
            <button className="on" onClick={submitList}>
              Add
            </button>
          </span>
        ) : (
          <button className="gho" onClick={() => setAddingList(true)}>
            + List
          </button>
        )}
        <button className={editLists ? 'on' : 'gho'} onClick={() => setEditLists((v) => !v)}>
          {editLists ? 'Done' : 'Edit'}
        </button>
      </div>
      {editLists ? (
        <div className="card cardPad">
          {lists.map((l, i) => (
            <span key={l.id} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <input
                className="lib2-search"
                defaultValue={l.n}
                aria-label={`Rename ${l.n}`}
                onBlur={(e) => {
                  if (e.target.value.trim() && e.target.value.trim() !== l.n) {
                    renameList(l.id, e.target.value);
                    refresh();
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                }}
              />
              {i === 0 ? (
                <span className="xs m" style={{ alignSelf: 'center' }}>Default</span>
              ) : (
                <button className="fb gho danger" onClick={() => removeList(l.id)}>
                  Delete
                </button>
              )}
            </span>
          ))}
        </div>
      ) : null}
      <div className="tkBar">
        <div className="calSeg" role="tablist" aria-label="View">
          {MODES.map((m) => (
            <button key={m.id} role="tab" aria-selected={mode === m.id} className={mode === m.id ? 'on' : ''} onClick={() => setMode(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
        {mode !== 'matrix' ? (
          <button className={'fact tkSelBtn' + (selecting ? ' on' : '')} onClick={() => (selecting ? endSelect() : setSelecting(true))}>
            {selecting ? 'Cancel' : 'Select'}
          </button>
        ) : null}
      </div>
      {selecting && sel.size ? (
        <div className="tkBulk" role="toolbar" aria-label="Selected tasks">
          <b>{sel.size} selected</b>
          <button
            className="pri"
            onClick={() => {
              const ids = [...sel];
              undoable(`${ids.length} marked ${mode === 'done' ? 'not done' : 'done'}.`, () => ids.forEach((id) => toggleTask(id)));
              endSelect();
            }}
          >
            {mode === 'done' ? 'Reopen' : 'Done'}
          </button>
          <button
            onClick={() => {
              const ids = [...sel];
              const tm = new Date();
              tm.setDate(tm.getDate() + 1);
              const due = ymdOf(tm);
              undoable(`${ids.length} moved to tomorrow.`, () => ids.forEach((id) => { const t = getTask(id); if (t) saveTask({ ...t, due }); }));
              endSelect();
            }}
          >
            Tomorrow
          </button>
          <button
            className="danger"
            onClick={() => {
              const ids = [...sel];
              undoable(`${ids.length} deleted.`, () => ids.forEach((id) => deleteTask(id)));
              endSelect();
            }}
          >
            Delete
          </button>
        </div>
      ) : null}
      {mode === 'matrix' ? (
        <Matrix tasks={tasks} refresh={refresh} onEdit={(t) => { openOfficeEdit('task', t.id); openPanel('item'); }} onDelete={(t) => undoable('Task deleted.', () => deleteTask(t.id))} />
      ) : (
        <div className="tkList">
          {groupTasks(tasks, mode).map((g) => (
            <section key={g.label} className="tkGroup">
              <div className={'sdiv tkH' + (g.red ? ' att' : '')}>
                <span>{g.label}</span>
                <span className="fmeta">{g.tasks.length}</span>
              </div>
              {g.tasks.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  side={sideLabel(t, mode)}
                  selecting={selecting}
                  selected={sel.has(t.id)}
                  onSelect={() => toggleSel(t.id)}
                  onOpen={() => openItem(t)}
                  expanded={expanded === t.id}
                  newSub={newSub}
                  onNewSub={setNewSub}
                  onToggleExpand={() => {
                    setExpanded((e) => (e === t.id ? null : t.id));
                    setNewSub('');
                  }}
                  onEdit={() => { openOfficeEdit('task', t.id); openPanel('item'); }}
                  onDelete={() => undoable('Task deleted.', () => deleteTask(t.id))}
                  onDeleteSub={(i) => undoable('Subtask deleted.', () => deleteSubtask(t.id, i))}
                  refresh={refresh}
                />
              ))}
            </section>
          ))}
          {tasks.length === 0 ? (
            <p className="oIntro">
              {mode === 'done' ? 'Nothing done here yet.' : 'No tasks here yet. Type one line above, or tell Eumae in Chat and it lands here.'}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
function TaskRow({
  task,
  side,
  selecting,
  selected,
  onSelect,
  onOpen,
  expanded,
  newSub,
  onNewSub,
  onToggleExpand,
  onEdit,
  onDelete,
  onDeleteSub,
  refresh,
}: {
  task: Task;
  side: { text: string; red?: boolean };
  selecting: boolean;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  expanded: boolean;
  newSub: string;
  onNewSub: (s: string) => void;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDeleteSub: (index: number) => void;
  refresh: () => void;
}) {
  const { notify } = useNav();
  const [leaving, setLeaving] = useState(false);
  const [editSub, setEditSub] = useState<number | null>(null);
  const [subText, setSubText] = useState('');
  const saveSub = () => {
    if (editSub !== null && subText.trim()) renameSubtask(task.id, editSub, subText);
    setEditSub(null);
    refresh();
  };
  const subs = task.sub ?? [];
  const pr = task.pr ?? 'none';
  const project = projectOf('task', task.id);
  const listName = task.list && task.list !== 'inbox' ? getLists().find((l) => l.id === task.list)?.n : undefined;
  const pill = project?.n ?? listName;
  const submitSub = () => {
    if (!newSub.trim()) return;
    addSubtask(task.id, newSub);
    onNewSub('');
    refresh();
  };
  return (
    <>
      <div className={'frow top tkRow tapRow' + (leaving ? ' leaving' : '') + (selected ? ' sel' : '')} onClick={selecting ? onSelect : rowTap(onOpen)}>
        {selecting ? (
          <span className={'tkBox' + (selected ? ' on' : '')} role="checkbox" aria-checked={selected} aria-label={`Select ${task.t}`}>
            {selected ? '✓' : ''}
          </span>
        ) : (
          <button
            className={'fchk' + (task.d || leaving ? ' on' : '')}
            aria-label={task.d ? `Reopen ${task.t}` : `Done: ${task.t}`}
            onClick={() => complete(task, leaving, setLeaving, refresh)}
          />
        )}
        <div className="ft">
          <button className="tlT" onClick={selecting ? undefined : onOpen}>
            <span className={task.d || leaving ? 'tlDone' : ''}>{task.t}</span>
          </button>
          <TaskMeta task={task} subs={subs.length ? `${subs.filter((s) => s.d).length}/${subs.length} steps` : ''} hideDate />
        </div>
        {pr !== 'none' ? (
          <span className="tkPrL" style={{ color: PR_COLOR[pr] }} title={`Priority: ${PR_WORD[pr]}`}>
            <i style={{ background: PR_COLOR[pr] }} />
            {PR_WORD[pr]}
          </span>
        ) : null}
        {pill ? <span className="tkPill">{pill}</span> : null}
        <span className={'fmeta' + (side.red ? ' over' : '')}>{side.text}</span>
        {!selecting ? (
          <ItemMenu
            name={task.t}
            open={onOpen}
            edit={onEdit}
            extra={[
              { label: expanded ? 'Hide steps' : 'Steps', onClick: onToggleExpand },
              {
                label: `Priority: ${pr === 'none' ? 'none' : pr} → next`,
                onClick: () => {
                  const was = task.pr ?? 'none';
                  const now = cyclePriority(task.id) ?? 'none';
                  refresh();
                  notify(`Priority: ${PR_WORD[now]}.`, {
                    undo: () => {
                      saveTask({ ...getTask(task.id)!, pr: was });
                      refresh();
                    },
                  });
                },
              },
            ]}
            link={{ k: 'task', id: task.id }}
            onChange={refresh}
            onDelete={onDelete}
          />
        ) : null}
      </div>
      {expanded ? (
        <div className="tkSubs">
          {subs.map((s, i) => (
            <div key={i} className="frow">
              <button
                className={'fchk' + (s.d ? ' on' : '')}
                aria-label={s.d ? `Reopen ${s.t}` : `Done: ${s.t}`}
                onClick={() => {
                  toggleSubtask(task.id, i);
                  refresh();
                }}
              />
              {editSub === i ? (
                <input
                  className="lib2-search g"
                  value={subText}
                  autoFocus
                  onChange={(e) => setSubText(e.target.value)}
                  onBlur={saveSub}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveSub();
                    if (e.key === 'Escape') setEditSub(null);
                  }}
                  aria-label="Edit step"
                />
              ) : (
                <button
                  className="ft tlT"
                  aria-label={`Edit ${s.t}`}
                  onClick={() => {
                    setEditSub(i);
                    setSubText(s.t);
                  }}
                >
                  <span className={s.d ? 'tlDone' : ''}>{s.t}</span>
                </button>
              )}
              <button className="fb gho danger" aria-label={`Delete ${s.t}`} onClick={() => onDeleteSub(i)}>
                ×
              </button>
            </div>
          ))}
          <span style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <input
              className="lib2-search"
              placeholder="New step"
              value={newSub}
              onChange={(e) => onNewSub(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitSub();
              }}
              aria-label="New step"
            />
            <button className="fb" onClick={submitSub}>
              Add
            </button>
          </span>
        </div>
      ) : null}
    </>
  );
}

function ymdOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDaysYmd(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return ymdOf(d);
}

type Group = { label: string; tasks: Task[]; red?: boolean };

const byDue = (a: Task, b: Task) =>
  (a.due ?? '9999').localeCompare(b.due ?? '9999') || (a.tm ?? '99').localeCompare(b.tm ?? '99');

/* By day: Overdue, Today, Tomorrow, This week, Later, Someday. By project and
   by goal: one group per project or goal (a task's goal is its project's
   goal), then the ones with none. Done: newest first in one group. */
function groupTasks(tasks: Task[], mode: Mode): Group[] {
  const sorted = [...tasks].sort(byDue);
  if (mode === 'done') return sorted.length ? [{ label: 'Done', tasks: sorted.reverse() }] : [];
  if (mode === 'day') {
    const today = ymdOf(new Date());
    const tmw = addDaysYmd(1);
    const wk = addDaysYmd(7);
    const g: Group[] = [
      { label: 'Overdue', tasks: [], red: true },
      { label: 'Today', tasks: [] },
      { label: 'Tomorrow', tasks: [] },
      { label: 'This week', tasks: [] },
      { label: 'Later', tasks: [] },
      { label: 'Someday', tasks: [] },
    ];
    for (const t of sorted) {
      const d = t.due;
      const i = !d ? 5 : isOverdue(t) ? 0 : d === today ? 1 : d === tmw ? 2 : d <= wk ? 3 : 4;
      g[i].tasks.push(t);
    }
    return g.filter((x) => x.tasks.length);
  }
  const goals = getGoals();
  const map = new Map<string, Task[]>();
  const none: Task[] = [];
  for (const t of sorted) {
    const p = projectOf('task', t.id);
    let key: string | undefined;
    if (mode === 'project') key = p?.n;
    else {
      const gid = p ? linkedIds(p.id, 'goal')[0] : undefined;
      key = gid ? goals.find((x) => x.id === gid)?.t : undefined;
    }
    if (!key) none.push(t);
    else map.set(key, [...(map.get(key) ?? []), t]);
  }
  const out: Group[] = [...map.entries()].map(([label, ts]) => ({ label, tasks: ts }));
  if (none.length) out.push({ label: mode === 'project' ? 'No project' : 'No goal', tasks: none });
  return out;
}

/* The right-hand word on a row: the time today, the weekday this week, the
   date further out; red when overdue. */
function sideLabel(t: Task, mode: Mode): { text: string; red?: boolean } {
  const time = t.tm ? fmtTime(t.tm) : '';
  if (!t.due) return { text: mode === 'day' ? 'Anytime' : '' };
  const today = ymdOf(new Date());
  const day = new Date(t.due + 'T12:00');
  const dow = day.toLocaleDateString(undefined, { weekday: 'short' });
  if (isOverdue(t)) return { text: t.due === today ? time : dow + (time ? ' ' + time : ''), red: true };
  if (mode === 'day') {
    /* His screenshot (Oct 19): the group header says the day, so the row
       shows the time today and tomorrow, the weekday this week, the date later. */
    const tmw = new Date();
    tmw.setDate(tmw.getDate() + 1);
    const wk = new Date();
    wk.setDate(wk.getDate() + 7);
    if (t.due === today || t.due === ymdOf(tmw)) return { text: time || 'Anytime' };
    if (t.due <= ymdOf(wk)) return { text: dow + (time ? ' ' + time : '') };
    return { text: day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) };
  }
  /* Other views have no day header, so keep the full day. */
  return { text: fmtShort(t.due) + (time && mode !== 'done' ? ' · ' + time : '') };
}

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const DOW3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/* One quiet line: when, how long, repeat, subtasks. Overdue reads red. */
function TaskMeta({ task, subs, hideDate }: { task: Task; subs: string; hideDate?: boolean }) {
  const bits: string[] = [];
  const today = todayYmd();
  let late = false;
  if (task.due && !hideDate) {
    late = isOverdue(task);
    const tmw = new Date();
    tmw.setDate(tmw.getDate() + 1);
    const tomorrow = `${tmw.getFullYear()}-${String(tmw.getMonth() + 1).padStart(2, '0')}-${String(tmw.getDate()).padStart(2, '0')}`;
    bits.push((task.due === today ? 'Today' : task.due === tomorrow ? 'Tomorrow' : fmtShort(task.due)) + (task.tm ? ' ' + fmtTime(task.tm) : ''));
  }
  if (task.est) bits.push(task.est >= 60 ? `${+(task.est / 60).toFixed(1)}h` : `${task.est}m`);
  if (task.rep && task.rep !== 'none')
    bits.push('↻ ' + (task.rep === 'weekly' && task.repDays?.length ? task.repDays.map((d) => DOW3[d]).join(' ') : task.rep));
  if (subs) bits.push(subs);
  if (!bits.length) return null;
  return <div className="fsub" style={late ? { color: 'var(--rd)' } : undefined}>{bits.join(' · ')}</div>;
}

/* Full task fields (wove's add modal, distilled). */
/* Eisenhower matrix on the existing priority field:
   critical = Do first, important = Schedule, urgent = Delegate, none = Later.
   Drag a task to another box to change its priority. */
const QUADS: { pr: TaskPriority; title: string; sub: string }[] = [
  { pr: 'critical', title: 'Do first', sub: 'Urgent and important' },
  { pr: 'important', title: 'Schedule', sub: 'Important, not urgent' },
  { pr: 'urgent', title: 'Delegate', sub: 'Urgent, not important' },
  { pr: 'none', title: 'Later', sub: 'Not urgent, not important' },
];

function Matrix({ tasks, refresh, onEdit, onDelete }: { tasks: Task[]; refresh: () => void; onEdit: (t: Task) => void; onDelete: (t: Task) => void }) {
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<TaskPriority | null>(null);
  const { notify } = useNav();
  return (
    <div className="mtx">
      {QUADS.map((q) => {
        const rows = tasks.filter((t) => (t.pr ?? 'none') === q.pr);
        return (
          <div
            key={q.pr}
            className={'card mtxQ' + (over === q.pr ? ' over' : '')}
            onDragOver={(e) => {
              if (!drag) return;
              e.preventDefault();
              setOver(q.pr);
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              const t = tasks.find((x) => x.id === drag);
              if (t && (t.pr ?? 'none') !== q.pr) {
                saveTask({ ...t, pr: q.pr });
                refresh();
                notify(`Moved to ${q.title}.`, { undo: () => { saveTask(t); refresh(); } });
              }
              setDrag(null);
              setOver(null);
            }}
          >
            <div className="mtxH">
              <i style={{ background: PR_COLOR[q.pr] }} />
              <b>{q.title}</b>
              <span className="xs m">{rows.length}</span>
            </div>
            <div className="xs m" style={{ marginBottom: 6 }}>{q.sub}</div>
            {rows.map((t) => (
              <MatrixRow key={t.id} t={t} refresh={refresh} onEdit={onEdit} onDelete={onDelete} onDrag={setDrag} onEnd={() => { setDrag(null); setOver(null); }} />
            ))}
            {rows.length === 0 ? <div className="xs m">Drag a task here.</div> : null}
          </div>
        );
      })}
    </div>
  );
}

function MatrixRow({ t, refresh, onEdit, onDelete, onDrag, onEnd }: {
  t: Task; refresh: () => void; onEdit: (t: Task) => void; onDelete: (t: Task) => void; onDrag: (id: string) => void; onEnd: () => void;
}) {
  const [leaving, setLeaving] = useState(false);
  return (
              <div className={'task' + (leaving ? ' leaving' : '')} draggable onDragStart={() => onDrag(t.id)} onDragEnd={onEnd}>
                <button
                  className={'ck' + (t.d || leaving ? ' d' : '')}
                  aria-label={t.d ? `Reopen ${t.t}` : `Done: ${t.t}`}
                  onClick={() => complete(t, leaving, setLeaving, refresh)}
                />
                <div className="g">
                  <button className="tkTitle" onClick={() => onEdit(t)}>
                    {t.d ? <s className="m">{t.t}</s> : <span className="strike">{t.t}</span>}
                  </button>
                  <TaskMeta task={t} subs="" />
                  <ProjectChip k="task" id={t.id} />
                </div>
                <ItemMenu name={t.t} edit={() => onEdit(t)} link={{ k: 'task', id: t.id }} onChange={refresh} onDelete={() => onDelete(t)} />
              </div>
  );
}

/* Done: the check fills, a line draws through the title, then the row
   fades and folds away (~0.9s) before the list drops it. Reopening is
   instant. Reduced motion skips straight to done. */
function complete(t: Task, leaving: boolean, setLeaving: (v: boolean) => void, refresh: () => void) {
  if (leaving) return;
  if (t.d || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    toggleTask(t.id);
    refresh();
    return;
  }
  setLeaving(true);
  window.setTimeout(() => {
    toggleTask(t.id);
    setLeaving(false);
    refresh();
  }, 900);
}
