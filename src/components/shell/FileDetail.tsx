/* Trash: restore-as-draft or empty. The mockup's libTrash sheet, inline. */
export function TrashPane({ trash, notify, refresh }: {
  trash: { t: string; k: string }[];
  notify: (m: string) => void;
  refresh: () => void;
}) {
  if (!trash.length) return <div className="s m">Trash is empty.</div>;
  return (
    <>
      <div className="card cardPad">
        {trash.map((x, i) => (
          <div key={x.t + i} className="li">
            <div className="fi">{x.k.slice(0, 4)}</div>
            <div className="g">{x.t}</div>
            <button
              className="fb"
              onClick={() => {
                restoreTrash(i);
                notify('Restored.');
                refresh();
              }}
            >
              Restore
            </button>
          </div>
        ))}
      </div>
      <div className="btns">
        <button
          className="gho"
          onClick={() => {
            if (!window.confirm('Empty trash? This cannot be undone.')) return;
            emptyTrash();
            notify('Trash emptied.');
            refresh();
          }}
        >
          Empty trash
        </button>
      </div>
    </>
  );
}

/* Shared file detail — the Library inline detail extracted so Studio's
 * sitem page renders the same surface: title/body/type/status/version
 * with Publish flip, Edit bump, fav star, trash. */

import { useState } from 'react';
import { toggleFav, toggleStatus, bumpVersion, trashFile, restoreTrash, emptyTrash, folderOf, type LibFile } from '../../library';

export default function FileDetail({
  file,
  fav,
  notify,
  refresh,
  onClose,
}: {
  file: LibFile;
  fav: boolean;
  notify: (m: string) => void;
  refresh: () => void;
  onClose: () => void;
}) {
  const [f, setF] = useState<LibFile>(file);
  const act = (msg: string, fn: () => LibFile | boolean | null) => {
    const out = fn();
    if (out === false || out === null) {
      notify('Nothing there.');
      return;
    }
    if (typeof out === 'object') setF({ ...out });
    notify(msg);
    refresh();
  };
  return (
    <div>
      <div className="row" style={{ marginBottom: 8 }}>
        <div className="g">
          <div className="screenT">{f.t}</div>
        </div>
        <button className="fb" onClick={() => act(fav ? 'Unstarred.' : 'Starred.', () => toggleFav(f.id))}>
          {fav ? '★' : '☆'}
        </button>
      </div>
      <div className="card">{f.b || 'No preview.'}</div>
      <div className="kv">
        <span className="m">Type</span>
        <span>{f.k}</span>
      </div>
      <div className="kv">
        <span className="m">Status</span>
        <span>{f.st}</span>
      </div>
      <div className="kv">
        <span className="m">Version</span>
        <span>v{f.v}</span>
      </div>
      <div className="kv">
        <span className="m">Folder</span>
        <span>{folderOf(f)}</span>
      </div>
      <div className="btns">
        <button
          className="pri"
          onClick={() => act(f.st === 'draft' ? 'Published.' : 'Unpublished.', () => toggleStatus(f.id))}
        >
          {f.st === 'draft' ? 'Publish' : 'Unpublish'}
        </button>
        <button className="gho" onClick={() => act('Edited.', () => bumpVersion(f.id))}>
          Edit
        </button>
        <button
          className="gho"
          onClick={() => {
            trashFile(f.id);
            notify('Trashed.');
            onClose();
          }}
        >
          Trash
        </button>
      </div>
    </div>
  );
}
