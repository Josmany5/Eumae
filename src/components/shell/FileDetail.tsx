/* Trash: restore-as-draft or empty. The mockup's libTrash sheet, inline. */
export function TrashPane({ trash, notify, refresh }: {
  trash: { t: string; k: string }[];
  notify: (m: string) => void;
  refresh: () => void;
}) {
  /* Emptying is the one delete with no way back, so it is the one that
     asks — in the app's own dialog, not the browser's. */
  const [asking, setAsking] = useState(false);
  if (!trash.length) return <div className="s m">Trash is empty.</div>;
  return (
    <>
      {asking ? (
        <ConfirmDialog
          title="Empty trash?"
          body={`${trash.length} item${trash.length === 1 ? '' : 's'} will be gone for good. This can't be undone.`}
          ok="Empty trash"
          onCancel={() => setAsking(false)}
          onOk={() => {
            setAsking(false);
            emptyTrash();
            notify('Trash emptied.');
            refresh();
          }}
        />
      ) : null}
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
          style={{ color: 'var(--rd)' }}
          onClick={() => setAsking(true)}
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
import { toggleFav, toggleStatus, restoreTrash, emptyTrash, folderOf, type LibFile } from '../../library';
import { useNav } from '../../nav';
import { ConfirmDialog } from '../ItemMenu';
import { removeFile } from '../FileMenu';

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
  const { go, notify: toast } = useNav();
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
        <button className="gho" onClick={() => go('edit', f.id)}>
          Edit
        </button>
        <button
          className="gho danger"
          onClick={() => {
            onClose();
            removeFile(toast, f.id, refresh);
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
