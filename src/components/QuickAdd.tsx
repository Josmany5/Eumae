import { useEffect, useMemo, useRef, useState } from 'react';
import { parseQuick, fmtShort, fmtTime, repLabel, type Quick } from '../quickadd';
import { Icon } from './shell/icons';
import {
  deleteEvent,
  skipOccurrence,
  snapshotEvents,
  restoreEvents,
  setAttendance,
  attendanceOf,
  type CalEvent,
  type EventType,
} from '../events';
import { ItemMenu } from './ItemMenu';
import { undoable } from '../undo';
import { useNav, type NotifyOpts } from '../nav';

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
  kind: 'event' | 'task' | 'goal' | 'project' | 'flow';
  onAdd: (q: Quick) => void;
  onMore?: (q: Quick) => void;
  autoFocus?: boolean;
  /** false: the whole line is the title (projects). */
  parse?: boolean;
}) {
  const [text, setText] = useState('');
  const [off, setOff] = useState<Field[]>([]);
  // Closed by default: just a round + button. Tap it to type.
  const [open, setOpen] = useState(!!autoFocus);
  const ref = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const pressed = useRef(false);
  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);

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
  if (parsed.date && kind !== 'flow') chips.push({ f: 'date', label: (kind === 'goal' ? 'By ' : '') + fmtShort(parsed.date) });
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
  const close = () => {
    reset();
    setOpen(false);
  };
  const ready = !!parsed.title.trim();
  const submit = () => {
    if (!ready) return;
    onAdd(parsed);
    reset();
  };

  if (!open)
    return (
      <div className="qa qaClosed">
        <button className="qaFab" onClick={() => setOpen(true)} aria-label={placeholder}>
          <Icon name="pls" />
        </button>
      </div>
    );

  return (
    <div
      className="qa"
      ref={box}
      onPointerDown={(e) => {
        // A tap on one of the bar's own buttons (More, Add, Close, a chip's ×)
        // must not count as tapping away. iPhone Safari blurs the input before
        // the tap lands and gives no relatedTarget, so note the press here.
        if ((e.target as HTMLElement).closest('button')) {
          pressed.current = true;
          window.setTimeout(() => (pressed.current = false), 500);
        }
      }}
      onMouseDown={(e) => {
        // Desktop: keep the cursor in the input when a button is clicked.
        if ((e.target as HTMLElement).closest('button')) e.preventDefault();
      }}
      onBlur={(e) => {
        // Tapping away with nothing typed folds it back into the + button.
        if (text.trim() || box.current?.contains(e.relatedTarget as Node)) return;
        window.setTimeout(() => {
          if (pressed.current) return;
          if (!box.current?.contains(document.activeElement)) setOpen(false);
        }, 250);
      }}
    >
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
            if (e.key === 'Escape') close();
          }}
          aria-label={placeholder}
        />
        {onMore ? (
          <button
            className="qaMore"
            onClick={() => {
              /* Drop the keyboard first so the whole office shows before you
                 edit (his call, Oct 24), then fold the bar back into the +. */
              ref.current?.blur();
              (document.activeElement as HTMLElement | null)?.blur?.();
              const q = parsed;
              close();
              onMore(q);
            }}
            aria-label="All fields"
          >
            More
          </button>
        ) : null}
        <button className="qaSend" onClick={submit} disabled={!ready} aria-label="Add">
          <Icon name="up" />
        </button>
        <button className="qaX" onClick={close} aria-label="Close">
          <Icon name="x" />
        </button>
      </div>
    </div>
  );
}

/* ── Full event form: everything an event can hold. ─────────────────── */

export const TYPE_LABEL: Record<EventType, string> = {
  meeting: 'Meeting',
  appointment: 'Appointment',
  class: 'Class',
  other: 'Other',
};
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
export type DeleteScope = 'one' | 'all';

/* Delete an event without asking. A repeating event can lose just the day
   you tapped (the series keeps going) or the whole series. Undo either way. */
export function removeEvent(
  notify: (m: string, o?: NotifyOpts) => void,
  ev: CalEvent,
  day: string | undefined,
  scope: DeleteScope,
  after?: () => void,
): void {
  const one = scope === 'one' && !!ev.rep && !!ev.id;
  undoable(
    notify,
    one ? 'This one deleted. The rest still repeat.' : ev.rep ? 'Event and its repeats deleted.' : 'Event deleted.',
    snapshotEvents,
    restoreEvents,
    () => (one ? skipOccurrence(ev.id!, day ?? ev.d) : deleteEvent(ev)),
    after,
  );
}

/* The ⋯ for an event, the same on a list row and on the detail card. */
export function EventMenu({
  ev,
  day,
  onOpen,
  onEdit,
  onDelete,
  onChange,
}: {
  ev: CalEvent;
  /** The occurrence's date, for Attended (a repeat marks just this one). */
  day?: string;
  onOpen?: () => void;
  onEdit: () => void;
  onDelete: (scope: DeleteScope) => void;
  onChange?: () => void;
}) {
  const { notify } = useNav();
  const d = day ?? ev.d;
  const was = ev.id ? attendanceOf(ev, d) : undefined;
  /* Mark attended any time, even before it ends (his call, Oct 25). */
  const extra: { label: string; danger?: boolean; onClick: () => void }[] = [];
  if (ev.id) {
    const id = ev.id;
    const to = was === 'yes' ? null : 'yes';
    extra.push({
      label: was === 'yes' ? 'Not attended yet' : 'Attended',
      onClick: () => {
        setAttendance(id, d, to);
        onChange?.();
        notify(to ? 'Marked attended.' : 'Attended cleared.', {
          undo: () => {
            setAttendance(id, d, was ?? null);
            onChange?.();
          },
        });
      },
    });
  }
  if (ev.rep) extra.push({ label: 'Delete this one', danger: true, onClick: () => onDelete('one') });
  return (
    <ItemMenu
      name={ev.t}
      open={onOpen}
      edit={onEdit}
      link={ev.id ? { k: 'event', id: ev.id } : undefined}
      onChange={onChange}
      extra={extra.length ? extra : undefined}
      onDelete={() => onDelete('all')}
      deleteLabel={ev.rep ? 'Delete the series' : 'Delete'}
    />
  );
}
