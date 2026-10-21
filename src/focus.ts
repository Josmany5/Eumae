import { useSyncExternalStore } from 'react';

/** The item you tapped, shown in Mae's office as its own tab (Task, Event,
 *  Goal…). One at a time, in memory only: a reload lands back on the page's
 *  normal tabs. */
export type FocusKind = 'task' | 'event' | 'day' | 'goal';
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

export const FOCUS_LABEL: Record<FocusKind, string> = { task: 'Task', event: 'Event', day: 'Day', goal: 'Goal' };

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
export type EditTarget = { k: 'task' | 'event' | 'goal'; id: string } | null;
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

/* "Ask Mae" from a row: open the office and send a ready question, so she
   answers right away instead of waiting on an empty box (his call, Oct 20). */
let pendingAsk: string | null = null;
const askers = new Set<() => void>();
export function askMae(q: string): void {
  pendingAsk = q;
  askers.forEach((f) => f());
}
export function takeAsk(): string | null {
  const q = pendingAsk;
  pendingAsk = null;
  return q;
}
export function onAsk(f: () => void): () => void {
  askers.add(f);
  return () => {
    askers.delete(f);
  };
}

/* "Edit" from a row's ⋯ menu: open the item in Mae's office already in edit
   mode (his call, Oct 21). The item tab takes the request when it's up. */
let pendingEdit: string | null = null;
const officeEditSubs = new Set<() => void>();
export function openOfficeEdit(k: 'task' | 'event' | 'goal', id: string, day?: string): void {
  pendingEdit = k + ':' + id;
  setFocus({ k, id, ...(day ? { day } : {}) });
  officeEditSubs.forEach((f) => f());
}
export function takeOfficeEdit(k: string, id: string): boolean {
  if (pendingEdit !== k + ':' + id) return false;
  pendingEdit = null;
  return true;
}
export function onOfficeEdit(f: () => void): () => void {
  officeEditSubs.add(f);
  return () => {
    officeEditSubs.delete(f);
  };
}
