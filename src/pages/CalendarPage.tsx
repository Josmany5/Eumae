/* Calendar full page — wove's AdvancedCalendar, rebuilt on Eumae tokens.
 *
 * Agenda / Month (Oct 18: the Option D agenda replaced Day and Week). Agenda
 * is seven days as flat rows under day headers; Month is a grid you read
 * with the selected day's rows under it. The calendar shows events
 * AND tasks that have a due date (timed tasks sit in the grid, untimed ones
 * in the all-day row), each with a dot in its kind's color.
 *
 * Adding: the quick-add line on top ("Dentist Tue 3pm at Main St"), or tap
 * an empty hour to add right there. Tap an event to edit it; tap a task to
 * check it off. Events (the list) lives on its own page and reads the same
 * store, so the two always agree.
 */

import { rowTap } from '../rowTap';
import { useEffect, useMemo, useState } from 'react';
import { useNav } from '../nav';
import { dayEvents, saveEvent, deleteEvent, ymd, mins, type CalEvent } from '../events';
import { getTasks, toggleTask, type Task } from '../tasks';
import { attendanceOf } from '../events';
import { hasEnded } from '../due';

/* An ended event says whether you attended; it is never assumed (Oct 21). An
   unanswered one reads "Did you attend?" in the accent and is not greyed out;
   tap it to answer in its Event tab. */
function attendWord(ev: CalEvent | undefined, day: string): { text: string; ask: boolean } | null {
  if (!ev || ev.example || !ev.id || !hasEnded(ev, day)) return null;
  const a = attendanceOf(ev, day);
  return a === 'yes' ? { text: 'Attended', ask: false } : a === 'no' ? { text: 'Not attended', ask: false } : { text: 'Did you attend?', ask: true };
}
import { QuickAdd, quickToEvent } from '../components/QuickAdd';
import { setFocus, onDataChange, openOfficeEdit, markFresh } from '../focus';
import { evKind } from '../components/shell/Timeline';
import { fmtTime } from '../quickadd';
import { useMedia } from '../useMedia';
import { getGoals } from '../goals';
import { getProjects } from '../projects';
import type { PageProps } from './index';

type CalView = 'today' | 'week' | 'month';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function todayStr(): string {
  return ymd(new Date());
}
function shift(day: string, n: number): string {
  const d = new Date(day + 'T12:00');
  d.setDate(d.getDate() + n);
  return ymd(d);
}
function monthShift(day: string, n: number): string {
  const d = new Date(day + 'T12:00');
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return ymd(d);
}

/** One thing on the calendar: an event occurrence or a dated task. */
export interface Item {
  key: string;
  kind: 'event' | 'task' | 'goal' | 'project' | 'milestone';
  /** Where tapping it goes, for goals, projects and milestones. */
  link?: { page: string; arg?: string };
  title: string;
  day: string;
  start?: number; // minutes; undefined = all day
  end?: number;
  color: string; // css class suffix
  done?: boolean;
  ev?: CalEvent;
  task?: Task;
}

export function itemsOn(day: string, tasks: Task[]): Item[] {
  const evs: Item[] = dayEvents(day).map((e) => {
    const s = e.allDay || !e.tm ? undefined : mins(e.tm);
    const en = s === undefined ? undefined : e.end ? Math.max(mins(e.end), s + 15) : s + 60;
    return {
      key: 'e' + (e.id ?? e.t) + day,
      kind: 'event',
      title: e.t,
      day,
      start: s !== undefined && s < 24 * 60 ? s : undefined,
      end: en,
      color: e.type ?? 'other',
      ev: e,
    };
  });
  const ts: Item[] = tasks
    .filter((t) => t.due === day)
    .map((t) => {
      const s = t.tm ? mins(t.tm) : undefined;
      return {
        key: 't' + t.id,
        kind: 'task',
        title: t.t,
        day,
        start: s !== undefined && s < 24 * 60 ? s : undefined,
        end: s !== undefined ? s + Math.max(t.est ?? 30, 20) : undefined,
        color: 'task',
        done: !!t.d,
        task: t,
      };
    });
  /* Goal targets, project deadlines, and their milestones: all-day markers. */
  const marks: Item[] = [];
  for (const g of getGoals()) {
    if (g.td === day) marks.push({ key: 'g' + g.id, kind: 'goal', title: 'Goal: ' + g.t, day, color: 'goal', done: g.st === 'completed', link: { page: 'goals' } });
    for (const m of g.ms ?? [])
      if (m.d === day) marks.push({ key: 'gm' + m.id, kind: 'milestone', title: m.t + ' · ' + g.t, day, color: 'milestone', done: !!m.done, link: { page: 'goals' } });
  }
  for (const p of getProjects()) {
    if (p.due === day) marks.push({ key: 'p' + p.id, kind: 'project', title: 'Due: ' + p.n, day, color: 'project', link: { page: 'project', arg: p.id } });
    for (const m of p.ms ?? [])
      if (m.d === day) marks.push({ key: 'pm' + m.id, kind: 'milestone', title: m.t + ' · ' + p.n, day, color: 'milestone', done: !!m.done, link: { page: 'project', arg: p.id } });
  }
  return [...marks, ...evs, ...ts].sort((a, b) => (a.start ?? -1) - (b.start ?? -1));
}

