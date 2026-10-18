import { useSyncExternalStore } from 'react';

/** The item you tapped, shown in Mae's office as its own tab (Task, Event,
 *  Goal…). One at a time, in memory only: a reload lands back on the page's
 *  normal tabs. */
export type FocusKind = 'task';
export interface Focus {
  k: FocusKind;
  id: string;
}

let cur: Focus | null = null;
const subs = new Set<() => void>();

export function setFocus(f: Focus | null): void {
  cur = f;
  subs.forEach((s) => s());
}

export function getFocus(): Focus | null {
  return cur;
}

export function useFocus(): Focus | null {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => {
        subs.delete(f);
      };
    },
    () => cur,
    () => cur,
  );
}

export const FOCUS_LABEL: Record<FocusKind, string> = { task: 'Task' };

/* "Edit" from the office: the Tasks page, when it's on screen, opens its form
   in place; otherwise the caller navigates there. */
const editors = new Set<(id: string) => void>();
export function onEditTask(f: (id: string) => void): () => void {
  editors.add(f);
  return () => {
    editors.delete(f);
  };
}
/** True when an open Tasks page took the edit. */
export function requestEditTask(id: string): boolean {
  if (!editors.size) return false;
  editors.forEach((f) => f(id));
  return true;
}
