import { useMemo, useRef, useState } from 'react';
import { PageNav, PageNameField, usePageKeys } from '../components/shell/PageNav';
import { useNav } from '../nav';
import { getGuild } from '../guild';
import {
  getGuildDashboard,
  removeGuildWidget,
  addGuildWidget,
  moveGuildWidget,
  addGuildPage,
  removeGuildPage,
  GUILD_WIDGET_IDS,
  GUILD_WIDGET_TITLES,
  guildPageNames,
  renameGuildPage,
  type GuildDashboard,
  type GuildWidgetId,
} from '../gdash';
import { GuildWidgetCard, GUILD_WIDGET_NAV } from '../components/shell/guildWidgets';

/* The Guild — the mockup's guild widget dashboard (latest rGld layer),
 * rebuilt as React on tokens.
 *
 * Pages come from the gdash store (mockup's gdash9.pages seed: Inbox /
 * Network); each page is a grid of guild widget cards. Edit mode (button +
 * 600ms hold, the mockup's EDG9): cards shake with × to remove, size
 * toggles flip quick/full, + Add opens the registry, pages gain + New /
 * Remove. Drag reorders within and across pages — the mockup has remove
 * + add only, so this is the new piece on the same store. Tapping a card
 * (not editing) opens its full page; those pages arrive in batch 3.
 */

export default function GuildScreen() {
  const { notify, go, goTab } = useNav();
  const [dash, setDash] = useState<GuildDashboard>(() => getGuildDashboard());
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState(false);
  const swipeRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const holdTimer = useRef<number | null>(null);
  /* Drag state: which card is moving + the drop slot. Set on drag start /
     over, cleared on drop — the move writes the store once, so a drag never
     re-renders mid-flight. */
  const [dragId, setDragId] = useState<{ page: number; idx: number } | null>(null);
  const [dropSlot, setDropSlot] = useState<{ page: number; idx: number } | null>(null);

  const refresh = () => {
    setDash(getGuildDashboard());
  };

  const pages = dash.pages;
  const safePage = Math.min(page, Math.max(0, pages.length - 1));
  const unread = getGuild().threads.reduce((a, t) => a + (t.un || 0), 0);

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
  const pageNames = guildPageNames();

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

  const navigate = (id: GuildWidgetId) => {
    const nav = GUILD_WIDGET_NAV[id];
    if (nav.tab) {
      goTab(nav.tab as 'chat' | 'console' | 'studio' | 'library' | 'classroom' | 'guild');
      return;
    }
    if (nav.page) go(nav.page, nav.arg);
  };
  const openPage = (p: string, arg?: unknown) => {
    go(p, arg);
  };
  const openTab = (t: string) => {
    if (t === 'studio' || t === 'classroom' || t === 'guild' || t === 'library' || t === 'console' || t === 'chat') {
      goTab(t);
      return;
    }
  };

  /* Drop: move the dragged card to the slot, everything refreshes. */
  const doDrop = () => {
    if (dragId && dropSlot) {
      moveGuildWidget(dragId.page, dragId.idx, dropSlot.page, dropSlot.idx);
      refresh();
    }
    setDragId(null);
    setDropSlot(null);
  };

  const available = useMemo(() => {
    const on = pages.flat();
    return GUILD_WIDGET_IDS.filter((w) => !on.includes(w));
  }, [pages]);

  return (
    <div ref={rootRef} className={editing ? 'ed8 dashWide' : 'dashWide'}>
      <div className="row">
        <div className="g">
          <div className="screenT">Guild</div>
          <div className="screenS">
            People, requests, shared work.{' '}
            {editing ? 'Tap × to remove something.' : unread + ' unread'}
          </div>
        </div>
        <button className="fb" onClick={() => setEditing((v) => !v)}>
          {editing ? 'Done' : 'Edit'}
        </button>
      </div>
      <PageNav names={pageNames} page={safePage} onJump={jump} />
      {editing ? (
        <PageNameField
          key={safePage}
          value={pageNames[safePage]}
          onSave={(name) => {
            renameGuildPage(safePage, name);
            refresh();
          }}
        />
      ) : null}
      <div
        className={dir > 0 ? 'cswipe fwd' : 'cswipe back'}
        ref={swipeRef}
        onScroll={onSwipeScroll}
        onPointerDown={holdStart}
        onPointerUp={holdEnd}
        onPointerLeave={holdEnd}
      >
        {pages.map((widgets, pi) => (
          <div key={pi} className={pi === safePage ? 'cpg on' : 'cpg'}>
            <div className="pgrid">
              {widgets.map((w, wi) => (
                <div
                  key={w}
                  draggable={editing}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move';
                    setDragId({ page: pi, idx: wi });
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDropSlot({ page: pi, idx: wi });
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDropSlot({ page: pi, idx: wi });
                    window.setTimeout(doDrop, 0);
                  }}
                  onDragEnd={doDrop}
                  onTouchStart={(e) => {
                    if (!editing) return;
                    const t = e.touches[0];
                    const sx = t.clientX;
                    const sy = t.clientY;
                    const el = e.currentTarget;
                    const move = (ev: TouchEvent) => {
                      const dx = ev.touches[0].clientX - sx;
                      const dy = ev.touches[0].clientY - sy;
                      if (Math.abs(dx) + Math.abs(dy) > 12) el.style.opacity = '0.4';
                    };
                    const end = () => {
                      el.style.opacity = '';
                      el.removeEventListener('touchmove' as never, move as never);
                      el.removeEventListener('touchend' as never, end as never);
                    };
                    el.addEventListener('touchmove', move as never, { passive: true });
                    el.addEventListener('touchend', end as never);
                  }}
                >
                  <GuildWidgetCard
                    id={w}
                    dash={dash}
                    pageLen={widgets.length}
                    isFirst={pi === 0 && wi === 0}
                    editing={editing}
                    onNavigate={navigate}
                    onPage={openPage}
                    onTab={openTab}
                    onRemove={() => {
                      removeGuildWidget(pi, w);
                      refresh();
                    }}
                    onRefresh={refresh}
                    notify={notify}
                  />
                </div>
              ))}
            </div>
            {editing && pages.length > 1 ? (
              <button
                className="fb"
                onClick={() => {
                  removeGuildPage(pi);
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
                const n = addGuildPage();
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
            <AddGuildRow
              available={available}
              onAdd={(w) => {
                addGuildWidget(safePage, w);
                refresh();
                notify(GUILD_WIDGET_TITLES[w] + ' added.');
              }}
            />
          ) : (
            <div className="card s m">Everything is on this Guild. Add a new page for more.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

/* Add-to-page registry: every widget not already on the Guild.
   Guild-only: Console has its own twin on ConsoleScreen. */
function AddGuildRow({ available, onAdd }: { available: GuildWidgetId[]; onAdd: (w: GuildWidgetId) => void }) {
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
            <b>{GUILD_WIDGET_TITLES[w]}</b>
          </span>
        </button>
      ))}
    </div>
  );
}
