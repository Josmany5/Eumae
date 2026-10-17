/* Guild section — Contacts / Activity / Shared work / Marketplace on the
 * arg. Messages + Requests redirect to their pages. */

import { useState } from 'react';
import { getFromMarket } from '../market';
import { useNav } from '../nav';
import { getGuild, threadWith, copyInvite } from '../guild';
import type { PageProps } from './index';

const SECTIONS = ['Contacts', 'Activity', 'Shared work', 'Marketplace'];

export default function GuildSectionPage({ arg }: PageProps) {
  const { notify, go, goTab } = useNav();
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  void tick;

  const name = typeof arg === 'string' ? arg : 'Contacts';
  if (name === 'Messages') {
    go('gmsg');
    return null;
  }
  if (name === 'Requests') {
    go('greq');
    return null;
  }
  const section = SECTIONS.includes(name) ? name : 'Contacts';
  const g = getGuild();

  const take = (i: number) => {
    const item = g.market[i];
    if (!item) return;
    notify(getFromMarket(i));
    refresh();
  };

  return (
    <div>
      <div className="ftabs">
        {SECTIONS.map((s) => (
          <button key={s} className={section === s ? 'on' : ''} onClick={() => go('gsec', s)}>
            {s}
          </button>
        ))}
      </div>
      <div className="card cardPad">
        {section === 'Contacts'
          ? [
              ...g.people.map((p, pi) => (
                <div key={p.n} className="li">
                  <div className="fi" style={{ borderRadius: '50%' }}>
                    {p.ini}
                  </div>
                  <button className="g" style={{ textAlign: 'left' }} onClick={() => go('person', pi)}>
                    {p.n}
                  </button>
                  <button
                    className="fb"
                    onClick={() => {
                      const stamp = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                      go('gchat', threadWith(pi, stamp));
                    }}
                  >
                    Message
                  </button>
                </div>
              )),
              <div key="invite" className="li">
                <div className="fi" style={{ borderRadius: '50%' }}>
                  +
                </div>
                <div className="g">Invite someone</div>
                <button className="fb" onClick={() => void copyInvite(notify)}>
                  Invite
                </button>
              </div>,
            ]
          : null}
        {section === 'Activity'
          ? g.act.map((a) => (
              <div key={a.a} className="hi">
                <span className={`dt ${a.s}`} />
                <div>
                  {a.a}
                  <div className="xs m">
                    {a.t} · {a.w}
                  </div>
                </div>
              </div>
            ))
          : null}
        {section === 'Shared work'
          ? g.shared.map((x, xi) => {
              const p = g.people[x.p];
              return (
                <button key={x.n} className="li" style={{ width: '100%', textAlign: 'left' }} onClick={() => go('sharedv', xi)}>
                  <div className="fi">{x.k.slice(0, 3).toUpperCase()}</div>
                  <div className="g">
                    {x.n}
                    <div className="xs m">with {p ? p.n : 'Guild'}</div>
                  </div>
                  <span className="m">›</span>
                </button>
              );
            })
          : null}
        {section === 'Marketplace'
          ? [
              ...g.market.map((x, i) => (
                <div key={x.n} className="li">
                  <div className="g">
                    <b>{x.n}</b>
                    <div className="xs m">by @{x.by}</div>
                  </div>
                  {x.got ? (
                    <button className="fb" onClick={() => goTab('studio')}>
                      Open in Studio
                    </button>
                  ) : (
                    <button className="fb" onClick={() => take(i)}>
                      Add to Studio
                    </button>
                  )}
                </div>
              )),
              g.market.some((x) => x.got) ? (
                <div key="bought" className="li">
                  <div className="g">
                    <b>Saved and bought</b>
                    <div className="xs m">{g.market.filter((x) => x.got).length} items in your Studio</div>
                  </div>
                </div>
              ) : null,
            ]
          : null}
      </div>
    </div>
  );
}
