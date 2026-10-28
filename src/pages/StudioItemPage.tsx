/* Studio item — the mockup's pgStudioItem: kind-rendered body, status
 * line, Versions list with View, Edit-here for text kinds, Improve in
 * Chat (brief queue), Publish-to-folder. Trash returns to Studio. */

import { useState } from 'react';
import { useNav } from '../nav';
import { getFiles, getFavs, toggleFav, toggleStatus, folderOf, restoreVersion, snapshotLibrary, restoreLibrary } from '../library';
import { undoable } from '../undo';
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
            const on = toggleFav(f.id);
            notify(on ? 'Added to Favorites.' : 'Removed from Favorites.', { undo: () => { toggleFav(f.id); refresh(); } });
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
      <div className="tkList" style={{ marginTop: 14 }}>
        <section className="tkGroup">
          <div className="sdiv tkH">
            <span>Versions</span>
            <span className="fmeta">{vers.length}</span>
          </div>
          {vers.map((x) => (
            <div key={x.v} className="frow top tkRow gRow">
              <div className="ft">
                <div className="tlT">
                  <span>v{x.v}{x.v === f.v ? ' · current' : ''}</span>
                </div>
                <div className="fsub">{fmtEdited(x.at)}{x.b ? ' · ' + x.b.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) : ''}</div>
              </div>
              {x.v === f.v ? null : (
                <>
                  <button className="fb" onClick={() => go('ver', `${f.id}|${x.v}`)}>
                    View
                  </button>
                  <button
                    className="fb"
                    onClick={() =>
                      undoable(notify, `Restored v${x.v} as v${f.v + 1}.`, snapshotLibrary, restoreLibrary, () => !!restoreVersion(f.id, x.v), refresh)
                    }
                  >
                    Restore
                  </button>
                </>
              )}
            </div>
          ))}
        </section>
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
            onClick={() =>
              undoable(notify, `Published to ${folderOf(f)}.`, snapshotLibrary, restoreLibrary, () => !!toggleStatus(f.id), refresh)
            }
          >
            Publish to Library
          </button>
        ) : (
          <button
            className="gho"
            onClick={() =>
              undoable(notify, 'Back in drafts.', snapshotLibrary, restoreLibrary, () => !!toggleStatus(f.id), refresh)
            }
          >
            Move back to drafts
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

