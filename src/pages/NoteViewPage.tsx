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

/* The only formatting surface: appears on text selection, nowhere else.
   Title/Body restyle the current block; B/I/U wrap the selection; the three
   list buttons toggle real lists (bullets, numbers, checklist). Checklist and
   numbered rows come from the same list machinery, so the browser numbers
   follow-ups itself and Backspace on an empty row deletes it (see onKeyDown).
   Nothing on the face until you select. */
function FormatMenu({ editorRef, onInput }: { editorRef: React.RefObject<HTMLDivElement | null>; onInput: () => void }) {
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
      /* Clamp inside the viewport with margin: near an edge the menu used to
         hang past the page and clip. ~140px is half the pill's width. */
      const M = 148;
      const x = Math.min(Math.max(rect.left + rect.width / 2, M), window.innerWidth - M);
      setPos({ x, y: rect.top });
    };
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
  }, [editorRef]);

  if (!pos) return null;

  const cmd = (name: string) => {
    editorRef.current?.focus();
    document.execCommand(name);
    onInput();
  };
  const block = (tag: string) => {
    editorRef.current?.focus();
    document.execCommand('formatBlock', false, tag);
    ensureTitle(editorRef.current!);
    onInput();
  };
  /* Toggle a list around the current line: same button builds and unwraps,
     so reformatting never strands you. Checklist rows get the toggleable
     class; numbered rows let the browser do the counting. */
  const list = (kind: 'ul' | 'ol' | 'check') => {
    const host = editorRef.current;
    if (!host) return;
    host.focus();
    const tag = kind === 'ol' ? 'insertOrderedList' : 'insertUnorderedList';
    document.execCommand(tag);
    if (kind === 'check') {
      const sel = window.getSelection();
      let node: Node | null = sel?.anchorNode ?? null;
      while (node && node !== host) {
        if (node instanceof HTMLLIElement) {
          node.classList.add('ncheck');
          break;
        }
        node = node.parentNode;
      }
    }
    onInput();
  };

  const btn = (label: React.ReactNode, name: string, act: () => void) => (
    <button onMouseDown={(e) => { e.preventDefault(); act(); }} aria-label={name} title={name}>{label}</button>
  );

  return (
    <div className="nfmt" style={{ left: pos.x, top: Math.max(pos.y - 52, 8) }}>
      {btn('Title', 'Title', () => block('h1'))}
      {btn('Body', 'Body', () => block('p'))}
      <span className="nfmtSep" />
      {btn(<b>B</b>, 'Bold', () => cmd('bold'))}
      {btn(<i>I</i>, 'Italic', () => cmd('italic'))}
      {btn(<u>U</u>, 'Underline', () => cmd('underline'))}
      <span className="nfmtSep" />
      {btn(<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="4" y="4" width="16" height="16" rx="8" /><path d="M8.5 12.5l2.5 2.5 4.5-5.5" /></svg>, 'Checklist', () => list('check'))}
      {btn(<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="5" cy="6" r="1.2" fill="currentColor" /><circle cx="5" cy="12" r="1.2" fill="currentColor" /><circle cx="5" cy="18" r="1.2" fill="currentColor" /></svg>, 'Bullets', () => list('ul'))}
      {btn(<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 7h11M9 12h11M9 17h11" /><text x="2.5" y="8.5" fontSize="7" fill="currentColor" stroke="none">1</text><text x="2.5" y="13.5" fontSize="7" fill="currentColor" stroke="none">2</text><text x="2.5" y="18.5" fontSize="7" fill="currentColor" stroke="none">3</text></svg>, 'Numbers', () => list('ol'))}
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
    const text = (clone.textContent ?? '').replace(/\u00a0/g, ' ').trim();
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      const latest = getNote(id);
      if (!latest) return;
      /* Title = first content block's text, not textContent split on newline:
         divs carry no newlines, so that split was the whole document. */
      const firstBlock = clone.firstElementChild?.textContent?.replace(/\u00a0/g, ' ').trim() ?? '';
      const title = (firstBlock || text).slice(0, 80) || 'Untitled';
      saveNote({ ...latest, body, title });
    }, 400);
  };

  /* Enter inside the title ends the title: split a body line after it rather
     than growing an h1. Backspace at the body's start merges back up.
     Backspace on an empty bullet/task/number row deletes the row and lands a
     plain line: the browser keeps the empty li otherwise, which is why lists
     felt impossible to get out of. */
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
      /* Empty list row: unwrap it to a plain line instead of keeping a dead li. */
      let li: HTMLLIElement | null = null;
      let n: Node | null = node instanceof Element ? node : node?.parentNode ?? null;
      while (n && n !== host) {
        if (n instanceof HTMLLIElement) {
          li = n;
          break;
        }
        n = n.parentNode;
      }
      if (li && (li.textContent ?? '').trim() === '') {
        e.preventDefault();
        const list = li.parentElement;
        const line = document.createElement('div');
        line.innerHTML = '<br>';
        if (list && (list.tagName === 'UL' || list.tagName === 'OL')) {
          list.after(line);
          li.remove();
          if (!list.querySelector('li')) list.remove();
        } else {
          li.replaceWith(line);
        }
        const range = document.createRange();
        range.selectNodeContents(line);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        onInput();
        return;
      }
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
      <FormatMenu editorRef={editorRef} onInput={onInput} />
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
