/* Goals full page — same shape as Tasks and Events.
 *
 * One-line add ("Run a half marathon by Mar 1" -> goal + target date),
 * a status segment, one card of rows. The status dot cycles
 * not started -> in progress -> done; tap a goal to edit everything.
 */

import { useState } from 'react';
import { useNav } from '../nav';
import { getGoals, createGoal, saveGoal, deleteGoal, snapshotGoals, restoreGoals, type Goal, type GoalStatus } from '../goals';
import { ItemMenu, ProjectChip } from '../components/ItemMenu';
import { undoable } from '../undo';
import { QuickAdd } from '../components/QuickAdd';
import { MilestonesEditor } from '../components/Milestones';
import { nextMilestone } from '../milestones';
import { fmtShort } from '../quickadd';
import type { PageProps } from './index';

type Filter = 'all' | GoalStatus;
const FILTERS: Filter[] = ['all', 'in-progress', 'not-started', 'completed'];
const LABEL: Record<Filter, string> = {
  all: 'All',
  'not-started': 'Not started',
  'in-progress': 'In progress',
  completed: 'Done',
};
const ORDER: GoalStatus[] = ['not-started', 'in-progress', 'completed'];

function daysLeft(td: string): number {
  const now = new Date();
  const a = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const [y, m, d] = td.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - a) / 86400000);
}

