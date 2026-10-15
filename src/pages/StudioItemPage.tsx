/* Studio item — the mockup's pgStudioItem: same detail surface as the
 * Library (shared component), rooted at the file id arg. Trash returns to
 * Studio, not Library. */

import { useState } from 'react';
import { useNav } from '../nav';
import { getFiles, getFavs } from '../library';
import FileDetail from '../components/shell/FileDetail';
import type { PageProps } from './index';

export default function StudioItemPage(_props: PageProps) {
  void _props;
  const { notify, back } = useNav();
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
  return (
    <FileDetail
      file={f}
      fav={getFavs().includes(f.id)}
      notify={notify}
      refresh={refresh}
      onClose={back}
    />
  );
}
