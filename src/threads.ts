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
    cache = Array.isArray(parsed) ? parsed.filter(isThread) : [];
    return cache;
  } catch {
    cache = [];
    return cache;
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
    id: `t${now}`,
    title: 'New chat',
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
  saveThread(thread);
  return thread;
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

/** A stored thread is only usable if it has the shape we expect. */
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
