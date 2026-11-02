export interface Store<T> {
  read(): T;
  write(value: T): void;
  snapshot(): T;
  restore(value: T): void;
}

export interface StoreOptions<T> {
  seed: () => T;
  normalize: (parsed: unknown) => T;
  fallback?: () => T;
  persistNormalized?: boolean;
}

type WriteListener = (key: string) => void;
const writeListeners = new Set<WriteListener>();

export function onStoreWrite(listener: WriteListener): () => void {
  writeListeners.add(listener);
  return () => {
    writeListeners.delete(listener);
  };
}

export function createStore<T>(key: string, options: StoreOptions<T>): Store<T> {
  let cache: T | null = null;

  function read(): T {
    if (cache !== null) return cache;
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(key);
    } catch {
      raw = null;
    }
    if (raw === null) {
      cache = options.seed();
      return cache;
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      const value = options.normalize(parsed);
      cache = value;
      if (options.persistNormalized && JSON.stringify(value) !== JSON.stringify(parsed)) {
        try {
          localStorage.setItem(key, JSON.stringify(value));
        } catch {
          /* Storage full — in-memory still works. */
        }
      }
      return cache;
    } catch {
      cache = (options.fallback ?? options.seed)();
      return cache;
    }
  }

  function write(value: T): void {
    cache = value;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* Storage full — in-memory still works. */
    }
    for (const listener of [...writeListeners]) listener(key);
  }

  function snapshot(): T {
    return JSON.parse(JSON.stringify(read())) as T;
  }

  function restore(value: T): void {
    write(value);
  }

  return { read, write, snapshot, restore };
}
