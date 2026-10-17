/* Library folder — the mockup's libf: the Library rooted at the folder
 * arg instead of Folders. */

import LibraryScreen, { type Sel } from '../screens/LibraryScreen';
import { LIB_VIEWS, type LibView } from '../library';
import type { PageProps } from './index';

/* `arg` is a folder name, or `view:Favorites` / `view:Recent` for one of the
   Library's views, or `trash` — the rail's Library rows land here. */
export default function LibraryFolderPage({ arg }: PageProps) {
  const a = typeof arg === 'string' ? arg : '';
  const view = a.startsWith('view:') ? (a.slice(5) as LibView) : null;
  const folder = a.split('|')[0];
  const initial: Sel =
    a === 'trash'
      ? { kind: 'trash' }
      : view && LIB_VIEWS.includes(view)
        ? { kind: 'view', view }
        : folder
          ? { kind: 'folder', folder }
          : { kind: 'view', view: 'Folders' };
  /* Keyed on the arg: a second rail tap must re-seed, not keep the old view. */
  return <LibraryScreen key={a} initial={initial} />;
}
