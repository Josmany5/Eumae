import { setDraftsOpen } from './studio';
import { discardFresh } from './focus';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import Header from './components/shell/Header';
import TabBar, { type TabId } from './components/shell/TabBar';
import Drawer from './components/shell/Drawer';
import AddSheet from './components/shell/AddSheet';
import Toast from './components/shell/Toast';
import Settings from './components/settings/Settings';
import Sidebar from './components/shell/Sidebar';
import Office from './components/shell/Office';
import { Icon } from './components/shell/icons';
import { SCREENS, LABELS } from './screens';
import { PAGES, pageTitle } from './pages';
import { NavContext, DEFAULT_TURN, type Nav, type PanelView, type Ref, type Turn, type NotifyOpts, type ToastMsg } from './nav';
import {
  createThread,
  deleteThread,
  getThread,
  getThreads,
  saveThread,
  setCurrentThreadId,
  snapshotThreads,
  restoreThreads,
  THREADS_EVENT,
  type Thread,
} from './threads';
import { boot, saveNav } from './boot';
import { logEv } from './log';
import { saveUpload, uploadData } from './uploads';
import HomeScreen, { homeSections, type HomeDest, type Tile } from './screens/HomeScreen';
import { homeOn, deskOn, isPhone, HOME_EVENT } from './home';
import { DeskBar, DeskIcons, Dock, WinBar } from './components/shell/Desk';
import { HomeHandle, AppSwitcher } from './components/shell/AppSwitch';

const CON_PAGES: { label: string; page: string | null }[] = [
  { label: 'Today', page: null },
  { label: 'Tasks', page: 'tasks' },
  { label: 'Calendar', page: 'cal' },
  { label: 'Events', page: 'events' },
  { label: 'Goals', page: 'goals' },
  { label: 'Projects', page: 'projects' },
  { label: 'Notes', page: 'notes' },
  { label: 'Flows', page: 'flows' },
];

/* Home mode (phone): each app's own pages as pills along the top, in place
   of the side menu. Console uses CON_PAGES above; these are the others whose
   menu rows open real pages. */
const APP_PILLS: Partial<Record<TabId, string[]>> = {
  library: ['Favorites', 'Recent', 'Trash'],
  guild: ['Contacts', 'Messages', 'Requests', 'Assigned work', 'Activity', 'Shared work', 'Marketplace'],
};

/** A sub-page pushed on top of the current tab — the mockup's pageSt entry. */
interface Pushed {
  page: string;
  arg?: unknown;
}

/* The keyboard, honestly tracked. `visualViewport` is the one API that says
   what the keyboard actually did: when it opens, the viewport shrinks and
   `documentElement.clientHeight - visualViewport.height` is roughly the
   keyboard's height. A 160px shrink means a keyboard; smaller shrinks are the
   URL bar collapsing, the devtools, split-screen — none of which should hide
   the tab bar. Focus/blur on fields back it up (some Android keyboards report
   late), and blur always closes: a stuck hidden tab bar strands navigation.
   One place, one class (`kbd-open` on `#app`), every screen benefits. */
function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const vv = window.visualViewport;
    const onResize = () => {
      if (!window.visualViewport) return;
      const shrink = document.documentElement.clientHeight - window.visualViewport.height;
      setOpen(shrink > 160);
    };
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT')) {
        // Give the viewport a beat to shrink — Android reports late. The resize
        // handler corrects if this was optimistic.
        window.setTimeout(onResize, 120);
      }
    };
    const onFocusOut = () => setOpen(false);
    if (vv) vv.addEventListener('resize', onResize);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    onResize();
    return () => {
      if (vv) vv.removeEventListener('resize', onResize);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, []);
  return open;
}

