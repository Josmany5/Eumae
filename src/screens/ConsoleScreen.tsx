import { useEffect, useMemo, useRef, useState } from 'react';
import { useNav } from '../nav';
import { getTasks, toggleTask, createTask, deleteTask, type Task } from '../tasks';
import { dayEvents, saveEvent } from '../events';
import { getPinnedProject, getProjects, setPinnedProjectId } from '../projects';
import { getGuild } from '../guild';
import { useLog } from '../log';

/* The Console — the mockup's rCon, rebuilt as React on tokens.
 *
 * Four swipeable pages (PGS = Today/Tasks/Calendar/Pinned), dots beneath.
 * Every row reads a real store from batch 1; example seeds render as paths
 * until live data replaces them. Nothing here invents: an empty log means
 * "Nothing yet today", not a fabricated overnight.
 */

const PAGES = ['Today', 'Tasks', 'Calendar', 'Pinned'];
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Local YYYY-MM-DD — the mockup's calDay, defaulting to today rather than
 *  its hardcoded 2026-10-01. */
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function weekDays(day: string): string[] {
  const base = new Date(day + 'T12:00');
  const dow = base.getDay();
  const out: string[] = [];
  for (let i = -dow; i < 7 - dow; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/* One task row: toggle + text (+ Focus pill while open). The mockup's
   `.task` row; toggle is the one writer (toggleTask). */
function TaskRow({ task, onFocus, onChanged }: { task: Task; onFocus: (id: string) => void; onChanged: () => void }) {
  return (
    <div className="task">
      <button
        className={`ck${task.d ? ' d' : ''}`}
        aria-label={task.d ? `Reopen ${task.t}` : `Done: ${task.t}`}
        onClick={() => {
          toggleTask(task.id);
          onChanged();
        }}
      />
      <div className="g">{task.d ? <s className="m">{task.t}</s> : task.t}</div>
      {!task.d ? (
        <button className="fb" onClick={() => onFocus(task.id)}>
          Focus
        </button>
      ) : null}
    </div>
  );
}

/* The 25-minute focus timer slot under Today's tasks. The mockup's fcs. */
function FocusBar({ title, onEnd }: { title: string; onEnd: () => void }) {
  const [left, setLeft] = useState(25 * 60);
  useEffect(() => {
    const h = window.setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          window.clearInterval(h);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(h);
  }, []);
  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  return (
    <div className="fbar">
      <div className="g">
        <b>Focus:</b> {title}
        <div className="xs m">
          {left > 0 ? `${mm}:${ss} left` : 'Focus session done'}
        </div>
      </div>
      <button className="fb" onClick={onEnd}>
        End
      </button>
    </div>
  );
}

/* Morning brief card. The mockup's brief(): overnight + carried-over +
   ranked, ending in "That's the one" -> "Locked in." Built from the real
   log + open tasks — never fabricated lines. */
function BriefCard({ onClose }: { onClose: () => void }) {
  const [locked, setLocked] = useState(false);
  const log = useLog('Console');
  const tasks = useMemo(() => getTasks(), []);
  const open = tasks.filter((t) => !t.d);
  const overnight = log.slice(0, 3);
  if (locked) return <div className="card s">Locked in.</div>;
  return (
    <div className="card">
      <b>Morning brief</b>
      <ul className="st">
        {overnight.length > 0 ? (
          overnight.map((e) => (
            <li key={e.id}>
              <span className={`dt ${e.status === 'bad' ? 'bad' : e.status === 'warn' ? 'in' : 'ok'}`} />
              Overnight: {e.text}
            </li>
          ))
        ) : (
          <li>
            <span className="dt ok" />
            Overnight: nothing logged yet
          </li>
        )}
        <li>
          <span className="dt ok" />
          Carried over: {open.length > 1 ? `“${open[1].t}”` : open.length === 1 ? `“${open[0].t}”` : 'nothing open'}
        </li>
        <li>
          <span className="dt ok" />
          Ranked: {open.length > 0 ? `${open[0].t} first` : 'the day is clear'}
        </li>
      </ul>
      <div className="s" style={{ marginTop: 8 }}>
        One focus today:
      </div>
      <div style={{ fontSize: 19, fontWeight: 700, margin: '4px 0' }}>
        {open.length > 0 ? `${open[0].t}.` : 'Nothing — the day is clear.'}
      </div>
      <div className="btns">
        <button className="pri" onClick={() => setLocked(true)}>
          That&apos;s the one
        </button>
      </div>
      <div className="s m" style={{ marginTop: 8 }}>
        <button className="fb" onClick={onClose}>
          Dismiss
        </button>
      </div>
    </div>
  );
}

/* Month grid for the mockup's hardcoded October 2026 -> this month, live.
   Dots where dayEvents has rows; "today" ring on the real today. */
function MonthGrid({ year, month, day, onDay }: { year: number; month: number; day: string; onDay: (d: string) => void }) {
  const first = new Date(year, month, 1).getDay();
  const dim = new Date(year, month + 1, 0).getDate();
  const today = todayStr();
  const cells: React.ReactNode[] = [];
  for (let i = 0; i < first; i++) cells.push(<div key={`b${i}`} />);
  for (let d = 1; d <= dim; d++) {
    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push(
      <button key={ds} className={`dy${ds === day ? ' sel' : ''}${ds === today ? ' today' : ''}`} onClick={() => onDay(ds)}>
        {d}
        {dayEvents(ds).length > 0 ? <span className="dotd" /> : null}
      </button>,
    );
  }
  const name = new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  return (
    <div className="card">
      <div className="row">
        <div className="g">
          <b>{name}</b>
        </div>
      </div>
      <div className="calgrid">
        {DOW.map((d, i) => (
          <div key={i} className="dw">
            {d}
          </div>
        ))}
        {cells}
      </div>
    </div>
  );
}



export default function ConsoleScreen() {
  const { notify, go } = useNav();
  const [tasks, setTasks] = useState<Task[]>(() => getTasks());
  const [page, setPage] = useState(0);
  const [calView, setCalView] = useState<'day' | 'week' | 'month'>('month');
  const [calDay, setCalDay] = useState(() => todayStr());
  const [focusId, setFocusId] = useState<string | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const swipeRef = useRef<HTMLDivElement>(null);

  const refresh = () => setTasks(getTasks());
  const open = tasks.filter((t) => !t.d);
  const doneCount = tasks.length - open.length;
  const guild = useMemo(() => getGuild(), []);
  const pinned = useMemo(() => getPinnedProject(), []);
  const projects = useMemo(() => getProjects(), []);
  const log = useLog('Console');
  const evs = useMemo(() => dayEvents(calDay), [calDay, tasks]);
  const focusTask = focusId ? tasks.find((t) => t.id === focusId) : undefined;

  /* Dots follow the swipe: scroll position -> page, like the mockup's scroll
     listener + paintDots. */
  const onSwipeScroll = () => {
    const el = swipeRef.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    if (i !== page && i >= 0 && i < PAGES.length) setPage(i);
  };
  const jump = (i: number) => {
    setPage(i);
    swipeRef.current?.scrollTo({ left: i * swipeRef.current.clientWidth, behavior: 'smooth' });
  };

  const addTask = () => {
    const t = newTitle.trim();
    if (!t) {
      notify('Name the task first.');
      return;
    }
    createTask(t);
    setNewTitle('');
    refresh();
  };

  const tidy = () => {
    const n = tasks.filter((t) => t.d).length;
    tasks
      .filter((t) => t.d)
      .forEach((t) => deleteTask(t.id));
    refresh();
    notify(n > 0 ? `Tidied — removed ${n} completed.` : 'Nothing to tidy.');
  };

  const addEvent = () => {
    const t = window.prompt('Event title:');
    if (!t || !t.trim()) return;
    const tm = window.prompt('Time (HH:MM):', '12:00') || '12:00';
    saveEvent({ d: calDay, tm, t: t.trim() });
    refresh();
    notify('Event added.');
  };

  /* Overnight = newest log rows; priorities = top-3 open tasks; schedule =
     today's events; one focus = first open task. The mockup's bfH, real. */
  const overnight = log.slice(0, 3);
  const priorities = open.slice(0, 3);
  const next = evs[0];
  const waiting = guild.reqIn.filter((r) => r.st === 'new').length;
  const pct = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;

  /* Notifications: guild requests + activity, guild first then activity —
     the mockup sorts by clock time, but rows carry display times like
     "Yesterday", so recency order without parsing. */
  const notes = [
    ...guild.reqIn
      .filter((r) => r.st !== 'sent')
      .map((r) => ({
        key: `r${r.p}${r.what}`,
        dot: 'in' as const,
        a: `${guild.people[r.p]?.n ?? 'Someone'} asked for ${r.what}`,
        t: `${r.t} · Guild`,
      })),
    ...guild.act.map((x, i) => ({
      key: `a${i}${x.a}`,
      dot: (x.s === 'ok' ? 'ok' : x.s === 'in' ? 'in' : 'bad') as 'ok' | 'in' | 'bad',
      a: x.a,
      t: `${x.t} · ${x.w}`,
    })),
  ];

  const taskList = (rows: Task[]) =>
    rows.length > 0 ? (
      rows.map((t) => <TaskRow key={t.id} task={t} onFocus={(id) => setFocusId(id)} onChanged={refresh} />)
    ) : (
      <div className="s m">No tasks.</div>
    );

  const schedList =
    evs.length > 0 ? (
      evs.map((e, i) => (
        <div key={`${e.tm}${e.t}${i}`} className="ev">
          <div className="tm">{e.tm}</div>
          <div className="g">{e.t}</div>
        </div>
      ))
    ) : (
      <div className="s m">Nothing scheduled.</div>
    );


  const now = new Date();
  const calYear = now.getFullYear();
  const calMonth = now.getMonth();

  return (
    <div>
      <div className="cpl">{PAGES[page]}</div>
      <div className="cswipe" ref={swipeRef} onScroll={onSwipeScroll}>
        <div className="cpg">
          <h3 className="sec" style={{ marginTop: 8 }}>
            Daily brief
          </h3>
          <div className="card">
            <div className="s m">Overnight</div>
            <ul className="st">
              {overnight.length > 0 ? (
                overnight.map((h) => (
                  <li key={h.id}>
                    <span className={`dt ${h.status === 'bad' ? 'bad' : h.status === 'warn' ? 'in' : 'ok'}`} />
                    {h.text}
                    <span className="m"> · {h.ts}</span>
                  </li>
                ))
              ) : (
                <li>
                  <span className="dt ok" />
                  Nothing logged overnight
                </li>
              )}
            </ul>
            <div className="s m" style={{ marginTop: 10 }}>
              Today&apos;s priorities
            </div>
            <ul className="st">
              {priorities.length > 0 ? (
                priorities.map((x) => <li key={x.id}>{x.t}</li>)
              ) : (
                <li>Nothing open — the day is clear</li>
              )}
            </ul>
            <div className="s m" style={{ marginTop: 10 }}>
              Schedule
            </div>
            {schedList}
            <div className="s" style={{ marginTop: 10 }}>
              One focus today:
            </div>
            <div style={{ fontSize: 19, fontWeight: 700, margin: '4px 0' }}>
              {open.length > 0 ? open[0].t : 'Nothing — the day is clear'}
            </div>
          </div>
          <h3 className="sec">Widgets</h3>
          <div className="wdgRow">
            <div className="wdg">
              <div style={{ fontWeight: 700 }}>
                {doneCount} of {tasks.length} tasks done
              </div>
              <div className="bar" style={{ marginTop: 6 }}>
                <i style={{ width: `${pct}%` }} />
              </div>
            </div>
            <div className="wdg">
              <div style={{ fontWeight: 700 }}>{next ? 'Next up' : 'Nothing next'}</div>
              <div className="xs m" style={{ marginTop: 4 }}>
                {next ? `${next.tm} — ${next.t}` : 'Schedule is clear'}
              </div>
            </div>
            <div className="wdg">
              <div style={{ fontWeight: 700 }}>Morning brief</div>
              <div className="xs m" style={{ marginTop: 4 }}>
                Runs weekdays 7:00 AM · On
              </div>
            </div>
            <div className="wdg">
              <div style={{ fontWeight: 700 }}>
                {waiting > 0 ? `${waiting} requests waiting` : 'No requests waiting'}
              </div>
              <div className="xs m" style={{ marginTop: 4 }}>
                In your Guild
              </div>
            </div>
          </div>
          <h3 className="sec">To do</h3>
          <div className="card cardPad">{taskList(tasks)}</div>
          <h3 className="sec">Notifications for the day</h3>
          <div className="card cardPad">
            {notes.length > 0 ? (
              notes.map((n) => (
                <div key={n.key} className="hi">
                  <span className={`dt ${n.dot}`} />
                  <div>
                    <div>{n.a}</div>
                    <div className="xs m">{n.t}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="s m">Nothing yet today.</div>
            )}
          </div>
        </div>


        <div className="cpg">
          <div className="row">
            <h3 className="sec" style={{ margin: '8px 0' }}>
              Today&apos;s tasks
            </h3>
            <div className="g" />
          </div>
          <div className="row" style={{ gap: 8 }}>
            <input
              className="sinput"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="New task"
              aria-label="New task"
              onKeyDown={(e) => {
                if (e.key === 'Enter') addTask();
              }}
            />
            <button className="fb" onClick={addTask} aria-label="Add task">
              Add
            </button>
          </div>
          <div className="card cardPad">{taskList(tasks)}</div>
          <div className="btns">
            <button onClick={tidy}>Tidy up</button>
            <button className="gho" onClick={() => setBriefOpen((v) => !v)}>
              Morning brief
            </button>
          </div>
          {focusTask ? <FocusBar title={focusTask.t} onEnd={() => setFocusId(null)} /> : null}
          {briefOpen ? <BriefCard onClose={() => setBriefOpen(false)} /> : null}
        </div>
        <div className="cpg">
          <div className="row">
            <h3 className="sec" style={{ margin: '8px 0' }}>
              Calendar
            </h3>
            <div className="g" />
            <button className="fb" onClick={addEvent} aria-label="Add event">
              Add event
            </button>
          </div>
          <div className="seg">
            {(['day', 'week', 'month'] as const).map((v) => (
              <button key={v} className={calView === v ? 'on' : ''} onClick={() => setCalView(v)}>
                {v[0].toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          {calView === 'day' ? (
            <div className="wkstrip">
              {weekDays(calDay).map((d) => (
                <button key={d} className={d === calDay ? 'sel' : ''} onClick={() => setCalDay(d)}>
                  {d.slice(8)}
                  <br />
                  <span className="xs">{['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][new Date(d + 'T12:00').getDay()]}</span>
                </button>
              ))}
            </div>
          ) : null}
          {calView === 'week' ? (
            <div className="card">
              <div className="calgrid">
                {DOW.map((d, i) => (
                  <div key={i} className="dw">
                    {d}
                  </div>
                ))}
                {weekDays(calDay).map((d) => (
                  <button key={d} className={`dy${d === calDay ? ' sel' : ''}`} onClick={() => setCalDay(d)}>
                    {Number(d.slice(8))}
                    {dayEvents(d).length > 0 ? <span className="dotd" /> : null}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {calView === 'month' ? <MonthGrid year={calYear} month={calMonth} day={calDay} onDay={setCalDay} /> : null}
          <h3 className="sec">{calDay}</h3>
          <div className="card cardPad">{schedList}</div>
        </div>
        <div className="cpg">
          <h3 className="sec">Pinned project</h3>
          {pinned ? (
            <div className="card">
              <div style={{ fontSize: 20, fontWeight: 700 }}>{pinned.n}</div>
              <div className="s m">{pinned.d}</div>
              <div className="bar">
                <i style={{ width: `${pinned.ts > 0 ? Math.round((pinned.dn / pinned.ts) * 100) : 0}%` }} />
              </div>
              <div className="xs m">
                {pinned.dn} of {pinned.ts} done
              </div>
              <div className="btns">
                <button onClick={() => go('projects')}>Open project</button>
              </div>
              {projects.length > 1 ? (
                <div className="s m" style={{ marginTop: 10 }}>
                  Pin another:
                  <div className="btns">
                    {projects
                      .filter((p) => p.id !== pinned.id)
                      .map((p) => (
                        <button
                          key={p.id}
                          className="fb"
                          onClick={() => {
                            setPinnedProjectId(p.id);
                            notify(`Pinned to Console: ${p.n}`);
                          }}
                        >
                          {p.n}
                        </button>
                      ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="card s m">Pin a project in Projects.</div>
          )}
        </div>
      </div>
      <div className="cdots">
        {PAGES.map((p, i) => (
          <i key={p} className={i === page ? 'on' : ''} onClick={() => jump(i)} />
        ))}
      </div>
    </div>
  );
}

