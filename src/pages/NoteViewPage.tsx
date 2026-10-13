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
      /* Body first (title line included), session ribbon after the text.
         Dedupe: a migrated body may already carry `.nsess` dividers from the
         pre-migration entries — those are history, kept once, never doubled. */
      const seen = new Set<number>();
      host.innerHTML = withSession.body || '';
      host.querySelectorAll('.nsess').forEach((d) => {
        const ts = Number((d as HTMLElement).dataset.ts);
        if (ts) seen.add(ts);
      });
      ensureTitle(host);
      for (const ts of [...withSession.sessions].sort((a, b) => a - b)) {
        if (seen.has(ts)) continue;
        const d = sessionDivider(ts);
        d.dataset.ts = String(ts);
        host.appendChild(d);
      }
      syncEmpty(host);
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
    ensureTitle(host);
    syncEmpty(host);
    /* Read back minus the chrome: dividers carry `.nsess`, never saved. The
       title helper class is chrome too — strip it before save so a reload
       never persists a duplicate. */
    const clone = host.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.nsess').forEach((d) => d.remove());
    clone.querySelectorAll('.ntitle').forEach((t) => t.classList.remove('ntitle'));
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

  /* Enter inside the title ends the title: split a body line after it rather
     than growing an h1. Backspace at the body's start merges back up. */
  const onKeyDown = (e: React.KeyboardEvent) => {
    const host = editorRef.current;
    if (!host) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const node = sel.anchorNode;
    const titleEl =
      node instanceof Element
        ? node.closest('.ntitle')
        : node?.parentElement?.closest('.ntitle');
    if (e.key === 'Enter' && titleEl && !e.shiftKey) {
      e.preventDefault();
      const line = document.createElement('div');
      line.innerHTML = '<br>';
      titleEl.after(line);
      const range = document.createRange();
      range.selectNodeContents(line);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      onInput();
    } else if (e.key === 'Backspace' && sel.isCollapsed) {
      const range = sel.getRangeAt(0);
      if (range.startOffset === 0) {
        let el: Node | null = node instanceof Element ? node : node?.parentNode ?? null;
        while (el && el !== host && el.parentNode !== host) el = el.parentNode;
        if (el && el !== host && el.previousSibling instanceof Element && el.previousSibling.classList.contains('ntitle')) {
          e.preventDefault();
          const prev = el.previousSibling as HTMLElement;
          prev.appendChild(document.createElement('br'));
          const r2 = document.createRange();
          r2.selectNodeContents(prev);
          r2.collapse(false);
          sel.removeAllRanges();
          sel.addRange(r2);
          onInput();
        }
      }
    }
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
        onKeyDown={onKeyDown}
        onClick={onChecklistTap}
      />
      <FormatMenu editorRef={editorRef} />
    </div>
  );
}

/* The title contract, in one place. The first content block (skipping session
   dividers) carries `.ntitle`; every other block does not. Runs after every
   input and on open, so typing, Enter-splits, deletes and pastes can never
   leave the big type on the wrong line. A bare-text first line (fresh note,
   or text before any Enter) gets wrapped in a div so the class has a home —
   the caret is recorded and restored around the swap, so typing never jumps.
   Enter later splits that div, never the class off it. */
function ensureTitle(host: HTMLElement): void {
  // Wrap a leading bare-text title so the class has an element to live on.
  const first = host.firstChild;
  if (first && !(first instanceof HTMLElement) && (first.textContent ?? '').trim()) {
    const sel = window.getSelection();
    const offset = sel && sel.rangeCount > 0 && sel.anchorNode === first ? sel.anchorOffset : -1;
    const div = document.createElement('div');
    div.className = 'ntitle';
    div.textContent = first.textContent ?? '';
    host.replaceChild(div, first);
    if (offset >= 0 && div.firstChild) {
      try {
        const range = document.createRange();
        range.setStart(div.firstChild, Math.min(offset, (div.textContent ?? '').length));
        range.collapse(true);
        sel?.removeAllRanges();
        sel?.addRange(range);
      } catch {
        /* Non-fatal — caret stays where the browser left it. */
      }
    }
  }
  let titled = false;
  for (const b of Array.from(host.childNodes)) {
    if (!(b instanceof HTMLElement) || b.classList.contains('nsess')) continue;
    if (!titled) {
      b.classList.add('ntitle');
      titled = true;
    } else {
      b.classList.remove('ntitle');
    }
  }
}

/* Empty-sheet flag for the placeholder: no text content means the hint. */
function syncEmpty(host: HTMLElement): void {
  const text = (host.textContent ?? '').trim();
  host.classList.toggle('tEmpty', text.length === 0);
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
