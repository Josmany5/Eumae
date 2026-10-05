import { useState } from 'react';
import type { JSX } from 'react';
import type { TabId } from './TabBar';

const ICONS: Record<string, JSX.Element> = {
  chat: <path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z" />,
  doc: <><path d="M6 2h9l5 5v15H6z" /><path d="M14 2v6h6" /></>,
  fol: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  clk: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>,
  cal: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  chk: <><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M8.5 12.5l2.5 2.5 4.5-5.5" /></>,
  bel: <path d="M18 9a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7M10 20a2 2 0 0 0 4 0" />,
  sea: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" /></>,
  pls: <path d="M12 5v14M5 12h14" />,
  lnk: <path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5" />,
  str: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />,
  zap: <path d="M13 2L4 14h6l-1 8 9-12h-6z" />,
  db: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></>,
  cap: <path d="M3 9l9-5 9 5-9 5-9-5zM6 11v4c0 1.5 3 3 6 3s6-1.5 6-3v-4" />,
};

function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

interface MenuItem {
  label: string;
  icon: string;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

const MENU: Record<TabId, MenuSection[]> = {
  chat: [
    { title: '', items: [{ label: 'New chat', icon: 'pls' }] },
    { title: 'Recent chats', items: [] },
    { title: '', items: [{ label: 'Search chats', icon: 'sea' }, { label: 'Archive', icon: 'doc' }] },
    { title: 'Project shortcuts', items: [] },
    { title: '', items: [{ label: 'Settings', icon: 'gear' }] },
  ],
  console: [
    { title: 'Console', items: [
      { label: 'Today', icon: 'clk' },
      { label: 'Tasks', icon: 'chk' },
      { label: 'Calendar', icon: 'cal' },
      { label: 'Pinned project', icon: 'fol' },
      { label: 'Customize', icon: 'gear' },
    ] },
    { title: '', items: [{ label: 'Settings', icon: 'gear' }] },
  ],
  studio: [
    { title: 'Studio', items: [
      { label: 'Recent', icon: 'clk' },
      { label: 'Drafts', icon: 'doc' },
      { label: 'Published', icon: 'str' },
      { label: 'Agents', icon: 'chat' },
      { label: 'Flows', icon: 'zap' },
      { label: 'Project filter', icon: 'fol' },
    ] },
    { title: '', items: [{ label: 'Settings', icon: 'gear' }] },
  ],
  library: [
    { title: 'Library', items: [
      { label: 'All', icon: 'fol' },
      { label: 'Recent', icon: 'clk' },
      { label: 'Favorites', icon: 'str' },
      { label: 'Shared with me', icon: 'lnk' },
      { label: 'Folders', icon: 'fol' },
      { label: 'Collections', icon: 'db' },
      { label: 'Sources', icon: 'lnk' },
      { label: 'Trash', icon: 'doc' },
    ] },
    { title: '', items: [{ label: 'Settings', icon: 'gear' }] },
  ],
  classroom: [
    { title: 'Classroom', items: [
      { label: 'Continue', icon: 'cap' },
      { label: 'Study plan', icon: 'cal' },
      { label: 'Courses', icon: 'doc' },
      { label: 'Review', icon: 'chk' },
      { label: 'Progress', icon: 'str' },
      { label: 'Sources', icon: 'db' },
    ] },
    { title: '', items: [{ label: 'Settings', icon: 'gear' }] },
  ],
  guild: [
    { title: 'Guild', items: [
      { label: 'Messages', icon: 'chat' },
      { label: 'Requests', icon: 'bel' },
      { label: 'People & Groups', icon: 'fol' },
      { label: 'Shared work', icon: 'fol' },
      { label: 'Activity', icon: 'clk' },
    ] },
    { title: '', items: [{ label: 'Settings', icon: 'gear' }] },
  ],
};

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  tab: TabId;
  onPick: (label: string) => void;
  onSearch: () => void;
}

export default function Drawer({ open, onClose, tab, onPick, onSearch }: DrawerProps) {
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
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search"
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            />
          </div>
          {MENU[tab].map((s, i) => (
            <div key={i}>
              {s.title ? <div className="ds">{s.title}</div> : null}
              {s.items.length === 0 ? (
                <div className="dr ghost"><span className="g">Nothing here yet</span></div>
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
      </aside>
    </>
  );
}
