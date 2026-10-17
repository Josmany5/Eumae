/* The ⋯ for a Library file, the same everywhere a file shows: Library rows
 * and tiles, the file view, and Studio (Studio items are Library files).
 * Delete moves it to Trash with Undo; the word is "Delete" everywhere. */

import { useNav } from '../nav';
import { ItemMenu } from './ItemMenu';
import { undoable } from '../undo';
import {
  getFavs,
  toggleFav,
  toggleStatus,
  renameFile,
  trashFile,
  snapshotLibrary,
  restoreLibrary,
  type LibFile,
} from '../library';

export function removeFile(notify: (m: string, o?: { undo?: () => void }) => void, id: string, after?: () => void): void {
  undoable(notify, 'Moved to Trash.', snapshotLibrary, restoreLibrary, () => trashFile(id), after);
}

export function FileMenu({
  file,
  showOpen = true,
  openTo,
  onChange,
  onDeleted,
}: {
  file: LibFile;
  showOpen?: boolean;
  /** Where Open goes, when not the Library view (Studio opens its own page). */
  openTo?: () => void;
  onChange?: () => void;
  /** Runs right after the delete (a detail page goes back). */
  onDeleted?: () => void;
}) {
  const { go, notify } = useNav();
  const fav = getFavs().includes(file.id);
  return (
    <ItemMenu
      name={file.t}
      open={showOpen ? (openTo ?? (() => go('view', file.id))) : undefined}
      edit={() => go('edit', file.id)}
      rename={{ value: file.t, save: (v) => renameFile(file.id, v) }}
      extra={[
        {
          label: fav ? 'Remove from Favorites' : 'Add to Favorites',
          onClick: () => {
            toggleFav(file.id);
            onChange?.();
            notify(fav ? 'Removed from Favorites.' : 'Added to Favorites.');
          },
        },
        {
          label: file.st === 'draft' ? 'Publish' : 'Move back to drafts',
          onClick: () => {
            toggleStatus(file.id);
            onChange?.();
            notify(file.st === 'draft' ? 'Published.' : 'Back in drafts.');
          },
        },
      ]}
      link={{ k: 'file', id: file.id }}
      onChange={onChange}
      onDelete={() => {
        onDeleted?.();
        removeFile(notify, file.id, onChange);
      }}
    />
  );
}
