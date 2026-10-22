import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { NotifyOpts } from '../../nav';
import { PageNav, usePageKeys } from './PageNav';
import { ItemMenu } from '../ItemMenu';

/* Shared paged dashboard for Console and Guild, laid out like phone home screens.
 *
 * - Page tabs on top, plus large ‹ › arrows at the middle of each side
 *   (desktop). On phones you swipe, and the arrows only appear while a widget
 *   is picked up.
 * - Edit mode: a toolbar on top where you name the page, + Add widget
 *   (anything not on the page; one that lives on another page moves here),
 *   + New page, and Remove page.
 * - Drag a widget onto another widget to reorder. Hold it over a side
 *   arrow and the page turns, just like moving an app between screens; drop it
 *   anywhere on that page. On phones: hold a widget to pick it up, then
 *   tap a widget (to put it there), an arrow (to send it to that page), or
 *   the empty page.
 */

export interface PagedDashOps {
  move: (fromPage: number, fromIdx: number, toPage: number, toIdx: number) => void;
  add: (page: number, id: string) => void;
  addPage: () => number;
  removePage: (page: number) => void;
  rename: (page: number, name: string) => void;
  /** Whole-dashboard copy and restore, for Undo after a page is removed. */
  snapshot: () => unknown;
  restore: (snap: unknown) => void;
}

type Slot = { page: number; idx: number };

/* Touch screens: no native drag. On iPhone a draggable card grabs the touch,
   so the page can't scroll while you look for where the widget goes. */
const COARSE = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;