export default function CalendarPage(_: PageProps) {
  const { notify, go, openPanel, panelOpen } = useNav();
  const desktop = useMedia('(min-width:900px)');
  const [view, setView] = useState<CalView>('week');
  const [day, setDay] = useState(() => todayStr());
  /* Week view: the strip's first day; `day` is the one picked in it. */
  const [wk, setWk] = useState(() => todayStr());
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  useEffect(() => onDataChange(refresh), []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tasks = useMemo(() => getTasks(), [tick]);
  const today = todayStr();

  const step = (n: number) => {
    if (view === 'today') setDay(shift(day, n));
    else if (view === 'week') {
      setWk(shift(wk, 7 * n));
      setDay(shift(day, 7 * n));
    }
    else setDay(monthShift(day, n));
  };

  const label =
    view === 'month'
      ? new Date(day + 'T12:00').toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      : view === 'today'
        ? new Date(day + 'T12:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
        : (() => {
          const a = new Date(wk + 'T12:00');
          const b = new Date(shift(wk, 6) + 'T12:00');
          const sameMonth = a.getMonth() === b.getMonth();
          return (
            a.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
            ' – ' +
            b.toLocaleDateString(undefined, sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' })
          );
        })();

  /* "+" on a day: make it, then edit it inline in Eumae's office, the same as
     More. Only Done keeps it (his call, Oct 25). */
  const openNew = (d: string) => {
    const e = saveEvent({ d, tm: '', t: 'New event', allDay: true });
    refresh();
    if (!e.id) return;
    markFresh('event', e.id, () => { deleteEvent(e); refresh(); });
    openOfficeEdit('event', e.id, e.d);
    openPanel('item');
  };

  /* Tap: events and tasks open read-only in Eumae's office; goals and
     projects go to their page. */
  const openItem = (it: Item) => {
    if (it.link) {
      go(it.link.page, it.link.arg);
      return;
    }
    if (it.kind === 'task' && it.task) {
      setFocus({ k: 'task', id: it.task.id });
      openPanel('item');
      return;
    }
    if (it.ev?.id) {
      setFocus({ k: 'event', id: it.ev.id, day: it.day });
      openPanel('item');
    }
  };
  const checkTask = (t: Task) => {
    toggleTask(t.id);
    refresh();
    notify(t.d ? 'Task reopened.' : 'Task done.', { undo: () => { toggleTask(t.id); refresh(); } });
  };

  return (
    <div className="calPage qaPage">
      <QuickAdd
        kind="event"
        placeholder="New event"
        hint="Type it how you'd say it: “Dentist Tue 3pm at Main St”"
        onAdd={(q) => {
          const e = saveEvent(quickToEvent(q, day));
          setDay(e.d);
          refresh();
          notify(`Added ${e.t} · ${new Date(e.d + 'T12:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}${e.tm ? ' ' + fmtTime(e.tm) : ''}`);
        }}
        /* More: make it, then edit it inline in Eumae's office (his ok, Oct 24). */
        onMore={(q) => {
          const e = saveEvent(quickToEvent(q.title.trim() ? q : { ...q, title: 'New event' }, day));
          setDay(e.d);
          refresh();
          if (e.id) markFresh('event', e.id, () => { deleteEvent(e); refresh(); });
          if (e.id) { openOfficeEdit('event', e.id, e.d); openPanel('item'); }
        }}
      />

      <div className="calBar">
        <div className="calNav">
          <button className="hb" aria-label="Previous" onClick={() => step(-1)}>
            ‹
          </button>
          <button className="hb" aria-label="Next" onClick={() => step(1)}>
            ›
          </button>
          <button
            className="fb"
            onClick={() => {
              setDay(today);
              setWk(today);
            }}
            disabled={day === today && wk === today}
          >
            Today
          </button>
          <b className="calLabel">{label}</b>
        </div>
        <div className="calSeg" role="tablist">
          {(['today', 'week', 'month'] as CalView[]).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              className={view === v ? 'on' : ''}
              onClick={() => {
                if (v === 'today') setDay(today);
                setView(v);
              }}
            >
              {v === 'today' ? 'Day' : v === 'week' ? 'Week' : 'Month'}
            </button>
          ))}
        </div>
      </div>

      {view === 'month' ? (
        <>
          <MonthGrid
            day={day}
            today={today}
            tasks={tasks}
            desktop={desktop}
            compact={desktop && panelOpen}
            onDay={(d) => {
              setDay(d);
              /* Desktop: the day opens in Eumae's office, where you'll see it. */
              if (desktop) {
                setFocus({ k: 'day', id: d });
                openPanel('item');
              }
            }}
            onOpen={(d) => setDay(d)}
          />
          <DaySection day={day} today={today} items={itemsOn(day, tasks)} onItem={openItem} onCheck={checkTask} onAdd={() => openNew(day)} />
        </>
      ) : view === 'today' ? (
        <div className="agList">
          <DaySection day={day} today={today} items={itemsOn(day, tasks)} onItem={openItem} onCheck={checkTask} onAdd={() => openNew(day)} />
        </div>
      ) : (
        <>
          <WeekRow
            days={Array.from({ length: 7 }, (_, i) => shift(wk, i))}
            day={day}
            today={today}
            tasks={tasks}
            onPick={(d) => {
              setDay(d);
              document.getElementById('ag-' + d)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          />
          <div className="agList">
            {Array.from({ length: 7 }, (_, i) => shift(wk, i)).map((d) => (
              <DaySection key={d} day={d} today={today} items={itemsOn(d, tasks)} onItem={openItem} onCheck={checkTask} onAdd={() => openNew(d)} />
            ))}
          </div>
        </>
      )}
      <div className="xs m calFoot">
        All events in one list:{' '}
        <button className="lnkBtn" onClick={() => go('events')}>
          Upcoming
        </button>
      </div>
    </div>
  );
}

function MonthGrid({
  day,
  today,
  tasks,
  desktop,
  compact,
  onDay,
  onOpen,
}: {
  day: string;
  today: string;
  tasks: Task[];
  desktop: boolean;
  /** Office open on desktop: small square cells with dots, so the grid
   *  shrinks instead of getting crushed. */
  compact?: boolean;
  onDay: (d: string) => void;
  onOpen: (d: string) => void;
}) {
  const [y, m] = day.split('-').map(Number);
  const first = new Date(y, m - 1, 1, 12);
  const start = shift(ymd(first), -first.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => shift(start, i));
  const rows = cells[35].slice(5, 7) === String(m).padStart(2, '0') ? 6 : 5;
  return (
    <div className={'card mGrid' + (compact ? ' compact' : '')}>
      {DOW.map((d) => (
        <div key={d} className="mDow">
          {desktop && !compact ? d : d[0]}
        </div>
      ))}
      {cells.slice(0, rows * 7).map((d) => {
        const its = itemsOn(d, tasks);
        const out = +d.slice(5, 7) !== m;
        return (
          <button
            key={d}
            className={'mCell' + (out ? ' out' : '') + (d === day ? ' sel' : '') + (d === today ? ' today' : '')}
            onClick={() => (d === day ? onOpen(d) : onDay(d))}
            aria-label={`${d}, ${its.length} items`}
          >
            <span className="mNum">{+d.slice(8)}</span>
            {desktop && !compact ? (
              <span className="mItems">
                {its.slice(0, 3).map((it) => (
                  <span key={it.key} className={'mItem c-' + it.color + (it.done ? ' done' : '')}>
                    <i />
                    {it.start !== undefined ? <em>{fmtTime(minsToTm(it.start)).replace(' ', '').toLowerCase()}</em> : null}
                    {it.title}
                  </span>
                ))}
                {its.length > 3 ? <span className="xs m">+{its.length - 3} more</span> : null}
              </span>
            ) : (
              <span className="mDots">
                {its.slice(0, 3).map((it) => (
                  <i key={it.key} className={'c-' + it.color} />
                ))}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function minsToTm(n: number): string {
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
}

/* One day of the agenda: a header (Today · Mon, Oct 19), then flat rows
   with the time on the left. An empty day says so in one quiet line. */
/* The week strip (his screenshot): day, date and how many things, the
   picked day lit. Tap a day to jump to it in the list. */
function WeekRow({ days, day, today, tasks, onPick }: { days: string[]; day: string; today: string; tasks: Task[]; onPick: (d: string) => void }) {
  return (
    <div className="calWeek" role="tablist">
      {days.map((d) => {
        const n = itemsOn(d, tasks).filter((i) => !i.done).length;
        const dt = new Date(d + 'T12:00');
        return (
          <button key={d} role="tab" aria-selected={d === day} className={(d === day ? 'on' : '') + (d === today ? ' today' : '')} onClick={() => onPick(d)}>
            <span>{DOW[dt.getDay()]}</span>
            <b>{dt.getDate()}</b>
            <i>{n}</i>
          </button>
        );
      })}
    </div>
  );
}

/* One day by the hour (his screenshot): Anytime first, then hour lines
   8 AM to 10 PM (wider when something sits outside), a Now line today.
   Tap an empty hour to add an event there. */
export function HourDay({ day, today, items, onItem, onCheck, onAdd }: {
  day: string; today: string; items: Item[]; onItem: (i: Item) => void; onCheck: (t: Task) => void; onAdd: (minute?: number) => void;
}) {
  const dt = new Date(day + 'T12:00');
  const word = day === today ? 'Today' : day === shift(today, 1) ? 'Tomorrow' : '';
  const now = new Date();
  const nowM = now.getHours() * 60 + now.getMinutes();
  const anytime = items.filter((i) => i.start === undefined);
  const timed = items.filter((i) => i.start !== undefined);
  let first = 8;
  let last = 22;
  timed.forEach((i) => {
    first = Math.min(first, Math.floor(i.start! / 60));
    last = Math.max(last, Math.floor(i.start! / 60));
  });
  if (day === today) {
    first = Math.min(first, now.getHours());
    last = Math.max(last, now.getHours());
  }
  const kindOf = (it: Item) =>
    it.kind === 'event' && it.ev ? evKind(it.ev) : it.kind === 'task' ? 'Task' : it.kind[0].toUpperCase() + it.kind.slice(1);
  const row = (it: Item) => {
    const aw = it.kind === 'event' ? attendWord(it.ev, day) : null;
    const past = aw ? !aw.ask : day < today || (day === today && (it.end ?? it.start ?? 1440) < nowM);
    return (
      <div key={it.key} className={'frow agRow2 hdItem tapRow c-' + it.color + (it.done || past ? ' past' : '')} onClick={rowTap(() => onItem(it))}>
        {it.kind === 'task' && it.task ? (
          <button className={'fchk' + (it.done ? ' on' : '')} aria-label={it.done ? `Reopen ${it.title}` : `Done: ${it.title}`} onClick={() => onCheck(it.task!)} />
        ) : (
          <i className="agBar" />
        )}
        <div className="ft">
          <button className="tlT" onClick={() => onItem(it)}>
            <span className={it.done ? 'tlDone' : ''}>{it.title}</span>
          </button>
          {it.ev?.loc || it.ev?.rep ? <div className="fsub">{[it.ev?.loc, it.ev?.rep ? '↻ repeats' : ''].filter(Boolean).join(' · ')}</div> : null}
        </div>
        <span className="fmeta">
          {it.start !== undefined ? fmtTime(minsToTm(it.start)) + (it.end !== undefined && it.kind === 'event' ? ' – ' + fmtTime(minsToTm(it.end)) : '') + ' · ' : ''}
          {aw ? <span className={aw.ask ? 'ask' : ''}>{aw.text}</span> : kindOf(it)}
        </span>
      </div>
    );
  };
  const hours = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`;
  return (
    <section className="hdDay">
      <div className="sdiv agH">
        <span>
          {dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          {word ? <b> · {word}</b> : null}
        </span>
        <button className="fact agAdd" onClick={() => onAdd()} aria-label={`Add an event on ${dt.toDateString()}`}>
          +
        </button>
      </div>
      {anytime.length ? (
        <>
          <div className="flbl hdLbl">Anytime</div>
          <div className="hdAny">{anytime.map(row)}</div>
        </>
      ) : null}
      <div className="hdHours">
        {hours.map((h) => {
          const here = timed.filter((i) => Math.floor(i.start! / 60) === h);
          const showNow = day === today && now.getHours() === h;
          return (
            <div key={h} className="hdHour">
              <button className="hdH" onClick={() => onAdd(h * 60)} aria-label={`Add at ${hourLabel(h)}`}>
                {hourLabel(h)}
              </button>
              <div className="hdBody">
                {showNow ? (
                  <div className="hdNow">Now {now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div>
                ) : null}
                {here.map(row)}
                {!here.length && !showNow ? <button className="hdEmpty" onClick={() => onAdd(h * 60)} aria-label={`Add at ${hourLabel(h)}`} /> : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DaySection({ day, today, items, onItem, onCheck, onAdd }: {
  day: string; today: string; items: Item[]; onItem: (i: Item) => void; onCheck: (t: Task) => void; onAdd: () => void;
}) {
  const dt = new Date(day + 'T12:00');
  const word = day === today ? 'Today' : day === shift(today, 1) ? 'Tomorrow' : day < today ? 'Past' : '';
  const nowM = new Date().getHours() * 60 + new Date().getMinutes();
  return (
    <section id={'ag-' + day} className={'agDay' + (day === today ? ' today' : '')}>
      <div className="sdiv agH">
        <span>
          {word ? <b>{word} · </b> : null}
          {dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
        </span>
        <button className="fact agAdd" onClick={onAdd} aria-label={`Add an event on ${dt.toDateString()}`}>
          +
        </button>
      </div>
      {items.length ? (
        items.map((it) => {
          const aw = it.kind === 'event' ? attendWord(it.ev, day) : null;
          const past = aw ? !aw.ask : day < today || (day === today && it.end !== undefined && it.end < nowM);
          return (
            <div key={it.key} className={'frow top agRow2 tapRow c-' + it.color + (it.done || past ? ' past' : '')} onClick={rowTap(() => onItem(it))}>
              <span className="agT fmeta">
                {it.start === undefined ? 'All day' : fmtTime(minsToTm(it.start))}
                {it.end !== undefined && it.kind === 'event' ? <span className="agEnd">{fmtTime(minsToTm(it.end))}</span> : null}
              </span>
              {it.kind === 'task' && it.task ? (
                <button className={'fchk' + (it.done ? ' on' : '')} aria-label={it.done ? `Reopen ${it.title}` : `Done: ${it.title}`} onClick={() => onCheck(it.task!)} />
              ) : (
                <i className="agBar" />
              )}
              <div className="ft">
                <button className="tlT" onClick={() => onItem(it)}>
                  <span className={it.done ? 'tlDone' : ''}>{it.title}</span>
                </button>
                {it.ev?.loc || it.ev?.rep ? (
                  <div className="fsub">
                    {[it.ev?.loc, it.ev?.rep ? '↻ repeats' : ''].filter(Boolean).join(' · ')}
                  </div>
                ) : null}
              </div>
              <span className={'fmeta' + (aw?.ask ? ' ask' : '')}>{aw ? aw.text : it.kind === 'event' && it.ev ? evKind(it.ev) : it.kind === 'task' ? 'Task' : it.kind === 'milestone' ? (it.key.startsWith('pm') ? 'Phase' : 'Milestone') : it.kind === 'goal' ? 'Goal' : 'Project'}</span>
            </div>
          );
        })
      ) : (
        <p className="fsub agFree">Free</p>
      )}
    </section>
  );
}
