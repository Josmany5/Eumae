/* Projects full page — same shape as Tasks and Goals.
 *
 * One-line add (the whole line is the name), a segment for
 * All / Active / Done, one card of rows with a thin progress bar. The star
 * pins a project to the Console.
 */

import { useEffect, useState } from 'react';
import { useNav } from '../nav';
import {
  getProjects,
  createProject,
  saveProject,
  projectStatus,
  projectPercent,
  projectCountLabel,
  deleteProject,
  snapshotProjects,
  restoreProjects,
  setProjectDone,
} from '../projects';
import { ItemMenu } from '../components/ItemMenu';
import { undoable } from '../undo';
import { snapshotDash, restoreDash, removePage, addProjectPage, projectPageIndex } from '../dash';
import { daysLeft } from '../due';
import { rowTap } from '../rowTap';
import { QuickAdd } from '../components/QuickAdd';
import type { Quick } from '../quickadd';
import { fmtShort } from '../quickadd';
import { nextMilestone } from '../milestones';
import { openOfficeEdit, onDataChange } from '../focus';
import type { PageProps } from './index';

type ProjFilter = 'all' | 'active' | 'done';

export default function ProjectsPage(_props: PageProps) {
  void _props;
  const { notify, go, openPanel } = useNav();
  const editInOffice = (id: string) => {
    openOfficeEdit('project', id);
    openPanel('item');
  };

  const [filter, setFilter] = useState<ProjFilter>('all');
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  void tick;
  useEffect(() => onDataChange(refresh), []);

  const all = getProjects();
  const list = all.filter((p) => filter === 'all' || projectStatus(p) === filter);
  const active = all.filter((p) => projectStatus(p) === 'active').length;

  const make = (q: Quick) => {
    const p = createProject(q.title.slice(0, 48));
    if (q.date) saveProject({ ...p, due: q.date });
    refresh();
    notify('Project created.');
    return p;
  };
  const pin = (id: string, name: string) => {
    const at = projectPageIndex(id);
    if (at >= 0) {
      undoable(notify, 'Removed from Console.', snapshotDash, restoreDash, () => removePage(at), refresh);
      return;
    }
    const snap = snapshotDash();
    addProjectPage(id, name);
    refresh();
    notify('Added to Console as its own page.', { undo: () => { restoreDash(snap); refresh(); } });
  };

  return (
    <div className="qaPage">
      <QuickAdd
        kind="project"
        placeholder="New project"
        hint="Name the outcome, add a deadline if there is one: “Launch the Saggio site by Nov 20”"
        onAdd={(q) => go('project', make(q).id)}
        /* More: make it, then open its office tab ready to edit, for the
           description, deadline and milestones (his ask, Oct 21). */
        onMore={(q) => {
          if (!q.title.trim()) return;
          const p = make(q);
          go('project', p.id);
          editInOffice(p.id);
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
      <div className="tkList">
        <section className="tkGroup">
          {list.map((p) => {
            const pc = projectPercent(p);
            const pinned = projectPageIndex(p.id) >= 0;
            const left = p.due ? daysLeft(p.due) : null;
            const next = nextMilestone(p.ms);
            const done = projectStatus(p) === 'done';
            return (
              <div key={p.id} className={'frow top tkRow gRow tapRow' + (done ? ' past' : '')} onClick={rowTap(() => go('project', p.id))}>
                <div className="ft">
                  <button className="tlT" onClick={() => go('project', p.id)}>
                    <span>{p.n}</span>
                    <span className="gPct">{pc}%</span>
                  </button>
                  <div className="fsub">
                    {projectCountLabel(p)}
                    {p.d ? ' · ' + p.d : ''}
                  </div>
                  <span className="gBar">
                    <i style={{ width: `${pc}%` }} />
                  </span>
                </div>
                {pinned ? <span className="tkPill">Console</span> : null}
                <span className="fmeta gSide">
                  {p.due ? <span className={left?.red ? 'over' : ''}>{fmtShort(p.due)} · {left?.text}</span> : <span>No deadline</span>}
                  {next ? <span className="gNext">Next: {next.t}</span> : null}
                </span>
                <ItemMenu
                  name={p.n}
                  /* No Open here: tapping the row opens the project (his call, Oct 22). */
                  edit={() => editInOffice(p.id)}
                  extra={[
                    { label: pinned ? 'Remove from Console' : 'Pin to Console', onClick: () => pin(p.id, p.n) },
                    {
                      label: done ? 'Reopen project' : 'Mark complete',
                      onClick: () => {
                        setProjectDone(p.id, !done);
                        refresh();
                        notify(done ? 'Project reopened.' : `${p.n} is complete.`, { undo: () => { setProjectDone(p.id, done); refresh(); } });
                      },
                    },
                  ]}
                  onChange={refresh}
                  onDelete={() => {
                    const snapP = snapshotProjects();
                    const snapD = snapshotDash();
                    const at = projectPageIndex(p.id);
                    deleteProject(p.id);
                    if (at >= 0) removePage(at);
                    refresh();
                    notify(`Deleted ${p.n}.`, { undo: () => { restoreProjects(snapP); restoreDash(snapD); refresh(); } });
                  }}
                />
              </div>
            );
          })}
          {list.length === 0 ? <p className="oIntro">No projects here.</p> : null}
        </section>
      </div>
    </div>
  );
}
