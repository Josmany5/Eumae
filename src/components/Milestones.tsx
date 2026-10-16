import { useState } from 'react';
import { newMilestone, sortMilestones, type Milestone } from '../milestones';

/* Edit a list of milestones in place: tick, re-date, remove, add. */
export function MilestonesEditor({ value, onChange }: { value: Milestone[]; onChange: (ms: Milestone[]) => void }) {
  const [t, setT] = useState('');
  const [d, setD] = useState('');
  const list = sortMilestones(value);
  const add = () => {
    if (!t.trim()) return;
    onChange([...value, newMilestone(t.trim().slice(0, 80), d)]);
    setT('');
    setD('');
  };
  const patch = (id: string, p: Partial<Milestone>) => onChange(value.map((m) => (m.id === id ? { ...m, ...p } : m)));
  return (
    <div className="msList">
      {list.map((m) => (
        <div key={m.id} className="msRow">
          <button
            className={'msDot' + (m.done ? ' on' : '')}
            aria-label={m.done ? `Reopen ${m.t}` : `Mark ${m.t} reached`}
            onClick={() => patch(m.id, { done: !m.done })}
          />
          <span className={'g' + (m.done ? ' done' : '')}>{m.t}</span>
          <input className="sinput" type="date" value={m.d} aria-label={`${m.t} date`} onChange={(e) => patch(m.id, { d: e.target.value })} />
          <button className="msX" aria-label={`Remove ${m.t}`} onClick={() => onChange(value.filter((x) => x.id !== m.id))}>
            ×
          </button>
        </div>
      ))}
      <div className="msAdd">
        <input
          className="sinput"
          placeholder="Add a milestone"
          value={t}
          onChange={(e) => setT(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          aria-label="Milestone"
        />
        <input className="sinput" type="date" value={d} onChange={(e) => setD(e.target.value)} aria-label="Milestone date" />
        <button className="fb" onClick={add} disabled={!t.trim()}>
          Add
        </button>
      </div>
    </div>
  );
}
