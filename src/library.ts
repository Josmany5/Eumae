/* Library: authored files, folders, favorites, trash, folder prefs.
 *
 * Authored files (the mockup's S.files) live here, validated like every
 * other store. Uploads (paperclip bytes in IndexedDB) live in uploads.ts;
 * this store only remembers which folder an upload was filed into
 * (`filed`) and how each folder looks (`prefs`: icon/list + sort).
 * Mockup rules kept: L9 live-only, TYPE10 type tabs, folOf kind folders,
 * favs8 seed f1, trash8 with restore-as-draft.
 */

export type LibKind =
  | 'DOC' | 'PDF' | 'IMG' | 'WEB' | 'WIDGET'
  | 'GAME' | 'LINK' | 'ROUTINE' | 'COURSE' | 'DIGEST';

export const LIB_KINDS: LibKind[] = [
  'DOC', 'PDF', 'IMG', 'WEB', 'WIDGET', 'GAME', 'LINK', 'ROUTINE', 'COURSE', 'DIGEST',
];

export interface LibFile {
  id: string;
  t: string;
  k: LibKind;
  /** 'live' shows everywhere; 'draft' only in Studio + All. The mockup's L9. */
  st: 'live' | 'draft';
  v: number;
  b: string;
  /** Version history — the mockup's hist9: old {version, body} pairs plus
   * when each was saved. Push on edit-save; restore reads from it. */
  hist?: { v: number; b: string; at: number }[];
  /** Folder override — without one, folderOf files it by kind. */
  fol8?: string;
  /** ms since epoch — Recent + date-sort read this. */
  createdAt: number;
  example?: boolean;
}

export interface TrashRow {
  t: string;
  k: string;
}

export type LibViewMode = 'icon' | 'list';
export type LibSortKey = 'name' | 'date' | 'kind';
export interface LibPrefs {
  view: LibViewMode;
  sort: LibSortKey;
  dir: 'asc' | 'desc';
}

/** Sidebar folders. Projects/Classroom/Shared render specially. */
export const BUILT_IN_FOLDERS = [
  'Documents', 'Projects', 'Classroom', 'Routines', 'Links', 'Uploads', 'Shared',
];

/** View chips — the mockup's libV five, plus Uploads. */
export const LIB_VIEWS = ['Folders', 'By type', 'Recent', 'Shared', 'Favorites', 'Uploads'] as const;
export type LibView = (typeof LIB_VIEWS)[number];

/** Type tabs — the mockup's TYPE10. All is null (no filter). */
export const TYPE_FILTERS: Record<string, LibKind[] | null> = {
  All: null,
  Documents: ['DOC'],
  PDFs: ['PDF'],
  Images: ['IMG'],
  Webpages: ['WEB'],
  Widgets: ['WIDGET', 'GAME'],
  Links: ['LINK'],
  Routines: ['ROUTINE'],
  Courses: ['COURSE'],
  Digests: ['DIGEST'],
};
export const TYPE_TABS = Object.keys(TYPE_FILTERS);

/* Default folder by kind — the mockup's folOf. */
const KIND_FOLDER: Partial<Record<LibKind, string>> = {
  DOC: 'Documents',
  ROUTINE: 'Routines',
  LINK: 'Links',
  IMG: 'Uploads',
};

export function folderOf(f: Pick<LibFile, 'k' | 'fol8'>): string {
  return f.fol8 || KIND_FOLDER[f.k] || 'Documents';
}

export function liveOnly(files: LibFile[]): LibFile[] {
  return files.filter((f) => f.st === 'live');
}

interface LibState {
  files: LibFile[];
  folders: string[];
  favs: string[];
  trash: TrashRow[];
  /** Upload id → folder. Unlisted uploads live in Uploads. */
  filed: Record<string, string>;
  prefs: Record<string, LibPrefs>;
}

const KEY = 'eumae:library';
let cache: LibState | null = null;
function isHistRow(h: unknown): h is { v: number; b: string; at: number } {
  if (!h || typeof h !== 'object') return false;
  const o = h as Record<string, unknown>;
  return typeof o.v === 'number' && typeof o.b === 'string' && typeof o.at === 'number';
}

function isLibFile(f: unknown): f is LibFile {
  if (!f || typeof f !== 'object') return false;
  const o = f as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.t === 'string' &&
    (LIB_KINDS as string[]).includes(o.k as string) &&
    (o.st === 'live' || o.st === 'draft') &&
    typeof o.v === 'number' &&
    typeof o.b === 'string' &&
    (o.hist === undefined || (Array.isArray(o.hist) && o.hist.every(isHistRow))) &&
    typeof o.createdAt === 'number'
  );
}

