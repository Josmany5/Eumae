import { useSyncExternalStore } from 'react';

export type Skin = 'yc';

const KEY = 'eumae:skin';

function read(): Skin | null {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw === null ? null : JSON.parse(raw);
    return v === 'yc' ? 'yc' : null;
  } catch {
    return null;
  }
}

let skin: Skin | null = read();
const listeners = new Set<() => void>();

export function getSkin(): Skin | null {
  return skin;
}

export function onSkinChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function setSkin(next: Skin | null): void {
  if (next === skin) return;
  skin = next;
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {}
  listeners.forEach((fn) => fn());
}

export function useSkin(): Skin | null {
  return useSyncExternalStore(onSkinChange, getSkin, getSkin);
}
