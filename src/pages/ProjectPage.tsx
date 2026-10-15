/* Project detail — the mockup's pgProject: progress card with
 * rename/delete/pin, tasks preview, files preview. Chat scoping rides the
 * turn (Studio brief pattern) — the scope toast becomes a real queued ask.
 */

import { useState } from 'react';
import { useNav } from '../nav';
import {
  getProject,
  saveProject,
  deleteProject,
  getPinnedProjectId,
  setPinnedProjectId,
  projectPercent,
} from '../projects';
import { getTasks, toggleTask } from '../tasks';
import { getFiles } from '../library';
import { queueBrief } from '../studio';
import type { PageProps } from './index';

export default function ProjectPage({ arg }: PageProps) {
  const { notify, go, goTab, back } = useNav();
  const [tick, setTick] = useState(0);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState('');
  const refresh = () => setTick((t) => t + 1);
  void tick;

  const id = typeof arg === 'string' ? arg : '';
  const p = getProject(id) ?? getProject('w1');
  if (!p) return <div className="empty">No projects.</div>;
  const pc = projectPercent(p);
  const pin = getPinnedProjectId() ?? 'w1';
  const tasks = getTasks().slice(0, 3);
  const files = getFiles().slice(0, 3);

  const submitRename = () => {
    if (!name.trim()) {
      notify('Name it first.');
      return;
    }
    saveProject({ ...p, n: name.trim().slice(0, 48) });
    setRenaming(false);
    refresh();
  };

  return (
    <div>
      <div className="m">{p.d}</div>
      <div className="card">
        <div className="row">
          <div className="g">
            <b>Progress</b>
          </div>
          <div className="xs m">{pc}%</div>
        </div>
        <div className="bar">
          <i style={{ width: `${pc}%` }} />
        </div>
        {renaming ? (
          <span style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input
              className="lib2-search"
              placeholder="Project name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitRename();
                if (e.key === 'Escape') setRenaming(false);
              }}
              aria-label="Project name"
            />
            <button className="fb" onClick={submitRename}>
              Save
            </button>
          </span>
        ) : (
          <div className="btns">
            <button
              className="fb"
              onClick={() => {
                setName(p.n);
                setRenaming(true);
              }}
            >
              Rename
            </button>
            <button
              className="fb"
              style={{ color: 'var(--rd)' }}
              onClick={() => {
                deleteProject(p.id);
                notify('Project deleted.');
                back();
              }}
            >
              Delete project
            </button>
          </div>
        )}
        <div className="btns">
          <button
            className="pri"
            onClick={() => {
              setPinnedProjectId(p.id);
              refresh();
              notify(pin === p.id ? 'Pinned to Console.' : 'Pinned to Console.');
            }}
          >
            {pin === p.id ? 'Pinned to Console' : 'Pin to Console'}
          </button>
          <button
            className="gho"
            onClick={() => {
              queueBrief(`Working in project ${p.n}: `);
              goTab('chat');
            }}
          >
            Chat in this project
          </button>
        </div>
      </div>
      <h3 className="sec">Tasks</h3>
      <div className="card cardPad">
        {tasks.map((t) => (
          <div key={t.id} className="task">
            <button
              className={'ck' + (t.d ? ' d' : '')}
              aria-label={t.d ? `Reopen ${t.t}` : `Done: ${t.t}`}
              onClick={() => {
                toggleTask(t.id);
                refresh();
              }}
            />
            <div className="g">{t.d ? <s className="m">{t.t}</s> : t.t}</div>
          </div>
        ))}
        {tasks.length === 0 ? <div className="s m">No tasks.</div> : null}
        <div className="btns">
          <button className="fb" onClick={() => go('tasks')}>
            All tasks
          </button>
        </div>
      </div>
      <h3 className="sec">Files</h3>
      <div className="card cardPad">
        {files.map((f) => (
          <div key={f.id} className="li">
            <div className="fi">{f.k.slice(0, 4)}</div>
            <div className="g">{f.t}</div>
          </div>
        ))}
        {files.length === 0 ? <div className="s m">No files.</div> : null}
      </div>
    </div>
  );
}
