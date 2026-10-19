import { useSyncExternalStore } from 'react';

/** The item you tapped, shown in Mae's office as its own tab (Task, Event,
 *  Goal…). One at a time, in memory only: a reload lands back on the page's
 *  normal tabs. */
export type FocusKind = 'task' | 'event' | 'day';
export interface Focus {
  k: FocusKind;
  id: string;
  /** Events: the occurrence's date (a repeat shows the day you tapped). */
  day?: string;
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

export const FOCUS_LABEL: Record<FocusKind, string> = { task: 'Task', event: 'Event', day: 'Day' };

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

/* Same for events: the Calendar page opens its form in place. */
const evEditors = new Set<(id: string) => void>();
export function onEditEvent(f: (id: string) => void): () => void {
  evEditors.add(f);
  return () => {
    evEditors.delete(f);
  };
}
export function requestEditEvent(id: string): boolean {
  if (!evEditors.size) return false;
  evEditors.forEach((f) => f(id));
  return true;
}

/* ── Edit pop-up: "Edit" in the office on a page that isn't the item's own
   opens the form over the current page instead of navigating away. A
   second tap on Edit closes it. ── */
export type EditTarget = { k: 'task' | 'event'; id: string } | null;
let editCur: EditTarget = null;
const editSubs = new Set<() => void>();
export function toggleEditModal(t: EditTarget): void {
  editCur = t && editCur && editCur.k === t.k && editCur.id === t.id ? null : t;
  editSubs.forEach((f) => f());
}
export function useEditModal(): EditTarget {
  return useSyncExternalStore(
    (f) => {
      editSubs.add(f);
      return () => {
        editSubs.delete(f);
      };
    },
    () => editCur,
    () => editCur,
  );
}

/* ── Data changed somewhere (pop-up save, undo): views that read the
   stores re-render. ── */
const dataSubs = new Set<() => void>();
export function dataChanged(): void {
  dataSubs.forEach((f) => f());
}
export function onDataChange(f: () => void): () => void {
  dataSubs.add(f);
  return () => {
    dataSubs.delete(f);
  };
}
