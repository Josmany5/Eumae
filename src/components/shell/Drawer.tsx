import { useEffect, useRef, useState } from 'react';
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
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const pressTimer = useRef<number | null>(null);
  useEffect(() => {
    if (open && tab === 'chat') {
      setThreads(getThreads());
      setConfirmDelete(null);
    }
  }, [open, tab ]);
  const startPress = (id: string) => {
    pressTimer.current = window.setTimeout(() => setConfirmDelete(id), 500);
  };
  const endPress = () => {
    if (pressTimer.current) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };
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
                threads.length === 0 ? (
                  <div className="dr ghost">
                    <span className="g">No chats yet</span>
                  </div>
                ) : (
                  threads.map((t) => (
                    <div key={t.id} className="drWrap">
                      <button
                        className={`dr${t.id === currentThreadId ? ' on' : ''}`}
                        onClick={() => onThreadPick?.(t.id)}
                        onTouchStart={() => startPress(t.id)}
                        onTouchEnd={endPress}
                        onTouchMove={endPress}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setConfirmDelete(t.id);
                        }}
                      >
                        <span className="g">{t.title}</span>
                        <span className="drDate">
                          {new Date(t.updatedAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </button>
                      {confirmDelete === t.id ? (
                        <button
                          className="drDel"
                          onClick={() => {
                            onThreadDelete?.(t.id);
                            setConfirmDelete(null);
                            setThreads(getThreads());
                          }}
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  ))
                )
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
