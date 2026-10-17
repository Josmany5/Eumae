/* Events — the list you add to (Calendar is the grid you read).
 *
 * Upcoming occurrences for the next 60 days, grouped Today / Tomorrow /
 * This week / Later, with kind chips to filter. Same store as Calendar, so
 * an event added here shows on the grid and the other way round. Adding is
 * one line ("Kung fu every Mon Wed 7-8:30pm"); More opens every field.
 */

import { useMemo, useState } from 'react';
import { useNav } from '../nav';
import {
  eventsBetween,
  getEvent,
  getEvents,
  saveEvent,
  ymd,
  EVENT_TYPES,
  type CalEvent,
  type EventType,
} from '../events';
import { QuickAdd, EventForm, EventDetail, EventMenu, quickToEvent, removeEvent } from '../components/QuickAdd';
import { ProjectChip } from '../components/ItemMenu';
import { fmtTime, repLabel } from '../quickadd';
import type { PageProps } from './index';

type Filter = 'all' | EventType;
const LABEL: Record<Filter, string> = {
  all: 'All',
  meeting: 'Meetings',
  appointment: 'Appointments',
  class: 'Classes',
  other: 'Other',
};

export default function EventsPage({ arg }: PageProps) {
  const { notify, go } = useNav();
  const [filter, setFilter] = useState<Filter>('all');
  const [tick, setTick] = useState(0);
  const [form, setForm] = useState<{ ev: CalEvent; editing: boolean } | null>(null);
  /* Opened with an event id (from a project): show that event's card. */
  const [view1, setView1] = useState<{ ev: CalEvent; day: string } | null>(() => {
    const e = typeof arg === 'string' ? getEvent(arg) : undefined;
    return e ? { ev: e, day: e.d } : null;
  });
  const refresh = () => setTick((t) => t + 1);
  const today = ymd(new Date());

  const groups = useMemo(() => {
    void tick;
    const all = eventsBetween(today, 60).filter((e) => filter === 'all' || (e.type ?? 'other') === filter);
    const tomorrow = shift(today, 1);
    const weekEnd = shift(today, 7 - new Date(today + 'T12:00').getDay());
    const g: { title: string; rows: CalEvent[] }[] = [
      { title: 'Today', rows: all.filter((e) => e.d === today) },
      { title: 'Tomorrow', rows: all.filter((e) => e.d === tomorrow) },
      { title: 'This week', rows: all.filter((e) => e.d > tomorrow && e.d < weekEnd) },
      /* Later: one-off events only, so a daily standup doesn't bury them. */
      { title: 'Later', rows: all.filter((e) => e.d >= weekEnd && e.d > tomorrow && !e.rep) },
      /* Every series once, by its next date. */
      {
        title: 'Repeating',
        rows: getEvents()
          .filter((e) => e.rep && (filter === 'all' || (e.type ?? 'other') === filter))
          .filter((e) => !e.rep!.until || e.rep!.until >= today)
          .map((e) => all.find((o) => o.id === e.id) ?? e),
      },
    ];
    return g.filter((x) => x.rows.length);
  }, [tick, filter, today]);


  return (
    <div className="qaPage">
      <QuickAdd
        kind="event"
        placeholder="New event"
        hint="Type it how you'd say it: “Kung fu every Mon Wed 7-8:30pm”"
        onAdd={(q) => {
          const e = saveEvent(quickToEvent(q, today));
          refresh();
          notify(`Added ${e.t}${e.rep ? ' · ' + repLabel(e.rep, e.d) : ''}`);
        }}
        onMore={(q) => setForm({ ev: quickToEvent(q, today), editing: false })}
      />
      {view1 && !form ? (
        <EventDetail
          ev={view1.ev}
          day={view1.day}
          onClose={() => setView1(null)}
          onEdit={() => {
            setForm({ ev: view1.ev, editing: true });
            setView1(null);
          }}
          onDelete={(scope) => {
            setView1(null);
            removeEvent(notify, view1.ev, view1.day, scope, refresh);
          }}
        />
      ) : null}
      {form ? (
        <EventForm
          initial={form.ev}
          onCancel={() => setForm(null)}
          onSave={(e) => {
            saveEvent(e);
            setForm(null);
            refresh();
            notify(form.editing ? 'Event updated.' : 'Event added.');
          }}
          onDelete={
            form.editing
              ? () => {
                  setForm(null);
                  removeEvent(notify, form.ev, undefined, 'all', refresh);
                }
              : undefined
          }
        />
      ) : null}
      <div className="ftabs">
        {(['all', ...EVENT_TYPES] as Filter[]).map((f) => (
          <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
            {f !== 'all' ? <i className={'fdot c-' + f} /> : null}
            {LABEL[f]}
          </button>
        ))}
      </div>
      {groups.length ? (
        groups.map((g) => (
          <div key={g.title}>
            <h3 className="sec">{g.title}</h3>
            <div className="card cardPad">
              {g.rows.map((e) => (
                <div key={(e.id ?? e.t) + e.d} className="imWrap">
                <button
                  className={'agRow c-' + (e.type ?? 'other')}
                  onClick={() => {
                    setForm(null);
                    setView1({ ev: (e.id && getEvent(e.id)) || e, day: e.d });
                  }}
                >
                  <span className="agTm">
                    {g.title === 'Today' || g.title === 'Tomorrow' ? '' : <span className="xs m">{g.title === 'Repeating' ? 'Next ' : ''}{dayLabel(e.d)}<br /></span>}
                    {e.allDay || !e.tm ? 'All day' : fmtTime(e.tm)}
                  </span>
                  <i />
                  <span className="g">
                    {e.t}
                    <span className="xs m">
                      {e.end && !e.allDay ? ' · until ' + fmtTime(e.end) : ''}
                      {e.loc ? ' · ' + e.loc : ''}
                      {e.rep ? ' · ↻ ' + repLabel(e.rep, (e.id && getEvent(e.id)?.d) || e.d) : ''}
                    </span>
                    {e.id ? <ProjectChip k="event" id={e.id} /> : null}
                  </span>
                </button>
                <EventMenu
                  ev={(e.id && getEvent(e.id)) || e}
                  onOpen={() => {
                    setForm(null);
                    setView1({ ev: (e.id && getEvent(e.id)) || e, day: e.d });
                  }}
                  onEdit={() => {
                    setView1(null);
                    setForm({ ev: (e.id && getEvent(e.id)) || e, editing: true });
                  }}
                  onDelete={(scope) => removeEvent(notify, (e.id && getEvent(e.id)) || e, e.d, scope, refresh)}
                  onChange={refresh}
                />
                </div>
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="card s m" style={{ marginTop: 12 }}>
          {filter === 'all'
            ? 'Nothing coming up. Type one line above to add an event.'
            : `No ${LABEL[filter].toLowerCase()} coming up.`}
        </div>
      )}
      <div className="xs m calFoot">
        Next 60 days ·{' '}
        <button className="lnkBtn" onClick={() => go('cal')}>
          Open Calendar
        </button>
      </div>
    </div>
  );
}

function shift(day: string, n: number): string {
  const d = new Date(day + 'T12:00');
  d.setDate(d.getDate() + n);
  return ymd(d);
}

function dayLabel(day: string): string {
  return new Date(day + 'T12:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
