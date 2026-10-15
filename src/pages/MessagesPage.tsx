/* Guild Messages — thread list with unread badges, search, tap to open. */

import { useState } from 'react';
import { useNav } from '../nav';
import { getGuild } from '../guild';
import type { PageProps } from './index';

export default function MessagesPage(_props: PageProps) {
  void _props;
  const { go } = useNav();
  const [q, setQ] = useState('');
  const [tick, setTick] = useState(0);
  void tick;
  const g = getGuild();
  const query = q.trim().toLowerCase();
  const rows = g.threads
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => {
      if (!query) return true;
      const p = g.people[t.p];
      return (p?.n ?? '').toLowerCase().includes(query) || t.last.toLowerCase().includes(query);
    });
  return (
    <div>
      <input
        className="lib2-search"
        placeholder="Search messages"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search messages"
        style={{ marginBottom: 8 }}
      />
      {rows.map(({ t, i }) => {
        const p = g.people[t.p];
        if (!p) return null;
        return (
          <button
            key={i}
            className="card"
            style={{ width: '100%', textAlign: 'left', padding: '12px 14px', marginBottom: 8 }}
            onClick={() => {
              go('gchat', i);
              setTick((x) => x + 1);
            }}
          >
            <div className="row">
              <div className="fi" style={{ borderRadius: '50%', fontSize: 14 }}>
                {p.ini}
              </div>
              <div className="g">
                <div className="row">
                  <b>{p.n}</b>
                  {t.un ? <span className="tag">{t.un} new</span> : null}
                  <span className="xs m" style={{ marginLeft: 'auto' }}>
                    {t.t}
                  </span>
                </div>
                <div className="s m">{t.last}</div>
              </div>
            </div>
          </button>
        );
      })}
      {rows.length === 0 ? <div className="s m">No conversations yet.</div> : null}
      <h3 className="sec">Groups</h3>
      {g.groups.map((gr) => (
        <button
          key={gr.n}
          className="card"
          style={{ width: '100%', textAlign: 'left', padding: '12px 14px', marginBottom: 8 }}
          onClick={() => go('gchatg', gr.n)}
        >
          <div className="row">
            <div className="fi" style={{ borderRadius: '50%' }}>
              {gr.n
                .split(' ')
                .map((x) => x[0])
                .join('')
                .slice(0, 2)}
            </div>
            <div className="g">
              <div className="s">
                <b>{gr.n}</b>
                {gr.un ? <span className="tag">{gr.un} new</span> : null}
              </div>
              <div className="xs m">{gr.last}</div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
