import { useSyncExternalStore } from 'react';

/* The areas a row can be filed under — the six tabs in their tab-bar order, plus
   `All`. `All` is a view of the list, not an area; everything else is a
   destination that can hold something worth auditing, which is why Library is
   here even though the mockup's own filter row (line 1434) forgot it. Keeping
   the order identical to the tab bar means the filter reads like the app. */
export const LOG_AREAS = ['All', 'Chat', 'Console', 'Studio', 'Library', 'Classroom', 'Guild'] as const;

export type LogArea = (typeof LOG_AREAS)[number];

/** An area you can actually file into — every name except the `All` view. */
export type LogFiled = Exclude<LogArea, 'All'>;

/** The dot a row opens with (mockup CSS 116, re-named to say what it means):
 *  green for something that happened, amber for something waiting on you, red
 *  for something that failed. */
export type LogStatus = 'ok' | 'warn' | 'bad';

export interface LogEntry {
  /** The writer's own counter — so a list has a stable key without the entry
   *  having to carry one, and no two rows can ever look alike to React. */
  id: number;
  area: LogFiled;
  text: string;
  ts: string;
  status: LogStatus;
}

/** What a caller hands over. `ts` is stamped from the clock and `status`
 *  defaults, both in the writer — so no component can invent a time or paint
 *  its own dot. */
export type LogDraft = Omit<LogEntry, 'id' | 'ts' | 'status'> & { status?: LogStatus };

/* The log: one array, newest first, plus a set of listeners. Module scope rather
   than React state because its readers are not each other's parents — Settings →
   Logs today, the panel's Activity zone and Console's Activity card when those
   exist. In memory only: storing it would put a growing list inside every
   export, and this phase's job is the writer, not the archive. */
let entries: LogEntry[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

/** The one writer. Nothing else appends to the log — a second writer is how this
 *  codebase grew its recurring bug (§9), and twice a control has grown a second
 *  door to one room. */
export function logEv(draft: LogDraft): void {
  const entry: LogEntry = {
    id: nextId++,
    area: draft.area,
    text: draft.text,
    status: draft.status ?? 'ok',
    ts: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
  };
  entries = [entry, ...entries];
  listeners.forEach((fn) => fn());
}

export function logAll(): LogEntry[] {
  return entries;
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** The read: the whole log, or one area's slice of it. `useLog` filters here
 *  rather than at each reader, so a row can never fall between two filters.
 *
 *  The third argument is the snapshot for a render with no DOM — the SSR check
 *  in §5 renders the Settings overlay, so this has to survive it. */
export function useLog(area: LogArea = 'All'): LogEntry[] {
  const all = useSyncExternalStore(subscribe, logAll, logAll);
  return area === 'All' ? all : all.filter((e) => e.area === area);
}
