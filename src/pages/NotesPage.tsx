import { useEffect, useRef, useState } from 'react';
import { useNav } from '../nav';
import { createNote, deleteNote, getNotes, type Note } from '../notes';
import type { PageProps } from './index';

/** One row in the notes list — swipe left on touch, icon buttons on desktop. */
function NoteRow({
  note,
  onOpen,
  onDelete,
}: {
  note: Note;
  onOpen: () => void;
  onDelete: () => void;
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
    liveDx.current = delta < 0 ? Math.max(delta, -70) : 0;
    setShownDx(liveDx.current);
  };
  const onTouchEnd = () => {
    setDragging(false);
    if (liveDx.current < -35) setOpen(true);
    else setOpen(false);
    liveDx.current = 0;
    setShownDx(0);
  };

  const preview = note.entries.length
    ? note.entries[note.entries.length - 1].text.replace(/<[^>]+>/g, '').slice(0, 60)
    : 'No entries yet';

  return (
    <div className="swipeRow" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div className="swipeActions">
        <button className="swDel" onClick={onDelete} aria-label={`Delete ${note.title}`}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6" />
          </svg>
        </button>
      </div>
      <button
        className="noteRow"
        style={{
          transform: open ? 'translateX(-70px)' : shownDx ? `translateX(${shownDx}px)` : undefined,
          transition: dragging ? 'none' : undefined,
        }}
        onClick={() => {
          if (open) setOpen(false);
          else onOpen();
        }}
      >
        <span className="g">
          <span className="noteTitle">{note.title || 'Untitled'}</span>
          <span className="notePreview">{preview}</span>
        </span>
        <span className="drDate">
          {new Date(note.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </span>
      </button>
      <div className="drDesktop">
        <button className="drIconBtn danger" onClick={onDelete} aria-label={`Delete ${note.title}`}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function NotesPage(_: PageProps) {
  const { go } = useNav();
  const [notes, setNotes] = useState<Note[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null);

  useEffect(() => {
    setNotes(getNotes());
  }, []);

  const newNote = () => {
    const note = createNote();
    go('note', note.id);
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
      {notes.length === 0 ? (
        <div className="emptyNotes">
          <p>No notes yet.</p>
          <button className="pri" onClick={newNote}>New note</button>
        </div>
      ) : (
        notes.map((n) => (
          <NoteRow
            key={n.id}
            note={n}
            onOpen={() => go('note', n.id)}
            onDelete={() => setDeleteTarget(n)}
          />
        ))
      )}
      {deleteTarget ? (
        <>
          <div className="dlgScrim" onClick={() => setDeleteTarget(null)} />
          <div className="dlg" role="alertdialog" aria-label="Delete note">
            <div className="dlgTitle">Delete this note?</div>
            <div className="dlgBody">"{deleteTarget.title || 'Untitled'}" will be gone for good.</div>
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