export default function App() {
  /* One boot, before first paint: thread id + messages + list + the
     reload-keeps / reopen-fresh rule, computed once and memoized inside
     boot.ts (StrictMode double-invokes initializers — without the memo a
     cold open would create two threads and orphan the first). */
  const [snap] = useState(() => boot());
  /* Reload restores where you were (tab + pushed pages + overlays) from the
     boot snapshot; cold open lands on chat with an empty stack and closed
     overlays. First render already knows — no effect-driven nav, which would
     flash chat for a frame on every reload of Library/Studio/notes/Settings. */
  const [tab, setTab] = useState<TabId>(() => snap.tab);
  const [stack, setStack] = useState<Pushed[]>(() => snap.stack);
  /* Graphite Midnight: the accent follows the space. Layout effect so the
     first paint already has the right color, with no blue flash on reload
     into Console or Guild. */
  useLayoutEffect(() => {
    document.documentElement.dataset.space = tab;
  }, [tab]);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  /* Settings' open state + section seed from boot. `settingsView` is owned
     here rather than inside Settings so a reload inside Settings → Voice can
     land back on Voice: Settings-local state died with the page, which is why
     reloads used to drop you on chat with Settings gone. Null = its landing
     rule (main on phone, Personalization on desktop). */
  const [settingsOpen, setSettingsOpen] = useState(() => snap.settingsOpen);
  const [settingsView, setSettingsView] = useState<string | null>(() => snap.settingsView);
  const [toast, setToast] = useState<ToastMsg | null>(null);

  // The panel. `panelView` deliberately outlives `panelOpen`, so closing it and
  // coming back lands you on the reading you were in, not back on Context.
  // Both seed from boot, so a reload with the panel open restores the reading
  // you were in rather than resetting to Context.
  const [panelOpen, setPanelOpen] = useState(() => snap.panelOpen);
  /* Closing the office throws away a new item from More that was never saved (his call, Oct 25). */
  useEffect(() => {
    if (!panelOpen) discardFresh();
  }, [panelOpen]);
  const [panelView, setPanelView] = useState<PanelView>(() => snap.panelView);
  /** What Eumae is holding on this conversation. Local until the files work. */
  const [refs, setRefs] = useState<Ref[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  /** How Eumae answers on this chat — the `+` menu writes it, the chip above
   *  the input reads it back. */
  const [turn, setTurnState] = useState<Turn>(DEFAULT_TURN);

  const notify = useCallback((msg: string, opts?: NotifyOpts) => setToast({ msg, undo: opts?.undo, id: Date.now() }), []);

  /* Phone Home test (Oct 24): opt-in in Settings → Appearance. When on, a
     phone opens on Home; a tile opens its screen, and the header's back
     arrow on a top-level screen comes back here. */
  const [homeEnabled, setHomeEnabled] = useState(homeOn);
  const [showHome, setShowHome] = useState(() => homeOn() && isPhone());
  /* Desktop Home (Oct 26): opt-in, wide screens only. */
  const [deskEnabled, setDeskEnabled] = useState(deskOn);
  const [wide, setWide] = useState(() => !isPhone());
  useEffect(() => {
    const m = window.matchMedia('(max-width:899px)');
    const f = () => setWide(!m.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, []);
  useEffect(() => {
    const f = () => {
      const on = homeOn();
      setHomeEnabled(on);
      setShowHome(on && isPhone());
      setDeskEnabled(deskOn());
    };
    window.addEventListener(HOME_EVENT, f);
    return () => window.removeEventListener(HOME_EVENT, f);
  }, []);

  const closePanel = useCallback(() => setPanelOpen(false), []);
  const openPanel = useCallback((view?: PanelView) => {
    if (view) setPanelView(view);
    setPanelOpen(true);
  }, []);
  const togglePanel = useCallback(() => setPanelOpen((o) => !o), []);
  const openAdd = useCallback(() => setAddOpen(true), []);
  const setTurn = useCallback(
    (patch: Partial<Turn>) => setTurnState((t) => ({ ...t, ...patch })),
    [],
  );

  /** The one file input in the app. It lives here so every control that attaches
   *  opens the same node — the paperclip and the rail's "Attach an item" row
   *  today (§4.4). Two inputs would be two readers, and the last time a control
   *  grew a second door to one room that was the bug. */
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
      /* No toast — the thumbnail appearing in the composer is the confirmation. */
      logEv({ area: 'Chat', text: `Attached ${r.label}` });
    },
    [refs, notify],
  );

  const detach = useCallback((label: string) => {
    setRefs((list) => list.filter((r) => r.label !== label));
    logEv({ area: 'Chat', text: `Detached ${label}` });
  }, []);

  const clearRefs = useCallback(() => {
    setRefs([]);
  }, []);

  /* What the paperclip and the rail's attach row both land on. The mockup reads
     the file into a data URL, downsizes anything over ~1.1MB to 1568px and sends
     it as an attachment (lines 1805-1815); the send half is the API work's, so
     what's left here is the read — enough to show you your own photo back in the
     panel rather than a filename you have to trust. */
  const onFile = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      // Cleared first: picking the same file twice otherwise fires nothing.
      e.target.value = '';
      if (!file) return;
      try {
        const upload = await saveUpload(file);
        const url = await uploadData(upload.id);
        const icon = upload.kind === 'image' ? 'img' : upload.kind === 'pdf' ? 'pdf' : 'doc';
        // The id is the pointer (§4.15); the url is the live preview only and is
        // stripped before the thread is saved (ChatScreen saveNow).
        attach({ label: upload.name, icon, uploadId: upload.id, url: url ?? undefined });
      } catch {
        notify('Could not read that file.');
      }
    },
    [attach, notify],
  );

  /* The `+` window's one page door, now that its Context section is retired
     (§4.13): building a role. "Scope to a project" is the rail's row again and
     toasts through `pickMenu` like every other unbuilt row, so there is no
     second branch to keep in step here. */
  const onCreateRole = useCallback((name?: string) => {
    setTab('console');
    setStack([name ? { page: 'role', arg: name } : { page: 'role' }]);
  }, []);

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
  const openSettings = useCallback((view?: string) => {
    if (view) setSettingsView(view);
    setSettingsOpen(true);
  }, []);
  const openSearch = useCallback(() => go('search'), [go]);

  /* Chat threads — App owns them so the drawer ("New chat", "Recent chats")
     and ChatScreen read the same state. */
  const [threads, setThreads] = useState<Thread[]>(() => snap.threads);
  /* The open thread id boots from the boot snapshot, not from storage
     directly and not from null: boot ran once before first paint and
     already applied the reload-keeps / reopen-fresh rule, so the first
     render knows the thread and ChatScreen paints history frame one. */
  const [currentThreadId, setCurrentId] = useState<string | null>(() => snap.threadId);

  /* Backstop only: boot already resolved the happy path before first paint,
     so this never creates or loads on a normal boot — it covers a corrupt
     stored id (thread deleted elsewhere, storage edited by hand). */
  useEffect(() => {
    if (!currentThreadId || getThread(currentThreadId)) return;
    const fresh = createThread();
    setCurrentThreadId(fresh.id);
    setCurrentId(fresh.id);
    setThreads(getThreads());
  }, [currentThreadId]);

  useEffect(() => {
    const f = () => setThreads(getThreads());
    window.addEventListener(THREADS_EVENT, f);
    return () => window.removeEventListener(THREADS_EVENT, f);
  }, []);

  const newChat = useCallback(() => {
    const fresh = createThread();
    setCurrentThreadId(fresh.id);
    setCurrentId(fresh.id);
    setThreads(getThreads());
    goTab('chat');
  }, [goTab]);

  const switchThread = useCallback((id: string) => {
    setCurrentThreadId(id);
    setCurrentId(id);
    setDrawerOpen(false);
    goTab('chat');
  }, [goTab]);

  /* Delete never asks: the chat goes, the toast offers Undo, and Undo puts
     it back and reopens it if it was the one on screen. */
  const removeThread = useCallback((id: string) => {
    const snap = snapshotThreads();
    const wasCurrent = currentThreadId === id;
    deleteThread(id);
    const remaining = getThreads();
    if (wasCurrent) {
      if (remaining.length > 0) {
        setCurrentThreadId(remaining[0].id);
        setCurrentId(remaining[0].id);
      } else {
        const fresh = createThread();
        setCurrentThreadId(fresh.id);
        setCurrentId(fresh.id);
      }
    }
    setThreads(getThreads());
    notify('Chat deleted.', {
      undo: () => {
        restoreThreads(snap);
        if (wasCurrent) {
          setCurrentThreadId(id);
          setCurrentId(id);
        }
        setThreads(getThreads());
      },
    });
  }, [currentThreadId, notify]);

  const renameThread = useCallback((id: string, title: string) => {
    const t = getThread(id);
    if (!t || !title.trim()) return;
    saveThread({ ...t, title: title.trim().slice(0, 80) });
    setThreads(getThreads());
  }, []);

  const nav = useMemo<Nav>(
    () => ({
      go,
      back,
      depth: stack.length,
      goTab,
      openSettings,
      notify,
      panelOpen,
      panelView,
      togglePanel,
      openPanel,
      closePanel,
      openAdd,
      refs,
      attach,
      detach,
      clearRefs,
      turn,
      setTurn,
      pickFile,
      threads,
      currentThreadId,
      newChat,
      switchThread,
      removeThread,
      renameThread,
    }),
    [
      go,
      back,
      stack.length,
      goTab,
      openSettings,
      notify,
      panelOpen,
      panelView,
      togglePanel,
      openPanel,
      closePanel,
      openAdd,
      refs,
      attach,
      detach,
      clearRefs,
      turn,
      setTurn,
      pickFile,
      threads,
      currentThreadId,
      newChat,
      switchThread,
      removeThread,
      renameThread,
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
        newChat();
        return;
      }
      if (label === 'Notes') {
        go('notes');
        return;
      }
      /* The rail's "Attach an item" opens the one file input, exactly as the
         paperclip does — not the `+` window, which is behavior-only now (§4.13)
         and could not attach anything if it opened. §4.4 is kept: this row and
         the paperclip both call `pickFile`, so there is still one input and no
         second picker. Attaching does not open the panel (§4.3); it lands in the
         panel's Context reading, which is where it is read back. */
      if (label === 'Attach an item') {
        goTab('chat');
        pickFile();
        return;
      }
      if (label === 'Scope to a project') {
        go('projects');
        return;
      }
      /* The Library rail's rows open the Library's own views. One page on
         the Library tab at a time: goTab clears the stack first. */
      const libView = { Favorites: 'view:Favorites', Recent: 'view:Recent', Trash: 'trash' }[label];
      if (libView && tab === 'library') {
        goTab('library');
        go('libf', libView);
        return;
      }
      /* Studio's rail rows: both live on the Studio root (Drafts opens its
         section). */
      if (label === 'Published' || label === 'Drafts') {
        if (label === 'Drafts') setDraftsOpen(true);
        goTab('studio');
        return;
      }
      if (label === 'Sources') {
        notify('Sources comes soon: the pages and links Eumae reads for you will collect here.');
        return;
      }
      /* Menu rows that navigate: every page they point at exists in PAGES.
         Labels come from PAGE_MENU (rail + drawer share it). Anything
         without a row here toasts, as before. */
      const hit = {
        Tasks: { tab: 'console', page: 'tasks' },
        Events: { tab: 'console', page: 'events' },
        Calendar: { tab: 'console', page: 'cal' },
        Goals: { tab: 'console', page: 'goals' },
        Projects: { tab: 'console', page: 'projects' },
        Flows: { tab: 'console', page: 'flows' },
        Contacts: { tab: 'guild', page: 'gsec', arg: 'Contacts' },
        Messages: { tab: 'guild', page: 'gmsg' },
        Requests: { tab: 'guild', page: 'greq' },

        Activity: { tab: 'guild', page: 'gsec', arg: 'Activity' },
        'Shared work': { tab: 'guild', page: 'gsec', arg: 'Shared work' },
        Marketplace: { tab: 'guild', page: 'gsec', arg: 'Marketplace' },
        'Shared with me': { tab: 'guild', page: 'gsec', arg: 'Shared work' },
        'Assigned work': { tab: 'guild', page: 'asn' },
        'Spanish \u00b7 Lesson 5': { tab: 'classroom', page: 'course', arg: 'Spanish' },
        'AI Engineering \u00b7 Ch 3': { tab: 'classroom', page: 'course', arg: 'AI Engineering' },
        'Sales onboarding \u00b7 assigned to you': { tab: 'classroom', page: 'cxsec', arg: 'Training' },
        'Onboarding \u00b7 you assigned': { tab: 'classroom', page: 'cxsec', arg: 'Training' },
        'gbrain teardown': { tab: 'classroom', page: 'cxsec', arg: 'Digest' },
        'Speech as programming': { tab: 'classroom', page: 'cxsec', arg: 'Digest' },
        'Using Studio': { tab: 'classroom', page: 'tut', arg: 'Using Studio' },
        'Using Guild': { tab: 'classroom', page: 'tut', arg: 'Using Guild' },
      }[label];
      if (hit) {
        const ht = hit as { tab?: TabId; page?: string; arg?: unknown };
        if (ht.tab && ht.tab !== tab) goTab(ht.tab);
        if (ht.page) go(ht.page, ht.arg);
        return;
      }
      notify(`${label} arrives with its screen`);
    },
    [go, goTab, notify, pickFile, newChat, tab],
  );

  /* Apps left open behind Home, newest first: where you were in each. */
  const [curApp, setCurApp] = useState<string | null>(null);
  const [openApps, setOpenApps] = useState<{ key: string; title: string; tab: TabId; stack: Pushed[] }[]>([]);
  const [switcher, setSwitcher] = useState(false);
  const [pillSel, setPillSel] = useState<string | null>(null);
  const saveCur = useCallback(() => {
    if (!curApp) return;
    const t = stack.length ? pageTitle(stack[stack.length - 1].page) : LABELS[tab];
    setOpenApps((l) => [{ key: curApp, title: t, tab, stack }, ...l.filter((a) => a.key !== curApp)]);
  }, [curApp, stack, tab]);
  const goHome = useCallback(() => {
    saveCur();
    setPanelOpen(false);
    setSwitcher(false);
    setShowHome(true);
  }, [saveCur]);
  const openSwitcher = useCallback(() => {
    saveCur();
    setSwitcher(true);
  }, [saveCur]);
  const resumeApp = useCallback(
    (key: string) => {
      const a = openApps.find((x) => x.key === key);
      if (!a) return false;
      setTab(a.tab);
      setStack(a.stack);
      setCurApp(key);
      setPanelOpen(false);
      setSwitcher(false);
      setShowHome(false);
      return true;
    },
    [openApps],
  );
  const closeApp = useCallback(
    (key: string) => {
      setOpenApps((l) => l.filter((a) => a.key !== key));
      if (key === curApp) setCurApp(null);
    },
    [curApp],
  );
  const dismissSwitcher = useCallback(() => {
    setSwitcher(false);
    if (!curApp) setShowHome(true);
  }, [curApp]);

  const openFromHome = useCallback(
    (d: HomeDest, name?: string) => {
      if (name && 'tab' in d) {
        /* Console tiles are pages of one app, so a saved window only resumes
           while it still sits on the tile's own page: open Tasks, switch to
           Calendar in the pills, and the Tasks tile opens Tasks again. */
        const a = openApps.find((x) => x.key === name);
        const same = !!a && (d.tab !== 'console' || (a.tab === 'console' && (a.stack[0]?.page ?? null) === (d.page ?? null)));
        if (same && resumeApp(name)) return;
        if (a) setOpenApps((l) => l.filter((x) => x.key !== name));
      }
      if ('soon' in d) {
        notify(`${d.soon} is coming soon.`);
        return;
      }
      if ('settings' in d) {
        setSettingsOpen(true);
        return;
      }
      setShowHome(false);
      setCurApp('office' in d ? null : name ?? null);
      if ('office' in d) {
        goTab('console');
        openPanel(d.office);
        return;
      }
      goTab(d.tab);
      if (d.page) go(d.page, d.arg);
    },
    [go, goTab, notify, openPanel, resumeApp, openApps],
  );

  /* Persist where you are on every change, so a reload restores it. One small
     sync JSON write — no render, no debounce to lose the last step. Overlays
     ride along: Settings open + section, panel open + reading — reload restores
     them, cold open ignores them. */
  useEffect(() => {
    saveNav(tab, stack, settingsOpen, settingsView, panelOpen, panelView);
  }, [tab, stack, settingsOpen, settingsView, panelOpen, panelView]);

  /* First paint lands with transitions off (tokens.css `#app.booting`): the
     parked drawer/panel/sheets would otherwise slide visibly on mount during
     a fast reload. One frame is enough — the browser has placed everything by
     then, and every later open/close animates as before. Hook order: these run
     unconditionally, above, in the same order every render. */
  const [booting, setBooting] = useState(true);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setBooting(false));
    return () => cancelAnimationFrame(frame);
  }, []);


  const kbdOpen = useKeyboardOpen();
  const appMode = homeEnabled && !showHome && isPhone();
  const pillPage = !!top && stack.length === 1 && (CON_PAGES.some((c) => c.page === top.page) || !!APP_PILLS[tab]);

  /* Desktop Home: which tile the window shows, which apps are open (dock
     dots), and whether the window is closed or minimized. */
  const deskMode = deskEnabled && wide;
  const [deskOpen, setDeskOpen] = useState<string[]>([]);
  const [winHidden, setWinHidden] = useState(false);
  useEffect(() => {
    if (deskMode) setPanelOpen(true);
  }, [deskMode]);
  const deskTiles = useMemo(() => homeSectionsFlat(), []);
  const root = stack[0]?.page ?? null;
  const curTile =
    deskTiles.find((t) => 'tab' in t.to && t.to.tab === tab && (t.to.page ?? null) === root) ??
    deskTiles.find((t) => 'tab' in t.to && t.to.tab === tab && !t.to.page) ??
    null;
  const winTitle = curTile?.n ?? (top ? pageTitle(top.page) : LABELS[tab]);
  const openDesk = (t: Tile) => {
    const d = t.to;
    if ('soon' in d) {
      notify(`${d.soon} is coming soon.`);
      return;
    }
    if ('settings' in d) {
      setSettingsOpen(true);
      return;
    }
    if ('office' in d) {
      openPanel(d.office);
      return;
    }
    goTab(d.tab);
    if (d.page) go(d.page, d.arg);
    setWinHidden(false);
    setDeskOpen((l) => (l.includes(t.n) ? l : [...l, t.n]));
  };

  const appClass = [
    deskMode ? 'deskMode' : '',
    railCollapsed ? 'railCollapsed' : '',
    panelOpen ? 'panelOpen' : '',
    booting ? 'booting' : '',
    kbdOpen ? 'kbd-open' : '',
    showHome ? 'homeOn' : '',
    appMode ? 'appMode' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <NavContext.Provider value={nav}>
      <div id="app" className={appClass || undefined}>
        {deskMode ? (
          <>
            <DeskBar app={winHidden ? 'Desktop' : winTitle} onSearch={() => { setWinHidden(false); openSearch(); }} />
            <DeskIcons onOpen={openDesk} />
            <Dock open={winHidden ? deskOpen.filter((n) => n !== curTile?.n) : deskOpen} current={winHidden ? null : curTile?.n ?? null} onOpen={openDesk} />
          </>
        ) : null}
        <Sidebar
          active={tab}
          onSelect={goTab}
          onSettings={openSettings}
          onSearch={openSearch}
          onPick={pickMenu}
          onCollapse={() => setRailCollapsed((c) => !c)}
          threads={threads}
          currentThreadId={currentThreadId}
          onThreadPick={switchThread}
          onThreadDelete={removeThread}
          onThreadRename={renameThread}
        />
        <div className={'col' + (deskMode && winHidden ? ' dkHidden' : '') + (deskMode && stack.length === 1 && curTile && 'tab' in curTile.to && curTile.to.page === root ? ' dkRoot' : '')}>
          {deskMode ? (
            <WinBar
              title={winTitle}
              onClose={() => {
                setDeskOpen((l) => l.filter((n) => n !== curTile?.n));
                setWinHidden(true);
              }}
              onMin={() => setWinHidden(true)}
              onZoom={togglePanel}
            />
          ) : null}
          {showHome ? (
            <HomeScreen
              onOpen={openFromHome}
              onSearch={() => {
                setShowHome(false);
                openSearch();
              }}
            />
          ) : (
          <>
          <Header
            title={top ? pageTitle(top.page) : LABELS[tab]}
            onMenu={appMode && tab !== 'chat' ? undefined : () => setDrawerOpen(true)}
            onActivity={() => openPanel()}
            onBack={
              appMode
                ? /* Home mode: Back always works. A sub-page goes back a page;
                     a pill page goes up to the app's first page; the app's
                     first page goes Home. Chat keeps its menu (threads). */
                  top
                  ? pillPage
                    ? () => {
                        setStack([]);
                        setPillSel(null);
                      }
                    : back
                  : tab === 'chat'
                    ? undefined
                    : goHome
                : top
                  ? back
                  : homeEnabled && isPhone()
                    ? () => setShowHome(true)
                    : undefined
            }
          />
          {appMode && APP_PILLS[tab] ? (
            <nav className="conBar" aria-label={LABELS[tab] + ' pages'}>
              {[LABELS[tab], ...APP_PILLS[tab]!].map((label, i) => {
                const on = i === 0 ? !top : !!top && pillSel === label;
                return (
                  <button
                    key={label}
                    className={on ? 'on' : ''}
                    aria-current={on ? 'page' : undefined}
                    onClick={() => {
                      setStack([]);
                      setPillSel(i === 0 ? null : label);
                      if (i > 0) pickMenu(label);
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </nav>
          ) : null}
          {tab === 'console' && (!top || CON_PAGES.some((c) => c.page === top.page)) ? (
            /* Phone: Console's sub-pages as one scrolling row under the
               header. A shortcut; the Drawer keeps the full list. */
            <nav className="conBar" aria-label="Console pages">
              {CON_PAGES.map((c) => {
                const on = c.page ? top?.page === c.page : !top;
                return (
                  <button
                    key={c.label}
                    className={on ? 'on' : ''}
                    aria-current={on ? 'page' : undefined}
                    onClick={() => {
                      setStack(c.page ? [{ page: c.page }] : []);
                      /* Home mode: the window becomes the page you moved to, so
                         its tile and the switcher name it right. */
                      if (appMode && curApp !== c.label) {
                        setOpenApps((l) => l.filter((x) => x.key !== curApp && x.key !== c.label));
                        setCurApp(c.label);
                      }
                    }}
                  >
                    {c.label}
                  </button>
                );
              })}
            </nav>
          ) : null}
          <main id="mn" className={`tab-${tab}`}>
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
          {appMode ? <HomeHandle onHome={goHome} onSwitch={openSwitcher} /> : <TabBar active={tab} onChange={goTab} />}
          </>
          )}
          {showHome && homeEnabled ? <HomeHandle onHome={openSwitcher} onSwitch={openSwitcher} /> : null}
          {switcher ? (
            <AppSwitcher
              apps={openApps.map((a) => ({ key: a.key, title: a.title }))}
              onPick={(k) => resumeApp(k)}
              onCloseApp={closeApp}
              onHome={goHome}
              onDismiss={dismissSwitcher}
            />
          ) : null}
        </div>
        <Office
          tab={tab}
          open={panelOpen}
          view={panelView}
          onView={setPanelView}
          onClose={closePanel}
          onToggle={togglePanel}
        />

        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          tab={tab}
          onPick={pickMenu}
          currentThreadId={currentThreadId}
          onThreadPick={switchThread}
          onThreadDelete={removeThread}
          onSearch={openSearch}
        />
        <Settings open={settingsOpen} view={settingsView} onView={setSettingsView} onClose={() => setSettingsOpen(false)} notify={notify} />
        <AddSheet open={addOpen} onClose={() => setAddOpen(false)} onCreateRole={onCreateRole} />

        {/* `accept` is what puts Photo library / Take photo / Choose file on
            screen: that list is the OS picker, not a menu we draw. No accept
            filter — every file type goes to the Library. */}
        <input id="file-input" ref={fileRef} type="file" onChange={onFile} hidden />

        <Toast toast={toast} onDone={() => setToast(null)} />
      </div>
    </NavContext.Provider>
  );
}

/** Every Home tile, flat, for the desktop window's title and dock. */
function homeSectionsFlat(): Tile[] {
  return homeSections().flatMap((x) => x.tiles);
}
