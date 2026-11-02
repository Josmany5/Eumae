import type { SupabaseClient } from '@supabase/supabase-js';
import { onStoreWrite } from './storage';
import { accessToken, dataClient } from './auth';
import { getTasks, getLists, restoreTasks } from './tasks';
import { getNotes, restoreNotes } from './notes';
import { getEvents, restoreEvents } from './events';
import { getGoals, restoreGoals } from './goals';
import { getProjects, getPinnedProjectId, restoreProjects } from './projects';
import { getRoles, restoreRoles } from './roles';
import { getFlows, restoreFlows } from './flows';
import { getThreads, restoreThreads } from './threads';
import { snapshotSbx, restoreSbx } from './sandbox';
import { getSessions, restoreSessions } from './studioChat';
import { snapshotLibrary, restoreLibrary } from './library';
import { snapshotDash, restoreDash } from './dash';
import { snapshotGuildDash, restoreGuildDash } from './gdash';
import { snapshotGuild, restoreGuild } from './guild';
import { snapshotClassroom, restoreClassroom } from './classroom';

/* Sync: the local stores stay the working copy (the app boots and runs from
 * the device, signed in or not); this module carries them to the `items`
 * table and back. A store write marks its kind dirty; a flush merges that
 * kind against the server three ways — what this device last synced (the
 * base) is the referee, so a change made on one side only always wins, and
 * a change made on both sides goes to the newer stamp inside the item.
 *
 * Not synced, on purpose: uploads (their bytes live in this device's
 * IndexedDB — an index row without its file would arrive broken), the
 * project pin and current thread (per-device), and device preferences
 * (theme, home toggles, the Studio drawer). */

interface KindDef {
  kind: string;
  single: boolean;
  read: () => unknown[];
  restore: (items: unknown[]) => void;
  idOf: (item: unknown) => string;
}

const byId = (item: unknown): string => String((item as { id: unknown }).id);
const stateId = (): string => 'state';
const single = (readOne: () => unknown, restoreOne: (value: unknown) => void): Pick<KindDef, 'read' | 'restore'> => ({
  read: () => [readOne()],
  restore: (items) => {
    if (items.length) restoreOne(items[0]);
  },
});

const KINDS: (KindDef & { key: string })[] = [
  { key: 'eumae:tasks', kind: 'task', single: false, read: () => getTasks(), restore: (v) => restoreTasks({ tasks: v as never[], lists: getLists() }), idOf: byId },
  { key: 'eumae:taskLists', kind: 'taskList', single: false, read: () => getLists(), restore: (v) => restoreTasks({ tasks: getTasks(), lists: v as never[] }), idOf: byId },
  { key: 'eumae:notes', kind: 'note', single: false, read: () => getNotes(), restore: (v) => restoreNotes(v as never[]), idOf: byId },
  { key: 'eumae:events', kind: 'event', single: false, read: () => getEvents(), restore: (v) => restoreEvents(v as never[]), idOf: byId },
  { key: 'eumae:goals', kind: 'goal', single: false, read: () => getGoals(), restore: (v) => restoreGoals(v as never[]), idOf: byId },
  { key: 'eumae:projects', kind: 'project', single: false, read: () => getProjects(), restore: (v) => restoreProjects({ projects: v as never[], pin: getPinnedProjectId() }), idOf: byId },
  { key: 'eumae:roles', kind: 'role', single: false, read: () => getRoles(), restore: (v) => restoreRoles(v as never[]), idOf: (r) => String((r as { n: unknown }).n) },
  { key: 'eumae:flows', kind: 'flow', single: false, read: () => getFlows(), restore: (v) => restoreFlows(v as never[]), idOf: byId },
  { key: 'eumae:threads', kind: 'thread', single: false, read: () => getThreads(), restore: (v) => restoreThreads(v as never[]), idOf: byId },
  { key: 'eumae:sandbox', kind: 'sandbox', single: false, read: () => snapshotSbx(), restore: (v) => restoreSbx(v as never[]), idOf: byId },
  { key: 'eumae:studioChats3', kind: 'studioChat', single: false, read: () => getSessions(), restore: (v) => restoreSessions(v as never[]), idOf: byId },
  { key: 'eumae:library', kind: 'library', single: true, idOf: stateId, ...single(() => snapshotLibrary(), (v) => restoreLibrary(v as never)) },
  { key: 'eumae:dash', kind: 'dash', single: true, idOf: stateId, ...single(() => snapshotDash(), (v) => restoreDash(v as never)) },
  { key: 'eumae:gdash', kind: 'gdash', single: true, idOf: stateId, ...single(() => snapshotGuildDash(), (v) => restoreGuildDash(v as never)) },
  { key: 'eumae:guild', kind: 'guild', single: true, idOf: stateId, ...single(() => snapshotGuild(), (v) => restoreGuild(v as never)) },
  { key: 'eumae:classroom', kind: 'classroom', single: true, idOf: stateId, ...single(() => snapshotClassroom(), (v) => restoreClassroom(v as never)) },
];
const BY_KEY: Record<string, (typeof KINDS)[number]> = Object.fromEntries(KINDS.map((d) => [d.key, d]));
const BY_KIND: Record<string, (typeof KINDS)[number]> = Object.fromEntries(KINDS.map((d) => [d.kind, d]));

