/* App boot — the one place the app decides what is open before first paint.
 *
 *  Everything persisted boots here, synchronously, once: thread id +
 *  messages + list. React initializers read the result; mount effects keep
 *  only the backstop (corrupt id → fresh default) and never load the happy
 *  path. Effects run after paint, so any effect-driven boot flashes by
 *  construction — this module exists so no screen boots via effect.
 *
 *  The rule: reload keeps you, reopen starts fresh. `sessionStorage` dies
 *  with the tab but survives reloads; its absence means a cold open (fresh
 *  tab, relaunch) and the answer is a new chat, not the stored one. Old
 *  chats are untouched — reopen starts on a blank one, history stays in
 *  the drawer.
 *
 *  Pure + storage only: no React, no DOM beyond the two storages — tested
 *  via checks/boot.mjs with stubbed storages, no browser needed.
 */
import {
  createThread,
  getCurrentThreadId,
  getThread,
  getThreads,
  setCurrentThreadId,
  type Msg,
  type Thread,
} from './threads';

import type { TabId } from './components/shell/TabBar';
import { PANEL_VIEWS, type PanelView } from './nav';

export interface Boot {
  threadId: string;
  messages: Msg[];
  threads: Thread[];
  /** True when this boot started fresh (cold open), false on reload. */
  fresh: boolean;
  /** Where the person was: tab + pushed page stack. Reload restores it, cold
   *  open lands on chat with an empty stack. */
  tab: TabId;
  stack: BootPlace[];
  /** The overlays, restored on reload and reset on cold open. Tabs + stack
   *  were never the whole "where I was" — a reload inside Settings → Voice
   *  used to land on chat with Settings gone, because `settingsOpen` and the
   *  Settings-local `view` died with the page. Same for the right panel: it
   *  reopened on Context, not the reading you were in. Transient things
   *  (drawer, + sheet, toast, composer text) stay transient on purpose —
   *  nobody wants a toast restored. */
  settingsOpen: boolean;
  /** The Settings section to land on, or null for its landing rule
   *  (main on phone, Personalization on desktop). Validated by Settings
   *  itself — boot carries the string, the pane decides if it knows it. */
  settingsView: string | null;
  panelOpen: boolean;
  panelView: PanelView;
}

/** One pushed sub-page — the same shape as App's `Pushed`. */
export interface BootPlace {
  page: string;
  arg?: unknown;
}

/* The valid tabs, mirrored from TabBar's TABS (the UI list owns labels; this
   owns boot validity). A hand-edited or stale stored tab boots to chat, never
   to nowhere. Update both if tabs change. */
const BOOT_TABS: TabId[] = ['chat', 'console', 'studio', 'library', 'classroom', 'guild'];

const NAV_KEY = 'eumae:nav';

/* Message ids come from a counter, not the clock. Two sends in the same
   millisecond used to collide — Date.now() is not an ID. The counter lives
   here, next to boot, so both the boot snapshot and later sends seed from
   the same place and reloads never collide with saved ids. */
let nextMsgId = 1;
export function msgId(): number {
  return nextMsgId++;
}
export function seedMsgId(msgs: { id: number }[]): void {
  for (const m of msgs) {
    if (m.id >= nextMsgId) nextMsgId = m.id + 1;
  }
}

/** A reload mid-reply strands a `streaming` row with no stream behind it —
 *  it can never finish, so it lands as a note with regen beside it. */
function settle(messages: Msg[]): Msg[] {
  return messages.map((m) =>
    m.streaming ? { ...m, streaming: false, note: 'Reloaded before the reply arrived.' } : m,
  );
}

/** Messages for one thread id: settled (no stranded streaming rows) and
 *  id-seeded. Mount (via the boot snapshot below) and switches share this,
 *  so the two cannot drift apart. */
export function messagesFor(threadId: string | null): Msg[] {
  const loaded = threadId ? getThread(threadId)?.messages ?? [] : [];
  seedMsgId(loaded);
  return settle(loaded);
}

function sessionAlive(): boolean {
  try {
    return sessionStorage.getItem('eumae:session') !== null;
  } catch {
    /* Storage blocked — treat every boot as a reload: never strand the user
       on a blank chat when the stored one exists. */
    return true;
  }
}

function markSession(): void {
  try {
    sessionStorage.setItem('eumae:session', '1');
  } catch {
    /* Non-fatal. */
  }
}

let memo: Boot | null = null;

/** The snapshot App booted from, for ChatScreen's mount read — same object,
 *  no second storage read, cannot disagree. Null only if ChatScreen ever
 *  mounts without App (tests); the caller falls back to `messagesFor`. */
export function bootSnapshot(): Boot | null {
  return memo;
}

/* One boot per page load. Memoized because React StrictMode double-invokes
   state initializers in dev — App boots via `useState(() => boot())`, and
   without this a cold open would create two threads and orphan the first.
   ChatScreen reads the same memo for its mount messages, so mount costs no
   second storage read and cannot disagree with App. */
