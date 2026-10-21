import { rowTap } from '../../rowTap';
import { useEffect, useRef, useState } from 'react';
import { useNav, type PanelView } from '../../nav';
import { getTasks, getTask, toggleTask, toggleSubtask, deleteTask, snapshotTasks, restoreTasks, getLists, saveTask, type Task } from '../../tasks';
import { projectOf, linkedIds } from '../../projects';
import { getGoals, saveGoal, deleteGoal, snapshotGoals, restoreGoals, goalPct, goalCount, goalPace, isActiveGoal, GOAL_STATUS_LABEL, goalLinkedIds, goalOf, linkToGoal, unlinkFromGoal, type Goal, type GoalStatus } from '../../goals';
import { getNote, titleOf } from '../../notes';
import { useGoalAdd } from '../GoalAdd';
import { sortMilestones } from '../../milestones';
import { dueLabel } from '../../pages/GoalsPage';
import { fmtShort, fmtTime, repLabel } from '../../quickadd';
import { setFocus, onDataChange, dataChanged, askMae, takeOfficeEdit, onOfficeEdit, type Focus } from '../../focus';
import { getEvent, saveEvent, ymd, importanceOf, IMPORTANCE_LABEL, EVENT_IMPORTANCE, EVENT_TYPES, type CalEvent, type EventType, type EventImportance } from '../../events';
import { removeEvent, TYPE_LABEL } from '../QuickAdd';
import { MilestonesEditor } from '../Milestones';
import { ItemActs, applyLinks, currentLinks, type Links } from './ItemEdit';
import { KV, TextIn, DateIn, TimeIn, NumIn, Pick, LinkRows, WeekDays, EditActs } from './ItemFields';
import { ItemMenu } from '../ItemMenu';
import { itemsOn, minsToTm } from '../../pages/CalendarPage';
import { evKind } from './Timeline';
import { isOverdue, hasEnded } from '../../due';
import { AttendAsk } from './Attend';

/** "Edit" from a row's ⋯ menu opens this tab already in edit mode. */
function useOfficeEdit(k: 'task' | 'event' | 'goal', id: string, start: () => void) {
  const ref = useRef(start);
  ref.current = start;
  useEffect(() => {
    const check = () => {
      if (takeOfficeEdit(k, id)) ref.current();
    };
    check();
    return onOfficeEdit(check);
  }, [k, id]);
}

/** "Ask Mae" sends a ready question into the office's Mae chat (his call, Oct 21). */
function useAsk(onView: (v: PanelView) => void, focus: Focus) {
  return (q: string) => {
    void focus;
    askMae(q);
    onView('mae');
  };
}

