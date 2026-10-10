import { useEffect, useState } from 'react';
import { getThreads } from '../../threads';
import type { TabId } from './TabBar';
import { PAGE_MENU } from './pageMenu';
import { Icon } from './icons';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  tab: TabId;
  onPick: (label: string) => void;
  onSearch: () => void;
  currentThreadId?: string | null;
  onThreadPick?: (id: string) => void;
  onThreadDelete?: (id: string) => void;
}

/** The phone's second level: the same per-page menu the desktop rail shows,
 *  behind the hamburger. The mockup puts the search field above everything,
 *  so it does too. */
export default function Drawer({ open, onClose, tab, onPick, onSearch, currentThreadId, onThreadPick, onThreadDelete }: DrawerProps) {
  /* Threads read fresh every time the drawer opens — App's cached copy goes
     stale when a title updates mid-chat (the 2026-10-10 stale list). */
  const [threads, setThreads] = useState<{ id: string; title: string; updatedAt: number }[]>([]);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (open && tab === 'chat') {
      setThreads(getThreads());
      setEditing(false);
    }
  }, [open, tab]);
  const [q, setQ] = useState('');

  const submit = () => {
    onSearch();
    setQ('');
  };

  return (
    <>
      <div className={`dscrim${open ? ' open' : ''}`} onClick={onClose} />
      <aside className={`drawer${open ? ' open' : ''}`}>
        <div className="dh">Eumae</div>
        <div className="db">
          <div className="dsearch">
            <input
              id="drawer-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search Eumae..."
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            />
          </div>
          {PAGE_MENU[tab].map((s, i) => (
            <div key={s.heading ?? i}>
              {s.heading ? <div className="ds">{s.heading}</div> : null}
              {s.heading === 'Recent chats' && tab === 'chat' ? (
                <>
                  <div className="drEditRow">
                    <button className="drEdit" onClick={() => setEditing((e) => !e)}>
                      {editing ? 'Done' : 'Edit'}
                    </button>
                  </div>
                  {threads.length === 0 ? (
                    <div className="dr ghost">
                      <span className="g">No chats yet</span>
                    </div>
                  ) : (
                    threads.map((t) => (
                      <div key={t.id} className="drWrap">
                        <button
                          className={`dr${t.id === currentThreadId ? ' on' : ''}`}
                          onClick={() => onThreadPick?.(t.id)}
                        >
                          <span className="g">{t.title}</span>
                          <span className="drDate">
                            {new Date(t.updatedAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </button>
                        {editing ? (
                          <button
                            className="drDel"
                            aria-label={`Delete ${t.title}`}
                            onClick={() => {
                              onThreadDelete?.(t.id);
                              setThreads(getThreads());
                            }}
                          >
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6" />
                            </svg>
                          </button>
                        ) : null}
                      </div>
                    ))
                  )}
                </>
              ) : s.items.length === 0 ? (
                <div className="dr ghost">
                  <span className="g">{s.empty ?? 'Nothing here yet'}</span>
                </div>
              ) : (
                s.items.map((it) => (
                  <button key={it.label} className="dr" onClick={() => onPick(it.label)}>
                    <Icon name={it.icon} />
                    <span className="g">{it.label}</span>
                  </button>
                ))
              )}
            </div>
          ))}
        </div>
        <div className="df">
          <button className="gearbtn" onClick={() => onPick('Settings')} aria-label="Settings">
            <Icon name="gear" />
          </button>
        </div>
      </aside>
    </>
  );
}