/* The item's own clock, when it carries one. Stamps settle only the
 * both-sides-changed case; one-sided changes never reach the comparison. */
function stampOf(item: unknown): number {
  if (!item || typeof item !== 'object') return 0;
  const o = item as Record<string, unknown>;
  for (const k of ['updatedAt', 'upd', 'createdAt']) {
    if (typeof o[k] === 'number') return o[k] as number;
  }
  return 0;
}

function hash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
const hashOf = (item: unknown): string => hash(JSON.stringify(item));

export interface RemoteItem {
  data: unknown;
  deleted: boolean;
}
export interface BaseEntry {
  h: string;
  t: number;
}
export interface MergeOut {
  local: unknown[];
  localChanged: boolean;
  upserts: { id: string; data: unknown }[];
  deletes: { id: string; data: unknown }[];
  base: Record<string, BaseEntry>;
}

/* The merge, pure so checks/sync.mjs can run every case. `base` is what this
 * device last agreed with the server; an id missing from `remote` while
 * present in `base` is left alone — rows are never hard-deleted here, so an
 * absence means the read was partial, not that the item is gone. */
export function mergeKind(
  def: { single: boolean; idOf: (item: unknown) => string },
  localItems: unknown[],
  remote: Map<string, RemoteItem>,
  base: Record<string, BaseEntry>,
): MergeOut {
  const localById = new Map<string, unknown>();
  for (const item of localItems) localById.set(def.idOf(item), item);
  const firstSync = Object.keys(base).length === 0;
  const remoteAlive = [...remote.values()].some((r) => !r.deleted);

  const out: MergeOut = { local: [], localChanged: false, upserts: [], deletes: [], base: {} };
  const keepLocal = (id: string, item: unknown) => {
    out.local.push(item);
    out.base[id] = { h: hashOf(item), t: stampOf(item) };
  };
  const takeRemote = (id: string, item: unknown) => {
    out.local.push(item);
    out.base[id] = { h: hashOf(item), t: stampOf(item) };
  };

  const ids = new Set<string>([...localById.keys(), ...remote.keys(), ...Object.keys(base)]);
  for (const id of ids) {
    const l = localById.get(id);
    const r = remote.get(id);
    const b = base[id];
    /* First contact with an account that already has this kind: the
     * untouched example rows on this device were scaffolding, not data. */
    if (
      firstSync &&
      !def.single &&
      remoteAlive &&
      l !== undefined &&
      r === undefined &&
      b === undefined &&
      (l as { example?: unknown }).example === true
    ) {
      continue;
    }
    if (l !== undefined && r === undefined) {
      if (b === undefined) {
        keepLocal(id, l);
        out.upserts.push({ id, data: l });
      } else {
        keepLocal(id, l);
      }
      continue;
    }
    if (l === undefined && r !== undefined) {
      if (r.deleted) continue;
      if (b === undefined) {
        takeRemote(id, r.data);
        continue;
      }
      /* Deleted here. A remote that also changed wins — the delete was made
       * without seeing that change; an unchanged remote lets it stand. */
      if (hashOf(r.data) !== b.h) takeRemote(id, r.data);
      else out.deletes.push({ id, data: r.data });
      continue;
    }
    if (l === undefined && r === undefined) continue;
    /* A single's local value on a never-synced device is a seed or a
     * pre-account edit; the account's state wins, or every fresh device
     * would overwrite it with its own seed. */
    if (firstSync && def.single && l !== undefined && r !== undefined && !r.deleted) {
      takeRemote(id, r.data);
      continue;
    }
    if (l !== undefined && r !== undefined) {
      if (r.deleted) {
        if (def.single || b === undefined || hashOf(l) === b.h) continue;
        keepLocal(id, l);
        out.upserts.push({ id, data: l });
        continue;
      }
      const localChanged = b === undefined || hashOf(l) !== b.h;
      const remoteChanged = b === undefined || hashOf(r.data) !== b.h;
      if (!localChanged && !remoteChanged) {
        keepLocal(id, l);
      } else if (localChanged && !remoteChanged) {
        keepLocal(id, l);
        out.upserts.push({ id, data: l });
      } else if (!localChanged && remoteChanged) {
        takeRemote(id, r.data);
      } else if (stampOf(r.data) > stampOf(l)) {
        takeRemote(id, r.data);
      } else {
        keepLocal(id, l);
        out.upserts.push({ id, data: l });
      }
      continue;
    }
  }

  const before = localItems.map((i) => hashOf(i)).join('|');
  const after = out.local.map((i) => hashOf(i)).join('|');
  out.localChanged = before !== after;
  return out;
}

