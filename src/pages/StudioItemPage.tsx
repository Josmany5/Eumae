/* Studio item — the mockup's pgStudioItem: kind-rendered body, status
 * line, Versions list with View, Edit-here for text kinds, Improve in
 * Chat (brief queue), Publish-to-folder. Trash returns to Studio. */

import { useState } from 'react';
import { useNav } from '../nav';
import { getFiles, getFavs, toggleFav, toggleStatus, folderOf } from '../library';
import { FileMenu, removeFile } from '../components/FileMenu';
import { ProjectChip } from '../components/ItemMenu';
import { queueBrief } from '../studio';
import { FileHero } from './ViewPage';
import type { PageProps } from './index';

const EDITABLE = ['DOC', 'WEB', 'LINK', 'COURSE', 'DIGEST'];

function fmtEdited(ms: number): string {
  const mins = Math.max(0, Math.round((Date.now() - ms) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function StudioItemPage(_props: PageProps) {
  void _props;
  const { notify, go, goTab, back } = useNav();
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  void tick;

  const { arg } = _props;
  const id = typeof arg === 'string' ? arg : '';
  const f = getFiles().find((x) => x.id === id);
  if (!f) {
    back();
    return null;
  }
  const fav = getFavs().includes(f.id);
  const vers = [...(f.hist ?? []), { v: f.v, b: f.b, at: f.createdAt }].slice().reverse();
  const editable = EDITABLE.includes(f.k);

  return (
    <div style={{ maxWidth: '68ch' }}>
      <div className="row" style={{ marginBottom: 8 }}>
        <div className="g">
          <div className="screenT">{f.t}</div>
          <ProjectChip k="file" id={f.id} />
        </div>
        <button
          className="fb"
          onClick={() => {
            notify(toggleFav(f.id) ? 'Starred.' : 'Unstarred.');
            refresh();
          }}
        >
          {fav ? '★ Favorited' : '☆ Favorite'}
        </button>
        <FileMenu file={f} showOpen={false} onChange={refresh} onDeleted={back} />
      </div>
      <FileHero k={f.k} t={f.t} b={f.b} />
      <div className="kv" style={{ marginTop: 8 }}>
        <span className="m">Status</span>
        <span>
          {f.st}
          {f.st === 'live' ? ` · in Library / ${folderOf(f)}` : ' · Studio only'}
        </span>
      </div>
      <div className="kv">
        <span className="m">Version</span>
        <span>v{f.v} of {f.v}</span>
      </div>
      <h3 className="sec">Versions</h3>
      <div className="card cardPad">
        {vers.map((x) => (
          <div key={x.v} className="li">
            <div className="g">
              <div>
                v{x.v}
                {x.v === f.v ? <span className="tag gr">current</span> : null}
              </div>
              <div className="xs m">{(x.b || '').split('\n')[0].slice(0, 60)}</div>
              <div className="xs m">{fmtEdited(x.at)}</div>
            </div>
            {x.v === f.v ? null : (
              <button className="fb" onClick={() => go('ver', `${f.id}|${x.v}`)}>
                View
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="btns gstick">
        {editable ? (
          <button className="pri" onClick={() => go('edit', f.id)}>
            Edit here
          </button>
        ) : null}
        <button
          className={editable ? '' : 'pri'}
          onClick={() => {
            queueBrief(`Improve: ${f.t}`);
            goTab('chat');
          }}
        >
          Improve in Chat
        </button>
      </div>
      <div className="btns">
        {f.st === 'draft' ? (
          <button
            className="gho"
            onClick={() => {
              toggleStatus(f.id);
              notify(`Published to ${folderOf(f)}.`);
              refresh();
            }}
          >
            Publish to Library…
          </button>
        ) : (
          <button
            className="gho"
            onClick={() => {
              toggleStatus(f.id);
              notify('Unpublished.');
              refresh();
            }}
          >
            Unpublish
          </button>
        )}
        <button
          className="gho"
          style={{ color: 'var(--rd)' }}
          onClick={() => {
            back();
            removeFile(notify, f.id);
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

