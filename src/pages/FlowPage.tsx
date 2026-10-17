/* Flow detail — steps with toggles, Enabled switch, schedule, Run, Edit. */

import { useState } from 'react';
import { useNav } from '../nav';
import { getFlows, saveFlow, deleteFlow, snapshotFlows, restoreFlows, toggleFlowStep, toggleFlowOn } from '../flows';
import { ItemMenu } from '../components/ItemMenu';
import { undoable } from '../undo';
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
      <div className="itemHead">
        <div className="g s m">
          {f.w} · {f.streak} day streak
        </div>
        <ItemMenu
          name={f.n}
          edit={() => go('flowedit', f.id)}
          rename={{ value: f.n, save: (v) => saveFlow({ ...f, n: v.slice(0, 60) }) }}
          onChange={refresh}
          onDelete={() => {
            back();
            undoable(notify, (f.kind === 'routine' ? 'Routine' : 'Flow') + ' deleted.', snapshotFlows, restoreFlows, () => deleteFlow(f.id));
          }}
        />
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
        <button className="pri soon" onClick={() => notify('Running a flow on its own comes soon. For now, check the steps off here.')}>
          Run now
        </button>
        <button onClick={() => go('flowedit', f.id)}>Edit flow</button>
      </div>
    </div>
  );
}
