/* Guild Requests — reqIn cards with the full gReq state machine, reqOut
 * pipeline, assigned by-me/to-me tabs, assign form. */

import { useState } from 'react';
import { useNav } from '../nav';
import { getGuild, answerRequest, assignWork, snapshotGuild, restoreGuild, GSTEPS } from '../guild';
import { AssignedMenu } from '../components/AssignedMenu';
import { undoable } from '../undo';
import type { PageProps } from './index';

export default function RequestsPage(_props: PageProps) {
  void _props;
  const { notify } = useNav();
  const [tick, setTick] = useState(0);
  const [tab, setTab] = useState<'by' | 'to'>('by');
  const [assigning, setAssigning] = useState(false);
  const [title, setTitle] = useState('');
  const [person, setPerson] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  void tick;

  const g = getGuild();
  /* Keep each row's place in `assigned`: edits and deletes go by it. */
  const shown = g.assigned.map((a, i) => ({ a, i })).filter(({ a }) => (tab === 'by' ? !a.mine : !!a.mine));

  const act = (i: number, a: 0 | 1 | 2 | 3) => {
    if (a === 0) {
      /* Declining removes the request — with Undo, like every delete. */
      undoable(notify, 'Request declined.', snapshotGuild, restoreGuild, () => {
        answerRequest(i, 0);
      }, refresh);
      return;
    }
    notify(answerRequest(i, a));
    refresh();
  };

  const submitAssign = () => {
    const msg = assignWork(title, person);
    notify(msg);
    if (/Assigned/.test(msg)) {
      setTitle('');
      setAssigning(false);
      refresh();
    }
  };
  return (
    <div>
      <h3 className="sec">Requests in</h3>
      {g.reqIn.length ? (
        g.reqIn.map((r, i) => {
          const p = g.people[r.p];
          return (
            <div key={i} className="card" style={{ padding: '12px 14px', marginBottom: 8 }}>
              <div className="row">
                <div className="fi" style={{ borderRadius: '50%', fontSize: 14 }}>
                  {p ? p.ini : '?'}
                </div>
                <div className="g">
                  <b>{p ? p.n : 'Guild'}</b> <span className="m">asked for</span> <b>{r.what}</b>
                  <div className="xs m">{r.t}</div>
                </div>
              </div>
              {r.st === 'new' ? (
                <div className="btns">
                  <button className="pri" onClick={() => act(i, 1)}>
                    Accept
                  </button>
                  <button onClick={() => act(i, 0)}>Decline</button>
                </div>
              ) : r.st === 'found' ? (
                <>
                  <div className="s" style={{ marginTop: 8 }}>
                    Eumae found it in your Library. Nothing sends until you say so.
                  </div>
                  <div className="btns">
                    <button className="pri" onClick={() => act(i, 2)}>
                      Send it
                    </button>
                    <button onClick={() => act(i, 3)}>Not yet</button>
                  </div>
                </>
              ) : (
                <div style={{ marginTop: 8 }}>
                  <span className="tag gr">Sent</span>
                </div>
              )}
            </div>
          );
        })
      ) : (
        <div className="s m">Nothing waiting on you.</div>
      )}
      <h3 className="sec">Requests out</h3>
      {assigning ? (
        <div className="card">
          <b>Assign to a Guild member</b>
          <div className="s m">Pick who it is for and write the ask.</div>
          <div className="ftabs">
            {g.people.map((p, i) => (
              <button key={p.n} className={person === i ? 'on' : ''} onClick={() => setPerson(i)}>
                {p.n}
              </button>
            ))}
          </div>
          <input
            className="sinput"
            placeholder="What do you need?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitAssign();
              if (e.key === 'Escape') setAssigning(false);
            }}
            aria-label="What do you need?"
            style={{ marginTop: 8 }}
          />
          <div className="btns">
            <button className="pri" onClick={submitAssign}>
              Assign
            </button>
            <button className="gho" onClick={() => setAssigning(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="btns" style={{ margin: '0 0 8px' }}>
          <button className="pri" onClick={() => setAssigning(true)}>
            Assign to a Guild member
          </button>
        </div>
      )}
      {g.reqOut.map((r, i) => {
        const p = g.people[r.p];
        return (
          <div key={i} className="card" style={{ padding: '12px 14px', marginBottom: 8 }}>
            <div className="row">
              <div className="fi" style={{ borderRadius: '50%', fontSize: 14 }}>
                {p ? p.ini : '?'}
              </div>
              <div className="g">
                <b>{r.what}</b>
                <div className="xs m">to {p ? p.n : 'Guild'}</div>
              </div>
              {r.step === 3 ? <span className="tag gr">Done</span> : null}
            </div>
            <div className="bar">
              <i style={{ width: `${(r.step + 1) * 25}%` }} />
            </div>
            <div className="xs m">{GSTEPS[r.step] ?? ''}</div>
          </div>
        );
      })}
      <h3 className="sec">Assigned work</h3>
      <div className="ftabs">
        <button className={tab === 'by' ? 'on' : ''} onClick={() => setTab('by')}>
          Assigned by me
        </button>
        <button className={tab === 'to' ? 'on' : ''} onClick={() => setTab('to')}>
          Assigned to me
        </button>
      </div>
      <div className="s m" style={{ marginBottom: 8 }}>
        {tab === 'by'
          ? 'You see status for work you assigned. Classroom builds it; Guild tracks it here.'
          : 'You see only your own progress.'}
      </div>
      {shown.map(({ a, i }) => (
        <div key={`${i}${a.who}${a.t}`} className="card" style={{ padding: '12px 14px', marginBottom: 8 }}>
          <div className="row">
            <div className="g">
              <b>{a.t}</b>
              <div className="xs m">{tab === 'by' ? `assigned to ${a.who}` : 'assigned to you'}</div>
            </div>
            <span className="tag">{a.pct}%</span>
            {tab === 'by' ? <AssignedMenu index={i} onChange={refresh} /> : null}
          </div>
          <div className="bar">
            <i style={{ width: `${a.pct}%` }} />
          </div>
          {tab === 'to' ? (
            <div className="btns">
              <button
                className="pri soon"
                onClick={() => notify('Opening assigned training in Classroom comes soon. Its course has not shipped yet.')}
              >
                Open in Classroom
              </button>
            </div>
          ) : null}
        </div>
      ))}
      {shown.length === 0 ? <div className="s m">Nothing here.</div> : null}
    </div>
  );
}
