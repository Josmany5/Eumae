import { useMemo, useRef, useState } from 'react';
import { PageNav, usePageKeys } from '../components/shell/PageNav';
import { useNav } from '../nav';
import { getTasks, type Task } from '../tasks';
import {
  getDashboard,
  setSize,
  sizeOf,
  removeWidget,
  addWidget,
  moveWidget,
  addPage,
  CONSOLE_PAGE_NAMES,
  removePage,
  WIDGET_IDS,
  WIDGET_TITLES,
  type Dashboard,
  type WidgetId,
} from '../dash';
import { WidgetCard, WIDGET_NAV } from '../components/shell/widgets';

/* The Console — the mockup's widget dashboard (second rCon layer), rebuilt
 * as React on tokens.
 *
 * Pages come from the dash store (mockup's dash8.pages seed); each page is a
 * grid of widget cards. Edit mode (button + 600ms hold, the mockup's ED8):
 * cards shake with × to remove, size toggles flip quick/full, + Add opens
 * the registry, pages gain + New / Remove. Drag reorders within and across
 * pages — the mockup has remove + add only, so this is the new piece on the
 * same store. Tapping a card (not editing) opens its full page.
 */

export default function ConsoleScreen() {
  const { notify, go, goTab } = useNav();
  const [tasks, setTasks] = useState<Task[]>(() => getTasks());
  const [dash, setDash] = useState<Dashboard>(() => getDashboard());
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const swipeRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const holdTimer = useRef<number | null>(null);
  /* Drag state: which card is moving + the drop slot. Set on drag start /
     over, cleared on drop — the move writes the store once, so a drag never
     re-renders mid-flight. */
  const [dragId, setDragId] = useState<{ page: number; idx: number } | null>(null);
  const [dropSlot, setDropSlot] = useState<{ page: number; idx: number } | null>(null);

  const refresh = () => {
    setTasks(getTasks());
    setDash(getDashboard());
  };

  const pages = dash.pages;
  const safePage = Math.min(page, Math.max(0, pages.length - 1));
  const openCount = tasks.filter((t) => !t.d).length;
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  /* Dots follow the swipe. */
  const onSwipeScroll = () => {
    const el = swipeRef.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    if (i !== page && i >= 0 && i < pages.length) setPage(i);
  };
  const [dir, setDir] = useState<1 | -1>(1);
  const jump = (i: number) => {
    if (i < 0 || i >= pages.length) return;
    setDir(i >= safePage ? 1 : -1);
    setPage(i);
    swipeRef.current?.scrollTo({ left: i * swipeRef.current.clientWidth, behavior: 'smooth' });
  };

  usePageKeys(rootRef, safePage, pages.length, jump, !dragId);
  const pageNames = pages.map((_, i) => CONSOLE_PAGE_NAMES[i] || 'Page ' + (i + 1));

  /* 600ms hold enters edit — the mockup's onpointerdown timer. */
  const holdStart = () => {
    if (editing) return;
    if (holdTimer.current) window.clearTimeout(holdTimer.current);
    holdTimer.current = window.setTimeout(() => setEditing(true), 600);
  };
  const holdEnd = () => {
    if (holdTimer.current) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  const navigate = (id: WidgetId) => {
    const nav = WIDGET_NAV[id];
    if (nav.tab === 'library' || nav.tab === 'guild') {
      goTab(nav.tab);
      return;
    }
    if (nav.page) go(nav.page);
  };


  /* Drop: move the dragged card to the slot, everything refreshes. */
  const doDrop = () => {
    if (dragId && dropSlot) {
      moveWidget(dragId.page, dragId.idx, dropSlot.page, dropSlot.idx);
      refresh();
    }
    setDragId(null);
    setDropSlot(null);
  };

  const available = useMemo(() => {
    const on = pages.flat();
    return WIDGET_IDS.filter((w) => !on.includes(w));
  }, [pages]);

  return (
    <div ref={rootRef} className={editing ? 'ed8 dashWide' : 'dashWide'}>
      <div className="row">
        <div className="g">
          <div className="screenT">Console</div>
          <div className="screenS">
            Right now, at a glance.{' '}
            {editing ? 'Tap × to remove something.' : `${today} · ${openCount} left today`}
          </div>
        </div>
        <button className="fb" onClick={() => setEditing((v) => !v)}>
          {editing ? 'Done' : 'Edit'}
        </button>
      </div>
      <PageNav names={pageNames} page={safePage} onJump={jump} />
      <div
        className={dir > 0 ? 'cswipe fwd' : 'cswipe back'}
        ref={swipeRef}
        onScroll={onSwipeScroll}
        onPointerDown={holdStart}
        onPointerUp={holdEnd}
        onPointerLeave={holdEnd}
      >
        {pages.map((widgets, pi) => (
          <div
            key={pi}
            className={pi === safePage ? 'cpg on' : 'cpg'}
            onDragOver={(e) => {
              if (dragId) e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragId && pi !== dragId.page) {
                moveWidget(dragId.page, dragId.idx, pi, pages[pi].length);
                refresh();
              }
              setDragId(null);
              setDropSlot(null);
            }}
          >
            <div className="pgrid">
              {widgets.map((w, wi) => (
                <div
                  key={w}
                  draggable={editing}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move';
                    setDragId({ page: pi, idx: wi });
                  }}
                  onDragEnd={doDrop}
                  onDragOver={(e) => {
                    if (!dragId) return;
                    e.preventDefault();
                    e.stopPropagation();
                    setDropSlot({ page: pi, idx: wi });
                  }}
                  onTouchStart={() => {
                    if (!editing || dragId) return;
                    holdTimer.current = window.setTimeout(() => setDragId({ page: pi, idx: wi }), 400);
                  }}
                  onTouchEnd={() => {
                    if (holdTimer.current) {
                      window.clearTimeout(holdTimer.current);
                      holdTimer.current = null;
                    }
                    if (dragId && editing) {
                      if (dragId.page === pi && dragId.idx === wi) {
                        setDragId(null);
                        setDropSlot(null);
                      } else {
                        moveWidget(dragId.page, dragId.idx, pi, wi);
                        refresh();
                        setDragId(null);
                        setDropSlot(null);
                      }
                    }
                  }}
                  style={
                    dropSlot && dropSlot.page === pi && dropSlot.idx === wi
                      ? { outline: '2px solid var(--ac)', borderRadius: 20 }
                      : undefined
                  }
                >
                  <WidgetCard
                    id={w}
                    dash={dash}
                    pageLen={widgets.length}
                    isFirst={pi === 0 && wi === 0}
                    editing={editing}
                    onNavigate={navigate}
                    onBrief={() => setBriefOpen((v) => !v)}
                    onRemove={() => {
                      removeWidget(pi, w);
                      refresh();
                    }}
                    onFlipSize={() => {
                      setSize(w, sizeOf(dash, w) === 'full' ? 'quick' : 'full');
                      refresh();
                    }}
                    onRefresh={refresh}
                  />
                </div>
              ))}
            </div>
            {editing && pages.length > 1 ? (
              <button
                className="fb"
                onClick={() => {
                  removePage(pi);
                  setPage(0);
                  refresh();
                }}
              >
                Remove page
              </button>
            ) : null}
          </div>
        ))}
        {editing ? (
          <div className="cpg add">
            <button
              className="card"
              style={{ width: '100%', padding: 28 }}
              onClick={() => {
                const n = addPage();
                refresh();
                jump(n);
              }}
            >
              + New page
            </button>
          </div>
        ) : null}
      </div>
      <div className="cdots">
        {pages.map((_, i) => (
          <i key={i} className={i === safePage ? 'on' : ''} onClick={() => jump(i)} />
        ))}
      </div>
      {editing ? (
        <div className="btns">
          {available.length > 0 ? (
            <AddWidgetRow
              available={available}
              onAdd={(w) => {
                addWidget(safePage, w);
                refresh();
                notify(`${WIDGET_TITLES[w]} added.`);
              }}
            />
          ) : (
            <div className="card s m">Everything is on this Console. Add a new page for more.</div>
          )}
        </div>
      ) : null}
      {briefOpen ? (
        <div className="card">
          <b>Today&apos;s briefing</b>
          <div className="s" style={{ marginTop: 4 }}>
            Mirror: you finish work best before 9 AM and slip after 4.
          </div>
          <div className="s" style={{ marginTop: 6 }}>
            Nudge: nothing is scheduled after 3 PM — move the demo rehearsal there?
          </div>
          <div className="btns">
            <button className="fb" onClick={() => setBriefOpen(false)}>
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* Add-to-page registry: every widget not already on the Console.
   Console-only: Guild has its own twin on GuildScreen. */
function AddWidgetRow({ available, onAdd }: { available: WidgetId[]; onAdd: (w: WidgetId) => void }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button className="gho" onClick={() => setOpen(true)}>
        + Add to this page
      </button>
    );
  }
  return (
    <div className="card cardPad">
      {available.map((w) => (
        <button
          key={w}
          className="sr"
          onClick={() => {
            onAdd(w);
            setOpen(false);
          }}
        >
          <span className="g">
            <b>{WIDGET_TITLES[w]}</b>
          </span>
        </button>
      ))}
    </div>
  );
}
