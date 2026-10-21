import { useEffect, useState } from 'react';
import { useNav, type PanelView } from '../../nav';
import { getTasks, getTask, toggleTask, toggleSubtask, deleteTask, snapshotTasks, restoreTasks, getLists } from '../../tasks';
import { projectOf, linkedIds } from '../../projects';
import { getGoals, saveGoal, deleteGoal, snapshotGoals, restoreGoals, goalPct, goalCount, goalPace, isActiveGoal, GOAL_STATUS_LABEL, goalLinkedIds, goalOf, linkToGoal, unlinkFromGoal, type Goal } from '../../goals';
import { getNote, titleOf } from '../../notes';
import { useGoalAdd } from '../GoalAdd';
import { sortMilestones } from '../../milestones';
import { dueLabel } from '../../pages/GoalsPage';
import { fmtShort, fmtTime, repLabel } from '../../quickadd';
import { setFocus, toggleEditModal, onDataChange, dataChanged, type Focus } from '../../focus';
import { getEvent, ymd } from '../../events';
import { removeEvent, TYPE_LABEL } from '../QuickAdd';
import { ItemMenu } from '../ItemMenu';
import { itemsOn, minsToTm } from '../../pages/CalendarPage';
import { evKind } from './Timeline';
import { isOverdue, hasEnded } from '../../due';
import { AttendAsk } from './Attend';

/** The tapped item's own tab in Mae's office: what it is, its details, its
 *  steps, and the moves you'd make on it. Read-only; Edit opens the form. */
export function ItemTab({ focus, onView }: { focus: Focus; onView: (v: PanelView) => void }) {
  if (focus.k === 'day') return <DayTab day={focus.id} />;
  if (focus.k === 'goal') return <GoalTab focus={focus} onView={onView} />;
  return focus.k === 'event' ? <EventTab focus={focus} onView={onView} /> : <TaskTab focus={focus} onView={onView} />;
}

/* A day from the month grid: everything on it, agenda-style. Tap a row and
   it opens in its own tab; the Day tab's back arrow is the month. */
