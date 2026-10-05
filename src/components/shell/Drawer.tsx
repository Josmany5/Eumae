import type { ReactNode } from 'react';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  children?: ReactNode;
}

export default function Drawer({ open, onClose, children }: DrawerProps) {
  return (
    <>
      <div className={`dscrim${open ? ' open' : ''}`} onClick={onClose} />
      <aside className={`drawer${open ? ' open' : ''}`}>
        <div className="dh">Eumae</div>
        <div className="db">{children}</div>
      </aside>
    </>
  );
}
