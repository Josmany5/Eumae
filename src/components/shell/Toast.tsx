import { useEffect, useState } from 'react';
import type { ToastMsg } from '../../nav';

interface ToastProps {
  toast: ToastMsg | null;
  onDone: () => void;
}

/* One toast at a time. With an undo it stays 8 seconds and takes taps (the
   plain toast lets them through), so the Undo can be reached; resting a
   pointer on it holds it open. A long sentence stays long enough to read.
   The timer keys on the toast itself, not on `onDone`, which App recreates
   on every render. */
export default function Toast({ toast, onDone }: ToastProps) {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (!toast || held) return;
    const ms = toast.undo ? 8000 : Math.max(2200, Math.min(6000, toast.msg.length * 60));
    const t = setTimeout(onDone, ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast, held]);

  return (
    <div
      className={`tst${toast ? ' show' : ''}${toast?.undo ? ' act' : ''}`}
      onPointerEnter={() => toast?.undo && setHeld(true)}
      onPointerLeave={() => setHeld(false)}
    >
      {toast?.msg}
      {toast?.undo ? (
        <button
          className="tstUndo"
          onClick={() => {
            setHeld(false);
            toast.undo?.();
            onDone();
          }}
        >
          Undo
        </button>
      ) : null}
    </div>
  );
}