export default function GoalsPage({ arg }: PageProps) {
  const { notify } = useNav();
  const [filter, setFilter] = useState<Filter>('all');
  const [tick, setTick] = useState(0);
  const [edit, setEdit] = useState<Goal | null>(() => (typeof arg === 'string' ? getGoals().find((g) => g.id === arg) ?? null : null));
  const refresh = () => setTick((t) => t + 1);
  void tick;

  const all = getGoals();
  const goals = all.filter((g) => filter === 'all' || g.st === filter);
  const active = all.filter((g) => g.st === 'in-progress').length;
  const remove = (id: string) => undoable(notify, 'Goal deleted.', snapshotGoals, restoreGoals, () => deleteGoal(id), refresh);

  return (
    <div className="qaPage">
      <QuickAdd
        kind="goal"
        placeholder="New goal"
        hint="Type it how you'd say it: “Run a half marathon by Mar 1”"
        onAdd={(q) => {
          const g = createGoal(q.title);
          saveGoal({ ...g, td: q.date ?? '' });
          refresh();
          notify(`Goal set${q.date ? ' · by ' + fmtShort(q.date) : ''}.`);
        }}
        onMore={(q) => {
          const g = createGoal(q.title || 'New goal');
          deleteGoal(g.id); /* the form saves for real */
          setEdit({ ...g, td: q.date ?? '' });
        }}
      />
      {edit ? (
        <GoalForm
          goal={edit}
          isNew={!all.some((g) => g.id === edit.id)}
          onCancel={() => setEdit(null)}
          onSave={(g) => {
            saveGoal(g);
            setEdit(null);
            refresh();
            notify('Goal saved.');
          }}
          onDelete={() => {
            setEdit(null);
            remove(edit.id);
          }}
        />
      ) : null}
      <div className="tkBar">
        <div className="calSeg" role="tablist" aria-label="Status">
          {FILTERS.map((f) => (
            <button key={f} role="tab" aria-selected={filter === f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
              {LABEL[f]}
            </button>
          ))}
        </div>
        <span className="xs m" style={{ alignSelf: 'center' }}>
          {all.length} goal{all.length === 1 ? '' : 's'} · {active} in progress
        </span>
      </div>
      <div className="card cardPad">
        {goals.map((g) => {
          const left = g.td ? daysLeft(g.td) : null;
          const late = left !== null && left < 0 && g.st !== 'completed';
          return (
            <div key={g.id} className="task">
              <button
                className={'gSt st-' + g.st}
                aria-label={`${LABEL[g.st]}, tap to change`}
                title={LABEL[g.st]}
                onClick={() => {
                  saveGoal({ ...g, st: ORDER[(ORDER.indexOf(g.st) + 1) % ORDER.length] });
                  refresh();
                }}
              />
              <div className="g">
                <button className="tkTitle" onClick={() => setEdit(g)}>
                  {g.st === 'completed' ? <s className="m">{g.t}</s> : g.t}
                </button>
                {g.d ? <div className="xs m">{g.d}</div> : null}
                {nextMilestone(g.ms) ? (
                  <div className="xs msNext">
                    ◆ {nextMilestone(g.ms)!.t} · {fmtShort(nextMilestone(g.ms)!.d)}
                    <span className="m"> · {(g.ms ?? []).filter((m) => m.done).length}/{(g.ms ?? []).length} milestones</span>
                  </div>
                ) : null}
                <ProjectChip k="goal" id={g.id} />
              </div>
              {g.td ? (
                <span className="xs" style={{ color: late ? 'var(--rd)' : 'var(--mut)', textAlign: 'right', flex: 'none' }}>
                  {fmtShort(g.td)}
                  <br />
                  {g.st === 'completed' ? 'done' : late ? `${-left!}d late` : left === 0 ? 'today' : `${left}d left`}
                </span>
              ) : null}
              <ItemMenu
                name={g.t}
                edit={() => setEdit(g)}
                rename={{ value: g.t, save: (v) => saveGoal({ ...g, t: v.slice(0, 120) }) }}
                link={{ k: 'goal', id: g.id }}
                onChange={refresh}
                onDelete={() => remove(g.id)}
              />
            </div>
          );
        })}
        {goals.length === 0 ? (
          <div className="s m">
            {filter === 'all' ? 'No goals yet. A goal is the long game: set one and Eumae breaks it into steps with you.' : `Nothing ${LABEL[filter].toLowerCase()}.`}
          </div>
        ) : null}
      </div>
      <div className="xs m calFoot">Tap the circle to move a goal along: not started, in progress, done.</div>
    </div>
  );
}

function GoalForm({
  goal,
  isNew,
  onSave,
  onDelete,
  onCancel,
}: {
  goal: Goal;
  isNew: boolean;
  onSave: (g: Goal) => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const [g, setG] = useState<Goal>(goal);
  const set = (p: Partial<Goal>) => setG((x) => ({ ...x, ...p }));
  return (
    <div className="card evForm">
      <b>{isNew ? 'New goal' : 'Edit goal'}</b>
      <input className="sinput" value={g.t} onChange={(e) => set({ t: e.target.value })} aria-label="Goal" autoFocus />
      <input className="sinput" placeholder="Why it matters" value={g.d} onChange={(e) => set({ d: e.target.value })} aria-label="Why it matters" />
      <div className="evRow">
        <label>
          <span className="xs m">Target date</span>
          <input className="sinput" type="date" value={g.td} onChange={(e) => set({ td: e.target.value })} />
        </label>
        <label>
          <span className="xs m">Status</span>
          <select className="sinput" value={g.st} onChange={(e) => set({ st: e.target.value as GoalStatus })}>
            <option value="not-started">Not started</option>
            <option value="in-progress">In progress</option>
            <option value="completed">Done</option>
          </select>
        </label>
      </div>
      <span className="xs m">Milestones</span>
      <MilestonesEditor value={g.ms ?? []} onChange={(ms) => set({ ms })} />
      <div className="btns">
        <button className="pri" onClick={() => g.t.trim() && onSave({ ...g, t: g.t.trim(), d: g.d.trim() })}>
          {isNew ? 'Set goal' : 'Save'}
        </button>
        <button className="gho" onClick={onCancel}>
          Cancel
        </button>
        {!isNew ? (
          <button className="gho" style={{ color: 'var(--rd)' }} onClick={onDelete}>
            Delete
          </button>
        ) : null}
      </div>
    </div>
  );
}
