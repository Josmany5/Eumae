import { useEffect, useRef, useState } from 'react';
import { useNav } from '../nav';
import { getNote, saveNote, startSession, type Note } from '../notes';
import type { PageProps } from './index';

function fmtDay(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/* The only formatting surface: appears on text selection, nowhere else. Title
   and Body restyle the current block; the rest wrap the selection. Checklist
   inserts a toggleable row. Nothing on the face until you select. */
function FormatMenu({ editorRef }: { editorRef: React.RefObject<HTMLDivElement | null> }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const onSel = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setPos(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const host = editorRef.current;
      if (!host || !host.contains(range.commonAncestorContainer)) {
        setPos(null);
        return;
      }
      const rect = range.getBoundingClientRect();
      setPos({ x: Math.min(Math.max(rect.left + rect.width / 2, 90), window.innerWidth - 90), y: rect.top });
    };
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
  }, [editorRef]);

  if (!pos) return null;

  const cmd = (name: string) => {
    editorRef.current?.focus();
    document.execCommand(name);
  };
  const block = (tag: string) => {
    editorRef.current?.focus();
    document.execCommand('formatBlock', false, tag);
  };
  const checklist = () => {
    const host = editorRef.current;
    if (!host) return;
    host.focus();
    document.execCommand('insertUnorderedList');
    const sel = window.getSelection();
    let node: Node | null = sel?.anchorNode ?? null;
    while (node && node !== host) {
      if (node instanceof HTMLLIElement) {
        node.classList.add('ncheck');
        break;
      }
      node = node.parentNode;
    }
  };

  return (
    <div className="nfmt" style={{ left: pos.x, top: Math.max(pos.y - 52, 8) }}>
      <button onMouseDown={(e) => { e.preventDefault(); block('h1'); }} aria-label="Title">Title</button>
      <button onMouseDown={(e) => { e.preventDefault(); block('p'); }} aria-label="Body">Body</button>
      <span className="nfmtSep" />
      <button onMouseDown={(e) => { e.preventDefault(); cmd('bold'); }} aria-label="Bold"><b>B</b></button>
      <button onMouseDown={(e) => { e.preventDefault(); cmd('italic'); }} aria-label="Italic"><i>I</i></button>
      <span className="nfmtSep" />
      <button onMouseDown={(e) => { e.preventDefault(); checklist(); }} aria-label="Checklist">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="4" y="4" width="16" height="16" rx="8" /><path d="M8.5 12.5l2.5 2.5 4.5-5.5" /></svg>
      </button>
      <button onMouseDown={(e) => { e.preventDefault(); cmd('insertUnorderedList'); }} aria-label="Bullets">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="5" cy="6" r="1.2" fill="currentColor" /><circle cx="5" cy="12" r="1.2" fill="currentColor" /><circle cx="5" cy="18" r="1.2" fill="currentColor" /></svg>
      </button>
    </div>
  );
}

/* A session divider: hairline date + time, not editable, never saved into the
   body — rendered from `sessions`, so the ribbon can never duplicate. */
function sessionDivider(ts: number): HTMLElement {
  const d = document.createElement('div');
  d.className = 'nsess';
  d.contentEditable = 'false';
  const label = document.createElement('span');
  label.textContent = fmtDay(ts) + ' \u00b7 ' + fmtTime(ts);
  d.appendChild(label);
  return d;
}

export default function NoteViewPage({ arg }: PageProps) {
  const { back } = useNav();
  const id = typeof arg === 'string' ? arg : '';
  const [note, setNote] = useState<Note | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<number | null>(null);
  const loadedId = useRef('');

  /* Open once: record the visit, paint the one document. Saves thereafter
     never repaint — the DOM is the source of truth while typing. */
  useEffect(() => {
    const n = getNote(id);
    if (!n) {
      back();
      return;
    }
    const withSession = startSession(n);
    setNote(withSession);
    const host = editorRef.current;
    if (host && loadedId.current !== withSession.id) {
      loadedId.current = withSession.id;
      host.innerHTML = withSession.body || '';
      for (const ts of [...withSession.sessions].sort((a, b) => a - b)) {
        host.appendChild(sessionDivider(ts));
      }
      placeCaretAtEnd(host);
    }
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!note) return null;

  const onInput = () => {
    const host = editorRef.current;
    if (!host) return;
    /* Read back minus the chrome: dividers carry `.nsess`, never saved. */
    const clone = host.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.nsess').forEach((d) => d.remove());
    const body = clone.innerHTML;
    const text = (clone.textContent ?? '').trim();
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      const latest = getNote(id);
      if (!latest) return;
      const title = text.split('\n')[0].trim().slice(0, 80) || 'Untitled';
      saveNote({ ...latest, body, title });
    }, 400);
  };

  const onChecklistTap = (e: React.MouseEvent) => {
    const li = (e.target as HTMLElement).closest('li.ncheck');
    if (!li) return;
    e.preventDefault();
    li.classList.toggle('done');
    onInput();
  };

  return (
    <div className="page noteClean">
      {/* No page chrome of its own: the shell's header/backbar is the one way
          back. The face is the sheet. */}
      <div
        ref={editorRef}
        className="ndoc"
        contentEditable
        suppressContentEditableWarning
        data-placeholder="New note"
        onInput={onInput}
        onClick={onChecklistTap}
      />
      <FormatMenu editorRef={editorRef} />
    </div>
  );
}

function placeCaretAtEnd(host: HTMLElement): void {
  try {
    host.focus();
    const range = document.createRange();
    range.selectNodeContents(host);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  } catch {
    /* Non-fatal. */
  }
}