function DayTab({ day }: { day: string }) {
  const { go, openPanel } = useNav();
  const [, setTick] = useState(0);
  useEffect(() => onDataChange(() => setTick((n) => n + 1)), []);
  const items = itemsOn(day, getTasks());
  const dt = new Date(day + 'T12:00');
  return (
    <div className="itab">
      <h2 className="itT">{dt.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
      <p className="fmeta itSub">{items.length ? `${items.length} thing${items.length > 1 ? 's' : ''}` : 'Free'}</p>
      {items.map((it) => (
        <div key={it.key} className={'frow top agRow2 c-' + it.color + (it.done ? ' past' : '')}>
          <span className="agT fmeta">{it.start === undefined ? 'All day' : fmtTime(minsToTm(it.start))}</span>
          {it.kind === 'task' && it.task ? (
            <button
              className={'fchk' + (it.done ? ' on' : '')}
              aria-label={it.done ? `Reopen ${it.title}` : `Done: ${it.title}`}
              onClick={() => {
                toggleTask(it.task!.id);
                setTick((n) => n + 1);
              }}
            />
          ) : (
            <i className="agBar" />
          )}
          <div className="ft">
            <button
              className="tlT"
              onClick={() => {
                if (it.link) go(it.link.page, it.link.arg);
                else if (it.task) {
                  setFocus({ k: 'task', id: it.task.id });
                  openPanel('item');
                } else if (it.ev?.id) {
                  setFocus({ k: 'event', id: it.ev.id, day });
                  openPanel('item');
                }
              }}
            >
              <span className={it.done ? 'tlDone' : ''}>{it.title}</span>
            </button>
          </div>
          <span className="fmeta">{it.kind === 'event' && it.ev ? evKind(it.ev) : it.kind === 'task' ? 'Task' : it.kind[0].toUpperCase() + it.kind.slice(1)}</span>
        </div>
      ))}
    </div>
  );
}

function EventTab({ focus, onView }: { focus: Focus; onView: (v: PanelView) => void }) {
  const { notify } = useNav();
  const [, setTick] = useState(0);
  useEffect(() => onDataChange(() => setTick((n) => n + 1)), []);
  const ev = getEvent(focus.id);
  if (!ev) {
    return (
      <div className="oEmpty">
        <span className="ft">That event is gone</span>
        <p className="oIntro">It was deleted. Pick another one.</p>
      </div>
    );
  }
  const d = focus.day ?? ev.d;
  const today = ymd(new Date());
  const tmw = new Date();
  tmw.setDate(tmw.getDate() + 1);
  const dayWord =
    d === today ? 'Today' : d === ymd(tmw) ? 'Tomorrow' : new Date(d + 'T12:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  const time = ev.allDay || !ev.tm ? 'All day' : fmtTime(ev.tm) + (ev.end ? ' – ' + fmtTime(ev.end) : '');
  const ended = !ev.example && !!ev.id && hasEnded(ev, d);
  const project = projectOf('event', ev.id!);
  const kv: [string, string][] = [['When', dayWord + ', ' + time]];
  if (ev.loc) kv.push(['Where', ev.loc]);
  if (ev.rep) kv.push(['Repeats', repLabel(ev.rep, ev.d)]);
  kv.push(['Kind', TYPE_LABEL[ev.type ?? 'other']]);
  if (project) kv.push(['Project', project.n]);
  const evGoal = goalOf('event', ev.id!);
  if (evGoal) kv.push(['Goal', evGoal.t]);
  const edit = () => {
    toggleEditModal({ k: 'event', id: ev.id! });
  };
  const del = (scope: 'one' | 'all') => {
    setFocus(null);
    removeEvent(notify, ev, d, scope);
  };
  return (
    <div className="itab">
      <h2 className="itT">{ev.t}</h2>
      {d < today ? <p className="fmeta itSub">Past</p> : <div style={{ height: 8 }} />}
      {ended ? (
        <div className="itAttend">
          <AttendAsk ev={ev} day={d} onChange={() => setTick((n) => n + 1)} />
        </div>
      ) : null}
      {kv.map(([k, v]) => (
        <div key={k} className="frow itKV">
          <span className="fmeta">{k}</span>
          <span className="ft">{v}</span>
        </div>
      ))}
      {ev.note ? (
        <>
          <div className="flbl">Notes</div>
          <p className="itNote">{ev.note}</p>
        </>
      ) : null}
      <div className="itMae">
        <span className="n">Mae</span>
        <span>Want to prep for this? Ask me for talking points or what to bring.</span>
        <button className="fact" onClick={() => onView('mae')}>Ask Mae</button>
      </div>
      <div className="itActs">
        <button className="pri" onClick={edit}>Edit</button>
        <ItemMenu
          name={ev.t}
          edit={edit}
          link={{ k: 'event', id: ev.id! }}
          onChange={() => setTick((n) => n + 1)}
          extra={ev.rep ? [{ label: 'Delete this one', onClick: () => del('one'), danger: true }] : undefined}
          deleteLabel={ev.rep ? 'Delete the series' : 'Delete'}
          onDelete={() => del('all')}
        />
      </div>
    </div>
  );
}

function TaskTab({ focus, onView }: { focus: Focus; onView: (v: PanelView) => void }) {
  const { notify } = useNav();
  const [, setTick] = useState(0);
  useEffect(() => onDataChange(() => setTick((n) => n + 1)), []);
  const refresh = () => setTick((n) => n + 1);
  const t = getTask(focus.id);
  if (!t) {
    return (
      <div className="oEmpty">
        <span className="ft">That task is gone</span>
        <p className="oIntro">It was deleted or moved. Pick another one.</p>
      </div>
    );
  }
  const today = new Date();
  const ymdOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const tY = ymdOf(today);
  const tm = new Date(today);
  tm.setDate(tm.getDate() + 1);
  const when = t.due
    ? (t.due === tY ? 'Today' : t.due === ymdOf(tm) ? 'Tomorrow' : fmtShort(t.due)) + (t.tm ? ', ' + fmtTime(t.tm) : '')
    : 'Someday';
  const late = isOverdue(t);
  const project = projectOf('task', t.id);
  /* Its own goal first; else the goal of its project, as before. */
  const goalId = goalOf('task', t.id)?.id ?? (project ? linkedIds(project.id, 'goal')[0] : undefined);
  const goal = goalId ? getGoals().find((g) => g.id === goalId) : undefined;
  const list = getLists().find((l) => l.id === (t.list ?? 'inbox'));
  const subs = t.sub ?? [];
  const firstOpen = subs.findIndex((s) => !s.d);
  const added = new Date(t.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  const kv: [string, string, string?][] = [
    ['When', when, late ? 'over' : undefined],
    ['List', list?.n ?? 'Inbox'],
  ];
  if (project) kv.push(['Project', project.n]);
  if (goal) kv.push(['Goal', goal.t]);
  if (t.pr && t.pr !== 'none') kv.push(['Priority', t.pr[0].toUpperCase() + t.pr.slice(1)]);
  if (t.est) kv.push(['Estimate', t.est >= 60 ? `${+(t.est / 60).toFixed(1)} h` : `${t.est} min`]);
  if (t.rep && t.rep !== 'none') kv.push(['Repeats', t.rep[0].toUpperCase() + t.rep.slice(1)]);

  const edit = () => {
    toggleEditModal({ k: 'task', id: t.id });
  };

  return (
    <div className="itab">
      <h2 className={'itT' + (t.d ? ' tlDone' : '')}>{t.t}</h2>
      <p className="fmeta itSub">
        Added {added}
        {t.d ? ' · done' : ''}
      </p>
      {kv.map(([k, v, cls]) => (
        <div key={k} className="frow itKV">
          <span className="fmeta">{k}</span>
          <span className={'ft' + (cls ? ' ' + cls : '')}>{v}</span>
        </div>
      ))}
      {subs.length ? (
        <>
          <div className="flbl">Steps</div>
          {subs.map((s, i) => (
            <div key={i} className={'frow itStep' + (i === firstOpen ? ' cur' : '')}>
              <button
                className={'itNum' + (s.d ? ' on' : '')}
                aria-label={s.d ? `Reopen ${s.t}` : `Done: ${s.t}`}
                onClick={() => {
                  toggleSubtask(t.id, i);
                  refresh();
                }}
              >
                {s.d ? '✓' : i + 1}
              </button>
              <span className="ft">{s.t}</span>
            </div>
          ))}
        </>
      ) : null}
      <div className="itMae">
        <span className="n">Mae</span>
        <span>Want help with this one? Ask me to break it into steps or plan when to do it.</span>
        <button className="fact" onClick={() => onView('mae')}>Ask Mae</button>
      </div>
      <div className="itActs">
        <button className="pri" onClick={edit}>Edit</button>
        <ItemMenu
          name={t.t}
          edit={edit}
          link={{ k: 'task', id: t.id }}
          onChange={refresh}
          onDelete={() => {
            const snap = snapshotTasks();
            deleteTask(t.id);
            setFocus(null);
            notify('Task deleted.', { undo: () => { restoreTasks(snap); setFocus({ k: 'task', id: t.id }); } });
          }}
        />
      </div>
    </div>
  );
}

/* A goal, read-only: the aim and why, where it stands (counted), what's
   next, the pieces that serve it, and the record of what moved it. */
function GoalTab({ focus, onView }: { focus: Focus; onView: (v: PanelView) => void }) {
  const { notify } = useNav();
  const [, setTick] = useState(0);
  useEffect(() => onDataChange(() => setTick((n) => n + 1)), []);
  const refresh = () => setTick((n) => n + 1);
  const g = getGoals().find((x) => x.id === focus.id);
  const goalAdd = useGoalAdd(g, refresh);
  if (!g) {
    return (
      <div className="oEmpty">
        <span className="ft">That goal is gone</span>
        <p className="oIntro">It was deleted. Pick another one.</p>
      </div>
    );
  }
  const put = (next: Goal, msg: string) => {
    const before = g;
    saveGoal(next);
    refresh();
    dataChanged();
    notify(msg, {
      undo: () => {
        saveGoal(before);
        refresh();
        dataChanged();
      },
    });
  };
  const pct = goalPct(g);
  const count = goalCount(g);
  const pace = goalPace(g);
  const due = dueLabel(g);
  const project = projectOf('goal', g.id);
  /* The goal's own tasks, events and notes (his call, Oct 19), not its project's. */
  const tasks = goalLinkedIds(g.id, 'task').map((id) => getTask(id)).filter((t): t is NonNullable<typeof t> => !!t);
  const evs = goalLinkedIds(g.id, 'event').map((id) => getEvent(id)).filter((e): e is NonNullable<typeof e> => !!e);
  const notes = goalLinkedIds(g.id, 'note').map((id) => getNote(id)).filter((n): n is NonNullable<typeof n> => !!n);
  const open = tasks.filter((t) => !t.d);
  const doneTasks = tasks.filter((t) => t.d);
  const ms = sortMilestones(g.ms ?? []);
  const firstOpen = ms.findIndex((m) => !m.done);
  const last = new Date(g.upd ?? g.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  const kv: [string, string, string?][] = [];
  kv.push(['Status', GOAL_STATUS_LABEL[g.st === 'not-started' ? 'in-progress' : g.st]]);
  if (g.td) kv.push(['Target date', fmtShort(g.td) + (isActiveGoal(g) ? ' · ' + due.text.split(' · ').pop() : ''), due.red ? 'over' : undefined]);
  if (g.pace) kv.push(['Pace', `${g.pace.n} a ${g.pace.per}`]);
  if (project) kv.push(['Project', project.n]);
  kv.push(['Last change', last]);

  const edit = () => toggleEditModal({ k: 'goal', id: g.id });
  const step = (d: number) => {
    const cur = Math.max(0, (g.cur ?? 0) + d);
    put({ ...g, cur }, `${cur} of ${g.tgt}${g.unit ? ' ' + g.unit : ''}.`);
  };

  return (
    <div className="itab">
      <h2 className={'itT' + (g.st === 'completed' ? ' tlDone' : '')}>{g.t}</h2>
      {g.d ? <p className="itNote itWhy">{g.d}</p> : <div style={{ height: 8 }} />}
      <span className="gBar itBar">
        <i style={{ width: `${pct}%` }} />
      </span>
      <p className="fmeta itSub">
        {pct}%{count ? ' · ' + count : ''}
        {pace === 'behind' ? <span className="over"> · Behind pace</span> : pace === 'on' ? ' · On track' : ''}
      </p>
      {g.tgt && isActiveGoal(g) ? (
        <div className="frow itKV">
          <span className="fmeta">So far</span>
          <span className="gStep">
            <button className="fb gho" aria-label="One less" onClick={() => step(-1)}>
              −
            </button>
            <span className="ft">
              {g.cur ?? 0}
              {g.unit ? ' ' + g.unit : ''}
            </span>
            <button className="fb gho" aria-label="One more" onClick={() => step(1)}>
              +
            </button>
          </span>
        </div>
      ) : null}
      {kv.map(([k, v, cls]) => (
        <div key={k} className="frow itKV">
          <span className="fmeta">{k}</span>
          <span className={'ft' + (cls ? ' ' + cls : '')}>{v}</span>
        </div>
      ))}
      <div className="flbl gOwnHd">
        <span>
          Steps <span className="fmeta">{open.length + evs.length + notes.length}</span>
        </span>
        <ItemMenu
          name="this goal"
          className="pjAddBtn"
          buttonLabel="+ Add"
          extra={goalAdd.entries}
        />
      </div>
      {!open.length && !evs.length && !notes.length ? <p className="fmeta itSub">No tasks, events or notes under this goal yet.</p> : null}
      {[
        ...open.map((t) => ({ k: 'task' as const, id: t.id, t: t.t, sub: t.due ? fmtShort(t.due) : 'Someday' })),
        ...evs.map((e) => ({ k: 'event' as const, id: e.id!, t: e.t, sub: fmtShort(e.d) + (e.allDay || !e.tm ? '' : ' ' + fmtTime(e.tm)) })),
        ...notes.map((n) => ({ k: 'note' as const, id: n.id, t: titleOf(n) || 'Untitled', sub: 'Note' })),
      ].map((r) => (
        <div key={r.k + r.id} className="frow itKV">
          <button className="ft tlT" onClick={() => (r.k === 'note' ? onView('mae') : setFocus({ k: r.k, id: r.id }))}>
            {r.t}
          </button>
          <span className="fmeta">{r.sub}</span>
          <ItemMenu
            name={r.t}
            extra={[
              {
                label: 'Unlink from this goal',
                onClick: () => {
                  unlinkFromGoal(r.k, r.id);
                  refresh();
                  dataChanged();
                  notify(`Unlinked from ${g.t}.`, {
                    undo: () => {
                      linkToGoal(g.id, r.k, r.id);
                      refresh();
                      dataChanged();
                    },
                  });
                },
              },
            ]}
          />
        </div>
      ))}
      {goalAdd.dialogs}
      {ms.length ? (
        <>
          <div className="flbl">Milestones</div>
          {ms.map((m, i) => (
            <div key={m.id} className={'frow itStep' + (i === firstOpen ? ' cur' : '')}>
              <button
                className={'itNum' + (m.done ? ' on' : '')}
                aria-label={m.done ? `Reopen ${m.t}` : `Done: ${m.t}`}
                onClick={() =>
                  put({ ...g, ms: (g.ms ?? []).map((x) => (x.id === m.id ? { ...x, done: !x.done } : x)) }, m.done ? 'Milestone reopened.' : 'Milestone done.')
                }
              >
                {m.done ? '✓' : i + 1}
              </button>
              <span className="ft">{m.t}</span>
              {m.d ? <span className="fmeta">{fmtShort(m.d)}</span> : null}
            </div>
          ))}
        </>
      ) : null}
      {doneTasks.length || ms.some((m) => m.done) ? (
        <>
          <div className="flbl">What moved it</div>
          {[...ms.filter((m) => m.done).map((m) => ({ k: m.id, t: m.t, w: 'Milestone' })), ...doneTasks.map((t) => ({ k: t.id, t: t.t, w: 'Task' }))]
            .slice(0, 8)
            .map((r) => (
              <div key={r.k} className="frow itKV">
                <span className="ft tlDone">✓ {r.t}</span>
                <span className="fmeta">{r.w}</span>
              </div>
            ))}
        </>
      ) : null}
      <div className="itMae">
        <span className="n">Mae</span>
        <span>{!tasks.length && !evs.length && !ms.length ? 'Nothing serves this goal yet. Ask me for a first small step.' : 'Stuck or behind? Ask me for the next small step.'}</span>
        <button className="fact" onClick={() => onView('mae')}>Ask Mae</button>
      </div>
      <div className="itActs">
        <button className="pri" onClick={edit}>Edit</button>
        <ItemMenu
          name={g.t}
          edit={edit}
          extra={[...goalAdd.entries, ...(
            g.st === 'let-go'
              ? [{ label: 'Bring back', onClick: () => put({ ...g, st: 'in-progress' }, 'Goal is active again.') }]
              : g.st === 'completed'
                ? [{ label: 'Reopen', onClick: () => put({ ...g, st: 'in-progress' }, 'Goal reopened.') }]
                : [
                    { label: 'Mark done', onClick: () => put({ ...g, st: 'completed' }, 'Goal done. Nice work.') },
                    { label: 'Let go', onClick: () => put({ ...g, st: 'let-go' }, 'Goal let go. It stays in your record.') },
                  ]
          )]}
          link={{ k: 'goal', id: g.id }}
          onChange={refresh}
          onDelete={() => {
            const snap = snapshotGoals();
            deleteGoal(g.id);
            setFocus(null);
            dataChanged();
            notify('Goal deleted.', {
              undo: () => {
                restoreGoals(snap);
                dataChanged();
                setFocus({ k: 'goal', id: g.id });
              },
            });
          }}
        />
      </div>
    </div>
  );
}