function isTrashRow(r: unknown): r is TrashRow {
  if (!r || typeof r !== 'object') return false;
  const o = r as Record<string, unknown>;
  return typeof o.t === 'string' && typeof o.k === 'string';
}

/* The mockup's own seeds, verbatim (S.files + favs8 + trash8). Dates are
   staggered so Recent has an order - the mockup orders by insertion. */
function seeds(): LibState {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  return {
    files: [
      { id: 'f1', t: 'Gym split - v3', k: 'DOC', st: 'live', v: 3, b: 'Push/pull/legs, 5 days.', createdAt: now - 3 * day, example: true },
      { id: 'f2', t: 'YC application draft', k: 'DOC', st: 'draft', v: 1, b: 'Why now ...', createdAt: now - 2 * day, example: true },
      { id: 'f3', t: 'Morning brief - routine', k: 'ROUTINE', st: 'live', v: 2, b: 'Runs weekdays 7 AM.', createdAt: now - day, example: true },
      { id: 'f4', t: 'gbrain teardown', k: 'LINK', st: 'live', v: 1, b: 'https://...', createdAt: now, example: true },
    ],
    folders: [],
    favs: ['f1'],
    trash: [{ t: 'Old pitch draft', k: 'DOC' }],
    filed: {},
    prefs: {},
  };
}

function load(): LibState {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      cache = seeds();
      return cache;
    }
    cache = normalize(JSON.parse(raw));
    return cache;
  } catch {
    cache = seeds();
    return cache;
  }
}

/* One bad row drops, never the shelf - the projects.ts pattern. */
function normalize(s: unknown): LibState {
  const base = seeds();
  if (!s || typeof s !== 'object') return base;
  const o = s as Record<string, unknown>;
  return {
    files: Array.isArray(o.files) ? o.files.filter(isLibFile) : base.files,
    folders: Array.isArray(o.folders) ? o.folders.filter((f): f is string => typeof f === 'string') : [],
    favs: Array.isArray(o.favs) ? o.favs.filter((f): f is string => typeof f === 'string') : base.favs,
    trash: Array.isArray(o.trash) ? o.trash.filter(isTrashRow) : base.trash,
    filed: o.filed && typeof o.filed === 'object' ? (o.filed as Record<string, string>) : {},
    prefs: o.prefs && typeof o.prefs === 'object' ? (o.prefs as Record<string, LibPrefs>) : {},
  };
}

function save(s: LibState): void {
  cache = s;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* Storage full - in-memory still works. */
  }
}

/* Readers - copies out, like dash.ts. */
export function getFiles(): LibFile[] {
  return load().files.map((f) => ({ ...f }));
}

export function getFolders(): string[] {
  return [...load().folders];
}

export function allFolders(): string[] {
  const s = load();
  return [...BUILT_IN_FOLDERS, ...s.folders.filter((f) => !BUILT_IN_FOLDERS.includes(f))];
}

export function getFavs(): string[] {
  return [...load().favs];
}

export function getTrash(): TrashRow[] {
  return load().trash.map((t) => ({ ...t }));
}

export function filedFolder(uploadId: string): string {
  return load().filed[uploadId] || 'Uploads';
}

export function folderPrefs(folder: string): LibPrefs {
  return load().prefs[folder] || { view: 'list', sort: 'name', dir: 'asc' };
}

export function setFolderPrefs(folder: string, prefs: Partial<LibPrefs>): void {
  const s = load();
  save({ ...s, prefs: { ...s.prefs, [folder]: { ...folderPrefs(folder), ...prefs } } });
}

/* Files in a folder, live-only - the Folders view. Drafts stay in Studio
   and By-type/All, per the mockup's note. */
export function filesIn(folder: string): LibFile[] {
  return liveOnly(load().files).filter((f) => folderOf(f) === folder);
}

export function folderCount(folder: string, uploadCount: number): number {
  return filesIn(folder).length + uploadCount;
}

/* Ops. Every writer saves once. */
export function addFolder(name: string): string {
  const s = load();
  const n = name.trim();
  if (!n) return 'Name it first.';
  if (allFolders().includes(n)) return 'That folder already exists.';
  save({ ...s, folders: [...s.folders, n] });
  return 'Folder created.';
}

