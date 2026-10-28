import { useEffect, useRef, useState } from 'react';
import { useNav } from '../nav';
import { deleteNote, getNote, noteText, saveNote, titleOf, type Note } from '../notes';
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

/* The format bar, slim: Aa, Checklist, Bullets, Eumae. Aa slides up the
   format sheet (styles, marks, lists + indent, highlight, the note's font),
   Apple Notes' way. The sheet stays open while you style, so several taps
   land in a row; Aa again or the X closes it. */
type NoteFont = 'default' | 'serif' | 'mono';

const HL = ['hl1', 'hl2', 'hl3', 'hl4'] as const;
/* execCommand can only paint a background colour; these sentinels mark what
   it painted so we swap it for a class that follows the theme. */
const SENT = ['rgb(1, 2, 3)', 'rgb(1, 2, 4)', 'rgb(1, 2, 5)', 'rgb(1, 2, 6)', 'rgb(1, 2, 7)'];

function FormatBar({
  editorRef,
  onInput,
  font,
  setFont,
}: {
  editorRef: React.RefObject<HTMLDivElement | null>;
  onInput: () => void;
  font: NoteFont;
  setFont: (f: NoteFont) => void;
}) {
  const { openPanel } = useNav();
  const [sheet, setSheet] = useState(false);
  const [on, setOn] = useState<Record<string, boolean>>({});

  /* Light up B / I / U / S for wherever the caret sits. */
  useEffect(() => {
    const read = () => {
      const host = editorRef.current;
      const sel = window.getSelection();
      if (!host || !sel?.anchorNode || !host.contains(sel.anchorNode)) return;
      const st: Record<string, boolean> = {};
      for (const c of ['bold', 'italic', 'underline', 'strikeThrough']) {
        try { st[c] = document.queryCommandState(c); } catch { st[c] = false; }
      }
      setOn(st);
    };
    document.addEventListener('selectionchange', read);
    return () => document.removeEventListener('selectionchange', read);
  }, [editorRef]);

  const cmd = (name: string) => {
    editorRef.current?.focus();
    document.execCommand(name);
    try { setOn((o) => ({ ...o, [name]: document.queryCommandState(name) })); } catch { /* */ }
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
  /* i = 0..3 paints a highlight, -1 clears it. */
  const highlight = (i: number) => {
    const host = editorRef.current;
    if (!host) return;
    host.focus();
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const s = i < 0 ? SENT[4] : SENT[i];
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand('hiliteColor', false, s);
    document.execCommand('styleWithCSS', false, 'false');
    host.querySelectorAll<HTMLElement>('[style]').forEach((el) => {
      const bg = el.style.backgroundColor;
      const k = SENT.indexOf(bg);
      if (k < 0) return;
      el.style.backgroundColor = '';
      if (!el.getAttribute('style')) el.removeAttribute('style');
      /* Inner highlights give way to the new one. */
      el.querySelectorAll('mark').forEach((m) => m.replaceWith(...Array.from(m.childNodes)));
      const outer = el.parentElement?.closest('mark');
      if (k === 4) {
        if (outer && host.contains(outer)) outer.replaceWith(...Array.from(outer.childNodes));
        if (el.tagName === 'SPAN' && !el.attributes.length) el.replaceWith(...Array.from(el.childNodes));
        return;
      }
      const m = document.createElement('mark');
      m.className = HL[k];
      m.append(...Array.from(el.childNodes));
      if (el.tagName === 'SPAN' && !el.attributes.length) el.replaceWith(m);
      else el.appendChild(m);
    });
    onInput();
  };

  const btn = (label: React.ReactNode, name: string, act: () => void, lit = false) => (
    <button
      className={lit ? 'on' : undefined}
      onMouseDown={(e) => { e.preventDefault(); act(); }}
      onClick={(e) => e.preventDefault()}
      aria-label={name}
      title={name}
    >
      {label}
    </button>
  );

  const icCheck = <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="4" y="4" width="16" height="16" rx="8" /><path d="M8.5 12.5l2.5 2.5 4.5-5.5" /></svg>;
  const icBul = <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="5" cy="6" r="1.2" fill="currentColor" /><circle cx="5" cy="12" r="1.2" fill="currentColor" /><circle cx="5" cy="18" r="1.2" fill="currentColor" /></svg>;
  const icNum = <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 7h11M9 12h11M9 17h11" /><path d="M4 6.5v-1l1.2 1M4 12h1.5M4 17c.8 0 1.3-.5 1.3-1.2 0-.6-.4-1-1-1.1.5-.1.9-.5.9-1 0-.6-.4-1-1.2-1" /></svg>;
  const icOut = <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 6h9M11 12h9M11 18h9M7 9l-3 3 3 3" /></svg>;
  const icIn = <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 6h9M11 12h9M11 18h9M4 9l3 3-3 3" /></svg>;

  return (
    <div className="nbarWrap">
      {sheet && (
        <div className="nsheet" onMouseDown={(e) => e.preventDefault()}>
          <div className="nsheetHead">
            <span>Format</span>
            <button className="hb" onClick={() => setSheet(false)} aria-label="Close format">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
          <div className="nsRow nsStyles">
            {btn(<span className="nsT">Title</span>, 'Title', () => block('h1'))}
            {btn(<span className="nsH">Heading</span>, 'Heading', () => block('h2'))}
            {btn(<span className="nsS">Subheading</span>, 'Subheading', () => block('h3'))}
            {btn('Body', 'Body', () => block('div'))}
            {btn(<span className="nsM">Mono</span>, 'Monospace', () => block('pre'))}
          </div>
          <div className="nsRow">
            {btn(<b>B</b>, 'Bold', () => cmd('bold'), on.bold)}
            {btn(<i>I</i>, 'Italic', () => cmd('italic'), on.italic)}
            {btn(<u>U</u>, 'Underline', () => cmd('underline'), on.underline)}
            {btn(<s>S</s>, 'Strikethrough', () => cmd('strikeThrough'), on.strikeThrough)}
            <span className="nfmtSep" />
            {btn(icNum, 'Numbers', () => list('ol'))}
            {btn(icOut, 'Indent less', () => cmd('outdent'))}
            {btn(icIn, 'Indent more', () => cmd('indent'))}
          </div>
          <div className="nsRow">
            <span className="nsLab">Highlight</span>
            {HL.map((c, i) => btn(<span className={'nsDot ' + c} />, 'Highlight ' + (i + 1), () => highlight(i)))}
            {btn(<span className="nsDot nsNone" />, 'No highlight', () => highlight(-1))}
          </div>
          <div className="nsRow">
            <span className="nsLab">Note font</span>
            {(['default', 'serif', 'mono'] as NoteFont[]).map((f) =>
              btn(
                <span className={'nsF nf-' + f}>{f === 'default' ? 'Default' : f === 'serif' ? 'Serif' : 'Mono'}</span>,
                'Font ' + f,
                () => setFont(f),
                font === f,
              ),
            )}
          </div>
        </div>
      )}
      <div className="nbar">
        {btn(<span className="nsAa">Aa</span>, 'Format', () => setSheet((v) => !v), sheet)}
        {btn(icCheck, 'Checklist', () => list('check'))}
        {btn(icBul, 'Bullets', () => list('ul'))}
        {btn(
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /></svg>,
          'Ask Eumae',
          () => openPanel('eumae'),
        )}
      </div>
    </div>
  );
}

let discardTimer = 0;
let discardId = '';

/* A session divider: hairline date + time, not editable, never saved into the
   body — rendered from `sessions`, so the ribbon can never duplicate. */
function sessionDivider(ts: number): HTMLElement {
  const d = document.createElement('div');
  d.className = 'nsess';
  d.contentEditable = 'false';
  const label = document.createElement('span');
  label.textContent = fmtDay(ts) + ' \u00b7 ' + fmtTime(ts);
  d.appendChild(label);
  d.dataset.ts = String(ts);
  return d;
}

export default function NoteViewPage({ arg }: PageProps) {
  const { back, notify } = useNav();
  const [, setTick] = useState(0);
  const id = typeof arg === 'string' ? arg : '';
  /* Read on the first render, not in the effect: the editor only mounts once
     a note is in state, so a note set from the effect left the ref empty and
     the open note painted blank. */
  const [note, setNote] = useState<Note | null>(() => getNote(id) ?? null);
  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<number | null>(null);
  const loadedId = useRef('');
  /* The last debounced body, held beside the timer: leaving within the 400ms
     window used to drop the final keystrokes, because unmount cleared the
     timer before it fired and the list then showed the pre-save note. */
  const pendingBody = useRef<string | null>(null);
  const [font, setFontState] = useState<NoteFont>(() => getNote(id)?.font ?? 'default');
  const setFont = (f: NoteFont) => {
    setFontState(f);
    const n = getNote(id);
    /* Font alone is not an edit: keep the note's place and date in the list. */
    if (n) saveNote({ ...n, font: f }, { keepDate: true });
  };

  /* Open once: record the visit, paint the one document. Saves thereafter
     never repaint — the DOM is the source of truth while typing. */
  useEffect(() => {
    /* A StrictMode remount (or a quick re-open) must not lose the note the
       last unmount was about to discard as empty. */
    if (discardTimer && discardId === id) window.clearTimeout(discardTimer);
    const n = getNote(id);
    if (!n) {
      back();
      return;
    }
    /* Opening is not editing: nothing is saved here, so a look never moves
       the note to the top of the list or changes its date. */
    setNote(n);
    const host = editorRef.current;
    if (host && loadedId.current !== n.id) {
      loadedId.current = n.id;
      host.innerHTML = n.body || '';
      ensureTitle(host);
      /* Session ribbon: dividers live INSIDE the body, where the writing
         after them starts. Coming back after an hour drafts one at the end
         with a fresh line under it; it only saves if you type there
         (onInput drops a divider with nothing after it). */
      const hasText = noteText(n).length > 0;
      if (hasText && Date.now() - n.updatedAt > 60 * 60 * 1000) {
        host.appendChild(sessionDivider(Date.now()));
        const line = document.createElement('div');
        line.innerHTML = '<br>';
        host.appendChild(line);
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
      loadedId.current = '';
      /* Tapping + and backing out leaves nothing behind: an empty note is
         dropped on the way out (deferred a tick so a remount can keep it). */
      discardId = id;
      discardTimer = window.setTimeout(() => {
        const left = getNote(id);
        if (left && !noteText(left)) deleteNote(id);
        discardTimer = 0;
      }, 0);
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
    dropEmptyDividers(clone);
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
    const inCheck =
      node instanceof Element ? node.closest('li.ncheck') : node?.parentElement?.closest('li.ncheck');
    if (e.key === 'Enter' && inCheck && !e.shiftKey) {
      /* The browser copies the row's classes onto the new row, so a new
         item under a ticked one arrived already ticked. */
      window.setTimeout(() => {
        const s2 = window.getSelection();
        const a = s2?.anchorNode;
        const li = a instanceof Element ? a.closest('li') : a?.parentElement?.closest('li');
        if (li && li !== inCheck && host.contains(li)) {
          li.classList.add('ncheck');
          li.classList.remove('done');
        }
        onInput();
      }, 0);
      return;
    }
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
    /* Only the circle ticks. Tapping the words places the caret, as it
       should; before, any tap on the row flipped it. */
    if (e.clientX - li.getBoundingClientRect().left > 30) return;
    e.preventDefault();
    li.classList.toggle('done');
    onInput();
  };

  /* Paste as plain text: copied web text carried its own fonts and colors
     (black text vanished on the dark theme). */
  const onPaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    e.preventDefault();
    document.execCommand('insertText', false, text);
    onInput();
  };

  const current = getNote(id);
  const shownTitle = current ? titleOf(current) : 'this note';

  return (
    <div className="page noteClean">
      {/* No page chrome of its own: the shell's header/backbar is the one way
          back. The face is the sheet; the one line above it carries the
          note's project and its ⋯. */}
      <div className="noteTop">
        <ProjectChip k="note" id={id} />
        <span className="g" />
        <ItemMenu
          name={shownTitle}
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
        className={"ndoc" + (font !== "default" ? " nf-" + font : "")}
        contentEditable
        suppressContentEditableWarning
        data-placeholder="New note"
        onInput={onInput}
        onKeyDown={onKeyDown}
        onClick={onChecklistTap}
        onPaste={onPaste}
      />
      <FormatBar editorRef={editorRef} onInput={onInput} font={font} setFont={setFont} />
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
  void text;
  /* The same reader the list uses, so the stored title always matches the
     row (the old split on newlines took the whole document). */
  const title = titleOf({ ...latest, body });
  saveNote({ ...latest, body, title });
}

/* A divider with no writing after it (before the next divider or the end)
   is a visit that wrote nothing there: never saved. */
function dropEmptyDividers(root: HTMLElement): void {
  const kids = Array.from(root.children);
  kids.forEach((el, i) => {
    if (!el.classList.contains('nsess')) return;
    let text = '';
    for (let j = i + 1; j < kids.length && !kids[j].classList.contains('nsess'); j++) {
      text += kids[j].textContent ?? '';
    }
    if (!text.replace(/\u00a0/g, ' ').trim()) el.remove();
  });
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