/* ── Status, for the Settings surface ─────────────────────────────── */

export type SyncStatus = 'off' | 'syncing' | 'idle' | 'error';
let statusSnap: { status: SyncStatus; lastAt: number } = { status: 'off', lastAt: 0 };
const statusListeners = new Set<() => void>();
export function syncStatus(): { status: SyncStatus; lastAt: number } {
  return statusSnap;
}
export function onSyncStatus(fn: () => void): () => void {
  statusListeners.add(fn);
  return () => {
    statusListeners.delete(fn);
  };
}
function setStatus(next: SyncStatus): void {
  statusSnap = { status: next, lastAt: next === 'idle' ? Date.now() : statusSnap.lastAt };
  statusListeners.forEach((fn) => fn());
}

/* ── The engine ───────────────────────────────────────────────────── */

const BASE_KEY = 'eumae:syncBase';
type AllBase = Record<string, Record<string, Record<string, BaseEntry>>>;

function loadAllBase(): AllBase {
  try {
    const raw = localStorage.getItem(BASE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as AllBase) : {};
  } catch {
    return {};
  }
}
function saveAllBase(all: AllBase): void {
  try {
    localStorage.setItem(BASE_KEY, JSON.stringify(all));
  } catch {
    /* Storage full — the next boot re-merges from the server instead. */
  }
}

let started = false;
let client: SupabaseClient | null = null;
let userId: string | null = null;
let applying = false;
const dirty = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing: Promise<void> | null = null;

