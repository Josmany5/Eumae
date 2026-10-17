/* Flows list — flows + routines sections, New goes to the editor. */

import { useState } from 'react';
import { getFlows, saveFlow, deleteFlow, snapshotFlows, restoreFlows } from '../flows';
import { useNav } from '../nav';
import { ItemMenu } from '../components/ItemMenu';
import { undoable } from '../undo';
import { Icon } from '../components/shell/icons';
import type { PageProps } from './index';

export default function FlowsPage(_props: PageProps) {
  void _props;
  const { go, notify } = useNav();
  const [, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  const flows = getFlows();
  const fl = flows.filter((f) => f.kind !== 'routine');
  const rt = flows.filter((f) => f.kind === 'routine');
  const row = (id: string, n: string, w: string, streak: number, on: number) => (
    <div key={id} className="imWrap" style={{ border: '1px solid var(--hair)', borderRadius: 12, margin: '6px 0', paddingRight: 6 }}>
    <button className="dr" onClick={() => go('flow', id)}>
      <Icon name="zap" />
      <span className="g">
        <div>
          <b>{n}</b>
        </div>
        <div className="xs m">
          {w} · {streak} day streak
        </div>
      </span>
      <span className="xs m">{on ? 'on' : 'off'}</span>
    </button>
    <ItemMenu
      name={n}
      open={() => go('flow', id)}
      edit={() => go('flowedit', id)}
      rename={{
        value: n,
        save: (v) => {
          const f = getFlows().find((x) => x.id === id);
          if (f) saveFlow({ ...f, n: v.slice(0, 60) });
        },
      }}
      onChange={refresh}
      onDelete={() => undoable(notify, 'Deleted ' + n + '.', snapshotFlows, restoreFlows, () => deleteFlow(id), refresh)}
    />
    </div>
  );
  return (
    <div>
      <div className="s m">Flows and routines run on a schedule. Open one to run it, check steps off, or edit it.</div>
      <h3 className="sec">Flows</h3>
      {fl.length ? (
        fl.map((f) => row(f.id, f.n, f.w, f.streak, f.on))
      ) : (
        <div className="card s m">No flows yet. A flow is a checklist that runs on a schedule.</div>
      )}
      <h3 className="sec">Routines</h3>
      {rt.length ? (
        rt.map((f) => row(f.id, f.n, f.w, f.streak, f.on))
      ) : (
        <div className="card s m">No routines yet. A routine is the same steps on repeat.</div>
      )}
      <div className="btns">
        <button className="pri" onClick={() => go('flowedit', '')}>
          + New flow or routine
        </button>
      </div>
    </div>
  );
}
