/* Goals full page — the mockup's pgGoals, rebuilt as React.
 *
 * Status ftabs, cards with status tag + Set status/Edit/Delete, New goal.
 * Inline forms, no prompt().
 */

import { useState } from 'react';
import { useNav } from '../nav';
import { getGoals, createGoal, saveGoal, deleteGoal, type Goal, type GoalStatus } from '../goals';
import type { PageProps } from './index';

const FILTERS: ('all' | GoalStatus)[] = ['all', 'not-started', 'in-progress', 'completed'];

const ST_STYLE: Record<GoalStatus, string> = {
  'not-started': 'var(--mut)',
  'in-progress': 'var(--ac)',
  completed: 'var(--gr)',
};

export default function GoalsPage(_props: PageProps) {
  void _props;
  const { notify } = useNav();
  const [filter, setFilter] = useState<'all' | GoalStatus>('all');
  const [tick, setTick] = useState(0);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [t, setT] = useState('');
  const [d, setD] = useState('');
  const [td, setTd] = useState('');
  const refresh = () => setTick((t) => t + 1);
  void tick;

  const goals = getGoals().filter((g) => (filter === 'all' ? true : g.st === filter));
  const openAdd = () => {
    setT('');
    setD('');
    setTd('');
    setEditing(null);
    setAdding(true);
  };

  const openEdit = (g: Goal) => {
    setT(g.t);
    setD(g.d);
    setTd(g.td);
    setAdding(false);
    setEditing(g.id);
  };

  const submitAdd = () => {
    if (!t.trim()) {
      notify('Name it first.');
      return;
    }
    const g = createGoal(t.trim());
    saveGoal({ ...g, d: d.trim(), td: td.trim() });
    setAdding(false);
    refresh();
  };

  const submitEdit = () => {
    if (!editing) return;
    const g = getGoals().find((x) => x.id === editing);
    if (!g) return;
    if (!t.trim()) {
      notify('Name it first.');
      return;
    }
    saveGoal({ ...g, t: t.trim(), d: d.trim(), td: td.trim() });
    setEditing(null);
    refresh();
  };

  const cycleStatus = (g: Goal) => {
    const order: GoalStatus[] = ['not-started', 'in-progress', 'completed'];
    saveGoal({ ...g, st: order[(order.indexOf(g.st) + 1) % order.length] });
    refresh();
  };

  const form = (submit: () => void, cancel: () => void, cta: string) => (
    <>
      <input placeholder="Goal" value={t} onChange={(e) => setT(e.target.value)} aria-label="Goal title" />
      <input
        placeholder="Why it matters"
        value={d}
        onChange={(e) => setD(e.target.value)}
        style={{ marginTop: 8 }}
        aria-label="Why it matters"
      />
      <input
        placeholder="Target date (YYYY-MM-DD)"
        value={td}
        onChange={(e) => setTd(e.target.value)}
        style={{ marginTop: 8 }}
        aria-label="Target date"
      />
      <div className="btns">
        <button className="pri" onClick={submit}>
          {cta}
        </button>
        <button className="gho" onClick={cancel}>
          Cancel
        </button>
      </div>
    </>
  );

  return (
    <div>
      <div className="s m">Long-term objectives and milestones.</div>
      <div className="ftabs">
        {FILTERS.map((f) => (
          <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
      </div>
      {goals.map((g) => (
        <div key={g.id} className="card">
          {editing === g.id ? (
            form(submitEdit, () => setEditing(null), 'Save')
          ) : (
            <>
              <div className="row">
                <div className="g">
                  <b>{g.t}</b>
                  <div className="s m">{g.d}</div>
                  {g.td ? <div className="xs m">Target: {g.td}</div> : null}
                </div>
                <span className="tag" style={{ color: ST_STYLE[g.st] }}>
                  {g.st}
                </span>
              </div>
              <div className="btns">
                <button className="fb" onClick={() => cycleStatus(g)}>
                  Set status
                </button>
                <button className="fb" onClick={() => openEdit(g)}>
                  Edit
                </button>
                <button
                  className="fb"
                  style={{ color: 'var(--rd)' }}
                  onClick={() => {
                    deleteGoal(g.id);
                    refresh();
                    notify('Goal deleted.');
                  }}
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      ))}
      {goals.length === 0 ? (
        <div className="s m">No goals yet. A goal is the long game — set one and Eumae breaks it into steps with you.</div>
      ) : null}
      {adding ? (
        <div className="card">
          <b>New goal</b>
          <div style={{ marginTop: 8 }}>{form(submitAdd, () => setAdding(false), 'Create')}</div>
        </div>
      ) : (
        <div className="btns">
          <button className="pri" onClick={openAdd}>
            New goal
          </button>
        </div>
      )}
    </div>
  );
}
