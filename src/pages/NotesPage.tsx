import { useEffect, useRef, useState } from 'react';
import { useNav } from '../nav';
import { createNote, deleteNote, getNotes, noteText, previewOf, titleOf, type Note } from '../notes';
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
}: {
  note: Note;
  onOpen: () => void;
  onDelete: () => void;
  onExport: () => void;
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

  return (
    <div className="swipeRow" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div className="swipeActions">
        <button className="swExp" onClick={onExport} aria-label={`Export ${title}`}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 14V3m0 0L8.5 6.5M12 3l3.5 3.5M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" />
          </svg>
        </button>
        <button className="swDel" onClick={onDelete} aria-label={`Delete ${title}`}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6" />
          </svg>
        </button>
      </div>
      <button
        className="noteRow"
        style={{
          transform: open ? 'translateX(-140px)' : shownDx ? `translateX(${shownDx}px)` : undefined,
          transition: dragging ? 'none' : undefined,
        }}
        onClick={() => {
          if (open) setOpen(false);
          else onOpen();
        }}
      >
        <span className="g">
          <span className="noteTitle">{title || 'Untitled'}</span>
          <span className="notePreview">{preview}</span>
        </span>
        <span className="drDate">{fmtShort(note.updatedAt)}</span>
      </button>
      <div className="drDesktop">
        <button className="drIconBtn" onClick={onExport} aria-label={`Export ${title}`}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 14V3m0 0L8.5 6.5M12 3l3.5 3.5M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" />
          </svg>
        </button>
        <button className="drIconBtn danger" onClick={onDelete} aria-label={`Delete ${title}`}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function NotesPage(_: PageProps) {
  const { go, notify } = useNav();
  const [notes, setNotes] = useState<Note[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null);

  useEffect(() => {
    setNotes(getNotes());
  }, []);

  const newNote = () => {
    const note = createNote();
    go('note', note.id);
  };

  const exportNote = async (note: Note) => {
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
  };

  return (
    <div className="page">
      <div className="pageHead">
        <h2>Notes</h2>
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
            onDelete={() => setDeleteTarget(n)}
            onExport={() => exportNote(n)}
          />
        ))}
      {deleteTarget ? (
        <>
          <div className="dlgScrim" onClick={() => setDeleteTarget(null)} />
          <div className="dlg" role="alertdialog" aria-label="Delete note">
            <div className="dlgTitle">Delete this note?</div>
            <div className="dlgBody">\u201c{titleOf(deleteTarget) || 'Untitled'}\u201d will be gone for good.</div>
            <div className="dlgBtns">
              <button className="dlgCancel" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button
                className="dlgDanger"
                onClick={() => {
                  deleteNote(deleteTarget.id);
                  setDeleteTarget(null);
                  setNotes(getNotes());
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
