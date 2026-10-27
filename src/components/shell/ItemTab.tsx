import { rowTap } from '../../rowTap';
import { useEffect, useRef, useState } from 'react';
import { useNav, type PanelView } from '../../nav';
import { getTasks, getTask, toggleTask, toggleSubtask, deleteTask, snapshotTasks, restoreTasks, getLists, saveTask, type Task } from '../../tasks';
import { projectOf, linkedIds, linkMilestone, getProject, saveProject, deleteProject, snapshotProjects, restoreProjects, projectPercent, projectCountLabel, projectProgress, type Project, type LinkKind } from '../../projects';
import { getGoals, saveGoal, deleteGoal, snapshotGoals, restoreGoals, goalPct, goalCount, goalPace, isActiveGoal, GOAL_STATUS_LABEL, goalLinkedIds, goalOf, linkToGoal, unlinkFromGoal, type Goal, type GoalStatus } from '../../goals';
import { getNote, titleOf } from '../../notes';
import { useGoalAdd } from '../GoalAdd';
import { sortMilestones, newMilestone } from '../../milestones';
import { dueLabel } from '../../pages/GoalsPage';
import { fmtShort, fmtTime, repLabel } from '../../quickadd';
import { setFocus, onDataChange, dataChanged, askEumae, takeOfficeEdit, takeOfficeView, onOfficeEdit, keepFresh, discardFresh, type Focus, type OfficeKind } from '../../focus';
import { getEvent, saveEvent, ymd, importanceOf, IMPORTANCE_LABEL, EVENT_IMPORTANCE, EVENT_TYPES, type CalEvent, type EventType, type EventImportance } from '../../events';
import { removeEvent, TYPE_LABEL } from '../QuickAdd';
import { MilestonesEditor } from '../Milestones';
import { ItemActs, applyLinks, currentLinks, type Links } from './ItemEdit';
import { KV, TextIn, DateIn, TimeIn, NumIn, Pick, LinkRows, WeekDays, EditActs } from './ItemFields';
import { ItemMenu } from '../ItemMenu';
import { rowsOf } from '../../pages/ProjectPage';
import { itemsOn, minsToTm } from '../../pages/CalendarPage';
import { evKind } from './Timeline';
import { isOverdue, hasEnded, daysLeft } from '../../due';
import { AttendAsk } from './Attend';
import { getFlow, saveFlow, deleteFlow, snapshotFlows, restoreFlows, toggleFlowStep, setFlowStep, toggleFlowToday, doneToday, isDoneToday, isScheduledOn, scheduleLabel, daysLabel, streakLabel, lastDone, todayYmd, fmt12, KIND_LABEL, type Flow, type FlowKind } from '../../flows';

/** "Edit" from a row's ⋯ menu opens this tab already in edit mode. */

/** Cancel on a brand-new item throws it away and closes the office:
 *  it never existed, so there is nothing left to show. */
function useCancelFresh(): () => void {
  const { closePanel } = useNav();
  return () => { if (discardFresh()) closePanel(); };
}

function useOfficeEdit(k: OfficeKind, id: string, start: () => void, view?: () => void) {
  const ref = useRef(start);
  ref.current = start;
  const vref = useRef(view);
  vref.current = view;
  useEffect(() => {
    const check = () => {
      if (takeOfficeView(k, id)) vref.current?.();
      if (takeOfficeEdit(k, id)) ref.current();
    };
    check();
    return onOfficeEdit(check);
  }, [k, id]);
}

/** "Ask Eumae" sends a ready question into the office's Eumae chat (his call, Oct 21). */
function useAsk(onView: (v: PanelView) => void, focus: Focus) {
  return (q: string) => {
    void focus;
    askEumae(q);
    onView('eumae');
  };
}

/** The tapped item's own tab in Eumae's office: what it is, its details, its
 *  steps, and the moves you'd make on it. Read-only first; Edit turns each
 *  row's value into an input in place (his correction, Oct 21 4:22 PM), Delete sits beside it. */
