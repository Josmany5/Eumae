import { useState } from 'react';
import { useNav, type PanelView } from '../../nav';
import { getTask, toggleTask, toggleSubtask, deleteTask, snapshotTasks, restoreTasks, getLists } from '../../tasks';
import { projectOf, linkedIds } from '../../projects';
import { getGoals } from '../../goals';
import { fmtShort, fmtTime, repLabel } from '../../quickadd';
import { setFocus, requestEditTask, requestEditEvent, type Focus } from '../../focus';
import { getEvent, ymd } from '../../events';
import { removeEvent, TYPE_LABEL } from '../QuickAdd';
import { ItemMenu } from '../ItemMenu';

/** The tapped item's own tab in Mae's office: what it is, its details, its
 *  steps, and the moves you'd make on it. Read-only; Edit opens the form. */
export function ItemTab({ focus, onView }: { focus: Focus; onView: (v: PanelView) => void }) {
  return focus.k === 'event' ? <EventTab focus={focus} onView={onView} /> : <TaskTab focus={focus} onView={onView} />;
}

function EventTab({ focus, onView }: { focus: Focus; onView: (v: PanelView) => void }) {
  const { go, notify } = useNav();
  const [, setTick] = useState(0);
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
  const project = projectOf('event', ev.id!);
  const kv: [string, string][] = [['When', dayWord + ', ' + time]];
  if (ev.loc) kv.push(['Where', ev.loc]);
  if (ev.rep) kv.push(['Repeats', repLabel(ev.rep, ev.d)]);
  kv.push(['Kind', TYPE_LABEL[ev.type ?? 'other']]);
  if (project) kv.push(['Project', project.n]);
  const edit = () => {
    if (!requestEditEvent(ev.id!)) go('cal', ev.id);
  };
  const del = (scope: 'one' | 'all') => {
    setFocus(null);
    removeEvent(notify, ev, d, scope);
  };
  return (
    <div className="itab">
      <h2 className="itT">{ev.t}</h2>
      {d < today ? <p className="fmeta itSub">Past</p> : <div style={{ height: 8 }} />}
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
  const { go, notify } = useNav();
  const [, setTick] = useState(0);
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
  const late = !t.d && !!t.due && t.due < tY;
  const project = projectOf('task', t.id);
  const goalId = project ? linkedIds(project.id, 'goal')[0] : undefined;
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
    if (!requestEditTask(t.id)) go('tasks', t.id);
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
        <button
          className="pri"
          onClick={() => {
            const was = t.d;
            toggleTask(t.id);
            if (!was) notify('Done.', { undo: () => { toggleTask(t.id); refresh(); } });
            refresh();
          }}
        >
          {t.d ? 'Reopen' : 'Mark done'}
        </button>
        <button onClick={edit}>Edit</button>
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
