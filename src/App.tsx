import { useCallback, useState } from 'react';
import Header from './components/shell/Header';
import TabBar, { type TabId } from './components/shell/TabBar';
import Drawer from './components/shell/Drawer';
import Sheet from './components/shell/Sheet';
import Toast from './components/shell/Toast';

const TAB_TITLES: Record<TabId, string> = {
  chat: 'Eumae',
  console: 'Console',
  studio: 'Studio',
  library: 'Library',
  classroom: 'Classroom',
  guild: 'Guild',
};

export default function App() {
  const [tab, setTab] = useState<TabId>('chat');
  const [drawerOpen, setDrawerOpen] = useState(() => window.matchMedia('(min-width: 900px)').matches);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const notify = useCallback((msg: string) => setToast(msg), []);
  const pickDrawer = useCallback((label: string) => {
    setDrawerOpen(false);
    notify(`${label} arrives with its screen`);
  }, [notify]);
  const searchDrawer = useCallback(() => {
    setDrawerOpen(false);
    notify('Search arrives in Stage 6');
  }, [notify]);

  return (
    <div id="app">
      <Header
        title={TAB_TITLES[tab]}
        onMenu={() => setDrawerOpen((v) => !v)}
        onActivity={() => setSheetOpen(true)}
        onSettings={() => notify('Settings arrives in Stage 6')}
      />
      <main id="mn" />
      <TabBar active={tab} onChange={setTab} />
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} tab={tab} onPick={pickDrawer} onSearch={searchDrawer} />
      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Activity" />
      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
