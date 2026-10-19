import { useEffect, useRef, useState } from 'react';
import { useNav } from '../nav';
import { createNote, deleteNote, getNotes, noteText, previewOf, titleOf, snapshotNotes, restoreNotes, type Note } from '../notes';
import { ItemMenu, ProjectChip } from '../components/ItemMenu';
import { undoable } from '../undo';
import type { NotifyOpts } from '../nav';

/* Share sheet where there is one, clipboard otherwise. Used by the list row
   and by the open note's ⋯, so both export the same text. */
export async function exportNote(note: Note, notify: (m: string, o?: NotifyOpts) => void): Promise<void> {
  const text = titleOf(note) + '\n\n' + noteText(note);
  try {
    if (navigator.share) {
      await navigator.share({ title: titleOf(note), text });
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      notify('Note copied.');
    }
  } catch {
    /* Dismissed — silent. */
  }
}

/* Delete a note without asking; Undo puts it back. */
export function removeNote(id: string, notify: (m: string, o?: NotifyOpts) => void, after?: () => void): void {
  undoable(notify, 'Note deleted.', snapshotNotes, restoreNotes, () => deleteNote(id), after);
}
import type { PageProps } from './index';

function fmtShort(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/* One row: swipe left for Export + Delete on touch, icon buttons on desktop.
   Export lives here so the note face stays a bare sheet. */
function NoteRow({
  note,
  onOpen,
  onDelete,
  onExport,
  onChange,
}: {
  note: Note;
  onOpen: () => void;
  onDelete: () => void;
  onExport: () => void;
  onChange: () => void;
}) {
  const startX = useRef(0);
  const liveDx = useRef(0);
  const [shownDx, setShownDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [open, setOpen] = useState(false);

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    liveDx.current = 0;
    setDragging(true);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const delta = e.touches[0].clientX - startX.current;
    liveDx.current = delta < 0 ? Math.max(delta, -140) : 0;
    setShownDx(liveDx.current);
  };
  const onTouchEnd = () => {
    setDragging(false);
    if (liveDx.current < -70) setOpen(true);
    else setOpen(false);
    liveDx.current = 0;
    setShownDx(0);
  };

  /* Title reads off the first block (titleOf) - the row and the save share
     the one function, so the two can never disagree again. */
  const title = titleOf(note);
  const preview = previewOf(note) || fmtShort(note.updatedAt);

  /* One row, two doors. Mobile swipes the face left to reveal the colored
     pair behind it; desktop hovers to reveal a ghost pair pinned inside the
     row's right edge — same callbacks, no colored boxes, nothing outside
     the row. The swipe strip stays mounted (touch only reads it) but
     desktop CSS hides it, so the blue/red pair can never bleed through. */
  return (
    <div
      className="swipeRow"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className="swipeActions" aria-hidden="true">
        <button className="swExp" onClick={onExport} aria-label={`Export ${title}`} tabIndex={-1}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 14V3m0 0L8.5 6.5M12 3l3.5 3.5M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" />
          </svg>
        </button>
        <button className="swDel" onClick={onDelete} aria-label={`Delete ${title}`} tabIndex={-1}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6" />
          </svg>
        </button>
      </div>
      <div
        className="noteRow"
        role="button"
        tabIndex={0}
        style={{
          transform: open ? 'translateX(-140px)' : shownDx ? `translateX(${shownDx}px)` : undefined,
          transition: dragging ? 'none' : undefined,
        }}
        onClick={() => {
          if (open) setOpen(false);
          else onOpen();
        }}
        onKeyDown={(e) => {
          if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onOpen();
          }
        }}
      >
        <span className="g">
          <span className="noteTitle">{title || 'Untitled'}</span>
          <span className="notePreview">{preview}</span>
          <ProjectChip k="note" id={note.id} />
        </span>
        <span className="drDate">{fmtShort(note.updatedAt)}</span>
        <ItemMenu
          name={title || 'Untitled'}
          open={onOpen}
          extra={[{ label: 'Export', onClick: onExport }]}
          link={{ k: 'note', id: note.id }}
          onChange={onChange}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}

export default function NotesPage(_: PageProps) {
  const { go, notify } = useNav();
  /* Read in render, not copied into state: an Undo fired after leaving an
     open note restores the store, and the list has to show it. */
  const [, setTick] = useState(0);
  const notes = getNotes();
  const setNotes = (_n?: Note[]) => setTick((t) => t + 1);

  useEffect(() => {
    setNotes(getNotes());
    /* Backstop: the editor saves on keystroke + flushes on unmount, but a
       focus return re-reads anyway — the list can never show a stale note. */
    const onFocus = () => setNotes(getNotes());
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const newNote = () => {
    const note = createNote();
    go('note', note.id);
  };

  return (
    <div className="page">
      <div className="pageHead">
        <h2 className="dupT">Notes</h2>
        <button className="hb" onClick={newNote} aria-label="New note">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>
      {notes.map((n) => (
          <NoteRow
            key={n.id}
            note={n}
            onOpen={() => go('note', n.id)}
            onDelete={() => removeNote(n.id, notify, () => setNotes(getNotes()))}
            onExport={() => exportNote(n, notify)}
            onChange={() => setNotes(getNotes())}
          />
        ))}
    </div>
  );
}
