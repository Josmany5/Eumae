/* Old version — the mockup's pgVer: read-only body + Restore as the new
 * current (restoreVersion). */

import { useMemo } from 'react';
import { useNav } from '../nav';
import { getFiles, restoreVersion } from '../library';
import { renderMd } from '../md';
import type { PageProps } from './index';

export default function VersionPage({ arg }: PageProps) {
  const { notify, back, go } = useNav();
  const [id, v] = typeof arg === 'string' ? arg.split('|') : ['', ''];
  const f = getFiles().find((x) => x.id === id);
  const ent = f?.hist?.find((h) => String(h.v) === v);
  const html = useMemo(() => renderMd(ent?.b || ''), [ent?.b]);
  if (!f || !ent) {
    back();
    return null;
  }
  return (
    <div style={{ maxWidth: '68ch' }}>
      <div className="screenT">
        {f.t} — v{v}
      </div>
      <div className="md" style={{ fontSize: 17, lineHeight: 1.65, marginTop: 12 }}>
        <span dangerouslySetInnerHTML={{ __html: html }} />
      </div>
      <div className="s m">Version {v} — read-only. Current is v{f.v}.</div>
      <div className="btns">
        <button
          className="pri"
          onClick={() => {
            const saved = restoreVersion(f.id, ent.v);
            notify(saved ? `Restored as v${saved.v}.` : 'Nothing there.');
            back();
            setTimeout(() => go('sitem', f.id), 50);
          }}
        >
          Restore as v{f.v + 1}
        </button>
        <button className="gho" onClick={back}>
          Back
        </button>
      </div>
    </div>
  );
}
