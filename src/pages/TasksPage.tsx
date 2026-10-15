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
  cyclePriority,
  toggleSubtask,
  addSubtask,
  type Task,
  type TaskPriority,
} from '../tasks';
import type { PageProps } from './index';

type Filter = 'active' | 'completed' | 'all';

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
  const [newTask, setNewTask] = useState('');
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

  const submitTask = () => {
    const v = newTask.trim();
    if (!v) return;
    const t = createTask(v);
    if (list !== 'all') saveTask({ ...t, list });
    setNewTask('');
    refresh();
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
      <div className="seg">
        {(['active', 'completed', 'all'] as Filter[]).map((f) => (
          <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
            {f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>
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
            refresh={refresh}
          />
        ))}
        {tasks.length === 0 ? (
          <div className="s m">No tasks here yet. Add one below — or tell Eumae in Chat and it lands here.</div>
        ) : null}
      </div>
      <div className="btns">
        <span className="g" style={{ display: 'flex', gap: 8, flex: 1 }}>
          <input
            className="lib2-search"
            placeholder="New task"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitTask();
            }}
            aria-label="New task"
          />
          <button className="pri" onClick={submitTask}>
            Add task
          </button>
        </span>
      </div>
    </div>
  );
}
function TaskRow({
  task,
  expanded,
  newSub,
  onNewSub,
  onToggleExpand,
  refresh,
}: {
  task: Task;
  expanded: boolean;
  newSub: string;
  onNewSub: (s: string) => void;
  onToggleExpand: () => void;
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
          <div>{task.d ? <s className="m">{task.t}</s> : task.t}</div>
          {subs.length ? (
            <div className="xs m">
              {subs.filter((s) => s.d).length}/{subs.length} subtasks
            </div>
          ) : null}
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
