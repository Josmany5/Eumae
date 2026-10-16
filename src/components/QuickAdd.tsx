import { useEffect, useMemo, useRef, useState } from 'react';
import { parseQuick, fmtShort, fmtTime, repLabel, type Quick } from '../quickadd';
import { Icon } from './shell/icons';
import { EVENT_TYPES, type CalEvent, type EventType, type Repeat } from '../events';

/* Quick add: one field, typed naturally. What it understands shows live as
 * chips under the field; tap a chip's × to keep that part as plain title.
 * Enter adds. "More" opens the full form with everything prefilled. */

type Field = 'date' | 'time' | 'loc' | 'rep' | 'mins' | 'pr' | 'list';

export function QuickAdd({
  placeholder,
  hint,
  kind,
  onAdd,
  onMore,
  autoFocus,
  parse = true,
}: {
  /** Short, inside the bar ("New event"). */
  placeholder: string;
  /** The example, shown OUTSIDE the bar so it stays legible. */
  hint?: string;
  kind: 'event' | 'task' | 'goal' | 'project';
  onAdd: (q: Quick) => void;
  onMore?: (q: Quick) => void;
  autoFocus?: boolean;
  /** false: the whole line is the title (projects). */
  parse?: boolean;
}) {
  const [text, setText] = useState('');
  const [off, setOff] = useState<Field[]>([]);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  const parsed = useMemo(() => {
    if (!parse) return { title: text.trim() } as Quick;
    const q = parseQuick(text);
    const out: Quick = { ...q };
    for (const f of off) {
      if (f === 'time') {
        out.time = undefined;
        out.end = undefined;
      } else (out as unknown as Record<string, unknown>)[f] = undefined;
    }
    return out;
  }, [text, off, parse]);

  const chips: { f: Field; label: string }[] = [];
  if (parsed.date) chips.push({ f: 'date', label: (kind === 'goal' ? 'By ' : '') + fmtShort(parsed.date) });
  if (parsed.time && kind !== 'goal')
    chips.push({ f: 'time', label: fmtTime(parsed.time) + (parsed.end ? ' – ' + fmtTime(parsed.end) : '') });
  if (parsed.mins && kind === 'task') chips.push({ f: 'mins', label: parsed.mins + ' min' });
  if (parsed.rep && kind !== 'goal') chips.push({ f: 'rep', label: repLabel(parsed.rep, parsed.date) });
  if (parsed.loc && kind === 'event') chips.push({ f: 'loc', label: parsed.loc });
  if (parsed.pr && kind === 'task') chips.push({ f: 'pr', label: parsed.pr[0].toUpperCase() + parsed.pr.slice(1) });
  if (parsed.list && kind === 'task') chips.push({ f: 'list', label: '#' + parsed.list });

  const reset = () => {
    setText('');
    setOff([]);
  };
  const ready = !!parsed.title.trim();
  const submit = () => {
    if (!ready) return;
    onAdd(parsed);
    reset();
  };

  return (
    <div className="qa">
      {chips.length ? (
        <div className="qaChips" aria-label="Understood">
          {chips.map((c) => (
            <span key={c.f} className="qaChip">
              {c.label}
              <button aria-label={'Remove ' + c.label} onClick={() => setOff((o) => [...o, c.f])}>
                ×
              </button>
            </span>
          ))}
        </div>
      ) : hint ? (
        <div className="qaHint">{hint}</div>
      ) : null}
      <div className={'qaBar' + (ready ? ' ready' : '')}>
        <input
          ref={ref}
          className="qaIn"
          placeholder={placeholder}
          value={text}
          enterKeyHint="send"
          onChange={(e) => {
            setText(e.target.value);
            setOff([]);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') reset();
          }}
          aria-label={placeholder}
        />
        {onMore ? (
          <button className="qaMore" onClick={() => onMore(parsed)} aria-label="All fields">
            More
          </button>
        ) : null}
        <button className="qaSend" onClick={submit} disabled={!ready} aria-label="Add">
          <Icon name="up" />
        </button>
      </div>
    </div>
  );
}

/* ── Full event form: everything an event can hold. ─────────────────── */

