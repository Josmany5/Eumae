/* Flow editor, new or existing. Laid out like the event form: a name, a
 * Flow/Routine switch, a schedule picked with day chips plus a time (no
 * free text to get wrong), and steps as a real list you can edit, reorder,
 * and remove. Save sits at the bottom. The schedule is still stored as the
 * flow's readable `w` string ("Weekdays 7:00 AM"), so existing flows load
 * as they are.
 */

import { useState } from 'react';
import { useNav } from '../nav';
import { getFlows, saveFlow, createFlow, deleteFlow, snapshotFlows, restoreFlows, type Flow } from '../flows';
import { undoable } from '../undo';
import type { PageProps } from './index';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type Sched = { manual: boolean; days: number[]; time: string };

function parseWhen(w: string): Sched {
  const s = (w || '').toLowerCase();
  if (!s || s.startsWith('manual')) return { manual: true, days: [1, 2, 3, 4, 5], time: '07:00' };
  let days: number[] = [];
  if (/daily|every ?day/.test(s)) days = [0, 1, 2, 3, 4, 5, 6];
  else if (/weekdays/.test(s)) days = [1, 2, 3, 4, 5];
  else if (/weekends/.test(s)) days = [0, 6];
  else DAYS.forEach((d, i) => s.includes(d.toLowerCase()) && days.push(i));
  if (!days.length) days = [1, 2, 3, 4, 5];
  let time = '07:00';
  const m = s.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (m) {
    let h = +m[1] % 24;
    if (m[3] === 'pm' && h < 12) h += 12;
    if (m[3] === 'am' && h === 12) h = 0;
    time = `${String(h).padStart(2, '0')}:${m[2] ?? '00'}`;
  }
  return { manual: false, days, time };
}

