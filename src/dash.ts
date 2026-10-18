/* Dashboard layout: which widgets live on which Console page, and at what
 * size. Fields follow the mockup's second rCon layer (`dash8.pages`,
 * `wsz10`): pages are arrays of widget ids, size is quick/full per widget.
 * The default pages are the mockup's own seed. Edit (add/remove/reorder/
 * resize) writes here — one reader, one writer.
 */

export type WidgetId =
  | 'tl8'
  | 'today8'
  | 'week8'
  | 'goals8'
  | 'brief8'
  | 'pj8'
  | 'art8'
  | 'nts8';

export type WidgetSize = 'quick' | 'full';

export const WIDGET_IDS: WidgetId[] = ['tl8', 'today8', 'week8', 'goals8', 'brief8', 'pj8', 'art8', 'nts8'];

export const WIDGET_TITLES: Record<WidgetId, string> = {
  tl8: 'Timeline',
  today8: "Today's tasks",
  week8: 'This week',
  goals8: 'Active goals',
  brief8: 'Eumae noticed',
  pj8: 'Pinned project',
  art8: 'Latest artifact',
  nts8: 'Notifications',
};

/* Widget icons, from the mockup's WIC10 — all exist in icons.tsx. */
export const WIDGET_ICONS: Record<WidgetId, string> = {
  tl8: 'clk',
  today8: 'chk',
  week8: 'cal',
  goals8: 'str',
  brief8: 'zap',
  pj8: 'fol',
  art8: 'doc',
  nts8: 'clk',
};

/* Half-width widgets when 2+ share a page — the mockup's HALC. */
const HALF: WidgetId[] = ['goals8', 'pj8', 'art8'];

export function isHalf(id: WidgetId, pageLen: number): boolean {
  return pageLen > 1 && HALF.includes(id);
}

export interface Dashboard {
  pages: WidgetId[][];
  sizes: Partial<Record<WidgetId, WidgetSize>>;
  /** User-chosen page names, by index. Missing = the default name. */
  names?: string[];
}

const KEY = 'eumae:dash';

let cache: Dashboard | null = null;

function load(): Dashboard {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      cache = seed();
      return cache;
    }
    const parsed = JSON.parse(raw);
    cache = isDashboard(parsed) ? migrate(parsed) : seed();
    return cache;
  } catch {
    cache = seed();
    return cache;
  }
}

/* Names for the seeded pages; later pages fall back to "Page N". */
export const CONSOLE_PAGE_NAMES = ['Today', 'Work'];

/* Oct 18 seed (his call): one column. Today = the Timeline, the This week
   mini strip, the briefing and notifications; the rest swipe to Work. The
   old task-list widget stays in + Add. */
const SEED_PAGES: WidgetId[][] = [
  ['tl8', 'week8', 'brief8', 'nts8'],
  ['goals8', 'pj8', 'art8'],
];

function seed(): Dashboard {
  return { pages: SEED_PAGES.map((p) => [...p]), sizes: {} };
}

/* One-time move to the Oct 18 layout: a stored dashboard without the Timeline
   gets the new Today and Work pages; any extra pages the user made stay, minus
   widgets now placed on the first two, and so do their page names. */
function migrate(d: Dashboard): Dashboard {
  if (d.pages.some((p) => p.includes('tl8'))) return d;
  const placed = new Set<WidgetId>(SEED_PAGES.flat());
  const extra = d.pages.slice(2).map((p) => p.filter((w) => !placed.has(w)));
  const next: Dashboard = { pages: [...SEED_PAGES.map((p) => [...p]), ...extra], sizes: d.sizes ?? {}, names: d.names };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* in-memory still works */
  }
  return next;
}

function save(dash: Dashboard): void {
  cache = dash;
  try {
    localStorage.setItem(KEY, JSON.stringify(dash));
  } catch {
    /* Storage full — in-memory still works. */
  }
}

function isWidgetId(id: unknown): id is WidgetId {
  return typeof id === 'string' && (WIDGET_IDS as string[]).includes(id);
}

