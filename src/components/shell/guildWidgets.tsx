/* The Guild widget set — the mockup's GW9/GWID9/FB10-guild/GNAV9, rebuilt
 * as React.
 *
 * Six widgets, each with a quick view (glance; tap opens the full page) and
 * a full view (the whole thing inline — the mockup built full views for all
 * six guild widgets). Sizes live in gdash.ts (`wsz10`); navigation targets
 * are the mockup's GNAV9.
 */

import { getGuild, answerRequest } from '../../guild';
import { getFromMarket } from '../../market';
import {
  GUILD_WIDGET_TITLES,
  GUILD_WIDGET_ICONS,
  type GuildDashboard,
  type GuildWidgetId,
} from '../../gdash';
import { Icon } from './icons';

/** Where a card tap lands — the mockup's GNAV9. Sections ride `arg`
 * (mockup's goPage second argument); all targets exist in PAGES. */
export const GUILD_WIDGET_NAV: Record<GuildWidgetId, { tab?: string; page?: string; arg?: unknown }> = {
  gmsg9: { page: 'gmsg' },
  greq9: { page: 'greq' },
  gact9: { page: 'gsec', arg: 'Activity' },
  gshr9: { page: 'gsec', arg: 'Shared work' },
  gmkt9: { page: 'gsec', arg: 'Marketplace' },
  gasn9: { page: 'greq' },
};

/* Quick views: one glance each. Tapping navigates (handled by the card);
   inner buttons stop propagation, like the mockup's event.stopPropagation
   on its widget buttons. */
function QuickMsg() {
  const g = getGuild();
  const pend = g.threads.filter((t) => t.un);
  const rows = pend.length ? pend : g.threads.slice(0, 2);
  return (
    <>
      {rows.map((t) => {
        const p = g.people[t.p];
        if (!p) return null;
        return (
          <div key={`${p.n}${t.last}`} className="li" style={{ margin: '0 -4px' }}>
            <div className="fi" style={{ borderRadius: '50%' }}>
              {p.ini}
            </div>
            <div className="g">
              <div className="s">
                <b>{p.n}</b>
                {t.un ? <span className="tag">{t.un} new</span> : null}
              </div>
              <div className="xs m">{t.last}</div>
            </div>
          </div>
        );
      })}
      <div className="xs m" style={{ marginTop: 6 }}>
        {pend.length} pending · tap for Messages
      </div>
    </>
  );
}

function QuickReq() {
  const g = getGuild();
  const fresh = g.reqIn.filter((r) => r.st === 'new').length;
  return (
    <>
      <div className="kv">
        <span className="s">Waiting on you</span>
        <span className="tag">{fresh}</span>
      </div>
      <div className="kv">
        <span className="s">You&apos;re waiting on</span>
        <span>{g.reqOut.length}</span>
      </div>
      <div className="xs m" style={{ marginTop: 4 }}>
        Tap for the full lists
      </div>
    </>
  );
}

