/* Create-your-own role — the mockup's pgRole: name, tone, style,
 * purpose. Save stores it and makes it the chat's active role. With an
 * arg naming a saved role it edits that one (prefilled) and can delete it. */

import { useState } from 'react';
import { useNav } from '../nav';
import { saveRole, findRole, deleteRole, snapshotRoles, restoreRoles } from '../roles';
import { logEv } from '../log';
import type { PageProps } from './index';

export default function RolePage({ arg }: PageProps) {
  const { notify, back, setTurn, turn } = useNav();
  const existing = typeof arg === 'string' ? findRole(arg) : undefined;
  const [n, setN] = useState(existing?.n ?? '');
  const [tone, setTone] = useState(existing?.tone ?? '');
  const [style, setStyle] = useState(existing?.style ?? '');
  const [purpose, setPurpose] = useState(existing?.purpose ?? '');

  const remove = () => {
    if (!existing) return;
    const snap = snapshotRoles();
    const wasActive = turn.role === existing.n;
    deleteRole(existing.n);
    if (wasActive) setTurn({ role: '' });
    notify('Role deleted.', {
      undo: () => {
        restoreRoles(snap);
        if (wasActive) setTurn({ role: existing.n });
      },
    });
    back();
  };

  return (
    <div>
      <div className="screenT">{existing ? 'Edit role' : 'Create your own role'}</div>
      <div className="s m" style={{ marginBottom: 10 }}>
        A role is how Eumae shows up for a chat — its tone, style, and purpose.
      </div>
      <input
        className="sinput"
        placeholder="Name — e.g. Co-founder"
        value={n}
        onChange={(e) => setN(e.target.value)}
        aria-label="Role name"
        style={{ marginBottom: 8 }}
      />
      <input
        className="sinput"
        placeholder="Tone — e.g. blunt, warm, funny"
        value={tone}
        onChange={(e) => setTone(e.target.value)}
        aria-label="Role tone"
        style={{ marginBottom: 8 }}
      />
      <input
        className="sinput"
        placeholder="Style — e.g. short answers, asks before doing"
        value={style}
        onChange={(e) => setStyle(e.target.value)}
        aria-label="Role style"
        style={{ marginBottom: 8 }}
      />
      <input
        className="sinput"
        placeholder="Purpose — e.g. pressure-test my ideas"
        value={purpose}
        onChange={(e) => setPurpose(e.target.value)}
        aria-label="Role purpose"
        style={{ marginBottom: 10 }}
      />
      <div className="btns">
        <button
          className="pri"
          onClick={() => {
            /* Renamed: drop the old row so the edit doesn't leave a twin. */
            if (existing && existing.n !== (n.trim() || 'Custom role')) deleteRole(existing.n);
            const name = saveRole({ n, tone, style, purpose });
            setTurn({ role: name });
            logEv({ area: 'Chat', text: `Set role to ${name}` });
            notify("Role saved — it's live on this chat.");
            back();
          }}
        >
          Save and use it
        </button>
        <button className="gho" onClick={back}>
          Cancel
        </button>
        {existing ? (
          <button className="gho danger" onClick={remove}>
            Delete
          </button>
        ) : null}
      </div>
    </div>
  );
}
