/* The Sandbox: things Eumae makes in chat (a page, a widget, a calculator, a
 * game), kept with their versions.
 *
 * The idea is Wove's (ChatPreview + ArtifactViewer), the code is ours: Eumae
 * writes the WHOLE page as one ```html block every time, never a patch; each
 * change becomes the next version; the page runs in a locked frame. Two things
 * Wove didn't do: the frame gets a lock rule that blocks the network (a made
 * page never calls outside — the hosted-pages ruling, Oct 15), and the code is
 * pulled out of the reply, so chat shows one compact row instead of a wall of
 * html. Nothing goes live in the Library until the person taps Save; a page
 * Studio asked for is its Studio draft from the first version (syncDraft). */

import { getFiles, saveEdit, addFileWith, setStatus, snapshotLibrary, restoreLibrary } from './library';
import { takeArmedDraft } from './studio';

export interface SbxVersion {
  html: string;
  /** What was asked for this version ("make the buttons bigger"). */
  label: string;
  at: number;
}

export interface SbxItem {
  id: string;
  threadId: string | null;
  title: string;
  versions: SbxVersion[];
  /** Index of the version on show. */
  cur: number;
  /** The Library file it was saved as, and which version that was. */
  fileId?: string;
  savedV?: number;
  createdAt: number;
}


const KEY = 'eumae:sandbox';
/* localStorage is ~5 MB for the whole app, and a page is often 10–30 KB. */
const MAX_VERSIONS = 20;
const MAX_ITEMS = 40;

let cache: SbxItem[] | null = null;
let openId: string | null = null;
const subs = new Set<() => void>();
let ver = 0;

function load(): SbxItem[] {
  if (cache) return cache;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    cache = Array.isArray(raw) ? raw.filter((x) => x && typeof x.id === 'string' && Array.isArray(x.versions)) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function save(items: SbxItem[]): void {
  cache = items.slice(0, MAX_ITEMS);
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* Full storage: keep it in memory for this session rather than lose the reply. */
  }
  ver += 1;
  subs.forEach((f) => f());
}

export function subscribeSbx(f: () => void): () => void {
  subs.add(f);
  return () => subs.delete(f);
}
export function sbxVersion(): number {
  return ver;
}

export function getSbx(id: string | null | undefined): SbxItem | undefined {
  return id ? load().find((x) => x.id === id) : undefined;
}

export function latestForThread(threadId: string | null): SbxItem | undefined {
  return load().find((x) => x.threadId === threadId);
}

export function getOpenSbx(): string | null {
  return openId;
}
export function openSbx(id: string | null): void {
  openId = id;
  ver += 1;
  subs.forEach((f) => f());
}

/* ---- Pulling the page out of a reply ---- */

const BLOCK = /```html[^\n]*\n([\s\S]*?)```/gi;

/** The last complete html block in a reply, and the words around it. */
export function extractHtml(text: string): { html: string | null; rest: string } {
  let html: string | null = null;
  for (const m of text.matchAll(BLOCK)) if (m[1].includes('<')) html = m[1].trim();
  if (!html) return { html: null, rest: text };
  const rest = text.replace(BLOCK, '').replace(/\n{3,}/g, '\n\n').trim();
  return { html, rest };
}

/** While a reply is still arriving: hide the code, finished or not. */
export function hideHtmlWhileStreaming(text: string): { text: string; making: boolean } {
  const done = text.replace(BLOCK, '');
  const open = done.search(/```html/i);
  if (open >= 0) return { text: done.slice(0, open).trim(), making: true };
  return { text: done, making: done.length !== text.length };
}

export function titleOfHtml(html: string): string {
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '';
  const clean = t.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  return clean.slice(0, 60) || 'Untitled page';
}

/* ---- Is this a "make me a thing" ask? ---- */

/* Deterministic, not left to the model: "Make a Game (Arcade style: Neon
 * Strikers)" came back as a Create project card (Oct 20), because the prompt's
 * own rule says make/build/create + a thing = tools. A visual noun plus a make
 * verb, with no task/event/goal/project/note words, is a page. */
const THING = /\b(game|page|web ?page|website|site|landing|portfolio|app|calculator|widget|tracker|timer|quiz|invitation|invite|poster|flyer|dashboard|resume|résumé|menu card|card|chart|slides?|deck|form|tool|clock|counter|board)\b/i;
const MAKE = /\b(make|build|create|design|draw up|code|generate|whip up|put together)\b/i;
const OBJECT = /\b(tasks?|to-?dos?|events?|meetings?|reminders?|goals?|projects?|notes?|milestones?|subtasks?|calendar|schedule)\b/i;
const STUDIO = /^make an? .+\(.+ style: .+\)/i;

export function wantsAThing(text: string): 'studio' | 'ask' | null {
  const t = text.trim();
  if (STUDIO.test(t)) return 'studio';
  if (MAKE.test(t) && THING.test(t) && !OBJECT.test(t)) return 'ask';
  return null;
}

/** A bare "no" to an offer is a no, not a go-ahead (Oct 20). */
export function saidNoHint(text: string): string {
  return /^(no|nope|nah|no thanks|no thank you|not that|don'?t)[.!]*$/i.test(text.trim())
    ? '\n\n# THIS TURN: THEY SAID NO\nThey turned down what you last offered. Do not make it or any version of it. In one or two lines, ask what they want instead.'
    : '';
}

export const THING_TURN = '# THIS TURN: THEY WANT A THING MADE';

export function thingHint(kind: 'studio' | 'ask'): string {
  return (
    '\n\n' + THING_TURN + '\n' +
    'This message asks you to make something to use (a page, game, app or widget). Answer with the page itself ' +
    'in one ```html block for the Sandbox. Do NOT create a project, task, note or any plan card for it.' +
    (kind === 'studio'
      ? ' It is a full brief from Studio, so make it now: one line on what you made and how to play or use it, then the page.'
      : ' If the ask is very thin, you may ask one short question first; otherwise make it now.')
  );
}

