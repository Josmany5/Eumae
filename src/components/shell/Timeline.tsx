import { rowTap } from '../../rowTap';
import { useEffect, useState } from 'react';
import { useNav } from '../../nav';
import { getTasks, getLists, toggleTask, saveTask, type Task } from '../../tasks';
import { dayEvents, ymd, mins, importanceOf, type CalEvent } from '../../events';
import { isOverdue, toConfirm } from '../../due';
import { AttendAsk } from './Attend';
import { fmtTime } from '../../quickadd';
import { setFocus, onDataChange, askMae } from '../../focus';
import { TYPE_LABEL } from '../QuickAdd';

/* Console › Timeline widget (Oct 18, his call: Today = Option A as a widget,
 * one column, still draggable). Next line, one add line, then the day's spine:
 * Overdue, Needs attention (Done / Move), Earlier folded to one line, Now,
 * later today, Anytime, Tomorrow. Reads the same task + event stores as the
 * full pages, so a check here is a check everywhere. */

type Item =
  | { kind: 'task'; key: string; t: string; tm?: string; task: Task }
  | { kind: 'event'; key: string; t: string; tm?: string; ev: CalEvent };

const URGENT = new Set(['urgent', 'critical']);

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function itemsFor(day: string, tasks: Task[]): Item[] {
  const evs: Item[] = dayEvents(day).map((e, i) => ({
    kind: 'event',
    key: 'e' + (e.id ?? i) + day,
    t: e.t,
    tm: e.allDay ? undefined : e.tm || undefined,
    ev: e,
  }));
  const ts: Item[] = tasks
    .filter((t) => t.due === day)
    .map((t) => ({ kind: 'task', key: 't' + t.id, t: t.t, tm: t.tm, task: t }));
  return [...evs, ...ts];
}

const byTime = (a: Item, b: Item) => mins(a.tm) - mins(b.tm);

