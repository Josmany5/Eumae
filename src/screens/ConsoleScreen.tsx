import { useState } from 'react';
import { useNav } from '../nav';
import { getTasks, toggleTask, createTask, saveTask, type Task } from '../tasks';
import { dayEvents, ymd, mins, type CalEvent } from '../events';
import { getGoals } from '../goals';
import { parseQuick, fmtTime } from '../quickadd';
import { logEv } from '../log';

/* Console › Today, in the flat-row look (Oct 18 redesign, step 3).
 *
 * One fixed layout, no widget grid: a headline, one add line, the day's spine
 * (Overdue, Needs attention, earlier today, Now, later today, Anytime,
 * Tomorrow), and a side column with Eumae noticed, This week and Goals.
 * Everything is read from the same task, event and goal stores the full pages
 * use, so a check here is a check everywhere. */

type Item =
  | { kind: 'task'; key: string; t: string; tm?: string; task: Task }
  | { kind: 'event'; key: string; t: string; tm?: string; ev: CalEvent };

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

const URGENT = new Set(['urgent', 'critical']);

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

export default function ConsoleScreen() {
  const { go, notify } = useNav();
  const [, setTick] = useState(0);
  const [text, setText] = useState('');
  const refresh = () => setTick((n) => n + 1);

  const now = new Date();
  const today = ymd(now);
  const tomorrow = ymd(addDays(now, 1));
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const all = getTasks();
  const open = all.filter((t) => !t.d);
  const overdue = open.filter((t) => t.due && t.due < today);
  const todayItems = itemsFor(today, all);
  const attention = todayItems.filter((i) => i.kind === 'task' && !i.task.d && !i.tm && URGENT.has(i.task.pr ?? ''));
  const timed = todayItems.filter((i) => i.tm && !attention.includes(i)).sort(byTime);
  const earlier = timed.filter((i) => mins(i.tm) < nowMin);
  const later = timed.filter((i) => mins(i.tm) >= nowMin);
  const anytime = todayItems.filter((i) => !i.tm && !attention.includes(i));
  const tmrw = itemsFor(tomorrow, all.filter((t) => !t.d)).sort(byTime);

  const leftToday = todayItems.filter((i) => i.kind === 'task' && !i.task.d).length + overdue.length;
  const next = later.find((i) => i.kind === 'event' || !i.task.d);

  const add = () => {
    const s = text.trim();
    if (!s) return;
    const q = parseQuick(s);
    const t = createTask(q.title || s);
    saveTask({ ...t, due: q.date ?? today, tm: q.time, est: q.mins, pr: q.pr, list: q.list ?? t.list });
    logEv({ area: 'Console', text: `Added task: ${q.title || s}` });
    setText('');
    refresh();
  };

  const tap = (i: Item) => (i.kind === 'task' ? go('tasks', i.task.id) : go('cal'));

  const row = (i: Item, opts: { over?: boolean; past?: boolean } = {}) => {
    const done = i.kind === 'task' && !!i.task.d;
    return (
      <div key={i.key} className={`frow tdRow${done || opts.past ? ' past' : ''}${i.kind === 'event' ? ' ev' : ''}`}>
        {i.kind === 'task' ? (
          <button
            className={`fchk${done ? ' on' : ''}`}
            aria-label={done ? `Mark ${i.t} not done` : `Mark ${i.t} done`}
            onClick={() => {
              toggleTask(i.task.id);
              if (!done) notify('Done.', { undo: () => { toggleTask(i.task.id); refresh(); } });
              refresh();
            }}
          />
        ) : null}
        <button className="ft tdT" onClick={() => tap(i)}>
          <span className={done ? 'strike' : ''}>{i.t}</span>
        </button>
        <span className={`fmeta${opts.over ? ' over' : ''}`}>
          {opts.over && i.kind === 'task' ? fmtDue(i.task.due!) : i.tm ? fmtTime(i.tm) : i.kind === 'event' ? 'All day' : ''}
        </span>
      </div>
    );
  };

  const week = Array.from({ length: 7 }, (_, n) => {
    const d = addDays(now, n);
    const day = ymd(d);
    const evs = dayEvents(day);
    const due = open.filter((t) => t.due === day).length;
    return { day, d, evs, due };
  });

  const goals = getGoals().filter((g) => g.st !== 'completed').slice(0, 4);

  const dateLine = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="today">
      <div className="tdTop">
        <h1>Today</h1>
        <span className="fmeta">{dateLine}</span>
      </div>
      <p className="tdHead">
        {leftToday ? <b>{leftToday} left today.</b> : <b>Nothing left today.</b>}{' '}
        {overdue.length ? <span className="over">{overdue.length} overdue. </span> : null}
        {next ? <>Next: {next.t} at {fmtTime(next.tm)}.</> : 'Nothing else on the clock.'}
      </p>
      <form
        className="tdAdd"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a task, like “Call Marcus 4pm”"
          aria-label="Add a task"
        />
      </form>

      <div className="tdCols">
        <div className="tdMain">
          <div className="flbl">Your day</div>
          <div className="spine">
            {overdue.length ? <div className="sdiv att">Overdue</div> : null}
            {overdue.map((t) => row({ kind: 'task', key: 'o' + t.id, t: t.t, tm: t.tm, task: t }, { over: true }))}
            {attention.length ? <div className="sdiv att">Needs attention</div> : null}
            {attention.map((i) => row(i))}
            {earlier.length ? <div className="sdiv">Earlier</div> : null}
            {earlier.map((i) => row(i, { past: true }))}
            <div className="snow">Now · {now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div>
            {later.map((i) => row(i))}
            {anytime.length ? <div className="sdiv">Anytime today</div> : null}
            {anytime.map((i) => row(i))}
            {!later.length && !anytime.length ? <p className="oIntro tdNone">Nothing else today.</p> : null}
            <div className="sdiv">Tomorrow</div>
            {tmrw.length ? tmrw.map((i) => row(i)) : <p className="oIntro tdNone">Nothing yet.</p>}
          </div>
        </div>

        <div className="tdSide">
          <div className="flbl">Eumae noticed</div>
          <p className="oIntro">Nothing yet. Mae's suggestions land here, and on her Desk, once she can notice things.</p>

          <div className="flbl">
            This week
            <button className="fact tdLink" onClick={() => go('cal')}>Calendar</button>
          </div>
          {week.map((w) => (
            <button key={w.day} className={`frow tdDay${w.day === today ? ' on' : ''}`} onClick={() => go('cal')}>
              <span className="tdDow">{w.d.toLocaleDateString(undefined, { weekday: 'short' })}</span>
              <span className="ft">{w.evs[0]?.t ?? (w.due ? `${w.due} task${w.due === 1 ? '' : 's'} due` : '')}</span>
              <span className="fmeta">
                {w.evs.length > 1 ? `+${w.evs.length - 1}` : ''}
              </span>
            </button>
          ))}

          <div className="flbl">
            Goals
            <button className="fact tdLink" onClick={() => go('goals')}>All goals</button>
          </div>
          {goals.length ? (
            goals.map((g) => {
              const ms = g.ms ?? [];
              const pct = ms.length ? Math.round((ms.filter((m) => m.done).length / ms.length) * 100) : g.st === 'in-progress' ? 0 : 0;
              return (
                <button key={g.id} className="tdGoal" onClick={() => go('goals')}>
                  <span className="r">
                    <span className="ft">{g.t}</span>
                    <span className="fmeta">{ms.length ? `${pct}%` : g.td ? fmtDue(g.td) : ''}</span>
                  </span>
                  {ms.length ? (
                    <span className="bar">
                      <i style={{ width: `${pct}%` }} />
                    </span>
                  ) : null}
                </button>
              );
            })
          ) : (
            <p className="oIntro">No goals yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function fmtDue(d: string): string {
  return new Date(d + 'T12:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
