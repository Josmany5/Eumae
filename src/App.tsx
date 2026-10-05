import { useCallback, useState } from 'react';
import Header from './components/shell/Header';
import TabBar, { type TabId } from './components/shell/TabBar';
import Drawer from './components/shell/Drawer';
import Sheet from './components/shell/Sheet';
import Toast from './components/shell/Toast';
import Settings from './components/settings/Settings';

export default function App() {
  const [tab, setTab] = useState<TabId>('chat');
  const [drawerOpen, setDrawerOpen] = useState(() => window.matchMedia('(min-width: 900px)').matches);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const notify = useCallback((msg: string) => setToast(msg), []);
  const pickDrawer = useCallback((label: string) => {
    setDrawerOpen(false);
    if (label === 'Settings') {
      setSettingsOpen(true);
      return;
    }
    notify(`${label} arrives with its screen`);
  }, [notify]);
  const searchDrawer = useCallback(() => {
    setDrawerOpen(false);
    notify('Search arrives in Stage 6');
  }, [notify]);

  return (
    <div id="app">
      <Header
        onMenu={() => setDrawerOpen((v) => !v)}
        onActivity={() => setSheetOpen(true)}
      />
      <main id="mn" />
      <TabBar active={tab} onChange={setTab} />
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} tab={tab} onPick={pickDrawer} onSearch={searchDrawer} />
      <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} notify={notify} />
      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Activity" />
      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
