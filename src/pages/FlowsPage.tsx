/* Flows list — flows + routines sections, New goes to the editor. */

import { getFlows } from '../flows';
import { useNav } from '../nav';
import { Icon } from '../components/shell/icons';
import type { PageProps } from './index';

export default function FlowsPage(_props: PageProps) {
  void _props;
  const { go } = useNav();
  const flows = getFlows();
  const fl = flows.filter((f) => f.kind !== 'routine');
  const rt = flows.filter((f) => f.kind === 'routine');
  const row = (id: string, n: string, w: string, streak: number, on: number) => (
    <button
      key={id}
      className="dr"
      style={{ border: '1px solid var(--hair)', borderRadius: 12, margin: '6px 0' }}
      onClick={() => go('flow', id)}
    >
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
      <button className="pri" style={{ width: '100%', marginTop: 10 }} onClick={() => go('flowedit', '')}>
        + New flow or routine
      </button>
    </div>
  );
}
