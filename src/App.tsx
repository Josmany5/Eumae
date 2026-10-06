import { useCallback, useMemo, useRef, useState, type ChangeEvent } from 'react';
import Header from './components/shell/Header';
import TabBar, { type TabId } from './components/shell/TabBar';
import Drawer from './components/shell/Drawer';
import AddSheet from './components/shell/AddSheet';
import Toast from './components/shell/Toast';
import Settings from './components/settings/Settings';
import Sidebar from './components/shell/Sidebar';
import RightPanel, { type Ref } from './components/shell/RightPanel';
import { Icon } from './components/shell/icons';
import { SCREENS, LABELS } from './screens';
import { PAGES, pageTitle } from './pages';
import { NavContext, DEFAULT_TURN, type Nav, type PanelView, type Turn } from './nav';
import { logEv } from './log';

/** A sub-page pushed on top of the current tab — the mockup's pageSt entry. */
interface Pushed {
  page: string;
  arg?: unknown;
}

export default function App() {
  const [tab, setTab] = useState<TabId>('chat');
  const [stack, setStack] = useState<Pushed[]>([]);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // The panel. `panelView` deliberately outlives `panelOpen`, so closing it and
  // coming back lands you on the reading you were in, not back on Context.
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelView, setPanelView] = useState<PanelView>('context');
  /** What Eumae is holding on this conversation. Local until the files work. */
  const [refs, setRefs] = useState<Ref[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  /** How Eumae answers on this chat — the `+` menu writes it, the chip above
   *  the input reads it back. */
  const [turn, setTurnState] = useState<Turn>(DEFAULT_TURN);

  const notify = useCallback((msg: string) => setToast(msg), []);

  const closePanel = useCallback(() => setPanelOpen(false), []);
  const openPanel = useCallback((view: PanelView = 'context') => {
    setPanelView(view);
    setPanelOpen(true);
  }, []);
  const togglePanel = useCallback(() => setPanelOpen((o) => !o), []);
  const openAdd = useCallback(() => setAddOpen(true), []);
  const setTurn = useCallback(
    (patch: Partial<Turn>) => setTurnState((t) => ({ ...t, ...patch })),
    [],
  );

  /** The one file input in the app. It lives here so the paperclip and the add
   *  menu's "Attach a file…" row open the same node — two inputs would be two
   *  readers, and the last time a control grew a second door to one room that
   *  was the bug. */
  const fileRef = useRef<HTMLInputElement>(null);
  const pickFile = useCallback(() => fileRef.current?.click(), []);

  /* Attaching opens nothing but the panel's own list — it never opens the panel.
     That was the bug when the add door and the context door both landed in the
     same room: the panel is where you *read* what's attached, and attaching is
     not also a way to open it. */
  const attach = useCallback(
    (r: Ref) => {
      setAddOpen(false);
      if (refs.some((x) => x.label === r.label)) {
        notify(`Already attached: ${r.label}`);
        return;
      }
      setRefs((list) => [...list, r]);
      notify(`Attached ${r.label}`);
      logEv({ area: 'Chat', text: `Attached ${r.label}` });
    },
    [refs, notify],
  );

  const detach = useCallback((label: string) => {
    setRefs((list) => list.filter((r) => r.label !== label));
    logEv({ area: 'Chat', text: `Detached ${label}` });
  }, []);

  /* What the paperclip and the menu's file row both land on. The mockup reads
     the file into a data URL, downsizes anything over ~1.1MB to 1568px and sends
     it as an attachment (lines 1805-1815); the send half is the API work's, so
     what's left here is the read — enough to show you your own photo back in the
     panel rather than a filename you have to trust. */
  const onFile = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      // Cleared first: picking the same file twice otherwise fires nothing.
      e.target.value = '';
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        attach({ label: file.name, icon: 'doc' });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => attach({ label: file.name, icon: 'img', url: String(reader.result) });
      reader.readAsDataURL(file);
    },
    [attach],
  );

  /* The two rows under the menu's Context section. Neither destination exists
     yet, and `pickMenu` below sends every unbuilt row the same way. */
  const openAddPage = useCallback(
    (page: 'role' | 'projects') => {
      notify(
        page === 'role' ? 'Custom roles arrive with Studio' : 'Projects arrive with their screen',
      );
    },
    [notify],
  );

  // The mockup's go(): switching tab clears the page stack.
  const goTab = useCallback((t: TabId) => {
    setStack([]);
    setTab(t);
  }, []);

  /* Opening a page is deliberately not logged. The one page that exists — Search —
     is opened by the shell, not by a tab, so filing it under the tab you happen to
     be standing on would write "Guild · Opened Search" into a log about a Guild
     that does nothing. It comes back when a page carries the tab it belongs to. */
  const go = useCallback((page: string, arg?: unknown) => {
    setStack((s) => [...s, arg === undefined ? { page } : { page, arg }]);
  }, []);

  const back = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const openSearch = useCallback(() => go('search'), [go]);

  const nav = useMemo<Nav>(
    () => ({
      go,
      back,
      depth: stack.length,
      goTab,
      openSettings,
      panelOpen,
      panelView,
      togglePanel,
      openPanel,
      closePanel,
      openAdd,
      turn,
      setTurn,
      pickFile,
    }),
    [
      go,
      back,
      stack.length,
      goTab,
      openSettings,
      panelOpen,
      panelView,
      togglePanel,
      openPanel,
      closePanel,
      openAdd,
      turn,
      setTurn,
      pickFile,
    ],
  );

  const top = stack.length ? stack[stack.length - 1] : null;
  const def = top ? PAGES[top.page] : undefined;
  const Screen = SCREENS[tab];

  // One handler for the rail and the drawer, so a row behaves the same
  // wherever it is clicked.
  const pickMenu = useCallback(
    (label: string) => {
      setDrawerOpen(false);
      if (label === 'Settings') {
        setSettingsOpen(true);
        return;
      }
      if (label === 'New chat') {
        goTab('chat');
        return;
      }
      // The rail's Context row opens the same add menu as the composer's `+` —
      // one sheet, so the two can't grow separate ideas of what "adding" means.
      if (label === 'Attach an item') {
        goTab('chat');
        setAddOpen(true);
        return;
      }
      notify(`${label} arrives with its screen`);
    },
    [goTab, notify],
  );

  const appClass = [railCollapsed ? 'railCollapsed' : '', panelOpen ? 'panelOpen' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <NavContext.Provider value={nav}>
      <div id="app" className={appClass || undefined}>
        <Sidebar
          active={tab}
          onSelect={goTab}
          onSettings={openSettings}
          onSearch={openSearch}
          onPick={pickMenu}
          onCollapse={() => setRailCollapsed((c) => !c)}
        />
        <div className="col">
          <Header
            title={top ? pageTitle(top.page) : LABELS[tab]}
            onMenu={() => setDrawerOpen(true)}
            onActivity={() => openPanel('activity')}
            onBack={top ? back : undefined}
          />
          <main id="mn">
            {top ? (
              <div className="pageWrap">
                {/* Mobile uses the header's back button; this bar is desktop-only. */}
                <div className="backbar">
                  <button className="hb" onClick={back} aria-label="Back">
                    <Icon name="bk" />
                  </button>
                  <div className="tt">{pageTitle(top.page)}</div>
                  <div className="bbsp" />
                </div>
                <div className="pageBody">
                  {def ? (
                    <def.page arg={top.arg} />
                  ) : (
                    <div className="empty">No page named &ldquo;{top.page}&rdquo;.</div>
                  )}
                </div>
              </div>
            ) : (
              <Screen />
            )}
          </main>
          <TabBar active={tab} onChange={goTab} />
        </div>

        <RightPanel
          open={panelOpen}
          view={panelView}
          onView={setPanelView}
          onClose={closePanel}
          onToggle={togglePanel}
          refs={refs}
          onDetach={detach}
        />

        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          tab={tab}
          onPick={pickMenu}
          onSearch={openSearch}
        />
        <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} notify={notify} />
        <AddSheet open={addOpen} onClose={() => setAddOpen(false)} onPage={openAddPage} />

        {/* `accept` is what puts Photo library / Take photo / Choose file on
            screen: that list is the OS picker, not a menu we draw. */}
        <input ref={fileRef} type="file" accept="image/*,.pdf" onChange={onFile} hidden />

        <Toast message={toast} onDone={() => setToast(null)} />
      </div>
    </NavContext.Provider>
  );
}