function fmtDue(d: string): string {
  return new Date(d + 'T12:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function Timeline({ editing, onChange }: { editing: boolean; onChange: () => void }) {
  const { go, notify, openPanel } = useNav();
  const [, setTick] = useState(0);
  const [showEarlier, setShowEarlier] = useState(false);
  /* Move opens a day + time picker on that row (his call: no silent "tomorrow"). */
  const [moving, setMoving] = useState<{ id: string; due: string; tm: string } | null>(null);
  /* An event just marked Not attended stays on the spine while it offers
     "Reschedule?", even though it no longer needs an answer. */
  const [held, setHeld] = useState<{ ev: CalEvent; day: string }[]>([]);
  const refresh = () => {
    setTick((n) => n + 1);
    onChange();
  };
  useEffect(() => onDataChange(() => setTick((n) => n + 1)), []);

  const now = new Date();
  const today = ymd(now);
  const tomorrow = ymd(addDays(now, 1));
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const all = getTasks();
  const open = all.filter((t) => !t.d);
  /* Overdue by the clock, not the calendar (Oct 21): an 11 AM task is late at 11:01. */
  const overdue = open.filter((t) => isOverdue(t, now));
  const lateIds = new Set(overdue.map((t) => t.id));
  /* Ended events wait for "Did you attend?" — never assumed (his call, Oct 21). */
  const asks = [...held, ...toConfirm(now).filter((a) => !held.some((h) => h.ev.id === a.ev.id && h.day === a.day))];
  const askIds = new Set(asks.filter((a) => a.day === today).map((a) => a.ev.id));
  const todayItems = itemsFor(today, all).filter(
    (i) => !(i.kind === 'task' && lateIds.has(i.task.id)) && !(i.kind === 'event' && askIds.has(i.ev.id)),
  );
  const attention = todayItems.filter((i) => i.kind === 'task' && !i.task.d && !i.tm && URGENT.has(i.task.pr ?? ''));
  const timed = todayItems.filter((i) => i.tm && !attention.includes(i)).sort(byTime);
  const earlier = timed.filter((i) => mins(i.tm) < nowMin);
  const later = timed.filter((i) => mins(i.tm) >= nowMin);
  const anytime = todayItems.filter((i) => !i.tm && !attention.includes(i));
  const tmrw = itemsFor(tomorrow, open).sort(byTime);
  const earlierDone = earlier.filter((i) => i.kind === 'event' || i.task.d).length;

  const next = later.find((i) => i.kind === 'event' || !i.task.d);
  const first = overdue[0];

  const done = (t: Task) => {
    toggleTask(t.id);
    if (!t.d) notify('Done.', { undo: () => { toggleTask(t.id); refresh(); } });
    refresh();
  };

  const move = (t: Task, due: string, tm: string) => {
    const before = { ...t };
    saveTask({ ...t, due, tm: tm || undefined });
    setMoving(null);
    const when = new Date(due + 'T12:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    notify(`Moved to ${when}${tm ? ' at ' + fmtTime(tm) : ''}.`, { undo: () => { saveTask(before); refresh(); } });
    refresh();
  };

  const tap = (i: Item) => {
    if (editing) return;
    if (i.kind === 'task') {
      setFocus({ k: 'task', id: i.task.id });
      openPanel('item');
    } else if (i.ev.id) {
      setFocus({ k: 'event', id: i.ev.id, day: ymd(new Date()) });
      openPanel('item');
    } else go('cal');
  };

  /* Spine row (his screenshot, Oct 19): a dot on the line (tap a task's dot
     to mark it done), the title, and on the right the list chip and the time. */
  const listName = (id?: string) => (id && id !== 'inbox' ? getLists().find((l) => l.id === id)?.n : undefined);
  const row = (i: Item, opts: { over?: boolean; past?: boolean; actions?: boolean } = {}) => {
    const isDone = i.kind === 'task' && !!i.task.d;
    const chip = i.kind === 'task' ? listName(i.task.list) : importanceOf(i.ev) === 'must' ? 'Must go' : undefined;
    const right = opts.over && i.kind === 'task'
      ? `Overdue · ${i.tm ? fmtTime(i.tm) : fmtDue(i.task.due!)}`
      : i.tm
        ? fmtTime(i.tm)
        : i.kind === 'event'
          ? 'All day'
          : i.task.est
            ? `${i.task.est} min`
            : '';
    return (
      <div key={i.key} className={`frow top tlRow tapRow${isDone || opts.past ? ' past' : ''}${isDone ? ' done' : ''}${i.kind === 'event' ? ' ev' : ''}`} onClick={rowTap(() => tap(i))}>
        {i.kind === 'task' ? (
          <button
            className="tlDot"
            aria-label={isDone ? `Mark ${i.t} not done` : `Mark ${i.t} done`}
            onClick={() => done(i.task)}
          />
        ) : null}
        <div className="ft">
          <button className="tlT" onClick={() => tap(i)}>
            <span className={isDone ? 'tlDone' : ''}>{i.t}</span>
          </button>
          {i.kind === 'event' && (i.ev.loc || i.ev.rep) ? (
            <div className="fsub">{[i.ev.loc, i.ev.rep ? '↻ repeats' : ''].filter(Boolean).join(' · ')}</div>
          ) : null}
          {opts.actions && i.kind === 'task' ? (
            moving && moving.id === i.task.id ? (
              <div className="tlMove">
                <label className="tlField">
                  <span>Day</span>
                <input
                  type="date"
                  className="sinput"
                  aria-label="New day"
                  value={moving.due}
                  min={today}
                  onChange={(e) => setMoving({ ...moving, due: e.target.value })}
                />
                </label>
                <label className="tlField">
                  <span>Time</span>
                <input
                  type="time"
                  className="sinput"
                  aria-label="New time (optional)"
                  value={moving.tm}
                  onChange={(e) => setMoving({ ...moving, tm: e.target.value })}
                />
                </label>
                <div className="tlActs">
                  <button className="pri" disabled={!moving.due} onClick={() => move(i.task, moving.due, moving.tm)}>
                    Save
                  </button>
                  <button onClick={() => setMoving(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="tlActs">
                <button className="pri" onClick={() => done(i.task)}>Done</button>
                <button onClick={() => setMoving({ id: i.task.id, due: today, tm: i.task.tm ?? '' })}>Move</button>
                <button
                  onClick={() => {
                    setFocus({ k: 'task', id: i.task.id });
                    askMae(
                      opts.over && i.task.due
                        ? `Help me with "${i.t}". It was due ${fmtDue(i.task.due)} and it's overdue. What should I do?`
                        : `Help me with "${i.t}". What should I do?`,
                    );
                    openPanel('mae');
                  }}
                >
                  Ask Mae
                </button>
              </div>
            )
          ) : null}
        </div>
        <span className="tlR">
          {chip ? <span className="tlChip">{chip}</span> : null}
          {right ? <span className={`fmeta${opts.over ? ' over' : ''}`}>{right}</span> : null}
        </span>
      </div>
    );
  };

  return (
    <div className="tl" onClick={(e) => e.stopPropagation()}>
      <p className="tlNext">
        {first ? (
          <>
            Next: <b>{first.t}</b> <span className="over">· overdue</span>
            {next ? <>, then {next.t} at {fmtTime(next.tm)}</> : null}
          </>
        ) : next ? (
          <>
            Next: <b>{next.t}</b> at {fmtTime(next.tm)}
          </>
        ) : (
          'Nothing else on the clock today.'
        )}
      </p>
      <div className="spine tlSpine">
        {earlier.length ? (
          <button className="sdiv tlFold" onClick={() => setShowEarlier((v) => !v)} aria-expanded={showEarlier}>
            Earlier · {earlierDone ? `${earlierDone} done` : `${earlier.length} item${earlier.length === 1 ? '' : 's'}`}
          </button>
        ) : null}
        {showEarlier ? earlier.map((i) => row(i, { past: true })) : null}
        {overdue.length || attention.length || asks.length ? <div className="sdiv att">Needs attention</div> : null}
        {overdue.map((t) => row({ kind: 'task', key: 'o' + t.id, t: t.t, tm: t.tm, task: t }, { over: true, actions: true }))}
        {attention.map((i) => row(i, { actions: true }))}
        {asks.map((a) => (
          <div key={'a' + a.ev.id + a.day} className="frow top tlRow ev">
            <div className="ft">
              <button
                className="tlT"
                onClick={() => {
                  if (editing) return;
                  setFocus({ k: 'event', id: a.ev.id!, day: a.day });
                  openPanel('item');
                }}
              >
                <span>{a.ev.t}</span>
              </button>
              <AttendAsk
                ev={a.ev}
                day={a.day}
                onChange={refresh}
                onMark={(v) => {
                  if (v === 'no') setHeld((h) => [...h.filter((x) => !(x.ev.id === a.ev.id && x.day === a.day)), a]);
                }}
                onSettled={() => setHeld((h) => h.filter((x) => !(x.ev.id === a.ev.id && x.day === a.day)))}
              />
            </div>
            <span className="tlR">
              <span className="fmeta">
                {a.day === today ? '' : fmtDue(a.day) + (a.ev.allDay || !a.ev.tm ? '' : ' · ')}
                {a.ev.allDay || !a.ev.tm ? (a.day === today ? 'All day' : '') : fmtTime(a.ev.tm)}
              </span>
            </span>
          </div>
        ))}
        <div className="snow">Now · {now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div>
        {later.map((i) => row(i))}
        {anytime.length ? <div className="sdiv">Anytime</div> : null}
        {anytime.map((i) => row(i))}
        {!later.length && !anytime.length ? <p className="oIntro tlNone">Nothing else today.</p> : null}
        <div className="sdiv">Tomorrow</div>
        {tmrw.length ? tmrw.map((i) => row(i)) : <p className="oIntro tlNone">Nothing yet.</p>}
      </div>
    </div>
  );
}

/* This week, Option A style: one card of dated rows (day · what · time) for
   the next seven days after today, events and dated tasks together. The big
   agenda view belongs to the Calendar page. */
export function WeekStrip() {
  const { go, openPanel } = useNav();
  const now = new Date();
  const open = getTasks().filter((t) => !t.d);
  const rows: { key: string; day: Date; t: string; tm?: string; task?: Task; ev?: CalEvent }[] = [];
  for (let n = 1; n <= 7; n++) {
    const d = addDays(now, n);
    const day = ymd(d);
    itemsFor(day, open)
      .sort(byTime)
      .forEach((i) => rows.push({ key: i.key, day: d, t: i.t, tm: i.tm, task: i.kind === 'task' ? i.task : undefined, ev: i.kind === 'event' ? i.ev : undefined }));
  }
  if (!rows.length) return <p className="oIntro tlNone">Nothing dated this week.</p>;
  return (
    <div className="wkCard">
      {rows.map((r) => (
        <button
          key={r.key}
          className="wkRow"
          onClick={(e) => {
            e.stopPropagation();
            if (r.task) {
              setFocus({ k: 'task', id: r.task.id });
              openPanel('item');
            } else if (r.ev?.id) {
              setFocus({ k: 'event', id: r.ev.id, day: ymd(r.day) });
              openPanel('item');
            } else go('cal');
          }}
        >
          <span className="wkD">
            {r.day.toLocaleDateString(undefined, { weekday: 'short' })} {r.day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
          <span className="ft">{r.t}</span>
          <span className="fmeta">{r.tm ? fmtTime(r.tm) : r.task ? 'Task' : 'All day'}</span>
        </button>
      ))}
    </div>
  );
}

/** What an event is, as one word: its kind, or plain "Event". */
/** The kind word on an event row; a Must go event says so first (Oct 21). */
export function evKind(e: CalEvent): string {
  const kind = !e.type || e.type === 'other' ? 'Event' : TYPE_LABEL[e.type];
  return importanceOf(e) === 'must' ? 'Must go · ' + kind : kind;
}
