/* File viewer — the mockup's pgView/fOpen: full page via nav.go, standard
 * back bar. Reader-cheap: 28px title, one muted meta line, markdown body
 * at 17px/1.65 capped at 68ch, Info collapsed section for folder/status/
 * version. Per-kind heroes: PDF page card, IMG gradient hero, WEB centered
 * card, LINK card with body as URL. Bodies stay plain strings rendered
 * through md.ts (escape-first, chat pattern) — no HTML migration. */

import { useMemo, useState } from 'react';
import { useNav } from '../nav';
import { getFiles, getFavs, folderOf } from '../library';
import { renderMd } from '../md';
import type { PageProps } from './index';
import { FileMenu } from '../components/FileMenu';
import { ProjectChip } from '../components/ItemMenu';

function fmtEdited(ms: number): string {
  const d = new Date(ms);
  const now = Date.now();
  const mins = Math.max(0, Math.round((now - ms) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function readMins(b: string): number {
  const words = b.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function FileHero({ k, t, b }: { k: string; t: string; b: string }) {
  const first = (b || '').split('\n')[0] || t;
  if (k === 'PDF') {
    return (
      <div
        style={{
          background: '#fff',
          color: '#141414',
          borderRadius: 8,
          padding: '28px 24px',
          minHeight: 200,
        }}
      >
        <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 14 }}>{t}</div>
        <div className="s">{first.slice(0, 140)}</div>
        <div style={{ marginTop: 26, color: '#888', fontSize: 12 }}>Page 1 of 1 · {t}.pdf</div>
      </div>
    );
  }
  if (k === 'IMG') {
    return (
      <div
        style={{
          height: 230,
          borderRadius: 12,
          background: 'linear-gradient(135deg,#3a2f00,#141414)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: 20,
        }}
      >
        <div>
          <div style={{ fontSize: 42 }}>▦</div>
          <div style={{ fontWeight: 700, marginTop: 8 }}>{first}</div>
        </div>
      </div>
    );
  }
  if (k === 'WEB') {
    return (
      <div className="card" style={{ padding: '22px 18px', textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>{t}</div>
        <div className="s m" style={{ marginTop: 6 }}>
          {first.slice(0, 140)}
        </div>
      </div>
    );
  }
  if (k === 'LINK') {
    return (
      <div className="card">
        <div className="s m">Link</div>
        <div style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{b || t}</div>
      </div>
    );
  }
  return null;
}

export default function ViewPage({ arg }: PageProps) {
  const { go, back } = useNav();
  const [infoOpen, setInfoOpen] = useState(false);
  const [, setTick] = useState(0);
  const id = typeof arg === 'string' ? arg : '';
  const f = getFiles().find((x) => x.id === id);
  const html = useMemo(() => renderMd(f?.b || ''), [f?.b]);
  if (!f) return <div className="empty">No file here.</div>;
  const fav = getFavs().includes(f.id);
  const meta = `${folderOf(f)} · v${f.v} · edited ${fmtEdited(f.createdAt)} · ${readMins(f.b)} min read`;
  return (
    <div style={{ maxWidth: '68ch' }}>
      <div className="itemHead">
        <div className="g">
          <div className="screenT">{f.t}</div>
          <div className="screenS">{meta}</div>
          <ProjectChip k="file" id={f.id} />
        </div>
        <FileMenu file={f} showOpen={false} onChange={() => setTick((t) => t + 1)} onDeleted={back} />
      </div>
      <div style={{ marginTop: 12 }}>
        <FileHero k={f.k} t={f.t} b={f.b} />
      </div>
      {f.b ? (
        <div className="md" style={{ fontSize: 17, lineHeight: 1.65, marginTop: 12 }}>
          <span dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      ) : (
        <div className="card">
          <b>Empty file</b>
          <div className="s m" style={{ marginTop: 4 }}>
            Ask Eumae to summarize — or open it in Studio and write the first line.
          </div>
          <div className="btns">
            <button className="gho" onClick={() => go('sitem', f.id)}>
              Open in Studio
            </button>
          </div>
        </div>
      )}
      <div className="btns gstick">
        <button className="pri" onClick={() => go('edit', f.id)}>
          Edit
        </button>
        <button className="gho" onClick={() => setInfoOpen((v) => !v)}>
          ⓘ Info
        </button>
      </div>
      {infoOpen ? (
        <div className="card">
          <div className="kv">
            <span className="m">Folder</span>
            <span>{folderOf(f)}</span>
          </div>
          <div className="kv">
            <span className="m">Status</span>
            <span>
              {f.st}
              {fav ? ' · ★' : ''}
            </span>
          </div>
          <div className="kv">
            <span className="m">Version</span>
            <span>v{f.v}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