const TYPE_LABEL: Record<EventType, string> = {
  meeting: 'Meeting',
  appointment: 'Appointment',
  class: 'Class',
  other: 'Other',
};
const DOW1 = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function EventForm({
  initial,
  onSave,
  onDelete,
  onCancel,
}: {
  initial: CalEvent;
  onSave: (e: CalEvent) => void;
  onDelete?: () => void;
  onCancel: () => void;
}) {
  const [e, setE] = useState<CalEvent>(initial);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => setE(initial), [initial]);
  useEffect(() => {
    box.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [initial]);
  const set = (p: Partial<CalEvent>) => setE((x) => ({ ...x, ...p }));
  const rep = e.rep;
  const setRep = (r: Repeat | undefined) => set({ rep: r });
  const editing = !!onDelete;

  return (
    <div className="card evForm" ref={box}>
      <b>{editing ? 'Edit event' : 'New event'}</b>
      <input
        className="sinput"
        placeholder="Title"
        value={e.t}
        onChange={(x) => set({ t: x.target.value })}
        aria-label="Title"
        autoFocus={!editing}
      />
      <div className="evRow">
        <label>
          <span className="xs m">Date</span>
          <input className="sinput" type="date" value={e.d} onChange={(x) => set({ d: x.target.value })} />
        </label>
        {!e.allDay ? (
          <>
            <label>
              <span className="xs m">Starts</span>
              <input className="sinput" type="time" value={pad(e.tm)} onChange={(x) => set({ tm: x.target.value })} />
            </label>
            <label>
              <span className="xs m">Ends</span>
              <input className="sinput" type="time" value={pad(e.end)} onChange={(x) => set({ end: x.target.value || undefined })} />
            </label>
          </>
        ) : null}
      </div>
      <label className="evCheck">
        <input type="checkbox" checked={!!e.allDay} onChange={(x) => set({ allDay: x.target.checked })} /> All day
      </label>
      <div className="evTypes" role="radiogroup" aria-label="Type">
        {EVENT_TYPES.map((t) => (
          <button
            key={t}
            role="radio"
            aria-checked={(e.type ?? 'other') === t}
            className={'evType t-' + t + ((e.type ?? 'other') === t ? ' on' : '')}
            onClick={() => set({ type: t })}
          >
            <i />
            {TYPE_LABEL[t]}
          </button>
        ))}
      </div>
      <input
        className="sinput"
        placeholder="Location"
        value={e.loc ?? ''}
        onChange={(x) => set({ loc: x.target.value || undefined })}
        aria-label="Location"
      />
      <div className="evRow">
        <label>
          <span className="xs m">Repeat</span>
          <select
            className="sinput"
            value={rep?.f ?? 'none'}
            onChange={(x) => {
              const f = x.target.value;
              setRep(f === 'none' ? undefined : { ...(rep ?? {}), f: f as Repeat['f'] });
            }}
          >
            <option value="none">Does not repeat</option>
            <option value="daily">Every day</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>
        {rep ? (
          <label>
            <span className="xs m">Until</span>
            <input
              className="sinput"
              type="date"
              value={rep.until ?? ''}
              onChange={(x) => setRep({ ...rep, until: x.target.value || undefined })}
            />
          </label>
        ) : null}
      </div>
      {rep?.f === 'weekly' ? (
        <div className="evDays" aria-label="Repeat on">
          {DOW1.map((l, i) => {
            const days = rep.days && rep.days.length ? rep.days : [new Date(e.d + 'T12:00').getDay()];
            const on = days.includes(i);
            return (
              <button
                key={i}
                className={on ? 'on' : ''}
                aria-pressed={on}
                onClick={() => {
                  const next = on ? days.filter((d) => d !== i) : [...days, i].sort();
                  setRep({ ...rep, days: next.length ? next : undefined });
                }}
              >
                {l}
              </button>
            );
          })}
        </div>
      ) : null}
      <textarea
        className="sinput"
        placeholder="Notes"
        rows={2}
        value={e.note ?? ''}
        onChange={(x) => set({ note: x.target.value || undefined })}
        aria-label="Notes"
      />
      <div className="btns">
        <button
          className="pri"
          onClick={() => e.t.trim() && onSave({ ...e, t: e.t.trim(), tm: e.allDay ? '' : e.tm || '12:00' })}
        >
          {editing ? 'Save' : 'Add event'}
        </button>
        <button className="gho" onClick={onCancel}>
          Cancel
        </button>
        {onDelete ? (
          <button className="gho" style={{ color: 'var(--rd)' }} onClick={onDelete}>
            Delete
          </button>
        ) : null}
      </div>
    </div>
  );
}

function pad(tm: string | undefined): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(tm ?? '');
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '';
}

/** A Quick parse as a new event on `fallbackDay`. No time = all day. */
export function quickToEvent(q: Quick, fallbackDay: string): CalEvent {
  return {
    d: q.date ?? fallbackDay,
    tm: q.time ?? '',
    allDay: q.time ? undefined : true,
    end: q.end,
    t: q.title,
    loc: q.loc,
    rep: q.rep,
    type: q.type,
  };
}

/* ── Event details: what tapping an event shows. Read-only, same look as
   the list; Edit opens the full form. ─────────────────────────────── */
export function EventDetail({
  ev,
  day,
  onEdit,
  onDelete,
  onClose,
}: {
  ev: CalEvent;
  /** The occurrence's date (a repeat shows the day you tapped). */
  day?: string;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    box.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [ev]);
  const d = day ?? ev.d;
  const when =
    new Date(d + 'T12:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) +
    (ev.allDay || !ev.tm ? ' · All day' : ' · ' + fmtTime(ev.tm) + (ev.end ? ' – ' + fmtTime(ev.end) : ''));
  return (
    <div className={'card evDetail c-' + (ev.type ?? 'other')} ref={box}>
      <div className="evDHead">
        <i />
        <b>{ev.t}</b>
        <button className="evDX" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="evDRow">{when}</div>
      {ev.loc ? <div className="evDRow">{ev.loc}</div> : null}
      {ev.rep ? <div className="evDRow m">↻ {repLabel(ev.rep, ev.d)}</div> : null}
      <div className="evDRow m">{TYPE_LABEL[ev.type ?? 'other']}</div>
      {ev.note ? <div className="evDNote">{ev.note}</div> : null}
      <div className="btns">
        <button className="fb" onClick={onEdit}>
          Edit
        </button>
        <button className="fb" style={{ color: 'var(--rd)' }} onClick={onDelete}>
          Delete{ev.rep ? ' series' : ''}
        </button>
      </div>
    </div>
  );
}
