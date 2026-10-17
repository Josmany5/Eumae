/* Guild Messages — thread list with unread badges, search, tap to open. */

import { useState } from 'react';
import { useNav } from '../nav';
import { getGuild, createGroup, deleteThread, leaveGroup, snapshotGuild, restoreGuild } from '../guild';
import { ItemMenu } from '../components/ItemMenu';
import { undoable } from '../undo';
import type { PageProps } from './index';

export default function MessagesPage(_props: PageProps) {
  void _props;
  const { go, notify } = useNav();
  const [q, setQ] = useState('');
  const [naming, setNaming] = useState(false);
  const [groupName, setGroupName] = useState('');
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
  const submitGroup = () => {
    const msg = createGroup(groupName);
    notify(msg);
    if (msg !== 'Group created.') return;
    const n = groupName.trim().slice(0, 48);
    setNaming(false);
    setGroupName('');
    setTick((x) => x + 1);
    go('gchatg', n);
  };
  return (
    <div>
      <input
        className="sinput"
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
          <div key={i} className="card imWrap" style={{ padding: '0 6px 0 0', marginBottom: 8 }}>
          <button
            style={{ textAlign: 'left', padding: '12px 14px' }}
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
          <ItemMenu
            name={p.n}
            open={() => go('gchat', i)}
            deleteLabel="Delete chat"
            onDelete={() => undoable(notify, 'Chat deleted.', snapshotGuild, restoreGuild, () => deleteThread(i), () => setTick((x) => x + 1))}
          />
          </div>
        );
      })}
      {rows.length === 0 ? <div className="s m">No conversations yet.</div> : null}
      <div className="row" style={{ alignItems: 'baseline' }}>
        <h3 className="sec">Groups</h3>
        {naming ? null : (
          <button className="fb gho" style={{ marginLeft: 'auto' }} onClick={() => setNaming(true)}>
            New group
          </button>
        )}
      </div>
      {naming ? (
        <span style={{ display: 'flex', gap: 8, margin: '8px 0' }}>
          <input
            className="lib2-search"
            placeholder="Group name"
            value={groupName}
            autoFocus
            onChange={(e) => setGroupName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitGroup();
              if (e.key === 'Escape') setNaming(false);
            }}
            aria-label="New group name"
          />
          <button className="fb" onClick={submitGroup}>
            Create
          </button>
        </span>
      ) : null}
      {g.groups.map((gr) => (
        <div key={gr.n} className="card imWrap" style={{ padding: '0 6px 0 0', marginBottom: 8 }}>
        <button style={{ textAlign: 'left', padding: '12px 14px' }} onClick={() => go('gchatg', gr.n)}>
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
        <ItemMenu
          name={gr.n}
          open={() => go('gchatg', gr.n)}
          deleteLabel="Leave group"
          onDelete={() => undoable(notify, `Left ${gr.n}.`, snapshotGuild, restoreGuild, () => leaveGroup(gr.n), () => setTick((x) => x + 1))}
        />
        </div>
      ))}
    </div>
  );
}
