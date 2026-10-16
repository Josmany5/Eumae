/* Quick add: one line, typed the way you'd say it, becomes fields.
 *
 *   "Dentist Tue 3pm at Main St"            -> event Tue 15:00, loc Main St
 *   "Kung fu every mon wed 7-8:30pm"         -> weekly Mon+Wed 19:00-20:30
 *   "Call Marcus tomorrow 4pm 30m !urgent #work"
 *                                            -> task, due tomorrow 16:00, 30 min,
 *                                               urgent, list "work"
 *
 * Pure and local: no network, no model. Whatever it can't read stays in the
 * title, and every field it pulls out shows as a chip the user can remove.
 * Mae handles anything fuzzier from Chat.
 */

import type { EventType, Repeat } from './events';

export interface Quick {
  title: string;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:MM
  end?: string; // HH:MM
  mins?: number; // duration
  loc?: string;
  rep?: Repeat;
  pr?: 'important' | 'urgent' | 'critical';
  list?: string;
  type?: EventType;
}

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DAY_RE = '(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(?:day|nesday|rsday|urday|sday)?';
const TIME_RE = '(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm|a|p)?';

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function hhmm(h: number, m: number): string {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function to24(h: number, m: number, ap: string | undefined, hint?: 'am' | 'pm'): [number, number] {
  const a = ap ? ap[0] : hint ? hint[0] : undefined;
  if (a === 'p' && h < 12) h += 12;
  if (a === 'a' && h === 12) h = 0;
  /* No am/pm: 1-6 reads as afternoon, the way people mean "at 3". */
  if (!a && h >= 1 && h <= 6) h += 12;
  return [h, m];
}

function dayIndex(word: string): number {
  return DAYS.indexOf(word.slice(0, 3).toLowerCase());
}

export function parseQuick(input: string, now: Date = new Date()): Quick {
  let s = ' ' + input.trim() + ' ';
  const q: Quick = { title: '' };
  const take = (re: RegExp, fn: (m: RegExpMatchArray) => void) => {
    const m = s.match(re);
    if (m) {
      fn(m);
      s = s.replace(m[0], ' ');
    }
  };

  /* #list and !priority */
  take(/\s#([\w-]+)/, (m) => (q.list = m[1].toLowerCase()));
  take(/\s(!!!|!critical|!!|!urgent|!important|!)(?=\s)/i, (m) => {
    const t = m[1].toLowerCase();
    q.pr = t === '!!!' || t === '!critical' ? 'critical' : t === '!!' || t === '!urgent' ? 'urgent' : 'important';
  });

  /* Repeats: "every day", "daily", "every mon wed", "weekly", "monthly" */
  take(new RegExp(`\\s(?:every|each)\\s+((?:${DAY_RE}(?:\\s*(?:,|and|&)?\\s*)?)+)`, 'i'), (m) => {
    const days = (m[1].match(new RegExp(DAY_RE, 'gi')) || []).map(dayIndex).filter((d) => d >= 0);
    q.rep = { f: 'weekly', days: [...new Set(days)].sort() };
  });
  if (!q.rep) take(/\s(?:every\s*day|daily)(?=\s)/i, () => (q.rep = { f: 'daily' }));
  if (!q.rep) take(/\s(?:every\s*weekday|weekdays)(?=\s)/i, () => (q.rep = { f: 'weekly', days: [1, 2, 3, 4, 5] }));
  if (!q.rep) take(/\s(?:every\s*week|weekly)(?=\s)/i, () => (q.rep = { f: 'weekly' }));
  if (!q.rep) take(/\s(?:every\s*month|monthly)(?=\s)/i, () => (q.rep = { f: 'monthly' }));

  /* Time range "3-4pm", "3pm-4:30pm", "15:00-16:00" */
  take(new RegExp(`\\s(?:at\\s+|from\\s+)?${TIME_RE}\\s*(?:-|–|to)\\s*${TIME_RE}(?=\\s)`, 'i'), (m) => {
    const endAp = m[6] as string | undefined;
    const [eh, em] = to24(+m[4], +(m[5] || 0), endAp);
    const startHint = !m[3] && endAp ? (endAp[0] === 'p' && +m[1] <= +m[4] ? 'pm' : 'am') : undefined;
    const [sh, sm] = to24(+m[1], +(m[2] || 0), m[3], startHint);
    q.time = hhmm(sh, sm);
    q.end = hhmm(eh, em);
  });
  /* Single time: "3pm", "3:30 pm", "at 3", "15:00", "noon" */
  if (!q.time) take(/\s(?:at\s+)?(noon|midnight)(?=\s)/i, (m) => (q.time = m[1].toLowerCase() === 'noon' ? '12:00' : '00:00'));
  if (!q.time)
    take(new RegExp(`\\s(?:at\\s+)?(\\d{1,2})(?::(\\d{2}))\\s*(am|pm|a|p)?(?=\\s)`, 'i'), (m) => {
      const [h, mm] = to24(+m[1], +m[2], m[3]);
      q.time = hhmm(h, mm);
    });
  if (!q.time)
    take(new RegExp(`\\s(?:at\\s+)?(\\d{1,2})\\s*(am|pm|a|p)(?=\\s)`, 'i'), (m) => {
      const [h, mm] = to24(+m[1], 0, m[2]);
      q.time = hhmm(h, mm);
    });
  if (!q.time)
    take(/\sat\s+(\d{1,2})(?=\s)/i, (m) => {
      const [h, mm] = to24(+m[1], 0, undefined);
      q.time = hhmm(h, mm);
    });

  /* Duration "30m", "1h", "1.5h", "90 min", "for 2 hours" */
  take(/\s(?:for\s+)?(\d+(?:\.\d+)?)\s*(m|min|mins|minutes|h|hr|hrs|hour|hours)(?=\s)/i, (m) => {
    const n = parseFloat(m[1]);
    q.mins = Math.round(/^h/i.test(m[2]) ? n * 60 : n);
  });

  /* Dates */
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const plus = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + n);
    return ymd(d);
  };
  take(/\s(today|tonight)(?=\s)/i, (m) => {
    q.date = plus(0);
    if (m[1].toLowerCase() === 'tonight' && !q.time) q.time = '20:00';
  });
  if (!q.date) take(/\s(?:by\s+)?(tomorrow|tmrw|tmr)(?=\s)/i, () => (q.date = plus(1)));
  if (!q.date) take(/\sin\s+(\d+)\s+days?(?=\s)/i, (m) => (q.date = plus(+m[1])));
  if (!q.date) take(/\s(?:by\s+)?(?:the\s+)?end\s+of\s+(?:the\s+)?year(?=\s)/i, () => (q.date = `${today.getFullYear()}-12-31`));
  if (!q.date) take(/\s(?:by\s+)?next\s+week(?=\s)/i, () => (q.date = plus(7)));
  if (!q.date)
    take(new RegExp(`\\s(?:on\\s+|by\\s+)?(next\\s+)?${DAY_RE}(?=\\s)`, 'i'), (m) => {
      /* "Tue" = the coming Tuesday (today if it's Tuesday);
         "next Tue" = the one in the following week. */
      const want = dayIndex(m[2]);
      let n = (want - today.getDay() + 7) % 7;
      if (m[1] && n < 7 - today.getDay()) n += 7;
      q.date = plus(n);
    });
  if (!q.date)
    take(/\s(?:on\s+|by\s+)?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?=\s)/i, (m) => {
      q.date = futureDate(today, MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()), +m[2]);
    });
  if (!q.date)
    take(/\s(?:on\s+|by\s+)?(\d{1,2})\/(\d{1,2})(?=\s)/, (m) => {
      q.date = futureDate(today, +m[1] - 1, +m[2]);
    });
  if (q.rep && !q.date) {
    /* A weekly series with days starts on the next of those days. */
    if (q.rep.f === 'weekly' && q.rep.days && q.rep.days.length) {
      for (let n = 0; n < 7; n++) {
        const d = new Date(today);
        d.setDate(d.getDate() + n);
        if (q.rep.days.includes(d.getDay())) {
          q.date = ymd(d);
          break;
        }
      }
    } else q.date = plus(0);
  }

  /* Location: "at Main St" / "@ Main St" — whatever follows, to the end. */
  take(/\s(?:at|@)\s+([A-Za-z][^#!]*?)\s*$/i, (m) => (q.loc = m[1].trim()));

  q.title = s.replace(/\s+/g, ' ').trim();
  if (q.time && q.mins && !q.end) {
    const t = q.time.split(':').map(Number);
    const total = t[0] * 60 + t[1] + q.mins;
    q.end = hhmm(Math.floor(total / 60) % 24, total % 60);
  }
  q.type = guessType(q.title);
  return q;
}

function futureDate(today: Date, month: number, day: number): string {
  let y = today.getFullYear();
  const d = new Date(y, month, day, 12);
  if (d < today) y += 1;
  return ymd(new Date(y, month, day, 12));
}

/** Kind from the words, the way people name things. */
export function guessType(title: string): EventType | undefined {
  const t = title.toLowerCase();
  if (/\b(class|lesson|lecture|seminar|course|kung fu|yoga|practice)\b/.test(t)) return 'class';
  if (/\b(dentist|doctor|dr\.?|appointment|appt|haircut|checkup|clinic|therapy|vet)\b/.test(t)) return 'appointment';
  if (/\b(meeting|meet|call|sync|standup|1:1|interview|lunch with|coffee with)\b/.test(t)) return 'meeting';
  return undefined;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Repeat as words: "Weekly on Mon, Wed until Dec 1". */
export function repLabel(r: Repeat | undefined, start?: string): string {
  if (!r) return 'Does not repeat';
  let s =
    r.f === 'daily'
      ? 'Every day'
      : r.f === 'monthly'
        ? 'Monthly' + (start ? ' on the ' + ordinal(+start.slice(8)) : '')
        : 'Weekly' +
          (r.days && r.days.length
            ? r.days.length === 5 && [1, 2, 3, 4, 5].every((d) => r.days!.includes(d))
              ? ' on weekdays'
              : ' on ' + r.days.map((d) => DAY_NAMES[d]).join(', ')
            : start
              ? ' on ' + DAY_NAMES[new Date(start + 'T12:00').getDay()]
              : '');
  if (r.until) s += ' until ' + fmtShort(r.until);
  return s;
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function fmtShort(day: string): string {
  return new Date(day + 'T12:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/** "15:30" -> "3:30 PM". */
export function fmtTime(tm: string | undefined): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(tm ?? '');
  if (!m) return tm ?? '';
  const h = +m[1];
  const ap = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return m[2] === '00' ? `${h12} ${ap}` : `${h12}:${m[2]} ${ap}`;
}
