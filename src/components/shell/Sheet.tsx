import type { ReactNode } from 'react';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
}

export default function Sheet({ open, onClose, title, children }: SheetProps) {
  return (
    <>
      <div className={`scrim${open ? ' open' : ''}`} onClick={onClose} />
      <div className={`sheet${open ? ' open' : ''}`} role="dialog" aria-label={title}>
        <div className="sh">
          <div className="t">{title}</div>
        </div>
        {/* Its own class: "sb" belongs to the rail, and sharing it made this
            inherit the rail's border-right at desktop width. */}
        <div className="sheetBody">{children ?? <div className="empty">Nothing here yet.</div>}</div>
      </div>
    </>
  );
}
