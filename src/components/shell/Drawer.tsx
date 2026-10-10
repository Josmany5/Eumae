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
}

/** The phone's second level: the same per-page menu the desktop rail shows,
 *  behind the hamburger. The mockup puts the search field above everything,
 *  so it does too. */
export default function Drawer({ open, onClose, tab, onPick, onSearch, currentThreadId, onThreadPick }: DrawerProps) {
  /* Threads read fresh every time the drawer opens — App's cached copy goes
     stale when a title updates mid-chat (the 2026-10-10 stale list). */
  const [threads, setThreads] = useState<{ id: string; title: string }[]>([]);
  useEffect(() => {
    if (open && tab === 'chat') setThreads(getThreads());
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
                threads.length === 0 ? (
                  <div className="dr ghost">
                    <span className="g">No chats yet</span>
                  </div>
                ) : (
                  threads.map((t) => (
                    <button
                      key={t.id}
                      className={`dr${t.id === currentThreadId ? ' on' : ''}`}
                      onClick={() => onThreadPick?.(t.id)}
                    >
                      <span className="g">{t.title}</span>
                    </button>
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
