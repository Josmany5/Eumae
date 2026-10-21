/* Events: what the calendar holds.
 *
 * Fields follow the mockup's SEED (`events:[{d,tm,t}]` — date YYYY-MM-DD,
 * time, title). Example seeds are the mockup's own rows, labeled examples
 * until live data replaces them.
 */

export interface CalEvent {
  /** Date, YYYY-MM-DD. */
  d: string;
  /** Time, free form like the mockup ("9:00", "14:00"). */
  tm: string;
  /** What happens. */
  t: string;
  /** True for a labeled example seed. Never synced anywhere. */
  example?: boolean;
  /* ── Richer fields (wove's Event, Oct 2026). All optional, so the
     mockup's {d,tm,t} rows stay valid. ── */
  /** Stable id. Rows saved before ids existed get one on load. */
  id?: string;
  /** End time, HH:MM. */
  end?: string;
  /** All day: no time on the grid, sits in the all-day row. */
  allDay?: boolean;
  /** Where. */
  loc?: string;
  /** Kind: drives the dot color. */
  type?: EventType;
  /** Repeat rule. Occurrences are computed, never stored. */
  rep?: Repeat;
  /** Notes. */
  note?: string;
  /** Repeating events: dates (YYYY-MM-DD) removed from the series one at a
   *  time — "delete this occurrence" — while the rest keep repeating. */
  skip?: string[];
  /** Did you attend? One answer per occurrence date (YYYY-MM-DD): 'yes'
   *  attended, 'no' not attended. Absent means not answered — never assumed
   *  (his call, Oct 21). */
  att?: Record<string, 'yes' | 'no'>;
  /** Must go / Should go / Optional. Absent = Should go. */
  imp?: EventImportance;
}

export type EventType = 'class' | 'meeting' | 'appointment' | 'other';

/** How much it matters (his idea, Oct 21). Absent = 'should'. */
export type EventImportance = 'must' | 'should' | 'optional';
export const EVENT_IMPORTANCE: EventImportance[] = ['must', 'should', 'optional'];
export const IMPORTANCE_LABEL: Record<EventImportance, string> = { must: 'Must go', should: 'Should go', optional: 'Optional' };
export function importanceOf(e: Pick<CalEvent, 'imp'>): EventImportance {
  return e.imp === 'must' || e.imp === 'optional' ? e.imp : 'should';
}
export const EVENT_TYPES: EventType[] = ['meeting', 'appointment', 'class', 'other'];

export interface Repeat {
  f: 'daily' | 'weekly' | 'monthly';
  /** Weekly: days of week 0-6 (Sun-Sat). Empty = the start date's weekday. */
  days?: number[];
  /** Last date it repeats, YYYY-MM-DD. Absent = forever. */
  until?: string;
}

const KEY = 'eumae:events';

let cache: CalEvent[] | null = null;

function load(): CalEvent[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      cache = withIds(seeds());
      return cache;
    }
    const parsed = JSON.parse(raw);
    cache = withIds(Array.isArray(parsed) ? parsed.filter(isEvent) : seeds());
    return cache;
  } catch {
    cache = withIds(seeds());
    return cache;
  }
}

let idSeq = 0;
export function newEventId(): string {
  idSeq += 1;
  return 'ev' + Date.now().toString(36) + idSeq.toString(36);
}

/* Older rows have no id: derive a stable one from their fields so edits
   and deletes target one row even when two share a title. */
function withIds(events: CalEvent[]): CalEvent[] {
  return events.map((e, i) => (e.id ? e : { ...e, id: 'evl' + i + '-' + e.d + '-' + e.tm }));
}

/* The mockup's own rows: the Console's schedule and calendar read these. */
function seeds(): CalEvent[] {
  return [
    { d: '2026-10-01', tm: '9:00', t: 'Kung fu class', example: true },
    { d: '2026-10-01', tm: '14:00', t: 'Deep work: Eumae demo', example: true },
    { d: '2026-10-01', tm: '17:30', t: 'Call with Jose', example: true },
    { d: '2026-10-05', tm: '9:00', t: 'Kung fu class 94', example: true },
  ];
}

function save(events: CalEvent[]): void {
  cache = events;
  try {
    localStorage.setItem(KEY, JSON.stringify(events));
  } catch {
    /* Storage full — in-memory still works. */
  }
}

function isEvent(e: unknown): e is CalEvent {
  if (!e || typeof e !== 'object') return false;
  const o = e as Record<string, unknown>;
  return typeof o.d === 'string' && typeof o.tm === 'string' && typeof o.t === 'string';
}

export function getEvents(): CalEvent[] {
  return [...load()];
}

/** Minutes past midnight for "H:MM"; unparseable sorts last. */
export function mins(tm: string | undefined): number {
  const m = /^(\d+):(\d+)/.exec(tm ?? '');
  if (!m) return 24 * 60 + 1;
  return Number(m[1]) * 60 + Number(m[2]);
}