/** The tapped item's own tab in Mae's office: what it is, its details, its
 *  steps, and the moves you'd make on it. Read-only first; Edit turns each
 *  row's value into an input in place (his correction, Oct 21 4:22 PM), Delete sits beside it. */
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
        <div
          key={it.key}
          className={'frow top agRow2 tapRow c-' + it.color + (it.done ? ' past' : '')}
          onClick={(e) => {
            const el = e.currentTarget;
            rowTap(() => el.querySelector<HTMLButtonElement>('.tlT')?.click())(e);
          }}
        >
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
  const [draft, setDraft] = useState<CalEvent | null>(null);
  const [links, setLinks] = useState<Links>({ project: '', goal: '' });
  useEffect(() => setDraft(null), [focus.id]);
  useOfficeEdit('event', focus.id, () => {
    const x = getEvent(focus.id);
    if (!x) return;
    setLinks(currentLinks('event', x.id!));
    setDraft({ ...x });
  });
  const ask = useAsk(onView, focus);
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
  const editing = !!draft;
  const e = draft ?? ev;
  const set = (p: Partial<CalEvent>) => setDraft({ ...(draft ?? ev), ...p });
  const d = focus.day ?? ev.d;
  const today = ymd(new Date());
  const tmw = new Date();
  tmw.setDate(tmw.getDate() + 1);
  const dayWord =
    d === today ? 'Today' : d === ymd(tmw) ? 'Tomorrow' : new Date(d + 'T12:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  const ended = !ev.example && !!ev.id && hasEnded(ev, d);
  const project = projectOf('event', ev.id!);
  const evGoal = goalOf('event', ev.id!);
  const edit = () => {
    setLinks(currentLinks('event', ev.id!));
    setDraft({ ...ev });
  };
  const done = () => {
    if (!draft) return;
    if (!draft.t.trim()) return;
    const before = ev;
    const next: CalEvent = { ...draft, t: draft.t.trim(), loc: draft.loc?.trim() || undefined, note: draft.note?.trim() || undefined, tm: draft.allDay ? '' : draft.tm || '12:00' };
    if (next.allDay || (next.end && next.end <= next.tm)) delete next.end;
    saveEvent(next);
    const undoLinks = applyLinks('event', ev.id!, links);
    setDraft(null);
    dataChanged();
    notify('Event updated.', { undo: () => { saveEvent(before); undoLinks(); dataChanged(); } });
  };
  const del = (scope: 'one' | 'all') => {
    setFocus(null);
    removeEvent(notify, ev, d, scope);
  };
  const rep = e.rep;
  return (
    <div className="itab">
      <div className="itHead">
        {editing ? (
          <input className="itIn itTIn" aria-label="Event name" value={e.t} onChange={(x) => set({ t: x.target.value })} />
        ) : (
          <h2 className="itT">{ev.t}</h2>
        )}
        {editing ? <EditActs onDone={done} onCancel={() => setDraft(null)} /> : <ItemActs onEdit={edit} onDelete={() => del('all')} onDeleteOne={ev.rep ? () => del('one') : undefined} />}
      </div>
      {d < today ? <p className="fmeta itSub">Past</p> : <div style={{ height: 8 }} />}
      {ended && !editing ? (
        <div className="itAttend">
          <AttendAsk ev={ev} day={d} onChange={() => setTick((n) => n + 1)} />
        </div>
      ) : null}
      <KV k={editing && ev.rep ? 'Series starts' : 'Date'} v={dayWord} edit={editing ? <DateIn label="Date" value={e.d} onChange={(v) => v && set({ d: v })} /> : undefined} />
      <KV
        k="All day"
        v={ev.allDay || !ev.tm ? 'Yes' : 'No'}
        edit={editing ? <Pick label="All day" value={e.allDay ? 'yes' : 'no'} options={[['no', 'No'], ['yes', 'Yes']]} onChange={(v) => set({ allDay: v === 'yes' || undefined })} /> : undefined}
      />
      {!(e.allDay || (!editing && !ev.tm)) ? (
        <>
          <KV k="Starts at" v={ev.tm ? fmtTime(ev.tm) : ''} edit={editing ? <TimeIn label="Start time" value={e.tm} onChange={(v) => set({ tm: v })} /> : undefined} />
          <KV k="Ends at" v={ev.end ? fmtTime(ev.end) : ''} edit={editing ? <TimeIn label="End time" value={e.end ?? ''} onChange={(v) => set({ end: v || undefined })} /> : undefined} />
        </>
      ) : null}
      <KV k="Location" v={ev.loc} edit={editing ? <TextIn label="Location" value={e.loc ?? ''} onChange={(v) => set({ loc: v })} /> : undefined} />
      <KV
        k="Repeats"
        v={ev.rep ? repLabel(ev.rep, ev.d) : 'No'}
        edit={
          editing ? (
            <Pick
              label="Repeats"
              value={rep?.f ?? 'none'}
              options={[['none', 'No'], ['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly']]}
              onChange={(f) => set({ rep: f === 'none' ? undefined : { ...(rep ?? {}), f } })}
            />
          ) : undefined
        }
      />
      {editing && rep?.f === 'weekly' ? (
        <KV k="On" edit={<WeekDays days={rep.days && rep.days.length ? rep.days : [new Date(e.d + 'T12:00').getDay()]} onChange={(days) => set({ rep: { ...rep, days } })} />} />
      ) : null}
      {editing && rep ? <KV k="Until" edit={<DateIn label="Repeat until" value={rep.until ?? ''} onChange={(v) => set({ rep: { ...rep, until: v || undefined } })} />} /> : null}
      <KV
        k="Kind"
        v={TYPE_LABEL[ev.type ?? 'other']}
        edit={editing ? <Pick label="Kind" value={e.type ?? 'other'} options={EVENT_TYPES.map((t) => [t, TYPE_LABEL[t]] as [EventType, string])} onChange={(type) => set({ type })} /> : undefined}
      />
      <KV
        k="Importance"
        v={IMPORTANCE_LABEL[importanceOf(ev)]}
        edit={editing ? <Pick label="Importance" value={importanceOf(e)} options={EVENT_IMPORTANCE.map((i) => [i, IMPORTANCE_LABEL[i]] as [EventImportance, string])} onChange={(imp) => set({ imp: imp === 'should' ? undefined : imp })} /> : undefined}
      />
      <LinkRows editing={editing} links={links} onLinks={setLinks} project={project?.n} goal={evGoal?.t} withGoal />
      <div className="flbl">Notes</div>
      {editing ? (
        <textarea className="itIn itArea" rows={3} aria-label="Notes" placeholder="None" value={e.note ?? ''} onChange={(x) => set({ note: x.target.value })} />
      ) : ev.note ? (
        <p className="itNote">{ev.note}</p>
      ) : (
        <p className="itNote itNone">None</p>
      )}
      {editing ? null : (
        <div className="itMae">
          <span className="n">Mae</span>
          <span>Want to prep for this? Ask me for talking points or what to bring.</span>
          <button className="fact" onClick={() => ask(`Help me prep for "${ev.t}" (${dayWord}). Give me talking points and what to bring.`)}>Ask Mae</button>
        </div>
      )}
    </div>
  );
}