export function addFile(t: string, k: LibKind, folder?: string): LibFile {
  const s = load();
  const f: LibFile = {
    id: 'f' + Date.now().toString(36),
    t: t.trim() || 'Untitled',
    k,
    st: 'draft',
    v: 1,
    b: '',
    fol8: folder,
    createdAt: Date.now(),
  };
  save({ ...s, files: [f, ...s.files] });
  return { ...f };
}

export function toggleFav(id: string): boolean {
  const s = load();
  const on = !s.favs.includes(id);
  save({ ...s, favs: on ? [...s.favs, id] : s.favs.filter((f) => f !== id) });
  return on;
}

export function toggleStatus(id: string): LibFile | null {
  const s = load();
  const f = s.files.find((x) => x.id === id);
  if (!f) return null;
  const next = { ...f, st: (f.st === 'draft' ? 'live' : 'draft') as 'live' | 'draft' };
  save({ ...s, files: s.files.map((x) => (x.id === id ? next : x)) });
  return { ...next };
}

export function bumpVersion(id: string): LibFile | null {
  const s = load();
  const f = s.files.find((x) => x.id === id);
  if (!f) return null;
  const next = { ...f, v: f.v + 1 };
  save({ ...s, files: s.files.map((x) => (x.id === id ? next : x)) });
  return { ...next };
}

/* Real edit: new title + body, old body pushed to hist, version bumps —
 * the mockup's svEdit9. Returns the saved file. */
export function saveEdit(id: string, t: string, b: string): LibFile | null {
  const s = load();
  const f = s.files.find((x) => x.id === id);
  if (!f) return null;
  const next: LibFile = {
    ...f,
    t: t.trim() || f.t,
    b,
    hist: [...(f.hist ?? []), { v: f.v, b: f.b, at: Date.now() }],
    v: f.v + 1,
  };
  save({ ...s, files: s.files.map((x) => (x.id === id ? next : x)) });
  return { ...next };
}

/* Restore an old version as the new current — the mockup's rsVer: old
 * body becomes current, current pushed to hist, version bumps. */
export function restoreVersion(id: string, v: number): LibFile | null {
  const s = load();
  const f = s.files.find((x) => x.id === id);
  const ent = f?.hist?.find((h) => h.v === v);
  if (!f || !ent) return null;
  const next: LibFile = {
    ...f,
    b: ent.b,
    hist: [...(f.hist ?? []), { v: f.v, b: f.b, at: Date.now() }],
    v: f.v + 1,
  };
  save({ ...s, files: s.files.map((x) => (x.id === id ? next : x)) });
  return { ...next };
}

/* Delete moves to trash (the mockup's trash8); restore comes back as a
   draft, like the mockup's Restore button. Empty burns the trash. */
export function trashFile(id: string): boolean {
  const s = load();
  const f = s.files.find((x) => x.id === id);
  if (!f) return false;
  save({
    ...s,
    files: s.files.filter((x) => x.id !== id),
    trash: [{ t: f.t, k: f.k }, ...s.trash],
    favs: s.favs.filter((x) => x !== id),
  });
  return true;
}

export function restoreTrash(index: number): boolean {
  const s = load();
  const row = s.trash[index];
  if (!row) return false;
  const kind = (LIB_KINDS as string[]).includes(row.k) ? (row.k as LibKind) : 'DOC';
  const f: LibFile = {
    id: 'f' + Date.now().toString(36),
    t: row.t,
    k: kind,
    st: 'draft',
    v: 1,
    b: '',
    createdAt: Date.now(),
  };
  save({ ...s, files: [f, ...s.files], trash: s.trash.filter((_, i) => i !== index) });
  return true;
}

export function emptyTrash(): void {
  const s = load();
  save({ ...s, trash: [] });
}

export function fileUpload(id: string, folder: string): void {
  const s = load();
  save({ ...s, filed: { ...s.filed, [id]: folder } });
}

/* Sort a file list - name/date/kind, either direction. */
export function sortFiles(files: LibFile[], sort: LibSortKey, dir: 'asc' | 'desc'): LibFile[] {
  const out = [...files];
  const mul = dir === 'asc' ? 1 : -1;
  if (sort === 'name') out.sort((a, b) => a.t.localeCompare(b.t) * mul);
  else if (sort === 'date') out.sort((a, b) => (a.createdAt - b.createdAt) * mul);
  else out.sort((a, b) => a.k.localeCompare(b.k) * mul);
  return out;
}
