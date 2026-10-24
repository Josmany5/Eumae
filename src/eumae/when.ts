/* Dates and times in the person's own words, worked out by code (his call,
 * Oct 19, 10 PM). Eumae said "tomorrow" on a Monday and staged Wednesday: models
 * slip at calendar maths. So date fields take a phrase ("tomorrow", "in 3
 * weeks", "next Friday", "Nov 14", "the second Friday of November") and this
 * file turns it into YYYY-MM-DD against the device's own clock. A phrase that
 * could mean two days comes back with both, so Eumae asks which one; a phrase it
 * can't read comes back so she asks the person instead of guessing.
 *
 * Times the same: "7 pm", "7:30am", "noon", "midnight". A bare "7" could be
 * morning or evening, so it is sent back. */

import type { Param } from './schema';

export type When = { ok: true; value: string } | { ok: false; why: string };

const WD = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WD_SHORT: Record<string, number> = { sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, weds: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6 };
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const NUM: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, couple: 2, 'a couple of': 2, few: 3, 'a few': 3 };
const ORD: Record<string, number> = { first: 1, '1st': 1, second: 2, '2nd': 2, third: 3, '3rd': 3, fourth: 4, '4th': 4, fifth: 5, '5th': 5, last: -1 };

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const at = (y: number, m: number, d: number) => new Date(y, m, d, 12);
const addDays = (d: Date, n: number) => at(d.getFullYear(), d.getMonth(), d.getDate() + n);
const addMonths = (d: Date, n: number) => {
  const last = new Date(d.getFullYear(), d.getMonth() + n + 1, 0).getDate();
  return at(d.getFullYear(), d.getMonth() + n, Math.min(d.getDate(), last));
};
const show = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
/** Monday of the week d is in (weeks run Monday to Sunday). */
const monday = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));

function weekday(w: string): number | undefined {
  const i = WD.indexOf(w);
  if (i >= 0) return i;
  return WD_SHORT[w];
}

function month(w: string): number | undefined {
  const i = MONTHS.indexOf(w);
  if (i >= 0) return i;
  const j = MONTHS.findIndex((m) => w.length >= 3 && m.startsWith(w));
  return j >= 0 ? j : undefined;
}

function count(w: string): number | undefined {
  if (/^\d+$/.test(w)) return Number(w);
  return NUM[w];
}

/** The Nth (or last) weekday of a month. */
function nthWeekday(y: number, m: number, wd: number, n: number): Date | null {
  if (n === -1) {
    const last = new Date(y, m + 1, 0, 12);
    return addDays(last, -((last.getDay() - wd + 7) % 7));
  }
  const first = at(y, m, 1);
  const d = addDays(first, ((wd - first.getDay() + 7) % 7) + (n - 1) * 7);
  return d.getMonth() === m ? d : null;
}

/** A month and day with no year: this year, or next year once it has passed. */
function nextMonthDay(today: Date, m: number, d: number): Date | null {
  let y = today.getFullYear();
  let dt = at(y, m, d);
  if (dt.getMonth() !== m) return null;
  if (iso(dt) < iso(today)) {
    y += 1;
    dt = at(y, m, d);
    if (dt.getMonth() !== m) return null;
  }
  return dt;
}