/* ---- The lock ---- */

/* Scripts and inline styles run, so games and calculators work. Everything that
 * leaves the frame is blocked: fetch, outside scripts, outside images and fonts,
 * form posts. The frame's sandbox attribute (allow-scripts, no same-origin)
 * already keeps it away from the app and its storage; this keeps it off the
 * internet. A second policy can only add limits, never lift these. */
const CSP =
  "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; " +
  "img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; " +
  "form-action 'none'; base-uri 'none'";

export function lockHtml(html: string): string {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${CSP}">`;
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (h) => h + meta);
  if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, (h) => h + '<head>' + meta + '</head>');
  return '<!doctype html><html><head>' + meta + '</head><body>' + html + '</body></html>';
}

/* ---- Changes (each one undoable) ---- */

/** A reply carried a page: a new version of this chat's page, or the first one.
 *  Returns the item and how to take it back. */
export function addFromReply(threadId: string | null, html: string, label: string): { item: SbxItem; isNew: boolean; undo: () => void } {
  const items = load();
  const existing = items.find((x) => x.threadId === threadId);
  const v: SbxVersion = { html, label: label.slice(0, 80), at: Date.now() };
  const lib = snapshotLibrary();
  if (existing) {
    const before = existing;
    const versions = [...existing.versions, v].slice(-MAX_VERSIONS);
    let next: SbxItem = { ...existing, versions, cur: versions.length - 1, title: titleOfHtml(html) || existing.title };
    next = syncDraft(next);
    save([next, ...items.filter((x) => x.id !== existing.id)]);
    return {
      item: next,
      isNew: false,
      undo: () => {
        restoreLibrary(lib);
        save(load().map((x) => (x.id === before.id ? before : x)));
      },
    };
  }
  let item: SbxItem = {
    id: 's' + Date.now().toString(36),
    threadId,
    title: titleOfHtml(html),
    versions: [v],
    cur: 0,
    createdAt: Date.now(),
  };
  /* A page Studio asked for is that Studio draft: link it, so Studio shows it. */
  const armed = takeArmedDraft();
  if (armed && getFiles().some((f) => f.id === armed)) item = syncDraft({ ...item, fileId: armed, savedV: undefined });
  save([item, ...items]);
  return {
    item,
    isNew: true,
    undo: () => {
      if (openId === item.id) openId = null;
      restoreLibrary(lib);
      save(load().filter((x) => x.id !== item.id));
    },
  };
}

/* While the linked file is still a draft, each new page version is a new
   version of the Studio draft too. A live file changes only on Save. */
function syncDraft(item: SbxItem): SbxItem {
  if (!item.fileId) return item;
  const f = getFiles().find((x) => x.id === item.fileId);
  if (!f || f.st !== 'draft') return item;
  const html = item.versions[item.cur]?.html;
  if (!html || html === f.b) return { ...item, savedV: item.cur + 1 };
  return saveEdit(f.id, item.title || f.t, html) ? { ...item, savedV: item.cur + 1 } : item;
}

/** Every page made in a chat, newest first (Studio lists the unsaved ones). */
export function allSbx(): SbxItem[] {
  return load().slice();
}

export function restoreSbx(snap: SbxItem[]): void {
  save(snap.map((x) => ({ ...x })));
}

/** Throw away a chat's page. The chat keeps its words. */
export function removeSbx(id: string): void {
  if (openId === id) openId = null;
  save(load().filter((x) => x.id !== id));
}

/** Keep a chat's page as a Studio draft (not live yet). */
export function keepAsDraft(id: string): string | null {
  const it = load().find((x) => x.id === id);
  if (!it || it.fileId) return it?.fileId ?? null;
  const f = addFileWith(it.title || 'Untitled page', 'WEB', it.versions[it.cur]?.html || '');
  setStatus(f.id, 'draft');
  save(load().map((x) => (x.id === id ? { ...x, fileId: f.id, savedV: x.cur + 1 } : x)));
  return f.id;
}

export function setCur(id: string, cur: number): void {
  save(load().map((x) => (x.id === id ? { ...x, cur: Math.max(0, Math.min(cur, x.versions.length - 1)) } : x)));
}

export function markSaved(id: string, fileId: string | undefined, savedV: number | undefined): void {
  save(load().map((x) => (x.id === id ? { ...x, fileId, savedV } : x)));
}

/** The page on show, handed to Eumae so an edit changes THAT code (Wove's rule:
 *  never rebuild from memory). Only the chat's own page, never another's. */
export function sandboxContext(threadId: string | null): string {
  const it = latestForThread(threadId);
  if (!it) return '';
  const v = it.versions[it.cur];
  return (
    `\n\n# THE PAGE IN THIS CHAT'S SANDBOX ("${it.title}", v${it.cur + 1} of ${it.versions.length})\n` +
    'If they ask to change it, edit THIS code and return the whole updated page as one ```html block. ' +
    'If they clearly ask for something new and different, write a new page instead.\n```html\n' +
    v.html +
    '\n```'
  );
}

export function snapshotSbx(): SbxItem[] {
  return load().map((x) => ({ ...x }));
}
