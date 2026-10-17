/* Assigned work — the mockup's pgGAsn: by-you (everyone's status) +
 * to-you (your progress) cards, Open-in-Classroom, Assign form. The greq
 * page covers the same ground inline; this is the deep link the mockup's
 * rows + rail point at. */

import { useState } from 'react';
import { useNav } from '../nav';
import { getGuild, assignWork } from '../guild';
import { AssignedMenu } from '../components/AssignedMenu';
import type { PageProps } from './index';

export default function AssignedPage(_props: PageProps) {
  void _props;
  const { notify } = useNav();
  const [tick, setTick] = useState(0);
  const [assigning, setAssigning] = useState(false);
  const [title, setTitle] = useState('');
  const [person, setPerson] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  void tick;

  const g = getGuild();
  const by = g.assigned.map((a, i) => ({ a, i })).filter(({ a }) => !a.mine);
  const to = g.assigned.filter((a) => a.mine) ?? [];

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
      <div className="card">
        <div className="g">
          <b>Assigned by you</b>
          <div className="xs m">Classroom builds the training — Guild assigns it. You see everyone's status.</div>
        </div>
        {by.map(({ a, i }) => (
          <div key={`${i}${a.who}${a.t}`} style={{ marginTop: 10 }}>
            <div className="kv" style={{ alignItems: 'center' }}>
              <span className="s g">
                {a.who} · {a.t}
              </span>
              <span>{a.pct}%</span>
              <AssignedMenu index={i} onChange={refresh} />
            </div>
            <div className="bar">
              <i style={{ width: `${a.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="g">
          <b>Assigned to you</b>
          <div className="xs m">Your progress only — nobody else's.</div>
        </div>
        {to.map((a) => (
          <div key={`${a.who}${a.t}`} style={{ marginTop: 10 }}>
            <div className="kv">
              <span className="s">{a.t}</span>
              <span>{a.pct}%</span>
            </div>
            <div className="bar">
              <i style={{ width: `${a.pct}%` }} />
            </div>
          </div>
        ))}
        <div className="btns">
          <button
            className="pri soon"
            onClick={() => notify('Opening assigned training in Classroom comes soon. Its course has not shipped yet.')}
          >
            Open in Classroom
          </button>
        </div>
      </div>
      {assigning ? (
        <div className="card">
          <b>Assign to a Guild member</b>
          <div className="ftabs">
            {g.people.map((p, pi) => (
              <button key={p.n} className={person === pi ? 'on' : ''} onClick={() => setPerson(pi)}>
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
        <div className="btns">
          <button className="gho" onClick={() => setAssigning(true)}>
            Assign work
          </button>
        </div>
      )}
    </div>
  );
}
