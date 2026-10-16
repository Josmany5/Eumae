import { useEffect, useMemo, useRef, useState } from 'react';
import { parseQuick, fmtShort, fmtTime, repLabel, type Quick } from '../quickadd';
import { EVENT_TYPES, type CalEvent, type EventType, type Repeat } from '../events';

/* Quick add: one field, typed naturally. What it understands shows live as
 * chips under the field; tap a chip's × to keep that part as plain title.
 * Enter adds. "More" opens the full form with everything prefilled. */

type Field = 'date' | 'time' | 'loc' | 'rep' | 'mins' | 'pr' | 'list';

export function QuickAdd({
  placeholder,
  kind,
  onAdd,
  onMore,
  autoFocus,
}: {
  placeholder: string;
  kind: 'event' | 'task';
  onAdd: (q: Quick) => void;
  onMore: (q: Quick) => void;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState('');
  const [off, setOff] = useState<Field[]>([]);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  const parsed = useMemo(() => {
    const q = parseQuick(text);
    /* A removed chip drops the field; its words stay out of the title, the
       user can retype them. */
    const out: Quick = { ...q };
    for (const f of off) {
      if (f === 'time') {
        out.time = undefined;
        out.end = undefined;
      } else (out as unknown as Record<string, unknown>)[f] = undefined;
    }
    return out;
  }, [text, off]);

  const chips: { f: Field; label: string }[] = [];
  if (parsed.date) chips.push({ f: 'date', label: fmtShort(parsed.date) });
  if (parsed.time)
    chips.push({ f: 'time', label: fmtTime(parsed.time) + (parsed.end ? ' – ' + fmtTime(parsed.end) : '') });
  if (parsed.mins && kind === 'task') chips.push({ f: 'mins', label: parsed.mins + ' min' });
  if (parsed.rep) chips.push({ f: 'rep', label: repLabel(parsed.rep, parsed.date) });
  if (parsed.loc) chips.push({ f: 'loc', label: parsed.loc });
  if (parsed.pr) chips.push({ f: 'pr', label: parsed.pr[0].toUpperCase() + parsed.pr.slice(1) });
  if (parsed.list) chips.push({ f: 'list', label: '#' + parsed.list });

  const reset = () => {
    setText('');
    setOff([]);
  };
  const submit = () => {
    if (!parsed.title.trim()) return;
    onAdd(parsed);
    reset();
  };

  return (
    <div className="qa">
      <div className="qaRow">
        <input
          ref={ref}
          className="qaIn"
          placeholder={placeholder}
          value={text}
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
        <button className="gho qaMore" onClick={() => onMore(parsed)}>
          More
        </button>
        <button className="pri" onClick={submit} disabled={!parsed.title.trim()}>
          Add
        </button>
      </div>
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
      ) : text.trim() ? null : (
        <div className="xs m qaHint">
          {kind === 'event'
            ? 'Try “Dentist Tue 3pm at Main St” or “Kung fu every Mon Wed 7-8:30pm”'
            : 'Try “Call Marcus tomorrow 4pm 30m !urgent #work”'}
        </div>
      )}
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
  useEffect(() => setE(initial), [initial]);
  const set = (p: Partial<CalEvent>) => setE((x) => ({ ...x, ...p }));
  const rep = e.rep;
  const setRep = (r: Repeat | undefined) => set({ rep: r });
  const editing = !!onDelete;

  return (
    <div className="card evForm">
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
