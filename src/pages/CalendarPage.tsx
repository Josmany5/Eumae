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

import { useEffect, useMemo, useState } from 'react';
import { useNav } from '../nav';
import { dayEvents, getEvent, saveEvent, ymd, mins, type CalEvent } from '../events';
import { getTasks, toggleTask, type Task } from '../tasks';
import { QuickAdd, EventForm, quickToEvent, removeEvent } from '../components/QuickAdd';
import { setFocus, onEditEvent } from '../focus';
import { fmtTime } from '../quickadd';
import { useMedia } from '../useMedia';
import { getGoals } from '../goals';
import { getProjects } from '../projects';
import type { PageProps } from './index';

type CalView = 'agenda' | 'month';

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
interface Item {
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

function itemsOn(day: string, tasks: Task[]): Item[] {
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

export default function CalendarPage({ arg }: PageProps) {
  const { notify, go, openPanel } = useNav();
  const desktop = useMedia('(min-width:900px)');
  const [view, setView] = useState<CalView>('agenda');
  const [day, setDay] = useState(() => todayStr());
  const [tick, setTick] = useState(0);
  /* Opened with an event id (Edit from Mae's office): land on its form. */
  const [form, setForm] = useState<{ ev: CalEvent; editing: boolean } | null>(() => {
    const e = typeof arg === 'string' ? getEvent(arg) : undefined;
    return e ? { ev: e, editing: true } : null;
  });
  const refresh = () => setTick((t) => t + 1);
  useEffect(
    () =>
      onEditEvent((id) => {
        const e = getEvent(id);
        if (e) setForm({ ev: e, editing: true });
      }),
    [],
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tasks = useMemo(() => getTasks(), [tick]);
  const today = todayStr();

  const step = (n: number) => {
    if (view === 'agenda') setDay(shift(day, 7 * n));
    else setDay(monthShift(day, n));
  };

  const label =
    view === 'month'
      ? new Date(day + 'T12:00').toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      : (() => {
          const a = new Date(day + 'T12:00');
          const b = new Date(shift(day, 6) + 'T12:00');
          const sameMonth = a.getMonth() === b.getMonth();
          return (
            a.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
            ' – ' +
            b.toLocaleDateString(undefined, sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' })
          );
        })();

  const openNew = (d: string, minute?: number) => {
    const tm = minute === undefined ? '' : `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
    const endM = minute === undefined ? undefined : minute + 60;
    setForm({
      ev: {
        d,
        tm,
        t: '',
        allDay: minute === undefined ? true : undefined,
        end: endM === undefined ? undefined : `${String(Math.floor(endM / 60) % 24).padStart(2, '0')}:${String(endM % 60).padStart(2, '0')}`,
      },
      editing: false,
    });
  };

  /* Tap: events and tasks open read-only in Mae's office; goals and
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
        onMore={(q) => setForm({ ev: quickToEvent(q, day), editing: false })}
      />

      {form ? (
        <EventForm
          initial={form.ev}
          onCancel={() => setForm(null)}
          onSave={(e) => {
            const saved = saveEvent(e);
            setForm(null);
            setDay(saved.d);
            refresh();
            notify(form.editing ? 'Event updated.' : 'Event added.');
          }}
          onDelete={
            form.editing
              ? () => {
                  setForm(null);
                  removeEvent(notify, form.ev, undefined, 'all', refresh);
                }
              : undefined
          }
        />
      ) : null}

      <div className="calBar">
        <div className="calNav">
          <button className="hb" aria-label="Previous" onClick={() => step(-1)}>
            ‹
          </button>
          <button className="hb" aria-label="Next" onClick={() => step(1)}>
            ›
          </button>
          <button className="fb" onClick={() => setDay(today)} disabled={day === today}>
            Today
          </button>
          <b className="calLabel">{label}</b>
        </div>
        <div className="calSeg" role="tablist">
          {(['agenda', 'month'] as CalView[]).map((v) => (
            <button key={v} role="tab" aria-selected={view === v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>
              {v === 'agenda' ? 'Agenda' : 'Month'}
            </button>
          ))}
        </div>
      </div>

      {view === 'month' ? (
        <>
          <MonthGrid day={day} today={today} tasks={tasks} desktop={desktop} onDay={setDay} onOpen={(d) => setDay(d)} />
          <DaySection day={day} today={today} items={itemsOn(day, tasks)} onItem={openItem} onCheck={checkTask} onAdd={() => openNew(day)} />
        </>
      ) : (
        <div className="agList">
          {Array.from({ length: 7 }, (_, i) => shift(day, i)).map((d) => (
            <DaySection key={d} day={d} today={today} items={itemsOn(d, tasks)} onItem={openItem} onCheck={checkTask} onAdd={() => openNew(d)} />
          ))}
        </div>
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
  onDay,
  onOpen,
}: {
  day: string;
  today: string;
  tasks: Task[];
  desktop: boolean;
  onDay: (d: string) => void;
  onOpen: (d: string) => void;
}) {
  const [y, m] = day.split('-').map(Number);
  const first = new Date(y, m - 1, 1, 12);
  const start = shift(ymd(first), -first.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => shift(start, i));
  const rows = cells[35].slice(5, 7) === String(m).padStart(2, '0') ? 6 : 5;
  return (
    <div className="card mGrid">
      {DOW.map((d) => (
        <div key={d} className="mDow">
          {desktop ? d : d[0]}
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
            {desktop ? (
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

function minsToTm(n: number): string {
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
}

/* One day of the agenda: a header (Today · Mon, Oct 19), then flat rows
   with the time on the left. An empty day says so in one quiet line. */
function DaySection({ day, today, items, onItem, onCheck, onAdd }: {
  day: string; today: string; items: Item[]; onItem: (i: Item) => void; onCheck: (t: Task) => void; onAdd: () => void;
}) {
  const dt = new Date(day + 'T12:00');
  const word = day === today ? 'Today' : day === shift(today, 1) ? 'Tomorrow' : day < today ? 'Past' : '';
  const nowM = new Date().getHours() * 60 + new Date().getMinutes();
  return (
    <section className={'agDay' + (day === today ? ' today' : '')}>
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
          const past = day < today || (day === today && it.end !== undefined && it.end < nowM);
          return (
            <div key={it.key} className={'frow top agRow2 c-' + it.color + (it.done || past ? ' past' : '')}>
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
              <span className="fmeta">{it.kind === 'event' ? '' : it.kind === 'task' ? 'Task' : it.kind === 'milestone' ? 'Milestone' : it.kind === 'goal' ? 'Goal' : 'Project'}</span>
            </div>
          );
        })
      ) : (
        <p className="fsub agFree">Free</p>
      )}
    </section>
  );
}
