import type { JSX } from 'react';

export type TabId = 'chat' | 'console' | 'studio' | 'library' | 'classroom' | 'guild';

interface TabBarProps {
  active: TabId;
  onChange: (tab: TabId) => void;
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 5h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-6l-3.5 2.5v-2.5H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
    </svg>
  );
}

function ConsoleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M9 20h6M12 16v4" />
    </svg>
  );
}

function StudioIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

function LibraryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 6c-2-1.5-5-2-8-2v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2zM12 6v14" />
    </svg>
  );
}

function ClassroomIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4L2 9l10 5 10-5-10-5z" />
      <path d="M6 11v4c0 1.5 3 3 6 3s6-1.5 6-3v-4" />
      <path d="M22 9v5" />
    </svg>
  );
}

function GuildIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4" />
    </svg>
  );
}

const TABS: { id: TabId; label: string; Icon: () => JSX.Element }[] = [
  { id: 'chat', label: 'Chat', Icon: ChatIcon },
  { id: 'console', label: 'Console', Icon: ConsoleIcon },
  { id: 'studio', label: 'Studio', Icon: StudioIcon },
  { id: 'library', label: 'Library', Icon: LibraryIcon },
  { id: 'classroom', label: 'Classroom', Icon: ClassroomIcon },
  { id: 'guild', label: 'Guild', Icon: GuildIcon },
];

export default function TabBar({ active, onChange }: TabBarProps) {
  const idx = Math.max(0, TABS.findIndex((t) => t.id === active));
  return (
    <nav className="tbar">
      <span className="ind" aria-hidden="true" style={{ transform: `translateX(${idx * 100}%)` }} />
      {TABS.map(({ id, label, Icon }) => (
        <button key={id} className={active === id ? 'on' : ''} onClick={() => onChange(id)} aria-label={label}>
          <Icon />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