export async function startSync(): Promise<void> {
  if (started) return;
  started = true;
  onStoreWrite((key) => {
    const def = BY_KEY[key];
    if (def && !applying) {
      dirty.add(def.kind);
      scheduleFlush();
    }
  });
  if (typeof window !== 'undefined') window.addEventListener('online', scheduleFlush);
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) void syncMemories().catch(() => setStatus('error'));
    });
  }
  await accessToken();
  const c = await dataClient();
  if (!c) {
    setStatus('off');
    return;
  }
  client = c;
  const { data } = await c.auth.getSession();
  if (!data.session) {
    setStatus('off');
    return;
  }
  userId = data.session.user.id;
  for (const def of KINDS) dirty.add(def.kind);
  c.auth.onAuthStateChange((_event, session) => {
    if (!session) {
      userId = null;
      setStatus('off');
      return;
    }
    if (session.user.id !== userId) {
      userId = session.user.id;
      for (const def of KINDS) dirty.add(def.kind);
      scheduleFlush();
    }
  });
  await flush();
}

function scheduleFlush(): void {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, 600);
}

async function flush(): Promise<void> {
  if (flushing) return flushing;
  if (!client || !userId || dirty.size === 0) return;
  const kinds = [...dirty];
  dirty.clear();
  setStatus('syncing');
  flushing = (async () => {
    const failed: string[] = [];
    for (const kind of kinds) {
      try {
        await syncKind(BY_KIND[kind]);
      } catch {
        failed.push(kind);
      }
    }
    let memFailed = false;
    try {
      await syncMemories();
    } catch {
      memFailed = true;
    }
    for (const kind of failed) dirty.add(kind);
    setStatus(failed.length || memFailed ? 'error' : 'idle');
  })();
  try {
    await flushing;
  } finally {
    flushing = null;
  }
  if (dirty.size) scheduleFlush();
}

async function pullKind(kind: string): Promise<Map<string, RemoteItem>> {
  const rows = new Map<string, RemoteItem>();
  if (!client || !userId) return rows;
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client
      .from('items')
      .select('id,data,deleted_at')
      .eq('user_id', userId)
      .eq('kind', kind)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) rows.set(String(row.id), { data: row.data, deleted: row.deleted_at != null });
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

async function syncKind(def: (typeof KINDS)[number]): Promise<void> {
  if (!client || !userId) return;
  const all = loadAllBase();
  const mine = all[userId] ?? {};
  const base = mine[def.kind] ?? {};
  const remote = await pullKind(def.kind);
  const merged = mergeKind(def, def.read(), remote, base);

  if (merged.localChanged) {
    applying = true;
    try {
      def.restore(merged.local);
    } finally {
      applying = false;
    }
  }
  const now = new Date().toISOString();
  if (merged.upserts.length) {
    const rows = merged.upserts.map((u) => ({
      user_id: userId as string,
      kind: def.kind,
      id: u.id,
      data: u.data as never,
      updated_at: now,
      deleted_at: null,
    }));
    const { error } = await client.from('items').upsert(rows, { onConflict: 'user_id,kind,id' });
    if (error) throw new Error(error.message);
  }
  if (merged.deletes.length) {
    const rows = merged.deletes.map((d) => ({
      user_id: userId as string,
      kind: def.kind,
      id: d.id,
      data: d.data as never,
      updated_at: now,
      deleted_at: now,
    }));
    const { error } = await client.from('items').upsert(rows, { onConflict: 'user_id,kind,id' });
    if (error) throw new Error(error.message);
  }
  mine[def.kind] = merged.base;
  all[userId] = mine;
  saveAllBase(all);
}

/* ── Saved memories → the memories table ────────────────────────────
 * Settings keeps what Eumae was taught in `eumae:mems` ({id, t}) through
 * its own hook, not a store module, so there is no write to hook into:
 * this reconciles the whole list on every flush and whenever the app
 * comes back to the front. The base remembers which server row each
 * local memory is, so an edit retires the old row and a forget retires
 * its row — nothing is ever hard-deleted. */

const MEMS_KEY = 'eumae:mems';
const MEM_BASE_KEY = 'eumae:syncMemBase';

interface Mem {
  id: string;
  t: string;
}
interface MemBaseEntry {
  uuid: string;
  h: string;
}
type AllMemBase = Record<string, Record<string, MemBaseEntry>>;