function fmt12(t: string): string {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

function whenLabel(s: Sched): string {
  if (s.manual) return 'Manual';
  const d = [...s.days].sort();
  const key = d.join('');
  const days =
    key === '0123456' ? 'Daily' : key === '12345' ? 'Weekdays' : key === '06' ? 'Weekends' : d.map((i) => DAYS[i]).join(', ');
  return `${days} ${fmt12(s.time)}`;
}

export default function FlowEditPage({ arg }: PageProps) {
  const { notify, go, back } = useNav();
  const id = typeof arg === 'string' && arg ? arg : null;
  const existing = id ? getFlows().find((x) => x.id === id) ?? null : null;
  const [n, setN] = useState(existing?.n ?? '');
  const [kind, setKind] = useState<'flow' | 'routine'>(existing?.kind ?? 'flow');
  const [sched, setSched] = useState<Sched>(() => parseWhen(existing?.w ?? ''));
  const [steps, setSteps] = useState<string[]>(existing?.steps ?? []);
  const [draft, setDraft] = useState('');

  const addStep = () => {
    const t = draft.trim();
    if (!t) return;
    setSteps((s) => [...s, t]);
    setDraft('');
  };
  const moveStep = (i: number, d: -1 | 1) =>
    setSteps((s) => {
      const j = i + d;
      if (j < 0 || j >= s.length) return s;
      const c = [...s];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });

  const save = () => {
    const name = n.trim() || 'Untitled flow';
    const when = whenLabel(sched);
    const list = [...steps, draft.trim()].map((s) => s.trim()).filter(Boolean);
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
    notify(kind === 'routine' ? 'Routine created.' : 'Flow created.');
    back();
    go('flow', full.id);
  };

  const remove = () => {
    if (!existing) return;
    const id = existing.id;
    back();
    undoable(notify, existing.kind === 'routine' ? 'Routine deleted.' : 'Flow deleted.', snapshotFlows, restoreFlows, () => deleteFlow(id));
  };

  return (
    <div className="flEdit">
      <div className="screenT">{existing ? 'Edit ' + (existing.kind === 'routine' ? 'routine' : 'flow') : 'New flow or routine'}</div>
      <div className="s m" style={{ marginBottom: 14 }}>
        A flow is a checklist Eumae runs with you. A routine is the same steps on repeat.
      </div>

      <div className="card evForm">
        <input
          className="sinput flName"
          placeholder="Name it, e.g. Friday review"
          value={n}
          onChange={(e) => setN(e.target.value)}
          aria-label="Name"
          autoFocus={!existing}
        />
        <div className="calSeg" role="tablist" aria-label="Type" style={{ alignSelf: 'flex-start' }}>
          {(['flow', 'routine'] as const).map((k) => (
            <button key={k} role="tab" aria-selected={kind === k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>
              {k === 'flow' ? 'Flow' : 'Routine'}
            </button>
          ))}
        </div>
      </div>

      <h3 className="sec">When it runs</h3>
      <div className="card evForm">
        <div className="evTypes">
          {[
            ['Manual', () => setSched((s) => ({ ...s, manual: true }))],
            ['Daily', () => setSched((s) => ({ ...s, manual: false, days: [0, 1, 2, 3, 4, 5, 6] }))],
            ['Weekdays', () => setSched((s) => ({ ...s, manual: false, days: [1, 2, 3, 4, 5] }))],
            ['Weekends', () => setSched((s) => ({ ...s, manual: false, days: [0, 6] }))],
          ].map(([label, fn]) => {
            const on = label === 'Manual' ? sched.manual : !sched.manual && whenLabel(sched).startsWith(label as string);
            return (
              <button key={label as string} className={'evType' + (on ? ' on' : '')} onClick={fn as () => void}>
                {label as string}
              </button>
            );
          })}
        </div>
        {!sched.manual ? (
          <>
            <div className="evDays" aria-label="Days">
              {DAYS.map((d, i) => (
                <button
                  key={d}
                  className={sched.days.includes(i) ? 'on' : ''}
                  aria-pressed={sched.days.includes(i)}
                  aria-label={d}
                  onClick={() =>
                    setSched((s) => {
                      const has = s.days.includes(i);
                      const days = has ? s.days.filter((x) => x !== i) : [...s.days, i];
                      return { ...s, days: days.length ? days : s.days };
                    })
                  }
                >
                  {d[0]}
                </button>
              ))}
            </div>
            <div className="evRow">
              <label>
                <span className="xs m">Time</span>
                <input className="sinput" type="time" value={sched.time} onChange={(e) => setSched((s) => ({ ...s, time: e.target.value || s.time }))} />
              </label>
            </div>
          </>
        ) : null}
        <div className="xs m">{sched.manual ? 'Runs when you start it.' : 'Runs ' + whenLabel(sched) + '.'}</div>
      </div>

      <h3 className="sec">Steps</h3>
      <div className="card cardPad">
        {steps.map((st, i) => (
          <div key={i} className="flStep">
            <span className="flNum">{i + 1}</span>
            <input
              className="flIn"
              value={st}
              onChange={(e) => setSteps((s) => s.map((x, j) => (j === i ? e.target.value : x)))}
              aria-label={`Step ${i + 1}`}
            />
            <button className="msX" aria-label="Move up" disabled={i === 0} onClick={() => moveStep(i, -1)}>
              ↑
            </button>
            <button className="msX" aria-label="Move down" disabled={i === steps.length - 1} onClick={() => moveStep(i, 1)}>
              ↓
            </button>
            <button className="msX" aria-label={`Remove step ${i + 1}`} onClick={() => setSteps((s) => s.filter((_, j) => j !== i))}>
              ×
            </button>
          </div>
        ))}
        <div className="flStep add">
          <span className="flNum">+</span>
          <input
            className="flIn"
            placeholder={steps.length ? 'Add a step' : 'First step, e.g. Gather overnight notes'}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addStep()}
            aria-label="New step"
          />
          <button className="fb" onClick={addStep} disabled={!draft.trim()}>
            Add
          </button>
        </div>
      </div>

      <div className="btns flSave">
        <button className="pri" onClick={save}>
          {existing ? 'Save changes' : kind === 'routine' ? 'Create routine' : 'Create flow'}
        </button>
        <button onClick={back}>Cancel</button>
        {existing ? (
          <button style={{ color: 'var(--rd)' }} onClick={remove}>
            Delete
          </button>
        ) : null}
      </div>
    </div>
  );
}
