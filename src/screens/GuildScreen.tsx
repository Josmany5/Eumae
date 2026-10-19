import { useRef, useState } from 'react';
import { PagedDash } from '../components/shell/PagedDash';
import { snapshotGuildDash, restoreGuildDash } from '../gdash';
import { undoable } from '../undo';
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
  const [editing, setEditing] = useState(false);
  const holdTimer = useRef<number | null>(null);

  const refresh = () => {
    setDash(getGuildDashboard());
  };

  const unread = getGuild().threads.reduce((a, t) => a + (t.un || 0), 0);

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

  return (
    <div className={editing ? 'ed8 dashWide' : 'dashWide'} onPointerDown={holdStart} onPointerUp={holdEnd} onPointerLeave={holdEnd}>
      <div className="row dashHead">
        <div className="g">
          <div className="screenT dupT">Guild</div>
          <div className="screenS">{editing ? 'Editing this dashboard.' : 'People, requests, shared work. ' + unread + ' unread'}</div>
        </div>
        <button className={'dashEdit' + (editing ? ' pri' : '')} onClick={() => setEditing((v) => !v)}>
          {editing ? 'Done' : 'Edit'}
        </button>
      </div>
      <PagedDash
        pages={dash.pages}
        names={guildPageNames()}
        allIds={GUILD_WIDGET_IDS}
        titles={GUILD_WIDGET_TITLES}
        editing={editing}
        notify={notify}
        onChange={refresh}
        ops={{
          move: moveGuildWidget,
          add: (p, id) => addGuildWidget(p, id as GuildWidgetId),
          addPage: addGuildPage,
          removePage: removeGuildPage,
          snapshot: snapshotGuildDash,
          restore: (x) => restoreGuildDash(x as GuildDashboard),
          rename: renameGuildPage,
        }}
        renderCard={(w, pi, wi, len) => (
          <GuildWidgetCard
            id={w as GuildWidgetId}
            dash={dash}
            pageLen={len}
            isFirst={pi === 0 && wi === 0}
            editing={editing}
            onNavigate={navigate}
            onPage={openPage}
            onTab={openTab}
            onRemove={() =>
              undoable(notify, 'Widget removed.', snapshotGuildDash, restoreGuildDash, () => removeGuildWidget(pi, w as GuildWidgetId), refresh)
            }
            onRefresh={refresh}
            notify={notify}
          />
        )}
      />
    </div>
  );
}
