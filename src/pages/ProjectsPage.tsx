/* Projects list — the mockup's pgProjects: count header + New, All /
 * Active / Done filter, cards with progress + pin-to-Console. Detail lives
 * in ProjectPage (arg = project id).
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
import type { PageProps } from './index';

type ProjFilter = 'all' | 'active' | 'done';

export default function ProjectsPage(_props: PageProps) {
  void _props;
  const { notify, go } = useNav();
  const [filter, setFilter] = useState<ProjFilter>('all');
  const [tick, setTick] = useState(0);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const refresh = () => setTick((t) => t + 1);
  void tick;

  const all = getProjects();
  const list = all.filter((p) => filter === 'all' || projectStatus(p) === filter);
  const active = all.filter((p) => projectStatus(p) === 'active').length;
  const pin = getPinnedProjectId() ?? 'w1';

  const submit = () => {
    if (!name.trim()) {
      notify('Name it first.');
      return;
    }
    createProject(name.trim().slice(0, 48));
    setName('');
    setNaming(false);
    refresh();
  };

  return (
    <div>
      <div className="m">All your projects in one place.</div>
      <div className="card" style={{ padding: 14, marginBottom: 12 }}>
        <b>
          {all.length} project{all.length === 1 ? '' : 's'}
        </b>
        <div className="s m">{active} active</div>
        <div className="btns">
          {naming ? (
            <span className="g" style={{ display: 'flex', gap: 8, flex: 1 }}>
              <input
                className="lib2-search"
                placeholder="Project name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submit();
                  if (e.key === 'Escape') setNaming(false);
                }}
                aria-label="New project name"
              />
              <button className="pri" onClick={submit}>
                Create
              </button>
            </span>
          ) : (
            <button className="pri" onClick={() => setNaming(true)}>
              New project
            </button>
          )}
        </div>
      </div>
      <div className="ftabs">
        {(['all', 'active', 'done'] as ProjFilter[]).map((f) => (
          <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
            {f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>
      {list.map((p) => {
        const pc = projectPercent(p);
        const pinned = pin === p.id;
        return (
          <div key={p.id} className="card" style={{ padding: 14, marginBottom: 10 }}>
            <button className="g" style={{ textAlign: 'left', width: '100%' }} onClick={() => go('project', p.id)}>
              <div className="row">
                <div className="g">
                  <b>{p.n}</b>
                </div>
                <span className="xs m">{projectStatus(p)}</span>
              </div>
              <div className="s m">{p.d}</div>
              <div className="bar">
                <i style={{ width: `${pc}%` }} />
              </div>
              <div className="xs m">{pc}%</div>
            </button>
            <div className="btns">
              <button
                className={pinned ? 'pri' : 'gho'}
                onClick={() => {
                  setPinnedProjectId(p.id);
                  refresh();
                  notify('Pinned to Console.');
                }}
              >
                {pinned ? 'Pinned to Console' : 'Pin to Console'}
              </button>
            </div>
          </div>
        );
      })}
      {list.length === 0 ? (
        <div className="card s m" style={{ padding: 20, textAlign: 'center' }}>
          No projects here.
        </div>
      ) : null}
    </div>
  );
}
