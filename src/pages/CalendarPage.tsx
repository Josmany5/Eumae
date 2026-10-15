/* Calendar full page — the mockup's pgCal, rebuilt as React.
 *
 * Day/week/month seg + calHtml grid (CSS kept from the audit) + the
 * selected day's events with inline add/edit/delete. No prompt(): the
 * add/edit form lives in the page.
 */

import { useState } from 'react';
import { useNav } from '../nav';
import { getEvents, dayEvents, saveEvent, deleteEvent, type CalEvent } from '../events';
import type { PageProps } from './index';

type CalView = 'day' | 'week' | 'month';

const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const DOW_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function weekDays(day: string): string[] {
  const base = new Date(day + 'T12:00');
  const dow = base.getDay();
  const out: string[] = [];
  for (let i = -dow; i < 7 - dow; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function fmtDay(day: string): string {
  const d = new Date(day + 'T12:00');
  return `${DOW_FULL[d.getDay()]}, ${d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}`;
}
export default function CalendarPage(_props: PageProps) {
  void _props;
  const { notify } = useNav();
  const [view, setView] = useState<CalView>('week');
  const [day, setDay] = useState(() => todayStr());
  const [tick, setTick] = useState(0);
  const [adding, setAdding] = useState(false);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('12:00');
  const refresh = () => setTick((t) => t + 1);
  void tick;

  const events = dayEvents(day);
  const hasEvents = (d: string) => getEvents().some((e) => e.d === d);

  const openAdd = () => {
    setTitle('');
    setTime('12:00');
    setEditKey(null);
    setAdding(true);
  };

  const openEdit = (e: CalEvent) => {
    setTitle(e.t);
    setTime(e.tm);
    setEditKey(`${e.d}|${e.tm}|${e.t}`);
    setAdding(true);
  };

  const submit = () => {
    const t = title.trim();
    if (!t) {
      notify('Name it first.');
      return;
    }
    const tm = /^(\d{1,2}):(\d{2})/.test(time.trim()) ? time.trim() : '12:00';
    if (editKey) {
      const [d, oldTm, oldT] = editKey.split('|');
      deleteEvent({ d, tm: oldTm, t: oldT });
    }
    saveEvent({ d: day, tm, t });
    setAdding(false);
    setEditKey(null);
    setTitle('');
    refresh();
    notify(editKey ? 'Event updated.' : 'Event added.');
  };

  return (
    <div>
      <div className="row">
        <div className="g" />
        <button className="hb" onClick={openAdd} aria-label="Add event">
          +
        </button>
      </div>
      <div className="seg">
        {(['day', 'week', 'month'] as CalView[]).map((v) => (
          <button key={v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>
            {v[0].toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>
      {view === 'day' ? (
        <div className="wkstrip">
          {weekDays(day).map((d) => (
            <button key={d} className={d === day ? 'sel' : ''} onClick={() => setDay(d)}>
              {d.slice(8)}
              <br />
              <span className="xs">{DOW[new Date(d + 'T12:00').getDay()]}</span>
            </button>
          ))}
        </div>
      ) : null}
      {view === 'week' ? (
        <div className="card">
          <div className="calgrid">
            {DOW.map((d) => (
              <div key={d} className="dw">
                {d}
              </div>
            ))}
            {weekDays(day).map((d) => (
              <button
                key={d}
                className={'dy' + (d === day ? ' sel' : '') + (d === todayStr() ? ' today' : '')}
                onClick={() => setDay(d)}
              >
                {+d.slice(8)}
                {hasEvents(d) ? <span className="dotd" /> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {view === 'month' ? (
        <MonthGrid day={day} onDay={setDay} hasEvents={hasEvents} />
      ) : null}
      {adding ? (
        <div className="card">
          <b>{editKey ? 'Edit event' : 'New event'}</b>
          <div className="s m">{fmtDay(day)}</div>
          <input
            placeholder="Event title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ margin: '8px 0' }}
            aria-label="Event title"
          />
          <input
            placeholder="Time (HH:MM)"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            aria-label="Event time"
          />
          <div className="btns">
            <button className="pri" onClick={submit}>
              {editKey ? 'Save' : 'Add'}
            </button>
            <button
              className="gho"
              onClick={() => {
                setAdding(false);
                setEditKey(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      <h3 className="sec">{fmtDay(day)}</h3>
      <div className="card cardPad">
        {events.map((e) => (
          <div key={`${e.tm}${e.t}`} className="ev">
            <div className="tm">{e.tm}</div>
            <div className="g">{e.t}</div>
            <button className="fb" onClick={() => openEdit(e)}>
              Edit
            </button>
            <button
              className="fb"
              style={{ color: 'var(--rd)' }}
              onClick={() => {
                deleteEvent(e);
                refresh();
                notify('Event deleted.');
              }}
            >
              ×
            </button>
          </div>
        ))}
        {events.length === 0 ? (
          <div className="s m">Nothing scheduled. Tap + to add an event — or tell Eumae in Chat.</div>
        ) : null}
      </div>
    </div>
  );
}
function MonthGrid({ day, onDay, hasEvents }: { day: string; onDay: (d: string) => void; hasEvents: (d: string) => boolean }) {
  const [y, m] = day.split('-').map(Number);
  const first = new Date(y, m - 1, 1).getDay();
  const dim = new Date(y, m, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  const monthName = new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  return (
    <div className="card">
      <div className="row">
        <div className="g">
          <b>{monthName}</b>
        </div>
      </div>
      <div className="calgrid">
        {DOW.map((d) => (
          <div key={d} className="dw">
            {d}
          </div>
        ))}
        {cells.map((ds, i) =>
          ds ? (
            <button
              key={ds}
              className={'dy' + (ds === day ? ' sel' : '') + (ds === todayStr() ? ' today' : '')}
              onClick={() => onDay(ds)}
            >
              {+ds.slice(8)}
              {hasEvents(ds) ? <span className="dotd" /> : null}
            </button>
          ) : (
            <div key={`e${i}`} />
          ),
        )}
      </div>
    </div>
  );
}
