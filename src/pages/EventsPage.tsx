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
  deleteEvent,
  ymd,
  EVENT_TYPES,
  type CalEvent,
  type EventType,
} from '../events';
import { QuickAdd, EventForm, quickToEvent } from '../components/QuickAdd';
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

export default function EventsPage(_props: PageProps) {
  void _props;
  const { notify, go } = useNav();
  const [filter, setFilter] = useState<Filter>('all');
  const [tick, setTick] = useState(0);
  const [form, setForm] = useState<{ ev: CalEvent; editing: boolean } | null>(null);
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
    <div>
      <QuickAdd
        kind="event"
        placeholder="Add an event — “Kung fu every Mon Wed 7-8:30pm”"
        onAdd={(q) => {
          const e = saveEvent(quickToEvent(q, today));
          refresh();
          notify(`Added ${e.t}${e.rep ? ' · ' + repLabel(e.rep, e.d) : ''}`);
        }}
        onMore={(q) => setForm({ ev: quickToEvent(q, today), editing: false })}
      />
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
                  deleteEvent(form.ev);
                  setForm(null);
                  refresh();
                  notify('Event deleted.');
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
                <button
                  key={(e.id ?? e.t) + e.d}
                  className={'agRow c-' + (e.type ?? 'other')}
                  onClick={() => setForm({ ev: (e.id && getEvent(e.id)) || e, editing: true })}
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
                  </span>
                </button>
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