export function PagedDash({
  pages,
  names,
  allIds,
  titles,
  editing,
  ops,
  onChange,
  notify,
  renderCard,
  renderPage,
  headSlot,
  onRearrange,
}: {
  pages: string[][];
  names: string[];
  allIds: string[];
  titles: Record<string, string>;
  editing: boolean;
  ops: PagedDashOps;
  onChange: () => void;
  notify: (m: string, opts?: NotifyOpts) => void;
  renderCard: (id: string, page: number, idx: number, pageLen: number) => ReactNode;
  /** A page that is not a widget grid (a pinned project): its whole body. */
  renderPage?: (page: number) => ReactNode;
  /** The screen header's spot for the Edit / Done button. */
  headSlot?: HTMLElement | null;
  /** Turn the wiggle (rearrange) mode on or off. */
  onRearrange?: (on: boolean) => void;
}) {
  const [page, setPage] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [picked, setPicked] = useState<Slot | null>(null);
  const [over, setOver] = useState<Slot | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const drag = useRef<Slot | null>(null);
  const flipTimer = useRef<number | null>(null);
  const holdTimer = useRef<number | null>(null);
  const swipeRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const n = pages.length;
  const cur = Math.min(page, Math.max(0, n - 1));

  const jump = (i: number) => {
    if (i < 0 || i >= n) return;
    setDir(i >= cur ? 1 : -1);
    setPage(i);
    const el = swipeRef.current;
    el?.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };
  usePageKeys(stageRef, cur, n, jump, !picked);

  /* Entering or leaving edit (a long press) re-lays out the page, and the
     phone swipe row could snap back to page 1. Hold the page you were on:
     put the scroll back and ignore the scroll events the relayout fires. */
  const pageRef = useRef(cur);
  pageRef.current = cur;
  const holdUntil = useRef(0);
  useLayoutEffect(() => {
    const keep = pageRef.current;
    holdUntil.current = Date.now() + 400;
    const put = () => {
      const el = swipeRef.current;
      if (el && el.clientWidth) el.scrollLeft = keep * el.clientWidth;
    };
    put();
    setPage(keep);
    const r1 = requestAnimationFrame(() => {
      put();
      requestAnimationFrame(put);
    });
    const t = window.setTimeout(put, 250);
    return () => {
      cancelAnimationFrame(r1);
      window.clearTimeout(t);
    };
  }, [editing]);

  const onSwipeScroll = () => {
    const el = swipeRef.current;
    if (!el) return;
    if (Date.now() < holdUntil.current) return;
    const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    if (i !== page && i >= 0 && i < n) setPage(i);
  };

  const clear = () => {
    drag.current = null;
    setPicked(null);
    setOver(null);
    if (flipTimer.current) window.clearTimeout(flipTimer.current);
    flipTimer.current = null;
  };
  const moveTo = (to: Slot) => {
    const from = drag.current;
    if (!from) return;
    if (!(from.page === to.page && from.idx === to.idx)) {
      ops.move(from.page, from.idx, to.page, to.idx);
      onChange();
    }
    clear();
  };
  /* Send the held widget to the end of the page next door. */
  const sendSide = (d: -1 | 1) => {
    const from = drag.current;
    if (!from) {
      jump(cur + d);
      return;
    }
    let target = cur + d;
    if (target < 0) return;
    if (target >= n) target = ops.addPage();
    const len = (pages[target] ?? []).length;
    ops.move(from.page, from.idx, target, len);
    onChange();
    clear();
    setDir(d);
    setPage(target);
    notify(`Moved to ${names[target] ?? 'the new page'}.`);
  };

  /* Hovering a dragged widget on an arrow turns the page after a beat. */
  const armFlip = (d: -1 | 1) => {
    if (!drag.current || flipTimer.current) return;
    flipTimer.current = window.setTimeout(() => {
      flipTimer.current = null;
      const t = cur + d;
      if (t >= 0 && t < n) jump(t);
    }, 550);
  };
  const disarm = () => {
    if (flipTimer.current) window.clearTimeout(flipTimer.current);
    flipTimer.current = null;
  };

  /* Phone drag (his ask): hold a widget, then drag it with your finger.
     While it's held the page doesn't scroll, except near the top and bottom
     edges, where it scrolls for you so a widget can travel down the page. */
  const touchDrag = useRef(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const overRef = useRef<Slot | null>(null);
  const lastY = useRef<number | null>(null);
  const scrollLoop = useRef(0);
  const moveRef = useRef(moveTo);
  moveRef.current = moveTo;
  const flipRef = useRef(armFlip);
  flipRef.current = armFlip;
  useEffect(() => {
    const onMove = (e: TouchEvent) => {
      if (!touchDrag.current) return;
      e.preventDefault();
      const t = e.touches[0];
      const el = document.elementFromPoint(t.clientX, t.clientY) as HTMLElement | null;
      const cell = el?.closest('.pdCell') as HTMLElement | null;
      if (cell && cell.dataset.pi != null) {
        const slot = { page: Number(cell.dataset.pi), idx: Number(cell.dataset.wi) };
        if (!overRef.current || overRef.current.page !== slot.page || overRef.current.idx !== slot.idx) {
          overRef.current = slot;
          setOver(slot);
        }
      }
      const arr = el?.closest('.pgArr') as HTMLElement | null;
      if (arr) flipRef.current(arr.classList.contains('l') ? -1 : 1);
      lastY.current = t.clientY;
      if (!scrollLoop.current) scrollLoop.current = requestAnimationFrame(edgeScroll);
    };
    /* The screen's own scroller (#mn itself doesn't scroll). Keeps going
       while the finger rests near an edge, faster the closer it is. */
    const scroller = () => {
      let el: HTMLElement | null = stageRef.current;
      while (el && el !== document.body) {
        const oy = getComputedStyle(el).overflowY;
        if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight) return el;
        el = el.parentElement;
      }
      return (document.scrollingElement as HTMLElement) ?? null;
    };
    const edgeScroll = () => {
      scrollLoop.current = 0;
      if (!touchDrag.current || lastY.current == null) return;
      const sc = scroller();
      if (sc) {
        const r = sc.getBoundingClientRect();
        const top = Math.max(r.top, 0) + 90;
        const bot = Math.min(r.bottom, window.innerHeight) - 170;
        const y = lastY.current;
        const v = y < top ? -Math.min(18, (top - y) / 4 + 4) : y > bot ? Math.min(18, (y - bot) / 4 + 4) : 0;
        if (v) sc.scrollBy(0, v);
        if (v) scrollLoop.current = requestAnimationFrame(edgeScroll);
      }
    };
    const onEnd = () => {
      if (!touchDrag.current) return;
      touchDrag.current = false;
      lastY.current = null;
      if (scrollLoop.current) cancelAnimationFrame(scrollLoop.current);
      scrollLoop.current = 0;
      const to = overRef.current;
      overRef.current = null;
      if (to) moveRef.current(to);
      else {
        drag.current = null;
        setPicked(null);
        setOver(null);
      }
    };
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);
    return () => {
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  const here = new Set(pages[cur] ?? []);
  const where = (id: string) => pages.findIndex((p) => p.includes(id));
  const addable = allIds.filter((id) => !here.has(id));

  const arrow = (d: -1 | 1) => {
    const t = cur + d;
    const lastWithWidget = d === 1 && t >= n && !!picked;
    if ((t < 0 || t >= n) && !lastWithWidget) return null;
    return (
      <button
        className={'pgArr ' + (d < 0 ? 'l' : 'r')}
        aria-label={picked ? (t >= n ? 'Move to a new page' : `Move to ${names[t]}`) : d < 0 ? 'Previous page' : 'Next page'}
        onClick={() => sendSide(d)}
        onDragEnter={() => armFlip(d)}
        onDragOver={(e) => {
          if (drag.current) e.preventDefault();
        }}
        onDragLeave={disarm}
        onDrop={(e) => {
          e.preventDefault();
          disarm();
          sendSide(d);
        }}
      >
        {t >= n ? '+' : d < 0 ? '‹' : '›'}
      </button>
    );
  };

  /* Edit is one menu (his call, Oct 19): Rearrange turns on the wiggle,
     the rest act on the page you're on. While rearranging it reads Done. */
  const removeCur = () => {
    /* No question: the page goes, Undo brings it back with its widgets. */
    const snap = ops.snapshot();
    const was = cur;
    ops.removePage(cur);
    onChange();
    setPage(Math.max(0, cur - 1));
    notify('Page removed.', {
      undo: () => {
        ops.restore(snap);
        onChange();
        setPage(was);
      },
    });
  };
  const headBtn = editing ? (
    <button className="dashEdit pri" onClick={() => onRearrange?.(false)}>
      Done
    </button>
  ) : (
    <ItemMenu
      name={names[cur] ?? 'this page'}
      buttonLabel="Edit"
      className="dashEdit"
      rename={{ value: names[cur] ?? '', title: 'Rename page', save: (v) => { ops.rename(cur, v); onChange(); } }}
      extra={[
        { label: 'Rearrange widgets', onClick: () => onRearrange?.(true) },
        { label: 'Add widget', onClick: () => setAddOpen(true) },
        {
          label: 'New page',
          onClick: () => {
            const i = ops.addPage();
            onChange();
            setDir(1);
            setPage(i);
            notify('New page added.');
          },
        },
      ]}
      deleteLabel="Remove page"
      onDelete={n > 1 ? removeCur : undefined}
      onChange={onChange}
    />
  );

  return (
    <div className={'pdash' + (picked ? ' picking' : '')}>
      {headSlot ? createPortal(headBtn, headSlot) : null}
      {addOpen ? (
        <div className="pdTools">
          <div className="pdBar">
            <b className="s">Add to {names[cur] ?? 'this page'}</b>
            <button className="pdLink" onClick={() => setAddOpen(false)}>
              Close
            </button>
          </div>
            <div className="pdAdd">
              {addable.length ? (
                addable.map((id) => {
                  const w = where(id);
                  return (
                    <button
                      key={id}
                      className="sr"
                      onClick={() => {
                        if (w >= 0) ops.move(w, pages[w].indexOf(id), cur, (pages[cur] ?? []).length);
                        else ops.add(cur, id);
                        onChange();
                        setAddOpen(false);
                        notify(`${titles[id]} ${w >= 0 ? 'moved here' : 'added'}.`);
                      }}
                    >
                      <span className="g">
                        <b>{titles[id]}</b>
                      </span>
                      <span className="xs m">{w >= 0 ? 'Move from ' + names[w] : 'Add'}</span>
                    </button>
                  );
                })
              ) : (
                <div className="s m">Every widget is already on this page.</div>
              )}
            </div>
        </div>
      ) : null}
      <PageNav names={names} page={cur} onJump={jump} />
      <div className="pdStage" ref={stageRef}>
        {arrow(-1)}
        <div className={dir > 0 ? 'cswipe fwd' : 'cswipe back'} ref={swipeRef} onScroll={onSwipeScroll}>
          {pages.map((widgets, pi) => (
            <div
              key={pi}
              className={pi === cur ? 'cpg on' : 'cpg'}
              onDragOver={(e) => {
                if (drag.current) e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                moveTo({ page: pi, idx: widgets.length });
              }}
              onClick={() => {
                if (picked && editing && (widgets.length === 0 || picked.page !== pi)) moveTo({ page: pi, idx: widgets.length });
              }}
            >
              {renderPage?.(pi) ?? (
              <div className="pgrid">
                {widgets.map((w, wi) => {
                  const isPicked = picked && picked.page === pi && picked.idx === wi;
                  const isOver = over && over.page === pi && over.idx === wi;
                  return (
                    <div
                      key={w}
                      className={'pdCell' + (isPicked ? ' picked' : '') + (isOver ? ' over' : '')}
                      draggable={editing && !COARSE}
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', w);
                        drag.current = { page: pi, idx: wi };
                        window.setTimeout(() => setPicked({ page: pi, idx: wi }), 0);
                      }}
                      onDragOver={(e) => {
                        if (!drag.current) return;
                        e.preventDefault();
                        e.stopPropagation();
                        if (!isOver) setOver({ page: pi, idx: wi });
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        moveTo({ page: pi, idx: wi });
                      }}
                      onDragEnd={clear}
                      data-pi={pi}
                      data-wi={wi}
                      onTouchStart={(e) => {
                        if (!editing || touchDrag.current) return;
                        const t0 = e.touches[0];
                        touchStart.current = { x: t0.clientX, y: t0.clientY };
                        if (holdTimer.current) window.clearTimeout(holdTimer.current);
                        holdTimer.current = window.setTimeout(() => {
                          holdTimer.current = null;
                          drag.current = { page: pi, idx: wi };
                          touchDrag.current = true;
                          setPicked({ page: pi, idx: wi });
                          navigator.vibrate?.(10);
                        }, 350);
                      }}
                      onTouchMove={(e) => {
                        /* Before pickup: a real move means scroll, so drop the hold. Small jitter is fine. */
                        if (!holdTimer.current || !touchStart.current) return;
                        const t1 = e.touches[0];
                        if (Math.abs(t1.clientX - touchStart.current.x) + Math.abs(t1.clientY - touchStart.current.y) > 12) {
                          window.clearTimeout(holdTimer.current);
                          holdTimer.current = null;
                        }
                      }}
                      onTouchEnd={() => {
                        if (holdTimer.current) window.clearTimeout(holdTimer.current);
                        holdTimer.current = null;
                      }}
                      onClickCapture={(e) => {
                        if (!picked || !editing) return;
                        e.stopPropagation();
                        e.preventDefault();
                        if (isPicked) clear();
                        else moveTo({ page: pi, idx: wi });
                      }}
                    >
                      {renderCard(w, pi, wi, widgets.length)}
                    </div>
                  );
                })}
              </div>
              )}
              {editing && widgets.length === 0 && !renderPage?.(pi) ? <div className="pdEmpty">Empty page. Drop or add widgets here.</div> : null}
            </div>
          ))}
        </div>
        {arrow(1)}
      </div>
      <div className="cdots">
        {pages.map((_, i) => (
          <i key={i} className={i === cur ? 'on' : ''} onClick={() => jump(i)} />
        ))}
      </div>
    </div>
  );
}
