import { useEffect } from 'react';

interface ToastProps {
  message: string | null;
  onDone: () => void;
}

export default function Toast({ message, onDone }: ToastProps) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [message, onDone]);

  return <div className={`tst${message ? ' show' : ''}`}>{message}</div>;
}
