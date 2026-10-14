/* Guild dashboard layout: which widgets live on which Guild page, and at
 * what size. Fields follow the mockup's Guild layer (`gdash9.pages`,
 * `wsz10` shared with the Console): pages are arrays of widget ids, size is
 * quick/full per widget. The default pages are the mockup's own seed
 * (Inbox / Network). Same edit ops as the Console dashboard — one reader,
 * one writer, separate key.
 */

export type GuildWidgetId =
  | 'gmsg9'
  | 'greq9'
  | 'gact9'
  | 'gshr9'
  | 'gmkt9'
  | 'gasn9';

export type GuildWidgetSize = 'quick' | 'full';

export const GUILD_WIDGET_IDS: GuildWidgetId[] = ['gmsg9', 'greq9', 'gact9', 'gshr9', 'gmkt9', 'gasn9'];

export const GUILD_PAGE_NAMES = ['Inbox', 'Network'];

export const GUILD_WIDGET_TITLES: Record<GuildWidgetId, string> = {
  gmsg9: 'Pending messages',
  greq9: 'Requests',
  gact9: 'Recent activity',
  gshr9: 'Shared work',
  gmkt9: 'Marketplace',
  gasn9: 'Assigned work',
};

/* Widget icons, from the mockup's GIC10 — all exist in icons.tsx. */
export const GUILD_WIDGET_ICONS: Record<GuildWidgetId, string> = {
  gmsg9: 'chat',
  greq9: 'chk',
  gact9: 'clk',
  gshr9: 'lnk',
  gmkt9: 'str',
  gasn9: 'cap',
};

/* Half-width widgets when 2+ share a page — the mockup's HALG. */
const HALF: GuildWidgetId[] = ['greq9', 'gasn9', 'gmkt9'];

export function isGuildHalf(id: GuildWidgetId, pageLen: number): boolean {
  return pageLen > 1 && HALF.includes(id);
}

export interface GuildDashboard {
  pages: GuildWidgetId[][];
  sizes: Partial<Record<GuildWidgetId, GuildWidgetSize>>;
}

const KEY = 'eumae:gdash';

let cache: GuildDashboard | null = null;

function load(): GuildDashboard {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      cache = seed();
      return cache;
    }
    const parsed = JSON.parse(raw);
    cache = isGuildDashboard(parsed) ? parsed : seed();
    return cache;
  } catch {
    cache = seed();
    return cache;
  }
}

/* The mockup's own seed (`gdash9` default): Inbox + Network. */
function seed(): GuildDashboard {
  return {
    pages: [
      ['gmsg9', 'greq9', 'gact9'],
      ['gshr9', 'gmkt9', 'gasn9'],
    ],
    sizes: {},
  };
}

function save(dash: GuildDashboard): void {
  cache = dash;
  try {
    localStorage.setItem(KEY, JSON.stringify(dash));
  } catch {
    /* Storage full — in-memory still works. */
  }
}

function isGuildWidgetId(id: unknown): id is GuildWidgetId {
  return typeof id === 'string' && (GUILD_WIDGET_IDS as string[]).includes(id);
}

function isGuildDashboard(d: unknown): d is GuildDashboard {
  if (!d || typeof d !== 'object') return false;
  const o = d as Record<string, unknown>;
  if (!Array.isArray(o.pages)) return false;
  for (const p of o.pages) {
    if (!Array.isArray(p)) return false;
    for (const w of p) if (!isGuildWidgetId(w)) return false;
  }
  if (o.sizes !== undefined) {
    if (!o.sizes || typeof o.sizes !== 'object') return false;
    for (const [k, v] of Object.entries(o.sizes as Record<string, unknown>)) {
      if (!isGuildWidgetId(k)) return false;
      if (v !== 'quick' && v !== 'full') return false;
    }
  }
  return true;
}

export function getGuildDashboard(): GuildDashboard {
  const d = load();
  return { pages: d.pages.map((p) => [...p]), sizes: { ...d.sizes } };
}

export function guildSizeOf(dash: GuildDashboard, id: GuildWidgetId): GuildWidgetSize {
  return dash.sizes[id] ?? 'quick';
}

export function setGuildSize(id: GuildWidgetId, size: GuildWidgetSize): void {
  const d = load();
  save({ pages: d.pages, sizes: { ...d.sizes, [id]: size } });
}

/* Remove a widget from its page. Empty pages stay (dots keep their place)
   until Remove page is used — the mockup's gRm9. */
export function removeGuildWidget(page: number, id: GuildWidgetId): void {
  const d = load();
  const pages = d.pages.map((p) => [...p]);
  if (!pages[page]) return;
  pages[page] = pages[page].filter((w) => w !== id);
  save({ pages, sizes: { ...d.sizes } });
}

/* Add a widget to a page (no duplicates anywhere — one home per widget). */
export function addGuildWidget(page: number, id: GuildWidgetId): void {
  const d = load();
  const pages = d.pages.map((p) => [...p]);
  if (pages.flat().includes(id)) return;
  while (pages.length <= page) pages.push([]);
  pages[page] = [...pages[page], id];
  save({ pages, sizes: { ...d.sizes } });
}

/* Move a widget: within a page (reorder) or across pages. The mockup has no
   drag — remove + add only — so this is the new piece, same store. */
export function moveGuildWidget(fromPage: number, fromIdx: number, toPage: number, toIdx: number): void {
  const d = load();
  const pages = d.pages.map((p) => [...p]);
  if (!pages[fromPage] || fromIdx < 0 || fromIdx >= pages[fromPage].length) return;
  while (pages.length <= toPage) pages.push([]);
  const [w] = pages[fromPage].splice(fromIdx, 1);
  const clamped = Math.max(0, Math.min(toIdx, pages[toPage].length));
  pages[toPage].splice(clamped, 0, w);
  save({ pages, sizes: { ...d.sizes } });
}

export function addGuildPage(): number {
  const d = load();
  const pages = [...d.pages.map((p) => [...p]), []];
  save({ pages, sizes: { ...d.sizes } });
  return pages.length - 1;
}

export function removeGuildPage(page: number): void {
  const d = load();
  if (d.pages.length <= 1) return;
  const pages = d.pages.map((p) => [...p]);
  pages.splice(page, 1);
  save({ pages, sizes: { ...d.sizes } });
}
