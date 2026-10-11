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

export interface Boot {
  threadId: string;
  messages: Msg[];
  threads: Thread[];
  /** True when this boot started fresh (cold open), false on reload. */
  fresh: boolean;
}

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
  if (!sessionAlive()) {
    markSession();
    const fresh = createThread();
    setCurrentThreadId(fresh.id);
    seedMsgId(fresh.messages);
    memo = { threadId: fresh.id, messages: [], threads: getThreads(), fresh: true };
    return memo;
  }
  markSession();
  const storedId = getCurrentThreadId();
  const stored = storedId ? getThread(storedId) : undefined;
  if (stored) {
    seedMsgId(stored.messages);
    memo = {
      threadId: stored.id,
      messages: settle(stored.messages),
      threads: getThreads(),
      fresh: false,
    };
    return memo;
  }
  /* Stored id missing or corrupt — same answer as a cold open, minus the
     session question (already marked above). */
  const fresh = createThread();
  setCurrentThreadId(fresh.id);
  seedMsgId(fresh.messages);
  memo = { threadId: fresh.id, messages: [], threads: getThreads(), fresh: true };
  return memo;
}

