import { useCallback, useState } from 'react';
import Header from './components/shell/Header';
import TabBar, { type TabId } from './components/shell/TabBar';
import Drawer from './components/shell/Drawer';
import Sheet from './components/shell/Sheet';
import Toast from './components/shell/Toast';
import Settings from './components/settings/Settings';
import Sidebar from './components/shell/Sidebar';
import { SCREENS, LABELS } from './screens';

export default function App() {
  const [tab, setTab] = useState<TabId>('chat');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const notify = useCallback((msg: string) => setToast(msg), []);
  const Screen = SCREENS[tab];

  const pickDrawer = useCallback((label: string) => {
    setDrawerOpen(false);
    if (label === 'Settings') {
      setSettingsOpen(true);
      return;
    }
    notify(`${label} arrives with its screen`);
  }, [notify]);

  const search = useCallback(() => notify('Search arrives in a later stage'), [notify]);

  return (
    <div id="app">
      <Sidebar
        active={tab}
        onSelect={setTab}
        onNewChat={() => setTab('chat')}
        onSettings={() => setSettingsOpen(true)}
        onSearch={search}
      />
      <div className="col">
        <Header title={LABELS[tab]} onMenu={() => setDrawerOpen(true)} onActivity={() => setSheetOpen(true)} />
        <main id="mn">
          <Screen />
        </main>
        <TabBar active={tab} onChange={setTab} />
      </div>
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} tab={tab} onPick={pickDrawer} onSearch={search} />
      <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} notify={notify} />
      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Activity" />
      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
