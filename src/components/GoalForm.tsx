import { useState, type ReactNode } from 'react';
import { isActiveGoal, type Goal } from '../goals';
import { MilestonesEditor } from './Milestones';

/* The goal form: aim, why, measure, date, pace, status, milestones. Short on
   purpose: no wizard, no SMART interrogation. Used on the Goals page and in
   the edit pop-up. */
export function GoalForm({
  goal,
  isNew,
  onSave,
  onDelete,
  onCancel,
  saveLabel,
  extra,
  bare,
}: {
  goal: Goal;
  isNew: boolean;
  onSave: (g: Goal) => void;
  onDelete?: () => void;
  onCancel: () => void;
  saveLabel?: string;
  extra?: ReactNode;
  bare?: boolean;
}) {
  const [g, setG] = useState<Goal>(goal);
  const set = (p: Partial<Goal>) => setG((x) => ({ ...x, ...p }));
  const num = (v: string): number | undefined => {
    const n = parseFloat(v.replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) ? n : undefined;
  };
  const status = isActiveGoal(g) ? 'active' : g.st;
  const save = () => {
    if (!g.t.trim()) return;
    const out: Goal = { ...g, t: g.t.trim().slice(0, 120), d: g.d.trim(), unit: (g.unit ?? '').trim() || undefined };
    if (!out.tgt) {
      delete out.tgt;
      delete out.cur;
      delete out.unit;
    }
    if (!out.pace || !out.pace.n) delete out.pace;
    onSave(out);
  };
  return (
    <div className={bare ? 'evForm itForm' : 'card evForm'}>
      {bare ? null : <b>{isNew ? 'New goal' : 'Edit goal'}</b>}
      <input className="sinput" value={g.t} onChange={(e) => set({ t: e.target.value })} placeholder="Your goal, in your words" aria-label="Goal" autoFocus />
      <input className="sinput" placeholder="Why it matters" value={g.d} onChange={(e) => set({ d: e.target.value })} aria-label="Why it matters" />
      <div className="evRow">
        <label>
          <span className="xs m">Target</span>
          <input
            className="sinput"
            inputMode="decimal"
            placeholder="e.g. 3"
            value={g.tgt ?? ''}
            onChange={(e) => set({ tgt: num(e.target.value) })}
          />
        </label>
        <label>
          <span className="xs m">Of what</span>
          <input className="sinput" placeholder="clients" value={g.unit ?? ''} onChange={(e) => set({ unit: e.target.value.slice(0, 24) })} />
        </label>
        <label>
          <span className="xs m">So far</span>
          <input
            className="sinput"
            inputMode="decimal"
            placeholder="0"
            value={g.cur ?? ''}
            disabled={!g.tgt}
            onChange={(e) => set({ cur: num(e.target.value) })}
          />
        </label>
      </div>
      <div className="evRow">
        <label>
          <span className="xs m">Target date</span>
          <input className="sinput" type="date" value={g.td} onChange={(e) => set({ td: e.target.value })} />
        </label>
        <label>
          <span className="xs m">Pace (optional)</span>
          <input
            className="sinput"
            inputMode="decimal"
            placeholder="e.g. 1"
            value={g.pace?.n ?? ''}
            onChange={(e) => {
              const n = num(e.target.value);
              set({ pace: n ? { n, per: g.pace?.per ?? 'week' } : undefined });
            }}
          />
        </label>
        <label>
          <span className="xs m">Per</span>
          <select
            className="sinput"
            value={g.pace?.per ?? 'week'}
            onChange={(e) => set({ pace: { n: g.pace?.n ?? 0, per: e.target.value as 'week' | 'month' } })}
          >
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </label>
      </div>
      <label className="evRow" style={{ gridTemplateColumns: '1fr' }}>
        <span className="xs m">Status</span>
        <select
          className="sinput"
          value={status}
          onChange={(e) => {
            const v = e.target.value;
            set({ st: v === 'active' ? (g.st === 'not-started' ? 'not-started' : 'in-progress') : (v as Goal['st']) });
          }}
        >
          <option value="active">Active</option>
          <option value="completed">Done</option>
          <option value="let-go">Archived</option>
        </select>
      </label>
      <span className="xs m">Milestones</span>
      <MilestonesEditor value={g.ms ?? []} onChange={(ms) => set({ ms })} />
      {extra}
      <div className="btns">
        <button className="pri" onClick={save}>
          {saveLabel ?? (isNew ? 'Set goal' : 'Save')}
        </button>
        <button className="gho" onClick={onCancel}>
          Cancel
        </button>
        {onDelete ? (
          <button className="gho" style={{ color: 'var(--rd)' }} onClick={onDelete}>
            Delete
          </button>
        ) : null}
      </div>
    </div>
  );
}
