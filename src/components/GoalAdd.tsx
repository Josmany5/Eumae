/* Adding to a goal (his call, Oct 19): a new task, event or note made already
 * under the goal, or one you have linked to it. Shared by the goal's office
 * tab and the Goals page row menu so both doors behave the same. */

import { useState } from 'react';
import { useNav } from '../nav';
import { goalOf, linkToGoal, unlinkFromGoal, type Goal, type GoalLinkKind } from '../goals';
import { rowsOf, AddDialog, createOfKind, KIND_LABEL } from '../pages/ProjectPage';
import { PickDialog, type MenuEntry } from './ItemMenu';
import { dataChanged } from '../focus';

export function useGoalAdd(g: Goal | undefined, onChange: () => void) {
  const { notify } = useNav();
  const [adding, setAdding] = useState<GoalLinkKind | null>(null);
  const [linking, setLinking] = useState<GoalLinkKind | null>(null);
  const done = () => {
    onChange();
    dataChanged();
  };
  const entries: MenuEntry[] = (['task', 'event', 'note'] as GoalLinkKind[]).map((k) => ({ label: `Add ${KIND_LABEL[k].toLowerCase()}`, onClick: () => setAdding(k) }));
  const dialogs =
    !g ? null : (
      <>
        {adding ? (
          <AddDialog
            kind={adding}
            projectName={g.t}
            onCancel={() => setAdding(null)}
            onCreate={(text) => {
              const k = adding;
              setAdding(null);
              const id = createOfKind(k, text);
              if (!id) return;
              linkToGoal(g.id, k, id);
              done();
              notify(`${KIND_LABEL[k]} added to ${g.t}.`);
            }}
            onLink={() => {
              setLinking(adding);
              setAdding(null);
            }}
          />
        ) : null}
        {linking ? (
          <PickDialog
            title={`Link a ${KIND_LABEL[linking].toLowerCase()}`}
            empty="Nothing to link yet."
            rows={rowsOf(linking)
              .filter((r) => goalOf(linking, r.id)?.id !== g.id)
              .map((r) => {
                const other = goalOf(linking, r.id);
                return { id: r.id, label: r.label, sub: [r.sub, other ? 'Now under ' + other.t : ''].filter(Boolean).join(' · ') };
              })}
            onCancel={() => setLinking(null)}
            onPick={(rid) => {
              const k = linking;
              setLinking(null);
              linkToGoal(g.id, k, rid);
              done();
              notify(`Linked to ${g.t}.`, {
                undo: () => {
                  unlinkFromGoal(k, rid);
                  done();
                },
              });
            }}
          />
        ) : null}
      </>
    );
  return { entries, dialogs, add: setAdding };
}
