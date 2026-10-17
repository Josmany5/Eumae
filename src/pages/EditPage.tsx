/* File editor — the mockup's pgEdit: title + body textarea, Save pushes
 * hist and bumps v (saveEdit). Bodies stay plain strings (markdown);
 * no HTML migration. */

import { useState } from 'react';
import { useNav } from '../nav';
import { getFiles, saveEdit } from '../library';
import type { PageProps } from './index';

export default function EditPage({ arg }: PageProps) {
  const { notify, back } = useNav();
  const id = typeof arg === 'string' ? arg : '';
  const f = getFiles().find((x) => x.id === id);
  const [t, setT] = useState(f?.t ?? '');
  const [b, setB] = useState(f?.b ?? '');
  if (!f) {
    back();
    return null;
  }
  return (
    <div>
      <input
        className="sinput"
        value={t}
        onChange={(e) => setT(e.target.value)}
        placeholder="Title"
        aria-label="Title"
        style={{ fontSize: 22, fontWeight: 700, marginBottom: 10 }}
      />
      <textarea
        className="sinput"
        value={b}
        onChange={(e) => setB(e.target.value)}
        placeholder="Start writing…"
        aria-label="Body"
        style={{ minHeight: 220 }}
      />
      <div className="btns">
        <button
          className="pri"
          onClick={() => {
            const saved = saveEdit(f.id, t, b);
            notify(saved ? `Save — becomes v${saved.v}` : 'Nothing there.');
            back();
          }}
        >
          Save — becomes v{f.v + 1}
        </button>
        <button className="gho" onClick={back}>
          Cancel
        </button>
      </div>
      <div className="s m">The old text stays in the version list in Studio.</div>
    </div>
  );
}
