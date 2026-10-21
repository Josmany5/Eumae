#!/usr/bin/env node
/* Overdue and "Did you attend?" check (Oct 21, his calls).
 *
 * Overdue goes by the clock: a task due today at 11:00 is late at 11:00, not
 * tomorrow. A date-only task is late the next day. An ended event is never
 * assumed attended: it waits for an answer, kept per occurrence, and a
 * reschedule moves a one-off or copies one date out of a series.
 *
 * Exit codes: 0 everything holds, 1 something does not. */
import { buildSync } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const store = { 'eumae:events': '[]', 'eumae:tasks': '[]' };
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
const out = buildSync({
  stdin: {
    contents: `export * from './src/due'; export { saveEvent, getEvent, getEvents, setAttendance, attendanceOf, rescheduleOccurrence, ymd } from './src/events';`,
    resolveDir: new URL('..', import.meta.url).pathname,
    loader: 'ts',
  },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
  define: { 'import.meta.env': '{}' },
});
const file = join(mkdtempSync(join(tmpdir(), 'due-')), 'due.mjs');
writeFileSync(file, out.outputFiles[0].text);
const M = await import(pathToFileURL(file).href);

let bad = 0;
const ok = (c, what) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${what}`); if (!c) bad++; };

const at = (h, m = 0) => { const d = new Date(); d.setHours(h, m, 0, 0); return d; };
const now = at(19);
const today = M.ymd(now);
const shift = (n) => { const d = new Date(now); d.setDate(d.getDate() + n); return M.ymd(d); };

// Tasks
ok(M.isOverdue({ d: 0, due: today, tm: '11:00' }, now), '11 AM task is overdue at 7 PM the same day (the bug he found)');
ok(M.isOverdue({ d: 0, due: today, tm: '19:00' }, now), 'due at 7:00 PM is overdue at 7:00 PM');
ok(!M.isOverdue({ d: 0, due: today, tm: '20:00' }, now), 'due at 8 PM is not overdue at 7 PM');
ok(!M.isOverdue({ d: 0, due: today }, now), 'a date-only task is not overdue on its day');
ok(M.isOverdue({ d: 0, due: shift(-1) }, now), 'a date-only task is overdue the next day');
ok(!M.isOverdue({ d: 1, due: shift(-3), tm: '09:00' }, now), 'a done task is never overdue');
ok(!M.isOverdue({ d: 0 }, now), 'a someday task is never overdue');

// Events end
ok(M.hasEnded({ tm: '10:00', end: '11:00' }, today, now), 'an event that ended at 11 has ended at 7 PM');
ok(!M.hasEnded({ tm: '18:30', end: '20:00' }, today, now), 'an event running now has not ended');
ok(M.hasEnded({ tm: '17:30' }, today, now), 'no end time: counted as an hour long');
ok(!M.hasEnded({ tm: '18:30' }, today, now), 'no end time, started 30 min ago: not ended');
ok(!M.hasEnded({ tm: '', allDay: true }, today, now), 'an all-day event ends at midnight');
ok(M.hasEnded({ tm: '', allDay: true }, shift(-1), now), "yesterday's all-day event has ended");

// Attendance
const dent = M.saveEvent({ d: today, tm: '11:00', end: '12:00', t: 'Dentist' });
const gym = M.saveEvent({ d: shift(-14), tm: '07:00', end: '08:00', t: 'Gym', rep: { f: 'daily' } });
M.saveEvent({ d: today, tm: '09:00', t: 'Example', example: true });
M.saveEvent({ d: shift(-20), tm: '09:00', t: 'Old one' });
M.saveEvent({ d: today, tm: '10:00', end: '10:30', t: 'Optional meetup', imp: 'optional' });
let asks = M.toConfirm(now);
ok(asks.some((a) => a.ev.id === dent.id && a.day === today), 'an ended event asks "Did you attend?"');
ok(!asks.some((a) => a.ev.t === 'Example'), 'example seeds never ask');
ok(!asks.some((a) => a.ev.t === 'Optional meetup'), 'Optional events never ask');
ok(!asks.some((a) => a.ev.t === 'Old one'), `nothing older than ${M.ASK_DAYS} days asks`);
ok(asks.filter((a) => a.ev.id === gym.id).length === 1 && asks.find((a) => a.ev.id === gym.id).day === today, 'a daily event asks once, about its latest date');

M.setAttendance(dent.id, today, 'yes');
ok(M.attendanceOf(M.getEvent(dent.id), today) === 'yes', 'Attended is saved');
ok(!M.toConfirm(now).some((a) => a.ev.id === dent.id), 'an answered event stops asking');
M.setAttendance(gym.id, today, 'no');
const g = M.getEvent(gym.id);
ok(g.d === shift(-14) && g.rep?.f === 'daily', 'answering one date leaves the series start and repeat alone');
ok(M.attendanceOf(g, shift(-1)) === undefined, 'other dates stay unanswered (never assumed)');
ok(!M.toConfirm(now).some((a) => a.ev.id === gym.id), 'once its latest date is answered, a series stops asking about older dates');
M.setAttendance(dent.id, today, null);
ok(M.attendanceOf(M.getEvent(dent.id), today) === undefined, 'Undo clears the answer');

// Reschedule
const before = M.getEvents().length;
const mustE = M.saveEvent({ d: shift(-1), tm: '09:00', end: '09:30', t: 'Court date', imp: 'must', rep: { f: 'weekly' } });
const mcopy = M.rescheduleOccurrence(mustE.id, shift(3), '10:00');
ok(mcopy.imp === 'must', 'a rescheduled copy keeps its importance');
const before2 = M.getEvents().length;
M.rescheduleOccurrence(dent.id, shift(2), '15:00');
const d2 = M.getEvent(dent.id);
ok(d2.d === shift(2) && d2.tm === '15:00' && d2.end === '16:00', 'a one-off moves and keeps its length');
ok(M.getEvents().length === before2, 'moving a one-off makes no copy');
const copy = M.rescheduleOccurrence(gym.id, shift(1), '18:00');
ok(M.getEvents().length === before2 + 1 && !copy.rep && copy.t === 'Gym' && copy.end === '19:00', 'a series date becomes a one-off copy');
ok(M.getEvent(gym.id).rep?.f === 'daily', 'the series keeps repeating');

console.log(bad ? `\n${bad} failed` : '\ndue: all good');
process.exit(bad ? 1 : 0);
