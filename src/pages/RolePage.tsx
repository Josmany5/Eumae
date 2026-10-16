/* Create-your-own role — the mockup's pgRole: name, tone, style,
 * purpose. Save stores it and makes it the chat's active role. */

import { useState } from 'react';
import { useNav } from '../nav';
import { saveRole } from '../roles';
import { logEv } from '../log';
import type { PageProps } from './index';

export default function RolePage(_props: PageProps) {
  void _props;
  const { notify, back, setTurn } = useNav();
  const [n, setN] = useState('');
  const [tone, setTone] = useState('');
  const [style, setStyle] = useState('');
  const [purpose, setPurpose] = useState('');

  return (
    <div>
      <div className="screenT">Create your own role</div>
      <div className="s m" style={{ marginBottom: 10 }}>
        A role is how Eumae shows up for a chat — its tone, style, and purpose.
      </div>
      <input
        placeholder="Name — e.g. Co-founder"
        value={n}
        onChange={(e) => setN(e.target.value)}
        aria-label="Role name"
        style={{ marginBottom: 8 }}
      />
      <input
        placeholder="Tone — e.g. blunt, warm, funny"
        value={tone}
        onChange={(e) => setTone(e.target.value)}
        aria-label="Role tone"
        style={{ marginBottom: 8 }}
      />
      <input
        placeholder="Style — e.g. short answers, asks before doing"
        value={style}
        onChange={(e) => setStyle(e.target.value)}
        aria-label="Role style"
        style={{ marginBottom: 8 }}
      />
      <input
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
      </div>
    </div>
  );
}