function QuickAct() {
  const g = getGuild();
  return (
    <>
      {g.act.slice(0, 3).map((a) => (
        <div key={a.a} className="hi">
          <span className={`dt ${a.s}`} />
          <div className="s">
            {a.a}
            <div className="xs m">
              {a.t} · {a.w}
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
function QuickShr() {
  const g = getGuild();
  return (
    <>
      {g.shared.slice(0, 3).map((x) => {
        const p = g.people[x.p];
        return (
          <div key={x.n} className="li" style={{ margin: '0 -4px' }}>
            <div className="fi">{x.k.slice(0, 4).toUpperCase()}</div>
            <div className="g">
              <div className="s">
                <b>{x.n}</b>
              </div>
              <div className="xs m">with {p ? p.n : 'Guild'}</div>
            </div>
          </div>
        );
      })}
    </>
  );
}

function QuickMkt() {
  const g = getGuild();
  return (
    <>
      {g.market.slice(0, 2).map((x) => (
        <div key={x.n} className="kv">
          <span className="s">{x.n}</span>
          <span className="tag">{x.k}</span>
        </div>
      ))}
      <div className="xs m" style={{ marginTop: 4 }}>
        Templates and widgets from other people&apos;s Eumae
      </div>
    </>
  );
}

function QuickAsn() {
  const g = getGuild();
  const by = g.assigned.filter((a) => !a.mine);
  const to = g.assigned.filter((a) => a.mine);
  return (
    <>
      {by.slice(0, 2).map((a) => (
        <div key={`${a.who}${a.t}`} className="kv">
          <span className="s">
            {a.who} · {a.t}
          </span>
          <span>{a.pct}%</span>
        </div>
      ))}
      <div className="xs m" style={{ marginTop: 4 }}>
        {by.length} assigned by you · {to.length} assigned to you — tap for both views
      </div>
    </>
  );
}

/* Full views: the whole thing inline — the mockup's FB10 guild entries.
   Buttons that act (Accept, Add) stop propagation and refresh, like the
   mockup's gReq/gAdd re-rendering the Guild after each tap. */
function FullMsg({ onPage }: { onPage: (page: string, arg?: unknown) => void }) {
  const g = getGuild();
  return (
    <>
      {g.threads.map((t, i) => {
        const p = g.people[t.p];
        if (!p) return null;
        return (
          <div key={`${p.n}${t.last}`} className="li" style={{ margin: '0 -4px' }}>
            <div className="fi" style={{ borderRadius: '50%' }}>
              {p.ini}
            </div>
            <div className="g">
              <div className="s">
                <b>{p.n}</b>
                {t.un ? <span className="tag">{t.un} new</span> : null}
              </div>
              <div className="xs m">{t.last}</div>
            </div>
            <button
              className="fb"
              onClick={(e) => {
                e.stopPropagation();
                onPage('gchat', i);
              }}
            >
              Open
            </button>
          </div>
        );
      })}
      <h3 className="sec">Groups</h3>
      {g.groups.map((gr) => (
        <div key={gr.n} className="li" style={{ margin: '0 -4px' }}>
          <div className="fi" style={{ borderRadius: '50%' }}>
            {gr.n
              .split(' ')
              .map((x) => x[0])
              .join('')
              .slice(0, 2)}
          </div>
          <div className="g">
            <div className="s">
              <b>{gr.n}</b>
              {gr.un ? <span className="tag">{gr.un} new</span> : null}
            </div>
            <div className="xs m">{gr.last}</div>
          </div>
          <button
            className="fb"
            onClick={(e) => {
              e.stopPropagation();
              onPage('gchatg', gr.n);
            }}
          >
            Open
          </button>
        </div>
      ))}
    </>
  );
}

function FullReq({
  onPage,
  onAccept,
}: {
  onPage: (page: string, arg?: unknown) => void;
  onAccept: (index: number) => void;
}) {
  const g = getGuild();
  return (
    <>
      {g.reqIn.map((r, i) => {
        const p = g.people[r.p];
        return (
          <div key={`${r.what}${i}`} className="li" style={{ margin: '0 -4px' }}>
            <div className="fi" style={{ borderRadius: '50%' }}>
              {p ? p.ini : '?'}
            </div>
            <div className="g">
              <div className="s">
                <b>{p ? p.n : 'Guild'}</b> <span className="m">wants {r.what}</span>
              </div>
              <div className="xs m">{r.st}</div>
            </div>
            {r.st === 'new' ? (
              <button
                className="fb"
                onClick={(e) => {
                  e.stopPropagation();
                  onAccept(i);
                }}
              >
                Accept
              </button>
            ) : null}
          </div>
        );
      })}
      <div className="btns">
        <button
          className="fb"
          onClick={(e) => {
            e.stopPropagation();
            onPage('greq');
          }}
        >
          All requests + assign
        </button>
      </div>
    </>
  );
}

function FullAct({ onPage }: { onPage: (page: string, arg?: unknown) => void }) {
  const g = getGuild();
  return (
    <>
      {g.act.map((a) => (
        <div key={a.a} className="hi">
          <span className={`dt ${a.s}`} />
          <div className="s">
            {a.a}
            <div className="xs m">
              {a.t} · {a.w}
            </div>
          </div>
        </div>
      ))}
      <div className="btns">
        <button
          className="fb"
          onClick={(e) => {
            e.stopPropagation();
            onPage('gsec', 'Activity');
          }}
        >
          Open Activity
        </button>
      </div>
    </>
  );
}
function FullShr({ onPage }: { onPage: (page: string, arg?: unknown) => void }) {
  const g = getGuild();
  return (
    <>
      {g.shared.map((x) => {
        const p = g.people[x.p];
        return (
          <div key={x.n} className="li">
            <div className="fi">{x.k.slice(0, 3).toUpperCase()}</div>
            <div className="g s">
              {x.n}
              <div className="xs m">with {p ? p.n : 'Guild'}</div>
            </div>
          </div>
        );
      })}
      <div className="btns">
        <button
          className="fb"
          onClick={(e) => {
            e.stopPropagation();
            onPage('gsec', 'Shared work');
          }}
        >
          Open Shared work
        </button>
      </div>
    </>
  );
}
function FullMkt({
  onPage,
  onTake,
  onTab,
}: {
  onPage: (page: string, arg?: unknown) => void;
  onTake: (index: number) => void;
  onTab: (tab: string) => void;
}) {
  const g = getGuild();
  return (
    <>
      {g.market.map((x, i) => (
        <div key={x.n} className="li">
          <div className="g">
            <b>{x.n}</b>
            <div className="xs m">
              by @{x.by} · {x.k || ''}
            </div>
          </div>
          {x.got ? (
            <button
              className="fb"
              onClick={(e) => {
                e.stopPropagation();
                onTab('studio');
              }}
            >
              Open in Studio
            </button>
          ) : (
            <button
              className="fb"
              onClick={(e) => {
                e.stopPropagation();
                onTake(i);
              }}
            >
              Add to Studio
            </button>
          )}
        </div>
      ))}
      <div className="btns">
        <button
          className="fb"
          onClick={(e) => {
            e.stopPropagation();
            onPage('gsec', 'Marketplace');
          }}
        >
          Open Marketplace
        </button>
      </div>
    </>
  );
}
function FullAsn({
  onPage,
  onTab,
}: {
  onPage: (page: string, arg?: unknown) => void;
  onTab: (tab: string) => void;
}) {
  const g = getGuild();
  const by = g.assigned.filter((a) => !a.mine);
  const to = g.assigned.filter((a) => a.mine);
  return (
    <>
      <div className="xs m" style={{ marginBottom: 4 }}>
        Assigned by you — everyone's status
      </div>
      {by.map((a) => (
        <div key={'by' + a.who + a.t}>
          <div className="kv">
            <span className="s">
              {a.who} · {a.t}
            </span>
            <span>{a.pct}%</span>
          </div>
          <div className="bar">
            <i style={{ width: a.pct + '%' }} />
          </div>
        </div>
      ))}
      <div className="xs m" style={{ margin: '8px 0 4px' }}>
        Assigned to you — your progress only
      </div>
      {to.map((a) => (
        <div key={'to' + a.who + a.t}>
          <div className="kv">
            <span className="s">{a.t}</span>
            <span>{a.pct}%</span>
          </div>
          <div className="bar">
            <i style={{ width: a.pct + '%' }} />
          </div>
        </div>
      ))}
      <div className="btns">
        <button
          className="fb"
          onClick={(e) => {
            e.stopPropagation();
            onTab('classroom');
          }}
        >
          Open in Classroom
        </button>
        <button
          className="fb"
          onClick={(e) => {
            e.stopPropagation();
            onPage('greq');
          }}
        >
          Assign work
        </button>
      </div>
    </>
  );
}
/* A guild card on the dashboard: title row, hero unread on the first
   messages card, quick or full body by size. Mirrors the Console WidgetCard
   — same seams (edit x / size toggle / tap-to-open), guild store behind it. */
export function GuildWidgetCard({
  id,
  dash,
  pageLen,
  isFirst,
  editing,
  onNavigate,
  onPage,
  onTab,
  onRemove,
  onRefresh,
  notify,
}: {
  id: GuildWidgetId;
  dash: GuildDashboard;
  /** Widgets on this page — the half rule needs the count. */
  pageLen: number;
  isFirst: boolean;
  editing: boolean;
  onNavigate: (id: GuildWidgetId) => void;
  onPage: (page: string, arg?: unknown) => void;
  onTab: (tab: string) => void;
  onRemove: () => void;
  onRefresh: () => void;
  notify: (message: string) => void;
}) {
  /* One size: every widget shows its full view, full width (Oct 2026 -
     the quick/full toggle barely changed anything). */
  const full = true;
  void dash;
  void pageLen;
  const unread = id === 'gmsg9' ? getGuild().threads.reduce((a, t) => a + (t.un || 0), 0) : 0;
  const go = () => onNavigate(id);
  return (
    <div
      className="wc"
      onClick={() => {
        if (!editing) go();
      }}
      role={editing ? undefined : 'button'}
      tabIndex={editing ? undefined : 0}
      onKeyDown={(e) => {
        if (!editing && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          go();
        }
      }}
    >
      {editing ? (
        <button
          className="rm"
          aria-label={'Remove ' + GUILD_WIDGET_TITLES[id]}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          ×
        </button>
      ) : null}
      <div className="wt">
        <Icon name={GUILD_WIDGET_ICONS[id]} />
        <span>{GUILD_WIDGET_TITLES[id]}</span>
        {!full ? <i>›</i> : null}
      </div>
      {isFirst && id === 'gmsg9' ? (
        <div className="big">
          {unread}
          <small>new message{unread === 1 ? '' : 's'}</small>
        </div>
      ) : null}
      {full ? (
        <GuildWidgetFull
          id={id}
          onPage={onPage}
          onTab={onTab}
          onRefresh={onRefresh}
          notify={notify}
        />
      ) : (
        <GuildWidgetQuick id={id} />
      )}
    </div>
  );
}

function GuildWidgetQuick({ id }: { id: GuildWidgetId }) {
  switch (id) {
    case 'gmsg9':
      return <QuickMsg />;
    case 'greq9':
      return <QuickReq />;
    case 'gact9':
      return <QuickAct />;
    case 'gshr9':
      return <QuickShr />;
    case 'gmkt9':
      return <QuickMkt />;
    case 'gasn9':
      return <QuickAsn />;
  }
}

function GuildWidgetFull({
  id,
  onPage,
  onTab,
  onRefresh,
  notify,
}: {
  id: GuildWidgetId;
  onPage: (page: string, arg?: unknown) => void;
  onTab: (tab: string) => void;
  onRefresh: () => void;
  notify: (message: string) => void;
}) {
  switch (id) {
    case 'gmsg9':
      return <FullMsg onPage={onPage} />;
    case 'greq9':
      return (
        <FullReq
          onPage={onPage}
          onAccept={(i) => {
            notify(answerRequest(i, 1));
            onRefresh();
          }}
        />
      );
    case 'gact9':
      return <FullAct onPage={onPage} />;
    case 'gshr9':
      return <FullShr onPage={onPage} />;
    case 'gmkt9':
      return (
        <FullMkt
          onPage={onPage}
          onTab={onTab}
          onTake={(i) => {
            notify(getFromMarket(i));
            onRefresh();
          }}
        />
      );
    case 'gasn9':
      return <FullAsn onPage={onPage} onTab={onTab} />;
  }
}
