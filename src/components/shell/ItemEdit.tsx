import { useState } from 'react';
import { getProjects, projectOf, linkItem, unlinkItem, snapshotProjects, restoreProjects, type LinkKind } from '../../projects';
import { getGoals, goalOf, linkToGoal, unlinkFromGoal, isActiveGoal, snapshotGoals, restoreGoals, type GoalLinkKind } from '../../goals';

/* Mae's office edits in place (LOCKED Oct 21, his call): the item opens
 * read-only; Edit turns the same tab into the item's full form, its button
 * reads Done. Project and Goal are fields there, not a ⋯ menu. Delete sits in
 * red beside Edit. Every change shows the Undo pill. */

export interface Links {
  project: string;
  goal: string;
}

export function currentLinks(k: LinkKind, id: string): Links {
  const gk = k === 'task' || k === 'event' || k === 'note' ? (k as GoalLinkKind) : null;
  return { project: projectOf(k, id)?.id ?? '', goal: gk ? goalOf(gk, id)?.id ?? '' : '' };
}

/** Write the picked project and goal. Returns an undo for both stores. */
export function applyLinks(k: LinkKind, id: string, next: Links): () => void {
  const pSnap = snapshotProjects();
  const gSnap = snapshotGoals();
  const now = currentLinks(k, id);
  if (next.project !== now.project) {
    if (next.project) linkItem(next.project, k, id);
    else unlinkItem(k, id);
  }
  const gk = k === 'task' || k === 'event' || k === 'note' ? (k as GoalLinkKind) : null;
  if (gk && next.goal !== now.goal) {
    if (next.goal) linkToGoal(next.goal, gk, id);
    else unlinkFromGoal(gk, id);
  }
  return () => {
    restoreProjects(pSnap);
    restoreGoals(gSnap);
  };
}

/** Project (and Goal, for tasks and events) as plain selects. */
export function LinkFields({ value, onChange, withGoal }: { value: Links; onChange: (v: Links) => void; withGoal: boolean }) {
  const projects = getProjects();
  const goals = getGoals().filter((g) => isActiveGoal(g) || g.id === value.goal);
  return (
    <div className="evRow">
      <label>
        <span className="xs m">Project</span>
        <select className="sinput" value={value.project} onChange={(e) => onChange({ ...value, project: e.target.value })}>
          <option value="">None</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.n}</option>
          ))}
        </select>
      </label>
      {withGoal ? (
        <label>
          <span className="xs m">Goal</span>
          <select className="sinput" value={value.goal} onChange={(e) => onChange({ ...value, goal: e.target.value })}>
            <option value="">None</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>{g.t}</option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}

/** Edit and Delete. A repeating event asks which: this one or the series. */
export function ItemActs({ onEdit, onDelete, onDeleteOne }: { onEdit: () => void; onDelete: () => void; onDeleteOne?: () => void }) {
  const [asking, setAsking] = useState(false);
  if (asking && onDeleteOne) {
    return (
      <div className="itActs">
        <button className="danger" onClick={onDeleteOne}>Just this one</button>
        <button className="danger" onClick={onDelete}>The whole series</button>
        <button onClick={() => setAsking(false)}>Cancel</button>
      </div>
    );
  }
  return (
    <div className="itActs">
      <button className="pri" onClick={onEdit}>Edit</button>
      <button className="danger" onClick={() => (onDeleteOne ? setAsking(true) : onDelete())}>Delete</button>
    </div>
  );
}