function TaskTab({ focus, onView }: { focus: Focus; onView: (v: PanelView) => void }) {
  const { notify } = useNav();
  const [draft, setDraft] = useState<Task | null>(null);
  const [links, setLinks] = useState<Links>({ project: '', goal: '' });
  const [newStep, setNewStep] = useState('');
  useEffect(() => setDraft(null), [focus.id]);
  useOfficeEdit('task', focus.id, () => {
    const x = getTask(focus.id);
    if (!x) return;
    setLinks(currentLinks('task', x.id));
    setNewStep('');
    setDraft({ ...x, sub: (x.sub ?? []).map((s) => ({ ...s })) });
  });
  const ask = useAsk(onView, focus);
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
  const editing = !!draft;
  const e = draft ?? t;
  const set = (p: Partial<Task>) => setDraft({ ...(draft ?? t), ...p });
  const today = new Date();
  const ymdOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const tY = ymdOf(today);
  const tm = new Date(today);
  tm.setDate(tm.getDate() + 1);
  const dueWord = t.due ? (t.due === tY ? 'Today' : t.due === ymdOf(tm) ? 'Tomorrow' : fmtShort(t.due)) : 'Someday';
  const late = isOverdue(t);
  const project = projectOf('task', t.id);
  /* Its own goal first; else the goal of its project, as before. */
  const goalId = goalOf('task', t.id)?.id ?? (project ? linkedIds(project.id, 'goal')[0] : undefined);
  const goal = goalId ? getGoals().find((g) => g.id === goalId) : undefined;
  const lists = getLists();
  const list = lists.find((l) => l.id === (t.list ?? 'inbox'));
  const subs = e.sub ?? [];
  const firstOpen = subs.findIndex((s) => !s.d);
  const added = new Date(t.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

  const edit = () => {
    setLinks(currentLinks('task', t.id));
    setNewStep('');
    setDraft({ ...t, sub: (t.sub ?? []).map((s) => ({ ...s })) });
  };
  const done = () => {
    if (!draft || !draft.t.trim()) return;
    const before = t;
    const sub = [...(draft.sub ?? []), ...(newStep.trim() ? [{ t: newStep.trim(), d: 0 as const }] : [])].map((s) => ({ ...s, t: s.t.trim() })).filter((s) => s.t);
    const next: Task = { ...draft, t: draft.t.trim(), sub: sub.length ? sub : undefined };
    if (!next.due) {
      delete next.tm;
      next.rep = 'none';
      delete next.repDays;
      delete next.repUntil;
    }
    if (!next.rep || next.rep === 'none') {
      delete next.repDays;
      delete next.repUntil;
    }
    saveTask(next);
    const undoLinks = applyLinks('task', t.id, links);
    setDraft(null);
    dataChanged();
    notify('Task saved.', { undo: () => { saveTask(before); undoLinks(); dataChanged(); } });
  };
  const del = () => {
    const snap = snapshotTasks();
    deleteTask(t.id);
    setFocus(null);
    notify('Task deleted.', { undo: () => { restoreTasks(snap); setFocus({ k: 'task', id: t.id }); } });
  };
  const estWord = t.est ? (t.est >= 60 ? `${+(t.est / 60).toFixed(1)} h` : `${t.est} min`) : '';

  return (
    <div className="itab">
      <div className="itHead">
        {editing ? (
          <input className="itIn itTIn" aria-label="Task name" value={e.t} onChange={(x) => set({ t: x.target.value })} />
        ) : (
          <h2 className={'itT' + (t.d ? ' tlDone' : '')}>{t.t}</h2>
        )}
        {editing ? <EditActs onDone={done} onCancel={() => setDraft(null)} /> : <ItemActs onEdit={edit} onDelete={del} />}
      </div>
      <p className="fmeta itSub">
        Added {added}
        {t.d ? ' · done' : ''}
      </p>
      <KV k="Due" v={dueWord} cls={late ? 'over' : undefined} edit={editing ? <DateIn label="Due date" value={e.due ?? ''} onChange={(v) => set({ due: v || undefined })} /> : undefined} />
      <KV k="Time" v={t.due && t.tm ? fmtTime(t.tm) : ''} edit={editing ? <TimeIn label="Due time" value={e.tm ?? ''} disabled={!e.due} onChange={(v) => set({ tm: v || undefined })} /> : undefined} />
      <KV
        k="Priority"
        v={t.pr && t.pr !== 'none' ? cap(t.pr) : ''}
        edit={
          editing ? (
            <Pick label="Priority" value={e.pr ?? 'none'} options={[['none', 'None'], ['important', 'Important'], ['urgent', 'Urgent'], ['critical', 'Critical']]} onChange={(pr) => set({ pr })} />
          ) : undefined
        }
      />
      <KV
        k="Repeats"
        v={t.rep && t.rep !== 'none' ? cap(t.rep) : 'No'}
        edit={
          editing ? (
            <Pick label="Repeats" value={e.rep ?? 'none'} options={[['none', 'No'], ['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly']]} onChange={(rep) => set({ rep })} />
          ) : undefined
        }
      />
      {editing && e.rep === 'weekly' ? (
        <KV k="On" edit={<WeekDays days={e.repDays && e.repDays.length ? e.repDays : e.due ? [new Date(e.due + 'T12:00').getDay()] : []} onChange={(repDays) => set({ repDays })} />} />
      ) : null}
      {editing && e.rep && e.rep !== 'none' ? <KV k="Until" edit={<DateIn label="Repeat until" value={e.repUntil ?? ''} onChange={(v) => set({ repUntil: v || undefined })} />} /> : null}
      <KV k="Duration" v={estWord} edit={editing ? <span className="itPair"><NumIn label="Duration in minutes" value={e.est} onChange={(est) => set({ est })} /><span className="fmeta">min</span></span> : undefined} />
      <KV k="List" v={list?.n ?? 'Inbox'} edit={editing ? <Pick label="List" value={e.list ?? 'inbox'} options={lists.map((l) => [l.id, l.n] as [string, string])} onChange={(list) => set({ list })} /> : undefined} />
      <LinkRows editing={editing} links={links} onLinks={setLinks} project={project?.n} goal={goal?.t} withGoal />
      {subs.length || editing ? (
        <>
          <div className="flbl">Steps</div>
          {subs.map((s, i) =>
            editing ? (
              <div key={i} className="frow itStep">
                <span className={'itNum' + (s.d ? ' on' : '')}>{s.d ? '✓' : i + 1}</span>
                <input className="itIn itStepIn" aria-label={`Step ${i + 1}`} value={s.t} onChange={(x) => set({ sub: subs.map((y, j) => (j === i ? { ...y, t: x.target.value } : y)) })} />
                <button className="fb gho" aria-label={`Remove step ${i + 1}`} onClick={() => set({ sub: subs.filter((_, j) => j !== i) })}>
                  ×
                </button>
              </div>
            ) : (
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
            ),
          )}
          {editing ? (
            <div className="frow itStep">
              <span className="itNum">+</span>
              <input
                className="itIn itStepIn"
                aria-label="Add a step"
                placeholder="Add a step"
                value={newStep}
                onChange={(x) => setNewStep(x.target.value)}
                onKeyDown={(x) => {
                  if (x.key === 'Enter' && newStep.trim()) {
                    set({ sub: [...subs, { t: newStep.trim(), d: 0 }] });
                    setNewStep('');
                  }
                }}
              />
            </div>
          ) : null}
        </>
      ) : null}
      {editing ? null : (
        <div className="itMae">
          <span className="n">Mae</span>
          <span>Want help with this one? Ask me to break it into steps or plan when to do it.</span>
          <button className="fact" onClick={() => ask(`Help me with my task "${t.t}"${t.due ? ` (due ${dueWord}${t.tm ? ' ' + fmtTime(t.tm) : ''})` : ''}. Break it into steps or plan when to do it.`)}>Ask Mae</button>
        </div>
      )}
    </div>
  );
}

function GoalTab({ focus, onView }: { focus: Focus; onView: (v: PanelView) => void }) {
  const { notify } = useNav();
  const [draft, setDraft] = useState<Goal | null>(null);
  const [links, setLinks] = useState<Links>({ project: '', goal: '' });
  useEffect(() => setDraft(null), [focus.id]);
  useOfficeEdit('goal', focus.id, () => {
    const x = getGoals().find((y) => y.id === focus.id);
    if (!x) return;
    setLinks(currentLinks('goal', x.id));
    setDraft({ ...x, ms: (x.ms ?? []).map((m) => ({ ...m })) });
  });
  const ask = useAsk(onView, focus);
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

  const editing = !!draft;
  const e = draft ?? g;
  const set = (p: Partial<Goal>) => setDraft({ ...(draft ?? g), ...p });
  const statusOf = (x: Goal) => (x.st === 'not-started' ? 'in-progress' : x.st);
  const measure = g.tgt ? `${g.tgt}${g.unit ? ' ' + g.unit : ''}` : '';

  const edit = () => {
    setLinks(currentLinks('goal', g.id));
    setDraft({ ...g, ms: (g.ms ?? []).map((m) => ({ ...m })) });
  };
  const done = () => {
    if (!draft || !draft.t.trim()) return;
    const before = g;
    const out: Goal = { ...draft, t: draft.t.trim().slice(0, 120), d: draft.d.trim(), unit: (draft.unit ?? '').trim() || undefined };
    if (!out.tgt) {
      delete out.tgt;
      delete out.cur;
      delete out.unit;
    }
    if (!out.pace || !out.pace.n) delete out.pace;
    saveGoal(out);
    const undoLinks = applyLinks('goal', g.id, links);
    setDraft(null);
    dataChanged();
    notify('Goal saved.', { undo: () => { saveGoal(before); undoLinks(); dataChanged(); } });
  };
  const del = () => {
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
  };
  const step = (d: number) => {
    const cur = Math.max(0, (g.cur ?? 0) + d);
    put({ ...g, cur }, `${cur} of ${g.tgt}${g.unit ? ' ' + g.unit : ''}.`);
  };

  return (
    <div className="itab">
      <div className="itHead">
        {editing ? (
          <input className="itIn itTIn" aria-label="Goal" value={e.t} onChange={(x) => set({ t: x.target.value })} />
        ) : (
          <h2 className={'itT' + (g.st === 'completed' ? ' tlDone' : '')}>{g.t}</h2>
        )}
        {editing ? <EditActs onDone={done} onCancel={() => setDraft(null)} /> : <ItemActs onEdit={edit} onDelete={del} />}
      </div>
      {editing ? (
        <>
          <textarea className="itIn itArea itWhyIn" rows={2} aria-label="Why it matters" placeholder="Why it matters" value={e.d} onChange={(x) => set({ d: x.target.value })} />
        </>
      ) : (
        <>{g.d ? <p className="itNote itWhy">{g.d}</p> : <div style={{ height: 8 }} />}</>
      )}
      <span className="gBar itBar">
        <i style={{ width: `${pct}%` }} />
      </span>
      <p className="fmeta itSub">
        {pct}%{count ? ' · ' + count : ''}
        {pace === 'behind' ? <span className="over"> · Behind pace</span> : pace === 'on' ? ' · On track' : ''}
      </p>
      {g.tgt && isActiveGoal(g) && !editing ? (
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
      <KV
        k="Status"
        v={GOAL_STATUS_LABEL[statusOf(g)]}
        edit={
          editing ? (
            <Pick
              label="Status"
              value={statusOf(e)}
              options={(['in-progress', 'completed', 'let-go'] as const).map((st) => [st, GOAL_STATUS_LABEL[st]] as [GoalStatus, string])}
              onChange={(st) => set({ st })}
            />
          ) : undefined
        }
      />
      <KV
        k="Target date"
        v={g.td ? fmtShort(g.td) + (isActiveGoal(g) ? ' · ' + due.text.split(' · ').pop() : '') : ''}
        cls={due.red ? 'over' : undefined}
        edit={editing ? <DateIn label="Target date" value={e.td} onChange={(td) => set({ td })} /> : undefined}
      />
      <KV
        k="Measure"
        v={measure}
        edit={
          editing ? (
            <span className="itPair">
              <NumIn label="Target number" value={e.tgt} onChange={(tgt) => set({ tgt })} />
              <input className="itIn itUnit" aria-label="Unit" placeholder="clients" value={e.unit ?? ''} onChange={(x) => set({ unit: x.target.value.slice(0, 24) })} />
            </span>
          ) : undefined
        }
      />
      <KV
        k="Pace"
        v={g.pace ? `${g.pace.n} a ${g.pace.per}` : ''}
        edit={
          editing ? (
            <span className="itPair">
              <NumIn label="Pace" value={e.pace?.n} onChange={(n) => set({ pace: n ? { n, per: e.pace?.per ?? 'week' } : undefined })} />
              <span className="fmeta">a</span>
              <Pick label="Per" value={e.pace?.per ?? 'week'} options={[['week', 'week'], ['month', 'month']]} onChange={(per) => set({ pace: { n: e.pace?.n ?? 0, per } })} />
            </span>
          ) : undefined
        }
      />
      <LinkRows editing={editing} links={links} onLinks={setLinks} project={project?.n} withGoal={false} />
      {editing ? null : <KV k="Last change" v={last} />}
      {editing ? (
        <>
          <div className="flbl">Milestones</div>
          <MilestonesEditor value={e.ms ?? []} onChange={(ms) => set({ ms })} />
        </>
      ) : (
      <>
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
        <button className="fact" onClick={() => ask(`Help me with my goal "${g.t}" (${pct}%${count ? ', ' + count : ''}${pace === 'behind' ? ', behind pace' : ''}). What's the next small step?`)}>Ask Mae</button>
      </div>
      </>
      )}
    </div>
  );
}