function dow(day: string): number {
  return new Date(day + 'T12:00').getDay();
}

/** Does this event happen on `day`? Its own date, or a repeat of it. */
export function occursOn(e: CalEvent, day: string): boolean {
  if (Array.isArray(e.skip) && e.skip.includes(day)) return false;
  if (e.d === day) return true;
  const r = e.rep;
  if (!r || day < e.d) return false;
  if (r.until && day > r.until) return false;
  if (r.f === 'daily') return true;
  if (r.f === 'weekly') {
    const days = r.days && r.days.length ? r.days : [dow(e.d)];
    return days.includes(dow(day));
  }
  return day.slice(8) === e.d.slice(8);
}

/** The day's events, time-sorted — the mockup's `dayEvents(calDay)`.
 *  Repeating events appear on every day they occur, carrying that day as
 *  `d`; the series keeps its own start date in the store. All-day events
 *  sort first. */
export function dayEvents(day: string): CalEvent[] {
  return load()
    .filter((e) => occursOn(e, day))
    .map((e) => (e.d === day ? e : { ...e, d: day }))
    .sort((a, b) => (a.allDay ? -1 : mins(a.tm)) - (b.allDay ? -1 : mins(b.tm)));
}

/** Every occurrence from `from` for `days` days, in order. */
export function eventsBetween(from: string, days: number): CalEvent[] {
  const out: CalEvent[] = [];
  const base = new Date(from + 'T12:00');
  for (let i = 0; i < days; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    out.push(...dayEvents(ymd(d)));
  }
  return out;
}

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getEvent(id: string): CalEvent | undefined {
  return load().find((e) => e.id === id);
}

/** Save by id (new rows get one). Rows without an id fall back to the
 *  mockup's d+tm+t match. */
export function saveEvent(event: CalEvent): CalEvent {
  const events = load();
  const e = event.id ? event : { ...event, id: newEventId() };
  const i = events.findIndex((x) =>
    event.id ? x.id === event.id : x.d === event.d && x.tm === event.tm && x.t === event.t,
  );
  if (i >= 0) events[i] = e;
  else events.push(e);
  save(events);
  return e;
}

export function deleteEvent(event: Pick<CalEvent, 'd' | 'tm' | 't'> & { id?: string }): void {
  save(
    load().filter((e) =>
      event.id ? e.id !== event.id : !(e.d === event.d && e.tm === event.tm && e.t === event.t),
    ),
  );
}

/* Remove one date from a repeating series; the series itself stays. */
export function skipOccurrence(id: string, day: string): void {
  save(load().map((e) => (e.id === id ? { ...e, skip: [...(Array.isArray(e.skip) ? e.skip : []), day] } : e)));
}

/* Undo: a deep copy of the store taken before a delete; the toast's Undo
   writes it back. Same shape as snapshotTasks / snapshotLibrary. */
export function snapshotEvents(): CalEvent[] {
  return JSON.parse(JSON.stringify(load()));
}

export function restoreEvents(s: CalEvent[]): void {
  save(s);
}

/* ── Attendance (Oct 21, his call): after an event ends, Eumae asks
   "Did you attend?" and keeps the answer per occurrence. ── */

export function attendanceOf(e: CalEvent, day: string): 'yes' | 'no' | undefined {
  return e.att && typeof e.att === 'object' ? e.att[day] : undefined;
}

/** Answer (or clear, with null) one occurrence. Writes the stored series by
 *  id, never the dated copy dayEvents hands out. */
export function setAttendance(id: string, day: string, v: 'yes' | 'no' | null): void {
  save(
    load().map((e) => {
      if (e.id !== id) return e;
      const att = { ...(e.att && typeof e.att === 'object' ? e.att : {}) };
      if (v) att[day] = v;
      else delete att[day];
      return { ...e, att };
    }),
  );
}

function hhmm(m: number): string {
  const c = Math.max(0, Math.min(23 * 60 + 59, m));
  return `${String(Math.floor(c / 60)).padStart(2, '0')}:${String(c % 60).padStart(2, '0')}`;
}

/** Move one occurrence to a new day and time. A one-off event moves; a
 *  repeating one keeps its series and gets a one-off copy on the new day.
 *  The length is kept when there is an end time. */
export function rescheduleOccurrence(id: string, newDay: string, newTm: string): CalEvent | undefined {
  const e = getEvent(id);
  if (!e) return undefined;
  const len = e.end && e.tm ? mins(e.end) - mins(e.tm) : undefined;
  const tm = newTm || e.tm;
  const end = len !== undefined && len > 0 && newTm ? hhmm(mins(newTm) + len) : newTm ? undefined : e.end;
  if (!e.rep) return saveEvent({ ...e, d: newDay, tm, end, allDay: newTm ? false : e.allDay });
  const copy: CalEvent = { d: newDay, tm, t: e.t, end, loc: e.loc, type: e.type, note: e.note, imp: e.imp, allDay: newTm ? false : e.allDay };
  return saveEvent(copy);
}
