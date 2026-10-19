import { useEffect, useState } from 'react';
import { useNav } from '../../nav';
import { getTasks, toggleTask, createTask, saveTask, deleteTask, type Task } from '../../tasks';
import { dayEvents, ymd, mins, saveEvent, deleteEvent, type CalEvent } from '../../events';
import { parseQuick, fmtTime, guessType, type Quick } from '../../quickadd';
import { createNote, saveNote, deleteNote, getNotes, titleOf } from '../../notes';
import { quickToEvent } from '../QuickAdd';
import { Icon } from './icons';
import { logEv } from '../../log';
import { setFocus, onDataChange } from '../../focus';
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

/* Quick capture: one line, three kinds. The guess reads the words; the chip
   beside the box shows it and a tap changes it. Mae takes over the guessing
   once the backend lands. */
type Kind = 'task' | 'event' | 'note';
const KINDS: Kind[] = ['task', 'event', 'note'];
const KIND_LABEL: Record<Kind, string> = { task: 'Task', event: 'Event', note: 'Note' };
export function guessKind(raw: string, q: Quick): Kind {
  if (/^\s*(note|n)\s*:/i.test(raw)) return 'note';
  if (q.time && (guessType(q.title || raw) || q.end || q.loc)) return 'event';
  if (!q.time && raw.length > 80) return 'note';
  return 'task';
}

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
  const [text, setText] = useState('');
  const [pick, setPick] = useState<Kind | null>(null);
  const kind: Kind = pick ?? (text.trim() ? guessKind(text, parseQuick(text.trim())) : 'task');
  const [showEarlier, setShowEarlier] = useState(false);
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
  const overdue = open.filter((t) => t.due && t.due < today);
  const todayItems = itemsFor(today, all);
  const attention = todayItems.filter((i) => i.kind === 'task' && !i.task.d && !i.tm && URGENT.has(i.task.pr ?? ''));
  const timed = todayItems.filter((i) => i.tm && !attention.includes(i)).sort(byTime);
  const earlier = timed.filter((i) => mins(i.tm) < nowMin);
  const later = timed.filter((i) => mins(i.tm) >= nowMin);
  const anytime = todayItems.filter((i) => !i.tm && !attention.includes(i));
  const tmrw = itemsFor(tomorrow, open).sort(byTime);
  const notesToday = getNotes().filter((n) => ymd(new Date(n.createdAt)) === today);
  const earlierDone = earlier.filter((i) => i.kind === 'event' || i.task.d).length;

  const next = later.find((i) => i.kind === 'event' || !i.task.d);
  const first = overdue[0];

  const add = () => {
    const s = text.trim();
    if (!s) return;
    const k = kind;
    setText('');
    setPick(null);
    if (k === 'note') {
      const body = s.replace(/^\s*(note|n)\s*:\s*/i, '');
      const n = createNote(body.slice(0, 80));
      const safe = body.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
      saveNote({ ...n, body: `<div>${safe}</div>` });
      logEv({ area: 'Console', text: `Added note: ${body.slice(0, 60)}` });
      notify('Note saved.', { undo: () => { deleteNote(n.id); refresh(); } });
    } else if (k === 'event') {
      const q = parseQuick(s);
      const e = saveEvent(quickToEvent({ ...q, title: q.title || s, type: q.type ?? guessType(q.title || s) }, today));
      logEv({ area: 'Console', text: `Added event: ${e.t}` });
      notify('Event added.', { undo: () => { deleteEvent(e); refresh(); } });
    } else {
      const q = parseQuick(s);
      const t = createTask(q.title || s);
      saveTask({ ...t, due: q.date ?? today, tm: q.time, est: q.mins, pr: q.pr, list: q.list ?? t.list });
      logEv({ area: 'Console', text: `Added task: ${q.title || s}` });
      notify('Task added.', { undo: () => { deleteTask(t.id); refresh(); } });
    }
    refresh();
  };

  const done = (t: Task) => {
    toggleTask(t.id);
    if (!t.d) notify('Done.', { undo: () => { toggleTask(t.id); refresh(); } });
    refresh();
  };

  const move = (t: Task) => {
    const before = { ...t };
    saveTask({ ...t, due: tomorrow });
    notify('Moved to tomorrow.', { undo: () => { saveTask(before); refresh(); } });
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

  /* Agenda-style row (same as the Calendar): time on the left, the check
     or the event bar, the title, and what it is on the right. */
  const row = (i: Item, opts: { over?: boolean; past?: boolean; actions?: boolean } = {}) => {
    const isDone = i.kind === 'task' && !!i.task.d;
    const kind = i.kind === 'task' ? 'Task' : evKind(i.ev);
    return (
      <div key={i.key} className={`frow top tlRow agRow2${isDone || opts.past ? ' past' : ''}${i.kind === 'event' ? ' ev c-' + (i.ev.type ?? 'other') : ''}`}>
        <span className={`agT fmeta${opts.over ? ' over' : ''}`}>
          {opts.over && i.kind === 'task' ? fmtDue(i.task.due!) : i.tm ? fmtTime(i.tm) : i.kind === 'event' ? 'All day' : 'Anytime'}
        </span>
        {i.kind === 'task' ? (
          <button
            className={`fchk${isDone ? ' on' : ''}`}
            aria-label={isDone ? `Mark ${i.t} not done` : `Mark ${i.t} done`}
            onClick={() => done(i.task)}
          />
        ) : (
          <i className="agBar" />
        )}
        <div className="ft">
          <button className="tlT" onClick={() => tap(i)}>
            <span className={isDone ? 'tlDone' : ''}>{i.t}</span>
          </button>
          {i.kind === 'event' && (i.ev.loc || i.ev.rep) ? (
            <div className="fsub">{[i.ev.loc, i.ev.rep ? '↻ repeats' : ''].filter(Boolean).join(' · ')}</div>
          ) : null}
          {opts.over ? <div className="fsub over">Overdue</div> : null}
          {opts.actions && i.kind === 'task' ? (
            <div className="tlActs">
              <button className="pri" onClick={() => done(i.task)}>Done</button>
              <button onClick={() => move(i.task)}>Move</button>
            </div>
          ) : null}
        </div>
        <span className="fmeta">{kind}</span>
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
      <form
        className="tlAdd"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <Icon name="pls" />
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (!e.target.value.trim()) setPick(null);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          placeholder="Add a task, event or note…"
          aria-label="Add a task, event or note"
          enterKeyHint="done"
        />
        {text.trim() ? (
          <button
            type="button"
            className="tlKind"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setPick(KINDS[(KINDS.indexOf(kind) + 1) % KINDS.length])}
            title="Tap to change what this becomes"
          >
            {KIND_LABEL[kind]}
          </button>
        ) : null}
      </form>
      <div className="tlDay">
        {earlier.length ? (
          <button className="sdiv tlFold" onClick={() => setShowEarlier((v) => !v)} aria-expanded={showEarlier}>
            Earlier · {earlierDone ? `${earlierDone} done` : `${earlier.length} item${earlier.length === 1 ? '' : 's'}`}
          </button>
        ) : null}
        {showEarlier ? earlier.map((i) => row(i, { past: true })) : null}
        {overdue.length || attention.length ? <div className="sdiv att">Needs attention</div> : null}
        {overdue.map((t) => row({ kind: 'task', key: 'o' + t.id, t: t.t, tm: t.tm, task: t }, { over: true, actions: true }))}
        {attention.map((i) => row(i, { actions: true }))}
        <div className="snow">Now · {now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div>
        {later.map((i) => row(i))}
        {anytime.length ? <div className="sdiv">Anytime</div> : null}
        {anytime.map((i) => row(i))}
        {!later.length && !anytime.length ? <p className="oIntro tlNone">Nothing else today.</p> : null}
        {notesToday.length ? <div className="sdiv">Notes today</div> : null}
        {notesToday.map((n) => (
          <div key={n.id} className="frow top tlRow agRow2">
            <span className="agT fmeta">{new Date(n.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
            <i className="agBar" />
            <div className="ft">
              <button className="tlT" onClick={() => go('note', n.id)}>
                <span>{titleOf(n)}</span>
              </button>
            </div>
            <span className="fmeta">Note</span>
          </div>
        ))}
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
export function evKind(e: CalEvent): string {
  return !e.type || e.type === 'other' ? 'Event' : TYPE_LABEL[e.type];
}