function readMems(): Mem[] {
  try {
    const raw = localStorage.getItem(MEMS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((m): m is Mem => !!m && typeof m === 'object' && typeof (m as Mem).id === 'string' && typeof (m as Mem).t === 'string')
      : [];
  } catch {
    return [];
  }
}
function writeMems(mems: Mem[]): void {
  try {
    localStorage.setItem(MEMS_KEY, JSON.stringify(mems));
  } catch {
    /* Non-fatal — the reconcile runs again on the next flush. */
  }
}
function loadMemBase(): AllMemBase {
  try {
    const raw = localStorage.getItem(MEM_BASE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as AllMemBase) : {};
  } catch {
    return {};
  }
}
function saveMemBase(all: AllMemBase): void {
  try {
    localStorage.setItem(MEM_BASE_KEY, JSON.stringify(all));
  } catch {
    /* Non-fatal. */
  }
}

let memBusy = false;
async function syncMemories(): Promise<void> {
  if (!client || !userId || memBusy) return;
  memBusy = true;
  try {
    const rows: { id: string; text: string }[] = [];
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await client
        .from('memories')
        .select('id,text')
        .eq('user_id', userId)
        .is('retired_at', null)
        .range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      for (const r of data ?? []) rows.push({ id: String(r.id), text: String(r.text) });
      if (!data || data.length < PAGE) break;
    }
    const byUuid = new Map(rows.map((r) => [r.id, r.text]));
    const byText = new Map<string, string>();
    for (const r of rows) if (!byText.has(r.text)) byText.set(r.text, r.id);

    const all = loadMemBase();
    const base: Record<string, MemBaseEntry> = all[userId] ?? {};
    const mems = readMems();
    const localIds = new Set(mems.map((m) => m.id));
    const claimed = new Set<string>();
    let memsChanged = false;
    const now = new Date().toISOString();

    for (const m of mems) {
      const b = base[m.id];
      if (b) {
        const serverText = byUuid.get(b.uuid);
        if (serverText === m.t) {
          claimed.add(b.uuid);
          continue;
        }
        if (serverText !== undefined && hash(m.t) === b.h) {
          m.t = serverText;
          base[m.id] = { uuid: b.uuid, h: hash(serverText) };
          claimed.add(b.uuid);
          memsChanged = true;
          continue;
        }
        if (serverText !== undefined) {
          const { error } = await client.from('memories').update({ retired_at: now }).eq('id', b.uuid);
          if (error) throw new Error(error.message);
          claimed.add(b.uuid);
        }
        delete base[m.id];
      }
      const existing = byText.get(m.t);
      if (existing && !claimed.has(existing)) {
        base[m.id] = { uuid: existing, h: hash(m.t) };
        claimed.add(existing);
      } else {
        const { data, error } = await client
          .from('memories')
          .insert({ user_id: userId, text: m.t, source: 'settings' })
          .select('id')
          .single();
        if (error) throw new Error(error.message);
        const uuid = String((data as { id: unknown }).id);
        base[m.id] = { uuid, h: hash(m.t) };
        claimed.add(uuid);
        byText.set(m.t, uuid);
      }
    }
    for (const [localId, b] of Object.entries(base)) {
      if (!localIds.has(localId)) {
        if (byUuid.has(b.uuid)) {
          const { error } = await client.from('memories').update({ retired_at: now }).eq('id', b.uuid);
          if (error) throw new Error(error.message);
        }
        delete base[localId];
      }
    }
    for (const r of rows) {
      if (!claimed.has(r.id) && !mems.some((m) => m.t === r.text)) {
        const id = `m${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
        mems.push({ id, t: r.text });
        base[id] = { uuid: r.id, h: hash(r.text) };
        memsChanged = true;
      }
    }
    if (memsChanged) writeMems(mems);
    all[userId] = base;
    saveMemBase(all);
  } finally {
    memBusy = false;
  }
}
