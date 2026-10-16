/* Tasks full page — the mockup's pgTasks, rebuilt as React.
 *
 * List tabs (All + lists + new), active/completed/all seg, rows with
 * toggle + subtask counts + priority cycle + expand (subtasks with add +
 * toggle), Add task inline. No prompt(): inputs live in the page, like the
 * Library's folder naming.
 */

import { useState } from 'react';
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
  type Task,
  type TaskPriority,
} from '../tasks';
import type { PageProps } from './index';
import { QuickAdd } from '../components/QuickAdd';
import { fmtShort, fmtTime, type Quick } from '../quickadd';

type Filter = 'active' | 'completed' | 'all';
type Mode = 'list' | 'matrix';

const PR_COLOR: Record<TaskPriority, string> = {
  none: 'var(--mut)',
  important: 'var(--ac)',
  urgent: 'var(--am)',
  critical: 'var(--rd)',
};

export default function TasksPage(_props: PageProps) {
  void _props;
  const { notify } = useNav();
  const [list, setList] = useState('all');
  const [filter, setFilter] = useState<Filter>('active');
  const [tick, setTick] = useState(0);
  const [mode, setMode] = useState<Mode>('list');
  const [draft, setDraft] = useState<Task | null>(null);
  const [newList, setNewList] = useState('');
  const [addingList, setAddingList] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newSub, setNewSub] = useState('');
  const refresh = () => setTick((t) => t + 1);
  void tick;

  const lists = getLists();
  const tasks = getTasks()
    .filter((t) => (list === 'all' ? true : (t.list ?? 'inbox') === list))
    .filter((t) => (filter === 'all' ? true : filter === 'active' ? !t.d : !!t.d));

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
  return (
    <div>
      <QuickAdd
        kind="task"
        placeholder="Add a task — “Call Marcus tomorrow 4pm 30m !urgent #work”"
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
          onSave={(t) => {
            saveTask(t);
            setDraft(null);
            refresh();
            notify('Task saved.');
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
      </div>
      <div className="tkBar">
        <div className="calSeg" role="tablist" aria-label="Show">
          {(['active', 'completed', 'all'] as Filter[]).map((f) => (
            <button key={f} role="tab" aria-selected={filter === f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
              {f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div className="calSeg" role="tablist" aria-label="View">
          {(['list', 'matrix'] as Mode[]).map((m) => (
            <button key={m} role="tab" aria-selected={mode === m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
              {m === 'list' ? 'List' : 'Matrix'}
            </button>
          ))}
        </div>
      </div>
      {mode === 'matrix' ? (
        <Matrix tasks={tasks} refresh={refresh} onEdit={(t) => setDraft(t)} />
      ) : (
      <div className="card cardPad">
        {tasks.map((t) => (
          <TaskRow
            key={t.id}
            task={t}
            expanded={expanded === t.id}
            newSub={newSub}
            onNewSub={setNewSub}
            onToggleExpand={() => {
              setExpanded((e) => (e === t.id ? null : t.id));
              setNewSub('');
            }}
            onEdit={() => setDraft(t)}
            refresh={refresh}
          />
        ))}
        {tasks.length === 0 ? (
          <div className="s m">No tasks here yet. Type one line above — or tell Eumae in Chat and it lands here.</div>
        ) : null}
      </div>
      )}
    </div>
  );
}
function TaskRow({
  task,
  expanded,
  newSub,
  onNewSub,
  onToggleExpand,
  onEdit,
  refresh,
}: {
  task: Task;
  expanded: boolean;
  newSub: string;
  onNewSub: (s: string) => void;
  onToggleExpand: () => void;
  onEdit: () => void;
  refresh: () => void;
}) {
  const subs = task.sub ?? [];
  const pr = task.pr ?? 'none';
  const submitSub = () => {
    if (!newSub.trim()) return;
    addSubtask(task.id, newSub);
    onNewSub('');
    refresh();
  };
  return (
    <>
      <div className="task">
        <button
          className={'ck' + (task.d ? ' d' : '')}
          aria-label={task.d ? `Reopen ${task.t}` : `Done: ${task.t}`}
          onClick={() => {
            toggleTask(task.id);
            refresh();
          }}
        />
        <div className="g">
          <button className="tkTitle" onClick={onEdit}>
            {task.d ? <s className="m">{task.t}</s> : task.t}
          </button>
          <TaskMeta task={task} subs={subs.length ? `${subs.filter((s) => s.d).length}/${subs.length} subtasks` : ''} />
        </div>
        <button
          className="fb"
          style={{ color: PR_COLOR[pr] }}
          aria-label={`Priority ${pr}, tap to change`}
          onClick={() => {
            cyclePriority(task.id);
            refresh();
          }}
        >
          {pr === 'none' ? '—' : pr}
        </button>
        <button className="fb gho" aria-label={expanded ? 'Collapse' : 'Expand'} onClick={onToggleExpand}>
          ▾
        </button>
      </div>
      {expanded ? (
        <div style={{ padding: '0 0 8px 35px' }}>
          {subs.map((s, i) => (
            <div key={i} className="task">
              <button
                className={'ck' + (s.d ? ' d' : '')}
                aria-label={s.d ? `Reopen ${s.t}` : `Done: ${s.t}`}
                onClick={() => {
                  toggleSubtask(task.id, i);
                  refresh();
                }}
              />
              <div className="g s">{s.d ? <s className="m">{s.t}</s> : s.t}</div>
            </div>
          ))}
          <span style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <input
              className="lib2-search"
              placeholder="New subtask"
              value={newSub}
              onChange={(e) => onNewSub(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitSub();
              }}
              aria-label="New subtask"
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

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const DOW3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/* One quiet line: when, how long, repeat, subtasks. Overdue reads red. */
function TaskMeta({ task, subs }: { task: Task; subs: string }) {
  const bits: string[] = [];
  const today = todayYmd();
  let late = false;
  if (task.due) {
    late = !task.d && task.due < today;
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
  return <div className="xs m" style={late ? { color: 'var(--rd)' } : undefined}>{bits.join(' · ')}</div>;
}

/* Full task fields (wove's add modal, distilled). */
function TaskForm({ task, lists, onSave, onCancel }: {
  task: Task; lists: { id: string; n: string }[]; onSave: (t: Task) => void; onCancel: () => void;
}) {
  const [t, setT] = useState<Task>(task);
  const set = (p: Partial<Task>) => setT((x) => ({ ...x, ...p }));
  const days = t.repDays && t.repDays.length ? t.repDays : t.due ? [new Date(t.due + 'T12:00').getDay()] : [];
  return (
    <div className="card evForm">
      <b>{task.t === 'New task' && !task.due ? 'New task' : 'Task'}</b>
      <input className="sinput" value={t.t} onChange={(e) => set({ t: e.target.value })} aria-label="Task" autoFocus />
      <div className="evRow">
        <label>
          <span className="xs m">Due</span>
          <input className="sinput" type="date" value={t.due ?? ''} onChange={(e) => set({ due: e.target.value || undefined })} />
        </label>
        <label>
          <span className="xs m">Time</span>
          <input className="sinput" type="time" value={t.tm ?? ''} onChange={(e) => set({ tm: e.target.value || undefined })} />
        </label>
        <label>
          <span className="xs m">Estimate (min)</span>
          <input className="sinput" type="number" min={5} step={5} value={t.est ?? ''} onChange={(e) => set({ est: e.target.value ? +e.target.value : undefined })} />
        </label>
      </div>
      <div className="evRow">
        <label>
          <span className="xs m">Priority</span>
          <select className="sinput" value={t.pr ?? 'none'} onChange={(e) => set({ pr: e.target.value as TaskPriority })}>
            <option value="none">None</option>
            <option value="important">Important</option>
            <option value="urgent">Urgent</option>
            <option value="critical">Critical (urgent + important)</option>
          </select>
        </label>
        <label>
          <span className="xs m">List</span>
          <select className="sinput" value={t.list ?? 'inbox'} onChange={(e) => set({ list: e.target.value })}>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>{l.n}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="xs m">Repeat</span>
          <select className="sinput" value={t.rep ?? 'none'} onChange={(e) => set({ rep: e.target.value as Task['rep'] })}>
            <option value="none">Does not repeat</option>
            <option value="daily">Every day</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>
      </div>
      {t.rep === 'weekly' ? (
        <div className="evDays" aria-label="Repeat on">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((l, i) => {
            const on = days.includes(i);
            return (
              <button key={i} className={on ? 'on' : ''} aria-pressed={on}
                onClick={() => {
                  const next = on ? days.filter((d) => d !== i) : [...days, i].sort();
                  set({ repDays: next.length ? next : undefined });
                }}>
                {l}
              </button>
            );
          })}
        </div>
      ) : null}
      {t.rep && t.rep !== 'none' ? (
        <div className="evRow">
          <label>
            <span className="xs m">Repeat until</span>
            <input className="sinput" type="date" value={t.repUntil ?? ''} onChange={(e) => set({ repUntil: e.target.value || undefined })} />
          </label>
        </div>
      ) : null}
      <div className="btns">
        <button className="pri" onClick={() => t.t.trim() && onSave({ ...t, t: t.t.trim() })}>Save task</button>
        <button className="gho" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

/* Eisenhower matrix on the existing priority field:
   critical = Do first, important = Schedule, urgent = Delegate, none = Later.
   Drag a task to another box to change its priority. */
const QUADS: { pr: TaskPriority; title: string; sub: string }[] = [
  { pr: 'critical', title: 'Do first', sub: 'Urgent and important' },
  { pr: 'important', title: 'Schedule', sub: 'Important, not urgent' },
  { pr: 'urgent', title: 'Delegate', sub: 'Urgent, not important' },
  { pr: 'none', title: 'Later', sub: 'Not urgent, not important' },
];

function Matrix({ tasks, refresh, onEdit }: { tasks: Task[]; refresh: () => void; onEdit: (t: Task) => void }) {
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<TaskPriority | null>(null);
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
              <div key={t.id} className="task" draggable onDragStart={() => setDrag(t.id)} onDragEnd={() => { setDrag(null); setOver(null); }}>
                <button
                  className={'ck' + (t.d ? ' d' : '')}
                  aria-label={t.d ? `Reopen ${t.t}` : `Done: ${t.t}`}
                  onClick={() => {
                    toggleTask(t.id);
                    refresh();
                  }}
                />
                <div className="g">
                  <button className="tkTitle" onClick={() => onEdit(t)}>
                    {t.d ? <s className="m">{t.t}</s> : t.t}
                  </button>
                  <TaskMeta task={t} subs="" />
                </div>
              </div>
            ))}
            {rows.length === 0 ? <div className="xs m">Drag a task here.</div> : null}
          </div>
        );
      })}
    </div>
  );
}
