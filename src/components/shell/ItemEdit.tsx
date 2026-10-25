import { useState } from 'react';
import { projectOf, linkItem, unlinkItem, snapshotProjects, restoreProjects, type LinkKind } from '../../projects';
import { goalOf, linkToGoal, unlinkFromGoal, snapshotGoals, restoreGoals, type GoalLinkKind } from '../../goals';

/* Eumae's office edits in place (his call, Oct 21): the item opens read-only
 * as clean rows; Edit turns each row's value into an input right there (see
 * ItemFields.tsx), with no form swap. Done saves, Cancel reverts. Delete sits in red
 * beside Edit. Every change shows the Undo pill. */

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
