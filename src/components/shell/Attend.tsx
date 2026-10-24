import { useState } from 'react';
import { useNav } from '../../nav';
import { attendanceOf, getEvent, rescheduleOccurrence, restoreEvents, setAttendance, snapshotEvents, ymd, type CalEvent } from '../../events';
import { fmtTime } from '../../quickadd';
import { dataChanged } from '../../focus';

/* "Did you attend?" (his wording, LOCKED Oct 21): an ended event is never
 * assumed attended. Attended / Not attended; Not attended then offers
 * "Reschedule?" with a day + time picker (the same one Move uses). Every
 * answer shows the Undo pill (his rule). Used on the Today spine and in the
 * office's Event tab. */
export function AttendAsk({ ev, day, onChange, onMark, onSettled }: {
  ev: CalEvent;
  day: string;
  onChange?: () => void;
  /** Called with the answer, before the store change re-renders the parent. */
  onMark?: (v: 'yes' | 'no') => void;
  /** The flow is over: attended, rescheduled, or "No thanks". */
  onSettled?: () => void;
}) {
  const { notify } = useNav();
  const [stage, setStage] = useState<'ask' | 'resched?' | 'pick'>('ask');
  const [pick, setPick] = useState({ due: ymd(new Date()), tm: ev.allDay ? '' : ev.tm ?? '' });
  const id = ev.id!;
  const answer = attendanceOf(getEvent(id) ?? ev, day);
  const done = () => {
    dataChanged();
    onChange?.();
  };

  const mark = (v: 'yes' | 'no') => {
    const before = attendanceOf(getEvent(id) ?? ev, day) ?? null;
    onMark?.(v);
    setAttendance(id, day, v);
    notify(v === 'yes' ? 'Marked attended.' : 'Marked not attended.', {
      undo: () => {
        setAttendance(id, day, before);
        setStage('ask');
        done();
      },
    });
    setStage(v === 'no' ? 'resched?' : 'ask');
    if (v === 'yes') onSettled?.();
    done();
  };

  const resched = () => {
    const snap = snapshotEvents();
    const moved = rescheduleOccurrence(id, pick.due, pick.tm);
    if (!moved) return;
    const when = new Date(pick.due + 'T12:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    notify(`Rescheduled to ${when}${pick.tm ? ' at ' + fmtTime(pick.tm) : ''}.`, {
      undo: () => {
        restoreEvents(snap);
        done();
      },
    });
    setStage('ask');
    onSettled?.();
    done();
  };

  if (stage === 'pick') {
    return (
      <div className="tlMove">
        <label className="tlField">
          <span>Day</span>
          <input type="date" className="sinput" aria-label="New day" value={pick.due} min={ymd(new Date())} onChange={(e) => setPick({ ...pick, due: e.target.value })} />
        </label>
        <label className="tlField">
          <span>Time</span>
          <input type="time" className="sinput" aria-label="New time (optional)" value={pick.tm} onChange={(e) => setPick({ ...pick, tm: e.target.value })} />
        </label>
        <div className="tlActs">
          <button className="pri" disabled={!pick.due} onClick={resched}>Save</button>
          <button onClick={() => setStage('ask')}>Cancel</button>
        </div>
      </div>
    );
  }

  if (stage === 'resched?') {
    return (
      <>
        <div className="fsub">Reschedule?</div>
        <div className="tlActs">
          <button className="pri" onClick={() => setStage('pick')}>Reschedule</button>
          <button
            onClick={() => {
              setStage('ask');
              onSettled?.();
            }}
          >
            No thanks
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="fsub">Did you attend?</div>
      <div className="tlActs attActs">
        <button className={answer === 'yes' ? 'pri' : ''} aria-pressed={answer === 'yes'} onClick={() => mark('yes')}>Attended</button>
        <button className={answer === 'no' ? 'pri' : ''} aria-pressed={answer === 'no'} onClick={() => mark('no')}>Not attended</button>
        {answer === 'no' ? <button onClick={() => setStage('pick')}>Reschedule</button> : null}
      </div>
    </>
  );
}
