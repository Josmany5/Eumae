/* Calendar full page — wove's AdvancedCalendar, rebuilt on Eumae tokens.
 *
 * Month / Week / Day. Week and Day are an hour grid; Month is a grid you
 * read with the selected day's agenda under it. The calendar shows events
 * AND tasks that have a due date (timed tasks sit in the grid, untimed ones
 * in the all-day row), each with a dot in its kind's color.
 *
 * Adding: the quick-add line on top ("Dentist Tue 3pm at Main St"), or tap
 * an empty hour to add right there. Tap an event to edit it; tap a task to
 * check it off. Events (the list) lives on its own page and reads the same
 * store, so the two always agree.
 */

import { useMemo, useState } from 'react';
import { useNav } from '../nav';
import { dayEvents, getEvent, saveEvent, deleteEvent, ymd, mins, type CalEvent } from '../events';
import { getTasks, toggleTask, type Task } from '../tasks';
import { QuickAdd, EventForm, EventDetail, quickToEvent } from '../components/QuickAdd';
import { fmtTime } from '../quickadd';
import { useMedia } from '../useMedia';
import type { PageProps } from './index';

type CalView = 'day' | 'week' | 'month';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOUR_PX = 48;

function todayStr(): string {
  return ymd(new Date());
}
function shift(day: string, n: number): string {
  const d = new Date(day + 'T12:00');
  d.setDate(d.getDate() + n);
  return ymd(d);
}
function weekOf(day: string): string[] {
  const dow = new Date(day + 'T12:00').getDay();
  return Array.from({ length: 7 }, (_, i) => shift(day, i - dow));
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
  kind: 'event' | 'task';
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
  return [...evs, ...ts].sort((a, b) => (a.start ?? -1) - (b.start ?? -1));
}

