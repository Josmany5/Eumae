/* Guild contact — the mockup's pgPersonV: avatar card + Message, shared
 * with you (view/edit access), linked files. arg = person index. */

import { useState } from 'react';
import { useNav } from '../nav';
import { getGuild, setSharedPerm, threadWith, removePerson, snapshotGuild, restoreGuild } from '../guild';
import { getFiles } from '../library';
import type { PageProps } from './index';

export default function PersonPage({ arg }: PageProps) {
  const { go, back, notify } = useNav();
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  void tick;

  const i = typeof arg === 'number' ? arg : Number(arg);
  const g = getGuild();
  const p = g.people[i];
  if (!p) {
    back();
    return null;
  }
  const th = g.threads.findIndex((t) => t.p === i);
  const rel = g.shared.map((x, xi) => ({ x, xi })).filter((o) => o.x.p === i);
  const linked = getFiles().slice(0, 3);
  const remove = () => {
    const snap = snapshotGuild();
    if (!removePerson(i)) return;
    back();
    notify(`${p.n} removed.`, { undo: () => restoreGuild(snap) });
  };

  return (
    <div>
      <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div className="fi" style={{ borderRadius: '50%', fontSize: 16 }}>
          {p.ini}
        </div>
        <div className="g">
          <b>{p.n}</b>
          <div className="xs m">Guild contact</div>
        </div>
        {th >= 0 ? (
          <button className="fb" onClick={() => go('gchat', th)}>
            Message
          </button>
        ) : (
          <button
            className="fb"
            onClick={() => {
              const stamp = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
              go('gchat', threadWith(i, stamp));
            }}
          >
            Message
          </button>
        )}
      </div>
      <h3 className="sec">Shared with you</h3>
      {rel.length ? (
        <div className="card cardPad">
          {rel.map((o) => (
            <div key={o.x.n} className="li">
              <div className="g">
                {o.x.n}
                <div className="xs m">{o.x.k}</div>
              </div>
              <select
            className="selIn"
                aria-label="Access"
                value={o.x.perm ?? 'view'}
                onChange={(e) => {
                  setSharedPerm(o.xi, e.target.value as 'view' | 'edit');
                  refresh();
                }}
              >
                <option value="view">Can view</option>
                <option value="edit">Can edit</option>
              </select>
            </div>
          ))}
        </div>
      ) : (
        <div className="card s m">Nothing shared yet.</div>
      )}
      <h3 className="sec">Linked</h3>
      <div className="card cardPad">
        {linked.map((f) => (
          <div key={f.id} className="li">
            <div className="fi">{f.k.slice(0, 4)}</div>
            <button className="g" style={{ textAlign: 'left' }} onClick={() => go('view', f.id)}>
              {f.t}
            </button>
          </div>
        ))}
      </div>
      <div className="btns">
        <button className="gho danger" onClick={remove}>
          Remove contact
        </button>
      </div>
    </div>
  );
}
