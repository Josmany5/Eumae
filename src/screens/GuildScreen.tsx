import { useRef, useState } from 'react';
import { PagedDash } from '../components/shell/PagedDash';
import { snapshotGuildDash, restoreGuildDash } from '../gdash';
import { undoable } from '../undo';
import { useNav } from '../nav';
import { getGuild, createGroup } from '../guild';
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
import { Icon } from '../components/shell/icons';

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
  const [guildName, setGuildName] = useState('');
  const [headSlot, setHeadSlot] = useState<HTMLDivElement | null>(null);
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
          <div className="screenS">{editing ? 'Rearranging. Hold a widget and drag it.' : 'People, requests, shared work. ' + unread + ' unread'}</div>
        </div>
        <div className="dashSlot" ref={setHeadSlot} />
      </div>
      {!editing ? <GuildFrontDoor guildName={guildName} setGuildName={setGuildName} refresh={refresh} /> : null}
      <PagedDash
        pages={dash.pages}
        names={guildPageNames()}
        allIds={GUILD_WIDGET_IDS}
        titles={GUILD_WIDGET_TITLES}
        editing={editing}
        headSlot={headSlot}
        onRearrange={setEditing}
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

/* The dashboard front door above the widget pages: where your guilds
 * stand, what is waiting on you, creating a guild, and the guild cards.
 * Everything reads the real guild store; creating writes through
 * createGroup. */
function GuildFrontDoor({ guildName, setGuildName, refresh }: {
  guildName: string;
  setGuildName: (v: string) => void;
  refresh: () => void;
}) {
  const { notify, go } = useNav();
  const g = getGuild();
  const mine = g.assigned.filter((a) => a.mine);
  const myPct = mine.length ? Math.round(mine.reduce((s, a) => s + a.pct, 0) / mine.length) : 0;
  const unread = g.threads.reduce((a, t) => a + (t.un || 0), 0) + g.groups.reduce((a, x) => a + (x.un || 0), 0);
  const create = () => {
    const msg = createGroup(guildName);
    notify(msg);
    if (msg === 'Group created.') {
      setGuildName('');
      refresh();
    }
  };
  return (
    <div>
      <div className="card">
        <div className="row">
          <div className="ringC" style={{ background: `conic-gradient(var(--ac) ${myPct}%, var(--card2) ${myPct}%)` }}>
            <i>{myPct}%</i>
          </div>
          <div className="g">
            <b>Your guilds</b>
            <div className="s m" style={{ marginTop: 2 }}>
              {g.groups.length} groups · {g.people.length} people · {mine.length} assigned to you
            </div>
            <div className="xs m" style={{ marginTop: 2 }}>The ring is your assigned work, on average.</div>
          </div>
        </div>
      </div>
      {g.reqIn.length || unread ? (
        <div
          className="card"
          role="button"
          style={{ cursor: 'pointer' }}
          onClick={() => go(g.reqIn.length ? 'greq' : 'gmsg')}
        >
          <div className="row">
            <div className="g">
              <b>Waiting on you</b>
              <div className="s m" style={{ marginTop: 2 }}>
                {g.reqIn.length ? `${g.reqIn.length} request${g.reqIn.length > 1 ? 's' : ''} to answer` : ''}
                {g.reqIn.length && unread ? ' · ' : ''}
                {unread ? `${unread} unread message${unread > 1 ? 's' : ''}` : ''}
              </div>
            </div>
            <span className="ch">›</span>
          </div>
        </div>
      ) : null}
      {/* Create a guild — Console's quick-add shape: one pill field, one
          round button. A guild is your people around one thing. */}
      <div className="qaBar" style={{ margin: '12px 0 4px' }}>
        <input
          className="qaIn"
          placeholder="Name a new guild…"
          aria-label="Guild name"
          value={guildName}
          onChange={(e) => setGuildName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && guildName.trim()) create(); }}
        />
        <button className="qaSend" disabled={!guildName.trim()} onClick={create} aria-label="Create guild">
          <Icon name="up" />
        </button>
      </div>
      <div className="xs m">Family, a team, a crew — name it and it starts here.</div>
      {g.groups.length ? (
        <>
          <h3 className="sec">Your guilds</h3>
          <div className="cxGrid">
            {g.groups.map((gr) => (
              <div key={gr.n} className="cxcard" role="button" style={{ cursor: 'pointer' }} onClick={() => go('gchatg', gr.n)}>
                <div className="row">
                  <div className="g">
                    <b>{gr.n}</b>
                    <div className="xs m">{gr.last || `${gr.msgs.length} messages`}</div>
                  </div>
                  {gr.un ? <span className="tag">{gr.un} new</span> : null}
                  <span className="ch">›</span>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
