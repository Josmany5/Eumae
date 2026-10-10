import { useEffect, useRef, useState } from 'react';
import { getThread, getThreads } from '../../threads';
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
/** Export a thread as markdown and download it. */
function exportThread(id: string) {
  const thread = getThread(id);
  if (!thread) return;
  const lines = [`# ${thread.title}`, ''];
  lines.push(`_${new Date(thread.createdAt).toLocaleString()}_`, '');
  for (const m of thread.messages) {
    const who = m.role === 'you' ? '**You**' : '**Eumae**';
    const time = m.ts ? ` <sub>${new Date(m.ts).toLocaleTimeString()}</sub>` : '';
    lines.push(`${who}${time}`, '', m.text || '', '');
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${thread.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

/** A thread row that swipes left to reveal Delete and Export. */
function SwipeRow({
  thread: t,
  current,
  open,
  onOpen,
  onClose,
  onPick,
  onDelete,
  onExport,
}: {
  thread: { id: string; title: string; updatedAt: number };
  current: boolean;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onPick: () => void;
  onDelete: () => void;
  onExport: () => void;
}) {
  const startX = useRef(0);
  const liveDx = useRef(0);
  const [shownDx, setShownDx] = useState(0);

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    liveDx.current = 0;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const delta = e.touches[0].clientX - startX.current;
    liveDx.current = delta < 0 ? Math.max(delta, -140) : 0;
    setShownDx(liveDx.current);
  };
  const onTouchEnd = () => {
    if (liveDx.current < -60) onOpen();
    else onClose();
    liveDx.current = 0;
    setShownDx(0);
  };

  return (
    <div className="swipeRow" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div className="swipeActions">
        <button className="swExp" onClick={onExport} aria-label="Export chat">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
          </svg>
        </button>
        <button className="swDel" onClick={onDelete} aria-label="Delete chat">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6" />
          </svg>
        </button>
      </div>
      <div
        className={`drSwipe${current ? ' on' : ''}`}
        style={{ transform: open ? 'translateX(-140px)' : shownDx ? `translateX(${shownDx}px)` : undefined }}
        onClick={() => {
          if (open) onClose();
          else onPick();
        }}
      >
        <span className="g">{t.title}</span>
        <span className="drDate">
          {new Date(t.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </span>
      </div>
      <div className="drDesktop">
        <button className="drIconBtn" onClick={onExport} aria-label="Export chat">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
          </svg>
        </button>
        <button className="drIconBtn danger" onClick={onDelete} aria-label="Delete chat">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function Drawer({ open, onClose, tab, onPick, onSearch, currentThreadId, onThreadPick, onThreadDelete }: DrawerProps) {
  /* Threads read fresh every time the drawer opens — App's cached copy goes
     stale when a title updates mid-chat (the 2026-10-10 stale list). */
  const [threads, setThreads] = useState<{ id: string; title: string; updatedAt: number }[]>([]);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  useEffect(() => {
    if (open && tab === 'chat') {
      setThreads(getThreads());
      setOpenRow(null);
      setDeleteTarget(null);
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
                  {threads.length === 0 ? (
                    <div className="dr ghost">
                      <span className="g">No chats yet</span>
                    </div>
                  ) : (
                    threads.map((t) => (
                      <SwipeRow
                        key={t.id}
                        thread={t}
                        current={t.id === currentThreadId}
                        open={openRow === t.id}
                        onOpen={() => setOpenRow(t.id)}
                        onClose={() => setOpenRow(null)}
                        onPick={() => onThreadPick?.(t.id)}
                        onDelete={() => setDeleteTarget({ id: t.id, title: t.title })}
                        onExport={() => {
                          exportThread(t.id);
                          setOpenRow(null);
                        }}
                      />
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
      {deleteTarget ? (
        <>
          <div className="dlgScrim" onClick={() => setDeleteTarget(null)} />
          <div className="dlg" role="alertdialog" aria-label="Delete chat">
            <div className="dlgTitle">Delete this chat?</div>
            <div className="dlgBody">"{deleteTarget.title}" will be gone for good.</div>
            <div className="dlgBtns">
              <button className="dlgCancel" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button
                className="dlgDanger"
                onClick={() => {
                  onThreadDelete?.(deleteTarget.id);
                  setDeleteTarget(null);
                  setOpenRow(null);
                  setThreads(getThreads());
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
