interface HeaderProps {
  onMenu: () => void;
  onActivity: () => void;
  title: string;
  /** Set while a sub-page is pushed: the menu button becomes a back button. */
  onBack?: () => void;
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

export default function Header({ onMenu, onActivity, title }: HeaderProps) {
  return (
    <header className="hd">
      <button className="hb" onClick={onMenu} aria-label="Menu">
        <MenuIcon />
      </button>
      <div className="t">{title}</div>
      <button className="hb" onClick={onActivity} aria-label="Context">
        <ActivityIcon />
      </button>
    </header>
  );
}