export default function CalendarPage(_props: PageProps) {
  void _props;
  const { notify, go } = useNav();
  const desktop = useMedia('(min-width:900px)');
  const [view, setView] = useState<CalView>(() => (window.matchMedia('(min-width:900px)').matches ? 'week' : 'month'));
  const [day, setDay] = useState(() => todayStr());
  const [tick, setTick] = useState(0);
  const [form, setForm] = useState<{ ev: CalEvent; editing: boolean } | null>(null);
  const [view1, setView1] = useState<{ ev: CalEvent; day: string } | null>(null);
  const [taskView, setTaskView] = useState<Task | null>(null);
  const refresh = () => setTick((t) => t + 1);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tasks = useMemo(() => getTasks(), [tick]);
  const today = todayStr();

  const step = (n: number) => {
    if (view === 'day') setDay(shift(day, n));
    else if (view === 'week') setDay(shift(day, 7 * n));
    else setDay(monthShift(day, n));
  };

  const label =
    view === 'month'
      ? new Date(day + 'T12:00').toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      : view === 'week'
        ? (() => {
            const w = weekOf(day);
            const a = new Date(w[0] + 'T12:00');
            const b = new Date(w[6] + 'T12:00');
            const sameMonth = a.getMonth() === b.getMonth();
            return (
              a.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
              ' – ' +
              b.toLocaleDateString(undefined, sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' }) +
              ', ' +
              b.getFullYear()
            );
          })()
        : new Date(day + 'T12:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

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

  const openItem = (it: Item) => {
    if (it.kind === 'task' && it.task) {
      setForm(null);
      setView1(null);
      setTaskView(it.task);
      return;
    }
    if (it.ev) {
      /* Edit the series, not the occurrence: repeats are one row. */
      const src = (it.ev.id && getEvent(it.ev.id)) || it.ev;
      setForm(null);
      setView1({ ev: src, day: it.day });
    }
  };

  const days = view === 'week' ? weekOf(day) : [day];

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

      {taskView ? (
        <div className="card evDetail c-task">
          <div className="evDHead">
            <i />
            <b>{taskView.t}</b>
            <button className="evDX" aria-label="Close" onClick={() => setTaskView(null)}>
              ×
            </button>
          </div>
          <div className="evDRow">
            {taskView.due
              ? new Date(taskView.due + 'T12:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
              : ''}
            {taskView.tm ? ' · ' + fmtTime(taskView.tm) : ''}
            {taskView.est ? ' · ' + taskView.est + ' min' : ''}
          </div>
          <div className="evDRow m">Task{taskView.pr && taskView.pr !== 'none' ? ' · ' + taskView.pr : ''}</div>
          <div className="btns">
            <button
              className="fb"
              onClick={() => {
                toggleTask(taskView.id);
                notify(taskView.d ? 'Task reopened.' : 'Task done.');
                setTaskView(null);
                refresh();
              }}
            >
              {taskView.d ? 'Reopen' : 'Mark done'}
            </button>
            <button className="fb" onClick={() => go('tasks')}>
              Open Tasks
            </button>
          </div>
        </div>
      ) : null}
      {view1 && !form ? (
        <EventDetail
          ev={view1.ev}
          day={view1.day}
          onClose={() => setView1(null)}
          onEdit={() => {
            setForm({ ev: view1.ev, editing: true });
            setView1(null);
          }}
          onDelete={() => {
            deleteEvent(view1.ev);
            setView1(null);
            refresh();
            notify(view1.ev.rep ? 'Event and its repeats deleted.' : 'Event deleted.');
          }}
        />
      ) : null}
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
                  deleteEvent(form.ev);
                  setForm(null);
                  refresh();
                  notify(form.ev.rep ? 'Event and its repeats deleted.' : 'Event deleted.');
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
          {(['day', 'week', 'month'] as CalView[]).map((v) => (
            <button key={v} role="tab" aria-selected={view === v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>
              {v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {view === 'month' ? (
        <>
          <MonthGrid day={day} today={today} tasks={tasks} desktop={desktop} onDay={setDay} onOpen={(d) => { setDay(d); setView('day'); }} />
          <Agenda day={day} items={itemsOn(day, tasks)} onItem={openItem} onAdd={() => openNew(day)} />
        </>
      ) : (
        <>
          {view === 'day' ? (
            <div className="wkstrip">
              {weekOf(day).map((d) => (
                <button key={d} className={(d === day ? 'sel' : '') + (d === today ? ' today' : '')} onClick={() => setDay(d)}>
                  <span className="xs">{DOW[new Date(d + 'T12:00').getDay()]}</span>
                  <br />
                  {+d.slice(8)}
                </button>
              ))}
            </div>
          ) : null}
          <HourGrid
            days={days}
            today={today}
            tasks={tasks}
            showHead={view === 'week'}
            onPickDay={(d) => {
              setDay(d);
              setView('day');
            }}
            onSlot={openNew}
            onItem={openItem}
          />
        </>
      )}
      <div className="xs m calFoot">
        Tap an empty hour to add there. Events list:{' '}
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

function Agenda({ day, items, onItem, onAdd }: { day: string; items: Item[]; onItem: (i: Item) => void; onAdd: () => void }) {
  return (
    <>
      <div className="row" style={{ marginTop: 16 }}>
        <h3 className="sec" style={{ margin: 0 }}>
          {new Date(day + 'T12:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </h3>
        <span style={{ flex: 1 }} />
        <button className="fb" onClick={onAdd}>
          + Event
        </button>
      </div>
      <div className="card cardPad">
        {items.length ? (
          items.map((it) => (
            <button key={it.key} className={'agRow c-' + it.color + (it.done ? ' done' : '')} onClick={() => onItem(it)}>
              <span className="agTm">
                {it.start === undefined ? 'All day' : fmtTime(minsToTm(it.start))}
                {it.end !== undefined && it.kind === 'event' ? <span className="xs m"> – {fmtTime(minsToTm(it.end))}</span> : null}
              </span>
              <i />
              <span className="g">
                {it.kind === 'task' ? (it.done ? '✓ ' : '○ ') : ''}
                {it.title}
                {it.ev?.loc ? <span className="xs m"> · {it.ev.loc}</span> : null}
              </span>
            </button>
          ))
        ) : (
          <div className="s m">Nothing this day. Add one with the line on top, or tap + Event.</div>
        )}
      </div>
    </>
  );
}

function HourGrid({
  days,
  today,
  tasks,
  showHead,
  onPickDay,
  onSlot,
  onItem,
}: {
  days: string[];
  today: string;
  tasks: Task[];
  showHead: boolean;
  onPickDay: (d: string) => void;
  onSlot: (d: string, minute?: number) => void;
  onItem: (i: Item) => void;
}) {
  const perDay = days.map((d) => itemsOn(d, tasks));
  const timed = perDay.flat().filter((i) => i.start !== undefined);
  /* The day runs 5 AM to midnight; anything earlier pulls the grid up. */
  const first = Math.min(5, ...timed.map((i) => Math.floor(i.start! / 60)));
  const last = 24;
  const hours = Array.from({ length: Math.min(24, last) - first }, (_, i) => first + i);
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const cols = { gridTemplateColumns: `44px repeat(${days.length}, minmax(0,1fr))` };

  return (
    <div className="card hGrid">
      {showHead ? (
        <div className="hHead" style={cols}>
          <span />
          {days.map((d) => (
            <button key={d} className={'hDay' + (d === today ? ' today' : '')} onClick={() => onPickDay(d)}>
              <span className="xs m">{DOW[new Date(d + 'T12:00').getDay()]}</span>
              <b>{+d.slice(8)}</b>
            </button>
          ))}
        </div>
      ) : null}
      <div className="hAll" style={cols}>
        <span className="xs m hLbl">all day</span>
        {days.map((d, di) => (
          <div key={d} className="hAllCell" onClick={(e) => e.target === e.currentTarget && onSlot(d)}>
            {perDay[di]
              .filter((i) => i.start === undefined)
              .map((it) => (
                <button key={it.key} className={'hChip c-' + it.color + (it.done ? ' done' : '')} onClick={() => onItem(it)}>
                  {it.kind === 'task' ? (it.done ? '✓ ' : '○ ') : ''}
                  {it.title}
                </button>
              ))}
          </div>
        ))}
      </div>
      <div className="hBody" style={{ ...cols, height: hours.length * HOUR_PX }}>
        <div className="hLbls">
          {hours.map((h) => (
            <span key={h} className="xs m" style={{ top: (h - first) * HOUR_PX }}>
              {h === 12 ? '12 PM' : h > 12 ? `${h - 12} PM` : `${h} AM`}
            </span>
          ))}
        </div>
        {days.map((d, di) => (
          <div
            key={d}
            className="hCol"
            onClick={(e) => {
              if (e.target !== e.currentTarget) return;
              const y = e.nativeEvent.offsetY;
              const minute = first * 60 + Math.floor(y / HOUR_PX) * 60 + (y % HOUR_PX >= HOUR_PX / 2 ? 30 : 0);
              onSlot(d, minute);
            }}
          >
            {hours.map((h) => (
              <div key={h} className="hLine" style={{ top: (h - first) * HOUR_PX }} />
            ))}
            {d === today && nowMin / 60 >= first && nowMin / 60 < first + hours.length ? (
              <div className="hNow" style={{ top: ((nowMin - first * 60) / 60) * HOUR_PX }} />
            ) : null}
            {layout(perDay[di].filter((i) => i.start !== undefined)).map(({ it, col, ncol }) => {
              const top = ((it.start! - first * 60) / 60) * HOUR_PX;
              const h = Math.max(20, (((it.end ?? it.start! + 60) - it.start!) / 60) * HOUR_PX - 2);
              return (
                <button
                  key={it.key}
                  className={'hEv c-' + it.color + (it.done ? ' done' : '')}
                  style={{ top, height: h, left: `calc(${(col / ncol) * 100}% + 2px)`, width: `calc(${100 / ncol}% - 4px)` }}
                  onClick={() => onItem(it)}
                  title={it.title}
                >
                  <b>
                    {it.kind === 'task' ? (it.done ? '✓ ' : '○ ') : ''}
                    {it.title}
                  </b>
                  {h > 34 ? (
                    <span>
                      {fmtTime(minsToTm(it.start!))}
                      {it.ev?.loc ? ' · ' + it.ev.loc : ''}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/* Side-by-side columns for overlapping items. */
function layout(items: Item[]): { it: Item; col: number; ncol: number }[] {
  const sorted = [...items].sort((a, b) => a.start! - b.start!);
  const out: { it: Item; col: number; ncol: number }[] = [];
  let group: { it: Item; col: number; ncol: number }[] = [];
  let groupEnd = -1;
  const flush = () => {
    const n = Math.max(1, ...group.map((g) => g.col + 1));
    group.forEach((g) => (g.ncol = n));
    out.push(...group);
    group = [];
  };
  for (const it of sorted) {
    const end = it.end ?? it.start! + 60;
    if (it.start! >= groupEnd) {
      flush();
      groupEnd = -1;
    }
    const used = group.filter((g) => (g.it.end ?? g.it.start! + 60) > it.start!).map((g) => g.col);
    let col = 0;
    while (used.includes(col)) col++;
    group.push({ it, col, ncol: 1 });
    groupEnd = Math.max(groupEnd, end);
  }
  flush();
  return out;
}