export function ItemTab({ focus, onView }: { focus: Focus; onView: (v: PanelView) => void }) {
  if (focus.k === 'day') return <DayTab day={focus.id} />;
  if (focus.k === 'goal') return <GoalTab focus={focus} onView={onView} />;
  if (focus.k === 'project') return <ProjectTab focus={focus} onView={onView} />;
  if (focus.k === 'flow') return <FlowTab focus={focus} onView={onView} />;
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
  const cancelFresh = useCancelFresh();
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
    keepFresh('event', ev.id!);
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
        {editing ? <EditActs onDone={done} onCancel={() => { setDraft(null); cancelFresh(); }} /> : <ItemActs onEdit={edit} onDelete={() => del('all')} onDeleteOne={ev.rep ? () => del('one') : undefined} />}
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
        <div className="itEumae">
          <span className="n">Eumae</span>
          <span>Want to prep for this? Ask me for talking points or what to bring.</span>
          <button className="fact" onClick={() => ask(`Help me prep for "${ev.t}" (${dayWord}). Give me talking points and what to bring.`)}>Ask Eumae</button>
        </div>
      )}
    </div>
  );
}

function TaskTab({ focus, onView }: { focus: Focus; onView: (v: PanelView) => void }) {
  const cancelFresh = useCancelFresh();
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
    keepFresh('task', t.id);
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
        {editing ? <EditActs onDone={done} onCancel={() => { setDraft(null); cancelFresh(); }} /> : <ItemActs onEdit={edit} onDelete={del} />}
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
        <div className="itEumae">
          <span className="n">Eumae</span>
          <span>Want help with this one? Ask me to break it into steps or plan when to do it.</span>
          <button className="fact" onClick={() => ask(`Help me with my task "${t.t}"${t.due ? ` (due ${dueWord}${t.tm ? ' ' + fmtTime(t.tm) : ''})` : ''}. Break it into steps or plan when to do it.`)}>Ask Eumae</button>
        </div>
      )}
    </div>
  );
}

function GoalTab({ focus, onView }: { focus: Focus; onView: (v: PanelView) => void }) {
  const cancelFresh = useCancelFresh();
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
    keepFresh('goal', g.id);
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
        {editing ? <EditActs onDone={done} onCancel={() => { setDraft(null); cancelFresh(); }} /> : <ItemActs onEdit={edit} onDelete={del} />}
      </div>
      {editing ? (
        <>
          <textarea className="itIn itArea itWhyIn" rows={2} aria-label="Why it matters" placeholder="Why it matters" value={e.d} onChange={(x) => set({ d: x.target.value })} />
        </>
      ) : (
        <>{g.d ? <p className="itNote itWhy">{g.d}</p> : <div style={{ height: 8 }} />}</>
      )}
      <span className="gBar itBar">
        <i style={{ width: `${Math.min(100, pct)}%` }} />
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
          <button className="ft tlT" onClick={() => (r.k === 'note' ? onView('eumae') : setFocus({ k: r.k, id: r.id }))}>
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
      <div className="itEumae">
        <span className="n">Eumae</span>
        <span>{!tasks.length && !evs.length && !ms.length ? 'Nothing serves this goal yet. Ask me for a first small step.' : 'Stuck or behind? Ask me for the next small step.'}</span>
        <button className="fact" onClick={() => ask(`Help me with my goal "${g.t}" (${pct}%${count ? ', ' + count : ''}${pace === 'behind' ? ', behind pace' : ''}). What's the next small step?`)}>Ask Eumae</button>
      </div>
      </>
      )}
    </div>
  );
}

/* A project's office tab, built row for row like the Task, Goal and Event
   tabs (his call, Oct 22, 12:08 AM): title with Edit · Delete, then plain
   label · value rows, then Phases (his rename, Oct 22) as numbered rows the way a task shows
   Steps. Edit turns each row into its input in place; milestones get a name
   input, a date and ×, plus an "Add a milestone" row, like task steps. */