export function resolveDate(raw: string, now: Date = new Date()): When {
  const today = at(now.getFullYear(), now.getMonth(), now.getDate());
  const p = raw
    .toLowerCase()
    .replace(/[,.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(on|by|for|due|before|this coming|coming) /, '')
    .replace(/ (at|by) .*$/, '')
    .trim();
  const ok = (d: Date | null): When => (d && !Number.isNaN(d.getTime()) ? { ok: true, value: iso(d) } : { ok: false, why: `"${raw}" is not a real day` });
  const two = (a: Date, b: Date): When => ({ ok: false, why: `"${raw}" could mean ${show(a)} or ${show(b)}. Ask the person which one` });

  if (/^\d{4}-\d{2}-\d{2}$/.test(p)) {
    const [y, m, d] = p.split('-').map(Number);
    const dt = at(y, m - 1, d);
    return dt.getMonth() === m - 1 ? ok(dt) : { ok: false, why: `"${raw}" is not a real day` };
  }
  if (p === 'today' || p === 'tonight' || p === 'this evening' || p === 'this morning' || p === 'this afternoon' || p === 'now') return ok(today);
  if (p === 'tomorrow' || p === 'tmrw' || p === 'tmr' || p === 'tomorrow night' || p === 'tomorrow morning' || p === 'tomorrow evening' || p === 'tomorrow afternoon') return ok(addDays(today, 1));
  if (p === 'day after tomorrow' || p === 'the day after tomorrow') return ok(addDays(today, 2));
  if (p === 'yesterday') return ok(addDays(today, -1));

  // in 3 weeks · 3 weeks from now · a week from today · in a couple of days
  let m = /^(?:in )?(a couple of|a few|\d+|[a-z]+) (day|week|month|year)s?(?: from (?:now|today))?(?: later)?$/.exec(p);
  if (m && (p.startsWith('in ') || / from (now|today)$/.test(p) || /later$/.test(p))) {
    const n = count(m[1]);
    if (n !== undefined) {
      const u = m[2];
      return ok(u === 'day' ? addDays(today, n) : u === 'week' ? addDays(today, n * 7) : u === 'month' ? addMonths(today, n) : addMonths(today, n * 12));
    }
  }
  m = /^in (a couple of|a few|\d+|[a-z]+) (day|week|month|year)s?$/.exec(p);
  if (m) {
    const n = count(m[1]);
    if (n !== undefined) return ok(m[2] === 'day' ? addDays(today, n) : m[2] === 'week' ? addDays(today, n * 7) : addMonths(today, m[2] === 'month' ? n : n * 12));
  }
  if (p === 'next week') return ok(addDays(monday(today), 7));
  if (p === 'next month') return ok(at(today.getFullYear(), today.getMonth() + 1, 1));
  if (p === 'next year') return ok(at(today.getFullYear() + 1, 0, 1));
  if (p === 'end of the week' || p === 'end of week' || p === 'end of this week' || p === 'the end of the week') return ok(addDays(monday(today), 4));
  if (p === 'end of next week' || p === 'the end of next week') return ok(addDays(monday(today), 11));
  if (p === 'end of the month' || p === 'end of month' || p === 'end of this month' || p === 'the end of the month') return ok(new Date(today.getFullYear(), today.getMonth() + 1, 0, 12));
  if (p === 'end of next month' || p === 'the end of next month') return ok(new Date(today.getFullYear(), today.getMonth() + 2, 0, 12));
  if (p === 'this weekend' || p === 'the weekend' || p === 'weekend') {
    const dow = today.getDay();
    return ok(dow === 0 || dow === 6 ? today : addDays(today, 6 - dow));
  }
  if (p === 'next weekend') return ok(addDays(monday(today), 12));

  // friday · this friday · next friday · friday next week
  m = /^(this |next )?([a-z]+)( next week| this week)?$/.exec(p);
  if (m) {
    const wd = weekday(m[2]);
    if (wd !== undefined) {
      const ahead = (wd - today.getDay() + 7) % 7 || 7; // the coming one, never today
      const coming = addDays(today, ahead);
      const sameWeek = iso(monday(coming)) === iso(monday(today));
      if (m[3] === ' next week') return ok(addDays(monday(today), 7 + ((wd + 6) % 7)));
      if (m[3] === ' this week') return ok(addDays(monday(today), (wd + 6) % 7));
      if (m[1] === 'next ') return sameWeek ? two(coming, addDays(coming, 7)) : ok(coming);
      return ok(coming);
    }
  }

  // the second friday of november · last monday of next month · first tuesday in december
  m = /^(?:the )?([a-z0-9]+) ([a-z]+) (?:of|in) (next month|this month|[a-z]+)(?: (\d{4}))?$/.exec(p);
  if (m && ORD[m[1]] !== undefined && weekday(m[2]) !== undefined) {
    const n = ORD[m[1]];
    const wd = weekday(m[2])!;
    let y = today.getFullYear();
    let mo: number | undefined;
    if (m[3] === 'next month') {
      mo = today.getMonth() + 1;
    } else if (m[3] === 'this month') {
      mo = today.getMonth();
    } else {
      mo = month(m[3]);
      if (mo === undefined) return { ok: false, why: `couldn't read "${raw}" as a date. Ask the person which day they mean` };
      if (m[4]) y = Number(m[4]);
    }
    if (mo > 11) {
      mo -= 12;
      y += 1;
    }
    let d = nthWeekday(y, mo, wd, n);
    if (d && !m[4] && iso(d) < iso(today) && m[3] !== 'this month') d = nthWeekday(y + 1, mo, wd, n);
    return d ? ok(d) : { ok: false, why: `"${raw}" doesn't exist that month` };
  }

  // nov 14 · november 14th · 14 november · nov 14 2027
  m = /^([a-z]+) (\d{1,2})(?:st|nd|rd|th)?(?: (\d{4}))?$/.exec(p) ?? null;
  let mo: number | undefined;
  let dd: number | undefined;
  let yy: number | undefined;
  if (m && month(m[1]) !== undefined) {
    mo = month(m[1]);
    dd = Number(m[2]);
    yy = m[3] ? Number(m[3]) : undefined;
  } else {
    m = /^(?:the )?(\d{1,2})(?:st|nd|rd|th)? (?:of )?([a-z]+)(?: (\d{4}))?$/.exec(p);
    if (m && month(m[2]) !== undefined) {
      mo = month(m[2]);
      dd = Number(m[1]);
      yy = m[3] ? Number(m[3]) : undefined;
    }
  }
  if (mo === undefined) {
    m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/.exec(p);
    if (m) {
      mo = Number(m[1]) - 1;
      dd = Number(m[2]);
      yy = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : undefined;
    }
  }
  if (mo !== undefined && dd !== undefined) {
    if (yy !== undefined) {
      const dt = at(yy, mo, dd);
      return dt.getMonth() === mo ? ok(dt) : { ok: false, why: `"${raw}" is not a real day` };
    }
    const dt = nextMonthDay(today, mo, dd);
    return dt ? ok(dt) : { ok: false, why: `"${raw}" is not a real day` };
  }
  // the 14th: this month, or next month once it has passed
  m = /^(?:the )?(\d{1,2})(?:st|nd|rd|th)$/.exec(p);
  if (m) {
    const d = Number(m[1]);
    let dt = at(today.getFullYear(), today.getMonth(), d);
    if (dt.getMonth() !== today.getMonth()) return { ok: false, why: `"${raw}" is not a real day this month` };
    if (iso(dt) < iso(today)) dt = at(today.getFullYear(), today.getMonth() + 1, d);
    return ok(dt);
  }

  return { ok: false, why: `couldn't work out a date from "${raw}". Ask the person which day they mean` };
}

export function resolveTime(raw: string): When {
  const p = raw.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim().replace(/^(at|by|around|about) /, '');
  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(p)) return { ok: true, value: p };
  if (p === 'noon' || p === 'midday' || p === '12 noon') return { ok: true, value: '12:00' };
  if (p === 'midnight') return { ok: true, value: '00:00' };
  let m = /^(\d{1,2})(?::([0-5]\d))? ?(am|pm|a|p)$/.exec(p);
  if (!m) m = /^(\d{1,2})(?::([0-5]\d))? ?(?:o'?clock )?(?:in the )?(morning|afternoon|evening|tonight|at night|night)$/.exec(p);
  if (m) {
    let h = Number(m[1]);
    const mm = m[2] ?? '00';
    if (h < 1 || h > 12) return { ok: false, why: `"${raw}" is not a real time` };
    const pm = /^(pm|p|afternoon|evening|tonight|at night|night)$/.test(m[3]);
    if (pm && h !== 12) h += 12;
    if (!pm && h === 12) h = 0;
    return { ok: true, value: `${pad(h)}:${mm}` };
  }
  if (/^\d{1,2}(:[0-5]\d)?$/.test(p)) return { ok: false, why: `"${raw}" could be morning or evening. Ask the person which` };
  return { ok: false, why: `couldn't work out a time from "${raw}". Ask the person what time they mean` };
}

/** Walks a call's arguments against its form and swaps every date or time
 *  phrase for the real value. Returns the first phrase it couldn't settle,
 *  named by where it sits, so Eumae can ask about exactly that. */
export function resolveWhen(p: Param, v: unknown, where = 'args', now: Date = new Date()): { value: unknown; error: string | null } {
  if (v === undefined || v === null) return { value: v, error: null };
  if (p.type === 'string' && (p.format === 'date' || p.format === 'time') && typeof v === 'string' && v.trim() !== '') {
    const r = p.format === 'date' ? resolveDate(v, now) : resolveTime(v);
    return r.ok ? { value: r.value, error: null } : { value: v, error: `${where}: ${r.why}.` };
  }
  if (p.type === 'array' && Array.isArray(v)) {
    const out: unknown[] = [];
    for (let i = 0; i < v.length; i++) {
      const r = resolveWhen(p.items, v[i], `${where}[${i}]`, now);
      if (r.error) return { value: v, error: r.error };
      out.push(r.value);
    }
    return { value: out, error: null };
  }
  if (p.type === 'object' && v && typeof v === 'object' && !Array.isArray(v)) {
    const o = { ...(v as Record<string, unknown>) };
    for (const [k, sub] of Object.entries(p.properties)) {
      if (!(k in o)) continue;
      const r = resolveWhen(sub, o[k], `${where}.${k}`, now);
      if (r.error) return { value: v, error: r.error };
      o[k] = r.value;
    }
    return { value: o, error: null };
  }
  return { value: v, error: null };
}
