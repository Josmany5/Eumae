/* Flow editor — new or existing: name, type, when, steps one-per-line,
 * save/delete. */

import { useState } from 'react';
import { useNav } from '../nav';
import { getFlows, saveFlow, createFlow, deleteFlow, type Flow } from '../flows';
import type { PageProps } from './index';

export default function FlowEditPage({ arg }: PageProps) {
  const { notify, go, back } = useNav();
  const id = typeof arg === 'string' && arg ? arg : null;
  const existing = id ? getFlows().find((x) => x.id === id) ?? null : null;
  const [n, setN] = useState(existing?.n ?? '');
  const [kind, setKind] = useState<'flow' | 'routine'>(existing?.kind ?? 'flow');
  const [w, setW] = useState(existing?.w ?? '');
  const [steps, setSteps] = useState((existing?.steps ?? []).join('\n'));

  const save = () => {
    const name = n.trim() || 'Untitled flow';
    const when = w.trim() || 'Manual';
    const list = steps
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    if (existing) {
      const done = existing.done.filter((d) => d < list.length);
      saveFlow({ ...existing, n: name, w: when, kind, steps: list, done });
      notify('Flow saved.');
      go('flow', existing.id);
      return;
    }
    const nf = createFlow(name);
    const full: Flow = { ...nf, w: when, kind, steps: list, done: [] };
    saveFlow(full);
    notify('Flow created.');
    back();
    go('flow', full.id);
  };

  const remove = () => {
    if (!existing) return;
    if (!window.confirm('Delete this flow?')) return;
    deleteFlow(existing.id);
    notify('Flow deleted.');
    back();
  };

  return (
    <div>
      <h3 className="sec">Name</h3>
      <input placeholder="e.g. Friday review" value={n} onChange={(e) => setN(e.target.value)} aria-label="Flow name" />
      <h3 className="sec">Type</h3>
      <div className="ftabs">
        <button className={kind === 'flow' ? 'on' : ''} onClick={() => setKind('flow')}>
          Flow
        </button>
        <button className={kind === 'routine' ? 'on' : ''} onClick={() => setKind('routine')}>
          Routine
        </button>
      </div>
      <h3 className="sec">When</h3>
      <input
        placeholder="e.g. Weekdays 7:00 AM"
        value={w}
        onChange={(e) => setW(e.target.value)}
        aria-label="Schedule"
      />
      <h3 className="sec">Steps — one per line</h3>
      <textarea
        style={{ minHeight: 110 }}
        placeholder="Gather overnight"
        value={steps}
        onChange={(e) => setSteps(e.target.value)}
        aria-label="Steps"
      />
      <div className="btns">
        <button className="pri" onClick={save}>
          {existing ? 'Save changes' : 'Create'}
        </button>
        {existing ? (
          <button className="gho" style={{ color: 'var(--rd)' }} onClick={remove}>
            Delete
          </button>
        ) : null}
      </div>
    </div>
  );
}
