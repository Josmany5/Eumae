/* Projects full page — same shape as Tasks and Goals.
 *
 * One-line add (the whole line is the name), a segment for
 * All / Active / Done, one card of rows with a thin progress bar. The star
 * pins a project to the Console.
 */

import { useState } from 'react';
import { useNav } from '../nav';
import {
  getProjects,
  createProject,
  getPinnedProjectId,
  setPinnedProjectId,
  projectStatus,
  projectPercent,
} from '../projects';
import { QuickAdd } from '../components/QuickAdd';
import { Icon } from '../components/shell/icons';
import type { PageProps } from './index';

type ProjFilter = 'all' | 'active' | 'done';

export default function ProjectsPage(_props: PageProps) {
  void _props;
  const { notify, go } = useNav();
  const [filter, setFilter] = useState<ProjFilter>('all');
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  void tick;

  const all = getProjects();
  const list = all.filter((p) => filter === 'all' || projectStatus(p) === filter);
  const active = all.filter((p) => projectStatus(p) === 'active').length;
  const pin = getPinnedProjectId() ?? 'w1';

  return (
    <div className="qaPage">
      <QuickAdd
        kind="project"
        parse={false}
        placeholder="New project"
        hint="Name the outcome, not the activity: “Launch the Saggio site”"
        onAdd={(q) => {
          const p = createProject(q.title.slice(0, 48));
          refresh();
          notify('Project created.');
          go('project', p.id);
        }}
      />
      <div className="tkBar">
        <div className="calSeg" role="tablist" aria-label="Show">
          {(['all', 'active', 'done'] as ProjFilter[]).map((f) => (
            <button key={f} role="tab" aria-selected={filter === f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
              {f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <span className="xs m" style={{ alignSelf: 'center' }}>
          {all.length} project{all.length === 1 ? '' : 's'} · {active} active
        </span>
      </div>
      <div className="card cardPad">
        {list.map((p) => {
          const pc = projectPercent(p);
          const pinned = pin === p.id;
          return (
            <div key={p.id} className="pjRow">
              <button className="pjMain" onClick={() => go('project', p.id)}>
                <span className="pjTop">
                  <b>{p.n}</b>
                  <span className="xs m">
                    {p.dn}/{p.ts} · {pc}%
                  </span>
                </span>
                {p.d ? <span className="xs m pjDesc">{p.d}</span> : null}
                <span className={'pjBar' + (pc >= 100 ? ' done' : '')}>
                  <i style={{ width: `${pc}%` }} />
                </span>
              </button>
              <button
                className={'pjPin' + (pinned ? ' on' : '')}
                aria-pressed={pinned}
                aria-label={pinned ? 'Pinned to Console' : 'Pin to Console'}
                title={pinned ? 'Pinned to Console' : 'Pin to Console'}
                onClick={() => {
                  setPinnedProjectId(p.id);
                  refresh();
                  notify('Pinned to Console.');
                }}
              >
                <Icon name="str" />
              </button>
            </div>
          );
        })}
        {list.length === 0 ? <div className="s m">No projects here.</div> : null}
      </div>
      <div className="xs m calFoot">The star pins one project to your Console.</div>
    </div>
  );
}
