import type { NotifyOpts } from './nav';

type Notify = (message: string, opts?: NotifyOpts) => void;

/* The one way an item leaves: no question asked, a toast with Undo instead.
 * Snapshot the store, act, say so; Undo writes the snapshot back. `act` may
 * return false to mean "nothing happened" (no toast). Every store already has
 * a snapshot/restore pair, so callers pass those two and the delete. The
 * toast re-renders the tree when it closes, so pages that read their store in
 * render pick the restore up without help; `after` is for the ones that hold
 * a copy in state. */
export function undoable<S>(
  notify: Notify,
  msg: string,
  snapshot: () => S,
  restore: (s: S) => void,
  act: () => boolean | void,
  after?: () => void,
): void {
  const snap = snapshot();
  if (act() === false) return;
  after?.();
  notify(msg, {
    undo: () => {
      restore(snap);
      after?.();
    },
  });
}