function isDashboard(d: unknown): d is Dashboard {
  if (!d || typeof d !== 'object') return false;
  const o = d as Record<string, unknown>;
  if (!Array.isArray(o.pages)) return false;
  for (const p of o.pages) {
    if (!Array.isArray(p)) return false;
    for (const w of p) if (!isWidgetId(w)) return false;
  }
  if (o.sizes !== undefined) {
    if (!o.sizes || typeof o.sizes !== 'object') return false;
    for (const [k, v] of Object.entries(o.sizes as Record<string, unknown>)) {
      if (!isWidgetId(k)) return false;
      if (v !== 'quick' && v !== 'full') return false;
    }
  }
  return true;
}

export function getDashboard(): Dashboard {
  const d = load();
  return { pages: d.pages.map((p) => [...p]), sizes: { ...d.sizes }, names: d.names ? [...d.names] : undefined };
}

export function sizeOf(dash: Dashboard, id: WidgetId): WidgetSize {
  return dash.sizes[id] ?? 'quick';
}

export function setSize(id: WidgetId, size: WidgetSize): void {
  const d = load();
  save({ pages: d.pages, sizes: { ...d.sizes, [id]: size }, names: d.names });
}

/* Remove a widget from its page. Empty pages stay (dots keep their place)
   until Remove page is used — the mockup's dRm8. */
export function removeWidget(page: number, id: WidgetId): void {
  const d = load();
  const pages = d.pages.map((p) => [...p]);
  if (!pages[page]) return;
  pages[page] = pages[page].filter((w) => w !== id);
  save({ pages, sizes: { ...d.sizes }, names: d.names });
}

/* Add a widget to a page (no duplicates anywhere — one home per widget). */
export function addWidget(page: number, id: WidgetId): void {
  const d = load();
  const pages = d.pages.map((p) => [...p]);
  if (pages.flat().includes(id)) return;
  while (pages.length <= page) pages.push([]);
  pages[page] = [...pages[page], id];
  save({ pages, sizes: { ...d.sizes }, names: d.names });
}

/* Move a widget: within a page (reorder) or across pages. The mockup has no
   drag — remove + add only — so this is the new piece, same store. */
export function moveWidget(fromPage: number, fromIdx: number, toPage: number, toIdx: number): void {
  const d = load();
  const pages = d.pages.map((p) => [...p]);
  if (!pages[fromPage] || fromIdx < 0 || fromIdx >= pages[fromPage].length) return;
  while (pages.length <= toPage) pages.push([]);
  const [w] = pages[fromPage].splice(fromIdx, 1);
  const clamped = Math.max(0, Math.min(toIdx, pages[toPage].length));
  pages[toPage].splice(clamped, 0, w);
  save({ pages, sizes: { ...d.sizes }, names: d.names });
}

export function addPage(): number {
  const d = load();
  const pages = [...d.pages.map((p) => [...p]), []];
  save({ pages, sizes: { ...d.sizes }, names: d.names });
  return pages.length - 1;
}

export function removePage(page: number): void {
  const d = load();
  if (d.pages.length <= 1) return;
  const pages = d.pages.map((p) => [...p]);
  pages.splice(page, 1);
  const names = d.names ? [...d.names] : undefined;
  names?.splice(page, 1);
  save({ pages, sizes: { ...d.sizes }, names });
}

/** Page names as shown: the user's name, else the seeded default, else
 *  "Page N". */
export function consolePageNames(): string[] {
  const d = load();
  return d.pages.map((_, i) => String(d.names?.[i] ?? '').trim() || CONSOLE_PAGE_NAMES[i] || 'Page ' + (i + 1));
}

export function renameConsolePage(page: number, name: string): void {
  const d = load();
  const names = d.pages.map((_, i) => d.names?.[i] ?? '');
  names[page] = name.trim().slice(0, 24);
  save({ pages: d.pages.map((p) => [...p]), sizes: { ...d.sizes }, names });
}

/* Undo: a deep copy of the store taken before a delete; the toast's Undo
   writes it back. Same shape as snapshotTasks / snapshotLibrary. */
export function snapshotDash(): Dashboard {
  return JSON.parse(JSON.stringify(load()));
}

export function restoreDash(s: Dashboard): void {
  save(s);
}
