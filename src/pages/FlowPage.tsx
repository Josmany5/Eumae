/* Flow detail — steps with toggles, Enabled switch, schedule, Run, Edit. */

import { useState } from 'react';
import { useNav } from '../nav';
import { getFlows, toggleFlowStep, toggleFlowOn } from '../flows';
import type { PageProps } from './index';

export default function FlowPage({ arg }: PageProps) {
  const { notify, go, back } = useNav();
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  void tick;

  const id = typeof arg === 'string' ? arg : '';
  const f = getFlows().find((x) => x.id === id);
  if (!f) {
    back();
    return null;
  }
  return (
    <div>
      <div className="s m">
        {f.w} · {f.streak} day streak
      </div>
      <h3 className="sec">Steps</h3>
      <div className="card cardPad">
        {f.steps.map((s, i) => (
          <div key={i} className="task">
            <button
              className={'ck' + (f.done.includes(i) ? ' d' : '')}
              aria-label={s}
              onClick={() => {
                toggleFlowStep(f.id, i);
                refresh();
              }}
            />
            <div className="g">{s}</div>
          </div>
        ))}
      </div>
      <h3 className="sec">Settings</h3>
      <div className="card cardPad">
        <div className="gr">
          <div className="g">
            <b>Enabled</b>
          </div>
          <button
            className={'tg' + (f.on ? ' on' : '')}
            aria-label="toggle"
            onClick={() => {
              toggleFlowOn(f.id);
              refresh();
            }}
          />
        </div>
        <div className="gr">
          <div className="g">
            <b>Schedule</b>
          </div>
          <span className="m">{f.w}</span>
        </div>
      </div>
      <div className="btns">
        <button className="pri" onClick={() => notify(`${f.n} running…`)}>
          Run now
        </button>
        <button onClick={() => go('flowedit', f.id)}>Edit flow</button>
      </div>
    </div>
  );
}