const PJ_KINDS: [LinkKind, string][] = [['task', 'Tasks'], ['event', 'Events'], ['goal', 'Goals'], ['note', 'Notes'], ['file', 'Files']];
function ProjectTab({ focus, onView }: { focus: Focus; onView: (v: PanelView) => void }) {
  const cancelFresh = useCancelFresh();
  const { notify, go } = useNav();
  const [draft, setDraft] = useState<Project | null>(null);
  const [newMs, setNewMs] = useState({ t: '', d: '' });
  useEffect(() => setDraft(null), [focus.id]);
  const startEdit = (x: Project) => {
    setNewMs({ t: '', d: '' });
    setDraft({ ...x, ms: (x.ms ?? []).map((m) => ({ ...m })) });
  };
  useOfficeEdit(
    'project',
    focus.id,
    () => {
      const x = getProject(focus.id);
      if (x) startEdit(x);
    },
    () => setDraft(null),
  );
  const ask = useAsk(onView, focus);
  const [, setTick] = useState(0);
  useEffect(() => onDataChange(() => setTick((n) => n + 1)), []);
  const refresh = () => setTick((n) => n + 1);
  const p = getProject(focus.id);
  if (!p) {
    return (
      <div className="oEmpty">
        <span className="ft">That project is gone</span>
        <p className="oIntro">It was deleted. Pick another one.</p>
      </div>
    );
  }
  const editing = !!draft;
  const e = draft ?? p;
  const set = (x: Partial<Project>) => setDraft({ ...(draft ?? p), ...x });
  const pct = projectPercent(p);
  const { done: nDone, total } = projectProgress(p);
  const ms = editing ? (e.ms ?? []) : sortMilestones(p.ms ?? []);
  const firstOpen = ms.findIndex((m) => !m.done);
  const next = sortMilestones(p.ms ?? []).find((m) => !m.done);
  const allDone = !!p.ms?.length && !next;
  const left = p.due ? daysLeft(p.due) : null;
  const nextLeft = next?.d ? daysLeft(next.d) : null;
  const counts = PJ_KINDS.map(([k, label]) => ({ k, label, n: linkedIds(p.id, k).length })).filter((c) => c.n);
  /* Everything in the project, so the tab holds all of it (his ask, Oct 22):
     each phase lists its own items, the rest sit under "Not in a phase".
     The kind is a pill beside the date, never a label in front. */
  const items = PJ_KINDS.flatMap(([k]) => {
    const ids = linkedIds(p.id, k);
    return rowsOf(k)
      .filter((x) => ids.includes(x.id))
      .map((x) => ({ ...x, k, m: linkMilestone(p, k, x.id) ?? '' }));
  });
  const openItem = (k: LinkKind, rid: string) => {
    if (k === 'note') return go('note', rid);
    if (k === 'file') return go('view', rid);
    const ev = k === 'event' ? getEvent(rid) : undefined;
    setFocus({ k, id: rid, ...(ev ? { day: ev.d } : {}) });
  };
  const itemRow = (x: (typeof items)[number]) => (
    <div key={x.k + x.id} className="frow itStep pjOffRow tapRow" onClick={rowTap(() => openItem(x.k, x.id))}>
      {x.k === 'task' ? (
        <button
          className={'fchk' + (x.done ? ' on' : '')}
          aria-label={x.done ? `Reopen ${x.label}` : `Done: ${x.label}`}
          onClick={() => {
            toggleTask(x.id);
            refresh();
            dataChanged();
          }}
        />
      ) : (
        <span className="pjLead" aria-hidden />
      )}
      <span className={'ft' + (x.done ? ' tlDone' : '')}>{x.label}</span>
      {x.sub ? <span className="fmeta">{x.sub}</span> : null}
    </div>
  );
  /* One list per kind under its own heading, inside each phase. */
  const byKind = (rows: typeof items) =>
    PJ_KINDS.map(([k, label]) => {
      const rs = rows.filter((x) => x.k === k);
      return rs.length ? (
        <div key={k} className="pjKindList">
          <div className="pjKindH pjOffH">
            {label} <span>{rs.length}</span>
          </div>
          {rs.map(itemRow)}
        </div>
      ) : null;
    });
  /* Same layout as the project page (his call, Oct 22): goals on top,
     phases hold tasks and events, notes and files under Reference. */
  const isStep = (x: (typeof items)[number]) => x.k === 'task' || x.k === 'event';
  const loose = items.filter((x) => isStep(x) && (!x.m || !(p.ms ?? []).some((m) => m.id === x.m)));
  const pGoals = items.filter((x) => x.k === 'goal');
  const pRefs = items.filter((x) => x.k === 'note' || x.k === 'file');
  const added = new Date(p.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  const save = () => {
    if (!draft || !draft.n.trim()) return;
    const before = p;
    const extra = newMs.t.trim() ? [newMilestone(newMs.t.trim().slice(0, 60), newMs.d)] : [];
    const out = [...(draft.ms ?? []), ...extra].map((m) => ({ ...m, t: m.t.trim() })).filter((m) => m.t);
    saveProject({ ...(getProject(p.id) ?? p), n: draft.n.trim().slice(0, 48), d: draft.d.trim().slice(0, 280), due: draft.due || undefined, ms: out });
    setDraft(null);
    refresh();
    dataChanged();
    notify('Project saved.', { undo: () => { saveProject(before); refresh(); dataChanged(); } });
  };
  const del = () => {
    const snap = snapshotProjects();
    deleteProject(p.id);
    setFocus(null);
    dataChanged();
    notify(`Deleted ${p.n}.`, {
      undo: () => {
        restoreProjects(snap);
        dataChanged();
        setFocus({ k: 'project', id: p.id });
      },
    });
  };
  const tick = (id: string) => {
    const before = p;
    const m = (p.ms ?? []).find((x) => x.id === id);
    saveProject({ ...p, ms: (p.ms ?? []).map((x) => (x.id === id ? { ...x, done: !x.done } : x)) });
    refresh();
    dataChanged();
    notify(m?.done ? 'Phase reopened.' : 'Phase done.', { undo: () => { saveProject(before); refresh(); dataChanged(); } });
  };
  const patchMs = (id: string, x: Partial<{ t: string; d: string }>) => set({ ms: (e.ms ?? []).map((m) => (m.id === id ? { ...m, ...x } : m)) });

  return (
    <div className="itab">
      <div className="itHead">
        {editing ? (
          <input className="itIn itTIn" aria-label="Project name" value={e.n} onChange={(x) => set({ n: x.target.value })} />
        ) : (
          <h2 className="itT">{p.n}</h2>
        )}
        {editing ? <EditActs onDone={save} onCancel={() => { setDraft(null); cancelFresh(); }} /> : <ItemActs onEdit={() => startEdit(p)} onDelete={del} />}
      </div>
      <p className="fmeta itSub">
        Added {added}
        {total ? ` · ${nDone} of ${total} done · ${pct}%` : ''}
      </p>
      <KV k="About" v={p.d} edit={editing ? <TextIn label="What this project is for" placeholder="What it's for" value={e.d} onChange={(d) => set({ d })} /> : undefined} />
      <KV
        k="Deadline"
        v={p.due ? fmtShort(p.due) + (left ? ' · ' + left.text : '') : ''}
        cls={left?.red ? 'over' : undefined}
        edit={editing ? <DateIn label="Deadline" value={e.due ?? ''} onChange={(due) => set({ due })} /> : undefined}
      />
      {editing ? null : <KV k="Current phase" v={next ? (nextLeft ? `${next.t} · ${nextLeft.text}` : next.t) : allDone ? 'All done' : ''} cls={nextLeft?.red ? 'over' : undefined} />}
      {editing ? null : <KV k="In it" v={counts.map((c) => `${c.n} ${c.n === 1 ? c.label.slice(0, -1).toLowerCase() : c.label.toLowerCase()}`).join(' · ')} />}
      {!editing && pGoals.length ? (
        <>
          <div className="flbl">Goals</div>
          {pGoals.map(itemRow)}
        </>
      ) : null}
      {ms.length || editing ? (
        <>
          <div className="flbl">Phases</div>
          {ms.map((m, i) =>
            editing ? (
              <div key={m.id} className="frow itStep">
                <span className={'itNum' + (m.done ? ' on' : '')}>{m.done ? '\u2713' : i + 1}</span>
                <input className="itIn itStepIn" aria-label={`Phase ${i + 1}`} value={m.t} onChange={(x) => patchMs(m.id, { t: x.target.value })} />
                <DateIn label={`Phase ${i + 1} date`} value={m.d} onChange={(d) => patchMs(m.id, { d })} />
                <button className="fb gho" aria-label={`Remove ${m.t}`} onClick={() => set({ ms: (e.ms ?? []).filter((x) => x.id !== m.id) })}>
                  ×
                </button>
              </div>
            ) : (
              <div key={m.id} className="pjOffPhase">
                <div className={'frow itStep' + (i === firstOpen ? ' cur' : '')}>
                  <button className={'itNum' + (m.done ? ' on' : '')} aria-label={m.done ? `Reopen ${m.t}` : `Done: ${m.t}`} onClick={() => tick(m.id)}>
                    {m.done ? '\u2713' : i + 1}
                  </button>
                  <span className={'ft' + (m.done ? ' tlDone' : '')}>{m.t}</span>
                  {m.d ? <span className="fmeta">{fmtShort(m.d)}</span> : null}
                </div>
                {byKind(items.filter((x) => x.m === m.id && (x.k === 'task' || x.k === 'event')))}
              </div>
            ),
          )}
          {editing ? (
            <div className="frow itStep">
              <span className="itNum">+</span>
              <input
                className="itIn itStepIn"
                aria-label="Add a phase"
                placeholder="Add a phase"
                value={newMs.t}
                onChange={(x) => setNewMs({ ...newMs, t: x.target.value })}
                onKeyDown={(x) => {
                  if (x.key === 'Enter' && newMs.t.trim()) {
                    set({ ms: [...(e.ms ?? []), newMilestone(newMs.t.trim().slice(0, 60), newMs.d)] });
                    setNewMs({ t: '', d: '' });
                  }
                }}
              />
              <DateIn label="New phase date" value={newMs.d} onChange={(d) => setNewMs({ ...newMs, d })} />
            </div>
          ) : null}
        </>
      ) : null}
      {!editing && loose.length ? (
        <>
          <div className="flbl">{ms.length ? 'Not in a phase' : 'Tasks and events'}</div>
          {byKind(loose)}
        </>
      ) : null}
      {!editing && pRefs.length ? (
        <>
          <div className="flbl">Reference</div>
          {byKind(pRefs)}
        </>
      ) : null}
      {editing ? null : (
        <div className="itEumae">
          <span className="n">Eumae</span>
          <span>{total ? 'Want the next step, or a plan to the deadline?' : 'Nothing in here yet. Ask me to break it into phases and steps.'}</span>
          <button className="fact" onClick={() => ask(`Help me with my project "${p.n}" (${projectCountLabel(p)}${p.due ? ', deadline ' + p.due : ''}). What should I do next?`)}>Ask Eumae</button>
        </div>
      )}
    </div>
  );
}

/* A habit, routine or flow in its own office tab. The person runs it; this
   tab keeps today's checks, the schedule and the steps. Read-only first;
   Edit turns each row into an input in place (no form swap), Done saves with
   the Undo pill. Start walks the steps one at a time. */
function FlowTab({ focus, onView }: { focus: Focus; onView: (v: PanelView) => void }) {
  const cancelFresh = useCancelFresh();
  const { notify } = useNav();
  const [draft, setDraft] = useState<Flow | null>(null);
  const [newStep, setNewStep] = useState('');
  /* Start mode: the step on screen, or 'end' for the wrap-up. */
  const [run, setRun] = useState<number | 'end' | null>(null);
  useEffect(() => {
    setDraft(null);
    setRun(null);
  }, [focus.id]);
  useOfficeEdit('flow', focus.id, () => {
    const x = getFlow(focus.id);
    if (!x) return;
    setRun(null);
    setDraft({ ...x, steps: [...x.steps], days: [...x.days] });
  }, () => setDraft(null));
  const ask = useAsk(onView, focus);
  const [, setTick] = useState(0);
  useEffect(() => onDataChange(() => setTick((n) => n + 1)), []);
  const refresh = () => setTick((n) => n + 1);
  const f = getFlow(focus.id);
  if (!f) {
    return (
      <div className="oEmpty">
        <span className="ft">That one is gone</span>
        <p className="oIntro">It was deleted. Pick another one.</p>
      </div>
    );
  }
  const word = KIND_LABEL[f.kind].toLowerCase();
  const editing = !!draft;
  const e = draft ?? f;
  const set = (p: Partial<Flow>) => setDraft({ ...(draft ?? f), ...p });
  const habit = f.kind === 'habit';
  const checks = doneToday(f);
  const total = f.steps.length;
  const streak = streakLabel(f);
  const last = lastDone(f);
  const todayOn = isScheduledOn(f, new Date());

  const edit = () => {
    setRun(null);
    setDraft({ ...f, steps: [...f.steps], days: [...f.days] });
  };
  const done = () => {
    if (!draft || !draft.n.trim()) return;
    const before = f;
    const steps = [...draft.steps, newStep].map((s) => s.trim()).filter(Boolean);
    /* Steps that moved keep their check only if the text is the same. */
    const keep = doneToday(f)
      .map((i) => steps.indexOf(f.steps[i]))
      .filter((i) => i >= 0);
    const next: Flow = { ...draft, n: draft.n.trim().slice(0, 60), steps, done: keep, doneOn: keep.length ? todayYmd() : f.doneOn, example: false };
    if (!next.tm) delete next.tm;
    saveFlow(next);
    keepFresh('flow', f.id);
    setDraft(null);
    setNewStep('');
    dataChanged();
    notify(`${KIND_LABEL[next.kind]} saved.`, { undo: () => { saveFlow(before); dataChanged(); } });
  };
  const del = () => {
    const snap = snapshotFlows();
    deleteFlow(f.id);
    setFocus(null);
    dataChanged();
    notify(`${KIND_LABEL[f.kind]} deleted.`, {
      undo: () => {
        restoreFlows(snap);
        dataChanged();
        setFocus({ k: 'flow', id: f.id });
      },
    });
  };
  const toggle = (i: number) => {
    toggleFlowStep(f.id, i);
    refresh();
    dataChanged();
  };
  const checkHabit = () => {
    const before = f;
    const was = isDoneToday(f);
    toggleFlowToday(f.id);
    refresh();
    dataChanged();
    if (!was) notify(`${f.n}: done for today.`, { undo: () => { saveFlow(before); dataChanged(); } });
  };
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= e.steps.length) return;
    const s = [...e.steps];
    [s[i], s[j]] = [s[j], s[i]];
    set({ steps: s });
  };

  /* ── Start mode: one step at a time. ── */
  if (run !== null && !editing && total) {
    const fin = run === 'end';
    const i = fin ? total - 1 : run;
    const nextOpen = (from: number) => {
      const now = doneToday(getFlow(f.id) ?? f);
      for (let k = from; k < total; k++) if (!now.includes(k)) return k;
      return 'end' as const;
    };
    if (fin) {
      const all = checks.length >= total;
      return (
        <div className="itab">
          <p className="fmeta itSub">{f.n}</p>
          <h2 className="itT">{all ? 'All done' : `${checks.length} of ${total} done`}</h2>
          <p className="oIntro">
            {all
              ? streak
                ? `${streak}. Nice work.`
                : 'Nice work. That counts for today.'
              : 'Some steps are still open. Come back to them, or call it a day.'}
          </p>
          <div className="itActs">
            <button className="pri" onClick={() => setRun(null)}>Close</button>
            {!all ? <button onClick={() => setRun(nextOpen(0))}>Open steps</button> : null}
          </div>
        </div>
      );
    }
    const isOn = checks.includes(i);
    return (
      <div className="itab">
        <p className="fmeta itSub">
          {f.n} · Step {i + 1} of {total}
        </p>
        <span className="gBar itBar">
          <i style={{ width: `${Math.round((checks.length / total) * 100)}%` }} />
        </span>
        <h2 className={'itT' + (isOn ? ' tlDone' : '')} style={{ margin: '22px 0 6px' }}>
          {f.steps[i]}
        </h2>
        <div className="itActs">
          <button
            className="pri"
            onClick={() => {
              setFlowStep(f.id, i, true);
              dataChanged();
              setRun(i + 1 < total ? i + 1 : 'end');
            }}
          >
            Done
          </button>
          <button onClick={() => setRun(i + 1 < total ? i + 1 : 'end')}>Skip</button>
          <button disabled={i === 0} onClick={() => setRun(i - 1)}>Back</button>
        </div>
        <button className="fact" onClick={() => setRun(null)}>Stop for now</button>
      </div>
    );
  }

  return (
    <div className="itab">
      <div className="itHead">
        {editing ? (
          <input className="itIn itTIn" aria-label="Name" value={e.n} onChange={(x) => set({ n: x.target.value })} />
        ) : (
          <h2 className="itT">{f.n}</h2>
        )}
        {editing ? <EditActs onDone={done} onCancel={() => { setDraft(null); setNewStep(''); cancelFresh(); }} /> : <ItemActs onEdit={edit} onDelete={del} />}
      </div>
      <p className="fmeta itSub">
        {KIND_LABEL[f.kind]} · {scheduleLabel(f)}
        {streak ? ' · ' + streak : ''}
      </p>
      {!habit && total > 0 && !editing ? (
        <>
          <span className="gBar itBar">
            <i style={{ width: `${Math.round((checks.length / total) * 100)}%` }} />
          </span>
          <p className="fmeta itSub">
            {checks.length}/{total} steps today{todayOn ? '' : ' · not on today’s schedule'}
          </p>
          <div className="itActs">
            <button className="pri" onClick={() => {
              const first = f.steps.findIndex((_, k) => !checks.includes(k));
              setRun(first >= 0 ? first : 0);
            }}>
              {checks.length >= total ? 'Start again' : checks.length ? 'Continue' : 'Start'}
            </button>
          </div>
        </>
      ) : null}
      {habit && !editing ? (
        <div className="frow itStep cur" style={{ marginTop: 8 }}>
          <button className={'itNum' + (isDoneToday(f) ? ' on' : '')} aria-label={isDoneToday(f) ? `Not done yet: ${f.n}` : `Done today: ${f.n}`} onClick={checkHabit}>
            {isDoneToday(f) ? '✓' : ''}
          </button>
          <span className="ft">{isDoneToday(f) ? 'Done today' : todayOn ? 'Not done yet today' : 'Not on today’s schedule'}</span>
        </div>
      ) : null}
      <KV
        k="Kind"
        v={KIND_LABEL[f.kind]}
        edit={editing ? <Pick label="Kind" value={e.kind} options={(['habit', 'routine', 'flow'] as const).map((k) => [k, KIND_LABEL[k]] as [FlowKind, string])} onChange={(kind) => set({ kind })} /> : undefined}
      />
      <KV
        k="Days"
        v={daysLabel(f.kind, f.days)}
        edit={
          editing ? (
            <span className="itPair">
              <WeekDays days={e.days} onChange={(d) => set({ days: d ?? [] })} />
            </span>
          ) : undefined
        }
      />
      {editing ? <p className="fmeta itSub">{e.days.length ? daysLabel(e.kind, e.days) : e.kind === 'flow' ? 'No days picked: on demand, whenever you need it.' : 'No days picked: every day.'}</p> : null}
      <KV k="Time" v={f.tm ? fmt12(f.tm) : ''} edit={editing ? <TimeIn label="Time" value={e.tm ?? ''} onChange={(v) => set({ tm: v || undefined })} /> : undefined} />
      {editing ? null : <KV k="Last done" v={last ? (last === todayYmd() ? 'Today' : fmtShort(last)) : ''} />}
      {editing || !habit || total > 0 ? (
        <>
          <div className="flbl">
            Steps{!editing && total ? <span>{checks.length}/{total} today</span> : null}
          </div>
          {(editing ? e.steps : f.steps).map((s, i) =>
            editing ? (
              <div key={i} className="frow itStep">
                <span className="itNum">{i + 1}</span>
                <input className="itIn itStepIn" aria-label={`Step ${i + 1}`} value={s} onChange={(x) => set({ steps: e.steps.map((y, j) => (j === i ? x.target.value : y)) })} />
                <button className="fb gho" aria-label={`Move step ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                  ↑
                </button>
                <button className="fb gho" aria-label={`Move step ${i + 1} down`} disabled={i === e.steps.length - 1} onClick={() => move(i, 1)}>
                  ↓
                </button>
                <button className="fb gho" aria-label={`Remove step ${i + 1}`} onClick={() => set({ steps: e.steps.filter((_, j) => j !== i) })}>
                  ×
                </button>
              </div>
            ) : (
              <div key={i} className={'frow itStep' + (i === f.steps.findIndex((_, k) => !checks.includes(k)) ? ' cur' : '')}>
                <button className={'itNum' + (checks.includes(i) ? ' on' : '')} aria-label={checks.includes(i) ? `Reopen ${s}` : `Done: ${s}`} onClick={() => toggle(i)}>
                  {checks.includes(i) ? '✓' : i + 1}
                </button>
                <span className={'ft' + (checks.includes(i) ? ' tlDone' : '')}>{s}</span>
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
                    set({ steps: [...e.steps, newStep.trim()] });
                    setNewStep('');
                  }
                }}
              />
            </div>
          ) : !total ? (
            <p className="oIntro">No steps yet. Tap Edit to write them down.</p>
          ) : null}
        </>
      ) : null}
      {editing ? null : (
        <div className="itEumae">
          <span className="n">Eumae</span>
          <span>You run this {word}. Want help shaping it? I can suggest steps or a better time.</span>
          <button className="fact" onClick={() => ask(`Help me shape my ${word} "${f.n}" (${scheduleLabel(f)})${total ? `. Steps: ${f.steps.join('; ')}` : ''}. Suggest clearer steps or a better time. I run it myself.`)}>
            Ask Eumae
          </button>
        </div>
      )}
    </div>
  );
}
