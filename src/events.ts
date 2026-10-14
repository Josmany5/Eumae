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
}

const KEY = 'eumae:events';

let cache: CalEvent[] | null = null;

function load(): CalEvent[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      cache = seeds();
      return cache;
    }
    const parsed = JSON.parse(raw);
    cache = Array.isArray(parsed) ? parsed.filter(isEvent) : seeds();
    return cache;
  } catch {
    cache = seeds();
    return cache;
  }
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

/** The day's events, time-sorted — the mockup's `dayEvents(calDay)`. Times
 *  are "H:MM" so a numeric split sorts them; an unparseable time sorts last,
 *  never first. */
export function dayEvents(day: string): CalEvent[] {
  const mins = (tm: string): number => {
    const m = /^(\d+):(\d+)/.exec(tm);
    if (!m) return 24 * 60 + 1;
    return Number(m[1]) * 60 + Number(m[2]);
  };
  return load()
    .filter((e) => e.d === day)
    .sort((a, b) => mins(a.tm) - mins(b.tm));
}

export function saveEvent(event: CalEvent): void {
  const events = load();
  const i = events.findIndex((e) => e.d === event.d && e.tm === event.tm && e.t === event.t);
  if (i >= 0) events[i] = event;
  else events.push(event);
  save(events);
}

export function deleteEvent(event: CalEvent): void {
  save(load().filter((e) => !(e.d === event.d && e.tm === event.tm && e.t === event.t)));
}
