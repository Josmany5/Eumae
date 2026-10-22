/* When is something late? One answer for the whole app (Oct 21, his call).
 *
 * A task with a time is overdue once that time passes; a task with only a
 * date is overdue the next day. Before this every screen compared dates only,
 * so an 11 AM task still read "on time" at 7 PM.
 *
 * An event that has ended is not assumed attended: it waits for "Did you
 * attend?" (Attended / Not attended), kept per occurrence in events.ts. */
import type { Task } from './tasks';
import { type CalEvent, attendanceOf, dayEvents, importanceOf, mins, occursOn, ymd } from './events';

/** How far back the app still asks "Did you attend?". Older ones are left alone. */
export const ASK_DAYS = 7;

/** An event with a start but no end is treated as an hour long. */
const DEFAULT_LEN = 60;

function nowMin(now: Date): number {
  return now.getHours() * 60 + now.getMinutes();
}

export function isOverdue(t: Pick<Task, 'd' | 'due' | 'tm'>, now: Date = new Date()): boolean {
  if (t.d || !t.due) return false;
  const today = ymd(now);
  if (t.due < today) return true;
  if (t.due > today || !t.tm) return false;
  return mins(t.tm) <= nowMin(now);
}

/** Has this occurrence (the event on `day`) ended? All-day events end at midnight. */
export function hasEnded(e: Pick<CalEvent, 'tm' | 'end' | 'allDay'>, day: string, now: Date = new Date()): boolean {
  const today = ymd(now);
  if (day < today) return true;
  if (day > today || e.allDay) return false;
  const start = mins(e.tm);
  if (start > 24 * 60) return false;
  const end = e.end ? mins(e.end) : start + DEFAULT_LEN;
  return end <= nowMin(now);
}

/** Ended, unanswered occurrences from the last ASK_DAYS days, newest first.
 *  A repeating event asks only about its latest ended date, so a daily class
 *  is one row, not seven; once that date is answered, older dates stay quiet.
 *  Optional events never ask (Oct 21). Example seeds never ask. */
export function toConfirm(now: Date = new Date()): { ev: CalEvent; day: string }[] {
  const out: { ev: CalEvent; day: string }[] = [];
  /* Series already judged on a newer date: answered or asked, older dates stay quiet. */
  const seen = new Set<string>();
  for (let i = 0; i < ASK_DAYS; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const day = ymd(d);
    const evs = dayEvents(day).filter((e) => !e.example && e.id && importanceOf(e) !== 'optional' && hasEnded(e, day, now));
    for (const ev of evs.reverse()) {
      if (ev.rep) {
        if (seen.has(ev.id!)) continue;
        seen.add(ev.id!);
      }
      if (!attendanceOf(ev, day)) out.push({ ev, day });
    }
  }
  return out;
}

/** "11 days left", "Today", "3 days late" for a YYYY-MM-DD deadline. */
export function daysLeft(d: string, now = new Date()): { text: string; red: boolean } {
  const n = Math.round((new Date(d + 'T00:00').getTime() - new Date(ymd(now) + 'T00:00').getTime()) / 86400000);
  if (n === 0) return { text: 'Today', red: false };
  if (n < 0) return { text: `${-n} day${n === -1 ? '' : 's'} late`, red: true };
  return { text: `${n} day${n === 1 ? '' : 's'} left`, red: false };
}

/** An occurrence's attendance, for any row that shows an event (Oct 22, his
 *  ask: everywhere, not just Today). Null before it ends; 'ask' once it has
 *  ended with no answer; then his answer. Example seeds and optional events
 *  never ask (same as toConfirm). */
export function attendState(ev: CalEvent | undefined, day: string, now: Date = new Date()): 'ask' | 'yes' | 'no' | null {
  if (!ev || ev.example || !ev.id || importanceOf(ev) === 'optional' || !hasEnded(ev, day, now)) return null;
  return attendanceOf(ev, day) ?? 'ask';
}

/** The word a row shows for it: "Did you attend?", "Attended", "Not attended". */
export function attendLabel(s: 'ask' | 'yes' | 'no' | null): string {
  return s === 'ask' ? 'Did you attend?' : s === 'yes' ? 'Attended' : s === 'no' ? 'Not attended' : '';
}

/** Which date a list should show for a stored event: a one-off is its own
 *  date; a series is its newest ended, unanswered date from the last
 *  ASK_DAYS, else its next date in the coming 60 days, else its start. */
export function eventDay(ev: CalEvent, now: Date = new Date()): string {
  if (!ev.rep) return ev.d;
  for (let i = 0; i < ASK_DAYS; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const day = ymd(d);
    if (occursOn(ev, day) && hasEnded(ev, day, now)) {
      if (!attendanceOf(ev, day)) return day;
      break;
    }
  }
  for (let i = 0; i < 60; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const day = ymd(d);
    if (occursOn(ev, day) && !hasEnded(ev, day, now)) return day;
  }
  return ev.d;
}
