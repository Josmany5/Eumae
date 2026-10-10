import { useEffect, useRef, useState } from 'react';
import { useNav } from '../nav';
import { getNote, saveNote, startEntry, type Note, type NoteEntry } from '../notes';
import type { PageProps } from './index';

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Minimal rich text toolbar — bold, italic, bullet list. */
function Toolbar({ onCmd }: { onCmd: (cmd: string) => void }) {
  return (
    <div className="rtBar">
      <button onMouseDown={(e) => { e.preventDefault(); onCmd('bold'); }} aria-label="Bold"><b>B</b></button>
      <button onMouseDown={(e) => { e.preventDefault(); onCmd('italic'); }} aria-label="Italic"><i>I</i></button>
      <button onMouseDown={(e) => { e.preventDefault(); onCmd('insertUnorderedList'); }} aria-label="Bullet list">• List</button>
    </div>
  );
}

export default function NoteViewPage({ arg }: PageProps) {
  const { back, notify } = useNav();
  const id = typeof arg === 'string' ? arg : '';
  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);
  const draftId = useRef('');

  /* Open the note and start a new entry — one entry per visit. */
  useEffect(() => {
    const n = getNote(id);
    if (!n) {
      back();
      return;
    }
    const entry = startEntry();
    draftId.current = entry.id;
    const withEntry: Note = { ...n, entries: [...n.entries, entry] };
    setNote(withEntry);
    setTitle(n.title);
    return () => {
      /* Save on leave — the entry keeps whatever was typed. */
      const text = editorRef.current?.innerHTML ?? '';
      const latest = getNote(id);
      if (!latest) return;
      const entries = latest.entries.map((e) =>
        e.id === draftId.current ? { ...e, text, editedAt: text !== e.text ? Date.now() : e.editedAt } : e,
      );
      /* Drop the entry if nothing was written. */
      const cleaned = entries.filter((e) => e.id !== draftId.current || e.text.replace(/<[^>]+>/g, '').trim());
      saveNote({ ...latest, entries: cleaned, title: latest.title });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!note) return null;

  const persist = (entries: NoteEntry[], newTitle = title) => {
    const updated: Note = { ...note, title: newTitle, entries };
    setNote(updated);
    saveNote(updated);
  };

  const updateEntry = (entryId: string, text: string) => {
    const entries = note.entries.map((e) =>
      e.id === entryId ? { ...e, text, editedAt: Date.now() } : e,
    );
    /* Edited entries bump to most-recent position but keep original date. */
    entries.sort((a, b) => b.editedAt - a.editedAt);
    persist(entries);
  };

  const toggleSort = () => {
    const updated = { ...note, sortNewFirst: !note.sortNewFirst };
    setNote(updated);
    saveNote(updated);
  };

  const share = async () => {
    const text = `${note.title}\n\n` + note.entries
      .map((e) => `${fmtDate(e.createdAt)} ${fmtTime(e.createdAt)}\n${e.text.replace(/<[^>]+>/g, '')}`)
      .join('\n\n');
    try {
      await navigator.share({ title: note.title, text });
    } catch {
      /* Dismissed or unavailable — copy instead. */
      try {
        await navigator.clipboard.writeText(text);
        notify('Copied to clipboard');
      } catch {
        notify('Could not share');
      }
    }
  };

  const sorted = [...note.entries].sort((a, b) =>
    note.sortNewFirst ? b.createdAt - a.createdAt : a.createdAt - b.createdAt,
  );
  /* The live draft is the newest entry; show the rest. */
  const shown = sorted.filter((e) => e.id !== draftId.current || e.text);

  const exec = (cmd: string) => {
    document.execCommand(cmd, false);
    editorRef.current?.focus();
  };

  return (
    <div className="page noteView">
      <div className="pageHead">
        <button className="hb" onClick={back} aria-label="Back to notes">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="pageHeadTitle">Note</span>
        <button className="hb" onClick={toggleSort} aria-label={note.sortNewFirst ? 'Oldest first' : 'Newest first'}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3" />
          </svg>
        </button>
        <button className="hb" onClick={share} aria-label="Share note">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
          </svg>
        </button>
      </div>

      <input
        className="noteTitleField"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => persist(note.entries, title.trim() || 'Untitled')}
        placeholder="Title"
        aria-label="Note title"
      />

      {shown.map((e) =>
        e.id === draftId.current ? null : (
          <EntryView key={e.id} entry={e} onSave={(text) => updateEntry(e.id, text)} />
        ),
      )}

      <div className="noteEntry">
        <div className="noteEntryHead">
          {fmtDate(Date.now())} · {fmtTime(Date.now())}
        </div>
        <Toolbar onCmd={exec} />
        <div
          ref={editorRef}
          className="noteEditor"
          contentEditable
          suppressContentEditableWarning
          data-placeholder="Write…"
          onInput={() => undefined}
        />
      </div>
    </div>
  );
}

/** A saved entry — tap to edit. */
function EntryView({ entry, onSave }: { entry: NoteEntry; onSave: (text: string) => void }) {
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  if (!editing) {
    return (
      <div className="noteEntry" onClick={() => setEditing(true)}>
        <div className="noteEntryHead">
          {fmtDate(entry.createdAt)} · {fmtTime(entry.createdAt)}
          {entry.editedAt > entry.createdAt + 1000 ? (
            <span className="editedOn"> · edited {fmtDate(entry.editedAt)}</span>
          ) : null}
        </div>
        <div className="noteEntryText" dangerouslySetInnerHTML={{ __html: entry.text }} />
      </div>
    );
  }

  return (
    <div className="noteEntry">
      <div className="noteEntryHead">
        {fmtDate(entry.createdAt)} · {fmtTime(entry.createdAt)}
        <span className="editedOn"> · editing</span>
      </div>
      <div
        ref={ref}
        className="noteEditor"
        contentEditable
        suppressContentEditableWarning
        dangerouslySetInnerHTML={{ __html: entry.text }}
      />
      <div className="btns">
        <button className="pri" onClick={() => { onSave(ref.current?.innerHTML ?? ''); setEditing(false); }}>
          Done
        </button>
        <button className="gho" onClick={() => setEditing(false)}>Cancel</button>
      </div>
    </div>
  );
}
