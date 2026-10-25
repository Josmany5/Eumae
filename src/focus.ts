import { useSyncExternalStore } from 'react';

/** The item you tapped, shown in Eumae's office as its own tab (Task, Event,
 *  Goal…). One at a time, in memory only: a reload lands back on the page's
 *  normal tabs. */
export type FocusKind = 'task' | 'event' | 'day' | 'goal' | 'project';
export interface Focus {
  k: FocusKind;
  id: string;
  /** Events: the occurrence's date (a repeat shows the day you tapped). */
  day?: string;
}

let cur: Focus | null = null;
const subs = new Set<() => void>();

export function setFocus(f: Focus | null): void {
  /* Moving off a brand-new item from More that was never saved drops it. */
  if (fresh && (!f || fresh.key !== f.k + ':' + f.id)) discardFresh();
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

export const FOCUS_LABEL: Record<FocusKind, string> = { task: 'Task', event: 'Event', day: 'Day', goal: 'Goal', project: 'Project' };

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

/* "Ask Eumae" from a row: open the office and send a ready question, so she
   answers right away instead of waiting on an empty box (his call, Oct 20). */
let pendingAsk: string | null = null;
const askers = new Set<() => void>();
export function askEumae(q: string): void {
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

/* "Edit" from a row's ⋯ menu: open the item in Eumae's office already in edit
   mode (his call, Oct 21). The item tab takes the request when it's up. */
let pendingEdit: string | null = null;
const officeEditSubs = new Set<() => void>();
export function openOfficeEdit(k: 'task' | 'event' | 'goal' | 'project', id: string, day?: string): void {
  pendingEdit = k + ':' + id;
  setFocus({ k, id, ...(day ? { day } : {}) });
  officeEditSubs.forEach((f) => f());
}
/* "Open in Eumae's office": open it READ-ONLY (his call, Oct 22). Drops any
   edit request still waiting from an earlier tap, and tells an open tab in
   edit mode to leave it. */
let pendingView: string | null = null;
export function openOfficeView(k: 'task' | 'event' | 'goal' | 'project', id: string): void {
  pendingEdit = null;
  pendingView = k + ':' + id;
  setFocus({ k, id });
  officeEditSubs.forEach((f) => f());
}
export function takeOfficeView(k: string, id: string): boolean {
  if (pendingView !== k + ':' + id) return false;
  pendingView = null;
  return true;
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

/* A brand-new item from QuickAdd's More (his call, Oct 25): it opens in the
   office in edit mode, but it only counts once you press Done. Cancel, the
   item tab's ×, closing the office, or moving to another item removes it as
   if it never existed — no toast, no Undo. */
let fresh: { key: string; discard: () => void } | null = null;
export function markFresh(k: 'task' | 'event' | 'goal' | 'project', id: string, discard: () => void): void {
  if (fresh) discardFresh();
  fresh = { key: k + ':' + id, discard };
}
export function isFresh(k: string, id: string): boolean {
  return !!fresh && fresh.key === k + ':' + id;
}
/** Done was pressed: the new item stays. */
export function keepFresh(k: string, id: string): void {
  if (isFresh(k, id)) fresh = null;
}
/** Throw away the unsaved new item, if there is one. True when it did. */
export function discardFresh(): boolean {
  if (!fresh) return false;
  const f = fresh;
  fresh = null;
  f.discard();
  if (cur && cur.k + ':' + cur.id === f.key) {
    cur = null;
    subs.forEach((s) => s());
  }
  dataChanged();
  return true;
}
