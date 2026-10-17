/* The ⋯ on a piece of work you assigned: rename it, hand it to someone
 * else, or delete it (Undo). Shared by Requests and Assigned work. */

import { useState } from 'react';
import { useNav } from '../nav';
import { getGuild, renameAssigned, reassign, deleteAssigned, snapshotGuild, restoreGuild } from '../guild';
import { ItemMenu, PickDialog } from './ItemMenu';
import { undoable } from '../undo';

export function AssignedMenu({ index, onChange }: { index: number; onChange: () => void }) {
  const { notify } = useNav();
  const [picking, setPicking] = useState(false);
  const g = getGuild();
  const a = g.assigned[index];
  if (!a) return null;
  return (
    <>
      <ItemMenu
        name={a.t}
        rename={{ value: a.t, title: 'Edit the ask', save: (v) => renameAssigned(index, v) }}
        extra={[{ label: 'Assign to someone else', onClick: () => setPicking(true) }]}
        onChange={onChange}
        onDelete={() => undoable(notify, 'Assignment deleted.', snapshotGuild, restoreGuild, () => deleteAssigned(index), onChange)}
      />
      {picking ? (
        <PickDialog
          title="Assign to"
          empty="No one in your Guild yet."
          rows={g.people.map((p, i) => ({ id: String(i), label: p.n, sub: p.n === a.who ? 'Has it now' : undefined }))}
          onCancel={() => setPicking(false)}
          onPick={(id) => {
            setPicking(false);
            const who = g.people[Number(id)]?.n;
            if (reassign(index, Number(id))) {
              onChange();
              notify(`Now assigned to ${who}.`);
            }
          }}
        />
      ) : null}
    </>
  );
}
