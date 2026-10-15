/* Library folder — the mockup's libf: the Library rooted at the folder
 * arg instead of Folders. */

import LibraryScreen, { type Sel } from '../screens/LibraryScreen';
import type { PageProps } from './index';

export default function LibraryFolderPage({ arg }: PageProps) {
  const folder = typeof arg === 'string' ? arg.split('|')[0] : '';
  const initial: Sel = folder ? { kind: 'folder', folder } : { kind: 'view', view: 'Folders' };
  return <LibraryScreen initial={initial} />;
}
