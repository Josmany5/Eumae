interface HeaderProps {
  title: string;
  onMenu: () => void;
  onActivity: () => void;
  onSettings: () => void;
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16M4 12h16M4 17h10" />
    </svg>
  );
}

function ActivityIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 3" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.07-.4.1-.8.1-1.2z" />
    </svg>
  );
}

export default function Header({ title, onMenu, onActivity, onSettings }: HeaderProps) {
  return (
    <header className="hd">
      <button className="hb" onClick={onMenu} aria-label="Menu">
        <MenuIcon />
      </button>
      <div className="t">{title}</div>
      <button className="hb" onClick={onActivity} aria-label="Activity">
        <ActivityIcon />
      </button>
      <button className="hb" onClick={onSettings} aria-label="Settings">
        <GearIcon />
      </button>
    </header>
  );
}
