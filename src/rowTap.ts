import type { MouseEvent } from 'react';

/* The whole row opens the item in Mae's office, not just its title (his call,
   Oct 21). Taps on the row's own controls (checkbox, ⋯, chips, inputs) keep
   doing their own job. */
export function rowTap(open: (() => void) | undefined) {
  return (e: MouseEvent) => {
    if (!open) return;
    const t = e.target as HTMLElement;
    if (t.closest('button, a, input, select, textarea, label, [role="checkbox"], [role="menu"], .imPop')) return;
    open();
  };
}
