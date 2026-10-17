/* Shared-work detail — the mockup's pgSharedV: centered card (type
 * badge, name, sharer + kind), Your-access row, Permission select writing
 * perm, Open it (matching Library file by title, else honest toast),
 * Unshare (red, removes + back). arg = shared index. */

import { useState } from 'react';
import { useNav } from '../nav';
import { getGuild, setSharedPerm, unshare } from '../guild';
import { getFiles } from '../library';
import type { PageProps } from './index';

export default function SharedViewPage({ arg }: PageProps) {
  const { notify, go, back } = useNav();
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  void tick;

  const i = typeof arg === 'number' ? arg : Number(arg);
  const g = getGuild();
  const x = g.shared[i];
  if (!x) {
    back();
    return null;
  }
  const who = g.people[x.p]?.n ?? 'Someone';
  const f = getFiles().find((y) => y.t.toLowerCase() === x.n.toLowerCase());

  return (
    <div>
      <div className="card" style={{ textAlign: 'center', padding: 22 }}>
        <div className="fi" style={{ margin: '0 auto 8px' }}>
          {x.k.slice(0, 3).toUpperCase()}
        </div>
        <div style={{ fontWeight: 700 }}>{x.n}</div>
        <div className="xs m">
          Shared by {who} · {x.k}
        </div>
      </div>
      <div className="kv">
        <span className="m">Your access</span>
        <span>{x.perm === 'edit' ? 'Can edit' : 'Can view'}</span>
      </div>
      <div className="kv">
        <span className="m">Permission</span>
        <span>
          <select
            className="selIn"
            aria-label="Permission"
            value={x.perm ?? 'view'}
            onChange={(e) => {
              setSharedPerm(i, e.target.value as 'view' | 'edit');
              refresh();
            }}
          >
            <option value="view">Can view</option>
            <option value="edit">Can edit</option>
          </select>
        </span>
      </div>
      <div className="btns">
        {f ? (
          <button className="pri" onClick={() => go('view', f.id)}>
            Open it
          </button>
        ) : (
          <button className="pri soon" onClick={() => notify('Lives in their Studio for now.')}>
            Open it
          </button>
        )}
        <button
          className="gho"
          style={{ color: 'var(--rd)' }}
          onClick={() => {
            notify(unshare(i));
            back();
          }}
        >
          Unshare
        </button>
      </div>
      <div className="s m">The actual shared thing — who shared it, what it is, and what you are allowed to do with it.</div>
    </div>
  );
}
