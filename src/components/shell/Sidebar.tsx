import type { TabId } from './TabBar';
import { Icon } from './icons';

const NAV: { id: TabId; label: string; icon: string }[] = [
  { id: 'chat', label: 'Chat', icon: 'chat' },
  { id: 'console', label: 'Console', icon: 'clk' },
  { id: 'studio', label: 'Studio', icon: 'zap' },
  { id: 'library', label: 'Library', icon: 'fol' },
  { id: 'classroom', label: 'Classroom', icon: 'cap' },
  { id: 'guild', label: 'Guild', icon: 'bel' },
];

interface SidebarProps {
  active: TabId;
  onSelect: (tab: TabId) => void;
  onNewChat: () => void;
  onSettings: () => void;
  onSearch: () => void;
}

export default function Sidebar({ active, onSelect, onNewChat, onSettings, onSearch }: SidebarProps) {
  return (
    <aside className="sb">
      <div className="sbHead">
        <span className="sbMark">Eumae</span>
      </div>

      <button className="sbNew" onClick={onNewChat}>
        <Icon name="pls" />
        <span>New chat</span>
      </button>

      <div className="sbSearch">
        <input
          placeholder="Search"
          aria-label="Search"
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSearch();
          }}
        />
      </div>

      <nav className="sbNav">
        {NAV.map((n) => (
          <button key={n.id} className={`sbItem${active === n.id ? ' on' : ''}`} onClick={() => onSelect(n.id)}>
            <Icon name={n.icon} />
            <span>{n.label}</span>
          </button>
        ))}
      </nav>

      <div className="sbFoot">
        <button className="sbItem" onClick={onSettings}>
          <Icon name="gear" />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
}
