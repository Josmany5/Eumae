import { useCallback, useState } from 'react';
import Header from './components/shell/Header';
import TabBar, { type TabId } from './components/shell/TabBar';
import Drawer, { DrawerBody } from './components/shell/Drawer';
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
  const isMobile = () => window.matchMedia('(max-width: 899px)').matches;
  const pickDrawer = useCallback((label: string) => {
    if (isMobile()) setDrawerOpen(false);
    if (label === 'Settings') {
      setSettingsOpen(true);
      return;
    }
    notify(`${label} arrives with its screen`);
  }, [notify]);
  const searchDrawer = useCallback(() => {
    if (isMobile()) setDrawerOpen(false);
    notify('Search arrives in Stage 6');
  }, [notify]);

  return (
    <div id="app">
      <Header
        onMenu={() => setDrawerOpen((v) => !v)}
        onActivity={() => setSheetOpen(true)}
      />
      <div className="belowhead">
        {drawerOpen && (
          <aside className="sidebardock">
            <DrawerBody tab={tab} onPick={pickDrawer} onSearch={searchDrawer} />
          </aside>
        )}
        <div className="maincol">
          <main id="mn" />
          <TabBar active={tab} onChange={setTab} />
        </div>
      </div>
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} tab={tab} onPick={pickDrawer} onSearch={searchDrawer} />
      <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} notify={notify} />
      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Activity" />
      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
