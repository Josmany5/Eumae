import { useEffect, useRef, useState } from 'react';
import { useNav } from '../nav';
import { getNote, saveNote, startSession, type Note } from '../notes';
import { ItemMenu, ProjectChip } from '../components/ItemMenu';
import { exportNote, removeNote } from './NotesPage';
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

/* The format bar: docked above the keyboard, Apple Notes' Aa row. The
   floating pill fought the OS selection callout (copy/paste vs format,
   stacked on iOS) and covered the words being styled. A docked row ends both:
   selection stays the OS's, formatting stays ours, and the words stay visible
   above it. Always mounted while the note is open - one thumb row, room for
   fonts + sizes later. */
function FormatBar({ editorRef, onInput }: { editorRef: React.RefObject<HTMLDivElement | null>; onInput: () => void }) {
  const cmd = (name: string) => {
    editorRef.current?.focus();
    document.execCommand(name);
    onInput();
  };
  const block = (tag: string) => {
    editorRef.current?.focus();
    document.execCommand('formatBlock', false, tag);
    if (editorRef.current) ensureTitle(editorRef.current);
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
    <button onMouseDown={(e) => { e.preventDefault(); act(); }} onClick={(e) => e.preventDefault()} aria-label={name} title={name}>{label}</button>
  );

  return (
    <div className="nbar">
      {btn('Title', 'Title', () => block('h1'))}
      {btn('Body', 'Body', () => block('p'))}
      <span className="nfmtSep" />
      {btn(<b>B</b>, 'Bold', () => cmd('bold'))}
      {btn(<i>I</i>, 'Italic', () => cmd('italic'))}
      {btn(<u>U</u>, 'Underline', () => cmd('underline'))}
      <span className="nfmtSep" />
      {btn(<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="4" y="4" width="16" height="16" rx="8" /><path d="M8.5 12.5l2.5 2.5 4.5-5.5" /></svg>, 'Checklist', () => list('check'))}
      {btn(<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="5" cy="6" r="1.2" fill="currentColor" /><circle cx="5" cy="12" r="1.2" fill="currentColor" /><circle cx="5" cy="18" r="1.2" fill="currentColor" /></svg>, 'Bullets', () => list('ul'))}
      {btn(<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 7h11M9 12h11M9 17h11" /><path d="M4 6.5v-1l1.2 1M4 12h1.5M4 17c.8 0 1.3-.5 1.3-1.2 0-.6-.4-1-1-1.1.5-.1.9-.5.9-1 0-.6-.4-1-1.2-1" /></svg>, 'Numbers', () => list('ol'))}
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
  const { back, notify } = useNav();
  const [, setTick] = useState(0);
  const id = typeof arg === 'string' ? arg : '';
  const [note, setNote] = useState<Note | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<number | null>(null);
  const loadedId = useRef('');
  /* The last debounced body, held beside the timer: leaving within the 400ms
     window used to drop the final keystrokes, because unmount cleared the
     timer before it fired and the list then showed the pre-save note. */
  const pendingBody = useRef<string | null>(null);

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
      /* Flush the last keystrokes on the way out: the debounce in onInput
         may not have fired yet, and without this the list shows the note as
         it was 400ms ago. Writes through the same helper the timer uses. */
      if (pendingBody.current !== null) {
        writeBody(id, pendingBody.current);
        pendingBody.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!note) return null;

  /* Land the last keystrokes before acting on the whole note, so Export
     carries them and Undo after a delete brings back what was on screen. */
  const flush = () => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    if (pendingBody.current !== null) {
      writeBody(id, pendingBody.current);
      pendingBody.current = null;
    }
  };

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
    pendingBody.current = body;
    const text = (clone.textContent ?? '').replace(/\u00a0/g, ' ').trim();
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      pendingBody.current = null;
      writeBody(id, body, text);
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
          back. The face is the sheet; the one line above it carries the
          note's project and its ⋯. */}
      <div className="noteTop">
        <ProjectChip k="note" id={id} />
        <span className="g" />
        <ItemMenu
          name={note.title || 'this note'}
          extra={[
            {
              label: 'Export',
              onClick: () => {
                flush();
                const n = getNote(id);
                if (n) void exportNote(n, notify);
              },
            },
          ]}
          link={{ k: 'note', id }}
          onChange={() => setTick((t) => t + 1)}
          onDelete={() => {
            flush();
            removeNote(id, notify);
            back();
          }}
        />
      </div>
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
      <FormatBar editorRef={editorRef} onInput={onInput} />
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

/* One writer for note bodies: the debounce timer and the unmount flush share
   it, so the last keystrokes can never be newer than the last save. Title =
   first content block's text, not textContent split on newline: divs carry no
   newlines, so that split was the whole document. */
function writeBody(id: string, body: string, text?: string): void {
  const latest = getNote(id);
  if (!latest) return;
  const plain = text ?? body.replace(/<[^>]+>/g, ' ').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
  const firstBlock = body
    .replace(/<div class="nsess"[^>]*><\/div>/g, '\n')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\xa0/g, ' ')
    .split('\n')[0]
    ?.trim() ?? '';
  const title = (firstBlock || plain).slice(0, 80) || 'Untitled';
  saveNote({ ...latest, body, title });
}

function syncEmpty(host: HTMLElement): void {
  /* Empty-sheet flag for the placeholder: no text content means the hint. */
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