export function boot(): Boot {
  if (memo) return memo;
  const cold = !sessionAlive();
  markSession();
  const nav = cold
    ? {
        tab: 'chat' as TabId,
        stack: [] as BootPlace[],
        settingsOpen: false,
        settingsView: null as string | null,
        panelOpen: false,
        panelView: 'context' as PanelView,
      }
    : readNav();
  if (cold)
    writeNav(nav.tab, nav.stack, nav.settingsOpen, nav.settingsView, nav.panelOpen, nav.panelView);
  const withNav = {
    tab: nav.tab,
    stack: nav.stack,
    settingsOpen: cold ? false : nav.settingsOpen,
    settingsView: cold ? null : nav.settingsView,
    panelOpen: cold ? false : nav.panelOpen,
    panelView: nav.panelView,
  };
  if (!cold) {
    const storedId = getCurrentThreadId();
    const stored = storedId ? getThread(storedId) : undefined;
    if (stored) {
      seedMsgId(stored.messages);
      memo = {
        threadId: stored.id,
        messages: settle(stored.messages),
        threads: getThreads(),
        fresh: false,
        ...withNav,
      };
      return memo;
    }
  }
  /* Cold open, or a reload whose stored id is missing/corrupt — same answer:
     a fresh thread. Cold lands on chat + empty stack + closed overlays; the
     corrupt-id reload keeps the restored nav (you were somewhere real, the
     thread pointer is what broke). */
  const fresh = createThread();
  setCurrentThreadId(fresh.id);
  seedMsgId(fresh.messages);
  memo = {
    threadId: fresh.id,
    messages: [],
    threads: getThreads(),
    fresh: true,
    ...(cold
      ? {
          tab: 'chat' as TabId,
          stack: [] as BootPlace[],
          settingsOpen: false,
          settingsView: null as string | null,
          panelOpen: false,
          panelView: 'context' as PanelView,
        }
      : withNav),
  };
  return memo;
}

/** Where the person was: tab + pushed page stack + overlays, restored on
 *  reload. Read once at boot; App writes it back on every change (see
 *  saveNav). Invalid or missing data boots to chat + empty stack + closed
 *  overlays, never to nowhere. */
function readNav(): {
  tab: TabId;
  stack: BootPlace[];
  settingsOpen: boolean;
  settingsView: string | null;
  panelOpen: boolean;
  panelView: PanelView;
} {
  const empty = {
    tab: 'chat' as TabId,
    stack: [] as BootPlace[],
    settingsOpen: false,
    settingsView: null as string | null,
    panelOpen: false,
    panelView: 'context' as PanelView,
  };
  try {
    const raw = localStorage.getItem(NAV_KEY);
    if (!raw) return { ...empty, stack: [] };
    const parsed = JSON.parse(raw) as {
      tab?: unknown;
      stack?: unknown;
      settingsOpen?: unknown;
      settingsView?: unknown;
      panelOpen?: unknown;
      panelView?: unknown;
    };
    const tab: TabId = BOOT_TABS.includes(parsed.tab as TabId) ? (parsed.tab as TabId) : 'chat';
    const stack = Array.isArray(parsed.stack)
      ? parsed.stack.filter(
          (s): s is BootPlace =>
            !!s && typeof s === 'object' && typeof (s as BootPlace).page === 'string',
        )
      : [];
    const settingsOpen = parsed.settingsOpen === true;
    const settingsView = typeof parsed.settingsView === 'string' ? parsed.settingsView : null;
    const panelOpen = parsed.panelOpen === true;
    /* Old readings map onto Eumae's office: Activity lives in the Logbook now,
       and Studio's sandbox is Chat's Sandbox. */
    const pv = parsed.panelView === 'mae' ? 'eumae' : parsed.panelView === 'activity' ? 'logbook' : parsed.panelView === 'studio' ? 'sandbox' : parsed.panelView;
    const panelView: PanelView = PANEL_VIEWS.includes(pv as PanelView) ? (pv as PanelView) : 'context';
    return { tab, stack, settingsOpen, settingsView, panelOpen, panelView };
  } catch {
    return { ...empty, stack: [] };
  }
}

function writeNav(
  tab: TabId,
  stack: BootPlace[],
  settingsOpen: boolean,
  settingsView: string | null,
  panelOpen: boolean,
  panelView: PanelView,
): void {
  try {
    localStorage.setItem(
      NAV_KEY,
      JSON.stringify({ tab, stack, settingsOpen, settingsView, panelOpen, panelView }),
    );
  } catch {
    /* Non-fatal. */
  }
}

/** App calls this on every tab/stack/overlay change so the next reload
 *  restores it. Cheap (one small JSON write), sync, no render involved. */
export function saveNav(
  tab: TabId,
  stack: BootPlace[],
  settingsOpen: boolean,
  settingsView: string | null,
  panelOpen: boolean,
  panelView: PanelView,
): void {
  writeNav(tab, stack, settingsOpen, settingsView, panelOpen, panelView);
}

