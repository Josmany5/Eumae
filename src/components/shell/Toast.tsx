import { useEffect } from 'react';
import type { ToastMsg } from '../../nav';

interface ToastProps {
  toast: ToastMsg | null;
  onDone: () => void;
}

/* One toast at a time. With an undo it stays a little longer and takes taps
   (the plain toast lets them through), so the Undo can be reached. */
export default function Toast({ toast, onDone }: ToastProps) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDone, toast.undo ? 5000 : 2200);
    return () => clearTimeout(t);
  }, [toast, onDone]);

  return (
    <div className={`tst${toast ? ' show' : ''}${toast?.undo ? ' act' : ''}`}>
      {toast?.msg}
      {toast?.undo ? (
        <button
          className="tstUndo"
          onClick={() => {
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
