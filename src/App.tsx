import { setDraftsOpen } from './studio';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import Header from './components/shell/Header';
import TabBar, { type TabId } from './components/shell/TabBar';
import Drawer from './components/shell/Drawer';
import AddSheet from './components/shell/AddSheet';
import Toast from './components/shell/Toast';
import Settings from './components/settings/Settings';
import Sidebar from './components/shell/Sidebar';
import Office from './components/shell/Office';
import EditModal from './components/EditModal';
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
  const [panelView, setPanelView] = useState<PanelView>(() => snap.panelView);
  /** What Eumae is holding on this conversation. Local until the files work. */
  const [refs, setRefs] = useState<Ref[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  /** How Eumae answers on this chat — the `+` menu writes it, the chip above
   *  the input reads it back. */
  const [turn, setTurnState] = useState<Turn>(DEFAULT_TURN);

  const notify = useCallback((msg: string, opts?: NotifyOpts) => setToast({ msg, undo: opts?.undo, id: Date.now() }), []);

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

  const appClass = [
    railCollapsed ? 'railCollapsed' : '',
    panelOpen ? 'panelOpen' : '',
    booting ? 'booting' : '',
    kbdOpen ? 'kbd-open' : '',
  ]
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
          threads={threads}
          currentThreadId={currentThreadId}
          onThreadPick={switchThread}
          onThreadDelete={removeThread}
          onThreadRename={renameThread}
        />
        <div className="col">
          <Header
            title={top ? pageTitle(top.page) : LABELS[tab]}
            onMenu={() => setDrawerOpen(true)}
            onActivity={() => openPanel()}
            onBack={top ? back : undefined}
          />
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
                    onClick={() => setStack(c.page ? [{ page: c.page }] : [])}
                  >
                    {c.label}
                  </button>
                );
              })}
            </nav>
          ) : null}
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

        <EditModal />
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
