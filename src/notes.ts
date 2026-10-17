/** One entry in a note — a single writing session. */
export interface NoteEntry {
  id: string;
  /** Rich text (HTML). */
  text: string;
  /** When the entry was first written. Never changes. */
  createdAt: number;
  /** When the entry was last edited. Shown as "edited on" when different. */
  editedAt: number;
}

/** A note — one flowing document. The first line is the title (large + bold in
 *  the editor); everything under it is the body. Previously one entry per
 *  visit with boxes per block — the owner asked for a single Apple-style page
 *  (2026-10-12): no boxes, no per-entry stamps, no toggles. Old notes migrate
 *  on load (see `migrate`), so no history is lost. */
export interface Note {
  id: string;
  title: string;
  /** The whole document as HTML. First block renders as the title. */
  body: string;
  /** When each visit started — rendered as hairline session dividers inline,
   *  a journal ribbon rather than separate boxes. Appended on open. */
  sessions: number[];
  createdAt: number;
  updatedAt: number;
  ownerId: string;
  /** Pre-migration shape carried `entries` + `sortNewFirst` — kept optional so
   *  stored notes still parse, then migrated to body+sessions on load. */
  entries?: NoteEntry[];
  sortNewFirst?: boolean;
}

const KEY = 'eumae:notes';

let cache: Note[] | null = null;

function load(): Note[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      cache = [];
      return cache;
    }
    const parsed = JSON.parse(raw);
    cache = Array.isArray(parsed) ? parsed.filter(isNote).map(migrate) : [];
    return cache;
  } catch {
    cache = [];
    return cache;
  }
}

function save(notes: Note[]): void {
  cache = notes;
  try {
    localStorage.setItem(KEY, JSON.stringify(notes));
  } catch {
    /* Storage full — in-memory still works. */
  }
}

function isNote(n: unknown): n is Note {
  if (!n || typeof n !== 'object') return false;
  const o = n as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.title === 'string' &&
    typeof o.createdAt === 'number' &&
    (typeof o.body === 'string' || Array.isArray(o.entries))
  );
}

/* Migrate a pre-migration note (entries + sortNewFirst) into one flowing
   body: entries concatenated oldest-first, each stamped with its session
   divider; the stored title becomes the first line once. Idempotent. */
function migrate(note: Note): Note {
  if (typeof note.body === 'string' && Array.isArray(note.sessions)) return note;
  const entries = Array.isArray(note.entries) ? [...note.entries] : [];
  entries.sort((a, b) => a.createdAt - b.createdAt);
  const parts: string[] = [];
  const sessions: number[] = [];
  for (const e of entries) {
    if (!e.text.replace(/<[^>]+>/g, '').trim()) continue;
    sessions.push(e.createdAt);
    parts.push('<div class="nsess" data-ts="' + e.createdAt + '"></div>' + e.text);
  }
  return {
    ...note,
    title: note.title || 'Untitled',
    body: parts.join(''),
    sessions,
    entries: undefined,
    sortNewFirst: undefined,
  };
}

/* Plain text of a note — for list previews and word counts. */
export function noteText(note: Note): string {
  const body = typeof note.body === 'string' ? note.body : '';
  return body
    .replace(/<[^>]+>/g, ' ')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* Plain text of a block of the body - non-breaking spaces decoded first, so
   a trailing &nbsp; never survives as junk on the end of a title. */
export function blockText(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* The title is the first block of the document - read off the body, falling
   back to the stored title while a note is still empty. First block, not
   first sentence: noteText joins blocks with spaces, so a sentence split was
   the whole document when the title ran long. */
export function titleOf(note: Note): string {
  const body = typeof note.body === 'string' ? note.body : '';
  /* First CONTENT block: session dividers (.nsess) are chrome, and a migrated
     body leads with one - matching it would title every migrated note '' and
     fall back to the stale stored title. Walk blocks until one has text. */
  const re = /<(?:div|p|h1|h2|li)([^>]*)>([\s\S]*?)(?=<\/(?:div|p|h1|h2)|<li|<ul|<ol|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    if (/nsess/.test(m[1])) continue;
    const text = blockText(m[2]);
    if (text) return text.slice(0, 80);
  }
  const fallback = blockText(body);
  return (fallback || note.title || 'Untitled').slice(0, 80);
}

/* The list preview: the SECOND content block, decoded - the first block is
   the title. Decoded here (not in the row) so entities like &nbsp; never
   reach the list. A single-block note previews nothing; the row falls back
   to the date. */
export function previewOf(note: Note): string {
  const body = typeof note.body === 'string' ? note.body : '';
  const re = /<(?:div|p|h1|h2|li)([^>]*)>([\s\S]*?)(?=<\/(?:div|p|h1|h2)|<li|<ul|<ol|$)/gi;
  const texts: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    if (/nsess/.test(m[1])) continue;
    const t = blockText(m[2]);
    if (t) texts.push(t);
  }
  if (texts.length < 2) return '';
  return texts[1].slice(0, 60);
}

export function getNotes(): Note[] {
  return [...load()].sort((a, b) => b.updatedAt - a.updatedAt);
}
export function getNote(id: string): Note | undefined {
  return load().find((n) => n.id === id);
}

export function saveNote(note: Note): void {
  const notes = load();
  const i = notes.findIndex((n) => n.id === note.id);
  const updated = { ...note, updatedAt: Date.now() };
  if (i >= 0) notes[i] = updated;
  else notes.push(updated);
  save(notes);
}

export function createNote(title = ''): Note {
  const now = Date.now();
  const note: Note = {
    /* Random suffix, like threads and uploads: two creates in the same
       millisecond must never share an id. */
    id: `n${now.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
    title,
    body: '',
    sessions: [],
    createdAt: now,
    updatedAt: now,
    ownerId: '',
  };
  saveNote(note);
  return note;
}

/* Record a visit: appends a session divider the editor renders inline. Called
   once on open — writing always continues at the end of the one document. */
export function startSession(note: Note): Note {
  const now = Date.now();
  const updated: Note = { ...note, sessions: [...note.sessions, now] };
  saveNote(updated);
  return updated;
}

export function deleteNote(id: string): void {
  save(load().filter((n) => n.id !== id));
}

/** Start a new entry — one per visit. */
export function startEntry(): NoteEntry {
  const now = Date.now();
  return {
    id: `e${now.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
    text: '',
    createdAt: now,
    editedAt: now,
  };
}

/* Undo: a deep copy of the store taken before a delete; the toast's Undo
   writes it back. Same shape as snapshotTasks / snapshotLibrary. */
export function snapshotNotes(): Note[] {
  return JSON.parse(JSON.stringify(load()));
}

export function restoreNotes(s: Note[]): void {
  save(s);
}
