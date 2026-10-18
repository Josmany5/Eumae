import { Icon } from './icons';

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

/** Mae's sparkle: the door to Mae's office. */
export function MaeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z" />
      <path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
    </svg>
  );
}

export default function Header({ onMenu, onActivity, title, onBack }: HeaderProps) {
  return (
    <header className="hd">
      {onBack ? (
        <button className="hb" onClick={onBack} aria-label="Back">
          <Icon name="bk" />
        </button>
      ) : (
        <button className="hb" onClick={onMenu} aria-label="Menu">
          <MenuIcon />
        </button>
      )}
      <div className="t">{title}</div>
      <button className="hb hbMae" onClick={onActivity} aria-label="Mae's office" title="Mae's office">
        <MaeIcon />
      </button>
    </header>
  );
}
