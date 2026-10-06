import { Icon } from './icons';

export type TabId = 'chat' | 'console' | 'studio' | 'library' | 'classroom' | 'guild';

/** The one list of tabs. The phone tab bar and the desktop rail both read it. */
export const TABS: { id: TabId; label: string }[] = [
  { id: 'chat', label: 'Chat' },
  { id: 'console', label: 'Console' },
  { id: 'studio', label: 'Studio' },
  { id: 'library', label: 'Library' },
  { id: 'classroom', label: 'Classroom' },
  { id: 'guild', label: 'Guild' },
];

interface TabBarProps {
  active: TabId;
  onChange: (tab: TabId) => void;
}

export default function TabBar({ active, onChange }: TabBarProps) {
  const idx = Math.max(0, TABS.findIndex((t) => t.id === active));
  return (
    <nav className="tbar">
      <span className="ind" aria-hidden="true" style={{ transform: `translateX(${idx * 100}%)` }} />
      {TABS.map(({ id, label }) => (
        <button key={id} className={active === id ? 'on' : ''} onClick={() => onChange(id)} aria-label={label}>
          <Icon name={`tab-${id}`} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
