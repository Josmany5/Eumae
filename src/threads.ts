import type { ApiChatBody, ThreadTurn } from './request';

/** One message in a thread. Attachments are pointers (§4.15): `uploadId`
 *  survives in storage, `url` is memory-only (live send + live preview). */
export interface Msg extends ThreadTurn {
  id: number;
  body?: ApiChatBody;
  streaming?: boolean;
  note?: string;
  sources?: { uri: string; title: string }[];
  attachments?: { label: string; icon: string; uploadId?: string; url?: string }[];
  ts: number;
}

/** A conversation thread — the unit of chat persistence. */
export interface Thread {
  id: string;
  /** First user message, truncated. Generated on first send. */
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Msg[];
  /** Where it started, when not in Chat ("Console office"). */
  from?: string;
}

const KEY = 'eumae:threads';
const CURRENT_KEY = 'eumae:currentThread';

/* In-memory cache — loaded once, written through on save. Every read used
   to parse the whole block from storage; during streaming that was dozens of
   full parse/stringify cycles per reply. */
let cache: Thread[] | null = null;

function load(): Thread[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      cache = [];
      return cache;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      cache = [];
      return cache;
    }
    let dropped = 0;
    const cleaned: Thread[] = [];
    for (const t of parsed) {
      if (!isThread(t)) {
        dropped++;
        continue;
      }
      const msgs = cleanMessages(t.messages);
      dropped += t.messages.length - msgs.length;
      cleaned.push({ ...t, messages: msgs });
    }
    cache = cleaned;
    /* A bad row dies once: write the cleaned list back so the next boot
       never reads it again. A crash-looping message is dropped here, before
       React ever sees it. */
    if (dropped > 0) {
      try {
        localStorage.setItem(KEY, JSON.stringify(cleaned));
      } catch {
        /* Non-fatal — memory still holds the cleaned list. */
      }
    }
    return cache;
  } catch {
    cache = [];
    return cache;
  }
}

/* Something outside Chat (Mae's office) changed a thread: App re-reads. */
export const THREADS_EVENT = 'eumae:threads';
export function threadsChanged(): void {
  try {
    window.dispatchEvent(new Event(THREADS_EVENT));
  } catch {
    /* no window in checks */
  }
}

function save(threads: Thread[]): void {
  cache = threads;
  try {
    localStorage.setItem(KEY, JSON.stringify(threads));
  } catch {
    /* Storage full or unavailable — the in-memory threads still work. */
  }
}

export function getThreads(): Thread[] {
  return [...load()].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getThread(id: string): Thread | undefined {
  return load().find((t) => t.id === id);
}

export function saveThread(thread: Thread): void {
  const threads = load();
  const i = threads.findIndex((t) => t.id === thread.id);
  const updated = { ...thread, updatedAt: Date.now() };
  if (i >= 0) threads[i] = updated;
  else threads.push(updated);
  save(threads);
}

export function createThread(): Thread {
  const now = Date.now();
  const thread: Thread = {
    /* Random suffix: two creates in the same millisecond (fast double-tap New
       chat, StrictMode double-boot) must never mint the same id and overwrite
       each other. Same shape as uploads.ts. */
    id: `t${now.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
    title: 'New chat',
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
  saveThread(thread);
  return thread;
}

/* A chat as a Markdown file, downloaded. Shared by the phone drawer and the
   desktop rail so both export the same thing. */
export function downloadThread(id: string): void {
  const thread = getThread(id);
  if (!thread) return;
  const lines = [`# ${thread.title}`, ''];
  lines.push(`_${new Date(thread.createdAt).toLocaleString()}_`, '');
  for (const m of thread.messages) {
    const who = m.role === 'you' ? '**You**' : '**Eumae**';
    const time = m.ts ? ` <sub>${new Date(m.ts).toLocaleTimeString()}</sub>` : '';
    lines.push(`${who}${time}`, '', m.text || '', '');
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${thread.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

export function deleteThread(id: string): void {
  save(load().filter((t) => t.id !== id));
}

export function getCurrentThreadId(): string | null {
  try {
    return localStorage.getItem(CURRENT_KEY);
  } catch {
    return null;
  }
}

export function setCurrentThreadId(id: string): void {
  try {
    localStorage.setItem(CURRENT_KEY, id);
  } catch {
    /* Non-fatal. */
  }
}

/** Title from the first user message — whole words, no newlines. Cutting
 *  mid-word used to leave titles like "Plan my da…". */
export function titleFor(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return 'New chat';
  if (clean.length <= 40) return clean;
  const cut = clean.slice(0, 40);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 12 ? cut.slice(0, lastSpace) : cut) + '…';
}

/** A stored thread is only usable if it has the shape we expect. Threads are
 *  checked on load, and now their messages are too: one malformed message
 *  (wrong types, unknown role, bad attachment/source rows) used to reach
 *  React and crash the whole boot — Reload re-read the same row and crashed
 *  again, with no way out but clearing site data by hand. Bad rows are
 *  dropped here, before React ever sees them; `load()` writes the cleaned
 *  list back so a bad row dies once. */
function isThread(t: unknown): t is Thread {
  if (!t || typeof t !== 'object') return false;
  const o = t as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.title === 'string' &&
    typeof o.createdAt === 'number' &&
    typeof o.updatedAt === 'number' &&
    Array.isArray(o.messages)
  );
}

/** One stored message is usable if its core fields hold. Unknown extra keys
 *  are fine (forward-compatible); wrong-typed core or sub-rows are not. */
function isMsg(m: unknown): m is Msg {
  if (!m || typeof m !== 'object') return false;
  const o = m as Record<string, unknown>;
  if (typeof o.id !== 'number' || !Number.isFinite(o.id)) return false;
  if (o.role !== 'you' && o.role !== 'eumae') return false;
  if (typeof o.text !== 'string') return false;
  if (typeof o.ts !== 'number' || !Number.isFinite(o.ts)) return false;
  if (o.streaming !== undefined && typeof o.streaming !== 'boolean') return false;
  if (o.note !== undefined && typeof o.note !== 'string') return false;
  if (o.sources !== undefined) {
    if (!Array.isArray(o.sources)) return false;
    for (const s of o.sources) {
      if (!s || typeof s !== 'object') return false;
      const so = s as Record<string, unknown>;
      if (typeof so.uri !== 'string' || typeof so.title !== 'string') return false;
    }
  }
  if (o.attachments !== undefined) {
    if (!Array.isArray(o.attachments)) return false;
    for (const a of o.attachments) {
      if (!a || typeof a !== 'object') return false;
      const ao = a as Record<string, unknown>;
      if (typeof ao.label !== 'string' || typeof ao.icon !== 'string') return false;
      if (ao.uploadId !== undefined && typeof ao.uploadId !== 'string') return false;
      if (ao.url !== undefined && typeof ao.url !== 'string') return false;
    }
  }
  return true;
}

function cleanMessages(messages: unknown): Msg[] {
  if (!Array.isArray(messages)) return [];
  return messages.filter(isMsg);
}

/* Undo: a deep copy of the store taken before a delete; the toast's Undo
   writes it back. Same shape as snapshotTasks / snapshotLibrary. */
export function snapshotThreads(): Thread[] {
  return JSON.parse(JSON.stringify(load()));
}

export function restoreThreads(s: Thread[]): void {
  save(s);
}
