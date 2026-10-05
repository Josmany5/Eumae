import { useState } from 'react';
import type { TabId } from './TabBar';
import { Icon } from './icons';

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
    { title: '', items: [{ label: 'Archive', icon: 'doc' }] },
    { title: 'Project shortcuts', items: [] },
  ],
  console: [
    { title: 'Console', items: [
      { label: 'Today', icon: 'clk' },
      { label: 'Tasks', icon: 'chk' },
      { label: 'Calendar', icon: 'cal' },
      { label: 'Pinned project', icon: 'fol' },
      { label: 'Customize', icon: 'gear' },
    ] },
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
  ],
  guild: [
    { title: 'Guild', items: [
      { label: 'Messages', icon: 'chat' },
      { label: 'Requests', icon: 'bel' },
      { label: 'People & Groups', icon: 'fol' },
      { label: 'Shared work', icon: 'fol' },
      { label: 'Activity', icon: 'clk' },
    ] },
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
        <div className="df">
          <button className="gearbtn" onClick={() => onPick('Settings')} aria-label="Settings">
            <Icon name="gear" />
          </button>
        </div>
      </aside>
    </>
  );
}
