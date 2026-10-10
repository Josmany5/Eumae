import type { Msg } from './screens/ChatScreen';

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
    cache = Array.isArray(parsed) ? parsed : [];
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

/** Title from the first user message — truncated, no newlines. */
export function titleFor(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > 40 ? clean.slice(0, 40) + '…' : clean || 'New chat';
}
