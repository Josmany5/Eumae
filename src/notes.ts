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

/** A note — a title holding timestamped entries. */
export interface Note {
  id: string;
  title: string;
  entries: NoteEntry[];
  /** newest-first or oldest-first. */
  sortNewFirst: boolean;
  createdAt: number;
  updatedAt: number;
  ownerId: string;
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
    cache = Array.isArray(parsed) ? parsed.filter(isNote) : [];
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
    Array.isArray(o.entries) &&
    typeof o.createdAt === 'number'
  );
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

export function createNote(title = 'New note'): Note {
  const now = Date.now();
  const note: Note = {
    id: `n${now}`,
    title,
    entries: [],
    sortNewFirst: true,
    createdAt: now,
    updatedAt: now,
    ownerId: '',
  };
  saveNote(note);
  return note;
}

export function deleteNote(id: string): void {
  save(load().filter((n) => n.id !== id));
}

/** Start a new entry — one per visit. */
export function startEntry(): NoteEntry {
  const now = Date.now();
  return { id: `e${now}`, text: '', createdAt: now, editedAt: now };
}
